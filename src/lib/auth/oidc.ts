import * as oidc from "openid-client";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { oidcAttempts, users } from "@/db/schema";
import { newId } from "@/lib/ids";
import { getOidcSettings } from "./config";
import { hashSessionToken } from "./session";
import { ensureBookingUsername } from "@/lib/booking/username";
export const OIDC_ATTEMPT_COOKIE = "mailflare_oidc_attempt";
export async function discoverOidc(env: CloudflareEnv) {
 const settings = getOidcSettings(env);
 const execute = [oidc.enableNonRepudiationChecks];
 if (settings.issuer.protocol === "http:") execute.push(oidc.allowInsecureRequests);
 const options = { execute };
 return oidc.discovery(settings.issuer, settings.clientId, undefined, oidc.ClientSecretBasic(settings.clientSecret), options);
}
export async function startOidcLogin(env: CloudflareEnv) {
 const settings = getOidcSettings(env);
 const config = await discoverOidc(env);
 const verifier = oidc.randomPKCECodeVerifier();
 const state = oidc.randomState();
 const nonce = oidc.randomNonce();
 const attemptToken = newId("oidc");
 const db = getDb(env);
 await db.delete(oidcAttempts).where(lt(oidcAttempts.expiresAt, new Date()));
 await db.insert(oidcAttempts).values({ tokenHash: await hashSessionToken(attemptToken), state, nonce, verifier, expiresAt: new Date(Date.now() + 600_000) });
 const url = oidc.buildAuthorizationUrl(config, { redirect_uri: settings.callback, scope: "openid profile email", code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256", state, nonce });
 return { url, attemptToken };
}
export async function finishOidcLogin(env: CloudflareEnv, callbackUrl: URL, attemptToken: string | undefined) {
 if (!attemptToken) throw new Error("The sign-in attempt is missing or expired. Start sign-in again.");
 const settings = getOidcSettings(env);
 const db = getDb(env);
 // Consume before contacting the provider, so concurrent callbacks cannot replay a code.
 const [attempt] = await db.delete(oidcAttempts).where(and(eq(oidcAttempts.tokenHash, await hashSessionToken(attemptToken)), gt(oidcAttempts.expiresAt, new Date()))).returning();
 if (!attempt || callbackUrl.searchParams.get("state") !== attempt.state) throw new Error("The sign-in attempt is invalid or expired. Start sign-in again.");
 const config = await discoverOidc(env);
 const trustedCallback = new URL(settings.callback);
 trustedCallback.search = callbackUrl.search;
 const tokens = await oidc.authorizationCodeGrant(config, trustedCallback, { pkceCodeVerifier: attempt.verifier, expectedState: attempt.state, expectedNonce: attempt.nonce, idTokenExpected: true });
 const subject = z.string().min(1).parse(tokens.claims()?.sub);
 const userInfo = await oidc.fetchUserInfo(config, tokens.access_token, subject);
 const identity = z.object({ sub: z.string().min(1), email: z.string().email(), name: z.string().optional() }).parse(userInfo);
 const lookup = and(eq(users.oidcIssuer, settings.issuer.href), eq(users.oidcSubject, identity.sub));
 const [existing] = await db.select().from(users).where(lookup).limit(1);
 if (existing?.disabled) throw new Error("This account is disabled.");
 if (existing) {
  await db.update(users).set({ email: identity.email, name: identity.name || identity.email }).where(eq(users.id, existing.id));
  return existing.id;
 }
 await db.insert(users).values({ id: newId("usr"), oidcIssuer: settings.issuer.href, oidcSubject: identity.sub, email: identity.email, name: identity.name || identity.email }).onConflictDoNothing({ target: [users.oidcIssuer, users.oidcSubject] });
 const [user] = await db.select().from(users).where(lookup).limit(1);
 if (!user || user.disabled) throw new Error("Could not establish the application account.");
 await ensureBookingUsername(env, user.id, identity.email);
 return user.id;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getOidcSettings } from "@/lib/auth/config";
import { finishOidcLogin, OIDC_ATTEMPT_COOKIE } from "@/lib/auth/oidc";
import { createSession, deleteSession, SESSION_COOKIE } from "@/lib/auth/session";
import { recordAuthActivity } from "@/lib/auth/activity";
export async function GET(request: Request) {
 const env = getEnv();
 const settings = getOidcSettings(env);
 const jar = await cookies();
 let response: NextResponse;
 try {
  const userId = await finishOidcLogin(env, new URL(request.url), jar.get(OIDC_ATTEMPT_COOKIE)?.value);
  const oldToken = jar.get(SESSION_COOKIE)?.value;
  if (oldToken) await deleteSession(env, oldToken);
  const token = await createSession(env, userId);
  await recordAuthActivity(env, { action: "auth.login", userId, request });
  response = NextResponse.redirect(new URL("/inbox", settings.origin));
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: settings.secure, sameSite: "lax", path: "/", maxAge: 28_800 });
 } catch (error) {
  console.error("OIDC sign-in failed", error instanceof Error ? error.message : "Unknown error");
  response = NextResponse.redirect(new URL("/login?error=oidc", settings.origin));
 }
 response.cookies.set(OIDC_ATTEMPT_COOKIE, "", { httpOnly: true, secure: settings.secure, sameSite: "lax", path: "/api/auth", maxAge: 0 });
 response.headers.set("Cache-Control", "no-store");
 return response;
}

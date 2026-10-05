import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getOidcSettings } from "@/lib/auth/config";
import { OIDC_ATTEMPT_COOKIE, startOidcLogin } from "@/lib/auth/oidc";
import { allowLoginAttempt } from "@/lib/auth/rate-limit";
import { applyPendingMigrations } from "@/lib/migrations/service";
export async function GET(request: Request) {
 const env = getEnv();
 try {
  const settings = getOidcSettings(env);
  if (!(await allowLoginAttempt(env, request))) return NextResponse.json({ error: "Too many sign-in attempts." }, { status: 429 });
  await applyPendingMigrations(env.DB);
  const { url, attemptToken } = await startOidcLogin(env);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(OIDC_ATTEMPT_COOKIE, attemptToken, { httpOnly: true, secure: settings.secure, sameSite: "lax", path: "/api/auth", maxAge: 600 });
  return response;
 } catch (error) {
  console.error("Could not start OIDC sign-in", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Sign-in is unavailable. Check Realmroot configuration and database initialization." }, { status: 503 });
 }
}

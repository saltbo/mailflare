import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { deleteSession, getSessionTokenFromRequestHeaders, SESSION_COOKIE } from "@/lib/auth/session";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
export async function POST(request: Request) {
 if (!hasValidSessionMutationOrigin(request, getEnv().APP_URL)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
 const token = getSessionTokenFromRequestHeaders(request);
 if (token) await deleteSession(getEnv(), token);
 const response = NextResponse.json({ ok: true });
 response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
 response.headers.set("Cache-Control", "no-store");
 return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
export function middleware(request: NextRequest) {
 if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.cookies.has("ep_session") && !hasValidSessionMutationOrigin(request, process.env.APP_URL ?? `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`)) {
  return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
 }
 return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };

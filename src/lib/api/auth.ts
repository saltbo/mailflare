import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";

/**
 * Session auth for route handlers. `requireUser` throws a bare Error, which Next turns into
 * a 500; this returns a proper 401 response instead so unauthenticated callers get the right
 * status.
 */
export async function requireSessionUser(env: CloudflareEnv, request: Request) {
	if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !hasValidSessionMutationOrigin(request, env.APP_URL)) return { user: null, error: NextResponse.json({ error: "Invalid origin" }, { status: 403 }) } as const;
	const user = await getCurrentUser(env, request);
	if (!user) {
		return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
	}
	return { user, error: null } as const;
}

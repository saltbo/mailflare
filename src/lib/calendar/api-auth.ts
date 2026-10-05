import { requireSessionUser } from "@/lib/api/auth";
export async function authorizeCalendarRequest(env: CloudflareEnv, request: Request) {
 return requireSessionUser(env, request);
}

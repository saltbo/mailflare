import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { userHasMailboxes } from "@/lib/user";
import { getLicenseEntitlements } from "@/lib/licenses/service";
import { hasCloudflareCredentials, isNodeRuntime } from "@/lib/runtime";
export async function GET(request: Request) {
 const env = getEnv();
 const user = await getCurrentUser(env, request);
 if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 const entitlements = await getLicenseEntitlements(env);
 const profile = { id: user.id, email: user.email, name: user.name, timeZone: user.timeZone, forwardingEmail: user.forwardingEmail, isOperator: user.isOperator, keyboardShortcutsEnabled: user.keyboardShortcutsEnabled, spamProtectionEnabled: user.spamProtectionEnabled, showFullRecipientAddresses: user.showFullRecipientAddresses };
 return NextResponse.json({ user: { ...profile, hasAvatar: !!user.avatarKey, canForwardEmail: entitlements.canForwardEmail }, runtime: isNodeRuntime(env) ? "node" : "cloudflare", managesDns: hasCloudflareCredentials(env), hasMailboxes: await userHasMailboxes(env, user.id) }, { headers: { "Cache-Control": "no-store" } });
}

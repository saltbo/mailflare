import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { userHasMailboxes } from "@/lib/user";
import { CreateMailboxClient } from "./create-mailbox-client";
export const dynamic = "force-dynamic";
export default async function MailboxesPage() {
 const env = getEnv();
 const user = await getCurrentUser(env);
 if (!user) redirect("/login");
 if (await userHasMailboxes(env, user.id)) redirect("/inbox");
 return <CreateMailboxClient />;
}

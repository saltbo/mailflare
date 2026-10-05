import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { getDb } from "@/db";
import { listAccessibleMailboxes } from "@/lib/mailboxes/access";
import { getMailboxDomainAddresses } from "@/lib/mailboxes/domain-addresses";
import { mailboxSchema } from "@/lib/validators";
import { createPersonalMailbox } from "@/lib/mailboxes/create";
export async function GET(request: Request) {
 const env = getEnv();
 const auth = await requireSessionUser(env, request);
 if (auth.error) return auth.error;
 const db = getDb(env);
 const rows = await listAccessibleMailboxes(db, auth.user);
 return NextResponse.json({ mailboxes: await Promise.all(rows.map(async (mailbox) => ({ ...mailbox, senderAddresses: await getMailboxDomainAddresses(db, mailbox) }))) });
}
export async function POST(request: Request) {
 const env = getEnv();
 const auth = await requireSessionUser(env, request);
 if (auth.error) return auth.error;
 const parsed = mailboxSchema.safeParse(await request.json().catch(() => null));
 if (!parsed.success) return NextResponse.json({ error: "Enter a valid mailbox username and domain." }, { status: 400 });
 const result = await createPersonalMailbox(env, auth.user.id, parsed.data);
 return NextResponse.json(result.body, { status: result.status });
}

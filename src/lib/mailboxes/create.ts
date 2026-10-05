import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxAliases, mailboxes } from "@/db/schema";
import { newId } from "@/lib/ids";
import { normalizeRecipientLocalPart } from "@/lib/email/recipient-address";
import { ensureMailboxDomainRouting } from "./domain-addresses";
export async function createPersonalMailbox(env: CloudflareEnv, userId: string, input: { domainId: string; localPart: string; displayName?: string }) {
 const db = getDb(env);
 const [domain] = await db.select().from(domains).where(and(eq(domains.id, input.domainId), eq(domains.status, "active"))).limit(1);
 if (!domain || (env.MAILBOX_DOMAIN && domain.hostname !== env.MAILBOX_DOMAIN)) return { status: 404, body: { error: "Domain is not available for mailbox creation." } };
 // Routing treats dot/plus variants as the same recipient. Reserve the canonical address atomically.
 const localPart = normalizeRecipientLocalPart(input.localPart);
 if (!localPart) return { status: 400, body: { error: "Enter a valid mailbox username." } };
 const aliases = await db.select({ localPart: mailboxAliases.localPart }).from(mailboxAliases).where(eq(mailboxAliases.domainId, domain.id));
 if (aliases.some((alias) => normalizeRecipientLocalPart(alias.localPart) === localPart)) return { status: 409, body: { error: "Mailbox address is already in use." } };
 const id = newId("mbx");
 const [created] = await db.insert(mailboxes).values({ id, userId, domainId: domain.id, localPart, displayName: input.displayName || localPart, type: "personal", useAllDomains: false }).onConflictDoNothing({ target: [mailboxes.domainId, mailboxes.localPart] }).returning({ id: mailboxes.id });
 if (!created) return { status: 409, body: { error: "Mailbox address is already in use." } };
 try {
  await ensureMailboxDomainRouting(env, db, { id, domainId: domain.id, localPart, useAllDomains: false });
 } catch (error) {
  await db.delete(mailboxes).where(eq(mailboxes.id, id));
  console.error("Mailbox routing failed", error);
  return { status: 502, body: { error: "Could not configure mailbox delivery. Please try again." } };
 }
 return { status: 201, body: { id, address: `${localPart}@${domain.hostname}` } };
}

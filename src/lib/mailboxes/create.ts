import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxAliases, mailboxes } from "@/db/schema";
import { newId } from "@/lib/ids";
import { normalizeRecipientLocalPart } from "@/lib/email/recipient-address";
import { ensureMailboxDomainRouting } from "./domain-addresses";
export async function createPersonalMailbox(env: CloudflareEnv, userId: string, input: { domainId: string; localPart: string; displayName?: string }) {
 const db = getDb(env);
 const [owned] = await db.select({ id: mailboxes.id }).from(mailboxes).where(eq(mailboxes.userId, userId)).limit(1);
 if (owned) return { status: 409, body: { error: "You already have a mailbox." } };
 const [domain] = await db.select().from(domains).where(and(eq(domains.id, input.domainId), eq(domains.status, "active"))).limit(1);
 if (!domain || (env.MAILBOX_DOMAIN && domain.hostname !== env.MAILBOX_DOMAIN)) return { status: 404, body: { error: "Domain is not available for mailbox creation." } };
 // Routing treats dot/plus variants as the same recipient. Reserve the canonical address atomically.
 const localPart = normalizeRecipientLocalPart(input.localPart);
 if (!localPart) return { status: 400, body: { error: "Enter a valid mailbox username." } };
 const aliases = await db.select({ localPart: mailboxAliases.localPart }).from(mailboxAliases).where(eq(mailboxAliases.domainId, domain.id));
 if (aliases.some((alias) => normalizeRecipientLocalPart(alias.localPart) === localPart)) return { status: 409, body: { error: "Mailbox address is already in use." } };
 const id = newId("mbx");
 // The existence check and reservation share one SQLite statement, including before the next migration.
 const created = await env.DB.prepare(`
  INSERT INTO mailboxes (id, user_id, domain_id, local_part, display_name, type, use_all_domains, created_at)
  SELECT ?, ?, ?, ?, ?, 'personal', 0, ?
  WHERE NOT EXISTS (SELECT 1 FROM mailboxes WHERE user_id = ?)
  ON CONFLICT DO NOTHING
  RETURNING id
 `).bind(id, userId, domain.id, localPart, input.displayName || localPart, Math.floor(Date.now() / 1000), userId).first<{ id: string }>();
 if (!created) {
  const [existing] = await db.select({ id: mailboxes.id }).from(mailboxes).where(eq(mailboxes.userId, userId)).limit(1);
  return { status: 409, body: { error: existing ? "You already have a mailbox." : "Mailbox address is already in use." } };
 }
 try {
  await ensureMailboxDomainRouting(env, db, { id, domainId: domain.id, localPart, useAllDomains: false });
 } catch (error) {
  await db.delete(mailboxes).where(eq(mailboxes.id, id));
  console.error("Mailbox routing failed", error);
  return { status: 502, body: { error: "Could not configure mailbox delivery. Please try again." } };
 }
 return { status: 201, body: { id, address: `${localPart}@${domain.hostname}` } };
}

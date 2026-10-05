import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/types";
import type { MailboxAccessLevel, MailboxPermission } from "./types";

export async function getMailboxAccessLevel(
	db: AppDatabase,
	user: Pick<SessionUser, "id">,
	mailboxId: string,
): Promise<MailboxAccessLevel | null> {
	const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
	if (!mailbox || mailbox.disabled) return null;

	return mailbox.userId === user.id ? buildAccess(mailbox) : null;
}

export async function listAccessibleMailboxes(db: AppDatabase, user: Pick<SessionUser, "id" | "email">) {
	const ownedRows = await db
		.select({
			id: mailboxes.id,
			userId: mailboxes.userId,
			domainId: mailboxes.domainId,
		localPart: mailboxes.localPart,
		displayName: mailboxes.displayName,
		signature: mailboxes.signature,
		autoReplyEnabled: mailboxes.autoReplyEnabled,
		autoReplySubject: mailboxes.autoReplySubject,
		autoReplyBody: mailboxes.autoReplyBody,
		useAllDomains: mailboxes.useAllDomains,
			avatarKey: mailboxes.avatarKey,
			type: mailboxes.type,
			disabled: mailboxes.disabled,
			createdAt: mailboxes.createdAt,
			hostname: domains.hostname,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(and(eq(mailboxes.userId, user.id), eq(mailboxes.disabled, false)));
	const owned = ownedRows
		.map((row) => {
			const { avatarKey, ...mailbox } = row;
			return {
				...mailbox,
				hasAvatar: !!avatarKey,
				permission: "full_access" as MailboxPermission,
				isPrimary: `${row.localPart}@${row.hostname}` === user.email,
			};
		});

	return owned;
}

export async function listAccessibleMailboxIds(db: AppDatabase, user: Pick<SessionUser, "id" | "email">) {
	const rows = await listAccessibleMailboxes(db, user);
	return rows.map((row) => row.id);
}

function buildAccess(mailbox: MailboxAccessLevel["mailbox"]): MailboxAccessLevel {
 return { mailbox, permission: "full_access", isOwner: true, canRead: true, canSendAs: true, canSendOnBehalf: false, canManage: true };
}

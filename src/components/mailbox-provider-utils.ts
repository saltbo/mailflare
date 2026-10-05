import { authFetch } from "@/lib/auth/client";
import type { MailboxOption } from "./mailbox-provider";

let mailboxesCache: MailboxOption[] | null = null;
let mailboxesRequest: Promise<MailboxOption[]> | null = null;
let cacheGeneration = 0;
export const SELECTED_MAILBOX_STORAGE_KEY = "selected-mailbox-id";

/**
 * The primary mailbox is the one at the account address; it is the only mailbox
 * whose name and avatar follow the profile.
 */
export function isIdentityMailbox(mailbox: Pick<MailboxOption, "type" | "isPrimary">): boolean {
	return mailbox.type === "personal" && !!mailbox.isPrimary;
}

export function clearMailboxesCache() {
	cacheGeneration += 1;
	mailboxesCache = null;
	mailboxesRequest = null;
}

export function clearMailboxClientState() {
	clearMailboxesCache();
	if (typeof window !== "undefined") {
		localStorage.removeItem(SELECTED_MAILBOX_STORAGE_KEY);
	}
}

export async function fetchMailboxOptions(force = false): Promise<MailboxOption[]> {

	if (!force && mailboxesCache) return mailboxesCache;
	if (!force && mailboxesRequest) return mailboxesRequest;
	const requestGeneration = cacheGeneration;
	mailboxesRequest = authFetch("/api/mailboxes")
		.then((res) => { if (!res.ok) throw new Error("Could not load mailboxes"); return res.json(); })
		.then((data) => {
			const items = ((data as { mailboxes?: MailboxOption[] }).mailboxes ?? []).map((m) => ({
				id: m.id,
				domainId: m.domainId,
				localPart: m.localPart,
				hostname: m.hostname,
				displayName: m.displayName,
				signature: m.signature,
				autoReplyEnabled: m.autoReplyEnabled,
				autoReplySubject: m.autoReplySubject,
				autoReplyBody: m.autoReplyBody,
				hasAvatar: m.hasAvatar,
				type: m.type,
				permission: m.permission,
				isPrimary: m.isPrimary,
				senderAddresses: m.senderAddresses,
			}));
			if (requestGeneration === cacheGeneration) {
				mailboxesCache = items;
			}
			return items;
		})
		.finally(() => {
			if (requestGeneration === cacheGeneration) {
				mailboxesRequest = null;
			}
		});

	return mailboxesRequest;
}

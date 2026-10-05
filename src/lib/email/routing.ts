import { eq, and, asc, desc } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { domains, folders, mailboxAliases, mailboxes, routingRules } from "@/db/schema";
import { getEmailAddress } from "@/lib/email/address";
import { getMailboxDomainAddresses } from "@/lib/mailboxes/domain-addresses";
import { normalizeRecipientLocalPart, parseRecipientAddress } from "@/lib/email/recipient-address";

export type ResolvedMailbox = {
	mailboxId: string;
	folderId: string | null;
	userId: string;
	domainId: string;
	localPart: string;
	hostname: string;
	displayName: string | null;
};

export type RoutingDecision = { action: "store"; mailbox: ResolvedMailbox };

export type InboxRuleDestination = {
	status: "received" | "spam" | "trash";
	folderId: string | null;
};


export type RuleMatchInput = {
	toAddress: string;
	fromAddress?: string | null;
	subject?: string | null;
	content?: string | null;
};

/** Resolve an enabled personal mailbox by its address or alias. */
export async function resolveInboundAddress(
	db: AppDatabase,
	toAddress: string,
): Promise<RoutingDecision | null> {
	const parsed = parseRecipientAddress(toAddress);
	if (!parsed) return null;

	const [domain] = await db
		.select()
		.from(domains)
		.where(and(eq(domains.hostname, parsed.domain), eq(domains.status, "active")))
		.limit(1);

	if (!domain) return null;

	const exactMailboxes = await db
		.select()
		.from(mailboxes)
		.where(and(eq(mailboxes.domainId, domain.id), eq(mailboxes.disabled, false)));
	const exactMailbox = exactMailboxes.find(
		(mailbox) => normalizeRecipientLocalPart(mailbox.localPart) === parsed.localPart,
	);
	const mailbox = exactMailbox
		?? await resolveMailboxAlias(db, domain.id, parsed.localPart)
		?? await resolveMailboxDomainAlias(db, parsed.localPart, parsed.normalizedAddress);

	if (mailbox) {
		return {
			action: "store",
			mailbox: toResolvedMailbox(mailbox, domain.id, domain.hostname),
		};
	}

	return null;
}

function toResolvedMailbox(
	mailbox: typeof mailboxes.$inferSelect,
	domainId: string,
	hostname: string,
): ResolvedMailbox {
	return {
		mailboxId: mailbox.id,
		folderId: null,
		userId: mailbox.userId,
		domainId,
		localPart: mailbox.localPart,
		hostname,
		displayName: mailbox.displayName,
	};
}

async function resolveMailboxAlias(db: AppDatabase, domainId: string, localPart: string) {
	const rows = await db
		.select({ mailbox: mailboxes, aliasLocalPart: mailboxAliases.localPart })
		.from(mailboxAliases)
		.innerJoin(mailboxes, eq(mailboxAliases.mailboxId, mailboxes.id))
		.where(and(
			eq(mailboxAliases.domainId, domainId),
			eq(mailboxes.disabled, false),
		));
	const row = rows.find(
		(item) => normalizeRecipientLocalPart(item.aliasLocalPart) === localPart,
	);
	return row?.mailbox ?? null;
}

async function resolveMailboxDomainAlias(
	db: AppDatabase,
	localPart: string,
	normalizedAddress: string,
) {
	const candidates = await db
		.select()
		.from(mailboxes)
		.where(and(eq(mailboxes.useAllDomains, true), eq(mailboxes.disabled, false)));

	for (const mailbox of candidates) {
		if (normalizeRecipientLocalPart(mailbox.localPart) !== localPart) continue;
		const addresses = await getMailboxDomainAddresses(db, mailbox);
		if (addresses.some((address) => parseRecipientAddress(address)?.normalizedAddress === normalizedAddress)) {
			return mailbox;
		}
	}
	return null;
}

export async function resolveInboxRuleDestination(
	db: AppDatabase,
	input: {
		mailboxId: string;
		toAddress: string;
		fromAddress?: string | null;
		subject?: string | null;
		content?: string | null;
	},
): Promise<InboxRuleDestination> {
	const rules = await db
		.select()
		.from(routingRules)
		.where(
			and(
				eq(routingRules.mailboxId, input.mailboxId),
				eq(routingRules.scope, "mailbox"),
				eq(routingRules.enabled, true),
			),
		)
		.orderBy(desc(routingRules.priority), asc(routingRules.createdAt));

	for (const rule of rules) {
		if (!matchesRule(rule, input)) continue;

		if (rule.action === "spam" || rule.action === "trash") {
			return { status: rule.action, folderId: null };
		}

		if (!rule.folderId) continue;
		const folderId = await getRuleFolderId(db, rule.folderId, input.mailboxId);
		if (!folderId) continue;
		return { status: "received", folderId };
	}

	return { status: "received", folderId: null };
}

type MatchableRule = {
	pattern: string;
	matchField?: string | null;
	matchOperator?: string | null;
	matchValue?: string | null;
};

export function matchesRule(rule: MatchableRule, input: RuleMatchInput): boolean {
	const rawValue = (rule.matchValue || rule.pattern).trim();
	// "*" is the catch-all pattern used by catch-all and block-everything rules.
	if (rawValue === "*") return true;
	const normalizedRuleValue = normalizeRuleComparisonValue(rule.matchField, rawValue);
	if (!normalizedRuleValue) return false;

	const values = getRuleFieldValues(rule.matchField, input);
	return values.some((value) => {
		if (!value) return false;
		const normalizedValue = normalizeRuleComparisonValue(rule.matchField, value);
		if (!normalizedValue) return false;
		return compareRuleValue(rule.matchOperator, normalizedValue, normalizedRuleValue, rawValue);
	});
}

function compareRuleValue(
	operator: string | null | undefined,
	value: string,
	ruleValue: string,
	rawRuleValue: string,
): boolean {
	switch (operator) {
		case "exact":
			return value === ruleValue;
		case "starts_with":
			return value.startsWith(ruleValue);
		case "ends_with":
			return value.endsWith(ruleValue);
		case "regex":
			return matchesRegex(value, rawRuleValue);
		default:
			return value.includes(ruleValue);
	}
}

/**
 * Rule patterns are operator-authored but still untrusted enough to warrant guarding:
 * an invalid pattern must not throw and take down inbound processing.
 */
function matchesRegex(value: string, pattern: string): boolean {
	try {
		return new RegExp(pattern, "i").test(value);
	} catch {
		return false;
	}
}

function normalizeRuleComparisonValue(field: string | null | undefined, value: string | null | undefined): string {
	if (!value) return "";
	if (field === "email" || field === "sender" || field === "recipient") {
		return getEmailAddress(value).trim().toLowerCase();
	}
	return value.toLowerCase();
}

function getRuleFieldValues(field: string | null | undefined, input: RuleMatchInput) {
	if (field === "content") return [input.content];
	if (field === "title") return [input.subject];
	if (field === "sender") return [input.fromAddress];
	if (field === "recipient") return [input.toAddress];
	return [input.fromAddress, input.toAddress];
}

async function getRuleFolderId(
	db: AppDatabase,
	folderId: string,
	mailboxId: string,
): Promise<string | null> {
	const [folder] = await db
		.select({ id: folders.id })
		.from(folders)
		.where(and(eq(folders.id, folderId), eq(folders.mailboxId, mailboxId)))
		.limit(1);
	return folder?.id ?? null;
}

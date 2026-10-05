export type ManagedApiKey = {
	id: string;
	name: string;
	prefix: string;
	kind: "legacy";
	scopes: string;
	mailboxIds: string[];
	mailboxScopeEnabled: boolean;
	createdAt: string;
	lastUsedAt: string | null;
};

import { authFetch } from "@/lib/auth/client";
import type { ApiKeyScope } from "@/lib/api/scopes";
import type { ManagedApiKey } from "./api-keys-settings-types";

export const STANDARD_KEY_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
	{ value: "read", label: "Read mail", description: "Read messages through the API." },
	{ value: "send", label: "Send mail", description: "Send messages directly through the API." },
	{ value: "calendar:read", label: "Read calendar", description: "Read your calendar events through the API." },
	{ value: "calendar:write", label: "Manage calendar", description: "Create, update, and delete your calendar events through the API." },
];

async function responseData(response: Response): Promise<{ error?: unknown; key?: string; apiKeys?: ManagedApiKey[] }> {
	return response.json().catch(() => ({})) as Promise<{ error?: unknown; key?: string; apiKeys?: ManagedApiKey[] }>;
}

export function keyPermissions(key: ManagedApiKey): string[] {
	try {
		const scopes: unknown = JSON.parse(key.scopes);
		return Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === "string") : [];
	} catch {
		return [];
	}
}

export async function loadManagedApiKeys(): Promise<ManagedApiKey[]> {
	const response = await authFetch("/api/api-keys");
	const data = await responseData(response);
	if (!response.ok || !data.apiKeys) throw new Error(typeof data.error === "string" ? data.error : "Could not load API keys");
	return data.apiKeys;
}

export async function createManagedApiKey(input: { name: string; scopes: ApiKeyScope[]; mailboxIds: string[] }): Promise<string> {
	const response = await authFetch("/api/api-keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: input.name, scopes: input.scopes, mailboxIds: input.mailboxIds }),
	});
	const data = await responseData(response);
	if (!response.ok || !data.key) throw new Error(typeof data.error === "string" ? data.error : "Could not create API key");
	return data.key;
}

export async function revokeManagedApiKey(id: string): Promise<void> {
	const response = await authFetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
	if (!response.ok) {
		const data = await responseData(response);
		throw new Error(typeof data.error === "string" ? data.error : "Could not revoke API key");
	}
}

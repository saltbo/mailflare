import type { NewMessageNotification } from "./types";

export function getSessionTokenFromRequest(request: Request): string | undefined {
	const cookie = request.headers.get("Cookie");
	if (!cookie) return undefined;

	for (const part of cookie.split(";")) {
		const [name, ...valueParts] = part.trim().split("=");
		if (name === "ep_session") {
			const value = valueParts.join("=");
			return value ? decodeURIComponent(value) : undefined;
		}
	}

	return undefined;
}

export async function getMailboxNotificationUserIds(
	env: CloudflareEnv,
	mailboxId: string,
	ownerUserId: string,
): Promise<string[]> {
	return [ownerUserId];
}

export async function notifyUsersOfNewMessage(
	env: CloudflareEnv,
	userIds: string[],
	payload: NewMessageNotification,
): Promise<void> {
	// Next dev uses a bindings-only proxy; realtime delivery runs in worker.ts.
	if (!env.REALTIME) return;
	await Promise.allSettled(
		userIds.map((userId) => {
			const hub = env.REALTIME.getByName(userId);
			return hub.fetch("https://mailflare-realtime/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
		}),
	);
}

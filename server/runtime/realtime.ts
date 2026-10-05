import { getUserFromSession } from "@/lib/auth/session";
import type { WebSocket } from "ws";
import { getUserMailRevision } from "@/lib/realtime/revision";
import type { RevisionPing, RevisionNotification } from "@/lib/realtime/types";

/**
 * Per-user WebSocket fan-out, standing in for the RealtimeHub Durable
 * Object. The HTTP server hands accepted sockets to `attach`; the
 * `REALTIME.getByName(userId).fetch("/notify")` calls the app already makes
 * land in `notify`.
 */
export class RealtimeHubRegistry {
	private readonly sockets = new Map<string, Set<WebSocket>>();
	private env: CloudflareEnv | null = null;
	private readonly sessionTokens = new WeakMap<WebSocket, string>();

	bindEnv(env: CloudflareEnv) {
		this.env = env;
	}

	attach(userId: string, socket: WebSocket, sessionToken: string) {
		const set = this.sockets.get(userId) ?? new Set();
		set.add(socket);
		this.sessionTokens.set(socket, sessionToken);
		this.sockets.set(userId, set);
		socket.on("message", (data) => {
			const message = data.toString();
			void (async () => {
				if (!(await this.hasSession(userId, socket))) return;
				if (message === "ping") { socket.send("pong"); return; }
				let ping: RevisionPing;
				try { ping = JSON.parse(message) as RevisionPing; } catch { return; }
				if (ping.type !== "ping" || !this.env) return;
				const revision = await getUserMailRevision(this.env, userId);
				const notification: RevisionNotification = { type: "revision", revision, changed: ping.revision !== null && ping.revision !== revision };
				socket.send(JSON.stringify(notification));
			})().catch(() => socket.close(1011, "Revision lookup failed"));
		});
		socket.on("close", () => {
			set.delete(socket);
			if (set.size === 0) this.sockets.delete(userId);
		});
	}

	async notify(userId: string, payload: unknown) {
		const message = JSON.stringify(payload);
		for (const socket of this.sockets.get(userId) ?? []) {
			try {
				if (!(await this.hasSession(userId, socket))) continue;
				socket.send(message);
			} catch {
				socket.close(1011, "Delivery failed");
			}
		}
	}

	private async hasSession(userId: string, socket: WebSocket) {
		const user = this.env ? await getUserFromSession(this.env, this.sessionTokens.get(socket)) : null;
		if (!user || user.disabled || user.id !== userId) { socket.close(1008, "Session expired"); return false; }
		return true;
	}

	connections() {
		let total = 0;
		for (const set of this.sockets.values()) total += set.size;
		return total;
	}

	/** The `DurableObjectNamespace` surface the app uses: `getByName(id).fetch(...)`. */
	namespace(): DurableObjectNamespace {
		const notify = (userId: string, payload: unknown) => this.notify(userId, payload);
		const stub = (userId: string) => ({
			async fetch(input: RequestInfo | URL, init?: RequestInit) {
				const request = input instanceof Request ? input : new Request(input, init);
				const url = new URL(request.url);
				if (url.pathname === "/notify" && request.method === "POST") {
					await notify(userId, await request.json());
					return new Response(null, { status: 204 });
				}
				return new Response("Not found", { status: 404 });
			},
		});
		return {
			getByName: (name: string) => stub(name),
			idFromName: (name: string) => ({ toString: () => name, name }),
			get: (id: { toString(): string }) => stub(id.toString()),
		} as unknown as DurableObjectNamespace;
	}
}

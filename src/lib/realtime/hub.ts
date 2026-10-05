import { getUserFromSession } from "@/lib/auth/session";
import { DurableObject } from "cloudflare:workers";
import { getUserMailRevision } from "./revision";
import type { NewMessageNotification, RevisionPing, RevisionNotification } from "./types";

export class RealtimeHub extends DurableObject<CloudflareEnv> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/connect") {
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket upgrade", { status: 426 });
			}

			const pair = new WebSocketPair();
			const client = pair[0];
			const server = pair[1];
			const userId = request.headers.get("X-Mailflare-Realtime-User");
			const sessionToken = request.headers.get("X-Mailflare-Realtime-Session");
			if (!userId || !sessionToken) return new Response("Unauthorized", { status: 401 });
			this.ctx.acceptWebSocket(server);
			server.serializeAttachment({ userId, sessionToken });

			return new Response(null, { status: 101, webSocket: client });
		}

		if (url.pathname === "/notify" && request.method === "POST") {
			const payload = (await request.json()) as NewMessageNotification;
			const message = JSON.stringify(payload);

			for (const socket of this.ctx.getWebSockets()) {
				try {
					if (!(await this.sessionUser(socket))) continue;
					socket.send(message);
				} catch {
					socket.close(1011, "Delivery failed");
				}
			}

			return new Response(null, { status: 204 });
		}

		return new Response("Not found", { status: 404 });
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const authenticatedUser = await this.sessionUser(socket);
		if (!authenticatedUser) return;
		if (message === "ping") {
			socket.send("pong");
			return;
		}
		if (typeof message !== "string") return;
		let ping: RevisionPing;
		try {
			ping = JSON.parse(message) as RevisionPing;
		} catch {
			return;
		}
		if (ping.type !== "ping") return;

		try {
			const revision = await getUserMailRevision(this.env, authenticatedUser.id);
			const notification: RevisionNotification = { type: "revision", revision, changed: ping.revision !== null && ping.revision !== revision };
			socket.send(JSON.stringify(notification));
		} catch {
			socket.close(1011, "Revision lookup failed");
		}
	}

 private async sessionUser(socket: WebSocket) {
  const attachment = socket.deserializeAttachment() as { userId?: string; sessionToken?: string } | null;
  const user = await getUserFromSession(this.env, attachment?.sessionToken);
  if (!user || user.disabled || user.id !== attachment?.userId) { socket.close(1008, "Session expired"); return null; }
  return user;
 }
}

import { MAILFLARE_FORWARDED_HEADER } from "@/lib/email/account-forwarding";

/**
 * Forwards to a Cloudflare Email Routing destination address. Returns whether the forward
 * succeeded so the caller can decide to still store the message.
 *
 * The destination must be a verified destination address in Cloudflare Email Routing.
 */
export async function forwardMessage(
	message: ForwardableEmailMessage,
	destination: string,
): Promise<boolean> {
	try {
		const headers = new Headers();
		headers.set(MAILFLARE_FORWARDED_HEADER, "1");
		await message.forward(destination, headers);
		return true;
	} catch (error) {
		console.error(`Forwarding failed for ${message.to} -> ${destination}`, error);
		return false;
	}
}

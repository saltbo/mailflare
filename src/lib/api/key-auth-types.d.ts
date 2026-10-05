import type { SessionUser } from "@/lib/auth/types";

export type ApiAuthResult = {
	userId: string;
	email: string;
	scopes: string[];
	mailboxIds: string[] | null;
	user: SessionUser;
};

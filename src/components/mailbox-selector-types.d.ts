import type { MailboxOption } from "./mailbox-provider";

export type MailboxSelectorUser = {
	id: string;
	isOperator: boolean;
	email: string;
	name: string;
	hasAvatar: boolean;
};

export type MailboxSelectorProps = {
	initialUser?: MailboxSelectorUser;
};

export type AccountAvatarProps = {
	name: string;
	colorSeed?: string;
	hasAvatar?: boolean;
	avatarUrl?: string;
	size?: "small" | "large";
	onAvatarError?: () => void;
};

export type MailboxAccountRowProps = {
	mailbox: MailboxOption;
	unread: number;
	avatarUrl?: string;
	onSelect: () => void;
};

export interface NewMessageNotification {
	from: string;
	fromName: string | null;
	mailboxId: string;
	messageId: string;
	subject: string | null;
	type: "new_message";
}


export interface MailboxRevisionRow {
	mailbox_id: string;
	revision: number;
	permission: string;
}

export interface RevisionPing {
	type: "ping";
	revision: string | null;
}

export interface RevisionNotification {
	type: "revision";
	revision: string;
	changed: boolean;
}

export interface RealtimeNotificationRequest {
	userIds: string[];
	payload: NewMessageNotification;
}

import type { SessionUser } from "./types";
/** Infrastructure access is configured at deployment, never granted by application users. */
export function isOperator(user: Pick<SessionUser, "isOperator">): boolean { return user.isOperator; }
export function assertOperator(user: Pick<SessionUser, "isOperator">): void {
 if (!isOperator(user)) throw new Error("Forbidden");
}

import type { users } from "@/db/schema";
export type SessionUser = typeof users.$inferSelect & { isOperator: boolean };

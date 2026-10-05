import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
export async function GET(request: Request) {
 const env = getEnv();
 const auth = await requireSessionUser(env, request);
 if (auth.error) return auth.error;
 const rows = await getDb(env).select({ id: domains.id, hostname: domains.hostname }).from(domains).where(and(eq(domains.status, "active"), env.MAILBOX_DOMAIN ? eq(domains.hostname, env.MAILBOX_DOMAIN) : undefined));
 return NextResponse.json({ domains: rows });
}

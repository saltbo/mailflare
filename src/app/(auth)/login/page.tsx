import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/cloudflare";
import { getUserFromSession, SESSION_COOKIE } from "@/lib/auth/session";
import { LoginClient } from "./login-client";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
 const user = await getUserFromSession(getEnv(), (await cookies()).get(SESSION_COOKIE)?.value);
 if (user && !user.disabled) redirect("/inbox");
 return <LoginClient />;
}

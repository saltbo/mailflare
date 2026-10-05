"use client";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
export function LoginClient() {
 const failed = useSearchParams().get("error") === "oidc";
 return <AuthShell icon={LogIn} title="Sign in" description="Sign in with Realmroot, then create your personal mailbox.">
  {failed && <p role="alert" className="mb-4 text-sm text-red-600">Sign-in failed or expired. Please start again.</p>}
  <a className="block rounded-full bg-blue-600 px-5 py-3 text-center font-medium text-white" href="/api/auth/login">Continue with Realmroot</a>
 </AuthShell>;
}

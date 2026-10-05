"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingTransition } from "@/components/loading-transition";
import { saveUserTimeZonePreference } from "@/lib/time/client";
import type { AuthGuardProps } from "./auth-guard-types";
export function AuthGuard({ children, mode = "protected", requireMailbox, requireOperator, allowAuthenticated }: AuthGuardProps) {
 const pathname = usePathname();
 const router = useRouter();
 const [authorizedFor, setAuthorizedFor] = useState<string | null>(null);
 const [errorFor, setErrorFor] = useState<string | null>(null);
 const guardKey = [mode, pathname, requireMailbox, requireOperator, allowAuthenticated].join(":");
 useEffect(() => {
  const controller = new AbortController();
  void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).then(async (response) => {
   if (response.status === 401) {
    if (mode === "protected") router.replace("/login");
    else setAuthorizedFor(guardKey);
    return;
   }
   if (!response.ok) throw new Error("Could not verify the session.");
   const data = await response.json() as { hasMailboxes: boolean; user: { id: string; isOperator: boolean; timeZone: string | null } };
   if (controller.signal.aborted) return;
   saveUserTimeZonePreference(data.user.id, data.user.timeZone);
   if (mode === "public" && !allowAuthenticated) { router.replace("/inbox"); return; }
   if (requireOperator && !data.user.isOperator) { router.replace("/inbox"); return; }
   if (requireMailbox && !data.hasMailboxes && pathname !== "/mailboxes") { router.replace("/mailboxes"); return; }
   setAuthorizedFor(guardKey);
  }).catch(() => { if (!controller.signal.aborted) setErrorFor(guardKey); });
  return () => controller.abort();
 }, [mode, pathname, requireMailbox, requireOperator, allowAuthenticated, router, guardKey]);
 if (errorFor === guardKey) return <p role="alert" className="p-6 text-red-600">Could not verify your session. Reload to try again.</p>;
 return <LoadingTransition ready={authorizedFor === guardKey}>{children}</LoadingTransition>;
}

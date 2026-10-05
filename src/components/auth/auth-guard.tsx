"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingTransition } from "@/components/loading-transition";
import { saveUserTimeZonePreference } from "@/lib/time/client";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth/client";
import type { AuthGuardProps } from "./auth-guard-types";
export function AuthGuard({ children, mode = "protected", requireMailbox, requireOperator, allowAuthenticated }: AuthGuardProps) {
 const pathname = usePathname();
 const router = useRouter();
 const [authorizedFor, setAuthorizedFor] = useState<string | null>(null);
 const [errorFor, setErrorFor] = useState<string | null>(null);
 const [sessionRevision, setSessionRevision] = useState(0);
 const needsMailbox = requireMailbox && pathname !== "/mailboxes";
 // Navigation within the same access policy must preserve the mounted app shell.
 const guardKey = [mode, needsMailbox, requireOperator, allowAuthenticated, sessionRevision].join(":");
 useEffect(() => {
  function onSessionChanged() { setSessionRevision((revision) => revision + 1); }
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged);
  return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged);
 }, []);
 useEffect(() => {
  const controller = new AbortController();
  function redirect(href: string) { setAuthorizedFor(null); router.replace(href); }
  void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).then(async (response) => {
   if (controller.signal.aborted) return;
   if (response.status === 401) {
    if (mode === "protected") redirect("/login");
    else setAuthorizedFor(guardKey);
    return;
   }
   if (!response.ok) throw new Error("Could not verify the session.");
   const data = await response.json() as { hasMailboxes: boolean; user: { id: string; isOperator: boolean; timeZone: string | null } };
   if (controller.signal.aborted) return;
   saveUserTimeZonePreference(data.user.id, data.user.timeZone);
   if (mode === "public" && !allowAuthenticated) { redirect("/inbox"); return; }
   if (requireOperator && !data.user.isOperator) { redirect("/inbox"); return; }
   if (needsMailbox && !data.hasMailboxes) { redirect("/mailboxes"); return; }
   setErrorFor(null);
   setAuthorizedFor(guardKey);
  }).catch(() => { if (!controller.signal.aborted) setErrorFor(guardKey); });
  return () => controller.abort();
 }, [mode, pathname, needsMailbox, requireOperator, allowAuthenticated, router, guardKey]);
 if (errorFor === guardKey) return <p role="alert" className="p-6 text-red-600">Could not verify your session. Reload to try again.</p>;
 return <LoadingTransition ready={authorizedFor === guardKey}>{children}</LoadingTransition>;
}

"use client";
import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function CreateMailboxClient() {
 const [domains, setDomains] = useState<{ id: string; hostname: string }[]>([]);
 const [domainId, setDomainId] = useState("");
 const [username, setUsername] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 useEffect(() => {
  const controller = new AbortController();
  void authFetch("/api/mailboxes/domains", { signal: controller.signal }).then(async (response) => {
   if (!response.ok) throw new Error("Could not load available domains.");
   const data = await response.json() as { domains: { id: string; hostname: string }[] };
   setDomains(data.domains); setDomainId(data.domains[0]?.id ?? "");
  }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, []);
 async function create(event: FormEvent) {
  event.preventDefault(); setSaving(true); setError(null);
  try {
   const response = await authFetch("/api/mailboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId, localPart: username }) });
   const data = await response.json() as { error?: string; address?: string };
   if (!response.ok) throw new Error(data.error || "Could not create your mailbox.");
   // Reload the mailbox provider so the newly created inbox is selected.
   window.location.assign("/inbox");
  } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your mailbox."); }
  finally { setSaving(false); }
 }
 return <section className="mx-auto max-w-lg px-6 py-12">
  <h1 className="text-2xl font-semibold">Create your mailbox</h1>
  <p className="mt-3 text-neutral-600">Choose a username for your personal email address. Only you can access this mailbox.</p>
  {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
  {loading ? <p className="mt-6">Loading domains…</p> : domains.length === 0 ? <p className="mt-6">No email domain is available yet. Contact the service operator.</p> : <form onSubmit={create} className="mt-6 space-y-5">
   <div><Label htmlFor="username">Username</Label><Input id="username" required maxLength={64} pattern="[A-Za-z0-9._%+\-]+" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" /></div>
   <div><Label htmlFor="domain">Email domain</Label><select id="domain" className="mt-2 w-full rounded-lg border p-3" value={domainId} onChange={(event) => setDomainId(event.target.value)}>{domains.map((domain) => <option key={domain.id} value={domain.id}>@{domain.hostname}</option>)}</select></div>
   <p className="text-sm text-neutral-500">Dots and plus suffixes are normalized when reserving an address.</p>
   <Button disabled={saving || !username.trim()} type="submit">{saving ? "Creating…" : "Create mailbox"}</Button>
  </form>}
 </section>;
}

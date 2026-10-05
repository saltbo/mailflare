// Run against the local browser acceptance provider and disposable app database.
import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3007");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "This acceptance runner is restricted to loopback test instances.");
const cookies = new Map();
async function request(path, method = "GET", body, headers = {}) {
 let url = new URL(path, base);
 for (let hop = 0; hop < 12; hop++) {
  const response = await fetch(url, { method, redirect: "manual", headers: { ...headers, ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) {
   const first = cookie.split(";", 1)[0], split = first.indexOf("=");
   if (/max-age=0/i.test(cookie)) cookies.delete(first.slice(0, split));
   else cookies.set(first.slice(0, split), first.slice(split + 1));
  }
  if (response.status >= 300 && response.status < 400 && response.headers.get("Location")) {
   url = new URL(response.headers.get("Location"), url);
   assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The mock provider must stay on loopback.");
   method = "GET"; body = undefined; continue;
  }
  return response;
 }
 throw new Error("Too many test redirects");
}
assert.equal((await request("/api/auth/me")).status, 401);
assert.equal((await request("/api/auth/login")).status, 200);
assert.equal((await request("/api/auth/me")).status, 200);
assert.ok(cookies.has("ep_session"));
assert.equal((await request("/api/mailboxes", "POST", { domainId: "browser-domain", localPart: "intruder", ownerUserId: "someone-else" }, { Origin: base.origin, "Content-Type": "application/json" })).status, 400);
assert.equal((await request("/api/mailboxes", "POST", { domainId: "browser-domain", localPart: "intruder" }, { Origin: "https://attacker.test", "Content-Type": "application/json", Authorization: "Bearer ignored" })).status, 403);
assert.equal((await request("/api/auth/logout", "POST", undefined, { Origin: base.origin })).status, 200);
assert.equal((await request("/api/auth/me")).status, 401);
assert.equal((await request("/mcp")).status, 404);
assert.equal((await request("/api/auth/register", "POST", {})).status, 404);
console.log("HTTP acceptance passed: login, cookie auth, owner injection, CSRF, logout, and removed endpoints.");

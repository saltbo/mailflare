import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { build } from "esbuild";

const root = new URL("../", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "mailflare-oidc-"));
after(() => rmSync(out, { recursive: true, force: true }));
await build({ stdin: { contents: `
 export * from "./src/lib/auth/oidc.ts";
 export * from "./src/lib/auth/session.ts";
 export * from "./src/lib/auth/config.ts";
 export * from "./src/lib/mailboxes/create.ts";
 export * from "./src/lib/mailboxes/access.ts";
 export { getAuthorizedSenderAddress } from "./src/lib/email/sender.ts";
 export * from "./src/lib/backups/export.ts";
 export * from "./src/lib/migrations/service.ts";
 export { mailboxSchema } from "./src/lib/validators.ts";
 export { getDb } from "./src/db/index.ts";
 export { openSqliteDatabase } from "./server/runtime/sqlite-database.ts";
 export { getBranding, updateBranding } from "./src/lib/branding/service.ts";
 export { resolveInboundAddress } from "./src/lib/email/routing.ts";
 export { RealtimeHubRegistry } from "./server/runtime/realtime.ts";
 `, resolveDir: root, sourcefile: "acceptance-entry.ts" }, outfile: join(out, "entry.mjs"), bundle: true, platform: "node", format: "esm", packages: "external", tsconfig: join(root, "tsconfig.json"), logLevel: "silent" });
// External dependencies resolve from the project rather than the temporary output directory.
const { symlinkSync } = await import("node:fs");
symlinkSync(join(root, "node_modules"), join(out, "node_modules"), "dir");
const api = await import(pathToFileURL(join(out, "entry.mjs")).href);
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
let issuer;
const codes = new Map();
const accessTokens = new Map();
let exchanges = 0;
const server = createServer(async (req, res) => {
 res.setHeader("Content-Type", "application/json");
 const url = new URL(req.url, issuer);
 if (url.pathname === "/issuer/.well-known/openid-configuration") {
  res.end(JSON.stringify({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks", userinfo_endpoint: issuer + "/userinfo", response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_basic"] })); return;
 }
 if (url.pathname === "/issuer/jwks") { res.end(JSON.stringify({ keys: [jwk] })); return; }
 if (url.pathname === "/issuer/userinfo") {
  const identity = accessTokens.get(req.headers.authorization?.slice(7));
  if (!identity) { res.writeHead(401); res.end("{}"); return; }
  res.end(JSON.stringify(identity)); return;
 }
 if (url.pathname !== "/issuer/token") { res.writeHead(404); res.end("{}"); return; }
 exchanges++;
 let body = ""; for await (const chunk of req) body += chunk;
 const params = new URLSearchParams(body);
 const code = codes.get(params.get("code"));
 if (!code || params.get("grant_type") !== "authorization_code" || req.headers.authorization !== "Basic " + Buffer.from("mailflare:test%2Dsecret").toString("base64") || createHash("sha256").update(params.get("code_verifier") || "").digest("base64url") !== code.challenge) { res.writeHead(400); res.end(JSON.stringify({ error: "invalid_grant" })); return; }
 codes.delete(params.get("code"));
 const now = Math.floor(Date.now() / 1000);
 const claims = { iss: issuer, aud: "mailflare", sub: code.subject, nonce: code.nonce, email: code.email, name: "Test User", iat: now, exp: now + 300, ...code.overrides };
 const encoded = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url") + "." + Buffer.from(JSON.stringify(claims)).toString("base64url");
 const signature = code.badSignature ? "bad-signature" : sign("RSA-SHA256", Buffer.from(encoded), privateKey).toString("base64url");
 const accessToken = crypto.randomUUID();
 accessTokens.set(accessToken, { sub: code.subject, email: code.email, name: "Test User", ...code.userInfoOverrides });
 res.end(JSON.stringify({ access_token: accessToken, token_type: "Bearer", expires_in: 300, id_token: encoded + "." + signature }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
issuer = `http://127.0.0.1:${server.address().port}/issuer`;
after(() => new Promise((resolve) => server.close(resolve)));

async function fixture(t, beforeLast = false) {
 const DB = api.openSqliteDatabase(":memory:");
 t.after(() => DB.db.close());
 const env = { DB, APP_URL: "http://127.0.0.1:3000", OIDC_ISSUER: issuer, OIDC_CLIENT_ID: "mailflare", OIDC_CLIENT_SECRET: "test-secret", OIDC_OPERATOR_SUBJECTS: "operator", MAILBOX_DOMAIN: "tftt.cc", MAILFLARE_RUNTIME: "node" };
 if (beforeLast) {
  const bundle = JSON.parse(readFileSync(join(root, "src/lib/migrations/bundle.json"), "utf8"));
  for (const migration of bundle.migrations.filter((migration) => migration.name < (beforeLast === "before-feature-removal" ? "0054_remove_licenses_keys_domain_routing.sql" : "0053_realmroot_personal_mailboxes.sql"))) for (const statement of migration.statements) DB.db.exec(statement);
 } else await api.applyPendingMigrations(DB);
 return env;
}
async function attempt(env, subject = "alice", email = "alice@id.test", overrides = {}, badSignature = false, userInfoOverrides = {}) {
 const started = await api.startOidcLogin(env);
 const code = crypto.randomUUID();
 codes.set(code, { subject, email, nonce: started.url.searchParams.get("nonce"), challenge: started.url.searchParams.get("code_challenge"), overrides, badSignature, userInfoOverrides });
 const callback = new URL("/api/auth/callback", env.APP_URL);
 callback.searchParams.set("state", started.url.searchParams.get("state"));
 callback.searchParams.set("code", code);
 return { ...started, callback };
}

test("OIDC validates signed identity, reuses subject across email changes, and keeps equal emails distinct", async (t) => {
 const env = await fixture(t);
 const one = await attempt(env);
 assert.equal(one.url.searchParams.get("scope"), "openid profile email");
 assert.equal(one.url.searchParams.get("code_challenge_method"), "S256");
 const userId = await api.finishOidcLogin(env, one.callback, one.attemptToken);
 const two = await attempt(env, "alice", "changed@id.test");
 assert.equal(await api.finishOidcLogin(env, two.callback, two.attemptToken), userId);
 const three = await attempt(env, "bob", "changed@id.test");
 assert.notEqual(await api.finishOidcLogin(env, three.callback, three.attemptToken), userId);
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM users").get().n, 2);
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM mailboxes").get().n, 0, "login does not allocate a mailbox");
});

test("missing, mismatched, expired and replayed attempts never exchange a token", async (t) => {
 const env = await fixture(t);
 const one = await attempt(env);
 const before = exchanges;
 await assert.rejects(api.finishOidcLogin(env, one.callback, undefined), /missing/);
 one.callback.searchParams.set("state", "attacker");
 await assert.rejects(api.finishOidcLogin(env, one.callback, one.attemptToken), /invalid/);
 assert.equal(exchanges, before);
 const expired = await attempt(env);
 env.DB.db.prepare("UPDATE oidc_attempts SET expires_at = 1").run();
 await assert.rejects(api.finishOidcLogin(env, expired.callback, expired.attemptToken), /expired/);
 const valid = await attempt(env);
 await api.finishOidcLogin(env, valid.callback, valid.attemptToken);
 const exchanged = exchanges;
 await assert.rejects(api.finishOidcLogin(env, valid.callback, valid.attemptToken), /expired/);
 assert.equal(exchanges, exchanged);
});

for (const [name, overrides, badSignature] of [
 ["nonce", { nonce: "wrong" }, false], ["issuer", { iss: "https://attacker.test" }, false],
 ["audience", { aud: "other-client" }, false], ["expiry", { exp: 1 }, false], ["signature", {}, true],
]) test(`OIDC rejects an invalid ${name}`, async (t) => {
 const env = await fixture(t);
 const one = await attempt(env, "alice", "alice@id.test", overrides, badSignature);
 await assert.rejects(api.finishOidcLogin(env, one.callback, one.attemptToken), (error) => error.code !== "OAUTH_RESPONSE_BODY_ERROR");
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM users").get().n, 0);
});

test("self-service creates only personal single-domain mailboxes and enforces ownership even for operators", async (t) => {
 const env = await fixture(t);
 for (const subject of ["alice", "bob", "operator"]) {
  env.DB.db.prepare("INSERT INTO users(id,email,name,oidc_issuer,oidc_subject,created_at) VALUES(?,?,?,?,?,1)").run(subject, subject + "@id.test", subject, issuer, subject);
 }
 env.DB.db.prepare("INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES('domain','operator','tftt.cc','manual','active','none',1)").run();
 assert.equal(api.mailboxSchema.safeParse({ domainId: "domain", localPart: "sam", ownerUserId: "bob" }).success, false);
 assert.equal(api.mailboxSchema.safeParse({ domainId: "domain", localPart: "sam", type: "shared" }).success, false);
 const created = await api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart: "sam" });
 assert.equal(created.status, 201);
 assert.equal(created.body.address, "sam@tftt.cc");
 assert.equal((await api.createPersonalMailbox(env, "bob", { domainId: "domain", localPart: "s.am+tag" })).status, 409);
 assert.equal((await api.createPersonalMailbox(env, "bob", { domainId: "missing", localPart: "bob" })).status, 404);
 const db = api.getDb(env);
 const mailboxId = created.body.id;
 assert.equal((await api.getMailboxAccessLevel(db, { id: "alice" }, mailboxId)).canSendAs, true);
 assert.equal(await api.getMailboxAccessLevel(db, { id: "bob" }, mailboxId), null);
 assert.equal(await api.getMailboxAccessLevel(db, { id: "operator", isOperator: true }, mailboxId), null);
 assert.deepEqual(await api.listAccessibleMailboxIds(db, { id: "bob", email: "bob@id.test" }), []);
 const token = await api.createSession(env, "alice");
 assert.equal((await api.getUserFromSession(env, token)).id, "alice");
 await api.deleteSession(env, token);
 assert.equal(await api.getUserFromSession(env, token), null);
});

test("fresh migrations remove credentials and AI tables; backups cover both sides of the migration", async (t) => {
 const env = await fixture(t);
 const before = await fixture(t, true);
 const oldBackup = await api.exportDatabaseRecords(before.DB);
 const document = JSON.parse(new TextDecoder().decode(oldBackup));
 assert.ok(document.tables.agent_conversations);
 assert.ok(document.tables.password_reset_tokens);
 await api.restoreDatabaseRecords(env.DB, oldBackup.buffer);
 const backup = await api.exportDatabaseRecords(env.DB);
 const tables = await api.assertBackupTablesCoverDatabase(env.DB);
 assert.ok(!tables.has("api_key_mailboxes"));
 assert.ok(!tables.has("api_keys"));
 assert.ok(!tables.has("license_settings"));
 assert.ok(!tables.has("agent_conversations"));
 assert.ok(!tables.has("mailbox_access"));
 assert.ok(!tables.has("oidc_attempts"));
 const columns = env.DB.db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
 assert.ok(!columns.includes("password_hash"));
 assert.ok(!columns.includes("role"));
 await api.restoreDatabaseRecords(env.DB, backup.buffer);
 assert.deepEqual(env.DB.db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("migration refuses to erase an existing installation", async (t) => {
 const env = await fixture(t, true);
 env.DB.db.prepare("INSERT INTO users(id,email,password_hash,name,created_at) VALUES('old','old@example.test','hash','Old',1)").run();
 const bundle = JSON.parse(readFileSync(join(root, "src/lib/migrations/bundle.json"), "utf8"));
 assert.throws(() => env.DB.db.exec(bundle.migrations.find((migration) => migration.name === "0053_realmroot_personal_mailboxes.sql").statements.join("\n")), /CHECK constraint/);
 assert.equal(env.DB.db.prepare("SELECT id FROM users").get().id, "old");
});

test("an established realtime connection stops delivering after session revocation", async (t) => {
 const { WebSocket, WebSocketServer } = await import("ws");
 const { once } = await import("node:events");
 const env = await fixture(t);
 env.DB.db.prepare("INSERT INTO users(id,email,name,oidc_issuer,oidc_subject,created_at) VALUES('alice','alice@id.test','Alice',?,?,1)").run(issuer, "alice");
 const token = await api.createSession(env, "alice");
 const hub = new api.RealtimeHubRegistry(); hub.bindEnv(env);
 const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
 await once(server, "listening");
 server.on("connection", (socket) => hub.attach("alice", socket, token));
 const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
 t.after(() => { socket.terminate(); for (const client of server.clients) client.terminate(); return new Promise((resolve) => server.close(resolve)); });
 await once(socket, "open");
 const first = once(socket, "message");
 socket.send(JSON.stringify({ type: "ping", revision: null }));
 assert.equal(JSON.parse((await first)[0].toString()).type, "revision");
 await api.deleteSession(env, token);
 let delivered = false; socket.on("message", () => { delivered = true; });
 const closed = once(socket, "close");
 await hub.notify("alice", { type: "new_message", subject: "private" });
 assert.equal((await closed)[0], 1008);
 assert.equal(delivered, false);
});

test("identity-only ID Tokens load profile from UserInfo, which must belong to the same subject", async (t) => {
 const env = await fixture(t);
 const one = await attempt(env, "alice", "alice@id.test", { email: undefined, name: undefined });
 const id = await api.finishOidcLogin(env, one.callback, one.attemptToken);
 assert.equal(env.DB.db.prepare("SELECT email FROM users WHERE id = ?").get(id).email, "alice@id.test");
 const mismatched = await attempt(env, "bob", "bob@id.test", {}, false, { sub: "alice" });
 await assert.rejects(api.finishOidcLogin(env, mismatched.callback, mismatched.attemptToken));
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM users").get().n, 1);
});

test("personal mailbox owners may send as their address while other users and operators are rejected", async (t) => {
 const env = await fixture(t);
 for (const id of ["alice", "bob", "operator"]) env.DB.db.prepare("INSERT INTO users(id,email,name,oidc_issuer,oidc_subject,created_at) VALUES(?,?,?,?,?,1)").run(id, id + "@identity.test", id, issuer, id);
 env.DB.db.prepare("INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES('domain','operator','tftt.cc','manual','active','none',1)").run();
 const created = await api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart: "alice", displayName: "Alice Mail" });
 assert.equal(created.status, 201);
 const mailboxId = created.body.id;
 const sender = await api.getAuthorizedSenderAddress(env, { userId: "alice", mailboxId, from: "alice@tftt.cc" });
 assert.deepEqual(sender, { fromAddr: '"Alice Mail" <alice@tftt.cc>', mailboxId });
 for (const userId of ["bob", "operator"]) await assert.rejects(api.getAuthorizedSenderAddress(env, { userId, mailboxId, from: "alice@tftt.cc" }), /You do not have permission to send from this mailbox/);
 await assert.rejects(api.getAuthorizedSenderAddress(env, { userId: "alice", mailboxId, from: "bob@tftt.cc" }), /Sender address does not match/);
 env.DB.db.prepare("UPDATE mailboxes SET disabled = 1 WHERE id = ?").run(mailboxId);
 await assert.rejects(api.getAuthorizedSenderAddress(env, { userId: "alice", mailboxId, from: "alice@tftt.cc" }), /You do not have permission/);
});

test("mailbox creation rejects a second mailbox and concurrent requests reserve only one", async (t) => {
 const env = await fixture(t);
 env.DB.db.prepare("INSERT INTO users(id,email,name,created_at) VALUES('alice','alice@id.test','Alice',1)").run();
 env.DB.db.prepare("INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES('domain','alice','tftt.cc','manual','active','none',1)").run();
 const results = await Promise.all(["one", "two"].map((localPart) => api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart })));
 assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM mailboxes WHERE user_id='alice'").get().n, 1);
 assert.equal((await api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart: "three" })).body.error, "You already have a mailbox.");
});

test("branding name and icon work without a license and survive backup/restore", async (t) => {
 const env = await fixture(t);
 const objects = new Map();
 env.BUCKET = { put: async (key, body, options) => objects.set(key, { body, options }) };
 assert.ok(!env.DB.db.prepare("SELECT name FROM sqlite_master WHERE name='license_settings'").get());
 const icon = new File([new Uint8Array([1,2,3])], "icon.png", { type: "image/png" });
 const branding = await api.updateBranding(env, { appName: "tmail", icon });
 assert.equal(branding.appName, "tmail"); assert.equal(branding.hasCustomIcon, true);
 assert.equal(objects.get("branding/app-icon").options.httpMetadata.contentType, "image/png");
 const backup = await api.exportDatabaseRecords(env.DB);
 await api.restoreDatabaseRecords(env.DB, backup.buffer);
 assert.equal((await api.getBranding(env)).appName, "tmail");
});

test("removed domain rules cannot reject a real mailbox or route an unowned catch-all", async (t) => {
 const env = await fixture(t);
 env.DB.db.prepare("INSERT INTO users(id,email,name,created_at) VALUES('alice','alice@id.test','Alice',1)").run();
 env.DB.db.prepare("INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES('domain','alice','tftt.cc','manual','active','none',1)").run();
 const mailbox = await api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart: "alice" });
 env.DB.db.prepare("INSERT INTO routing_rules(id,user_id,domain_id,scope,pattern,action,mailbox_id,created_at) VALUES('legacy','alice','domain','domain','*','reject',?,1)").run(mailbox.body.id);
 assert.equal((await api.resolveInboundAddress(api.getDb(env), "alice@tftt.cc")).mailbox.mailboxId, mailbox.body.id);
 assert.equal(await api.resolveInboundAddress(api.getDb(env), "unknown@tftt.cc"), null);
});

test("feature removal preserves users and mail and restores a pre-removal full backup", async (t) => {
 const env = await fixture(t, "before-feature-removal");
 env.DB.db.prepare("INSERT INTO users(id,email,name,oidc_issuer,oidc_subject,created_at) VALUES('alice','alice@identity.test','Alice',?,'alice',1)").run(issuer);
 env.DB.db.prepare("INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES('domain','alice','tftt.cc','manual','active','none',1)").run();
 const mailbox = await api.createPersonalMailbox(env, "alice", { domainId: "domain", localPart: "alice" });
 env.DB.db.prepare("INSERT INTO messages(id,user_id,mailbox_id,direction,from_addr,to_addr,subject,status,created_at) VALUES('message','alice',?,'inbound','from@example.test','alice@tftt.cc','Keep this mail','received',1)").run(mailbox.body.id);
 env.DB.db.prepare("INSERT INTO api_keys(id,user_id,name,prefix,key_hash,scopes,created_at) VALUES('key','alice','Old key','ep_test','hash','[]',1)").run();
 env.DB.db.prepare("INSERT INTO license_settings(id,instance_id,updated_at) VALUES('default','old-instance',1)").run();
 const backup = await api.exportDatabaseRecords(env.DB);
 const migration = JSON.parse(readFileSync(join(root, "src/lib/migrations/bundle.json"), "utf8")).migrations.find((item) => item.name === "0054_remove_licenses_keys_domain_routing.sql");
 await env.DB.batch(migration.statements.map((statement) => env.DB.prepare(statement)));
 assert.equal(env.DB.db.prepare("SELECT subject FROM messages WHERE id='message'").get().subject, "Keep this mail");
 assert.ok(!env.DB.db.prepare("SELECT name FROM sqlite_master WHERE name='api_keys'").get());
 await api.restoreDatabaseRecords(env.DB, backup.buffer);
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM users").get().n, 1);
 assert.equal(env.DB.db.prepare("SELECT count(*) AS n FROM mailboxes").get().n, 1);
 assert.equal(env.DB.db.prepare("SELECT subject FROM messages WHERE id='message'").get().subject, "Keep this mail");
 assert.deepEqual(env.DB.db.prepare("PRAGMA foreign_key_check").all(), []);
});

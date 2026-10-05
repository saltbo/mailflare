import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
const bundle = JSON.parse(readFileSync(new URL("../src/lib/migrations/bundle.json", import.meta.url), "utf8"));
test("the bundled migrations initialize a fresh database with personal mailbox and OIDC identity tables", () => {
 const db = new DatabaseSync(":memory:");
 try {
  db.exec("PRAGMA foreign_keys=ON");
  for (const migration of bundle.migrations) for (const statement of migration.statements) db.exec(statement);
  db.exec("INSERT INTO users(id,email,name,oidc_issuer,oidc_subject,created_at) VALUES('u','a@id.test','Alice','https://id.test','alice',1)");
  db.exec("INSERT INTO domains(id,user_id,hostname,zone_id,created_at) VALUES('d','u','tftt.cc','manual',1)");
  db.exec("INSERT INTO mailboxes(id,user_id,domain_id,local_part,signature,auto_reply_enabled,auto_reply_subject,auto_reply_body,created_at) VALUES('m','u','d','alice','sig',0,'Out of office','',1)");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.ok(bundle.migrations.some((migration) => migration.name === "0053_realmroot_personal_mailboxes.sql"));
 } finally { db.close(); }
});

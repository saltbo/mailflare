// Local browser acceptance provider. Never used by the application or a deployment.
import { createServer } from "node:http";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
const issuer = "http://127.0.0.1:4433/issuer";
const appOrigin = process.env.TEST_APP_ORIGIN ?? "http://127.0.0.1:3007";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "local", alg: "RS256", use: "sig" };
const codes = new Map();
const accessTokens = new Map();
createServer(async (request, response) => {
 const url = new URL(request.url, issuer);
 response.setHeader("Content-Type", "application/json");
 if (url.pathname === "/issuer/.well-known/openid-configuration") {
  response.end(JSON.stringify({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks", userinfo_endpoint: issuer + "/userinfo", response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_basic"] })); return;
 }
 if (url.pathname === "/issuer/jwks") { response.end(JSON.stringify({ keys: [jwk] })); return; }
 if (url.pathname === "/issuer/authorize") {
  const code = crypto.randomUUID();
  codes.set(code, { nonce: url.searchParams.get("nonce"), challenge: url.searchParams.get("code_challenge") });
  const callback = new URL("/api/auth/callback", appOrigin);
  callback.searchParams.set("state", url.searchParams.get("state")); callback.searchParams.set("code", code);
  response.writeHead(302, { Location: callback.href }); response.end(); return;
 }
 if (url.pathname === "/issuer/userinfo") {
  if (!accessTokens.has(request.headers.authorization?.slice(7))) { response.writeHead(401); response.end("{}"); return; }
  response.end(JSON.stringify({ sub: "local-alice", name: "Alice", email: "alice@identity.test" })); return;
 }
 if (url.pathname === "/issuer/token") {
  let body = ""; for await (const chunk of request) body += chunk;
  const params = new URLSearchParams(body), code = codes.get(params.get("code"));
  if (!code || createHash("sha256").update(params.get("code_verifier") || "").digest("base64url") !== code.challenge) { response.writeHead(400); response.end(JSON.stringify({ error: "invalid_grant" })); return; }
  codes.delete(params.get("code"));
  const now = Math.floor(Date.now() / 1000);
  const encoded = Buffer.from(JSON.stringify({ alg: "RS256", kid: "local" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ iss: issuer, aud: "mailflare", sub: "local-alice", nonce: code.nonce, name: "Alice", email: "alice@identity.test", iat: now, exp: now + 300 })).toString("base64url");
  accessTokens.set("local-test-only", true);
  response.end(JSON.stringify({ access_token: "local-test-only", token_type: "Bearer", expires_in: 300, id_token: encoded + "." + sign("RSA-SHA256", Buffer.from(encoded), privateKey).toString("base64url") })); return;
 }
 response.writeHead(404); response.end("{}");
}).listen(4433, "127.0.0.1", () => console.log("Local acceptance IdP on http://127.0.0.1:4433"));

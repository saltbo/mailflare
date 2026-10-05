export function getOidcSettings(env: CloudflareEnv) {
 if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.APP_URL) {
  throw new Error("Configure APP_URL, OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET before signing in.");
 }
 const origin = new URL(env.APP_URL);
 const issuer = new URL(env.OIDC_ISSUER);
 const loopback = (url: URL) => url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
 if ((origin.protocol !== "https:" && !loopback(origin)) || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error("APP_URL must be an HTTPS origin (HTTP loopback is allowed for local development).");
 }
 if ((issuer.protocol !== "https:" && !loopback(issuer)) || issuer.search || issuer.hash || issuer.username || issuer.password) {
  throw new Error("OIDC_ISSUER must be an HTTPS issuer URL.");
 }
 return { issuer, origin: origin.origin, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, callback: `${origin.origin}/api/auth/callback`, secure: origin.protocol === "https:" };
}
export function isOperatorSubject(env: CloudflareEnv, issuer: string | null, subject: string | null): boolean {
 return !!subject && !!issuer && issuer === env.OIDC_ISSUER && (env.OIDC_OPERATOR_SUBJECTS ?? "").split(",").map((value) => value.trim()).includes(subject);
}

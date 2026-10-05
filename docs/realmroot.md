# Realmroot sign-in and personal mailboxes

Mailflare uses `openid-client` as a confidential OIDC web client. Passwords, registration, recovery and MFA belong to Realmroot. It has no local account registration, shared mailboxes, AI assistant or MCP server.

## Production configuration

- Realmroot Application: `tmail` (`confidential_web`), Client ID `01a109b5-3e34-767c-9ece-059e4ad0a726`.
- Application origin: `https://mail.tftt.cc`
- Issuer: `https://id.realmroot.dev/api/auth`
- Production redirect URI: `https://mail.tftt.cc/api/auth/callback`
- Local acceptance redirect URI: `http://127.0.0.1:3007/api/auth/callback` (also registered; the app origin must match the selected environment)
- Client type: `confidential_web`; token endpoint authentication: `client_secret_basic`
- Scopes: `openid profile email`; PKCE S256, state and nonce are used on every attempt.
- `MAILBOX_DOMAIN=tftt.cc`: signed-in users create `username@tftt.cc` addresses.
- `OIDC_OPERATOR_SUBJECTS`: comma-separated Realmroot subjects allowed to configure domains and infrastructure. This grants no access to another user's mailbox. There is no first-login administrator election or in-app role editor.

Set `APP_URL`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_OPERATOR_SUBJECTS`, and `MAILBOX_DOMAIN`. Put the secret in a Worker secret or a protected ignored environment file, never the repository or browser. Local development uses an explicitly registered HTTP loopback origin and callback. Use separate clients/secrets for production and development when practical.

The login route initializes an empty database with committed migrations. Migration 0053 refuses to erase an installation that already has users. This edition is intended for a new database; it does not migrate existing users or mail. Provision a new database/data volume when replacing a previous install. It never deletes a remote database automatically.

## User journey

1. Open `/login` and continue with Realmroot.
2. The callback validates the signed ID Token, loads profile claims through UserInfo with a matching subject, and binds `(issuer, subject)` to a local business user. Equal or changed email claims do not link identities.
3. A user without a mailbox opens `/mailboxes`, chooses a username, and creates a personal mailbox on an active configured domain. Login itself does not allocate an address.
4. The address is reserved uniquely; dot/plus variants use the existing canonical recipient rules. Owner and mailbox type cannot be supplied by the caller. New mailboxes use only the selected domain.
5. Mailbox reads, writes, attachments, sending and realtime delivery are restricted to the owner. Infrastructure operators have no mailbox override.

The operator must first connect `tftt.cc` under Domains and complete the chosen receiving/sending provider setup. Until it is active, users see that no domain is available. Cloudflare-managed receiving requires the runtime `CF_TOKEN` and domain DNS/Email Routing permissions.

## Sessions and logout

OAuth tokens never enter browser JavaScript. The application stores a hashed opaque session token and sets an HttpOnly, SameSite cookie (Secure on HTTPS). Realtime delivery and heartbeats revalidate the session, so revoked or expired sessions stop receiving mail notifications. Sessions expire after eight hours; no refresh token is requested or retained. A Realmroot disable/revocation does not automatically revoke an already-created app session: automatic lifecycle/backchannel logout is follow-up work. Local logout deletes the app session; it does not sign the user out of Realmroot or other applications.

OIDC attempts are single-use, valid for ten minutes and bound to the initiating browser. Temporary attempts are deliberately excluded from backups. Historical credential/AI tables remain recognizable only for pre-migration exports and old full-backup parsing; removed table records are not restored into the new schema. Users restored from an old backup without OIDC bindings cannot sign in automatically or be matched by email.

## Local acceptance

Run `npm run db:bundle`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, and `npm run build`. `tests/realmroot-oidc.test.mjs` uses a real local HTTP OIDC provider with signed JWTs and real SQLite to exercise PKCE, state/nonce, signature/issuer/audience/expiry, identity mapping, session invalidation, mailbox ownership, schema initialization and backup compatibility. This is local protocol proof, not a claim of a live Realmroot production login. See [acceptance evidence](acceptance.md).

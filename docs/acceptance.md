# Simplification acceptance

## Implemented scope

- Realmroot OIDC confidential web sign-in with `openid-client`, PKCE S256, state, nonce and signed ID Token validation.
- Stable `(issuer, subject)` business-user mapping; no email-based linking or implicit mailbox allocation.
- Self-service personal mailboxes on configured active domains, strict owner/type input rejection and owner-only data access.
- Removed password/MFA/registration and in-app user-role administration, shared inboxes, AI assistant and MCP.
- Infrastructure access comes from operator subjects in deployment config; it grants no override for reading another user's mail.
- Fresh-install migration, old full-backup parsing and pre/post migration export coverage.
- Resource Server/OpenAPI work recorded in `docs/TODO.md` and not implemented.

## Passing local evidence

- `npx tsc --noEmit`.
- `node --test tests/*.test.mjs`: 69 passing tests, including signed OIDC positive/negative cases, identity mapping, self-service ownership, migration/backup boundaries and realtime session revocation.
- `npm run build`: complete Cloudflare Worker build.
- ESLint on the new OIDC/self-service/guard/middleware files: no errors. The broader affected-file check reports 14 existing lint errors; comparison against HEAD confirmed the same rules fail before this change (primarily existing synchronous setState effects).
- `git diff --check`.
- Local Node browser journey with a signed test provider: login → mailbox creation → `alice@tftt.cc` inbox.
- Local HTTP journey: unauthenticated 401, OIDC cookie session, owner parameter rejection, cross-origin write rejection even with a Bearer header, logout invalidation, removed MCP/registration 404.

## Realmroot registration

Application `tmail` was created and read back through the Agent's Realmroot identity. Client type is `confidential_web`; client authentication is `client_secret_basic`; consent remains enabled. Production callback is `https://mail.tftt.cc/api/auth/callback`, and the explicit local acceptance callback is `http://127.0.0.1:3007/api/auth/callback`. The one-time secret is saved only in ignored `.dev.vars` with mode 0600.

The live Realmroot discovery, authorization, hosted human sign-in, signed ID Token validation, UserInfo subject verification and local callback succeed. A real Realmroot identity has been mapped to a local business user. In the disposable local database that user created `oidc-check@tftt.cc`, entered its inbox, and signed out back to `/login`. The live identity-owned mailbox and application-session invalidation were verified. The provider's identity-only ID Token profile was exercised directly; profile claims are loaded from UserInfo rather than assumed present in the ID Token. No production deployment, production database reset or real mail delivery test has been performed.

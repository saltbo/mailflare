# API and integrations

This edition exposes personal browser APIs. Realmroot OIDC is used for browser sign-in; the native Realmroot Resource Server API and OpenAPI document are deferred in [TODO](TODO.md).

## Browser APIs

Browser requests use the HttpOnly application session cookie. Cookie-authenticated writes require a same-origin request. Every personal resource is checked against the current business user; operators have no override for another user's mail.

| Route | Purpose |
| --- | --- |
| `GET /api/auth/login` | Begin Realmroot OIDC sign-in |
| `GET /api/auth/callback` | Consume the browser-bound attempt and validate the signed OIDC response |
| `GET /api/auth/me` | Current profile and mailbox availability |
| `POST /api/auth/logout` | Revoke the local app session |
| `GET /api/mailboxes/domains` | Enabled domains available for personal mailbox creation |
| `GET /api/mailboxes` | List the current user's mailboxes |
| `POST /api/mailboxes` | Create the user's single personal mailbox with `{ domainId, localPart, displayName? }`; `ownerUserId` and `type` are rejected |
| `GET/PATCH/DELETE /api/mailboxes/{id}` | Read, update or delete an owned mailbox |
| `GET /api/messages?q=&mailboxId=` | List/search personal mail |
| `POST /api/drafts` | Create a personal draft |
| `POST /api/send` | Send from an owned mailbox |
| `GET/POST /api/calendar/events` | List/create personal calendar events |
| `PATCH/DELETE /api/calendar/events/{eventId}` | Update/delete an owned calendar event |

## Infrastructure and incoming mail

Deployment-configured operator subjects configure domains and providers through the infrastructure UI. Cloudflare, Resend and SES receiving retain their existing provider signature/secret verification; public booking remains separate from personal authenticated operations. See [providers](providers.md) and [Realmroot configuration](realmroot.md).

There is no API key/JMAP endpoint, license system, custom domain-routing interface, mail import/export, local registration, password reset, MFA, shared-mailbox delegation, AI assistant or MCP endpoint.

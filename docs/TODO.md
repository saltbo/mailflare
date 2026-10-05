# Follow-up work

## Realmroot native Resource Server

Deferred by the user; not part of the current sign-in and product simplification.

- Define the canonical public API and operation scope vocabulary after the deleted account/shared/AI/MCP operations are removed. Include self-service personal mailbox creation and explicit ownership checks.
- Publish a complete OpenAPI 3.x contract with requests, responses, errors, pagination and scope/security declarations.
- Choose an exact HTTPS resource URL and audience; advertise RFC 9728 metadata and an unauthenticated `service-desc` link.
- Validate Realmroot `at+jwt` access tokens, issuer, audience, expiry, scopes, client and controlling subject, preserving the distinct Agent actor and `sub_profile: ai_agent` in audit.
- Require per-request DPoP proof and key binding without Bearer fallback on the Agent API; prevent replay.
- Register through the Agent's Realmroot identity only after conformance checks pass, then prove one real read, one safe write and denied cross-user access.
- OIDC browser sign-in is separate from API resource-server token validation. API keys and JMAP are removed; design the future Agent API around Realmroot authority instead.

## Identity lifecycle

- Implement Realmroot backchannel logout/revocation handling if immediate application-session invalidation is required; current local sessions expire after eight hours.

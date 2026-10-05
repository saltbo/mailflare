-- This release targets a fresh installation. Refuse to silently erase existing accounts/mail.
CREATE TABLE _fresh_install_guard (existing_users INTEGER CHECK(existing_users = 0));
INSERT INTO _fresh_install_guard SELECT COUNT(*) FROM users;
DROP TABLE _fresh_install_guard;
DROP TABLE IF EXISTS mailbox_access;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS mfa_recovery_codes;
DROP TABLE IF EXISTS login_challenges;
DROP TABLE IF EXISTS mailbox_agent_settings;
DROP TABLE IF EXISTS agent_chat_messages;
DROP TABLE IF EXISTS agent_jobs;
DROP TABLE IF EXISTS agent_draft_metadata;
DROP TABLE IF EXISTS agent_send_approvals;
DROP TABLE IF EXISTS agent_conversations;
DROP TABLE IF EXISTS ai_usage;
DROP TABLE IF EXISTS mcp_key_mailboxes;
DROP TABLE users;
CREATE TABLE users (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 oidc_issuer TEXT,
 oidc_subject TEXT,
 forwarding_email TEXT,
 name TEXT NOT NULL,
 booking_username TEXT,
 time_zone TEXT,
 avatar_key TEXT,
 disabled INTEGER DEFAULT 0 NOT NULL,
 keyboard_shortcuts_enabled INTEGER DEFAULT 1 NOT NULL,
 spam_protection_enabled INTEGER DEFAULT 1 NOT NULL,
 show_full_recipient_addresses INTEGER DEFAULT 0 NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX users_booking_username_idx ON users(booking_username);
CREATE UNIQUE INDEX users_oidc_identity_idx ON users(oidc_issuer, oidc_subject);
CREATE TABLE api_key_mailboxes (
 key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
 mailbox_id TEXT NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX api_key_mailboxes_key_mailbox_idx ON api_key_mailboxes(key_id,mailbox_id);
CREATE TABLE oidc_attempts (
 token_hash TEXT PRIMARY KEY NOT NULL,
 state TEXT NOT NULL,
 nonce TEXT NOT NULL,
 verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
ALTER TABLE app_settings DROP COLUMN agent_enabled;
ALTER TABLE app_settings DROP COLUMN agent_provider;
ALTER TABLE app_settings DROP COLUMN agent_preset;
ALTER TABLE app_settings DROP COLUMN agent_base_url;
ALTER TABLE app_settings DROP COLUMN agent_api_key;
ALTER TABLE app_settings DROP COLUMN agent_model;
ALTER TABLE app_settings DROP COLUMN agent_model_rates;

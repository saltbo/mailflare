DROP TABLE IF EXISTS api_key_mailboxes;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS license_settings;
DELETE FROM routing_rules WHERE scope = 'domain';

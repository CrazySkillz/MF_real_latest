-- Additive only: never change existing connection credentials, grants or analytics.
BEGIN;
CREATE TABLE IF NOT EXISTS ga4_client_service_accounts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  email TEXT NOT NULL,
  google_unique_id TEXT,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ga4_client_service_accounts_scope_idx
  ON ga4_client_service_accounts(owner_id, client_id, property_id);
CREATE UNIQUE INDEX IF NOT EXISTS ga4_client_service_accounts_email_idx
  ON ga4_client_service_accounts(email);
ALTER TABLE ga4_connections ADD COLUMN IF NOT EXISTS service_account_binding_id VARCHAR;
COMMIT;

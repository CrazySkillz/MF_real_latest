-- Empty by default. Only independently reviewed operator grants may be inserted.
-- Never automatically approve existing connections or customer-supplied resources.
BEGIN;
CREATE TABLE IF NOT EXISTS service_account_resource_grants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS service_account_resource_grants_scope_idx
  ON service_account_resource_grants(owner_id, client_id, provider, resource_id);
COMMIT;

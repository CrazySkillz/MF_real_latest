-- V1-002: existing unowned/demo rows stay unowned. Never infer a customer owner.
BEGIN;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE performance_data ADD COLUMN IF NOT EXISTS owner_id TEXT;
CREATE INDEX IF NOT EXISTS metrics_owner_id_idx ON metrics(owner_id);
CREATE INDEX IF NOT EXISTS integrations_owner_id_idx ON integrations(owner_id);
CREATE INDEX IF NOT EXISTS performance_data_owner_id_idx ON performance_data(owner_id);
ALTER TABLE attribution_models ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE customer_journeys ADD COLUMN IF NOT EXISTS owner_id TEXT;
CREATE INDEX IF NOT EXISTS attribution_models_owner_id_idx ON attribution_models(owner_id);
CREATE INDEX IF NOT EXISTS customer_journeys_owner_id_idx ON customer_journeys(owner_id);
-- Durable replay receipts deliberately survive report/metric deletion.
CREATE TABLE IF NOT EXISTS inbound_webhook_receipts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  metrics_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;

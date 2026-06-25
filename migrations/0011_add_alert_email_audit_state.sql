-- Add durable alert email audit lifecycle state and a nullable dedupe contract.
-- Existing audit inserts remain valid because the new fields are nullable or defaulted.

ALTER TABLE email_alert_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provider_response_id TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS email_alert_events_dedupe_key_unique
  ON email_alert_events (dedupe_key);

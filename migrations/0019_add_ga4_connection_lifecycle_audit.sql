CREATE TABLE IF NOT EXISTS ga4_connection_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  property_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('connected', 'reactivated', 'disconnected')),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ga4_connection_lifecycle_events_connection_changed_idx
ON ga4_connection_lifecycle_events (connection_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS ga4_connection_lifecycle_events_campaign_changed_idx
ON ga4_connection_lifecycle_events (campaign_id, changed_at DESC);

CREATE OR REPLACE FUNCTION enforce_and_audit_ga4_connection_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  lifecycle_actor TEXT := COALESCE(NULLIF(current_setting('app.ga4_connection_actor', true), ''), current_user);
  lifecycle_reason TEXT := NULLIF(current_setting('app.ga4_connection_reason', true), '');
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    RAISE EXCEPTION 'GA4_CONNECTION_DEACTIVATION_BLOCKED: use the campaign-scoped disconnect path';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO ga4_connection_lifecycle_events
      (connection_id, campaign_id, property_id, action, actor, reason)
    VALUES
      (NEW.id, NEW.campaign_id, NEW.property_id, 'connected', lifecycle_actor,
       COALESCE(lifecycle_reason, 'ga4_connection_created'));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO ga4_connection_lifecycle_events
      (connection_id, campaign_id, property_id, action, actor, reason)
    VALUES
      (OLD.id, OLD.campaign_id, OLD.property_id, 'disconnected', lifecycle_actor,
       COALESCE(lifecycle_reason, 'ga4_connection_deleted'));
    RETURN OLD;
  END IF;

  IF OLD.is_active = false AND NEW.is_active = true THEN
    INSERT INTO ga4_connection_lifecycle_events
      (connection_id, campaign_id, property_id, action, actor, reason)
    VALUES
      (NEW.id, NEW.campaign_id, NEW.property_id, 'reactivated', lifecycle_actor,
       COALESCE(lifecycle_reason, 'ga4_connection_reactivated'));
  END IF;

  RETURN NEW;
END;
$$;

DO $trigger$
BEGIN
  CREATE TRIGGER ga4_connection_lifecycle_guard
  BEFORE INSERT OR UPDATE OR DELETE ON ga4_connections
  FOR EACH ROW EXECUTE FUNCTION enforce_and_audit_ga4_connection_lifecycle();
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$trigger$;

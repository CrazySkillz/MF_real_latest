-- Standalone Shopify refresh failures do not belong in Notifications.
-- Delete only rows with the exact Shopify refresh-failure metadata kind.
DELETE FROM notifications
WHERE metadata IS NOT NULL
  AND metadata::text ~ '"kind"[[:space:]]*:[[:space:]]*"shopify_revenue_refresh_failure"';

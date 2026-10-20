// Read-only, one-campaign audit. Never imports application startup/storage or provider code.
const fs = require('node:fs'), { parseEnv } = require('node:util'), { createHash } = require('node:crypto'), { Client, types } = require('pg');
// Preserve timestamp-without-time-zone strings; local Windows timezone must not shift stored clock values.
types.setTypeParser(1114, value => value);
const out = 'docs/audits/v1-2026-10-19/ptomo-readonly-database.json';
const config = parseEnv(fs.readFileSync('.env', 'utf8'));
const result = { observedAt: new Date().toISOString(), boundary: 'Repository-configured database only; its binding to the current deployment is unverified. Parameterized SELECT for exact Ptomo name in a READ ONLY transaction. No application/provider methods, token migration, refresh, email or customer mutation.', checks: [] };
let client;
(async () => {
  if (!config.DATABASE_URL) throw Object.assign(Error('No configured database URL'), { code: 'NO_DATABASE_URL' });
  const url = new URL(config.DATABASE_URL);
  // Keep certificate verification enabled; URL settings must not weaken this audit connection.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  client = new Client({ connectionString: url.toString(), ssl: local ? undefined : { rejectUnauthorized: true }, application_name: 'mf-v1-ptomo-readonly-audit', connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 8000, idle_in_transaction_session_timeout: 10000 });
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const mode = await client.query('SHOW transaction_read_only');
  if (mode.rows[0]?.transaction_read_only !== 'on') throw Object.assign(Error('Read-only transaction not established'), { code: 'READ_ONLY_NOT_ESTABLISHED' });
  result.readOnlyEnforced = true;
  result.timestampWithoutTimeZonePolicy = 'Raw database strings; no assumed UTC or property timezone. timestamptz fields retain explicit UTC instants.';
  const databaseClock = await client.query("SELECT current_timestamp AS observed_at, current_setting('TimeZone') AS session_time_zone, current_setting('server_version') AS server_version");
  result.databaseClock = databaseClock.rows[0];
  const campaignRows = await client.query(`SELECT c.id, c.name, c.currency, c.reporting_time_zone, c.platform, c.status,
    c.owner_id IS NOT NULL AND btrim(c.owner_id) <> '' AS owner_present,
    c.client_id IS NOT NULL AS client_assigned,
    cl.id IS NOT NULL AS client_exists,
    COALESCE(cl.owner_id = c.owner_id, false) AS client_owner_matches,
    c.ga4_campaign_filter IS NOT NULL AND btrim(c.ga4_campaign_filter) <> '' AS ga4_filter_present
    FROM campaigns c LEFT JOIN clients cl ON cl.id = c.client_id
    WHERE lower(btrim(c.name)) = lower($1) ORDER BY c.id LIMIT 3`, ['Ptomo']);
  result.matchCount = campaignRows.rowCount;
  result.matchCountCappedAt = 3;
  result.campaigns = campaignRows.rows.map(({ id, ...row }) => ({ ...row, campaignIdSha256: createHash('sha256').update(id).digest('hex') }));
  if (campaignRows.rowCount !== 1) { result.status = 'AMBIGUOUS_OR_MISSING_PTOMO'; return; }
  const campaign = campaignRows.rows[0];
  if (!campaign.owner_present || !campaign.client_exists || !campaign.client_owner_matches) { result.status = 'PTOMO_PARENT_OWNERSHIP_REQUIRES_REVIEW'; return; }
  const connections = await client.query(`SELECT method, is_primary, is_active, lookback_days, import_start_date,
    property_id IS NOT NULL AND btrim(property_id) <> '' AS property_selected,
    encrypted_tokens IS NOT NULL AS encrypted_credentials_present,
    access_token IS NOT NULL AND btrim(access_token) <> '' AS legacy_access_token_present,
    refresh_token IS NOT NULL AND btrim(refresh_token) <> '' AS legacy_refresh_token_present,
    service_account_key IS NOT NULL AND btrim(service_account_key) <> '' AS legacy_service_account_key_present,
    expires_at, connected_at FROM ga4_connections WHERE campaign_id = $1 ORDER BY created_at, id`, [campaign.id]);
  result.checks.push({ check: 'ga4-connection-metadata-only', count: connections.rowCount, rows: connections.rows });
  const sources = await client.query(`SELECT 'revenue' AS direction, source_type, platform_context, is_active, count(*)::int AS count
    FROM revenue_sources WHERE campaign_id = $1 GROUP BY source_type, platform_context, is_active
    UNION ALL SELECT 'spend' AS direction, source_type, platform_context, is_active, count(*)::int AS count
    FROM spend_sources WHERE campaign_id = $1 GROUP BY source_type, platform_context, is_active
    ORDER BY direction, platform_context, source_type, is_active`, [campaign.id]);
  result.checks.push({ check: 'financial-source-family-counts', rows: sources.rows });
  const coverage = await client.query(`SELECT count(*)::int AS rows, min(date) AS first_date, max(date) AS last_date,
    count(DISTINCT date)::int AS distinct_dates, count(DISTINCT property_id)::int AS property_count,
    count(*) FILTER (WHERE is_simulated)::int AS simulated_rows, max(updated_at) AS latest_updated_at,
    count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM ga4_connections g WHERE g.campaign_id = d.campaign_id AND g.property_id = d.property_id AND g.is_active))::int AS rows_without_active_property
    FROM ga4_daily_metrics d WHERE campaign_id = $1`, [campaign.id]);
  result.checks.push({ check: 'native-daily-coverage-metadata', rows: coverage.rows });
  const overview = await client.query(`SELECT window_start, window_end, updated_at,
    EXISTS (SELECT 1 FROM ga4_connections g WHERE g.campaign_id = o.campaign_id AND g.property_id = o.property_id AND g.is_active) AS matches_active_property,
    jsonb_typeof(campaign_breakdown) AS campaign_payload_type, jsonb_typeof(landing_pages) AS landing_payload_type,
    jsonb_typeof(conversion_events) AS events_payload_type
    FROM ga4_overview_snapshots o WHERE campaign_id = $1 ORDER BY updated_at DESC LIMIT 5`, [campaign.id]);
  result.checks.push({ check: 'overview-snapshot-window-metadata', rows: overview.rows });
  const reconciliation = await client.query(`SELECT o.window_start, o.window_end,
    (o.campaign_breakdown->'meta'->>'currencyCode') = c.currency AS currency_matches_campaign,
    count(d.id)::int AS daily_rows_in_snapshot_window,
    count(DISTINCT d.date)::int AS distinct_daily_dates,
    (o.window_end::date - o.window_start::date + 1)::int AS expected_calendar_dates,
    COALESCE((o.campaign_breakdown->'totals'->>'sessions')::numeric = sum(d.sessions), false) AS sessions_reconcile,
    COALESCE((o.campaign_breakdown->'totals'->>'conversions')::numeric = sum(d.conversions), false) AS conversions_reconcile,
    COALESCE(abs((o.campaign_breakdown->'totals'->>'revenue')::numeric - sum(d.revenue)) <= count(d.id) * 0.005 + 0.000000001, false) AS revenue_reconciles_with_daily_cent_tolerance,
    COALESCE((o.conversion_events->'totals'->>'conversions')::numeric = sum(d.conversions), false) AS event_conversions_reconcile
    FROM ga4_overview_snapshots o JOIN campaigns c ON c.id = o.campaign_id
    LEFT JOIN ga4_daily_metrics d ON d.campaign_id = o.campaign_id AND d.property_id = o.property_id AND d.date >= o.window_start AND d.date <= o.window_end
    WHERE o.campaign_id = $1 GROUP BY o.id, c.currency ORDER BY o.updated_at DESC LIMIT 5`, [campaign.id]);
  result.checks.push({ check: 'persisted-native-detail-to-daily-reconciliation', rows: reconciliation.rows,
    boundary: 'Independent read-only SQL comparison follows current scheduler reconciliation identities/tolerance. Matching persisted outputs do not independently verify provider truth, attribution or every consumer.' });
  const work = await client.query(`SELECT status, due_at, reporting_date, started_at, completed_at, attempt_count, next_attempt_at, suppress_alerts, retryable,
    lease_expires_at, last_error IS NOT NULL AS error_present, scope_hash LIKE 'invalidated:%' AS invalidated,
    scope->>'kind' = 'initial_import' AS initial_import
    FROM ga4_refresh_work WHERE campaign_id = $1 ORDER BY due_at DESC, updated_at DESC LIMIT 5`, [campaign.id]);
  result.checks.push({ check: 'latest-five-native-work-statuses', rows: work.rows });
  const snapshots = await client.query(`SELECT snapshot_type, count(*)::int AS rows, min(reporting_date) AS first_reporting_date,
    max(reporting_date) AS last_reporting_date, max(recorded_at) AS latest_recorded_at,
    count(*) FILTER (WHERE notes LIKE 'ga4_aligned_refresh_v1:%')::int AS alignment_markers,
    count(*) FILTER (WHERE notes LIKE 'ga4_refresh_publication_v1:%')::int AS publication_receipts
    FROM metric_snapshots WHERE campaign_id = $1 GROUP BY snapshot_type ORDER BY snapshot_type`, [campaign.id]);
  result.checks.push({ check: 'snapshot-type-coverage-metadata', rows: snapshots.rows });
  // Fixed reviewed table names only; values remain parameterized and every query is campaign-scoped.
  const otherTables = ['linkedin_connections', 'meta_connections', 'instagram_connections', 'tiktok_connections', 'google_ads_connections', 'ga4_google_ads_spend_connections', 'google_sheets_connections', 'hubspot_connections', 'salesforce_connections', 'shopify_connections', 'custom_integrations'];
  const otherCounts = await client.query(otherTables.map(table => `SELECT '${table}' AS source_table, count(*)::int AS count FROM ${table} WHERE campaign_id = $1`).join(' UNION ALL '), [campaign.id]);
  result.checks.push({ check: 'other-connection-counts-for-ptomo-only', rows: otherCounts.rows });
  const indexes = await client.query(`SELECT t.relname AS table_name, i.relname AS index_name, ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid, pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index ix ON ix.indrelid = t.oid JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE n.nspname = current_schema() AND t.relname = ANY($1::text[])
    ORDER BY t.relname, i.relname`, [['ga4_daily_metrics', 'ga4_overview_snapshots', 'ga4_refresh_work', 'metric_snapshots', 'linkedin_daily_metrics', 'google_ads_daily_metrics', 'meta_daily_metrics']]);
  result.checks.push({ check: 'selected-schema-index-metadata-only', rows: indexes.rows,
    boundary: 'Catalog metadata only, no other campaign data; does not validate full schema/migration history, constraints against dirty upgrades, backups or deployment binding.' });
  const goals = await client.query(`SELECT 'kpi' AS kind, platform_type, metric, count(*)::int AS count,
    count(*) FILTER (WHERE alerts_enabled)::int AS alerts_enabled, count(*) FILTER (WHERE email_notifications)::int AS email_enabled
    FROM kpis WHERE campaign_id = $1 GROUP BY platform_type, metric
    UNION ALL SELECT 'benchmark' AS kind, platform_type, metric, count(*)::int AS count,
    count(*) FILTER (WHERE alerts_enabled)::int AS alerts_enabled, count(*) FILTER (WHERE email_notifications)::int AS email_enabled
    FROM benchmarks WHERE campaign_id = $1 GROUP BY platform_type, metric ORDER BY kind, platform_type, metric`, [campaign.id]);
  result.checks.push({ check: 'goal-metric-and-alert-setting-counts', rows: goals.rows });
  const sessionGoals = await client.query(`SELECT k.apply_to, k.specific_campaign_id IS NOT NULL AS specific_scope_present,
    o.window_start, o.window_end,
    k.current_value = (SELECT sum(d.sessions) FROM ga4_daily_metrics d WHERE d.campaign_id = k.campaign_id
      AND d.property_id = o.property_id AND d.date >= o.window_start AND d.date <= o.window_end) AS current_matches_saved_window_sessions,
    p.recorded_at AS latest_progress_at, p.value = k.current_value AS latest_progress_matches_current
    FROM kpis k JOIN ga4_overview_snapshots o ON o.campaign_id = k.campaign_id
    JOIN ga4_connections g ON g.campaign_id = o.campaign_id AND g.property_id = o.property_id AND g.is_active AND g.is_primary
    LEFT JOIN LATERAL (SELECT value, recorded_at FROM kpi_progress WHERE kpi_id = k.id ORDER BY recorded_at DESC, id DESC LIMIT 1) p ON true
    WHERE k.campaign_id = $1 AND k.platform_type IN ('google_analytics','ga4')
    AND regexp_replace(lower(COALESCE(k.metric,'')), '[^a-z0-9]', '', 'g') IN ('sessions','totalsessions')
    ORDER BY k.id LIMIT 10`, [campaign.id]);
  result.checks.push({ check: 'existing-native-sessions-kpi-persisted-comparison', rows: sessionGoals.rows,
    boundary: 'Native sessions alias and saved Overview window only. Specific-source configuration, all alert conditions, real UI/API output and provider truth not inferred from equality.' });
  const reports = await client.query(`SELECT platform_type, report_type, status, schedule_enabled, count(*)::int AS count,
    max(last_sent_at) AS latest_last_sent_at, min(next_scheduled_at) AS earliest_next_scheduled_at
    FROM linkedin_reports WHERE campaign_id = $1 GROUP BY platform_type, report_type, status, schedule_enabled
    ORDER BY platform_type, report_type, status, schedule_enabled`, [campaign.id]);
  result.checks.push({ check: 'generic-report-library-and-schedule-counts', rows: reports.rows });
  const reportSnapshots = await client.query(`SELECT platform_type, report_type, count(*)::int AS count, max(generated_at) AS latest_generated_at
    FROM report_snapshots WHERE campaign_id = $1 GROUP BY platform_type, report_type ORDER BY platform_type, report_type`, [campaign.id]);
  result.checks.push({ check: 'report-snapshot-presence-counts', rows: reportSnapshots.rows });
  const sends = await client.query(`SELECT e.status, count(*)::int AS count, max(e.sent_at) AS latest_sent_at,
    count(*) FILTER (WHERE e.snapshot_id IS NOT NULL)::int AS with_snapshot_reference
    FROM report_send_events e JOIN linkedin_reports r ON r.id = e.report_id WHERE r.campaign_id = $1
    GROUP BY e.status ORDER BY e.status`, [campaign.id]);
  result.checks.push({ check: 'report-send-bookkeeping-counts', rows: sends.rows, boundary: 'Stored bookkeeping only; no provider acceptance or inbox receipt inferred.' });
  const email = await client.query(`SELECT kind, delivery_status, success, count(*)::int AS count,
    max(delivered_at) AS latest_delivered_at, max(failed_at) AS latest_failed_at
    FROM email_alert_events WHERE campaign_id = $1 GROUP BY kind, delivery_status, success ORDER BY kind, delivery_status, success`, [campaign.id]);
  result.checks.push({ check: 'email-audit-status-counts', rows: email.rows, boundary: 'No addresses, subjects, messages or provider response IDs selected; database audit status is not independent inbox evidence.' });
  const notifications = await client.query(`SELECT type, read, count(*)::int AS count FROM notifications WHERE campaign_id = $1 GROUP BY type, read ORDER BY type, read`, [campaign.id]);
  result.checks.push({ check: 'notification-presence-counts', rows: notifications.rows, boundary: 'No messages/metadata selected. Counts do not establish active, dismissed, resolved or correctly scoped UI episodes.' });
  result.status = 'READ_ONLY_METADATA_OBSERVED';
})().catch(error => { result.status = 'BLOCKED'; result.error = { code: String(error?.code || error?.name || 'ERROR'), message: 'Read-only database observation failed; credentials, host and raw error omitted.' }; process.exitCode = 1; }).finally(async () => {
  if (client) { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); }
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, readOnlyEnforced: result.readOnlyEnforced || false, matchCount: result.matchCount, checks: result.checks.length, error: result.error }));
});

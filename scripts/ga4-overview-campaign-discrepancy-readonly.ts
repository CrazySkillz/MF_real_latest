import { createHash } from 'node:crypto';
import { ga4Service } from '../server/analytics';
import { pool } from '../server/db';
import { storage } from '../server/storage';
import { resolveGA4ImportToDateWindow } from '../server/utils/reporting-timezone';

const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_CAMPAIGN_ID || '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458').trim();
const PROPERTY_ID = String(process.env.GA4_OVERVIEW_PROPERTY_ID || '542352127').trim();
const FIXED_END_DATE = String(process.env.GA4_OVERVIEW_DIAGNOSTIC_END_DATE || '').trim();
const DATABASE_ONLY = String(process.env.GA4_OVERVIEW_DATABASE_ONLY || '').trim() === '1';

if (!pool) throw new Error('DATABASE_URL is required');

const hash = (value: unknown) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
const parseCampaignFilter = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return [] as string[];
  if (text.startsWith('[') && text.endsWith(']')) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return [text];
};
const totals = (rows: any[]) => rows.reduce((out, row) => ({
  sessions: out.sessions + Number(row?.sessions || 0),
  users: out.users + Number(row?.users || 0),
  conversions: out.conversions + Number(row?.conversions || 0),
  revenue: Number((out.revenue + Number(row?.revenue || 0)).toFixed(2)),
}), { sessions: 0, users: 0, conversions: 0, revenue: 0 });

const client = await pool.connect();
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  const inventory = await client.query(`
    SELECT c.currency, c.reporting_time_zone, c.ga4_campaign_filter, g.import_start_date
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.property_id = $2 AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  if (inventory.rowCount !== 1) throw new Error('Campaign/property scope is unavailable');
  const record = inventory.rows[0];
  const window = resolveGA4ImportToDateWindow(record.import_start_date, record.reporting_time_zone);
  if (!window) throw new Error('Initial-import window is unavailable');
  const endDate = FIXED_END_DATE || window.endDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate > window.endDate) {
    throw new Error('Diagnostic end date must be a completed reporting day');
  }
  const selectedCampaigns = parseCampaignFilter(record.ga4_campaign_filter);
  if (selectedCampaigns.length === 0) throw new Error('Saved campaign scope is empty');

  const persistedResult = await client.query(`
    SELECT date, sessions, users, conversions, revenue, updated_at
    FROM ga4_daily_metrics
    WHERE campaign_id = $1 AND property_id = $2 AND date BETWEEN $3 AND $4
    ORDER BY date
  `, [CAMPAIGN_ID, PROPERTY_ID, window.startDate, endDate]);
  const persistedRows = persistedResult.rows.map((row) => ({
    date: String(row.date),
    sessions: Number(row.sessions || 0),
    users: Number(row.users || 0),
    conversions: Number(row.conversions || 0),
    revenue: Number(row.revenue || 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }));

  providerDiagnostic: {
  const persistedSummary = {
    rowCount: persistedRows.length,
    totals: totals(persistedRows),
    earliestUpdatedAt: persistedRows.map((row) => row.updatedAt).filter(Boolean).sort()[0] || null,
    latestUpdatedAt: persistedRows.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) || null,
  };
  if (DATABASE_ONLY) {
    console.log(JSON.stringify({
      status: 'passed',
      mode: 'database-read-only',
      campaignHash: hash(CAMPAIGN_ID),
      propertyId: PROPERTY_ID,
      selectedCampaigns,
      window: { startDate: window.startDate, endDate },
      persisted: persistedSummary,
      databaseTransaction: 'read only and rolled back',
    }, null, 2));
    break providerDiagnostic;
  }

  const connection = await storage.getGA4Connection(CAMPAIGN_ID, PROPERTY_ID);
  if (!connection?.accessToken) throw new Error('Read-only provider token is unavailable in the local environment');
  const providerRows = await ga4Service.getTimeSeriesWithToken(
    PROPERTY_ID,
    String(connection.accessToken),
    window.startDate,
    selectedCampaigns,
    endDate,
    String(record.currency || '').trim().toUpperCase(),
  );

  const persistedByDate = new Map(persistedRows.map((row) => [row.date, row]));
  const providerByDate = new Map(providerRows.map((row) => [String(row.date), row]));
  const dates = [...new Set([...persistedByDate.keys(), ...providerByDate.keys()])].sort();
  const changedDates = dates.flatMap((date) => {
    const persisted = persistedByDate.get(date);
    const provider = providerByDate.get(date);
    const difference = {
      sessions: Number(provider?.sessions || 0) - Number(persisted?.sessions || 0),
      users: Number(provider?.users || 0) - Number(persisted?.users || 0),
      conversions: Number(provider?.conversions || 0) - Number(persisted?.conversions || 0),
      revenue: Number((Number(provider?.revenue || 0) - Number(persisted?.revenue || 0)).toFixed(2)),
    };
    return Object.values(difference).some((value) => value !== 0) ? [{ date, difference }] : [];
  });
  console.log(JSON.stringify({
    status: 'passed',
    mode: 'provider-and-database-read-only',
    campaignHash: hash(CAMPAIGN_ID),
    propertyId: PROPERTY_ID,
    selectedCampaigns,
    window: { startDate: window.startDate, endDate },
    persisted: persistedSummary,
    currentProviderTimeSeries: { rowCount: providerRows.length, totals: totals(providerRows) },
    providerMinusPersisted: {
      sessions: totals(providerRows).sessions - totals(persistedRows).sessions,
      users: totals(providerRows).users - totals(persistedRows).users,
      conversions: totals(providerRows).conversions - totals(persistedRows).conversions,
      revenue: Number((totals(providerRows).revenue - totals(persistedRows).revenue).toFixed(2)),
    },
    changedDates,
    databaseTransaction: 'read only and rolled back',
  }, null, 2));
  }
} finally {
  await client.query('ROLLBACK').catch(() => null);
  client.release();
  await pool.end().catch(() => null);
}

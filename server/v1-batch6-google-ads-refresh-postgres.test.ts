import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL, sql, and, eq, gte, lte } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import * as schema from '../shared/schema';

const database = vi.hoisted(() => ({ current: null as any }));
const provider = vi.hoisted(() => ({ daily: vi.fn(), account: vi.fn(), renew: vi.fn(), jobs: vi.fn() }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
vi.mock('./googleAdsClient', async importOriginal => ({
  ...(await importOriginal<typeof import('./googleAdsClient')>()),
  GoogleAdsClient: class { static refreshAccessToken = provider.renew; getDailyMetrics = provider.daily; getCustomerAccount = provider.account; },
}));
vi.mock('./ga4-kpi-benchmark-jobs', () => ({ runGA4DailyKPIAndBenchmarkJobs: provider.jobs }));
import { DatabaseStorage, storage as runtimeStorage } from './storage';
import { refreshGoogleAdsForCampaign } from './google-ads-scheduler';

const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated local database required');
}
const schemaName = `v1_ads_refresh_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections,
  schema.googleAdsDailyMetrics, schema.ga4GoogleAdsSpendDailyMetrics, schema.spendSources, schema.spendRecords, schema.metricSnapshots];
const storage = new DatabaseStorage();
const day = '2026-10-24';
const fact = { campaignId: 'a', googleCampaignId: 'selected', date: day, spend: '25', impressions: 100, clicks: 10 };
let admin: Pool, pool: Pool, created = false;
const connectionTable = (dedicated: boolean) => dedicated ? schema.ga4GoogleAdsSpendConnections : schema.googleAdsConnections;
const dailyTable = (dedicated: boolean) => dedicated ? schema.ga4GoogleAdsSpendDailyMetrics : schema.googleAdsDailyMetrics;
async function capture(dedicated = false, extra: any = {}) {
  const connection = dedicated ? await storage.getGA4GoogleAdsSpendConnection('a') : await storage.getGoogleAdsConnection('a');
  const source = connection?.spendOnly ? (await storage.getSpendSources('a', 'ga4'))[0] || null : undefined;
  return { googleAdsRefresh: { campaign: await storage.getCampaign('a'), connection, dedicatedSpend: dedicated, source, ...extra } } as any;
}
function replace(dedicated: boolean, options: any) {
  return dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow('a', day, day, [fact], options)
    : storage.replaceGoogleAdsDailyMetricsForWindow('a', day, day, [fact], options);
}
function update(dedicated: boolean, patch: any, options: any) {
  return dedicated ? storage.updateGA4GoogleAdsSpendConnection('a', patch, options) : storage.updateGoogleAdsConnection('a', patch, options);
}

describe.skipIf(!testUrl)('Google Ads ordinary refresh transaction ownership', () => {
  beforeAll(async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'local-test-key-never-a-production-secret');
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const v = column.default;
        const defaultSql = v instanceof SQL ? dialect.sqlToQuery(v).sql : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${v !== undefined ? ` DEFAULT ${defaultSql}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ['a', 'b']) {
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: new Date('2026-01-01'), spend: '10' });
      for (const dedicated of [false, true]) {
        await database.current.insert(connectionTable(dedicated)).values({ id: `${dedicated ? 'spend' : 'main'}-${id}`, campaignId: id,
          customerId: '123', customerName: 'Account', method: 'oauth', spendOnly: dedicated, accessToken: 'fixture-access', refreshToken: 'fixture-refresh', clientSecret: 'fixture-secret', clientId: 'fixture-client', lastRefreshAt: new Date('2026-10-24T12:00:00Z'),
          ...(!dedicated ? { selectedCampaignIds: '["selected"]' } : {}) });
        await database.current.insert(dailyTable(dedicated)).values({ ...fact, id: `${dedicated ? 'spend' : 'main'}-fact-${id}`, campaignId: id, spend: '10' });
      }
      await database.current.insert(schema.spendSources).values({ id: `source-${id}`, campaignId: id, sourceType: 'ad_platforms', platformContext: 'ga4', currency: 'EUR', isActive: true, displayName: 'Google Ads', mappingConfig: '{"platform":"google_ads","selectedCampaignIds":["selected"]}', createdAt: new Date('2026-10-01') });
      await database.current.insert(schema.spendRecords).values({ campaignId: id, spendSourceId: `source-${id}`, sourceType: 'ad_platforms', date: day, spend: '10', currency: 'EUR' });
    }
    provider.account.mockResolvedValue({ currencyCode: 'EUR', timeZone: 'Europe/Amsterdam', manager: false });
    provider.renew.mockResolvedValue({ access_token: 'fixture-renewed', expires_in: 3600 });
    provider.daily.mockResolvedValue([{ campaignId: 'selected', campaignName: 'Selected', date: day, impressions: 100, clicks: 10, costMicros: 25_000_000, conversions: 1, conversionsValue: 50, searchImpressionShare: 0.5, ctr: 0.1, averageCpc: 2_500_000, averageCpm: 250_000_000, interactionRate: 0.1, videoViews: 0 }]);
    provider.jobs.mockResolvedValue({ campaignsProcessed: 1, campaignIdsSkipped: [], campaignIdsFailed: [], kpiIdsSkipped: [], kpiIdsFailed: [], benchmarkIdsSkipped: [], benchmarkIdsFailed: [], alertReconciliationFailures: [] });
  });

  for (const dedicated of [false, true]) describe(dedicated ? 'dedicated Spend' : 'main platform', () => {
    it.each(['owner', 'client', 'paused', 'currency', 'timezone', 'startDate', 'missingParent', 'disconnect', 'reconnect', 'customer', 'credentials', 'lastRefresh'])('refuses stale %s inputs and preserves prior facts', async change => {
      const scope = await capture(dedicated);
      const table = getTableName(connectionTable(dedicated));
      if (change === 'owner') await pool.query("UPDATE campaigns SET owner_id = 'different' WHERE id = 'a'");
      if (change === 'client') await pool.query("UPDATE campaigns SET client_id = 'different' WHERE id = 'a'");
      if (change === 'paused') await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = 'a'");
      if (change === 'currency') await pool.query("UPDATE campaigns SET currency = 'USD' WHERE id = 'a'");
      if (change === 'timezone') await pool.query("UPDATE campaigns SET reporting_time_zone = 'UTC' WHERE id = 'a'");
      if (change === 'startDate') await pool.query("UPDATE campaigns SET start_date = '2026-10-01' WHERE id = 'a'");
      if (change === 'missingParent') await pool.query("DELETE FROM campaigns WHERE id = 'a'");
      if (change === 'disconnect') await pool.query(`DELETE FROM "${table}" WHERE campaign_id = 'a'`);
      if (change === 'reconnect') await pool.query(`UPDATE "${table}" SET id = 'new-connection' WHERE campaign_id = 'a'`);
      if (change === 'customer') await pool.query(`UPDATE "${table}" SET customer_id = '456' WHERE campaign_id = 'a'`);
      if (change === 'credentials') await pool.query(`UPDATE "${table}" SET encrypted_tokens = NULL, access_token = 'different' WHERE campaign_id = 'a'`);
      if (change === 'lastRefresh') await pool.query(`UPDATE "${table}" SET last_refresh_at = '2026-10-25' WHERE campaign_id = 'a'`);
      await expect(replace(dedicated, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(!dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
    });
    it('allows unchanged inputs, renewal and metadata updates without touching the other connection or campaign', async () => {
      const scope = await capture(dedicated);
      const renewed = await update(dedicated, { accessToken: 'new-token' }, scope);
      expect(renewed).toMatchObject({ accessToken: 'new-token', refreshToken: 'fixture-refresh', clientSecret: 'fixture-secret' });
      scope.googleAdsRefresh.connection = renewed;
      await expect(replace(dedicated, scope)).resolves.toEqual({ replaced: 1 });
      const saved = await update(dedicated, { lastRefreshAt: new Date('2026-10-25T12:00:00Z') }, scope);
      expect(saved?.lastRefreshAt).toEqual(new Date('2026-10-25T12:00:00Z'));
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" ORDER BY campaign_id`)).rows).toEqual([{ spend: '25.00' }, { spend: '10.00' }]);
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(!dedicated))}" ORDER BY campaign_id`)).rows).toEqual([{ spend: '10.00' }, { spend: '10.00' }]);
    });
    it.each(['token', 'timestamp', 'cache'])('blocks stale %s writes after reconnect', async kind => {
      const scope = await capture(dedicated);
      await pool.query(`UPDATE "${getTableName(connectionTable(dedicated))}" SET id = 'new-connection' WHERE campaign_id = 'a'`);
      const write = kind === 'cache' ? storage.updateCampaign('a', { spend: '999' }, scope)
        : update(dedicated, kind === 'token' ? { accessToken: 'old-job-token' } : { lastRefreshAt: new Date() }, scope);
      await expect(write).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      expect((await storage.getCampaign('a'))?.spend).toBe('10.00');
    });
    it('serializes with a concurrent connection edit and rejects the old response after the edit commits', async () => {
      const scope = await capture(dedicated);
      const editor = await pool.connect();
      let saving: Promise<unknown> | undefined;
      try {
        await editor.query('BEGIN');
        await editor.query("SELECT id FROM campaigns WHERE id = 'a' FOR UPDATE");
        await editor.query(`UPDATE "${getTableName(connectionTable(dedicated))}" SET customer_id = '456' WHERE campaign_id = 'a'`);
        // The replacement must wait for the editor's parent lock before checking inputs.
        saving = replace(dedicated, scope).then(value => ({ value }), error => ({ error }));
        let waiting = false;
        for (let i = 0; i < 50 && !waiting; i++) {
          waiting = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [schemaName])).rowCount! > 0;
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await editor.query('COMMIT');
        const result: any = await saving;
        expect(result.error?.message).toBe('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      } finally { await editor.query('ROLLBACK'); editor.release(); await saving; }
    });
    it('does not let the main and dedicated write guards substitute for each other', async () => {
      const scope = await capture(!dedicated);
      await expect(replace(dedicated, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    });
    it('rolls back deletion if replacement rows fail to insert', async () => {
      const scope = await capture(dedicated);
      const write = dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.bind(storage) : storage.replaceGoogleAdsDailyMetricsForWindow.bind(storage);
      await expect(write('a', day, day, [{ ...fact, spend: 'invalid-number' }], scope)).rejects.toThrow();
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
    });
    it('publishes facts and freshness together so an overlapping old response cannot overwrite the winner', async () => {
      const winner = await capture(dedicated), stale = await capture(dedicated);
      const originalRefresh = stale.googleAdsRefresh.connection.lastRefreshAt;
      await replace(dedicated, winner);
      const write = dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.bind(storage) : storage.replaceGoogleAdsDailyMetricsForWindow.bind(storage);
      await expect(write('a', day, day, [{ ...fact, spend: '5' }], stale)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      const persisted = dedicated ? await storage.getGA4GoogleAdsSpendConnection('a') : await storage.getGoogleAdsConnection('a');
      expect(persisted!.lastRefreshAt!.getTime()).toBeGreaterThan(originalRefresh.getTime());
      expect(winner.googleAdsRefresh.connection.lastRefreshAt).toEqual(persisted!.lastRefreshAt);
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '25.00' }]);
    });
    it.each(['throw', 'suppress'])('rolls back facts if the matching success timestamp cannot be saved (%s)', async failure => {
      const scope = await capture(dedicated), before = scope.googleAdsRefresh.connection.lastRefreshAt;
      const table = getTableName(connectionTable(dedicated));
      await pool.query(`CREATE FUNCTION deny_fixture_freshness() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${failure === 'throw' ? "RAISE EXCEPTION 'fixture freshness failure'" : 'RETURN NULL'}; END $$`);
      await pool.query(`CREATE TRIGGER deny_freshness BEFORE UPDATE OF last_refresh_at ON "${table}" FOR EACH ROW EXECUTE FUNCTION deny_fixture_freshness()`);
      try {
        await expect(replace(dedicated, scope)).rejects.toThrow();
        expect(scope.googleAdsRefresh.connection.lastRefreshAt).toEqual(before);
        expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
      } finally {
        await pool.query(`DROP TRIGGER deny_freshness ON "${table}"`); await pool.query('DROP FUNCTION deny_fixture_freshness()');
      }
    });
    it('advances the freshness marker for consecutive commits within the same millisecond', async () => {
      vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
      try {
        const first = await capture(dedicated); await replace(dedicated, first);
        const second = await capture(dedicated), stale = await capture(dedicated);
        await replace(dedicated, second);
        expect(second.googleAdsRefresh.connection.lastRefreshAt.getTime()).toBe(first.googleAdsRefresh.connection.lastRefreshAt.getTime() + 1);
        await expect(replace(dedicated, stale)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      } finally { vi.useRealTimers(); }
    });
    it('preserves successful empty-window replacement and prevents stale data resurrection', async () => {
      const winner = await capture(dedicated), stale = await capture(dedicated);
      const write = dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.bind(storage) : storage.replaceGoogleAdsDailyMetricsForWindow.bind(storage);
      await expect(write('a', day, day, [], winner)).resolves.toEqual({ replaced: 0 });
      await expect(replace(dedicated, stale)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([]);
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'b'`)).rows).toEqual([{ spend: '10.00' }]);
    });
  });

  it('rejects a changed provider campaign selection', async () => {
    const scope = await capture();
    await pool.query("UPDATE google_ads_connections SET selected_campaign_ids = '[\"other\"]' WHERE campaign_id = 'a'");
    await expect(replace(false, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
  });
  it.each(['mapping', 'deleted', 'deactivated', 'currency', 'recreated'])('rejects Spend source %s during refresh and materialization', async change => {
    const scope = await capture(true);
    if (change === 'mapping') await pool.query("UPDATE spend_sources SET mapping_config = '{\"platform\":\"google_ads\",\"selectedCampaignIds\":[\"other\"]}' WHERE id = 'source-a'");
    if (change === 'deleted') await pool.query("DELETE FROM spend_sources WHERE id = 'source-a'");
    if (change === 'deactivated') await pool.query("UPDATE spend_sources SET is_active = false WHERE id = 'source-a'");
    if (change === 'currency') await pool.query("UPDATE spend_sources SET currency = 'USD' WHERE id = 'source-a'");
    if (change === 'recreated') await pool.query("UPDATE spend_sources SET id = 'new-source' WHERE id = 'source-a'");
    await expect(replace(true, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    await expect(storage.replaceSpendRecordsForSource('a', 'source-a', 'ad_platforms', 'ga4', [], scope.googleAdsRefresh.source.mappingConfig, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    expect((await pool.query("SELECT spend FROM spend_records WHERE campaign_id = 'a'")).rows).toEqual([{ spend: '10.00' }]);
  });
  it('accepts only the explicit same-campaign Spend draft preview exception', async () => {
    await pool.query("UPDATE campaigns SET status = 'draft' WHERE id = 'a'");
    await expect(replace(false, await capture(false, { allowDraftPreview: true }))).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    await expect(replace(true, await capture(true))).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    await expect(replace(true, await capture(true, { allowDraftPreview: true }))).resolves.toEqual({ replaced: 1 });
  });
  it('passes service-account runtime credentials without comparing an ephemeral token to persisted credentials', async () => {
    await pool.query("UPDATE ga4_google_ads_spend_connections SET method = 'service_account', access_token = NULL, refresh_token = NULL, client_secret = NULL WHERE campaign_id = 'a'");
    const [connection] = await database.current.select().from(schema.ga4GoogleAdsSpendConnections).where(eq(schema.ga4GoogleAdsSpendConnections.campaignId, 'a'));
    const scope: any = { googleAdsRefresh: { campaign: await storage.getCampaign('a'), connection: { ...connection, accessToken: 'runtime-token' }, dedicatedSpend: true, source: (await storage.getSpendSources('a', 'ga4'))[0] } };
    await expect(replace(true, scope)).resolves.toEqual({ replaced: 1 });
  });
  it('preserves a service-account manager supplied from runtime configuration', async () => {
    vi.stubEnv('GOOGLE_ADS_SERVICE_ACCOUNT_JSON', JSON.stringify({ type: 'service_account', client_email: 'fixture@example.invalid', private_key: 'fixture-not-a-real-key' }));
    vi.stubEnv('GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID', '9999999999');
    try {
      await pool.query("UPDATE ga4_google_ads_spend_connections SET method = 'service_account', access_token = NULL, refresh_token = NULL, client_id = NULL, client_secret = NULL WHERE campaign_id = 'a'");
      const [connection] = await database.current.select().from(schema.ga4GoogleAdsSpendConnections).where(eq(schema.ga4GoogleAdsSpendConnections.campaignId, 'a'));
      const scope: any = { googleAdsRefresh: { campaign: await storage.getCampaign('a'), connection: { ...connection, managerAccountId: '9999999999', accessToken: 'runtime-token' }, dedicatedSpend: true } };
      await expect(replace(true, scope)).resolves.toEqual({ replaced: 1 });
      // Metadata updates return persisted fields; a subsequent check still uses the same effective manager.
      scope.googleAdsRefresh.connection = await update(true, { lastRefreshAt: new Date() }, scope);
      await expect(replace(true, scope)).resolves.toEqual({ replaced: 1 });
    } finally { vi.stubEnv('GOOGLE_ADS_SERVICE_ACCOUNT_JSON', ''); vi.stubEnv('GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID', ''); }
  });
  it('rejects a duplicate main connection instead of updating multiple identities', async () => {
    const scope = await capture();
    await database.current.insert(schema.googleAdsConnections).values({ ...scope.googleAdsRefresh.connection, id: 'duplicate' });
    await expect(replace(false, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
  });
  it('rejects a new Spend source added while an unconfigured preview was fetching', async () => {
    await pool.query("DELETE FROM spend_sources WHERE id = 'source-a'");
    const scope = await capture(true);
    await expect(replace(true, scope)).resolves.toEqual({ replaced: 1 });
    await database.current.insert(schema.spendSources).values({ id: 'new-source', campaignId: 'a', sourceType: 'ad_platforms', platformContext: 'ga4', currency: 'EUR', displayName: 'Google Ads', mappingConfig: '{"platform":"google_ads","selectedCampaignIds":["other"]}' });
    await expect(replace(true, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
  });
  it('keeps the legacy main-table Spend-only refresh working', async () => {
    await pool.query("DELETE FROM ga4_google_ads_spend_connections WHERE campaign_id = 'a'");
    await pool.query("UPDATE google_ads_connections SET spend_only = true WHERE campaign_id = 'a'");
    expect((await refreshGoogleAdsForCampaign('a', undefined, { deferDownstream: true })).spendMaterialization).toMatchObject({ updated: true, sourceId: 'source-a', totalSpend: 25 });
  });
  it('blocks stale snapshot invalidation after reconnect', async () => {
    const scope = await capture();
    await pool.query("UPDATE google_ads_connections SET id = 'reconnected' WHERE campaign_id = 'a'");
    await expect(storage.invalidateExecutiveSummaryDailySnapshotAlignment('a', day, scope)).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
  });
  it('stops before cached totals and downstream jobs if ownership changes after materialization', async () => {
    const original = runtimeStorage.getSpendTotalForRange.bind(runtimeStorage);
    const spy = vi.spyOn(runtimeStorage, 'getSpendTotalForRange').mockImplementationOnce(async (...args) => {
      const totals = await original(...args);
      await pool.query("UPDATE campaigns SET owner_id = 'new-owner' WHERE id = 'a'");
      return totals;
    });
    try {
      await expect(refreshGoogleAdsForCampaign('a', undefined, { ga4SpendConnection: true })).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      expect((await storage.getCampaign('a'))?.spend).toBe('10.00');
      expect(provider.jobs).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it.each([false, true])('actual scheduler rejects a reconnect during provider I/O (dedicated=%s)', async dedicated => {
    provider.daily.mockImplementation(async () => {
      await pool.query(`UPDATE "${getTableName(connectionTable(dedicated))}" SET id = 'reconnected' WHERE campaign_id = 'a'`);
      return [{ campaignId: 'selected', date: day, costMicros: 25_000_000, impressions: 100, clicks: 10, conversions: 1, conversionsValue: 50, ctr: 0.1, averageCpc: 2_500_000, averageCpm: 250_000_000, interactionRate: 0.1, videoViews: 0, searchImpressionShare: 0.5 }];
    });
    await expect(refreshGoogleAdsForCampaign('a', undefined, { ga4SpendConnection: dedicated })).rejects.toThrow('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
    expect(provider.jobs).not.toHaveBeenCalled();
    expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
  });
  it.each([false, true])('actual scheduler completes an unchanged refresh (dedicated=%s)', async dedicated => {
    const result = await refreshGoogleAdsForCampaign('a', undefined, { ga4SpendConnection: dedicated, deferDownstream: true });
    expect(result.providerRefreshed).toBe(true);
    expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '25.00' }]);
    if (dedicated) expect(result.spendMaterialization).toMatchObject({ sourceId: 'source-a', updated: true, totalSpend: 25 });
  });
  it.each([false, true])('actual overlapping schedulers preserve the committed newer response (dedicated=%s)', async dedicated => {
    let startOlder!: () => void, releaseOlder!: () => void, commitWinner!: () => void, releaseWinner!: () => void;
    const olderStarted = new Promise<void>(resolve => { startOlder = resolve; });
    const olderRelease = new Promise<void>(resolve => { releaseOlder = resolve; });
    const winnerCommitted = new Promise<void>(resolve => { commitWinner = resolve; });
    const winnerRelease = new Promise<void>(resolve => { releaseWinner = resolve; });
    const response = (costMicros: number) => [{ campaignId: 'selected', date: day, costMicros, impressions: 100, clicks: 10, conversions: 1, conversionsValue: 50,
      ctr: 0.1, averageCpc: 2_500_000, averageCpm: 250_000_000, interactionRate: 0.1, videoViews: 0, searchImpressionShare: 0.5 }];
    provider.daily.mockImplementationOnce(async () => { startOlder(); await olderRelease; return response(5_000_000); });
    provider.daily.mockResolvedValueOnce(response(25_000_000));
    const method = dedicated ? 'replaceGA4GoogleAdsSpendDailyMetricsForWindow' : 'replaceGoogleAdsDailyMetricsForWindow';
    const original = runtimeStorage[method].bind(runtimeStorage);
    const spy = vi.spyOn(runtimeStorage, method).mockImplementation(async (...args) => {
      const result = await original(...args);
      if (Number(args[3][0].spend) === 25) { commitWinner(); await winnerRelease; }
      return result;
    });
    const run = () => refreshGoogleAdsForCampaign('a', undefined, { ga4SpendConnection: dedicated, deferDownstream: true })
      .then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
    let older: ReturnType<typeof run> | undefined, winner: ReturnType<typeof run> | undefined;
    try {
      older = run(); await olderStarted;
      winner = run(); await winnerCommitted;
      releaseOlder();
      const olderResult = await older;
      expect(olderResult.error?.message).toBe('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      releaseWinner();
      const winnerResult = await winner;
      expect(winnerResult.error).toBeUndefined(); expect(winnerResult.value?.providerRefreshed).toBe(true);
      if (dedicated) expect(winnerResult.value?.spendMaterialization).toMatchObject({ updated: true, totalSpend: 25 });
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '25.00' }]);
      expect((await pool.query(`SELECT spend FROM "${getTableName(dailyTable(!dedicated))}" WHERE campaign_id = 'a'`)).rows).toEqual([{ spend: '10.00' }]);
    } finally { releaseOlder(); releaseWinner(); await older; await winner; spy.mockRestore(); }
  });
  it('reproduces the deployed unguarded-write boundary with the same PostgreSQL fixture', async () => {
    const baseline = execFileSync('git', ['show', '8a9da324:server/storage.ts'], { encoding: 'utf8', windowsHide: true });
    const tree = ts.createSourceFile('baseline.ts', baseline, ts.ScriptTarget.Latest, true);
    let method = '';
    function walk(node: ts.Node) { if (ts.isMethodDeclaration(node) && node.name.getText(tree) === 'replaceGoogleAdsDailyMetricsForWindow' && node.body) method = node.getText(tree); ts.forEachChild(node, walk); }
    walk(tree);
    const code = ts.transpileModule(`class Baseline { ${method} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const Old = new Function('db', 'googleAdsDailyMetrics', 'and', 'eq', 'gte', 'lte', `${code}; return Baseline;`)(database.current, schema.googleAdsDailyMetrics, and, eq, gte, lte);
    const scope = await capture();
    await pool.query("DELETE FROM google_ads_connections WHERE campaign_id = 'a'");
    await new Old().replaceGoogleAdsDailyMetricsForWindow('a', day, day, [fact], scope);
    expect((await pool.query("SELECT spend FROM google_ads_daily_metrics WHERE campaign_id = 'a'")).rows).toEqual([{ spend: '25.00' }]);
  });
});

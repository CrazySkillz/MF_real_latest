import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { request, type Server } from 'node:http';
import express from 'express';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import ts from 'typescript';
import * as schema from '../shared/schema';
import { getReportingDateWindow } from './utils/reporting-timezone';
import { blockAlertDecision, isAlertDecisionBreached } from './utils/alert-decision';
import { stripSourceComputedGA4KPIEditValue, GA4_KPI_ACTIVE_METRIC_CONFLICT, GA4_KPI_INVALID_CONFIGURATION } from './utils/ga4-kpi-create-guard';

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';
import { checkPerformanceAlerts } from './kpi-scheduler';
import { checkBenchmarkPerformanceAlerts } from './benchmark-notifications';

// Actual route/helper declarations, shared schemas and DatabaseStorage SQL. Clerk and
// delivery/notification dispatch are isolated adapters; this is not provider acceptance.
const declarations = new Map<string, Map<string, string>>();
function bind(file: string, name: string, env: Record<string, any>) {
  if (!declarations.has(file)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found = new Map<string, string>();
    function walk(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) found.set(node.name.text, node.getText(source));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !found.has(node.name.text)) found.set(node.name.text, `const ${node.getText(source)};`);
      if (ts.isCallExpression(node) && /^app\.(get|post|put|patch|delete)$/.test(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) {
        found.set(`${node.expression.getText(source).slice(4)} ${node.arguments[0].text}`, `const handler = ${node.arguments.at(-1)!.getText(source)};`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source); declarations.set(file, found);
  }
  const code = declarations.get(file)!.get(name);
  if (!code) throw Error(`Missing declaration: ${name}`);
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('exports', ...Object.keys(env), `${js}\nreturn ${name.includes(' /api/') ? 'handler' : name};`)({}, ...Object.values(env));
}

const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55444'
    || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated local database required');
}
const schemaName = `v1_ads_goals_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.googleAdsConnections, schema.googleAdsDailyMetrics, schema.linkedinConnections, schema.kpis, schema.benchmarks,
  schema.kpiProgress, schema.kpiPeriods, schema.kpiAlerts, schema.benchmarkHistory, schema.notifications];
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, server: Server, basePort: number, created = false;
const dispatch = vi.fn(async () => undefined);
const routeFile = 'server/routes-oauth.ts';
const kinds = [
  { plural: 'kpis', singular: 'kpi', table: schema.kpis, key: 'kpiId', update: 'PATCH', get: (id: string) => storage.getKPI(id) },
  { plural: 'benchmarks', singular: 'benchmark', table: schema.benchmarks, key: 'benchmarkId', update: 'PUT', get: (id: string) => storage.getBenchmark(id) },
] as const;
type Kind = typeof kinds[number];
function payload(mode: 'automatic' | 'manual' | null = 'automatic', extra: any = {}) {
  return { campaignId: 'a', name: 'CPC fixture', category: 'performance', metric: 'cpc', unit: 'EUR',
    currentValue: '137', targetValue: '2', benchmarkValue: '2', alertThreshold: '2', alertCondition: 'above', alertsEnabled: true,
    calculationConfig: mode ? { currentValueMode: mode, preservedOption: 'retain' } : null, ...extra };
}
async function api(method: string, path: string, body?: unknown, actor = 'owner-a') {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: basePort, path, method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor } }, res => {
      let text = ''; res.on('data', chunk => text += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode!, body: JSON.parse(text) }); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function add(kind: Kind, body = payload()) {
  const result = await api('POST', `/api/platforms/google_ads/${kind.plural}`, body);
  expect(result.status, JSON.stringify(result.body)).toBe(kind.singular === 'kpi' ? 200 : 201);
  return result.body;
}
async function list(kind: Kind, campaignId = 'a', actor = 'owner-a') {
  const result = await api('GET', `/api/platforms/google_ads/${kind.plural}?campaignId=${campaignId}`, undefined, actor);
  expect(result.status).toBe(200); return result.body as any[];
}
async function snapshot() {
  const result: Record<string, any> = {};
  for (const table of tables) result[getTableName(table)] = (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows;
  return result;
}
async function seedHistory(kind: Kind, id: string) {
  if (kind.singular === 'kpi') {
    await database.current.insert(schema.kpiProgress).values({ kpiId: id, value: '137' });
    await database.current.insert(schema.kpiAlerts).values({ kpiId: id, alertType: 'threshold_breach', message: 'Historical alert', currentValue: '137' });
    await database.current.insert(schema.kpiPeriods).values({ kpiId: id, periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-30'),
      periodType: 'monthly', periodLabel: 'September', finalValue: '137', targetValue: '2', unit: 'EUR', targetAchieved: false });
  } else {
    await database.current.insert(schema.benchmarkHistory).values({ benchmarkId: id, currentValue: '137', benchmarkValue: '2', variance: '6750' });
  }
  for (const [suffix, campaignId, metadata] of [
    ['target', 'a', { [kind.key]: id, evidence: 'retain' }],
    ['same-campaign-other-goal', 'a', { [kind.key]: 'other' }],
    ['other-campaign-same-id', 'b', { [kind.key]: id }],
    ['malformed', 'a', 'invalid-json'],
  ] as const) {
    await database.current.insert(schema.notifications).values({ id: `${id}-${suffix}`, campaignId, title: 'Fixture', message: 'History', type: 'performance-alert',
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata) });
  }
}

describe.skipIf(!testUrl)('Google Ads goal HTTP/storage lifecycle', () => {
  beforeAll(async () => {
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
      const checks = getTableConfig(table).checks.map(check => `CONSTRAINT "${check.name}" CHECK (${dialect.sqlToQuery(check.value).sql})`);
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${[...columns, ...checks].join(', ')})`);
    }
    const env: Record<string, any> = { storage, z, insertKPISchema: schema.insertKPISchema, insertBenchmarkSchema: schema.insertBenchmarkSchema,
      getAuth: (req: any) => ({ userId: req.headers['x-fixture-actor'] }), isInternalAutoRefreshRequest: () => false,
      stripSourceComputedGA4KPIEditValue, GA4_KPI_ACTIVE_METRIC_CONFLICT, GA4_KPI_INVALID_CONFIGURATION,
      refreshInstagramKpisIfNeeded: dispatch, refreshInstagramBenchmarksIfNeeded: dispatch,
      checkPerformanceAlerts: dispatch, runImmediateKPIEmailAlertCheck: dispatch, runImmediateBenchmarkEmailAlertCheck: dispatch,
      require: (name: string) => { if (name !== './benchmark-notifications.js') throw Error(`Unexpected import ${name}`); return { checkBenchmarkPerformanceAlerts: dispatch }; },
    };
    for (const name of ['getActorId', 'campaignIdSchema', 'ensureCampaignAccess', 'ensureKpiAccess', 'ensureBenchmarkAccess',
      'isCampaignKPIPlatformType', 'isCampaignBenchmarkPlatformType', 'normalizeNotificationKey', 'isGA4NotificationPlatform', 'isValidReportScheduleRecipient', 'getGA4AlertEmailRecipientsError', 'notificationMetadata',
      'dismissedNotificationMetadata', 'prepareKPINotificationHides', 'prepareBenchmarkNotificationHides']) env[name] = bind(routeFile, name, env);
    const resolverEnv: Record<string, any> = { storage, getReportingDateWindow, blockAlertDecision };
    const currentFile = 'server/utils/campaign-current-values.ts';
    resolverEnv.resolveCampaignCurrentValueForAlert = bind(currentFile, 'resolveCampaignCurrentValueForAlert', { isCampaignLevel: bind(currentFile, 'isCampaignLevel', {}) });
    const resolverFile = 'server/utils/ga4-alert-current-value.ts';
    resolverEnv.isGA4Platform = bind(resolverFile, 'isGA4Platform', {});
    env.resolveAlertCurrentValueForDecision = bind(resolverFile, 'resolveAlertCurrentValueForDecision', resolverEnv);
    const app = express(); app.use(express.json());
    for (const kind of kinds) {
      const path = `/api/platforms/:platformType/${kind.plural}`;
      for (const method of ['get', 'post']) (app as any)[method](path, bind(routeFile, `${method} ${path}`, env));
      for (const method of [kind.update.toLowerCase(), 'delete']) (app as any)[method](`${path}/:${kind.key}`, bind(routeFile, `${method} ${path}/:${kind.key}`, env));
    }
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    basePort = (server.address() as any).port;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end();
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ['a', 'b']) {
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: new Date('2026-09-01') });
      await database.current.insert(schema.googleAdsConnections).values({ campaignId: id, customerId: 'fixture', customerName: 'Fixture', method: 'oauth', spendOnly: false,
        selectedCampaignIds: '["selected"]', lastRefreshAt: new Date('2026-10-25T07:00:00Z') });
      await database.current.insert(schema.googleAdsDailyMetrics).values([
        { campaignId: id, googleCampaignId: 'selected', date: '2026-10-24', spend: '100', clicks: 10, impressions: 100, conversions: '0.5' },
        { campaignId: id, googleCampaignId: 'excluded', date: '2026-10-24', spend: '999', clicks: 1, impressions: 1 },
      ]);
    }
    for (const kind of kinds) {
      await database.current.insert(kind.table).values([
        { ...payload('manual'), id: `${kind.singular}-other-platform`, platformType: 'google_sheets', alertsEnabled: false },
        { ...payload('manual'), id: `${kind.singular}-other-campaign`, campaignId: 'b', platformType: 'google_ads', alertsEnabled: false },
      ]);
    }
    dispatch.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  for (const kind of kinds) describe(kind.plural, () => {
    it('round-trips automatic/manual mode and zero through HTTP, schema, SQL and resolved GET without read writes', async () => {
      const goal = await add(kind);
      const saved = await kind.get(goal.id);
      expect(saved).toMatchObject({ currentValue: '137', calculationConfig: { currentValueMode: 'automatic', preservedOption: 'retain' } });
      const before = await snapshot();
      const rows = await list(kind);
      expect(rows).toHaveLength(1); expect(rows[0].currentValue).toBe('10'); expect(isAlertDecisionBreached(rows[0])).toBe(true);
      expect(await snapshot()).toEqual(before);
      const updated = await api(kind.update, `/api/platforms/google_ads/${kind.plural}/${goal.id}`, payload('manual', { currentValue: '0', campaignId: 'b', platformType: 'google_analytics' }));
      expect(updated.status).toBe(200);
      expect(await kind.get(goal.id)).toMatchObject({ campaignId: 'a', platformType: 'google_ads', currentValue: '0', calculationConfig: { currentValueMode: 'manual', preservedOption: 'retain' } });
      expect((await list(kind))[0].currentValue).toBe('0');
      await api(kind.update, `/api/platforms/google_ads/${kind.plural}/${goal.id}`, { calculationConfig: { currentValueMode: 'automatic', preservedOption: 'retain' } });
      expect((await list(kind))[0].currentValue).toBe('10');
      expect((await kind.get(goal.id))?.currentValue).toBe('0');
    });
    it('preserves untagged saved values until explicitly switched, including null', async () => {
      const goal = await add(kind, payload(null));
      expect((await list(kind))[0].currentValue).toBe('137');
      await pool.query(`UPDATE "${kind.plural}" SET current_value = NULL WHERE id = $1`, [goal.id]);
      expect((await list(kind))[0].currentValue).toBeNull();
      await api(kind.update, `/api/platforms/google_ads/${kind.plural}/${goal.id}`, { calculationConfig: { currentValueMode: 'automatic' } });
      expect((await list(kind))[0].currentValue).toBe('10');
    });
    it('uses fresh selected facts and fails closed after disconnect without rewriting saved goals', async () => {
      const goal = await add(kind);
      await pool.query("UPDATE google_ads_daily_metrics SET spend = '250' WHERE campaign_id = 'a' AND google_campaign_id = 'selected'");
      expect((await list(kind))[0].currentValue).toBe('25');
      await pool.query("DELETE FROM google_ads_connections WHERE campaign_id = 'a'");
      const row = (await list(kind))[0];
      expect(row.currentValue).toBeNull(); expect(isAlertDecisionBreached(row)).toBe(false);
      expect((await kind.get(goal.id))?.currentValue).toBe('137');
      expect((await pool.query("SELECT count(*)::int AS n FROM google_ads_connections WHERE campaign_id = 'b'")).rows[0].n).toBe(1);
    });
    it.each([
      { label: 'automatic breach despite saved zero', mode: 'automatic', saved: '0', threshold: '2', expected: '€10.00' },
      { label: 'automatic clear despite saved breach', mode: 'automatic', saved: '137', threshold: '20', expected: null },
      { label: 'manual breach despite lower provider value', mode: 'manual', saved: '137', threshold: '20', expected: '€137.00' },
      { label: 'manual zero', mode: 'manual', saved: '0', threshold: '2', expected: null },
      { label: 'unavailable denominator', mode: 'automatic', saved: '137', threshold: '2', expected: null },
      { label: 'disconnected source', mode: 'automatic', saved: '137', threshold: '2', expected: null },
      { label: 'measured zero below threshold', mode: 'automatic', saved: '137', threshold: '2', expected: '€0.00' },
    ])('propagates $label through the actual scheduled decision and persisted notification', async scenario => {
      const goal = await add(kind, payload(scenario.mode as 'automatic' | 'manual', {
        currentValue: scenario.saved, alertThreshold: scenario.threshold,
        alertCondition: scenario.label === 'measured zero below threshold' ? 'below' : 'above',
      }));
      if (scenario.label === 'unavailable denominator') await pool.query("UPDATE google_ads_daily_metrics SET clicks = 0 WHERE campaign_id = 'a' AND google_campaign_id = 'selected'");
      if (scenario.label === 'disconnected source') await pool.query("DELETE FROM google_ads_connections WHERE campaign_id = 'a'");
      if (scenario.label === 'measured zero below threshold') await pool.query("UPDATE google_ads_daily_metrics SET spend = 0 WHERE campaign_id = 'a' AND google_campaign_id = 'selected'");
      if (kind.singular === 'kpi') await checkPerformanceAlerts();
      else await checkBenchmarkPerformanceAlerts();
      const notices = (await pool.query('SELECT * FROM notifications')).rows;
      expect(notices).toHaveLength(scenario.expected === null ? 0 : 1);
      if (scenario.expected !== null) {
        expect(notices[0].message).toContain(`Current value: ${scenario.expected}`);
        expect(JSON.parse(notices[0].metadata)[kind.key]).toBe(goal.id);
      }
      expect((await kind.get(goal.id))?.currentValue).toBe(scenario.saved);
    });
    it.each(['unauthenticated', 'other-owner', 'wrong-platform'])('rejects %s edits/deletes/reads without mutation', async reason => {
      const goal = await add(kind), before = await snapshot();
      const actor = reason === 'unauthenticated' ? '' : reason === 'other-owner' ? 'owner-b' : 'owner-a';
      const platform = reason === 'wrong-platform' ? 'google_sheets' : 'google_ads';
      for (const method of [kind.update, 'DELETE']) {
        const result = await api(method, `/api/platforms/${platform}/${kind.plural}/${goal.id}`, method === 'DELETE' ? undefined : payload('manual', { currentValue: '999' }), actor);
        expect(result.status).toBe(reason === 'unauthenticated' ? 401 : 404);
      }
      const read = await api('GET', `/api/platforms/${platform}/${kind.plural}?campaignId=a`, undefined, actor);
      expect(read.status).toBe(reason === 'wrong-platform' ? 200 : reason === 'unauthenticated' ? 401 : 404);
      if (reason === 'wrong-platform') expect(read.body.map((row: any) => row.id)).toEqual([`${kind.singular}-other-platform`]);
      expect(await snapshot()).toEqual(before);
    });
    it('rejects foreign/unauthenticated creates and missing parents', async () => {
      const before = await snapshot();
      for (const [actor, campaignId, status] of [['owner-b', 'a', 404], ['', 'a', 401], ['owner-a', 'missing', 404]] as const) {
        expect((await api('POST', `/api/platforms/google_ads/${kind.plural}`, payload('automatic', { campaignId }), actor)).status).toBe(status);
      }
      expect(await snapshot()).toEqual(before);
    });
    it('rejects non-finite persisted current values using the real schema constraint', async () => {
      const goal = await add(kind), before = await snapshot();
      const result = await api(kind.update, `/api/platforms/google_ads/${kind.plural}/${goal.id}`, { currentValue: 'NaN', calculationConfig: { currentValueMode: 'manual' } });
      expect(result.status).toBe(500); expect(await snapshot()).toEqual(before);
    });
    it('deletes only the selected goal and its children, soft-hides its notices and returns 404 on retry', async () => {
      const goal = await add(kind), other = await add(kind, payload('manual', { name: 'Other', currentValue: '3' }));
      const otherBefore = await kind.get(other.id);
      await seedHistory(kind, goal.id); await seedHistory(kind, other.id);
      const before = await snapshot();
      expect((await api('DELETE', `/api/platforms/google_ads/${kind.plural}/${goal.id}`)).body.success).toBe(true);
      expect(await kind.get(goal.id)).toBeUndefined(); expect(await kind.get(other.id)).toEqual(otherBefore);
      const notifications = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
      expect(notifications).toHaveLength(before.notifications.length);
      for (const row of notifications) {
        if (row.id === `${goal.id}-target`) {
          expect(row.read).toBe(true); expect(JSON.parse(row.metadata)).toMatchObject({ [kind.key]: goal.id, evidence: 'retain', dismissalReason: `${kind.singular}_deleted`, dismissedBy: 'owner-a' });
        } else expect(row).toEqual(before.notifications.find((n: any) => n.id === row.id));
      }
      for (const table of kind.singular === 'kpi' ? ['kpi_progress', 'kpi_alerts', 'kpi_periods'] : ['benchmark_history']) {
        const rows = (await pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
        expect(rows).toEqual(before[table].filter((row: any) => row[`${kind.singular}_id`] !== goal.id));
      }
      expect((await list(kind)).map(row => row.id)).toEqual([other.id]);
      const after = await snapshot();
      expect(after[kind.plural]).toEqual(before[kind.plural].filter((row: any) => row.id !== goal.id));
      expect((await api('DELETE', `/api/platforms/google_ads/${kind.plural}/${goal.id}`)).status).toBe(404);
      expect(await snapshot()).toEqual(after);
      for (const table of ['campaigns', 'google_ads_connections', 'google_ads_daily_metrics']) expect(after[table]).toEqual(before[table]);
    });
    it('rolls back notification hides and child deletes when the parent delete fails', async () => {
      const goal = await add(kind); await seedHistory(kind, goal.id); const before = await snapshot();
      await pool.query("CREATE FUNCTION deny_fixture_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture delete failure'; END $$");
      await pool.query(`CREATE TRIGGER deny_delete BEFORE DELETE ON "${kind.plural}" FOR EACH ROW EXECUTE FUNCTION deny_fixture_delete()`);
      try {
        const result = await api('DELETE', `/api/platforms/google_ads/${kind.plural}/${goal.id}`);
        expect(result.status).toBe(500); expect(await snapshot()).toEqual(before);
      } finally {
        await pool.query(`DROP TRIGGER deny_delete ON "${kind.plural}"`); await pool.query('DROP FUNCTION deny_fixture_delete()');
      }
    });
  });
});

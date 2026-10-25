import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as orm from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import * as schema from '../shared/schema';
import { createReportPdfArtifact, readReportPdfArtifact } from './utils/report-pdf-artifact';
import { buildAlertEmailAuditState, buildAlertEmailRetryState, claimAlertEmailSend } from './utils/alert-email-audit';
import { evaluateAlertThreshold, parseAlertNumber } from './utils/alert-evaluation';
import { isAlertDecisionBreached } from './utils/alert-decision';
import { formatConversionCredit } from '../shared/metric-math';

const state = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return state.current; }, pool: null }));
import { DatabaseStorage } from './storage';

const baseline = process.env.V1_BATCH7_BASELINE === '1';
const runtime = (file: string) => baseline
  ? execFileSync('git', ['show', `825972a9:${file}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true })
  : readFileSync(file, 'utf8');
function declarations(file: string) {
  const source = ts.createSourceFile(file, runtime(file), ts.ScriptTarget.Latest, true);
  const result = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) result.set(node.name.text, node.getText(source));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !result.has(node.name.text)) result.set(node.name.text, `const ${node.getText(source)};`);
    if (ts.isMethodDeclaration(node) && node.name) result.set(node.name.getText(source), node.getText(source).replace(/^private /, '').replace(/^async /, 'async function '));
    if (ts.isCallExpression(node) && /^app\.(get|delete)$/.test(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) result.set(node.arguments[0].text, `const handler = ${node.arguments.at(-1)!.getText(source)};`);
    ts.forEachChild(node, visit);
  }
  visit(source); return result;
}
const scheduled = declarations('server/report-scheduler.ts');
const routes = declarations('server/routes-oauth.ts');
const kpiCode = declarations('server/kpi-notifications.ts');
const benchmarkCode = declarations('server/benchmark-notifications.ts');
const emailCode = declarations('server/services/email-service.ts');
const monitorCode = declarations('server/services/alert-monitoring.ts');
const storageCode = baseline ? declarations('server/storage.ts') : null;
function bind(map: Map<string, string>, name: string, env: Record<string, any>) {
  const code = map.get(name); if (!code) throw Error(`Missing declaration: ${name}`);
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('exports', ...Object.keys(env), `${js}\nreturn ${name.startsWith('/') ? 'handler' : name};`)({}, ...Object.values(env));
}
const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '55444' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated localhost test database required');
}
const schemaName = `v1_reliability_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.linkedinReports, schema.reportSendEvents, schema.reportSnapshots, schema.emailAlertEvents,
  schema.notifications, schema.kpis, schema.benchmarks, schema.kpiPeriods, schema.kpiProgress, schema.kpiAlerts, schema.benchmarkHistory];
const storage = new DatabaseStorage();
const originalPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(160, 65)]);
const changedPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(160, 66)]);
const buildPdf = vi.fn(async () => originalPdf);
const delivery = vi.fn(async (_id: string): Promise<any> => ({ status: 'delivered' }));
let admin: Pool, pool: Pool, realDb: any, created = false;
let beforeNotificationWrite: (() => Promise<void>) | undefined;
let staleReadBarrier: (() => Promise<void>) | undefined;
// Interleave actual SQL at its read/write boundary; table data and transactions remain PostgreSQL.
function wrapQuery(query: any, table?: any, write = false): any {
  let proxy: any;
  proxy = new Proxy(query, { get(target, key) {
    if (key === 'then') return (resolve: any, reject: any) => (async () => {
      if (write && table === schema.notifications && beforeNotificationWrite) {
        const hook = beforeNotificationWrite; beforeNotificationWrite = undefined; await hook();
      }
      const rows = await target;
      if (!write && table === schema.reportSendEvents && staleReadBarrier && rows?.length === 1 && ['failed','pending'].includes(rows[0]?.status)) await staleReadBarrier();
      return rows;
    })().then(resolve, reject);
    if (key === 'catch') return (reject: any) => Promise.resolve(proxy).catch(reject);
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    return (...args: any[]) => {
      const next = value.apply(target, args);
      return next && typeof next === 'object' && ('then' in next || 'from' in next) ? wrapQuery(next, key === 'from' ? args[0] : table, write) : next;
    };
  } }); return proxy;
}
function context(overrides: Record<string, any> = {}) {
  const env: Record<string, any> = { db: state.current, storage, ...schema, ...orm, notificationRows: schema.notifications,
    createReportPdfArtifact, readReportPdfArtifact, randomUUID, buildAlertEmailAuditState, buildAlertEmailRetryState,
    console: { log() {}, warn() {}, error() {} }, setTimeout: (callback: () => void) => queueMicrotask(callback),
    SCHEDULED_REPORT_PLATFORM_TYPES: ['google_analytics','google_sheets','linkedin'],
    schedulerMetrics: { totalChecks: 0, totalSent: 0, totalFailed: 0 },
    isReportDueNow: () => ({ due: true, scheduledKey: '2026-10-25T09:00@Europe/Amsterdam', tz: 'Europe/Amsterdam' }),
    getScheduledReportAlignedRefreshGate: async () => ({ ready: true }),
    validateInstagramScheduledReportScope: async () => ({ ok: true }), validateTikTokScheduledReportScope: async () => ({ ok: true }),
    isValidScheduledReportRecipient: (value: string) => value.includes('@'),
    preflightGA4ReportKPIConsumers: async () => ({ ok: true }), parseReportConfiguration: JSON.parse,
    buildPdfAttachmentForReport: buildPdf, sourceBackedReportOutputUnavailableMessage: () => 'PDF unavailable',
    platformRequiresSourceBackedReportOutput: () => true,
    waitForMailgunDelivery: delivery, mapMailgunDeliveryToAlertEmailStatus: (status: string) => status === 'pending' ? 'pending_delivery' : status,
    getAuth: (req: any) => ({ userId: req.actor }), isInternalAutoRefreshRequest: () => false,
    require: (name: string) => name.includes('schema') ? schema : name === './db' ? { db: state.current } : name === 'drizzle-orm' ? orm : (() => { throw Error(name); })(),
    process: { env: { SMTP_USER: 'fixture', SMTP_PASS: 'fixture' } },
    evaluateAlertThreshold, parseAlertNumber, isAlertDecisionBreached, formatConversionCredit,
    resolveAlertCurrentValueForDecision: async (item: any) => item,
    ...overrides,
  };
  if (storageCode) {
    storage.deleteKPI = bind(storageCode, 'deleteKPI', env).bind(storage);
    storage.deleteBenchmark = bind(storageCode, 'deleteBenchmark', env).bind(storage);
  }
  const log = bind(emailCode, 'logEmailAuditEvent', env);
  const send = vi.fn(async (options: any) => {
    await log({ options, provider: 'mailgun-api', toText: options.to.map((value: string) => value.trim()).filter(Boolean).join(', '),
      success: true, providerResponseId: `message-${options.auditContext.auditEventId || randomUUID()}`, deliveryStatus: 'accepted' });
    return true;
  });
  env.emailService = { sendEmail: send };
  for (const name of ['getLatestReportEmailError','getLatestReportEmailAudit','confirmScheduledReportEmailDelivery','reconcileScheduledReportSend','sendReportEmail','sendReportEmailWithRetry','checkScheduledReports','sendTestReport']) {
    if (scheduled.has(name)) env[name] = bind(scheduled, name, env);
  }
  for (const name of ['getActorId','notificationMetadata','isNotificationDismissed','dismissedNotificationMetadata','softHideNotification','prepareKPINotificationHides','prepareBenchmarkNotificationHides']) env[name] = bind(routes, name, env);
  env.ensureCampaignAccess = async (req: any, res: any, id: string) => {
    const row = await storage.getCampaign(id); if (row?.ownerId === req.actor) return row;
    res.status(404).json({}); return null;
  };
  env.resolveKPIAlerts = bind(kpiCode, 'resolveKPIAlerts', env);
  env.resolveBenchmarkAlerts = bind(benchmarkCode, 'resolveBenchmarkAlerts', env);
  for (const [map, names] of [[kpiCode, ['isIsoCurrencyCode','formatPct','formatAlertDisplayValue','buildKPIActionUrl','shouldTriggerAlert','createKPIAlert']],
    [benchmarkCode, ['isIsoCurrencyCode','formatPct','formatAlertDisplayValue','buildBenchmarkActionUrl','checkBenchmarkPerformanceAlertsForScope']]] as const) {
    for (const name of names) env[name] = bind(map, name, env);
  }
  env.episode = bind(monitorCode, 'getImmediateAlertEpisodeKey', env);
  env.dismiss = bind(routes, '/api/notifications/:id', env);
  env.clear = bind(routes, '/api/notifications/all/clear', env);
  return { ...env, send, log };
}
async function report(extra: any = {}) { return storage.createLinkedInReport({ campaignId: 'a', platformType: 'google_sheets', name: 'Fixture report', reportType: 'overview', configuration: '{}', scheduleEnabled: true, status: 'active', scheduleRecipients: ['fixture@example.invalid'], ...extra }); }
async function rows(table: any) { return realDb.select().from(table); }
async function invoke(handler: any, id = '', actor = 'owner-a') {
  const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(value: any) { this.body = value; return this; } };
  await handler({ params: { id }, actor }, res); return res;
}
async function seedAlert(kind: 'kpi' | 'benchmark' = 'kpi', campaignId = 'a') {
  const id = randomUUID();
  const table = kind === 'kpi' ? schema.kpis : schema.benchmarks;
  await realDb.insert(table).values(kind === 'kpi'
    ? { id, campaignId, platformType: 'linkedin', name: 'Fixture KPI', metric: 'sessions', targetValue: '100', currentValue: '50', unit: 'count', alertFrequency: 'immediate' }
    : { id, campaignId, platformType: 'linkedin', name: 'Fixture benchmark', metric: 'sessions', category: 'traffic', benchmarkValue: '100', currentValue: '50', unit: 'count', alertFrequency: 'immediate' });
  const notification = await storage.createNotification({ title: 'Fixture alert', message: 'Breach', type: 'performance-alert', campaignId,
    metadata: JSON.stringify({ [`${kind}Id`]: id, observed: 50 }) });
  return { id, notification };
}

describe.skipIf(!testUrl)('Batch 7 report recovery and notification lifecycle', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 }); await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 8 });
    realDb = drizzle(pool, { schema });
    state.current = new Proxy(realDb, { get(target, key) {
      if (key === 'select') return (...args: any[]) => wrapQuery(target.select(...args));
      if (key === 'update') return (table: any) => wrapQuery(target.update(table), table, true);
      return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
    } });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(orm.getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof orm.SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${defaultSql}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      });
      const checks = getTableConfig(table).checks.map(check => `CONSTRAINT "${check.name}" CHECK (${dialect.sqlToQuery(check.value).sql})`);
      await pool.query(`CREATE TABLE "${orm.getTableName(table)}" (${[...columns, ...checks].join(', ')})`);
    }
    await pool.query('CREATE UNIQUE INDEX report_slot ON report_send_events(report_id, scheduled_key)');
    await pool.query('CREATE UNIQUE INDEX email_dedupe ON email_alert_events(dedupe_key)');
    await pool.query(`CREATE FUNCTION reject_fixture_write() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''fixture persistence failure''; END'`);
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) {
      await pool.query(`DROP TRIGGER IF EXISTS fixture_failure ON "${orm.getTableName(table)}"`);
      await pool.query(`DELETE FROM "${orm.getTableName(table)}"`);
    }
    for (const id of ['a','b']) await realDb.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR' });
    buildPdf.mockReset().mockResolvedValue(originalPdf); delivery.mockReset().mockResolvedValue({ status: 'delivered' });
    beforeNotificationWrite = undefined; staleReadBarrier = undefined;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const status of ['pending','failed']) it(`only one worker can reclaim a stale ${status} preparation`, async () => {
    const row = await report();
    await realDb.insert(schema.reportSendEvents).values({ reportId: row.id, status, scheduledKey: '2026-10-25T09:00@Europe/Amsterdam',
      error: status === 'pending' ? 'Report preparation pending' : 'Report preparation failed: PDF unavailable', createdAt: new Date(Date.now() - 20 * 60_000) });
    let arrived = 0, release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    staleReadBarrier = async () => { if (++arrived === 2) release(); await gate; };
    const a = context(), b = context(); await Promise.all([a.checkScheduledReports(), b.checkScheduledReports()]);
    expect(a.send.mock.calls.length + b.send.mock.calls.length).toBe(1);
    expect(await rows(schema.reportSnapshots)).toHaveLength(1);
  });
  it('saves the exact original attachment and publishes sent bookkeeping atomically', async () => {
    const row = await report({ scheduleRecipients: [' fixture@example.invalid ', 'two@example.invalid'] }); const job = context(); await job.checkScheduledReports();
    expect(job.send, JSON.stringify({ metrics: job.schedulerMetrics, events: await rows(schema.reportSendEvents) })).toHaveBeenCalledOnce(); const [event] = await rows(schema.reportSendEvents), [snapshot] = await rows(schema.reportSnapshots);
    expect(event).toMatchObject({ status: 'sent', snapshotId: snapshot.id });
    expect(readReportPdfArtifact(JSON.parse(snapshot.snapshotJson))).toEqual(job.send.mock.calls[0][0].attachments[0].content);
    expect((await storage.getLinkedInReport(row.id))?.lastSentAt).not.toBeNull();
    expect(JSON.parse((await rows(schema.emailAlertEvents))[0].metadata).snapshotPayload.pdfArtifact).toBeTruthy();
  });
  for (const table of ['report_snapshots','report_send_events','linkedin_reports']) it(`recovers ${table} finalization failure without resending or rebuilding`, async () => {
    const row = await report();
    const operation = table === 'report_snapshots' ? 'INSERT' : 'UPDATE';
    const condition = table === 'report_send_events' ? " WHEN (NEW.status = 'sent')" : table === 'linkedin_reports' ? ' WHEN (NEW.last_sent_at IS NOT NULL)' : '';
    await pool.query(`CREATE TRIGGER fixture_failure BEFORE ${operation} ON ${table} FOR EACH ROW${condition} EXECUTE FUNCTION reject_fixture_write()`);
    const job = context(); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
    expect((await rows(schema.reportSendEvents))[0]).toMatchObject({ status: 'pending_delivery', snapshotId: null, sentAt: null });
    expect((await storage.getLinkedInReport(row.id))?.lastSentAt).toBeNull();
    await pool.query(`DROP TRIGGER fixture_failure ON ${table}`);
    await storage.updatePlatformReport(row.id, { name: 'Edited', reportType: 'insights', status: 'paused', scheduleEnabled: false });
    buildPdf.mockResolvedValue(changedPdf); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(buildPdf).toHaveBeenCalledOnce();
    const [snapshot] = await rows(schema.reportSnapshots); expect(readReportPdfArtifact(JSON.parse(snapshot.snapshotJson))).toEqual(originalPdf);
    expect(snapshot.reportType).toBe('overview'); expect((await rows(schema.reportSendEvents))[0].status).toBe('sent');
  });
  it('reconciles delayed delivery after a pause and across concurrent recovery workers', async () => {
    const row = await report(); delivery.mockResolvedValue({ status: 'pending' }); const job = context(); await job.checkScheduledReports();
    expect(await rows(schema.reportSnapshots)).toHaveLength(0);
    await storage.updatePlatformReport(row.id, { scheduleEnabled: false, status: 'paused' });
    delivery.mockResolvedValue({ status: 'delivered' }); await Promise.all([job.checkScheduledReports(), context().checkScheduledReports()]);
    expect(job.send).toHaveBeenCalledOnce(); expect(await rows(schema.reportSnapshots)).toHaveLength(1); expect(buildPdf).toHaveBeenCalledOnce();
  });
  for (const mode of ['missing','foreign','smtp-accepted','read-error']) it(`does not infer delivery from ${mode} audit evidence`, async () => {
    const row = await report(); const id = randomUUID(); const job = context();
    if (mode !== 'missing' && mode !== 'read-error') await realDb.insert(schema.emailAlertEvents).values({ id, kind: 'report', entityType: 'report', entityId: mode === 'foreign' ? 'other-report' : row.id,
      to: 'fixture@example.invalid', subject: 'Fixture', success: true, provider: mode === 'smtp-accepted' ? 'smtp' : 'mailgun-api', deliveryStatus: mode === 'smtp-accepted' ? 'accepted' : 'delivered' });
    if (mode === 'read-error') await pool.query('ALTER TABLE email_alert_events RENAME TO fixture_hidden_audit');
    try { expect((await job.confirmScheduledReportEmailDelivery(row.id, id)).sent).toBe(false); }
    finally { if (mode === 'read-error') await pool.query('ALTER TABLE fixture_hidden_audit RENAME TO email_alert_events'); }
    expect(delivery).not.toHaveBeenCalled();
  });
  it('uses the exact message even if another report audit is newer', async () => {
    const row = await report(); const id = randomUUID();
    for (const [auditId, message] of [[id, 'correct-message'], [randomUUID(), 'wrong-message']]) await realDb.insert(schema.emailAlertEvents).values({
      id: auditId, kind: 'report', entityType: 'report', entityId: row.id, to: 'fixture@example.invalid', subject: 'Fixture', success: true,
      provider: 'mailgun-api', deliveryStatus: 'accepted', providerResponseId: message, createdAt: new Date(message === 'correct-message' ? 0 : Date.now()) });
    expect((await context().confirmScheduledReportEmailDelivery(row.id, id)).sent).toBe(true);
    expect(delivery).toHaveBeenCalledWith('correct-message', {});
  });
  it('does not dispatch when the durable audit cannot be stored', async () => {
    await report(); await pool.query('CREATE TRIGGER fixture_failure BEFORE INSERT ON email_alert_events FOR EACH ROW EXECUTE FUNCTION reject_fixture_write()');
    const job = context(); await job.checkScheduledReports(); expect(job.send).not.toHaveBeenCalled(); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
  });
  it('keeps an accepted send with failed audit logging unconfirmed and never dispatches it again', async () => {
    await report(); const job = context(); job.send.mockImplementation(async () => true);
    await job.checkScheduledReports(); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
    expect((await rows(schema.reportSendEvents))[0].status).toBe('pending_delivery');
  });
  for (const scenario of ['deleted-report','deleted-campaign','changed-platform','corrupt-artifact','legacy-no-audit']) it(`fails recovery closed for ${scenario}`, async () => {
    const row = await report(); const job = context(); delivery.mockResolvedValue({ status: 'pending' }); await job.checkScheduledReports();
    if (scenario === 'deleted-report') await realDb.delete(schema.linkedinReports).where(orm.eq(schema.linkedinReports.id, row.id));
    if (scenario === 'deleted-campaign') await realDb.delete(schema.campaigns).where(orm.eq(schema.campaigns.id, 'a'));
    if (scenario === 'changed-platform') await storage.updatePlatformReport(row.id, { platformType: 'linkedin' });
    if (scenario === 'corrupt-artifact') await realDb.update(schema.emailAlertEvents).set({ metadata: '{}' });
    if (scenario === 'legacy-no-audit') await realDb.delete(schema.emailAlertEvents);
    delivery.mockResolvedValue({ status: 'delivered' }); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
  });
  for (const kind of ['kpi','benchmark'] as const) for (const action of ['dismiss','clear','resolve-after-dismiss','resolve-twice']) it(`${kind} ${action} preserves concurrent history and episode identity`, async () => {
    const { id, notification } = await seedAlert(kind); const ctx = context(); const resolve = kind === 'kpi' ? ctx.resolveKPIAlerts : ctx.resolveBenchmarkAlerts;
    if (action === 'dismiss' || action === 'clear') {
      beforeNotificationWrite = () => resolve(id);
      expect((await invoke(action === 'dismiss' ? ctx.dismiss : ctx.clear, notification.id)).code).toBe(200);
    } else {
      beforeNotificationWrite = async () => { if (action === 'resolve-twice') await resolve(id); else await invoke(ctx.dismiss, notification.id); };
      await resolve(id);
    }
    const metadata = JSON.parse((await storage.getNotification(notification.id))!.metadata!);
    expect(metadata).toMatchObject({ [`${kind}Id`]: id, observed: 50, resolved: true, resolvedReason: 'cleared' });
    if (action !== 'resolve-twice') expect(metadata.dismissedAt).toBeTruthy();
    const episode = await ctx.episode(kind, id, 'a'); expect(episode).toBe(`cleared:${notification.id}:${metadata.resolvedAt}`);
    const args = { itemType: kind, itemId: id, frequency: 'immediate', immediateEpisodeKey: episode, recipients: ['fixture@example.invalid'], subject: 'Fixture', campaignId: 'a', campaignName: 'a', sender: 'fixture@example.invalid' };
    expect((await claimAlertEmailSend(args)).claimed).toBe(true); expect((await claimAlertEmailSend(args)).claimed).toBe(false);
  });
  it('dismiss and clear keep foreign and anonymous boundaries', async () => {
    const own = await seedAlert(), foreign = await seedAlert('benchmark', 'b'); const ctx = context();
    expect((await invoke(ctx.dismiss, foreign.notification.id)).code).toBe(404);
    expect((await invoke(ctx.clear, '', '')).code).toBe(401);
    expect((await invoke(ctx.clear)).code).toBe(200);
    expect(JSON.parse((await storage.getNotification(own.notification.id))!.metadata!).dismissedAt).toBeTruthy();
    expect(JSON.parse((await storage.getNotification(foreign.notification.id))!.metadata!).dismissedAt).toBeUndefined();
  });

  for (const kind of ['kpi','benchmark'] as const) {
    it(`${kind} deletion preserves resolution committed after hide preparation`, async () => {
      const { id, notification } = await seedAlert(kind); const ctx = context();
      const item = kind === 'kpi' ? await storage.getKPI(id) : await storage.getBenchmark(id);
      const hides = await (kind === 'kpi' ? ctx.prepareKPINotificationHides : ctx.prepareBenchmarkNotificationHides)(item, 'owner-a');
      await (kind === 'kpi' ? ctx.resolveKPIAlerts : ctx.resolveBenchmarkAlerts)(id);
      expect(await (kind === 'kpi' ? storage.deleteKPI.bind(storage) : storage.deleteBenchmark.bind(storage))(id, hides)).toBe(true);
      expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!)).toMatchObject({ resolved: true, resolvedReason: 'cleared', dismissalReason: `${kind}_deleted` });
    });
    it(`${kind} transactional resolution preserves dismissal and the first resolution time`, async () => {
      const { id, notification } = await seedAlert(kind); const ctx = context();
      await invoke(ctx.dismiss, notification.id);
      const resolve = kind === 'kpi' ? ctx.resolveKPIAlerts : ctx.resolveBenchmarkAlerts;
      await realDb.transaction((tx: any) => resolve(id, 'cleared', tx));
      const first = JSON.parse((await storage.getNotification(notification.id))!.metadata!);
      await realDb.transaction((tx: any) => resolve(id, 'superseded', tx));
      expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!)).toEqual(first);
      expect(first).toMatchObject({ resolved: true, dismissedBy: 'owner-a', resolvedReason: 'cleared' });
    });
    for (const action of ['refresh','supersede']) it(`${kind} ${action} preserves concurrent dismissal and resolution`, async () => {
      const { id, notification } = await seedAlert(kind); const ctx = context();
      const table = kind === 'kpi' ? schema.kpis : schema.benchmarks;
      await realDb.update(table).set({ platformType: 'google_analytics', alertsEnabled: true, alertThreshold: '80', alertCondition: 'below' });
      if (action === 'supersede') await storage.createNotification({ title: 'Second', message: 'Breach', type: 'performance-alert', campaignId: 'a', metadata: notification.metadata });
      beforeNotificationWrite = async () => {
        await invoke(ctx.dismiss, notification.id);
        await (kind === 'kpi' ? ctx.resolveKPIAlerts : ctx.resolveBenchmarkAlerts)(id);
      };
      if (kind === 'kpi') await ctx.createKPIAlert(await storage.getKPI(id));
      else await ctx.checkBenchmarkPerformanceAlertsForScope('a');
      expect(beforeNotificationWrite).toBeUndefined();
      expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!)).toMatchObject({ observed: 50, resolved: true, resolvedReason: 'cleared', dismissedBy: 'owner-a' });
    });
    it(`${kind} rebreach gets one new email claim while repeats and dismissals keep the same claim`, async () => {
      const { id, notification } = await seedAlert(kind); const ctx = context();
      const args = { itemType: kind, itemId: id, frequency: 'immediate', recipients: ['fixture@example.invalid'], subject: 'Fixture', campaignId: 'a', campaignName: 'a', sender: 'fixture@example.invalid' };
      const claim = async () => claimAlertEmailSend({ ...args, immediateEpisodeKey: await ctx.episode(kind, id, 'a') });
      expect((await claim()).claimed).toBe(true);
      await invoke(ctx.dismiss, notification.id); expect((await claim()).claimed).toBe(false);
      await (kind === 'kpi' ? ctx.resolveKPIAlerts : ctx.resolveBenchmarkAlerts)(id);
      expect(await ctx.episode(kind, id, 'a')).toMatch(/^cleared:/);
      const table = kind === 'kpi' ? schema.kpis : schema.benchmarks;
      await realDb.update(table).set({ platformType: 'google_analytics', alertsEnabled: true, alertThreshold: '80', alertCondition: 'below' });
      if (kind === 'kpi') await ctx.createKPIAlert(await storage.getKPI(id));
      else await ctx.checkBenchmarkPerformanceAlertsForScope('a');
      expect(await ctx.episode(kind, id, 'a')).toMatch(/^active:/);
      expect((await claim()).claimed).toBe(true); expect((await claim()).claimed).toBe(false);
      await invoke(ctx.clear); expect((await claim()).claimed).toBe(false);
    });
  }
  it('legacy soft-hide preserves concurrent resolution', async () => {
    const { id, notification } = await seedAlert(); const ctx = context();
    beforeNotificationWrite = () => ctx.resolveKPIAlerts(id);
    await ctx.softHideNotification(notification, 'owner-a', 'kpi_deleted');
    expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!)).toMatchObject({ resolved: true, dismissalReason: 'kpi_deleted' });
  });
  for (const metadata of [null, '', '{invalid']) for (const action of ['dismiss','clear']) it(`${action} retains legacy empty/malformed metadata handling (${metadata})`, async () => {
    const notification = await storage.createNotification({ title: 'Legacy', message: 'Fixture', type: 'info', campaignId: 'a', metadata });
    const ctx = context(); expect((await invoke(action === 'dismiss' ? ctx.dismiss : ctx.clear, notification.id)).code).toBe(200);
    expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!).dismissedBy).toBe('owner-a');
  });
  it('an expired preparation worker cannot dispatch after another worker takes its claim', async () => {
    await report(); const first = context(), second = context();
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }); const started = new Promise<void>(resolve => { entered = resolve; });
    buildPdf.mockImplementationOnce(async () => { entered(); await gate; return changedPdf; });
    const slow = first.checkScheduledReports(); await started;
    await realDb.update(schema.reportSendEvents).set({ createdAt: new Date(Date.now() - 20 * 60_000) });
    await second.checkScheduledReports(); release(); await slow;
    expect(first.send).not.toHaveBeenCalled(); expect(second.send).toHaveBeenCalledOnce();
    expect(await rows(schema.reportSnapshots)).toHaveLength(1);
    expect(readReportPdfArtifact(JSON.parse((await rows(schema.reportSnapshots))[0].snapshotJson))).toEqual(originalPdf);
  });
  it('retains the first cleared timestamp when a second stale resolver writes', async () => {
    const { id, notification } = await seedAlert(); const ctx = context(); const first = '2026-10-24T09:00:00.000Z';
    beforeNotificationWrite = async () => {
      await realDb.update(schema.notifications).set({ metadata: JSON.stringify({ kpiId: id, resolved: true, resolvedReason: 'cleared', resolvedAt: first }) });
    };
    await ctx.resolveKPIAlerts(id);
    expect(JSON.parse((await storage.getNotification(notification.id))!.metadata!).resolvedAt).toBe(first);
  });
  for (const status of ['pending','failed']) it(`never retries an unmarked legacy ${status} send`, async () => {
    const row = await report();
    await realDb.insert(schema.reportSendEvents).values({ reportId: row.id, status, scheduledKey: '2026-10-25T09:00@Europe/Amsterdam', error: 'Unknown previous send', createdAt: new Date(0) });
    const job = context(); await job.checkScheduledReports(); expect(job.send).not.toHaveBeenCalled();
  });
  it('recovers a provider polling failure after restart without sending again', async () => {
    await report(); delivery.mockRejectedValueOnce(Error('Fixture poll unavailable')); const job = context(); await job.checkScheduledReports();
    expect((await rows(schema.reportSendEvents))[0].status).toBe('pending_delivery');
    const restarted = context(); await restarted.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(restarted.send).not.toHaveBeenCalled(); expect(await rows(schema.reportSnapshots)).toHaveLength(1);
  });
  it('does not resend or publish a provider-confirmed failure', async () => {
    await report(); delivery.mockResolvedValue({ status: 'failed', error: 'rejected' }); const job = context();
    await job.checkScheduledReports(); await realDb.update(schema.reportSendEvents).set({ createdAt: new Date(0) }); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect((await rows(schema.reportSendEvents))[0].status).toBe('failed'); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
  });
  for (const outcome of ['pending','failed']) it(`a stale ${outcome} poll cannot overwrite confirmed delivery`, async () => {
    const row = await report(); delivery.mockResolvedValue({ status: 'pending' }); const job = context(); await job.checkScheduledReports();
    const [event] = await rows(schema.reportSendEvents);
    delivery.mockImplementationOnce(async () => {
      await realDb.update(schema.emailAlertEvents).set({ deliveryStatus: 'delivered', deliveredAt: new Date() }).where(orm.eq(schema.emailAlertEvents.id, event.id));
      return { status: outcome };
    });
    expect((await job.confirmScheduledReportEmailDelivery(row.id, event.id)).sent).toBe(true);
    await job.checkScheduledReports(); expect((await rows(schema.reportSendEvents))[0].status).toBe('sent');
  });
  for (const changed of ['scheduledKey','campaignId','recipients']) it(`recovery rejects mismatched ${changed}`, async () => {
    await report(); delivery.mockResolvedValue({ status: 'pending' }); const job = context(); await job.checkScheduledReports();
    const [audit] = await rows(schema.emailAlertEvents), metadata = JSON.parse(audit.metadata);
    if (changed === 'recipients') await realDb.update(schema.emailAlertEvents).set({ to: 'foreign@example.invalid' });
    else { metadata.snapshotPayload[changed] = 'wrong'; await realDb.update(schema.emailAlertEvents).set({ metadata: JSON.stringify(metadata) }); }
    delivery.mockResolvedValue({ status: 'delivered' }); await job.checkScheduledReports();
    expect(job.send).toHaveBeenCalledOnce(); expect(await rows(schema.reportSnapshots)).toHaveLength(0);
  });
  it('older recovered delivery does not move lastSentAt backwards', async () => {
    const row = await report(); delivery.mockResolvedValue({ status: 'pending' }); const job = context(); await job.checkScheduledReports();
    const newer = new Date('2026-10-25T15:00:00Z');
    await realDb.update(schema.linkedinReports).set({ lastSentAt: newer });
    await realDb.update(schema.emailAlertEvents).set({ deliveryStatus: 'delivered', deliveredAt: new Date('2026-10-24T10:00:00Z') });
    await job.checkScheduledReports(); expect((await storage.getLinkedInReport(row.id))!.lastSentAt).toEqual(newer);
  });
  for (const outcome of ['delivered','pending','failed']) it(`test-send reports exact ${outcome} evidence without a scheduled snapshot`, async () => {
    const row = await report(); delivery.mockResolvedValue({ status: outcome }); const job = context();
    const result = await job.sendTestReport(row.id);
    expect(job.send).toHaveBeenCalledOnce(); expect(result.success).toBe(outcome === 'delivered');
    expect(await rows(schema.reportSnapshots)).toHaveLength(0); expect(await rows(schema.reportSendEvents)).toHaveLength(0);
    expect(delivery.mock.calls[0][0]).toBe(`message-${job.send.mock.calls[0][0].auditContext.auditEventId}`);
  });
});

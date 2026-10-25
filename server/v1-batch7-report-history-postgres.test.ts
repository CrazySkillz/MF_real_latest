import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { request, type Server } from 'node:http';
import express from 'express';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as orm from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import ts from 'typescript';
import * as schema from '../shared/schema';
import { createReportPdfArtifact, readReportPdfArtifact } from './utils/report-pdf-artifact';

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';

// Actual HTTP handlers/access helpers and storage SQL; isolated actor and PDF-builder
// adapters. Synthetic PDF bytes test immutable history, not rendered metric/layout parity.
const runtimeText = (file: string) => process.env.V1_BATCH7_BASELINE === '1'
  ? execFileSync('git', ['show', `4cd498cf:${file}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true })
  : readFileSync(file, 'utf8');
const source = ts.createSourceFile('routes.ts', runtimeText('server/routes-oauth.ts'), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(source));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !declarations.has(node.name.text)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && /^app\.(get|post|patch|delete)$/.test(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) {
    declarations.set(`${node.expression.getText(source).slice(4)} ${node.arguments[0].text}`, `const handler = ${node.arguments.at(-1)!.getText(source)};`);
  }
  ts.forEachChild(node, visit);
}
visit(source);
function bind(name: string, env: Record<string, any>) {
  const declaration = declarations.get(name);
  if (!declaration) throw Error(`Missing ${name}`);
  const js = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(env), `${js}\nreturn ${name.includes(' /api/') ? 'handler' : name};`)(...Object.values(env));
}
const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '55444' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated local database required');
}
const schemaName = `v1_report_history_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.linkedinReports, schema.metaReports, schema.reportSnapshots, schema.reportSendEvents, schema.emailAlertEvents];
const platforms = ['google_analytics', 'campaign_deepdive', 'google_ads', 'linkedin', 'meta', 'instagram', 'tiktok', 'google_sheets', 'custom-integration', 'custom_integration'];
const storage = new DatabaseStorage();
const originalPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(160, 65)]);
const changedPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(160, 66)]);
const buildPdf = vi.fn(async (): Promise<Buffer | null> => originalPdf);
const preflight = vi.fn(async () => ({ ok: true }));
const schedulerSource = ts.createSourceFile('report-scheduler.ts', runtimeText('server/report-scheduler.ts'), ts.ScriptTarget.Latest, true);
const schedulerDeclaration = schedulerSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'checkScheduledReports')!;
function schedulerFixture(deliveryStatus = 'sent') {
  const send = vi.fn(async () => true);
  const code = ts.transpileModule(schedulerDeclaration.getText(schedulerSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const env: Record<string, any> = { db: database.current, storage, ...schema, ...orm, createReportPdfArtifact, readReportPdfArtifact,
    schedulerMetrics: { totalChecks: 0, totalSent: 0, totalFailed: 0 }, SCHEDULED_REPORT_PLATFORM_TYPES: platforms,
    isReportDueNow: () => ({ due: true, scheduledKey: '2026-10-25T09:00@Europe/Amsterdam', tz: 'Europe/Amsterdam' }),
    getScheduledReportAlignedRefreshGate: async () => ({ ready: true }),
    validateInstagramScheduledReportScope: async () => ({ ok: true }), validateTikTokScheduledReportScope: async () => ({ ok: true }),
    isValidScheduledReportRecipient: () => true, getLatestReportEmailError: async () => '',
    preflightGA4ReportKPIConsumers: preflight, parseReportConfiguration: JSON.parse,
    buildPdfAttachmentForReport: buildPdf, platformRequiresSourceBackedReportOutput: () => true,
    sourceBackedReportOutputUnavailableMessage: () => 'PDF unavailable', sendReportEmailWithRetry: send,
    confirmScheduledReportEmailDelivery: async () => ({ sent: deliveryStatus === 'sent', status: deliveryStatus, error: 'Fixture result' }),
    setTimeout: (callback: () => void) => queueMicrotask(callback), console: { log() {}, warn() {}, error() {} } };
  const recovery = schedulerSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'reconcileScheduledReportSend');
  if (recovery) {
    const recoveryCode = ts.transpileModule(recovery.getText(schedulerSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    env.reconcileScheduledReportSend = new Function(...Object.keys(env), `${recoveryCode}\nreturn reconcileScheduledReportSend;`)(...Object.values(env));
  }
  const run = new Function('exports', ...Object.keys(env), `${code}\nreturn checkScheduledReports;`)({}, ...Object.values(env));
  return { run, send };
}
let admin: Pool, pool: Pool, server: Server, port: number, created = false;
async function api(method: string, path: string, body?: unknown, actor = 'owner-a') {
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{ status: number; body: any; bytes: Buffer }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor, ...(encoded === undefined ? {} : { 'content-length': Buffer.byteLength(encoded) }) } }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode!, bytes, body: res.headers['content-type']?.includes('application/json') ? JSON.parse(bytes.toString()) : null }); });
    });
    req.on('error', reject); req.end(encoded);
  });
}
async function report(platformType = 'google_analytics', extra: any = {}) {
  return storage.createLinkedInReport({ campaignId: 'a', platformType, name: 'History fixture', reportType: 'overview', configuration: '{}', ...extra });
}
async function createSnapshot(row: any) {
  const response = await api('POST', `/api/platforms/${row.platformType}/reports/${row.id}/snapshots`);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.snapshot;
}
async function storedSnapshot(row: any, overrides: any = {}, payloadOverrides: any = {}) {
  const payload = { reportId: row.id, campaignId: row.campaignId, platformType: row.platformType, reportType: row.reportType,
    windowStart: '2026-09-25', windowEnd: '2026-10-24', pdfArtifact: createReportPdfArtifact(originalPdf), ...payloadOverrides };
  const [snapshot] = await database.current.insert(schema.reportSnapshots).values({ reportId: row.id, campaignId: row.campaignId, platformType: row.platformType,
    reportType: row.reportType, windowStart: '2026-09-25', windowEnd: '2026-10-24', snapshotJson: JSON.stringify(payload), ...overrides }).returning();
  return snapshot;
}

describe.skipIf(!testUrl)('Batch 7 immutable report history and mutation outcomes', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
    database.current = drizzle(pool, { schema });
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
    const env: Record<string, any> = { storage, z, createReportPdfArtifact, readReportPdfArtifact,
      getAuth: (req: any) => ({ userId: req.headers['x-fixture-actor'] }), isInternalAutoRefreshRequest: () => false,
      require: (name: string) => {
        if (name === './db') return { db: database.current };
        if (name === '../shared/schema') return schema;
        if (name === 'drizzle-orm') return orm;
        if (name === './report-scheduler.js') return { buildPdfAttachmentForReport: buildPdf, preflightGA4ReportKPIConsumers: preflight };
        throw Error(`Unexpected import ${name}`);
      } };
    for (const name of ['getActorId', 'campaignIdSchema', 'ensureCampaignAccess', 'ensurePlatformReportAccess']) env[name] = bind(name, env);
    const app = express(); app.use(express.json());
    for (const name of ['get /api/platforms/:platformType/reports/:reportId/snapshots', 'post /api/platforms/:platformType/reports/:reportId/snapshots',
      'get /api/report-snapshots/:snapshotId', 'get /api/report-snapshots/:snapshotId/pdf', 'patch /api/meta/reports/:reportId', 'delete /api/meta/reports/:reportId']) {
      const [method, path] = name.split(' '); (app as any)[method](path, bind(name, env));
    }
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve)); port = (server.address() as any).port;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end();
  });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${orm.getTableName(table)}"`);
    for (const id of ['a', 'b']) await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR' });
    buildPdf.mockReset().mockResolvedValue(originalPdf); preflight.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.restoreAllMocks());

  for (const platform of platforms) {
    it(`${platform}: scheduled snapshot preserves the exact confirmed attachment`, async () => {
      const row = await report(platform, { scheduleEnabled: true, scheduleRecipients: ['fixture@example.invalid'], status: 'active' });
      const job = schedulerFixture(); await job.run();
      expect(job.send).toHaveBeenCalledOnce();
      const [snapshot] = await database.current.select().from(schema.reportSnapshots);
      expect(snapshot?.reportId).toBe(row.id);
      expect(readReportPdfArtifact(JSON.parse(snapshot.snapshotJson))).toEqual(job.send.mock.calls[0][2].attachment.content);
      buildPdf.mockResolvedValue(changedPdf);
      expect((await api('GET', `/api/report-snapshots/${snapshot.id}/pdf`)).bytes).toEqual(originalPdf);
      await job.run(); expect(job.send).toHaveBeenCalledOnce(); expect(await database.current.select().from(schema.reportSnapshots)).toHaveLength(1);
    });
    it(`${platform}: captures once and keeps exact bytes after template, name, configuration and source changes`, async () => {
      const row = await report(platform); const snapshot = await createSnapshot(row);
      expect(readReportPdfArtifact(JSON.parse(snapshot.snapshotJson))).toEqual(originalPdf);
      await storage.updatePlatformReport(row.id, { name: 'Changed report', reportType: 'insights', configuration: '{"changed":true}' });
      buildPdf.mockResolvedValue(changedPdf);
      const pdf = await api('GET', `/api/report-snapshots/${snapshot.id}/pdf`);
      expect(pdf.status, JSON.stringify(pdf.body)).toBe(200); expect(pdf.bytes).toEqual(originalPdf); expect(buildPdf).toHaveBeenCalledTimes(1);
      expect((await api('GET', `/api/report-snapshots/${snapshot.id}`)).status).toBe(200);
      const updated = await storage.getLinkedInReport(row.id); const next = await createSnapshot(updated);
      expect((await api('GET', `/api/report-snapshots/${next.id}/pdf`)).bytes).toEqual(changedPdf);
      const listed = await api('GET', `/api/platforms/${platform}/reports/${row.id}/snapshots`);
      expect(listed.body.snapshots).toHaveLength(2);
    });
    it(`${platform}: does not regenerate a historical snapshot whose original artifact is missing`, async () => {
      const row = await report(platform); const snapshot = await storedSnapshot(row, {}, { pdfArtifact: undefined });
      const pdf = await api('GET', `/api/report-snapshots/${snapshot.id}/pdf`);
      expect(pdf.status).toBe(422); expect(buildPdf).not.toHaveBeenCalled();
      expect((await api('GET', `/api/report-snapshots/${snapshot.id}`)).status).toBe(200);
    });
    it(`${platform}: failed or invalid PDF cannot create a misleading snapshot`, async () => {
      const row = await report(platform);
      for (const bytes of [null, Buffer.alloc(150, 88)]) {
        buildPdf.mockResolvedValue(bytes);
        expect((await api('POST', `/api/platforms/${platform}/reports/${row.id}/snapshots`)).status).toBe(422);
        expect(await database.current.select().from(schema.reportSnapshots)).toHaveLength(0);
      }
    });
  }
  for (const status of ['pending_delivery', 'failed']) it(`scheduled ${status} never creates sent/downloadable history`, async () => {
    const row = await report('google_sheets', { scheduleEnabled: true, scheduleRecipients: ['fixture@example.invalid'], status: 'active' });
    const job = schedulerFixture(status); await job.run();
    expect(await database.current.select().from(schema.reportSnapshots)).toHaveLength(0);
    expect((await storage.getLinkedInReport(row.id))?.lastSentAt).toBeNull();
    expect((await database.current.select().from(schema.reportSendEvents))[0].status).toBe(status);
  });
  it('invalid scheduled artifact cannot be sent or recorded as sent', async () => {
    await report('google_ads', { scheduleEnabled: true, scheduleRecipients: ['fixture@example.invalid'], status: 'active' });
    buildPdf.mockResolvedValue(Buffer.alloc(150, 88));
    const job = schedulerFixture(); await job.run();
    expect(job.send).not.toHaveBeenCalled(); expect(await database.current.select().from(schema.reportSnapshots)).toHaveLength(0);
  });
  for (const [field, value] of [['campaignId', 'b'], ['platformType', 'google_ads'], ['reportType', 'insights'], ['reportId', 'other'], ['windowEnd', '2026-10-23']]) {
    it(`rejects a stored artifact whose ${field} contradicts its immutable row`, async () => {
      const row = await report(); const snapshot = await storedSnapshot(row, {}, { [field]: value });
      expect((await api('GET', `/api/report-snapshots/${snapshot.id}/pdf`)).status).toBe(404); expect(buildPdf).not.toHaveBeenCalled();
    });
  }
  for (const scenario of ['anonymous', 'foreign-owner', 'missing-parent', 'missing-report', 'wrong-campaign', 'wrong-platform', 'invalid-id']) {
    it(`preserves snapshot JSON/PDF access denial: ${scenario}`, async () => {
      const row = await report(); const snapshot = await storedSnapshot(row, scenario === 'wrong-campaign' ? { campaignId: 'b' } : scenario === 'wrong-platform' ? { platformType: 'google_ads' } : {});
      if (scenario === 'missing-parent') await database.current.delete(schema.campaigns).where(orm.eq(schema.campaigns.id, 'a'));
      if (scenario === 'missing-report') await storage.deletePlatformReport(row.id);
      const id = scenario === 'invalid-id' ? 'not-a-uuid' : snapshot.id;
      const actor = scenario === 'anonymous' ? '' : scenario === 'foreign-owner' ? 'owner-b' : 'owner-a';
      const expected = scenario === 'anonymous' ? 401 : scenario === 'invalid-id' ? 400 : 404;
      for (const suffix of ['', '/pdf']) expect((await api('GET', `/api/report-snapshots/${id}${suffix}`, undefined, actor)).status).toBe(expected);
      expect(buildPdf).not.toHaveBeenCalled();
    });
  }
  it('keeps archived report history available to its owner without generating new data', async () => {
    const row = await report(); const snapshot = await storedSnapshot(row);
    await storage.updatePlatformReport(row.id, { status: 'archived', scheduleEnabled: false });
    expect((await api('GET', `/api/report-snapshots/${snapshot.id}/pdf`)).bytes).toEqual(originalPdf); expect(buildPdf).not.toHaveBeenCalled();
  });
  for (const method of ['PATCH', 'DELETE']) {
    it(`Meta ${method}: reports a row disappearing after access check and preserves other reports`, async () => {
      const row = await storage.createMetaReport({ campaignId: 'a', name: 'Target', template: 'campaign_performance', frequency: 'ad_hoc', recipients: [] });
      const other = await storage.createMetaReport({ campaignId: 'b', name: 'Other', template: 'campaign_performance', frequency: 'ad_hoc', recipients: [] });
      const get = storage.getMetaReportById.bind(storage);
      vi.spyOn(storage, 'getMetaReportById').mockImplementationOnce(async id => { const found = await get(id); await storage.deleteMetaReport(id); return found; });
      expect((await api(method, `/api/meta/reports/${row.id}`, method === 'PATCH' ? { name: 'Changed' } : undefined)).status).toBe(404);
      expect((await get(other.id))?.name).toBe('Other');
      expect((await api(method, `/api/meta/reports/${row.id}`, {})).status).toBe(404);
    });
    it(`Meta ${method}: keeps owned success and foreign/anonymous denial`, async () => {
      const row = await storage.createMetaReport({ campaignId: 'a', name: 'Target', template: 'campaign_performance', frequency: 'ad_hoc', recipients: [] });
      expect((await api(method, `/api/meta/reports/${row.id}`, {}, 'owner-b')).status).toBe(404);
      expect((await api(method, `/api/meta/reports/${row.id}`, {}, '')).status).toBe(401);
      expect((await api(method, `/api/meta/reports/${row.id}`, { name: 'Changed', campaignId: 'b', platformType: 'google_ads' })).status).toBe(200);
      if (method === 'PATCH') expect(await storage.getMetaReportById(row.id)).toMatchObject({ name: 'Changed', campaignId: 'a' });
    });
  }
});

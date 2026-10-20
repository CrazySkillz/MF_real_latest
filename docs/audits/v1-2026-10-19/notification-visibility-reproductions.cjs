const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && ['app.delete', 'app.patch'].includes(n.expression.getText(sf)) && ts.isStringLiteral(n.arguments[0])) routes.set(`${n.expression.name.text} ${n.arguments[0].text}`, n.getText(sf));
  ts.forEachChild(n, visit);
} visit(sf);
function bind(code, name, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env)); }
const ksf = ts.createSourceFile('kpi.ts', fs.readFileSync('server/kpi-notifications.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const resolveCode = ksf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveKPIAlerts').getText(ksf).replace(/^export /, '');
const asf = ts.createSourceFile('alert.ts', fs.readFileSync('server/services/alert-monitoring.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const cls = asf.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'AlertMonitoringService');
const episodeCode = cls.members.find(n => n.name?.getText(asf) === 'getImmediateAlertEpisodeKey').getText(asf);
const schema = Object.fromEntries(['notifications', 'campaigns', 'kpis'].map(table => [table, new Proxy({ table }, { get: (o, key) => key === 'table' ? table : { table, column: key } })]));
const orm = { eq: (a, b) => ['eq', a, b], and: (...conditions) => ['and', ...conditions], inArray: (a, b) => ['in', a, b], isNotNull: a => ['notNull', a] };
function matches(row, predicate) {
  if (!predicate) return true;
  const [op, col, val] = predicate;
  if (op === 'and') return predicate.slice(1).every(p => matches(row, p));
  if (op === 'eq') return row[col.column] === val;
  if (op === 'in') return val.includes(row[col.column]);
  if (op === 'notNull') return row[col.column] != null;
  throw new Error(`Unexpected predicate ${op}`);
}
const paths = ['patch /api/notifications/mark-all-read', 'delete /api/notifications/all/clear', 'delete /api/notifications/:id', 'patch /api/notifications/:id'];
async function run(path, scenario = 'owner', options = {}) {
  const rows = [
    { id: 'own', campaignId: 'campaign-a', read: false, type: 'performance-alert', createdAt: '2026-10-01', metadata: '{"kpiId":"kpi-a"}' },
    { id: 'foreign', campaignId: 'campaign-b', read: false, type: 'performance-alert', createdAt: '2026-10-01', metadata: '{"kpiId":"kpi-b"}' },
    { id: 'own-2', campaignId: 'campaign-a', read: false, type: 'system', createdAt: '2026-10-01', metadata: '{}' },
    { id: 'orphan', campaignId: 'missing', read: false, type: 'system', createdAt: '2026-10-01', metadata: '{}' },
  ];
  const parents = [{ id: 'campaign-a', ownerId: 'owner' }, { id: 'campaign-b', ownerId: 'other' }];
  const data = { notifications: rows, campaigns: parents, kpis: [{ id: 'kpi-a', campaignId: 'campaign-a', alertFrequency: 'immediate', lastAlertSent: null }] };
  let updates = 0, beforeWrite, resolve;
  const db = {
    select: () => ({ from: table => ({ where: async predicate => structuredClone(data[table.table].filter(row => matches(row, predicate))) }) }),
    update: table => ({ set: changes => ({ where: async predicate => {
      if (table.table === 'notifications') {
        if (beforeWrite) { const hook = beforeWrite; beforeWrite = null; await hook(); }
        updates++;
        if (options.failSecond && updates === 2) throw new Error('AUDIT second write failed');
      }
      const changed = data[table.table].filter(row => matches(row, predicate));
      for (const row of changed) Object.assign(row, changes);
      return { rowCount: changed.length };
    } }) }),
  };
  const storage = {
    getCampaign: async id => parents.find(c => c.id === id),
    updateNotification: async (id, changes) => db.update(schema.notifications).set(changes).where(orm.eq(schema.notifications.id, id)),
  };
  const env = { ...schema, ...orm, db, storage, z: require('zod').z, getAuth: () => ({ userId: scenario === 'anonymous' ? null : 'owner' }), isInternalAutoRefreshRequest: () => false, console: { log() {}, warn() {}, error() {} }, require: name => {
    if (name === './db') return { db };
    if (name === '../shared/schema') return schema;
    if (name === 'drizzle-orm') return orm;
    throw new Error(`Unexpected import ${name}`);
  } };
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'notificationMetadata', 'isNotificationDismissed', 'dismissedNotificationMetadata']) env[name] = bind(named.get(name), name, env);
  resolve = bind(resolveCode, 'resolveKPIAlerts', env);
  const episode = bind(`class Fixture { ${episodeCode} };`, 'new Fixture()', env);
  let afterResolve;
  if (options.race) beforeWrite = async () => {
    await resolve('kpi-a');
    afterResolve = { metadata: JSON.parse(rows[0].metadata), episode: await episode.getImmediateAlertEpisodeKey('kpi', 'kpi-a', 'campaign-a') };
  };
  let handler;
  const app = { patch: (_path, callback) => { handler = callback; }, delete: (_path, callback) => { handler = callback; } };
  bind(routes.get(path), 'undefined', { ...env, app });
  const req = { params: { id: scenario === 'foreign' ? 'foreign' : scenario === 'missing-parent' ? 'orphan' : 'own' }, body: { read: true } };
  const res = { code: 200, payload: null, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
  await handler(req, res);
  assert.equal(rows.find(r => r.id === 'foreign').read, false, 'foreign row unchanged');
  assert.equal(rows.find(r => r.id === 'orphan').read, false, 'orphan row unchanged');
  return { status: res.code, response: res.payload, rows, updates, afterResolve, finalEpisode: await episode.getImmediateAlertEpisodeKey('kpi', 'kpi-a', 'campaign-a') };
}
(async () => {
  const results = [];
  for (const path of paths) {
    for (const scenario of ['owner', 'anonymous', ...(path.endsWith('/:id') ? ['foreign', 'missing-parent'] : [])]) {
      const actual = await run(path, scenario);
      assert.equal(actual.status, scenario === 'owner' ? 200 : scenario === 'anonymous' ? 401 : 404);
      if (scenario !== 'owner') assert.equal(actual.updates, 0);
      if (path.includes('mark-all-read') && scenario === 'owner') assert.equal(actual.response.updatedCount, 2);
      results.push({ case: `${path}: ${scenario}`, status: actual.status, writes: actual.updates, response: actual.response, control: 'Foreign and missing-parent rows remain unchanged' });
    }
  }
  for (const path of ['delete /api/notifications/:id', 'delete /api/notifications/all/clear']) {
    const actual = await run(path, 'owner', { race: true });
    assert.equal(actual.afterResolve.metadata.resolved, true);
    assert.ok(actual.afterResolve.episode.startsWith('cleared:own:'));
    const metadata = JSON.parse(actual.rows[0].metadata);
    assert.ok(metadata.dismissedAt); assert.equal(metadata.resolved, undefined);
    assert.equal(actual.finalEpisode, 'active:own');
    results.push({ case: `${path}: dismiss stale read overwrites concurrent resolution`, status: actual.status, afterResolution: actual.afterResolve, finalMetadata: metadata, finalEpisode: actual.finalEpisode, consequence: 'Current email episode selector treats the dismissed record as active again. No actual email sent; eventual delivery suppression depends on existing claims.' });
  }
  const partial = await run('delete /api/notifications/all/clear', 'owner', { failSecond: true });
  assert.equal(partial.status, 500); assert.ok(JSON.parse(partial.rows[0].metadata).dismissedAt); assert.equal(JSON.parse(partial.rows[2].metadata).dismissedAt, undefined);
  results.push({ case: 'Clear-all second-write failure leaves partial soft-hide', status: partial.status, firstHidden: true, secondHidden: false, boundary: 'Retained API; no current client caller found. Request reports failure, no rollback.' });
  fs.writeFileSync(out + 'notification-visibility-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual registered route handlers, owner helpers, KPI resolver and email episode method, transpiled with in-memory predicate-evaluating database. Deterministic interleaving, not a PostgreSQL locking/browser/delivery test. No network, provider, real account or runtime changes.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });

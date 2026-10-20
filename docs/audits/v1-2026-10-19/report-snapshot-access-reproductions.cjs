const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && n.expression.getText(sf) === 'app.get' && ts.isStringLiteral(n.arguments[0])) routes.set(n.arguments[0].text, n.getText(sf));
  ts.forEachChild(n, visit);
} visit(sf);
function bind(code, name, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env)); }
const artifacts = {};
new Function('exports', ts.transpileModule(fs.readFileSync('server/utils/report-pdf-artifact.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(artifacts);
const originalPdf = fs.readFileSync(out + 'sheets-selected-scope-fixture.pdf');
const results = [];
(async () => {
  for (const path of ['/api/report-snapshots/:snapshotId', '/api/report-snapshots/:snapshotId/pdf']) {
    for (const scenario of ['owner', 'anonymous', 'foreign', 'missing-parent', 'missing-report', 'wrong-campaign', 'wrong-platform', 'report-type-edited', 'missing-artifact', 'invalid-id']) {
      const pdfRoute = path.endsWith('/pdf');
      const report = { id: 'report-a', campaignId: 'campaign-a', platformType: 'google_analytics', reportType: scenario === 'report-type-edited' ? 'insights' : 'overview' };
      const snapshot = { id: '11111111-1111-4111-8111-111111111111', reportId: report.id, campaignId: scenario === 'wrong-campaign' ? 'foreign-campaign' : report.campaignId, platformType: scenario === 'wrong-platform' ? 'linkedin' : 'google_analytics', reportType: 'overview', windowStart: '2026-10-01', windowEnd: '2026-10-19', snapshotJson: JSON.stringify(scenario === 'missing-artifact' ? {} : { pdfArtifact: artifacts.createReportPdfArtifact(originalPdf) }) };
      const calls = [];
      const storage = { getLinkedInReport: async id => { calls.push('report'); return scenario === 'missing-report' ? null : report; }, getCampaign: async id => { calls.push('parent'); return scenario === 'missing-parent' ? null : { id, ownerId: 'owner' }; } };
      const db = { select: () => ({ from: () => ({ where: async () => { calls.push('snapshot'); return [snapshot]; } }) }) };
      const env = { storage, z: require('zod').z, getAuth: () => ({ userId: scenario === 'anonymous' ? null : scenario === 'foreign' ? 'other-owner' : 'owner' }), isInternalAutoRefreshRequest: () => false, readReportPdfArtifact: artifacts.readReportPdfArtifact, require: name => {
        if (name === './db') return { db };
        if (name === '../shared/schema') return { reportSnapshots: { id: 'id' } };
        if (name === 'drizzle-orm') return { eq: (a, b) => ({ a, b }) };
        throw Error(`Unexpected import ${name}`);
      } };
      for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'ensurePlatformReportAccess']) env[name] = bind(named.get(name), name, env);
      let handler; bind(routes.get(path), 'undefined', { ...env, app: { get: (_path, fn) => { handler = fn; } } });
      const res = { code: 200, payload: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.payload = body; return this; }, send(body) { this.payload = body; return this; } };
      await handler({ params: { snapshotId: scenario === 'invalid-id' ? 'bad-id' : snapshot.id } }, res);
      const expected = scenario === 'anonymous' ? 401 : scenario === 'invalid-id' ? 400 : ['foreign', 'missing-parent', 'missing-report', 'wrong-campaign', 'wrong-platform'].includes(scenario) || (scenario === 'report-type-edited' && pdfRoute) ? 404 : scenario === 'missing-artifact' && pdfRoute ? 422 : 200;
      assert.equal(res.code, expected, `${path} ${scenario}`);
      if (scenario === 'anonymous' || scenario === 'invalid-id') assert.equal(calls.length, 0);
      if (pdfRoute && res.code === 200) assert.ok(Buffer.isBuffer(res.payload) && res.payload.equals(originalPdf));
      results.push({ case: `${path}: ${scenario}`, status: res.code, calls, byteIdenticalStoredArtifact: pdfRoute && res.code === 200, boundary: scenario === 'owner' ? 'Valid real PDF bytes are fixture content under a GA4 platform row, solely testing retrieval/identity. No metric/platform artifact parity claim.' : scenario === 'report-type-edited' ? 'Only current reportType changes overview to insights; persisted snapshot/owner/campaign/platform/artifact remain unchanged. JSON works, PDF404.' : undefined });
    }
  }
  fs.writeFileSync(out + 'report-snapshot-access-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Two actual registered routes and shared access/artifact helpers. Synthetic identity/storage/database. Existing PDF bytes used only to test immutable byte retrieval. No provider, email, runtime mutation or full HTTP/browser journey.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });

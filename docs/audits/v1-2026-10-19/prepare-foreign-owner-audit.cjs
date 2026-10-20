// Audit-only derivative: preserves exact route/helper extraction and effect traps.
// Every replacement is asserted; no application or authoritative test is changed.
const fs = require('node:fs'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
let source = fs.readFileSync(dir + 'route-entry-boundaries.cjs', 'utf8');
function replace(from, to) {
  assert.equal(source.split(from).length, 2, from);
  source = source.replace(from, to);
}
replace("getAuth: () => ({ userId: null, sessionId: null })", "getAuth: () => ({ userId: 'fixture-owner-a', sessionId: 'fixture-session-a' })");
replace("const fixtureRow = { id: uuid, campaignId: uuid, platformType: 'meta', platform: 'meta' };",
  "const fixtureRow = { id: uuid, campaignId: uuid, reportId: uuid, ownerId: 'fixture-owner-b', platformType: [26509,26564].includes(row.line) ? 'meta' : 'ga4', platform: 'ga4' };");
replace("['getKPI', 'getMetaBenchmarkById', 'getMetaReportById', 'getCustomIntegrationById']",
  "['getCampaign', 'getKPI', 'getBenchmark', 'getMetaBenchmarkById', 'getMetaReportById', 'getCustomIntegrationById', 'getLinkedInImportSession', 'getLinkedInReport', 'getGA4ConnectionById']");
replace("const db = { select: () => ({ from: () => ({ where: async () => { lookupReads.push('db.notification-id-lookup'); return [fixtureRow]; } }) }) };",
  "const db = { select: () => ({ from: () => ({ where: () => { lookupReads.push('db.identity-lookup'); const rows = [fixtureRow]; rows.limit = async () => rows; return rows; } }) }) };");
replace("z: require('zod').z, getAuth:",
  "db, ga4Connections: {id: 'fixture-id', campaignId: 'fixture-campaign'}, eq: () => 'fixture-id-predicate', z: require('zod').z, getAuth:");
replace("return { notifications: { id: 'fixture-notification-column' } };",
  "return { notifications: { id: 'fixture-notification-column' }, reportSnapshots: { id: 'fixture-snapshot-column' } };");
// Routes scoped by the signed-in actor's list need list-filter tests, not a fake
// foreign campaign substituted for an ID lookup.
replace("!r.path.includes('/callback')",
  "!r.path.includes('/callback') && ![2233,2326,2434,7493,7608,7646,8936,8949,8966,8983,9037,10403].includes(r.line)");
replace("result.classification = effects.length ? 'PRE_AUTH_EFFECT_ATTEMPT'",
  "result.classification = effects.length ? 'UNEXPECTED_EFFECT_ATTEMPT'");
replace("assert.ok(results.every(r => ['ANONYMOUS_DENIED','PRODUCTION_ONLY_TEST_ROUTE_DISABLED'].includes(r.classification)), 'Unresolved entry case; inspect captured diagnostics');",
  "// Results are written before assertion so unexpected paths remain inspectable.");
replace("if (row.line === 24420 && res.statusCode === 404 && !effects.length) result.classification = 'PRODUCTION_ONLY_TEST_ROUTE_DISABLED';",
  "if (res.statusCode === 404 && !effects.length && !exception && !errors.length) result.classification = lookupReads.includes('storage.getCampaign') ? 'FOREIGN_PARENT_DENIED' : 'EARLIER_ID_OR_SCOPE_REJECTION';\n  if (row.line === 24420 && res.statusCode === 404 && !effects.length) result.classification = 'PRODUCTION_ONLY_TEST_ROUTE_DISABLED';");
replace("route-entry-boundaries.json", "foreign-owner-entry-boundaries.json");
replace("console.log(JSON.stringify({ probed:",
  "assert.equal(results.length, 284); assert.equal(results.filter(r => r.classification === 'FOREIGN_PARENT_DENIED').length, 283); assert.ok(results.every(r => r.status === 404 && r.effects.length === 0 && !r.exception));\n  console.log(JSON.stringify({ probed:");
replace("OAuth callback capability/state authentication reviewed separately; not ordinary anonymous-session denial.",
  "Callback capability/state or actor-owned global list: separate contract; not this foreign-parent lookup test.");
replace("Each marked noncallback registration executed separately with actual actor/campaign/child guard helpers and anonymous fixture identity. Rate limiters/upload parsers explicitly passthrough. Ten routes may resolve a synthetic child ID before denial; lookupReads records those reads. Notification DB and executive helper module namespace are explicit fixtures. All other storage/network effects throw. A 401 proves only this input reaches denial, not all branches, route-overlap precedence, authenticated tenant/child isolation, CSRF, final-write races or release safety.",
  "Exact noncallback campaign/child registrations with authenticated fixture-owner-a and fixture-owner-b parent/child lookups. Actual actor/campaign/child guard helpers; parser/rate limiter passthrough fixtures. All nonidentity storage/network effects throw. A denial is bounded to the recorded input, not all payload/child/platform branches, full Express precedence, Clerk sessions, provider resource grants or final-write races. Actor-owned global lists and callbacks have separate evidence.");
fs.writeFileSync(dir + 'foreign-owner-entry-boundaries.cjs', source);
console.log('Prepared isolated foreign-parent registration audit.');

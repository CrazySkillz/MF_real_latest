// Evidence allocation, not a source-token-based safety or completeness claim.
const fs = require('node:fs'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
const inventory = JSON.parse(fs.readFileSync(dir + 'inventory.json', 'utf8'));
const anonymous = JSON.parse(fs.readFileSync(dir + 'route-entry-boundaries.json', 'utf8'));
const foreign = JSON.parse(fs.readFileSync(dir + 'foreign-owner-entry-boundaries.json', 'utf8'));
const entries = inventory.routes.filter(r => r.method !== 'USE');
const rules = [
  [/^\/(?:api\/)?health|scheduler|snapshots/, 'OPERATIONS_AND_TEMPLATE.md'],
  [/^\/api\/(?:metrics|performance|integrations)$/, 'ENTRY_PAGES_AND_DASHBOARD_VALUES.md'],
  [/clients|^\/api\/campaigns(?:\/:id)?$|seed-yesop/, 'JOURNEY_RETAINED_SURFACES_AND_SHEETS.md'],
  [/spend|revenue|all-data-sources|daily-financials|outcome-totals/, 'FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md'],
  [/source-damage|retained-source-inventory|disconnected-test-data|duplicates/, 'JOURNEY_RETAINED_SURFACES_AND_SHEETS.md'],
  [/ga4|auth\/google(?:\/|$)/, 'GA4_QUERY_AND_VALUE_TRACE.md'],
  [/google-sheets/, 'ACCOUNT_SHEETS_AND_RETAINED_WRITES.md'],
  [/hubspot|salesforce|shopify/, 'CRM_AND_SHOPIFY_TRACE.md'],
  [/linkedin|instagram|tiktok|meta/, 'UNCONFIGURED_SOURCES_AND_PTOMO.md'],
  [/google-ads/, 'GOOGLE_ADS_CURRENT_VALUES.md'],
  [/kpis|benchmarks|industry-benchmarks/, 'KPI_AND_DIAGNOSTIC_VALUE_TRACE.md'],
  [/notifications|alerts/, 'NOTIFICATION_VISIBILITY_LIFECYCLE.md'],
  [/reports|report-snapshots|custom-report-pdf/, 'REPORT_SNAPSHOT_ACCESS_LIFECYCLE.md'],
  [/custom-integration|sendgrid|mailgun|email\/inbound|webhook|platforms\/:platform\/fields/, 'CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md'],
  [/attribution/, 'AUTHORIZATION_BOUNDARY_TRACE.md'],
  [/executive-summary/, 'EXECUTIVE_SUMMARY_VALUE_INVENTORY.md'],
  [/financial-daily-snapshot|daily-financials|outcome-totals/, 'FINANCIAL_ANALYSIS_VALUE_INVENTORY.md'],
  [/trend-analysis|google-trends/, 'TREND_ANALYSIS_VALUE_INVENTORY.md'],
  [/connected-platforms|connected-data-sources/, 'GA4_OVERVIEW_VALUE_INVENTORY.md'],
  [/auth\/|oauth|transfer-connection/, 'OAUTH_AND_CREDENTIAL_BOUNDARIES.md'],
];
const key = r => `${r.file}:${r.line}`;
const anonByKey = new Map(anonymous.results.map(r => [key(r), r]));
const foreignByKey = new Map(foreign.results.map(r => [key(r), r]));
const rows = entries.map(row => {
  const routePath = row.path.replace(/^["']|["']$/g, '');
  const records = [...new Set(rules.filter(([re]) => re.test(routePath)).map(([, file]) => file))];
  assert.ok(records.length, `No family allocation: ${row.method} ${routePath}`);
  for (const record of records) assert.ok(fs.existsSync(dir + record), record);
  const a = anonByKey.get(key(row)), f = foreignByKey.get(key(row));
  const entryClass = a ? a.classification : routePath.includes('/callback') ? 'CALLBACK_STATE_CAPABILITY_CONTRACT' : 'NO_MARKER_MANUALLY_CLASSIFIED_IN_AUTHORIZATION_TRACE';
  return {
    method: row.method, path: routePath, file: row.file, line: row.line, endLine: row.endLine,
    familyEvidence: records,
    accessEvidence: ['AUTHORIZATION_BOUNDARY_TRACE.md', ...(a ? ['route-entry-boundaries.json'] : []), ...(f ? ['foreign-owner-entry-boundaries.json'] : [])],
    entryClass, anonymousCase: a ? { status: a.status, classification: a.classification } : null,
    foreignOwnerCase: f ? { status: f.status, classification: f.classification } : null,
    disposition: 'Assessed in cited family records; NOT CERTIFIED',
    reviewState: 'PARTIALLY_REVIEWED: exact evidence boundaries in cited records; known failures remain findings',
    unreviewed: 'U: payload/optional child/platform/positive-owner/error and concurrent-write combinations not individually covered by the linked cases require exact post-fix regression acceptance',
    deploymentState: 'E: authenticated deployment/provider acceptance not established by handler fixtures',
    deferredProviderBoundary: /linkedin|instagram|tiktok|meta/.test(routePath)
      ? 'Provider functionality deferred; reachable access/job/simulation/shared-data and mixed included-source effects remain V1 obligations'
      : null,
  };
});
assert.equal(rows.length, 349);
assert.equal(rows.filter(r => r.anonymousCase).length, 296);
assert.equal(rows.filter(r => r.foreignOwnerCase).length, 284);
assert.equal(rows.filter(r => r.entryClass === 'CALLBACK_STATE_CAPABILITY_CONTRACT').length, 9);
assert.equal(rows.filter(r => r.entryClass === 'NO_MARKER_MANUALLY_CLASSIFIED_IN_AUTHORIZATION_TRACE').length, 44);
const output = {
  at: new Date().toISOString(), head: inventory.head,
  purpose: 'Exact 349-registration allocation to existing evidence and explicit residual gates. This overlays the original raw inventory without rewriting its heuristic UNREVIEWED labels into proof.',
  completion: 'Audit assessment delivered; all endpoint registrations allocated; no endpoint family certified',
  counts: { endpoints: rows.length, anonymousCases: 296, authenticatedForeignParentCases: 284, callbacks: 9, otherNoMarkerDeclarations: 44 },
  middleware: inventory.routes.filter(r => r.method === 'USE').map(r => ({
    file: r.file, line: r.line, endLine: r.endLine,
    evidence: ['AUTHORIZATION_BOUNDARY_TRACE.md', 'CONFIGURATION_AND_RECOVERY.md', 'CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md'],
    disposition: 'Current registration/configuration assessed; full session/origin/parser/Express-stack acceptance remains unverified',
  })),
  rows,
};
fs.writeFileSync(dir + 'route-audit-disposition.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output.counts));

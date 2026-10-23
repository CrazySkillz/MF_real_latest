// Production configuration inventory only. No application imports, credentials
// selected from the DB, provider calls, imports, jobs, or writes. No customer
// labels, campaign selections, money values, or raw mappings in the output.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const ts = require('typescript');
const label = process.argv[2] || 'predeploy-compatibility';
assert.match(label, /^[a-z0-9-]+$/);
const manifestName = process.argv[3] || 'assessment.json';
assert.ok(['assessment.json', 'compatibility-assessment.json'].includes(manifestName));
const dir = __dirname, out = path.join(dir, `${label}.json`);
assert.ok(!fs.existsSync(out), 'Preserve previous evidence');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), scope: 'Batch 5 existing configuration compatibility; not deployed/provider release acceptance', productionWrites: false, providerCalls: false, credentialsReadFromDatabase: false };
let db;
const parseConfig = raw => { try { const v = JSON.parse(raw); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };
// Run the exact new cached-value guard without executing the surrounding API.
const routeTree = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
function cacheGuard(provider) {
  let handler;
  function locate(n) { if (ts.isCallExpression(n) && n.expression.getText(routeTree) === 'app.get' && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === `/api/${provider}/:campaignId/pipeline-proxy`) handler = n.arguments.at(-1); ts.forEachChild(n, locate); }
  locate(routeTree); assert.ok(handler);
  const declarations = new Map();
  function collect(n) { if (ts.isVariableDeclaration(n) && ['cached','cachedMode','cachedValueTotals','cachedIsUsable'].includes(n.name.getText(routeTree))) declarations.set(n.name.getText(routeTree), `const ${n.getText(routeTree)};`); ts.forEachChild(n, collect); }
  collect(handler); assert.equal(declarations.size, 4);
  const code = [...declarations.values()].join('\n');
  return new Function('cfg', 'campaign', ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nreturn cachedIsUsable;');
}
const guards = { hubspot: cacheGuard('hubspot'), salesforce: cacheGuard('salesforce') };
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, manifestName), 'utf8'));
  result.candidateManifest = manifestName;
  result.baseHead = manifest.baseHead;
  result.manifestMismatches = manifest.manifest.filter(f => hash(fs.readFileSync(f.file)) !== f.sha256).map(f => f.file);
  assert.deepEqual(result.manifestMismatches, []);
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  result.liveHealth = { status: response.status, ok: health.ok, commit: health.commit, timestamp: health.timestamp || null };
  assert.equal(response.status, 200); assert.equal(health.ok, true); assert.equal(health.commit, result.baseHead);
  const local = parseEnv(fs.readFileSync('.env', 'utf8'));
  result.localShopifyVersionOverride = local.SHOPIFY_API_VERSION || null;
  result.renderShopifyVersionOverride = 'NOT_OBSERVABLE_FROM_LOCAL_ENVIRONMENT';
  result.renderEnvironmentEvidence = JSON.parse(fs.readFileSync(path.join(dir, 'render-environment-confirmation.json'), 'utf8'));
  const url = new URL(local.DATABASE_URL);
  result.databaseTargetSha256 = hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname]));
  const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-3/deployment-2026-10-22/production-after.json', 'utf8'));
  assert.equal(result.databaseTargetSha256, previous.databaseTargetSha256);
  result.samePreviouslyVerifiedDatabase = true;
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-batch5-readonly-compatibility',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000,
    statement_timeout: 10000, query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  result.readOnly = (await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on'; assert.equal(result.readOnly, true);
  const families = ['hubspot','salesforce','shopify'];
  const required = { campaigns: ['id','owner_id','currency','name','status'], revenue_sources: ['id','campaign_id','source_type','platform_context','mapping_config','is_active','currency'],
    revenue_records: ['id','campaign_id','revenue_source_id','currency','source_type','external_id','date'],
    hubspot_connections: ['id','campaign_id','is_active','mapping_config','connected_at'], salesforce_connections: ['id','campaign_id','is_active','mapping_config','connected_at'], shopify_connections: ['id','campaign_id','is_active','mapping_config','connected_at'] };
  const columns = (await db.query('SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=ANY($1)', [Object.keys(required)])).rows;
  result.missingColumns = Object.entries(required).flatMap(([table, names]) => names.filter(name => !columns.some(c => c.table_name === table && c.column_name === name)).map(name => `${table}.${name}`));
  assert.deepEqual(result.missingColumns, []);
  result.connectionCounts = {};
  const connections = [];
  for (const provider of families) {
    const rows = (await db.query(`SELECT i.id, i.campaign_id, i.is_active, i.mapping_config, i.connected_at,
      c.id IS NOT NULL AS parent_exists, c.owner_id IS NOT NULL AS owner_exists, c.status AS parent_status
      FROM ${provider}_connections i LEFT JOIN campaigns c ON c.id=i.campaign_id ORDER BY i.connected_at DESC,i.id LIMIT 5001`)).rows;
    assert.ok(rows.length <= 5000, 'Connection inventory limit exceeded');
    result.connectionCounts[provider] = { total: rows.length, active: rows.filter(r => r.is_active).length,
      orphaned: rows.filter(r => !r.parent_exists).length, ownerless: rows.filter(r => !r.owner_exists).length,
      activeOrphaned: rows.filter(r => r.is_active && !r.parent_exists).length,
      deletedParents: rows.filter(r => r.parent_status === 'deleted').length };
    connections.push(...rows.map(r => ({ ...r, provider })));
  }
  const sources = (await db.query(`SELECT s.id,s.campaign_id,s.source_type,s.platform_context,s.mapping_config,s.is_active,s.currency,
    c.id IS NOT NULL AS parent_exists,c.owner_id IS NOT NULL AS owner_exists,c.currency AS campaign_currency,c.status AS parent_status,
    lower(c.name)='ptomo' AS is_ptomo FROM revenue_sources s LEFT JOIN campaigns c ON c.id=s.campaign_id
    WHERE lower(s.source_type)=ANY($1) ORDER BY s.id LIMIT 5001`, [families])).rows;
  assert.ok(sources.length <= 5000, 'Source inventory limit exceeded');
  result.sourceCounts = families.map(provider => ({ provider, total: sources.filter(s => s.source_type.toLowerCase() === provider).length, active: sources.filter(s => s.source_type.toLowerCase() === provider && s.is_active).length }));
  result.activeSourceChecks = sources.filter(s => s.is_active).map(s => {
    const provider = s.source_type.toLowerCase(), cfg = parseConfig(s.mapping_config);
    const activeConnections = connections.filter(c => c.provider === provider && c.campaign_id === s.campaign_id && c.is_active);
    const proxyConfigured = cfg?.pipelineEnabled === true;
    const oldCached = Number(cfg?.pipelineTotalToDate || 0);
    const oldCacheUsable = !!cfg && Number.isFinite(oldCached) && oldCached >= 0 && cfg.pipelineProxyMode === 'current_stage' && !!cfg.pipelineLastUpdatedAt && !cfg.pipelineWarning && (oldCached === 0 || (Array.isArray(cfg.pipelineValueRevenueTotals) && cfg.pipelineValueRevenueTotals.length > 0));
    const newCacheUsable = !!cfg && !!guards[provider] && guards[provider](cfg, { currency: s.campaign_currency });
    const pipelineCurrencyVerified = !!cfg && (cfg.pipelineCurrency === s.campaign_currency || (cfg.pipelineTotalToDate === 0 && !cfg.pipelineCurrency));
    const selected = Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && cfg.selectedValues.every(v => typeof v === 'string' && !!v.trim());
    return { sourceRef: hash(s.id), campaignRef: hash(s.campaign_id), provider, platform: s.platform_context ?? 'ga4', ptomo: !!s.is_ptomo,
      parentExists: s.parent_exists, ownerExists: s.owner_exists, parentDeleted: s.parent_status === 'deleted', activeConnectionCount: activeConnections.length,
      sourceMappingValid: !!cfg, latestConnectionMappingValid: activeConnections.length ? !!parseConfig(activeConnections[0].mapping_config) : false,
      selectedValuesConfigured: provider === 'shopify' ? null : selected,
      attributionFieldConfigured: provider === 'hubspot' ? !!cfg?.campaignProperty : provider === 'salesforce' ? !!cfg?.campaignField : null,
      explicitHubspotStageSelection: provider === 'hubspot' ? (Array.isArray(cfg?.stageIds) && cfg.stageIds.length > 0 ? (cfg.stageIds.length === 1 && cfg.stageIds[0] === 'closedwon' ? 'LEGACY_CLOSEDWON_ALIAS' : 'EXPLICIT_IDS_REQUIRE_LIVE_METADATA') : 'DERIVE_FROM_LIVE_METADATA') : null,
      stageMetadataVerified: provider === 'hubspot' ? false : null,
      proxyConfigured, oldCacheUsable: proxyConfigured ? oldCacheUsable : null, newCacheUsable: proxyConfigured ? newCacheUsable : null,
      pipelineCurrencyVerified: proxyConfigured ? pipelineCurrencyVerified : null,
      pipelineCurrencyState: proxyConfigured ? !cfg.pipelineCurrency ? 'MISSING' : cfg.pipelineCurrency === s.campaign_currency ? 'MATCHES_CAMPAIGN' : 'DIFFERS_FROM_CAMPAIGN' : null,
      sourceCurrencyMatchesCampaign: s.currency === s.campaign_currency,
      wouldWithholdOldProxyCache: proxyConfigured && oldCacheUsable && (!newCacheUsable || !pipelineCurrencyVerified),
      scope: 'Configuration/guard compatibility only; amount/identity/stage/provider correctness not inferred from persisted aggregates' };
  });
  result.recordCounts = (await db.query(`SELECT lower(r.source_type) AS provider, count(*)::int rows,
    count(*) FILTER (WHERE r.external_id IS NULL)::int without_provider_identity,
    count(*) FILTER (WHERE s.id IS NULL)::int missing_source,
    count(*) FILTER (WHERE s.id IS NOT NULL AND s.campaign_id<>r.campaign_id)::int wrong_campaign,
    count(*) FILTER (WHERE s.is_active)::int active_source_rows
    FROM revenue_records r LEFT JOIN revenue_sources s ON s.id::text=r.revenue_source_id::text
    WHERE lower(r.source_type)=ANY($1) OR lower(s.source_type)=ANY($1) GROUP BY lower(r.source_type) ORDER BY provider`, [families])).rows;
  result.ptomo = (await db.query(`SELECT count(*)::int campaigns,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM revenue_sources s WHERE s.campaign_id=c.id AND lower(s.source_type)=ANY($1) AND s.is_active))::int active_batch5_sources,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM hubspot_connections h WHERE h.campaign_id=c.id AND h.is_active) OR EXISTS (SELECT 1 FROM salesforce_connections f WHERE f.campaign_id=c.id AND f.is_active) OR EXISTS (SELECT 1 FROM shopify_connections p WHERE p.campaign_id=c.id AND p.is_active))::int active_batch5_connections
    FROM campaigns c WHERE lower(c.name)='ptomo'`, [families])).rows[0];
  assert.equal(result.ptomo.campaigns, 1);
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK';
  result.result = 'READ_ONLY_INVENTORY_COMPLETE';
  result.compatibility = !sources.some(s => s.is_active) && !connections.some(c => c.is_active)
    ? 'NO_ACTIVE_CRM_OR_SHOPIFY_CONFIGURATION_DEPENDENCY_FOUND'
    : result.activeSourceChecks.some(s => s.wouldWithholdOldProxyCache || !s.sourceMappingValid || !s.parentExists || !s.ownerExists || !s.activeConnectionCount)
      ? 'EXISTING_CONFIGURATION_REQUIRES_REVIEW' : 'SAVED_CONFIGURATION_CHECKS_PASS_PROVIDER_METADATA_NOT_VERIFIED';
})().catch(error => {
  result.result = 'CHECK_FAILED';
  result.error = { code: error.code || error.name, message: 'Read-only check failed; database and credential details withheld.' };
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  result.completedAt = new Date().toISOString(); fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: result.result, compatibility: result.compatibility, liveHealth: result.liveHealth,
    connectionCounts: result.connectionCounts, sourceCounts: result.sourceCounts, recordCounts: result.recordCounts,
    affectedProxySources: result.activeSourceChecks?.filter(s => s.wouldWithholdOldProxyCache), ptomo: result.ptomo, error: result.error }, null, 2));
});

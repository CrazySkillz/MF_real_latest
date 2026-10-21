// Isolated localhost only. Never loads .env or contacts providers.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { Pool } = require('pg'), { drizzle } = require('drizzle-orm/node-postgres'), orm = require('drizzle-orm');
assert.equal(process.env.DATABASE_URL || '', '');
const url = new URL(process.env.V1_BATCH2_TEST_DATABASE_URL || '');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55443'); assert.equal(url.pathname, '/notifications_test');
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const schema = {};
new Function('exports', 'require', compile(fs.readFileSync('shared/schema.ts', 'utf8')))(schema, require);
const sf = ts.createSourceFile('storage.ts', fs.readFileSync('server/storage.ts', 'utf8'), 99, true);
const cls = sf.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'DatabaseStorage');
const selected = ['cancelCampaignCreation','createCampaign', 'getCampaign', 'deleteClientCascade', 'deleteCampaignChildren', 'deleteCampaignCascade',
  'stageGA4OAuthConnection','getPendingGA4OAuthConnection','cancelGA4OAuthConnection','commitGA4OAuthConnection','withGA4RefreshTransaction','writeGA4RefreshInputChange',
  'upsertGA4DailyMetrics', 'upsertLinkedInDailyMetrics', 'upsertGoogleAdsDailyMetrics', 'upsertMetaDailyMetrics'];
const methods = selected.map(name => { const n = cls.members.find(n => n.name?.getText(sf) === name); assert.ok(n); return n.getText(sf); }).join('\n');
const vault = {};
new Function('exports','require',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault,require);
const hydrate = sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='hydrateDecryptedTokens').getText(sf);
function storage(db) {
  const env = { db, pool:null, ...schema, ...orm, ...vault, console, randomUUID: crypto.randomUUID, GA4_OVERVIEW_LEGACY_IMPORT_START_DATE:'2026-07-02' };
  return new Function(...Object.keys(env), compile(`${hydrate}
class ActualStorage {${methods}}; return new ActualStorage();`))(...Object.values(env));
}
const index = ts.createSourceFile('index.ts', fs.readFileSync('server/index.ts', 'utf8'), 99, true);
let startup, readiness;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(index) === 'setTimeout' && n.arguments[1]?.getText(index) === '5000') startup = n.arguments[0].getText(index);
  if (ts.isCallExpression(n) && n.expression.getText(index) === 'app.use' && n.arguments[0]?.getText(index).includes('if (!applicationReady)')) readiness = n.arguments[0].getText(index);
  ts.forEachChild(n, visit);
}
visit(index); assert.ok(startup); assert.ok(readiness);
function boot(db, failingWorker = false) {
  const calls = [], errors = [], exits = [];
  const env = { db, sql: orm.sql, readFileSync: fs.readFileSync, resolve: path.resolve, port: 0,
    process: { cwd: () => process.cwd(), exit: code => exits.push(code) },
    log() {}, console: { error: (...args) => errors.push(args.map(String).join(' ')) },
    snapshotScheduler: { start: () => { calls.push('snapshots'); if (failingWorker) throw new Error('fixture worker registration failed'); } },
    executiveSummarySnapshotScheduler: { start: () => calls.push('executive') },
  };
  for (const name of ['startKPIScheduler','startReportScheduler','startLinkedInScheduler','startMetaScheduler','startGoogleSheetsTokenScheduler',
    'startDailyAutoRefreshScheduler','startGA4DailyScheduler','startGoogleAdsScheduler','startInstagramScheduler','startTikTokScheduler','startAlertEmailScheduler']) env[name] = () => calls.push(name);
  const target = new Function(...Object.keys(env), compile(`let applicationReady=false; return {run:${startup}, middleware:${readiness}, ready:()=>applicationReady};`))(...Object.values(env));
  return { ...target, calls, errors, exits };
}
const admin = new Pool({ connectionString: url.href }), results = [];
async function scenario(name, fn, historical = false) {
  const ns = 'v1_batch2_' + crypto.randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA "${ns}"`);
  const pool = new Pool({ connectionString: url.href, options: `-c search_path=${ns}`, max: 8, statement_timeout: 20000, lock_timeout: 10000 });
  try {
    if (historical) for (const statement of JSON.parse(fs.readFileSync('docs/audits/v1-2026-10-19/schema-generation.json', 'utf8')).statements) await pool.query(statement);
    await fn({ pool, db: drizzle(pool), ns });
    results.push({ name, result: 'PASS' });
  } finally {
    await pool.end(); assert.match(ns, /^v1_batch2_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA "${ns}" CASCADE`);
  }
}
(async () => {
  try {
    await scenario('Fresh bootstrap, readiness gate, repeated startup and four upsert identities', async ({ pool, db }) => {
      const b = boot(db); let denied, next = 0;
      b.middleware({}, { setHeader() {}, status(code) { denied = code; return this; }, json() {} }, () => next++);
      assert.equal(denied, 503); assert.equal(next, 0);
      await b.run(); assert.equal(b.ready(), true, b.errors.join('\n')); assert.equal(b.calls.length, 13); assert.deepEqual(b.exits, []);
      b.middleware({}, {}, () => next++); assert.equal(next, 1);
      await b.run(); assert.equal(b.ready(), true); assert.deepEqual(b.exits, []);
      for (const table of ['campaigns','metrics','performance_data','integrations']) assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0);
      const store = storage(db);
      for (const [method, row] of [
        ['upsertGA4DailyMetrics', { campaignId:'upsert', propertyId:'123', date:'2026-10-20', sessions:1, revenue:'0' }],
        ['upsertLinkedInDailyMetrics', { campaignId:'upsert', date:'2026-10-20', spend:'1' }],
        ['upsertGoogleAdsDailyMetrics', { campaignId:'upsert', googleCampaignId:'ad1', date:'2026-10-20', spend:'1' }],
        ['upsertMetaDailyMetrics', { campaignId:'upsert', metaCampaignId:'ad1', date:'2026-10-20', spend:'1' }],
      ]) { await store[method]([row]); await store[method]([row]); }
      for (const table of ['ga4_daily_metrics','linkedin_daily_metrics','google_ads_daily_metrics','meta_daily_metrics']) assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 1);
    });
    await scenario('Restart preserves fractional facts, goals and history after all startup DDL', async ({ pool, db }) => {
      const a = boot(db); await a.run(); assert.equal(a.ready(), true, a.errors.join('\n'));
      await pool.query("INSERT INTO campaigns(id,name) VALUES ('fraction','Fraction')");
      await pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,conversions) VALUES ('fraction','123','2026-10-20',0.000075)");
      await pool.query("INSERT INTO kpis(id,name,target_value,current_value,last_computed_value,unit) VALUES ('fraction','Fraction',10,0.000075,0.000075,'count')");
      await pool.query("INSERT INTO kpi_progress(kpi_id,value,rolling_average_7d,rolling_average_30d) VALUES ('fraction',0.000075,0.000075,0.000075)");
      await pool.query("INSERT INTO benchmarks(id,name,platform_type,category,benchmark_value,current_value,unit) VALUES ('fraction','Fraction','google_analytics','conversion',10,0.000075,'count')");
      await pool.query("INSERT INTO benchmark_history(benchmark_id,current_value,benchmark_value,variance) VALUES ('fraction',0.000075,10,-99)");
      const b = boot(db); await b.run(); assert.equal(b.ready(), true, b.errors.join('\n'));
      for (const [table, column] of [['ga4_daily_metrics','conversions'],['kpis','current_value'],['kpis','last_computed_value'],['kpi_progress','value'],['kpi_progress','rolling_average_7d'],['kpi_progress','rolling_average_30d'],['benchmarks','current_value'],['benchmark_history','current_value']]) {
        assert.equal(Number((await pool.query('SELECT '+column+' AS value FROM '+table)).rows[0].value), 0.000075);
      }
    });
    await scenario('Two concurrent fresh boots serialize and leave one consistent schema', async ({ db }) => {
      const a = boot(db), b = boot(db); await Promise.all([a.run(), b.run()]);
      assert.equal(a.ready(), true, a.errors.join('\n')); assert.equal(b.ready(), true, b.errors.join('\n'));
      assert.deepEqual(a.exits, []); assert.deepEqual(b.exits, []);
    });
    await scenario('Historical schema upgrade, TEXT notification replay, retired backfill and historical orphan preservation', async ({ pool, db }) => {
      await pool.query("INSERT INTO campaigns(id,client_id,name,currency,status) VALUES('old','missing-client','Historical','EUR','paused')");
      await pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,revenue) VALUES('old','123','2026-10-20',100)");
      await pool.query("INSERT INTO linkedin_daily_metrics(campaign_id,date,spend) VALUES('old','2026-10-20',20)");
      const b = boot(db); await b.run(); assert.equal(b.ready(), true, b.errors.join('\n'));
      for (let i=0; i<2; i++) for (const file of ['0003_add_kpi_periods_and_notifications_metadata.sql','0006_add_daily_spend_revenue_granularity.sql']) await pool.query(fs.readFileSync('migrations/'+file,'utf8'));
      assert.equal((await pool.query('SELECT count(*)::int n FROM revenue_records')).rows[0].n, 0);
      assert.equal((await pool.query('SELECT count(*)::int n FROM spend_records')).rows[0].n, 0);
      assert.deepEqual((await pool.query("SELECT currency,status,client_id FROM campaigns WHERE id='old'")).rows[0], { currency:'EUR', status:'paused', client_id:'missing-client' });
      await assert.rejects(pool.query("INSERT INTO campaigns(name,client_id) VALUES('new orphan','missing-client')"), e => e.code === '23503');
    }, true);
    await scenario('Duplicate history rejects upgrade atomically without deleting facts or starting workers', async ({ pool, db }) => {
      await pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,revenue) VALUES('duplicate','123','2026-10-20',1),('duplicate','123','2026-10-20',2)");
      const b = boot(db); await b.run(); assert.equal(b.ready(), false); assert.deepEqual(b.exits, [1]); assert.equal(b.calls.length, 0);
      assert.equal((await pool.query('SELECT count(*)::int n FROM ga4_daily_metrics')).rows[0].n, 2);
      assert.equal((await pool.query("SELECT to_regclass('service_account_resource_grants') AS name")).rows[0].name, null);
    }, true);
    await scenario('Incomplete schema fails closed without modifying it', async ({ pool, db }) => {
      await pool.query('CREATE TABLE unrelated_fixture(id text)'); const b = boot(db); await b.run();
      assert.equal(b.ready(), false); assert.equal(b.calls.length, 0); assert.deepEqual(b.exits, [1]);
      assert.equal((await pool.query("SELECT to_regclass('campaigns') AS name")).rows[0].name, null);
    });
    await scenario('Worker registration failure never enables readiness', async ({ db }) => {
      const b = boot(db, true); await b.run(); assert.equal(b.ready(), false); assert.deepEqual(b.exits, [1]); assert.equal(b.calls.length, 1);
    });
    await scenario('Create/delete ordering, owner isolation, lost-response idempotency and child rollback', async ({ pool, db }) => {
      const b = boot(db); await b.run(); assert.equal(b.ready(), true, b.errors.join('\n')); const store = storage(db);
      await pool.query("INSERT INTO clients(id,owner_id,name) VALUES('client','owner','Fixture'),('other','other-owner','Other')");
      const input = { ownerId:'owner', clientId:'client', name:'Draft', status:'draft', currency:'EUR' }, requestId = crypto.randomUUID();
      const same = await Promise.all([store.createCampaign(input, requestId), store.createCampaign(input, requestId)]);
      assert.equal(same[0].id, same[1].id);
      assert.equal((await storage(drizzle(pool)).createCampaign(input, requestId)).id, requestId);
      await assert.rejects(store.createCampaign({ ...input, clientId:'other', ownerId:'other-owner' }, requestId), /CONFLICT/);
      await assert.rejects(store.createCampaign({ ...input, ownerId:'other-owner' }), /CLIENT_NOT_FOUND/);
      assert.equal(await store.deleteClientCascade('other-owner', 'client'), false);
      const child = store.deleteCampaignChildren.bind(store);
      store.deleteCampaignChildren = async () => { throw new Error('fixture child failure'); };
      await assert.rejects(store.deleteClientCascade('owner','client'), /fixture child failure/);
      assert.equal((await pool.query("SELECT count(*)::int n FROM clients WHERE id='client'")).rows[0].n,1);
      store.deleteCampaignChildren = child;
      // An existing creation lock must finish before deletion enumerates its children.
      const lock = await pool.connect(); await lock.query('BEGIN'); await lock.query("SELECT id FROM clients WHERE id='client' FOR KEY SHARE");
      let finished = false; const deletion = store.deleteClientCascade('owner','client').then(v => { finished = true; return v; });
      await store.createCampaign({ ...input, name:'Concurrent child' }); assert.equal(finished,false);
      await lock.query('COMMIT'); lock.release(); assert.equal(await deletion,true);
      assert.equal((await pool.query("SELECT count(*)::int n FROM campaigns WHERE client_id='client'")).rows[0].n,0);
      await assert.rejects(store.createCampaign(input), /CLIENT_NOT_FOUND/);
      assert.equal((await pool.query("SELECT count(*)::int n FROM clients WHERE id='other'")).rows[0].n,1);
      // Delete-first ordering blocks an incoming create, which fails after the parent disappears.
      await pool.query("INSERT INTO clients(id,owner_id,name) VALUES('delete-first','owner','Fixture')");
      const row = await store.createCampaign({ ...input, clientId:'delete-first' });
      let entered; const locked = new Promise(resolve => entered=resolve); let release; const hold = new Promise(resolve => release=resolve);
      store.deleteCampaignChildren = async (id,tx) => { if(id===row.id){entered();await hold;} return child(id,tx); };
      const deletes = store.deleteClientCascade('owner','delete-first'); await locked;
      const incoming = store.createCampaign({ ...input, clientId:'delete-first' }).then(() => 'unexpected', error => error.message);
      release(); assert.equal(await deletes,true); assert.equal(await incoming,'CAMPAIGN_CLIENT_NOT_FOUND');
    });
    await scenario('Cancellation tombstone defeats delayed creation and preserves active/accepted imports', async ({ pool, db }) => {
      const b=boot(db); await b.run(); assert.equal(b.ready(),true,b.errors.join('\n'));
      await pool.query("INSERT INTO clients(id,owner_id,name) VALUES('cancel-client','owner','Fixture')");
      const store=storage(db), input={clientId:'cancel-client',ownerId:'owner',name:'Draft',status:'draft'};
      const cancelled=crypto.randomUUID();
      assert.equal(await store.cancelCampaignCreation('other','cancel-client',cancelled),false);
      assert.equal(await store.cancelCampaignCreation('owner','cancel-client',cancelled),true);
      await assert.rejects(store.createCampaign(input,cancelled),/DRAFT_CANCELLED/);
      assert.equal(await store.getCampaign(cancelled),undefined);
      const concurrent=crypto.randomUUID();let entered,release;
      const ready=new Promise(r=>entered=r), hold=new Promise(r=>release=r);
      const slow=storage({transaction:fn=>db.transaction(async tx=>{const value=await fn(tx);entered();await hold;return value;})});
      const creating=slow.createCampaign(input,concurrent);await ready;
      let done=false; const cancellation=store.cancelCampaignCreation('owner','cancel-client',concurrent).then(v=>{done=true;return v;});
      assert.equal(done,false);release();await creating;assert.equal(await cancellation,true);
      assert.equal(await store.getCampaign(concurrent),undefined);await assert.rejects(store.createCampaign(input,concurrent),/DRAFT_CANCELLED/);
      const active=crypto.randomUUID();await store.createCampaign(input,active);await pool.query("UPDATE campaigns SET status='active' WHERE id=$1",[active]);
      await assert.rejects(store.cancelCampaignCreation('owner','cancel-client',active),/NO_LONGER_DRAFT/);
      assert.equal((await store.getCampaign(active)).status,'active');
      const accepted=crypto.randomUUID();await store.createCampaign(input,accepted);
      await pool.query("INSERT INTO ga4_refresh_work(campaign_id,due_at,reporting_date,scope,scope_hash) VALUES($1,NOW(),'2026-10-20','{\"kind\":\"initial_import\"}','fixture')",[accepted]);
      await assert.rejects(store.cancelCampaignCreation('owner','cancel-client',accepted),/NO_LONGER_DRAFT/);
      assert.equal((await store.getCampaign(accepted)).status,'draft');
      const retired=crypto.randomUUID();await store.createCampaign(input,retired);await store.deleteCampaignCascade(retired);
      await assert.rejects(store.createCampaign(input,retired),/REQUEST_RETIRED/);
    });
    await scenario('Staged GA4 authorization, cancel, restart, expiry, isolation, commit and preserved history', async ({ pool, db }) => {
      const b=boot(db); await b.run(); assert.equal(b.ready(),true,b.errors.join('\n'));
      await pool.query("INSERT INTO campaigns(id,owner_id,name) VALUES('ga4','owner','Fixture'),('other-ga4','other','Other')");
      let store=storage(db);
      const input={campaignId:'ga4',propertyId:'',method:'access_token',accessToken:'fixture-access',refreshToken:'fixture-refresh',clientSecret:'fixture-secret'};
      const first=await store.stageGA4OAuthConnection(input);
      assert.equal(first.isActive,false); assert.equal(first.isPrimary,false);
      const persisted=(await pool.query('SELECT * FROM ga4_connections WHERE id=$1',[first.id])).rows[0];
      assert.equal(persisted.access_token,null); assert.equal(persisted.refresh_token,null); assert.equal(persisted.client_secret,null);
      assert.ok(persisted.encrypted_tokens); assert.equal(JSON.stringify(persisted).includes('fixture-access'),false);
      const original=await store.commitGA4OAuthConnection('ga4',first.id,'123','Original','2026-09-04');
      await pool.query("INSERT INTO ga4_overview_snapshots(campaign_id,property_id,window_start,window_end,campaign_breakdown,landing_pages,conversion_events) VALUES('ga4','123','2026-09-04','2026-10-20','{}','{}','{}')");
      await pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,revenue) VALUES('ga4','123','2026-09-04',20)");
      const pending=await store.stageGA4OAuthConnection({...input,accessToken:'replacement'});
      assert.equal((await pool.query("SELECT property_id FROM ga4_connections WHERE is_active=true")).rows[0].property_id,'123');
      assert.equal((await pool.query('SELECT count(*)::int n FROM ga4_overview_snapshots')).rows[0].n,1);
      assert.equal(await store.cancelGA4OAuthConnection('other-ga4',pending.id),false);
      assert.equal(await store.getPendingGA4OAuthConnection('other-ga4',pending.id),undefined);
      await assert.rejects(store.commitGA4OAuthConnection('other-ga4',pending.id,'123','Bad','2026-10-01'),/PENDING_EXPIRED/);
      store=storage(db); assert.equal((await store.getPendingGA4OAuthConnection('ga4')).id,pending.id);
      assert.equal(await store.cancelGA4OAuthConnection('ga4',pending.id),true);
      assert.equal(await store.cancelGA4OAuthConnection('ga4',original.id),false);
      const same=await store.stageGA4OAuthConnection({...input,accessToken:'same-property-replacement'});
      const saved=await store.commitGA4OAuthConnection('ga4',same.id,'123','Renamed','2026-10-01');
      assert.equal(saved.id,original.id); assert.equal(saved.importStartDate,'2026-09-04'); assert.equal(saved.accessToken,'same-property-replacement');
      assert.equal((await pool.query('SELECT count(*)::int n FROM ga4_overview_snapshots')).rows[0].n,1);
      const expired=await store.stageGA4OAuthConnection(input); await pool.query("UPDATE ga4_connections SET connected_at=NOW()-INTERVAL '31 minutes' WHERE id=$1",[expired.id]);
      assert.equal(await store.getPendingGA4OAuthConnection('ga4'),undefined);
      await assert.rejects(store.commitGA4OAuthConnection('ga4',expired.id,'456','Expired','2026-10-01'),/PENDING_EXPIRED/);
      const a=await store.stageGA4OAuthConnection(input), replacement=await store.stageGA4OAuthConnection(input);
      await assert.rejects(store.commitGA4OAuthConnection('ga4',a.id,'456','Stale','2026-10-01'),/PENDING_EXPIRED/);
      const changed=await store.commitGA4OAuthConnection('ga4',replacement.id,'456','Changed','2026-10-01');
      assert.equal(changed.id,original.id); assert.equal(changed.importStartDate,'2026-10-01');
      assert.equal((await pool.query('SELECT count(*)::int n FROM ga4_overview_snapshots')).rows[0].n,0);
      assert.equal((await pool.query('SELECT count(*)::int n FROM ga4_daily_metrics')).rows[0].n,1);
      await assert.rejects(store.stageGA4OAuthConnection({...input,campaignId:'missing'}),/CAMPAIGN_NOT_FOUND/);
    });
    const missing = boot(null); await missing.run(); assert.equal(missing.ready(),false); assert.deepEqual(missing.exits,[1]);
    results.push({name:'Missing database configuration fails closed',result:'PASS'});
  } finally {
    fs.writeFileSync('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/startup-results.json',JSON.stringify({at:new Date().toISOString(),base:'aee04e5 with uncommitted Batch 3 candidate',boundary:'Actual startup callback and storage methods with real isolated PostgreSQL; all worker/provider calls stubbed, no production requests',results},null,2)+'\n');
    await admin.end();
  }
  console.log(JSON.stringify({cases:results.length,passed:results.length}));
})().catch(error => { console.error(error); process.exitCode=1; });

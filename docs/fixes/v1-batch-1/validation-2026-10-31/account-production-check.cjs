// Baseline is READ ONLY. Cleanup requires a completed exact-ID browser receipt,
// an independent baseline, a passing dry run and an explicit --commit argument.
// Does not import the application, provider code or storage/token hydration.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{Client}=require('pg');
const {tables,cleanup}=require('./account-fixture-cleanup.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const target='073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0';
const ownerHash='1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096';
const protectedIds=['b74f98af-ede9-47af-9b19-0720ebb4d2c0','36631f9f-5f32-4ae6-8d20-d8430abb364c'];
const mode=process.argv[2]||'baseline';
assert.ok(['baseline','cleanup'].includes(mode));
const commit=mode==='cleanup'&&process.argv.includes('--commit');
const receipt={at:new Date().toISOString(),mode,commitRequested:commit,databaseWritesAttempted:false,providerCalls:0,secretValuesEmitted:false};
let client;
(async()=>{
  const url=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])),target);
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])url.searchParams.delete(key);
  client=new Client({connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'batch1-account-acceptance',options:mode==='baseline'?'-c default_transaction_read_only=on':undefined,connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000});
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  const campaigns=(await client.query('SELECT id,name,status,owner_id,client_id FROM campaigns WHERE id=ANY($1::text[]) OR name=$2 ORDER BY id',[protectedIds,'V1 Batch 5 Test'])).rows;
  assert.equal(campaigns.length,3);
  const test=campaigns.find(x=>x.id===protectedIds[1]);assert.equal(test.name,'Batch 1 Provider Check');assert.equal(hash(test.owner_id),ownerHash);
  assert.ok(campaigns.every(x=>x.status==='active'&&x.client_id&&x.owner_id));
  const promo=campaigns.find(x=>x.id===protectedIds[0]);assert.equal(promo.owner_id,'user_3K7q6o5pF0aykjIQSHy5O7mVi2U');
  receipt.protectedCampaigns=campaigns.map(x=>({id:x.id,name:x.name,status:x.status,ownerHash:hash(x.owner_id),clientId:x.client_id}));
  receipt.targetFingerprint=target;receipt.secondaryOwnerHash=ownerHash;
  if(mode==='baseline'){
    receipt.baseline={};
    for(const [name,table]of Object.entries(tables))receipt.baseline[name]=(await client.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map(x=>x.id);
    receipt.existingFixtureCounts=(await client.query("SELECT 'metrics' AS kind,count(*)::int AS n FROM metrics WHERE name LIKE 'B1_ACCESS_%' UNION ALL SELECT 'models',count(*)::int FROM attribution_models WHERE name LIKE 'B1_ACCESS_%' UNION ALL SELECT 'journeys',count(*)::int FROM customer_journeys WHERE customer_id LIKE 'B1_ACCESS_%'")).rows;
    assert.ok(receipt.existingFixtureCounts.every(x=>x.n===0),'Prior partial fixture must be reviewed before a new run');
    receipt.databaseReadOnly=true;
    await client.query('ROLLBACK');receipt.rolledBack=true;receipt.result='PASS_BASELINE';
  }else{
    await client.query('ROLLBACK');
    const [baselineFile,manifestFile,dryRunFile]=process.argv.slice(3).filter(x=>x!=='--commit');
    const baselineBytes=fs.readFileSync(baselineFile), baseline=JSON.parse(baselineBytes);
    const manifestBytes=fs.readFileSync(manifestFile), manifest=JSON.parse(manifestBytes);
    assert.equal(baseline.result,'PASS_BASELINE');assert.equal(baseline.targetFingerprint,target);assert.equal(baseline.secondaryOwnerHash,ownerHash);
    assert.equal(manifest.batch1AccountBundle,'PASS_RECHECK');assert.equal(manifest.account,'Second account');
    assert.ok(manifest.checks?.length>0&&manifest.checks.every(x=>x.passed));
    receipt.baselineSha256=hash(baselineBytes);receipt.manifestSha256=hash(manifestBytes);
    if(commit){
      const dry=JSON.parse(fs.readFileSync(dryRunFile));
      assert.equal(dry.result,'PASS_CLEANUP_REHEARSAL');assert.equal(dry.commitRequested,false);
      assert.equal(dry.baselineSha256,receipt.baselineSha256);assert.equal(dry.manifestSha256,receipt.manifestSha256);assert.equal(dry.targetFingerprint,target);
    }
    receipt.databaseWritesAttempted=true;
    receipt.cleanup=await cleanup(client,manifest,test.owner_id,baseline.baseline,commit);
    receipt.result=commit?'PASS_EXACT_FIXTURE_CLEANUP':'PASS_CLEANUP_REHEARSAL';
    receipt.limits='Exact synthetic rows only. No historical cleanup, provider tokens, campaign records or report objects changed. Failed guards roll back.';
  }
})().catch(error=>{receipt.result='NOT_VERIFIED';receipt.errorCode=error.code||error.name;process.exitCode=1;})
.finally(async()=>{
  if(client)await client.end().catch(()=>{});
  const filename=`account-${mode}-${receipt.at.replace(/[:.]/g,'-')}.json`;
  fs.writeFileSync(path.join(__dirname,filename),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({result:receipt.result,mode,commitRequested:commit,filename,errorCode:receipt.errorCode||null}));
});

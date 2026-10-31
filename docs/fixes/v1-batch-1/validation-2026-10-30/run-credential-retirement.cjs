// --preflight is database-enforced READ ONLY. --execute-approved requires explicit live-scope approval.
// Clears only the three legacy credential columns (Shopify: access token only); never deletes rows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseEnv}=require('node:util'),{spawnSync}=require('node:child_process'),{Client}=require('pg');
const {tables,hash,read,candidates,publicGroups,assertExpected,retireWithinTransaction}=require('./credential-retirement.cjs');
const mode=process.argv[2];assert.ok(['--preflight','--execute-approved'].includes(mode));
const execute=mode==='--execute-approved',privateRoot=path.resolve('audit-temp/v1-batch8-render-restore-private-20261029');
const receipt={startedAt:new Date().toISOString(),mode,databaseWritesAttempted:false,committed:false,secretValuesEmitted:false,providerCalls:false,applicationKeyUsed:false};let db,backupKey;
const output=path.join(__dirname,execute?'credential-retirement-live.json':'credential-retirement-preflight-'+receipt.startedAt.replace(/[:.]/g,'-')+'.json');
function recover(){
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k)));
  const cmd="Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))";
  const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{env,input:fs.readFileSync(path.join(privateRoot,'backup-key.dpapi')).toString('base64'),encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(r.status,0,'BACKUP_KEY_RECOVERY_FAILED');backupKey=Buffer.from(r.stdout.trim(),'base64');assert.equal(backupKey.length,32);
  const b=fs.readFileSync(path.join(privateRoot,'batch1-credential-retirement-20261030.json.aes'));assert.equal(hash(b),'d956da705de4ffc0e32d1805fde14e67a9c92bfe7b75816c58f3ace09cbe1101');
  const d=crypto.createDecipheriv('aes-256-gcm',backupKey,b.subarray(0,12));d.setAuthTag(b.subarray(-16));const plain=Buffer.concat([d.update(b.subarray(12,-16)),d.final()]),snapshot=JSON.parse(plain.toString('utf8'));plain.fill(0);return snapshot;
}
function saveProof(data){
  const plain=Buffer.from(JSON.stringify(data)),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',backupKey,iv);
  const b=Buffer.concat([iv,c.update(plain),c.final(),c.getAuthTag()]);plain.fill(0);
  fs.writeFileSync(path.join(privateRoot,'batch1-credential-retirement-before-proof-20261030.json.aes'),b,{flag:'wx'});return hash(b);
}
async function metadata(snapshot){
  const cols=(await db.query("SELECT table_name,column_name,udt_name,is_nullable,column_default,ordinal_position FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;assert.deepEqual(cols,snapshot.columns,'SCHEMA_CHANGED');
  const fn=(await db.query("SELECT p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='enforce_and_audit_ga4_connection_lifecycle'")).rows;assert.deepEqual(fn,snapshot.functions,'TRIGGER_FUNCTION_CHANGED');
  const triggers=(await db.query("SELECT t.tgname name,c.relname table_name,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname=ANY($1::text[]) ORDER BY c.relname,t.tgname",[tables])).rows;
  assert.deepEqual(triggers,[{name:'ga4_connection_lifecycle_guard',table_name:'ga4_connections',definition:'CREATE TRIGGER ga4_connection_lifecycle_guard BEFORE INSERT OR DELETE OR UPDATE ON public.ga4_connections FOR EACH ROW EXECUTE FUNCTION enforce_and_audit_ga4_connection_lifecycle()'}],'TRIGGERS_CHANGED');
  const flags=(await db.query("SELECT c.relname,c.relkind,c.relrowsecurity,EXISTS(SELECT 1 FROM pg_rewrite r WHERE r.ev_class=c.oid AND r.rulename<>'_RETURN') has_rule FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname",[tables])).rows;
  assert.equal(flags.length,5);assert.ok(flags.every(r=>r.relkind==='r'&&!r.relrowsecurity&&!r.has_rule),'UNEXPECTED_TABLE_BEHAVIOR');
}
(async()=>{
  assert.ok(!fs.existsSync(output),'EXECUTION_RECEIPT_ALREADY_EXISTS');
  const tests=JSON.parse(fs.readFileSync(path.join(__dirname,'credential-retirement-local.json')));assert.equal(tests.result,'PASS');assert.equal(tests.checks.length,14);assert.equal(tests.clusterStopped,true);
  const snapshot=recover(),selected=candidates(snapshot.data);assert.equal(Object.values(selected).flat().length,223);
  const health=await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(15000)}),h=await health.json();assert.equal(health.status,200);assert.equal(h.ok,true);assert.equal(h.commit,'d2fba5300e68763ce5391133db967ef4c59dc465');receipt.deployedCommit=h.commit;
  const url=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])),'073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for(const k of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])url.searchParams.delete(k);
  const config={connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'batch1-credential-retirement',options:'-c default_transaction_read_only=on',connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000,idle_in_transaction_session_timeout:20000};
  db=new Client(config);await db.connect();
  await db.query(execute?'BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only,execute?'off':'on');
  await db.query("SET LOCAL timezone='UTC'");await db.query("SET LOCAL lock_timeout='2s'");await db.query("SET LOCAL transaction_timeout='45s'");
  await metadata(snapshot);
  if(!execute){
    const current=await read(db),actual=candidates(current);assert.deepEqual(publicGroups(actual),publicGroups(selected));
    for(const t of tables)assert.deepEqual(actual[t].map(r=>r.raw),selected[t].map(r=>r.raw),'CANDIDATE_VALUES_CHANGED');
    await db.query('ROLLBACK');receipt.databaseReadOnly=true;receipt.candidates=223;receipt.result='PASS';return;
  }
  receipt.databaseWritesAttempted=true;
  const outcome=await retireWithinTransaction(db,snapshot.data);assert.equal(outcome.changed,223);
  receipt.encryptedBeforeProofSha256=saveProof(outcome.before);
  await db.query('COMMIT');receipt.committed=true;receipt.changedRows=outcome.changed;
  await db.end();db=new Client(config);await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL timezone='UTC'");
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  const after=await read(db);assertExpected(outcome.before,after,outcome.selected);assert.equal(Object.values(candidates(after)).flat().length,0);await db.query('ROLLBACK');
  receipt.independentVerification=true;receipt.remainingPlaintextCandidates=0;receipt.preservedTables=Object.keys(after);receipt.result='PASS';
})().catch(async e=>{if(db&&!receipt.committed)await db.query('ROLLBACK').catch(()=>{});receipt.result=receipt.committed?'COMMITTED_VERIFICATION_INCOMPLETE':'ERROR_ROLLED_BACK';receipt.errorCode=e.code||e.name;process.exitCode=1;}).finally(async()=>{
  if(db)await db.end().catch(()=>{});if(backupKey)backupKey.fill(0);receipt.finishedAt=new Date().toISOString();
  if(!fs.existsSync(output))fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
});

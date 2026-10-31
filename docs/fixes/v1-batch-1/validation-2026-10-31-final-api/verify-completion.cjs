// Evidence/document consistency only; no database, provider, application startup or Git writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{parseEnv}=require('node:util');
const base=__dirname,read=n=>JSON.parse(fs.readFileSync(path.join(base,n),'utf8'));
const m=read('manifest.json'),u=read('user-result.json'),inspect=read('inspect.json'),rehearsal=read('cleanup-rehearsal.json'),cleanup=read('cleanup.json'),verified=read('verify-cleanup.json');
assert.equal(u.batch1FinalApi,'PASS_FINAL_API');assert.equal(u.run,m.run);assert.equal(u.checks.length,18);assert.ok(u.checks.every(x=>x.passed===true));
for(const[k,id]of Object.entries(m.ids))assert.equal(u.ids[k],id);
for(const r of [inspect,rehearsal,cleanup]){assert.equal(r.result,'PASS');assert.equal(r.run,m.run);assert.equal(r.execution.rows,9);assert.deepEqual(r.execution.sourceIds,[u.ids.source]);assert.deepEqual(r.execution.resultIds,[u.ids.result]);assert.deepEqual(r.execution.recordIds,inspect.execution.recordIds)}
assert.equal(rehearsal.execution.committed,false);assert.equal(cleanup.execution.committed,true);assert.equal(cleanup.execution.outsideRowsUnchanged,true);
assert.equal(verified.result,'PASS');assert.equal(verified.independentConnection,true);assert.equal(verified.exactFixtureAbsent,true);assert.equal(verified.databaseWritesAttempted,false);assert.equal(verified.existingOwnerModels,0);assert.deepEqual(verified.manifest,m);
assert.deepEqual(verified.protectedCampaigns,read('preflight.json').protectedCampaigns);assert.ok(verified.protectedCampaigns.every(x=>x.status==='active'));
const original=read('rehearsal.json');for(const[f,h]of Object.entries(original.appHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h,`Runtime changed: ${f}`);
const batchFile='docs/fixes/v1-batch-1/README.md',ledgerFile='docs/fixes/v1-batch-1/CONSOLIDATED_CLOSEOUT_2026-10-31.md',queueFile='docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md';
const batch=fs.readFileSync(batchFile,'utf8'),ledger=fs.readFileSync(ledgerFile,'utf8'),queue=fs.readFileSync(queueFile,'utf8');
const rows=[...batch.matchAll(/^\| \[(V1-\d+)\]\(#[^)]+\) \|[^\n]+\| (CLOSED|OPEN) \|$/gm)];assert.equal(rows.length,20);assert.equal(rows.filter(x=>x[2]==='CLOSED').length,14);
const open=rows.filter(x=>x[2]==='OPEN').map(x=>x[1]);assert.deepEqual(open,['V1-008','V1-054','V1-075','V1-078','V1-088','V1-123']);
for(const r of rows){assert.ok(ledger.includes(`| ${r[1]} | ${r[2]} |`));const section=batch.split(`### ${r[1]}\n`)[1]?.split('\n### ')[0];assert.ok(section?.includes(`**Release acceptance:** ${r[2]}.`),`Section status mismatch: ${r[1]}`)}
const all=[...queue.matchAll(/^\| \[(V1-\d+)\]\([^\n]+?\) \| P\d \| \d+ \| [^|]+ \| (OPEN|CLOSED|DEFERRED) \|/gm)];assert.equal(all.length,130);assert.equal(new Set(all.map(x=>x[1])).size,130);
const counts=Object.fromEntries(['OPEN','DEFERRED','CLOSED'].map(s=>[s,all.filter(x=>x[2]===s).length]));assert.deepEqual(counts,{OPEN:105,DEFERRED:10,CLOSED:15});
for(const r of rows)assert.equal(all.find(x=>x[1]===r[1])?.[2],r[2],`Queue status mismatch: ${r[1]}`);
const docs=[batchFile,ledgerFile,queueFile,'docs/V1_RELEASE_READINESS.md','docs/fixes/v1-batch-1/FINAL_API_ACCEPTANCE_2026-10-31.md','docs/fixes/v1-batch-1/CONNECTOR_CONTEXT_FOLLOWUP_2026-10-31.md'];
let links=0;for(const file of docs)for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){const target=match[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;assert.ok(fs.existsSync(path.resolve(path.dirname(file),target)),`Missing link in ${file}: ${target}`);links++}
const files=[...docs,...['live.cjs','verify-completion.cjs','user-result.json','inspect.json','cleanup-rehearsal.json','cleanup.json','verify-cleanup.json','verify-cleanup-type-check-failure.json'].map(n=>path.join(base,n))];
const secrets=Object.entries(parseEnv(fs.readFileSync('.env','utf8'))).filter(([k,v])=>/SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL/i.test(k)&&v.length>=12).map(([,v])=>v);
for(const f of files){const content=fs.readFileSync(f,'utf8');assert.ok(!secrets.some(v=>content.includes(v)),`Private environment value in candidate file: ${path.basename(f)}`)}
const receipt={at:new Date().toISOString(),result:'PASS',userReportedApiChecks:18,independentlyVerifiedFixtureRows:9,cleanupCommitted:true,freshReadOnlyAbsenceCheck:true,batch1:{closed:14,open:6,remaining:open},wholeApp:counts,relativeLinksVerified:links,runtimeFilesUnchanged:true,secretValuesEmitted:false};
fs.writeFileSync(path.join(base,'completion.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));

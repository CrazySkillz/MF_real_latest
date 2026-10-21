// Audit artifact integrity only. This is not an application release gate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const dir='docs/audits/v1-2026-10-19',index='docs/V1_RELEASE_READINESS.md';
// Current documentation layout only: read-only, no subprocesses, artifacts or runtime checks.
if(process.argv.includes('--docs-only')){
 const queuePath=dir+'/FIX_QUEUE_ASSIGNMENTS.md';
 const batchPaths=Array.from({length:8},(_,i)=>`docs/fixes/v1-batch-${i+1}/README.md`);
 const docs=[index,queuePath,...batchPaths],read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 const baseline=JSON.parse(read(dir+'/release-fix-queue.json'));
 const queueRows=[...read(queuePath).matchAll(/^\| \[(V1-\d{3})\]\(([^)]+)\) \| (P[012]) \| ([1-8]) \| ([^|]+) \| ([^|]+) \| (.+) \|$/gm)]
  .map(m=>({id:m[1],link:m[2],severity:m[3],batch:Number(m[4]),fix:m[5].trim(),acceptance:m[6].trim(),scope:m[7]}));
 assert.equal(queueRows.length,baseline.findings.length,'Every finding must appear in the checklist');
 assert.equal(new Set(queueRows.map(f=>f.id)).size,queueRows.length,'Duplicate checklist finding');
 const states=new Set(['OPEN','IN PROGRESS','IMPLEMENTED, VALIDATION PENDING','VERIFIED LOCALLY','EXTERNALLY BLOCKED','DEFERRED','CLOSED']);
 const detailed=[];
 for(const [i,file] of batchPaths.entries()){
  const text=read(file),ids=[...text.matchAll(/^### (V1-\d{3})$/gm)].map(m=>m[1]);
  const expected=queueRows.filter(f=>f.batch===i+1);
  assert.deepEqual(ids,expected.map(f=>f.id),`${file}: wrong finding assignment/order`);
  for(const f of expected){
   assert.ok(states.has(f.fix),`${f.id}: unknown fix state`);
   assert.ok(['OPEN','DEFERRED','CLOSED'].includes(f.acceptance),`${f.id}: unknown acceptance`);
   assert.equal(f.link,`../../fixes/v1-batch-${f.batch}/README.md#${f.id.toLowerCase()}`);
   const original=baseline.findings.find(x=>x.id===f.id);assert.ok(original,f.id);
   assert.equal(f.severity,original.severity,`${f.id}: severity changed`);
   assert.equal(f.batch,original.batch,`${f.id}: batch changed`);
   assert.equal(f.scope,original.scope,`${f.id}: scope changed`);
   const block=text.split(`### ${f.id}\n`)[1]?.split(/^### V1-/m)[0];assert.ok(block,f.id);
   assert.ok(block.includes(`**Severity:** ${f.severity}. **Fix status:** ${f.fix}. **Release acceptance:** ${f.acceptance}.`),`${f.id}: detail/checklist status mismatch`);
   assert.ok(block.includes(`**V1 applicability:** ${f.scope}.`),`${f.id}: detail scope mismatch`);
   assert.ok(text.includes(`| [${f.id}](#${f.id.toLowerCase()}) | ${f.severity} | ${f.fix} | ${f.acceptance} |`),`${f.id}: batch checklist mismatch`);
   assert.equal(f.acceptance==='DEFERRED',original.scope.startsWith('Deferred provider functionality'),`${f.id}: unagreed deferral`);
   if(f.acceptance==='CLOSED')assert.equal(f.fix,'CLOSED',`${f.id}: closure mismatch`);
  }
  detailed.push(...ids);
 }
 assert.equal(new Set(detailed).size,detailed.length,'Finding has more than one detailed home');
 const open=queueRows.filter(f=>f.acceptance==='OPEN').length,deferred=queueRows.filter(f=>f.acceptance==='DEFERRED').length,closed=queueRows.filter(f=>f.acceptance==='CLOSED').length;
 const main=read(index);
 assert.ok(main.includes(`${queueRows.length} findings: ${open} unresolved V1 release items, ${deferred} deferred-provider functional items, ${closed} closed for release`),'Index totals disagree');
 assert.ok(read(queuePath).includes(`${queueRows.length} findings; ${open} V1 release items OPEN, ${deferred} provider-functional items DEFERRED, ${closed} CLOSED`),'Checklist totals disagree');
 const summaryRows=[...main.matchAll(/^\| B([1-8]) \| \[[^\]]+\]\(([^)]+)\) \| (\d+) \| (\d+) \|/gm)];
 assert.equal(summaryRows.length,8,'Index must link every batch');
 for(const m of summaryRows){
  const batch=Number(m[1]);assert.equal(m[2],`fixes/v1-batch-${batch}/README.md`);
  assert.equal(Number(m[3]),queueRows.filter(f=>f.batch===batch&&f.acceptance==='OPEN').length);
  assert.equal(Number(m[4]),queueRows.filter(f=>f.batch===batch&&f.acceptance==='DEFERRED').length);
 }
 const anchorsCache=new Map();
 function anchors(file){
  if(anchorsCache.has(file))return anchorsCache.get(file);
  const found=new Set(),counts=new Map();let fence=false;
  for(const line of read(file).split(/\r?\n/)){
   if(/^\s*(```|~~~)/.test(line)){fence=!fence;continue;}if(fence)continue;
   for(const m of line.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g))found.add(m[1]);
   const h=line.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/);if(!h)continue;
   const slug=h[1].toLowerCase().replace(/<[^>]+>/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu,'').replace(/\s/g,'-');
   const n=counts.get(slug)||0;counts.set(slug,n+1);found.add(slug+(n?`-${n}`:''));
  }
  anchorsCache.set(file,found);return found;
 }
 let links=0,inboundLinks=0;const checked=new Set(docs.map(f=>path.resolve(f)));
 function checkLinks(file,inboundOnly=false){
  for(const m of read(file).matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)){
   const raw=m[1].replace(/^<|>$/g,'');if(/^(?:https?:|app:|mailto:)/.test(raw))continue;
   const [target,fragment]=raw.split('#');
   const resolved=target?path.resolve(path.dirname(file),target.replace(/:\d+$/,'')):path.resolve(file);
   if(inboundOnly&&!checked.has(resolved))continue;
   assert.ok(fs.existsSync(resolved),`${file}: missing ${raw}`);
   if(fragment&&resolved.endsWith('.md'))assert.ok(anchors(resolved).has(decodeURIComponent(fragment)),`${file}: missing anchor ${raw}`);
   if(inboundOnly)inboundLinks++;else links++;
  }
 }
 docs.forEach(f=>checkLinks(f));
 // Preserve inbound links from the existing audit and implementation records.
 for(const folder of [dir,...batchPaths.map(f=>path.dirname(f))])for(const name of fs.readdirSync(folder)){
  const file=path.join(folder,name);if(name.endsWith('.md')&&!checked.has(path.resolve(file)))checkLinks(file,true);
 }
 console.log(JSON.stringify({mode:'documentation-only',documents:docs.length,findings:detailed.length,open,deferred,closed,localLinks:links,inboundLinks,checks:'PASS',limitation:'Layout, assignment, status and local-link integrity only; no runtime or release certification.'}));
 process.exit(0);
}
// Historical baseline checker below must run at its recorded audit checkpoint.
const head=process.env.V1_AUDIT_HEAD||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const trackedChanges=process.env.V1_AUDIT_TRACKED_CHANGES_JSON?JSON.parse(process.env.V1_AUDIT_TRACKED_CHANGES_JSON).join('\n'):cp.execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim();assert.equal(trackedChanges,'','Tracked files changed during audit');
const inventory=JSON.parse(fs.readFileSync(dir+'/inventory.json','utf8'));assert.equal(inventory.head,head);
const findings=[...fs.readFileSync(index,'utf8').matchAll(/^\| (V1-\d{3}) \| (P[012]) /gm)].map(x=>({id:x[1],severity:x[2]}));
assert.equal(new Set(findings.map(x=>x.id)).size,findings.length);findings.forEach((f,i)=>assert.equal(f.id,`V1-${String(i+1).padStart(3,'0')}`));
const packets=fs.readdirSync(dir).filter(x=>x.endsWith('reproductions.json')).map(file=>{const packet=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));if(packet.head)assert.equal(packet.head,head);assert.ok(Array.isArray(packet.results),file);return{file,cases:packet.results.length};});
const docs=[index,...fs.readdirSync(dir).filter(x=>x.endsWith('.md')).map(x=>path.join(dir,x))],missing=[];
for(const file of docs){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)){const raw=match[1].replace(/^<|>$/g,'');if(/^(?:https?:|#|app:)/.test(raw))continue;const target=raw.split('#')[0];if(!target)continue;if(!fs.existsSync(path.resolve(path.dirname(file),target)))missing.push({file,target});}}
assert.deepEqual(missing,[],'Broken audit evidence links');
const tests=JSON.parse(fs.readFileSync(dir+'/tests-controlled.json','utf8'));
const realPostgresRaceCases=1+JSON.parse(fs.readFileSync(dir+'/ga4-parent-delete-race.json','utf8')).results.length;
const realPostgresMigrationCases=JSON.parse(fs.readFileSync(dir+'/startup-migrations-postgres.json','utf8')).results.length;
const contention=JSON.parse(fs.readFileSync(dir+'/notification-contention-postgres.json','utf8'));assert.equal(contention.numFailedTests,0);assert.equal(contention.numPendingTests,0);const realPostgresNotificationCases=contention.numPassedTests;
const catalog=JSON.parse(fs.readFileSync(dir+'/migration-catalog-postgres.json','utf8'));
const restore=JSON.parse(fs.readFileSync(dir+'/backup-restore-fixture.json','utf8'));
assert.equal(restore.result.exactRowHashPreserved,true);assert.equal(restore.result.encryptedCredentialsRecoverWithOriginalKey,true);
const http=JSON.parse(fs.readFileSync(dir+'/http-database-pilot-results.json','utf8'));assert.equal(http.numFailedTests,0);assert.equal(http.numPassedTests,4);
const entry=JSON.parse(fs.readFileSync(dir+'/route-entry-boundaries.json','utf8'));
assert.equal(entry.results.length,296);assert.equal(entry.excluded.length,8);assert.ok(entry.results.every(r=>r.effects.length===0));
const foreign=JSON.parse(fs.readFileSync(dir+'/foreign-owner-entry-boundaries.json','utf8'));
assert.equal(foreign.results.length,284);assert.equal(foreign.results.filter(r=>r.classification==='FOREIGN_PARENT_DENIED').length,283);
assert.ok(foreign.results.every(r=>r.status===404&&r.effects.length===0&&!r.exception));
const dispositions=JSON.parse(fs.readFileSync(dir+'/route-audit-disposition.json','utf8'));
assert.equal(dispositions.rows.length,349);assert.equal(dispositions.middleware.length,9);
assert.equal(new Set(dispositions.rows.map(r=>`${r.file}:${r.line}`)).size,349);
for(const route of dispositions.rows)for(const record of [...route.familyEvidence,...route.accessEvidence])assert.ok(fs.existsSync(path.join(dir,record)),record);
const finalCases=JSON.parse(fs.readFileSync(dir+'/final-boundary-reproductions.json','utf8'));assert.equal(finalCases.results.length,22);
const repaired=JSON.parse(fs.readFileSync(dir+'/ga4-fixture-acceptance-results.json','utf8'));assert.equal(repaired.numPassedTests,108);assert.equal(repaired.numFailedTests,0);
const binding=JSON.parse(fs.readFileSync(dir+'/binding-fixture-results.json','utf8'));assert.equal(binding.numPassedTests,35);assert.equal(binding.numFailedTests,1);
const transaction=JSON.parse(fs.readFileSync(dir+'/transaction-fixture-results.json','utf8'));assert.equal(transaction.numPassedTests,54);assert.equal(transaction.numFailedTests,0);
const extraDiagnoses=JSON.parse(fs.readFileSync(dir+'/additional-test-root-causes.json','utf8'));assert.equal(extraDiagnoses.originalFailuresDiagnosedPassing,60);
const queue=JSON.parse(fs.readFileSync(dir+'/release-fix-queue.json','utf8'));assert.equal(queue.findings.length,findings.length);
assert.deepEqual(queue.findings.map(f=>f.id),findings.map(f=>f.id));
const result={at:new Date().toISOString(),head,trackedFilesUnchanged:true,findings:findings.length,severities:findings.reduce((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{}),isolatedCases:packets.reduce((n,p)=>n+p.cases,0),packets,realPostgresRaceCases,realPostgresMigrationCases,realPostgresCases:realPostgresRaceCases+realPostgresMigrationCases,endpointDeclarations:inventory.routes.filter(x=>x.method!=='USE').length,routeDeclarations:inventory.pages.length,tableDeclarations:inventory.tables.length,controls:inventory.actions.length,jobSites:inventory.jobs.length,documentsChecked:docs.length,brokenLinks:missing,fullSuite:{total:tests.numTotalTests,passed:tests.numPassedTests,failed:tests.numFailedTests,skipped:tests.numPendingTests},limitation:'Artifact/link/count integrity only; unresolved semantic, lifecycle and external gates still prevent certification.'};
result.realPostgresNotificationCases=realPostgresNotificationCases;
result.realPostgresCases+=realPostgresNotificationCases;
result.retainedMigrationCatalogScenarios=catalog.results.length;
result.syntheticBackupRestoreScenarios=1;
result.realPostgresCases+=catalog.results.length+1;
result.actualHttpDatabaseAuditTests=http.numPassedTests;
result.anonymousEntryProbes=entry.results.length;
result.authenticatedForeignParentEntryCases=foreign.results.length;
result.endpointDispositions=dispositions.rows.length;
result.finalBoundaryCasesIncludedInReproductionPackets=finalCases.results.length;
result.supplementalFixtureRepairAssertions=repaired.numPassedTests;
result.additionalDiagnosticAssertions={passed:binding.numPassedTests+transaction.numPassedTests,failed:binding.numFailedTests+transaction.numFailedTests};
result.originalFixtureBindingFailuresWithPassingDiagnostics=37+60+1;
result.findingsAssignedToFixBatches=queue.findings.length;
result.configurationNames=new Set(inventory.configuration.map(x=>x.name)).size;
fs.writeFileSync(dir+'/audit-record-check.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,packets:packets.length}));
if(process.argv.includes('--manifest')){
 const prior=JSON.parse(fs.readFileSync(dir+'/evidence-manifest.json','utf8'));
 const hash=file=>({file:file.replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
 const sourceHashes=prior.runtimeSourceFiles.map(entry=>{const next=hash(entry.file);assert.equal(next.sha256,entry.sha256,`Runtime source changed: ${entry.file}`);return next;});
 const artifactFiles=[index,...fs.readdirSync(dir).filter(x=>x!=='evidence-manifest.json'&&fs.statSync(path.join(dir,x)).isFile()).map(x=>path.join(dir,x))].sort();
 fs.writeFileSync(dir+'/evidence-manifest.json',JSON.stringify({head,generatedAt:new Date().toISOString(),runtimeSourceFiles:sourceHashes,auditArtifacts:artifactFiles.map(hash),notes:['Hashes bind evidence to audited bytes, not provider truth.','Temporary PostgreSQL was stopped after all isolated database cases, including GA4 parent writes and startup/migration scenarios.','No tracked runtime/test files changed. Manifest excludes itself.']},null,2)+'\n');
 console.log(JSON.stringify({runtimeSourceFiles:sourceHashes.length,auditArtifacts:artifactFiles.length}));
}

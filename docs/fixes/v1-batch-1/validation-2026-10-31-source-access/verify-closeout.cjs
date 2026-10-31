// Offline comparison only. No database, app startup or provider requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),json=name=>JSON.parse(read(name));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const m=json('manifest.json'),user=json('user-source-foreign-6302ecc4.json');
assert.equal(user.batch1SourceBundle,'PASS_SOURCE_FOREIGN');assert.equal(user.run,m.run);assert.equal(user.tag,m.tag);assert.deepEqual(user.ids,m.ids);assert.equal(user.pending,null);
assert.equal(user.ownerChecks.length,9);assert.equal(user.checks.length,7);assert.ok([...user.ownerChecks,...user.checks].every(x=>x.passed===true));
const seed=json('seed-2026-10-31T09-34-02-309Z.json'),dry=json('cleanup-2026-10-31T09-47-34-563Z.json'),commit=json('cleanup-2026-10-31T09-48-15-395Z.json'),verify=json('verify-2026-10-31T09-49-19-623Z.json');
assert.equal(dry.result,'PASS_CLEANUP_REHEARSAL');assert.equal(commit.result,'PASS_EXACT_FIXTURE_CLEANUP');assert.equal(verify.result,'PASS_ABSENCE_READBACK');
assert.equal(dry.operation.committed,false);assert.equal(commit.operation.committed,true);assert.equal(verify.databaseReadOnly,true);
for(const r of [dry,commit]){assert.equal(r.userReceiptSha256,hash(read('user-source-foreign-6302ecc4.json')));assert.equal(r.operation.exactRows,5);assert.ok(r.operation.edited&&r.operation.draftOnly&&r.operation.credentialsAbsent&&r.operation.outsideRowsUnchanged);assert.equal(r.operation.unplannedDependents,0);}
for(const r of [seed,dry,commit,verify]){assert.equal(r.run,m.run);assert.equal(r.manifestSha256,hash(read('manifest.json')));assert.equal(r.targetFingerprint,seed.targetFingerprint);assert.deepEqual(r.protectedCampaigns,seed.protectedCampaigns);assert.equal(r.providerCalls,0);assert.equal(r.secretValuesEmitted,false);}
assert.deepEqual(Object.keys(verify.exactRemaining).sort(),Object.keys(m.ids).sort());assert.ok(Object.values(verify.exactRemaining).every(n=>n===0));
const rows=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(line=>/^\| \[V1-\d{3}\]/.test(line)).map(line=>line.split('|').slice(1,-1).map(cell=>cell.trim()));
const queue=rows('docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md'),batch=rows('docs/fixes/v1-batch-1/README.md');
assert.equal(queue.length,130);assert.equal(new Set(queue.map(r=>r[0].match(/V1-\d{3}/)[0])).size,130);assert.equal(batch.length,20);
const totals=Object.fromEntries(['OPEN','DEFERRED','CLOSED'].map(s=>[s,queue.filter(r=>r[4]===s).length]));assert.deepEqual(totals,{OPEN:111,DEFERRED:10,CLOSED:9});
assert.equal(batch.filter(r=>r[3]==='CLOSED').length,8);assert.equal(batch.filter(r=>r[3]==='OPEN').length,12);
assert.equal(queue.find(r=>r[0].includes('[V1-034]'))[4],'CLOSED');for(const id of ['V1-006','V1-052','V1-054'])assert.equal(queue.find(r=>r[0].includes(`[${id}]`))[4],'OPEN');
let localLinks=0;for(const name of ['SOURCE_ACCESS_PROCEDURE_2026-10-31.md','CONSOLIDATED_CLOSEOUT_2026-10-31.md']){const file=path.resolve(__dirname,'..',name);for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){const target=match[1];if(!/^(https?:|#)/.test(target)){assert.ok(fs.existsSync(path.resolve(path.dirname(file),target.split('#')[0])),target);localLinks++;}}}
const receipt={at:new Date().toISOString(),result:'PASS_SOURCE_CLOSEOUT_VERIFICATION',userChecks:16,exactFixtureRowsAbsent:5,protectedCampaignIdentitiesUnchanged:true,outsideRowsUnchangedWithinCleanup:true,batch1:{total:20,closed:8,open:12},totals,newlyClosed:['V1-034'],reportsOwnerVisibility:'USER_SCRIPT_CONFIRMED',reportsForeignVisibility:'USER_SCRIPT_CONFIRMED_HIDDEN',localLinksChecked:localLinks,limits:'V1-052 and V1-054 remain open for documented separate acceptance; no provider renewal, analytics or whole-app readiness claim.'};
fs.writeFileSync(path.join(__dirname,'source-closeout-verification.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));

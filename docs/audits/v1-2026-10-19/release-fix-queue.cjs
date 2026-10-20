// Check that every stable finding has an explicit primary batch and scope disposition.
const fs=require('node:fs'),assert=require('node:assert/strict');
const dir='docs/audits/v1-2026-10-19/';
const index=fs.readFileSync('docs/V1_RELEASE_READINESS.md','utf8');
const findings=[...index.matchAll(/^\| (V1-(\d{3})) \| (P[012]) \/ ([^|]+) \| (.+) \|$/gm)].map(m=>({id:m[1],number:Number(m[2]),severity:m[3],status:m[4].trim(),detail:m[5]}));
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
const batches=[
 {id:1,title:'Authorization, ingestion and credential exposure',findings:[...range(1,6),8,26,27,30,34,52,53,54,57,63,75,78,88,123]},
 {id:2,title:'Startup, migrations and account/campaign lifecycle',findings:[7,9,17,23,37,38,39,76,80,81,91,92,93,124]},
 {id:3,title:'Native GA4 query and financial contracts',findings:[11,25,32,33,35,36,79,87,89,90]},
 {id:4,title:'Files, Sheets and Custom Integration',findings:[28,29,31,40,41,51,...range(65,73),102,103,108,111,112,113,114,120,126]},
 {id:5,title:'CRM and commerce Revenue',findings:[42,43,44,45,83,109]},
 {id:6,title:'Deferred-source isolation and included Ads',findings:[24,...range(46,50),55,82,104,105,106,107,115,116,117,118,121,127,128]},
 {id:7,title:'Diagnostics, goals, retained pages, alerts and reports',findings:[15,21,22,56,58,59,60,61,62,64,74,77,84,85,86,...range(94,101),110,119,122,125,129,130]},
 {id:8,title:'Release checks and deployed operational acceptance',findings:[10,12,13,14,16,18,19,20]},
];
const deferred=new Set([47,48,49,50,82,105,115,116,117,118]);
const mixed=new Set([3,24,27,46,54,55,63,69,70,75,78,88,104,106,108,121]);
const output=findings.map(f=>{
 const owners=batches.filter(b=>b.findings.includes(f.number));assert.equal(owners.length,1,f.id);
 return {...f,batch:owners[0].id,scope:deferred.has(f.number)?'Deferred provider functionality; retained for future enablement, not a V1 provider implementation task':
 mixed.has(f.number)?'Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred':
 'V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement'};
});
assert.equal(output.length,130);
for(const b of batches)for(const n of b.findings)assert.ok(output.some(f=>f.number===n),String(n));
fs.writeFileSync(dir+'release-fix-queue.json',JSON.stringify({at:new Date().toISOString(),runtimeChangesAuthorized:true,authorizedBatches:[1],batches:batches.map(({findings,...b})=>({...b,count:findings.length})),findings:output},null,2)+'\n');
const text=['# Finding-by-finding fix queue','','The [controlling index](../../V1_RELEASE_READINESS.md) defines the eight practical batches and their acceptance boundaries. This generated assignment includes every stable finding exactly once. Severity is retained separately from V1 applicability; deferred provider findings are not mandatory V1 feature work.','','Current counts, implementation state, validation evidence and remaining release gates are maintained in [Fix counts and progress tracking](../../V1_RELEASE_READINESS.md#fix-counts-and-progress-tracking). Update that record with each fix; this assignment table does not establish closure.','','| Finding | Severity | Primary batch | V1 applicability |','|---|---|---:|---|',
 ...output.map(f=>`| ${f.id} | ${f.severity} | ${f.batch} | ${f.scope} |`),'',
 'Every implementation batch must preserve existing architecture and add exact root-cause regression coverage. Known persisted damage requires a separate read-only boundary inventory and targeted cleanup proposal. The final candidate needs a fresh full release run; audit copies do not replace repaired authoritative tests.',''];
fs.writeFileSync(dir+'FIX_QUEUE_ASSIGNMENTS.md',text.join('\n'));
let batchRows=0;
const updatedIndex=index.replace(/^\| ([1-8])\. ([^|]+) \| ([^|]+) \| (.+) \|$/gm,(_m,id,title,_ids,boundary)=>{
 batchRows++;
 const b=batches.find(b=>b.id===Number(id));assert.ok(b);
 return `| ${id}. ${title} | ${b.findings.slice().sort((a,b)=>a-b).map(n=>`V1-${String(n).padStart(3,'0')}`).join(', ')} | ${boundary} |`;
});
assert.equal(batchRows,8,'Expected eight reviewable batch rows to reconcile');
fs.writeFileSync('docs/V1_RELEASE_READINESS.md',updatedIndex);
console.log(JSON.stringify({assigned:output.length,deferredProviderOnly:deferred.size,batches:batches.length}));

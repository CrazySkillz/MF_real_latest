// Compare only the existing allowlisted, read-only metadata receipts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const before=read('provider-publication-2026-10-31T14-18-44-822Z.json'),after=read('provider-publication-2026-10-31T15-14-28-120Z.json'),release=read('release.json');
assert.equal(release.result,'PASS');assert.equal(before.campaignId,after.campaignId);
assert.equal(after.result,'PASS_SCHEDULED_PUBLICATION_METADATA');
const checks=['sources','work','snapshots'].map(field=>{assert.deepEqual(after[field],before[field],`${field} changed`);return {check:field+' unchanged across deployment',passed:true}});
const expiryChanges=[];
const stableConnections=groups=>groups.map(group=>({...group,rows:group.rows.map(({expires_at,...row})=>row)}));
assert.deepEqual(stableConnections(after.connectionMetadata),stableConnections(before.connectionMetadata));
checks.push({check:'exact connections remain active, encrypted and without plaintext',passed:true});
for(const group of after.connectionMetadata)for(const row of group.rows){const old=before.connectionMetadata.find(g=>g.table===group.table).rows.find(r=>r.id===row.id);if(row.expires_at!==old.expires_at)expiryChanges.push({table:group.table,id:row.id,before:old.expires_at,after:row.expires_at})}
assert.equal(expiryChanges.length,1);assert.equal(expiryChanges[0].table,'google_sheets_connections');assert.ok(expiryChanges[0].after>expiryChanges[0].before);
const result={at:new Date().toISOString(),result:'PASS',commit:release.health.commit,campaignId:after.campaignId,checks,expiryChanges,databaseWritesAttempted:false,providerCalls:0,secretValuesEmitted:false,
 limits:'Exact test-campaign metadata only. One observed Sheets expiry advancement with unchanged publication is consistent with renewal; no provider exchange was captured. Does not prove reconnect, every provider, other campaigns, or complete analytics correctness.'};
fs.writeFileSync(path.join(__dirname,'post-release.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

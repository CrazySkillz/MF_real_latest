// Explicit maintenance procedure, not imported by the application. No provider calls.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const tables=['ga4_connections','google_sheets_connections','hubspot_connections','salesforce_connections','shopify_connections'];
const fields=t=>t==='shopify_connections'?['access_token']:['access_token','refresh_token','client_secret'];
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const qi=v=>{assert.match(v,/^[a-z_][a-z0-9_]*$/);return '"'+v+'"';};
const keepHashes=['b85505d40a0a14398f36838d19d8d51e47037d32837d5a16464f4f1fc3601710','de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722'];
async function read(db){
  const data={};
  for(const t of ['clients','campaigns',...tables,'ga4_connection_lifecycle_events'])
    data[t]=(await db.query(`SELECT row_to_json(t)::text value FROM public.${qi(t)} t ORDER BY id`)).rows.map(r=>r.value);
  return data;
}
function candidates(data){
  const campaigns=new Map(data.campaigns.map(s=>{const r=JSON.parse(s);return [r.id,r];}));
  const kept=[...campaigns.values()].filter(c=>['Promo','V1 Batch 5 Test'].includes(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
  assert.deepEqual(kept.map(c=>hash(c.id)),keepHashes,'PROTECTED_CAMPAIGNS_CHANGED');
  const clients=new Map(data.clients.map(s=>{const c=JSON.parse(s);return[c.id,c];}));
  for(const c of kept)assert.ok(c.status==='active'&&c.owner_id&&clients.get(c.client_id)?.owner_id===c.owner_id,'PROTECTED_OWNER_CHANGED');
  const result={};
  for(const t of tables){result[t]=[];
    for(const raw of data[t]){const r=JSON.parse(raw),parent=campaigns.get(r.campaign_id);
      if(r.encrypted_tokens!==null||!fields(t).some(f=>r[f]!==null&&r[f]!==''))continue;
      assert.ok(!kept.some(c=>c.id===r.campaign_id),'PROTECTED_PLAINTEXT_FOUND');
      assert.ok(!parent||r.is_active===false,'ACTIVE_EXISTING_CAMPAIGN_FOUND');
      assert.ok(!parent||!clients.has(parent.client_id),'EXISTING_CLIENT_FOUND');
      assert.ok(!parent||!kept.some(c=>c.owner_id===parent.owner_id),'CURRENT_OWNER_FOUND');
      result[t].push({id:r.id,campaign_id:r.campaign_id,raw,missingParent:!parent,active:r.is_active});
    }
  }
  return result;
}
function publicGroups(selected){return tables.map(t=>({table:t,rows:selected[t].length,rowsetSha256:hash(JSON.stringify(selected[t].map(r=>r.id).sort())),missingParents:selected[t].filter(r=>r.missingParent).length,inactive:selected[t].filter(r=>!r.active).length}));}
function assertExpected(before,after,selected){
  for(const t of Object.keys(before)){
    const chosen=new Set((selected[t]||[]).map(r=>r.id));
    assert.equal(after[t].length,before[t].length,'ROW_COUNT_CHANGED');
    const expected=before[t].map(raw=>{const r=JSON.parse(raw);if(chosen.has(r.id))for(const f of fields(t))r[f]=null;return r;});
    assert.deepEqual(after[t].map(JSON.parse),expected,'UNEXPECTED_FIELD_CHANGE_'+t);
  }
}
async function retireWithinTransaction(db,snapshot){
  // Caller owns BEGIN/COMMIT and must set short lock/statement timeouts.
  // SHARE on parents blocks a missing parent being recreated during the operation.
  // Connection table locks also serialize default-isolation writers, not only cooperating app callers.
  await db.query('LOCK TABLE public.clients, public.campaigns IN SHARE MODE');
  await db.query('LOCK TABLE '+tables.map(t=>'public.'+qi(t)).join(',')+' IN SHARE ROW EXCLUSIVE MODE');
  const before=await read(db),selected=candidates(before),expected=candidates(snapshot);
  assert.deepEqual(publicGroups(selected),publicGroups(expected),'CANDIDATE_IDENTITIES_CHANGED');
  for(const t of tables)assert.deepEqual(selected[t].map(r=>r.raw),expected[t].map(r=>r.raw),'CANDIDATE_VALUES_CHANGED');
  for(const r of [...Object.values(selected)].flat()){
    const old=snapshot.campaigns.find(raw=>JSON.parse(raw).id===r.campaign_id);
    assert.equal(before.campaigns.find(raw=>JSON.parse(raw).id===r.campaign_id),old,'CANDIDATE_PARENT_CHANGED');
  }
  let changed=0;
  for(const t of tables){if(!selected[t].length)continue;
    const r=await db.query(`UPDATE public.${qi(t)} SET ${fields(t).map(f=>qi(f)+'=NULL').join(',')} WHERE id=ANY($1::text[]) AND encrypted_tokens IS NULL`,[selected[t].map(r=>r.id)]);
    assert.equal(r.rowCount,selected[t].length,'UPDATE_COUNT_CHANGED');changed+=r.rowCount;
  }
  const after=await read(db);assertExpected(before,after,selected);
  assert.equal(Object.values(candidates(after)).flat().length,0,'PLAINTEXT_REMAINS');
  return {changed,before,after,selected};
}
module.exports={tables,fields,hash,qi,read,candidates,publicGroups,assertExpected,retireWithinTransaction};

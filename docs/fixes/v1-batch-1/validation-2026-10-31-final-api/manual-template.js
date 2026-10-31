// Run only after the exact fixture has been seeded and this procedure rehearsed.
// No provider connections, imports, email delivery, or existing campaign edits.
(async()=>{
 const m=/* FINAL_FIXTURE */ null,checks=[],ids={};
 const requireCheck=(value,code)=>{if(!value)throw Error(code)};
 const check=(name,value)=>{checks.push({check:name,passed:!!value});requireCheck(value,'CHECK_FAILED')};
 try{
  requireCheck(m&&location.origin==='https://marketforensics.onrender.com','WRONG_ORIGIN');
  const actor=window.Clerk?.user?.id;requireCheck(actor,'SIGN_IN_REQUIRED');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(actor));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  requireCheck(hash==='1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096','USE_SECOND_ACCOUNT');
  const request=async(path,method='GET',body)=>{requireCheck(path.startsWith('/api/'),'PATH_REJECTED');const r=await fetch(path,{method,credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}};
  const c=await request(`/api/campaigns/${m.ids.campaign}`);check('exact new owned draft',c.status===200&&c.data.id===m.ids.campaign&&c.data.ownerId===actor&&c.data.name===m.tag&&c.data.status==='draft'&&c.data.currency==='EUR'&&Number(c.data.spend)===0);
  const models=await request('/api/attribution/models');check('only the two disposable models',models.status===200&&Array.isArray(models.data)&&models.data.length===2&&models.data.every(x=>[m.ids.modelA,m.ids.modelB].includes(x.id)&&x.ownerId===actor&&x.isDefault===false&&x.isActive===false));
  const initial=await request(`/api/custom-integration-by-id/${m.ids.custom}`);check('exact fixture whitelist before edit',initial.status===200&&initial.data.id===m.ids.custom&&initial.data.campaignId===m.ids.campaign&&JSON.stringify(initial.data.allowedEmailAddresses)===JSON.stringify(['old@example.invalid']));
  for(const list of [['new@example.invalid'],[],['new@example.invalid']]){
   const saved=await request('/api/custom-integration/connect','POST',{campaignId:m.ids.campaign,email:`${m.run}@example.invalid`,allowedEmailAddresses:list});
   check('owned whitelist save',saved.status===200&&saved.data.success===true&&saved.data.customIntegration?.id===m.ids.custom);
   const read=await request(`/api/custom-integration-by-id/${m.ids.custom}`);check(list.length?'whitelist reload removes old sender':'explicit empty whitelist persists',read.status===200&&JSON.stringify(read.data.allowedEmailAddresses)===JSON.stringify(list));
  }
  const selected=await request(`/api/attribution/models/${m.ids.modelB}/set-default`,'POST',{});check('owned default selection accepted',selected.status===200&&selected.data.success===true);
  const readModels=await request('/api/attribution/models');check('default selection reload is owner scoped',readModels.status===200&&readModels.data.length===2&&readModels.data.filter(x=>x.isDefault).length===1&&readModels.data.find(x=>x.id===m.ids.modelB)?.isDefault===true&&readModels.data.find(x=>x.id===m.ids.modelA)?.isDefault===false);
  const calculated=await request('/api/attribution/calculate','POST',{journeyId:m.ids.journey,modelId:m.ids.modelB});
  check('linked zero-value calculation persists correct parents',calculated.status===200&&Array.isArray(calculated.data)&&calculated.data.length===1&&calculated.data[0].campaignId===m.ids.campaign&&calculated.data[0].journeyId===m.ids.journey&&calculated.data[0].touchpointId===m.ids.touchpoint&&Number(calculated.data[0].attributedValue)===0&&Number(calculated.data[0].attributionCredit)===1);ids.result=calculated.data[0].id;
  const points=await request(`/api/attribution/touchpoints?journeyId=${m.ids.journey}`);check('linked touchpoint reload',points.status===200&&Array.isArray(points.data)&&points.data.length===1&&points.data[0].id===m.ids.touchpoint&&points.data[0].campaignId===m.ids.campaign);
  for(const [alias,amount]of [['connectors',0.01],['ad-platforms',0.02]]){
   const r=await request(`/api/campaigns/${m.ids.campaign}/spend/process/${alias}`,'POST',{amount,currency:'EUR',platformContext:'custom_integration',records:[{date:m.date,spend:amount}],...(ids.source?{existingSourceId:ids.source}:{})});
   check(`${alias} accepts exact dated spend`,r.status===200&&r.data.success===true&&typeof r.data.sourceId==='string'&&r.data.currency==='EUR'&&r.data.spendToDate===amount);ids.source=r.data.sourceId;
  }
  const spend=await request(`/api/campaigns/${m.ids.campaign}/spend-to-date?platformContext=custom_integration`);check('scoped spend total and provenance',spend.status===200&&spend.data.success===true&&spend.data.spendToDate===0.02&&spend.data.currency==='EUR'&&JSON.stringify(spend.data.sourceIds)===JSON.stringify([ids.source]));
  const sources=await request(`/api/campaigns/${m.ids.campaign}/spend-sources?platformContext=custom_integration`);check('source replacement leaves one exact source',sources.status===200&&sources.data.success===true&&sources.data.sources?.length===1&&sources.data.sources[0].id===ids.source);
  const end=await request(`/api/campaigns/${m.ids.campaign}`);check('only fixture spend changed; currency and draft preserved',end.status===200&&end.data.currency==='EUR'&&end.data.status==='draft'&&Number(end.data.spend)===0.02);
  console.log(JSON.stringify({batch1FinalApi:'PASS_FINAL_API',run:m.run,tag:m.tag,ids:{...m.ids,...ids},checks,phase:'awaiting_exact_cleanup'},null,2));
 }catch(e){console.log(JSON.stringify({batch1FinalApi:'CHECK_REQUIRED',run:m?.run,ids,checks,code:['WRONG_ORIGIN','SIGN_IN_REQUIRED','USE_SECOND_ACCOUNT','PATH_REJECTED','CHECK_FAILED'].includes(e?.message)?e.message:'INCOMPLETE'},null,2))}
})();

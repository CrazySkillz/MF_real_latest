// Generated with seven exact disposable IDs after the guarded fixture preparation.
// Two passes: second account, then Promo's original account. No provider calls.
(async () => {
  const fixture = {"version":1,"run":"b7ff502f-6b96-4b3e-9822-6cd73ab5040b","tag":"B1_SOURCE_b7ff502f-6b96-4b3e-9822-6cd73ab5040b","ids":{"a":"869b5479-d7cc-44ea-8f1e-41551de6a0d0","b":"b802a2bc-b960-46d6-8be2-469f60140d47","foreign":"82eb86c5-ba49-4769-a45d-c969e8293052","linkedin":"251d3756-c3c8-466a-9d09-43c256ae6d69","kpi":"e49ae1ef-4252-4efe-99c1-cc0fe7dc6a4e","benchmark":"85434c81-3a1b-4ff0-b0bf-ccad4fd73796","custom":"b879c3da-c900-4c81-9bbf-b176eb273abc"}};
  const key = 'mimosaas_batch1_source_acceptance_20261031', reportKey = 'marketpulse_reports';
  const primary = 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U';
  const testCampaign = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2,'0')).join('');
  const requireCheck = (value, name) => { if (!value) throw Error(name); };
  requireCheck(location.origin === 'https://marketforensics.onrender.com', 'WRONG_ORIGIN');
  requireCheck(location.pathname === '/reports' && new URLSearchParams(location.search).get('campaignId') === testCampaign, 'OPEN_THE_TEST_CAMPAIGN_REPORTS_LINK');
  const actor = window.Clerk?.user?.id;
  requireCheck(typeof actor === 'string', 'SIGN_IN_REQUIRED');
  const secondary = await digest(actor) === '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096';
  requireCheck(secondary || actor === primary, 'WRONG_ACCOUNT');
  const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x);
  requireCheck(fixture?.version === 1 && uuid(fixture.run) && fixture.tag === `B1_SOURCE_${fixture.run}`, 'INVALID_FIXTURE');
  requireCheck(Object.keys(fixture.ids || {}).sort().join(',') === 'a,b,benchmark,custom,foreign,kpi,linkedin' && Object.values(fixture.ids).every(uuid) && new Set(Object.values(fixture.ids)).size === 7, 'INVALID_IDS');
  const ids = fixture.ids, reportId = `b1_source_${fixture.run}`, reportSchedule = { frequency:'daily',day:'monday',time:'09:00',recipients:[] };
  let state = JSON.parse(localStorage.getItem(key) || 'null');
  const checks = [];
  const save = () => localStorage.setItem(key, JSON.stringify(state));
  const check = (name, value) => { checks.push({check:name,passed:!!value}); requireCheck(value,name); };
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(url,{method,credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
      ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  };
  const emit = result => console.log(JSON.stringify({batch1SourceBundle:result,account:secondary?'Second account':'Promo owner',run:fixture.run,tag:fixture.tag,ids,phase:state?.phase,pending:state?.pending||null,ownerChecks:state?.ownerChecks||[],checks},null,2));
  const edits = [
    ['LinkedIn',`/api/linkedin/update/${ids.a}`,'connection','adAccountName',ids.linkedin],
    ['Meta KPI',`/api/platforms/meta/kpis/${ids.kpi}`,'kpi','name',ids.kpi],
    ['Meta Benchmark',`/api/benchmarks/${ids.benchmark}`,'benchmark','name',ids.benchmark],
  ];
  try {
    if (!state) {
      requireCheck(secondary,'START_WITH_SECOND_ACCOUNT');
      for (const name of ['a','b']) {
        const r = await request(`/api/campaigns/${ids[name]}`);
        check(`${name} exact owned draft`,r.status===200 && r.data.id===ids[name] && r.data.name===`${fixture.tag}:${name}` && r.data.ownerId===actor && r.data.status==='draft');
      }
      state={run:fixture.run,phase:'owner_pending',pending:null,ownerChecks:[]};save();
      for (const [name,url,field,label,id] of edits) {
        state.pending=name;save();
        const r=await request(url,'PATCH',{[label]:`${fixture.tag}:edited`,id:ids.foreign,campaignId:ids.foreign});
        check(`${name} valid edit preserves IDs`,r.status===200 && r.data[field]?.id===id && r.data[field]?.campaignId===ids.a && r.data[field]?.[label]===`${fixture.tag}:edited`);
        state.pending=null;save();
      }
      for (const [fromCampaignId,toCampaignId] of [[ids.foreign,ids.b],[ids.a,ids.foreign],['temp-campaign-setup',ids.b],[ids.a,'temp-campaign-setup']]) {
        const r=await request('/api/custom-integration/transfer','POST',{fromCampaignId,toCampaignId});
        check('foreign or magic transfer parent denied',r.status===404 && r.data.message==='Campaign not found');
      }
      state.pending='owned transfer';save();
      const transferred=await request('/api/custom-integration/transfer','POST',{fromCampaignId:ids.a,toCampaignId:ids.b});
      check('owned draft transfer accepted',transferred.status===200 && transferred.data.success===true);
      state.pending=null;save();
      const reports=JSON.parse(localStorage.getItem(reportKey)||'[]');
      requireCheck(Array.isArray(reports) && !reports.some(x=>x.id===reportId),'REPORT_FIXTURE_COLLISION');
      localStorage.setItem(reportKey,JSON.stringify([...reports,{id:reportId,name:fixture.tag,type:'performance-summary',status:'Paused',campaignId:testCampaign,campaignName:'Batch 1 Provider Check',generatedAt:new Date().toISOString(),format:'PDF',schedule:reportSchedule}]));
      window.dispatchEvent(new Event('reportAdded'));
      const deadline=Date.now()+10000;
      while (!document.body.textContent.includes(fixture.tag) && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,100));
      check('actual owner Reports page displays exact fixture',document.body.textContent.includes(fixture.tag));
      state.phase='owner_complete';state.ownerChecks=checks;save();emit('PASS_SOURCE_OWNER');return;
    }
    requireCheck(state.run===fixture.run,'DIFFERENT_RUN');
    requireCheck(!state.pending && !['owner_pending','foreign_pending'].includes(state.phase),'PARTIAL_RUN_DO_NOT_REPEAT');
    if (actor===primary && state.phase==='owner_complete') {
      const r=await request(`/api/campaigns/${ids.foreign}`);
      check('original account exact owned draft',r.status===200 && r.data.ownerId===actor && r.data.id===ids.foreign && r.data.name===`${fixture.tag}:foreign` && r.data.status==='draft');
      const deadline=Date.now()+10000;
      while (!document.body.textContent.includes('Reports unavailable') && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,100));
      requireCheck(document.body.textContent.includes('Reports unavailable'),'WAIT_FOR_FOREIGN_REPORTS_PAGE');
      check('actual foreign Reports page hides fixture',!document.body.textContent.includes(fixture.tag));
      state.phase='foreign_pending';save();
      for (const [name,url] of edits) {
        const r=await request(url,'PATCH',{name:`${fixture.tag}:foreign`,adAccountName:`${fixture.tag}:foreign`,id:ids.foreign,campaignId:ids.foreign});
        check(`foreign ${name} edit denied`,r.status===404 && r.data.message==='Campaign not found');
      }
      for (const [fromCampaignId,toCampaignId] of [[ids.b,ids.foreign],[ids.foreign,ids.a],[ids.a,ids.b]]) {
        const r=await request('/api/custom-integration/transfer','POST',{fromCampaignId,toCampaignId});
        check('foreign transfer denied',r.status===404 && r.data.message==='Campaign not found');
      }
      const reports=JSON.parse(localStorage.getItem(reportKey)||'[]');requireCheck(Array.isArray(reports),'REPORT_CACHE_FORMAT');
      const rows=reports.filter(x=>x.id===reportId), report=rows[0];
      check('exact paused report cleanup',rows.length===1 && report.name===fixture.tag && report.campaignId===testCampaign && report.status==='Paused' && !report.backendReportId && !report.downloadUrl && JSON.stringify(report.schedule)===JSON.stringify(reportSchedule));
      localStorage.setItem(reportKey,JSON.stringify(reports.filter(x=>x.id!==reportId)));window.dispatchEvent(new Event('reportAdded'));
      state.phase='awaiting_cleanup';save();emit('PASS_SOURCE_FOREIGN');return;
    }
    emit('ALREADY_RECORDED_OR_OTHER_ACCOUNT_REQUIRED');
  } catch (error) { emit('CHECK_REQUIRED');console.log('Stopped: '+(/^[A-Za-z0-9 _:-]+$/.test(error?.message||'')?error.message:'REQUEST_OR_STORAGE_FAILED')); }
})().catch(()=>console.log('B1 source check: INCOMPLETE. No credentials printed.'));

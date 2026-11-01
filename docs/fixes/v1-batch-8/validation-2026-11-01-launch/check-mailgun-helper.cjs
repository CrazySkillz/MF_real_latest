// Offline browser mocks only. No network, real account, token, email or database.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname,'manual-mailgun-check.js'),'utf8');
async function scenario(options = {}) {
  const logs=[], calls=[], elements=[], saved=new Map();
  if (options.already) saved.set('mimo-mailgun-restored-2026-11-01','already');
  let reads=0;
  const report={id:'670f24df-9886-4332-b1c6-34c16b955331',campaignId:'b74f98af-ede9-47af-9b19-0720ebb4d2c0',platformType:'google_analytics',reportType:'overview',name:'Dummy',status:'active',scheduleEnabled:true,scheduleRecipients:['dummy@example.test']};
  const context={
    location:{origin:options.wrongOrigin ? 'https://example.test' : 'https://app.mimosaas.app'},
    window:{Clerk:{user:{id:options.foreign ? 'dummy_other' : 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN'},session:{getToken:async()=> 'dummy-token'}}},
    console:{log:value=>logs.push(JSON.parse(value))},
    sessionStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
    document:{getElementById:id=>elements.find(e=>e.id===id),createElement:tag=>({tag,style:{},append(...children){this.children=children;},remove(){}}),body:{appendChild:el=>elements.push(el)}},
    fetch:async(url,init)=>{
      calls.push({url,method:init.method});
      if(init.method==='POST') return {ok:true,status:200,json:async()=>({success:true,deliveryStatus:options.pending?'pending':'delivered'})};
      reads++;
      const row=structuredClone(report);
      if(options.changed && reads>1) row.scheduleRecipients=['changed@example.test'];
      if(options.wrongReport) row.campaignId='different';
      return {ok:true,status:200,json:async()=>[row]};
    },
  };
  await vm.runInNewContext(source,context);
  return {logs,calls,button:elements[0]?.children[1],context};
}
(async()=>{
  const checks=[];
  for(const option of ['wrongOrigin','foreign','already']) {
    const run=await scenario({[option]:true}); assert.equal(run.calls.length,0); assert.equal(run.logs[0].mailgunRecovery,'CHECK_REQUIRED'); checks.push(option+' stops before request');
  }
  const wrong=await scenario({wrongReport:true}); assert.equal(wrong.button,undefined); checks.push('wrong report creates no send button');
  const good=await scenario(); assert.equal(good.calls.length,1); assert.equal(good.calls[0].method,'GET'); checks.push('preparation sends no email');
  await Promise.all([good.button.onclick(),good.button.onclick()]);
  assert.equal(good.calls.filter(x=>x.method==='POST').length,1); assert.equal(good.logs.at(-1).mailgunRecovery,'PASS_MAILGUN_DELIVERY'); checks.push('one click plus duplicate click sends once and requires delivery');
  const pending=await scenario({pending:true}); await pending.button.onclick(); assert.equal(pending.logs.at(-1).mailgunRecovery,'CHECK_REQUIRED'); checks.push('pending is not delivery');
  const changed=await scenario({changed:true}); await changed.button.onclick(); assert.equal(changed.calls.filter(x=>x.method==='POST').length,0); checks.push('recipient change blocks send');
  const switched=await scenario(); switched.context.window.Clerk.user.id='dummy_other'; await switched.button.onclick(); assert.equal(switched.calls.filter(x=>x.method==='POST').length,0); checks.push('account switch blocks send');
  console.log(JSON.stringify({result:'PASS_OFFLINE_MAILGUN_HELPER',checks,realEmails:0,networkRequests:0},null,2));
})().catch(()=>{ console.error('OFFLINE_HELPER_CHECK_FAILED'); process.exitCode=1; });

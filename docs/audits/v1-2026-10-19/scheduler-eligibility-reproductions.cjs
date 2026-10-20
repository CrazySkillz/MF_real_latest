const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function extract(file,name,env){const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(fn);const code=ts.transpileModule(fn.getText(tree).replace(/^export\s+/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(env),code+'\nreturn '+name+';')(...Object.values(env));}
(async()=>{const results=[];
 for(const fixture of [{family:'meta',campaign:null,expected:1},{family:'linkedin',campaign:{id:'fixture',status:'paused',ownerId:''},expected:1},{family:'linkedin',campaign:null,expected:0},{family:'google_ads',campaign:{id:'fixture',status:'paused',ownerId:''},expected:1}]){
  const dispatches=[],downstream=[];let parentReads=0;
  const env={process:{env:{NODE_ENV:'production'}},console:{log(){},warn(){},error(){}},storage:{getCampaign:async()=>{parentReads++;return fixture.campaign;}},getSelectedMetaCampaignIds:()=>['selected'],generateMockMetaData:async()=>dispatches.push('meta'),generateMockLinkedInData:async()=>{dispatches.push('linkedin');return true;},generateMockGoogleAdsData:async()=>dispatches.push('google_ads'),refreshKPIsForCampaign:async()=>downstream.push('kpis'),checkPerformanceAlerts:async()=>downstream.push('alerts'),checkBenchmarkPerformanceAlerts:async()=>downstream.push('benchmarks')};
  // Avoid a real dynamic import: the Meta/LinkedIn wrapper's benchmark call is
  // an independent downstream dependency, replaced with a deterministic module.
  const name=fixture.family==='meta'?'refreshMetaDataForCampaign':fixture.family==='linkedin'?'refreshLinkedInDataForCampaign':'refreshGoogleAdsForCampaign';
  const file=fixture.family==='google_ads'?'server/google-ads-scheduler.ts':`server/${fixture.family}-scheduler.ts`;
  const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(fn);
  const raw=fn.getText(tree).replace(/^export\s+/,'').replace('await import("./benchmark-notifications.js")','await benchmarkModule()');
  env.benchmarkModule=async()=>({checkBenchmarkPerformanceAlerts:env.checkBenchmarkPerformanceAlerts});
  const h=new Function(...Object.keys(env),ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nreturn '+name+';')(...Object.values(env));
  await h('fixture',{campaignId:'fixture',method:'test_mode',selectedCampaignIds:'["selected"]'});assert.equal(dispatches.length,fixture.expected);
  results.push({case:`${fixture.family}: ${fixture.campaign?'paused ownerless parent':'missing parent'}`,parentReads,dispatches,downstream});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/scheduler-eligibility-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Current refresh wrappers with mocked provider/write/downstream dependencies and benchmark import. Proves dispatch eligibility only, not persistence. No provider, database or alert/email call.',results},null,2)+'\n');console.log(`${results.length} scheduler eligibility cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});

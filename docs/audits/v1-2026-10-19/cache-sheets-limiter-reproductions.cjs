const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(file,req){const e={};new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(e,req);return e;}
(async()=>{
 const results=[];
 const {queryClient}=load('client/src/lib/queryClient.ts',require);
 queryClient.setQueryData(['/api/clients'],[{id:'owner-a-client',name:'Owner A fixture'}]);
 let fetched=0;
 const result=await queryClient.fetchQuery({queryKey:['/api/clients'],queryFn:async()=>{fetched++;return[{id:'owner-b-client'}];}});
 assert.equal(fetched,0);assert.equal(result[0].id,'owner-a-client');results.push({case:'Current singleton query cache returns prior identity data without refetch',fetched,result,boundary:'Exact current QueryClient configuration and real installed TanStack library. Simulates identity change using the same key; does not execute Clerk signout/switch or prove live leakage. App/ClientProvider have no identity-key/reset path.'});queryClient.clear();
 const limiters=load('server/middleware/rateLimiter.ts',id=>id==='express-rate-limit'?{default:options=>options}:id==='../internal-request-auth'?{isInternalAutoRefreshRequest:()=>false}:(()=>{throw Error(id);})());
 for(const name of ['oauthRateLimiter','linkedInApiRateLimiter','importRateLimiter']){assert.equal(limiters[name].skip({body:{isTestMode:true}}),true);assert.equal(limiters[name].skip({body:{}}),false);}
 results.push({case:'Caller-controlled test flag bypasses three limiters',limiters:['oauthRateLimiter','linkedInApiRateLimiter','importRateLimiter'],productionGuardPresent:false,boundary:'Exact limiter definitions with rateLimit factory replaced to inspect/execute configured skip functions; no HTTP traffic.'});
 const file='server/auto-refresh-scheduler.ts',sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);let body;sf.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='refreshGoogleSheetsDataForCampaign')body=n.getText(sf);});
 let updates=[],requests=[];const e={};new Function('exports','storage','fetch','console',compile(body))(e,{getCampaign:async()=>({platform:'google-sheets'}),getGoogleSheetsConnections:async()=>[{id:'fixture',spreadsheetId:'fixture',sheetName:'Tab',accessToken:'fixture'}],updateGoogleSheetsConnection:async(...args)=>updates.push(args)},async(url)=>{requests.push(url);return{ok:true,status:200,json:async()=>({values:[['amount'],...Array(999).fill(['1'])]})};},{log(){},warn(){},error(){}});
 assert.equal(await e.refreshGoogleSheetsDataForCampaign('fixture'),true);assert.ok(decodeURIComponent(requests[0]).includes('A1:Z1000'));assert.equal(updates[0][1].cachedData.totalRows,999);results.push({case:'Standalone Sheets refresh caches fixed1000-row range as refreshed dataset',range:decodeURIComponent(requests[0]).split('/values/')[1],cachedRows:updates[0][1].cachedData.totalRows,updatedFreshness:!!updates[0][1].lastDataRefreshAt,boundary:'Exact refresh function; provider fixture returns the requested first999 data rows. No completeness metadata request is made; larger sheet remainder cannot be certified.'});
 fs.writeFileSync('docs/audits/v1-2026-10-19/cache-sheets-limiter-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} cache/Sheets/limiter cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});

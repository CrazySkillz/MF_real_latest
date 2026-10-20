// Isolated credential migration interleaving. All tokens/keys are generated fixture values.
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const vault={};new Function('exports','require','process',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault,require,{env:{NODE_ENV:'production',TOKEN_ENCRYPTION_KEY:'isolated-audit-encryption-key-not-production'}});
const sf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),methods=new Map();let hydrate;
function visit(n){if(ts.isMethodDeclaration(n))methods.set(n.name.getText(sf),n.getText(sf));if(ts.isFunctionDeclaration(n)&&n.name?.text==='hydrateDecryptedTokens')hydrate=n.getText(sf);ts.forEachChild(n,visit);}visit(sf);
const cases=[['getGoogleSheetsConnections','googleSheetsConnections'],['getHubspotConnections','hubspotConnections'],['getHubspotConnection','hubspotConnections'],['getSalesforceConnections','salesforceConnections'],['getSalesforceConnection','salesforceConnections'],['getShopifyConnections','shopifyConnections'],['getShopifyConnection','shopifyConnections'],['getLinkedInConnection','linkedinConnections'],['getMetaConnection','metaConnections'],['getGoogleAdsConnection','googleAdsConnections'],['getGA4Connections','ga4Connections']];
(async()=>{const results=[];
 for(const [method,tableName] of cases){
  let current={id:'fixture-connection',campaignId:'fixture-campaign',isActive:true,method:'access_token',mappingConfig:'{}',accessToken:'fixture-old-access',refreshToken:'fixture-old-refresh',clientSecret:null,encryptedTokens:null},reads=0,writes=0;
  const rotated=vault.buildEncryptedTokens({accessToken:'fixture-new-access',refreshToken:'fixture-new-refresh'});
  const db = {
   select() {
    return {
     from() { return this; }, where() { return this; }, orderBy() { return this; }, limit() { return this; },
     then(resolve, reject) {
      try {
       reads++;
       assert.equal(reads, 1);
       const observed = structuredClone(current);
       current = {...current, accessToken: null, refreshToken: null, encryptedTokens: rotated};
       return Promise.resolve([observed]).then(resolve, reject);
      } catch (error) { return Promise.reject(error).then(resolve, reject); }
     },
    };
   },
   update() {
    return {set: data => ({where: async predicate => {
     if (predicate(current)) { current = {...current, ...data}; writes++; }
     return {rowCount: writes};
    }})};
   },
  };
  const table=new Proxy({}, {get:(_t,key)=>String(key)}),eq=(column,value)=>row=>row[column]===value;
  const env={db,[tableName]:table,eq,and:(...clauses)=>row=>clauses.every(f=>f(row)),or:(...clauses)=>row=>clauses.some(f=>f(row)),isNull:column=>row=>row[column]==null,desc:value=>value,
   sql:(strings,...values)=>{assert.ok(strings.join('').includes('IS NOT DISTINCT FROM'));return row=>(row[values[0]]??null)===(values[1]??null);},
   buildEncryptedTokens:vault.buildEncryptedTokens,decryptTokens:vault.decryptTokens,assertProductionTokenEncryptionConfigured:vault.assertProductionTokenEncryptionConfigured,
   hydrateGoogleSheetsConnectionForRead:async row=>row,hydrateGA4ServiceAccountConnection:async row=>row};
  const storage=new Function(...Object.keys(env),compile(hydrate+'\nclass FixtureStorage {'+methods.get(method)+'}\nconst instance=new FixtureStorage();')+'\nreturn instance;')(...Object.values(env));
  if(method==='getGA4Connections')await storage[method]('fixture-campaign',{resolveRuntimeCredentials:false});else await storage[method]('fixture-campaign');
  const decrypted=vault.decryptTokens(current.encryptedTokens),preserved=decrypted.accessToken==='fixture-new-access';
  assert.equal(preserved,method==='getGA4Connections');assert.equal(writes,method==='getGA4Connections'?0:1);
  results.push({case:method+' legacy plaintext read races a completed credential update',method,table:tableName,readCount:reads,migrationWrites:writes,newCredentialPreserved:preserved,staleCredentialRestored:!preserved});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/token-backfill-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact storage getter/hydration methods and real tokenVault encryption/decryption under fixture-only environment. In-memory query builder models one SELECT snapshot then a completed credential update before lazy migration WHERE evaluation. No PostgreSQL/provider/OAuth exchange or production credential access. GA4 compare-and-set is a positive control; source-specific post-read helpers are identities.',results},null,2)+'\n');
 console.log(`${results.length} isolated credential-backfill interleavings executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});

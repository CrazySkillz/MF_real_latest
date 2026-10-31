// Exact current getters/vault, real loopback PostgreSQL, separate writer/reader
// processes. Synthetic credentials only. Never loads .env or provider clients.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const {spawnSync}=require('node:child_process'),{Pool}=require('pg'),orm=require('drizzle-orm'),{drizzle}=require('drizzle-orm/node-postgres'),{PgDialect}=require('drizzle-orm/pg-core');
assert.equal(process.env.DATABASE_URL||'','');
const target='postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test';
const cases=[['getGoogleSheetsConnections','googleSheetsConnections'],['getHubspotConnections','hubspotConnections'],['getHubspotConnection','hubspotConnections'],['getSalesforceConnections','salesforceConnections'],['getSalesforceConnection','salesforceConnections'],['getShopifyConnections','shopifyConnections'],['getShopifyConnection','shopifyConnections'],['getLinkedInConnection','linkedinConnections'],['getMetaConnection','metaConnections'],['getGoogleAdsConnection','googleAdsConnections']];
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const schema={},vault={},processFixture={env:{NODE_ENV:'production',TOKEN_ENCRYPTION_KEY:'synthetic-lifecycle-key'}};
new Function('exports','require',compile(fs.readFileSync('shared/schema.ts','utf8')))(schema,require);
new Function('exports','require','process',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault,require,processFixture);
const source=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),methods=new Map();let hydrate;
function visit(n){if(ts.isMethodDeclaration(n))methods.set(n.name.getText(source),n.getText(source));if(ts.isFunctionDeclaration(n)&&n.name?.text==='hydrateDecryptedTokens')hydrate=n.getText(source);ts.forEachChild(n,visit)}visit(source);
function storage(db,method){const deps={...schema,...orm,...vault,db,hydrateGoogleSheetsConnectionForRead:async r=>r,devLog(){}};assert.ok(methods.has(method));return new Function(...Object.keys(deps),compile(`${hydrate}\nclass S{${methods.get(method)}}return new S()`))(...Object.values(deps))}
const tokenValues=label=>({accessToken:`synthetic-${label}`,refreshToken:`synthetic-refresh-${label}`,clientSecret:`synthetic-secret-${label}`});
function values(table,overrides){const result={};for(const[key,c]of Object.entries(orm.getTableColumns(table))){if(c.notNull&&c.default===undefined&&!c.defaultFn)result[key]=c.getSQLType().startsWith('numeric')?'1':c.dataType==='number'?1:c.dataType==='boolean'?false:c.dataType==='date'?new Date('2026-10-01'):c.dataType==='json'?{}:'fixture';}return{...result,...Object.fromEntries(Object.entries(overrides).filter(([k])=>k in orm.getTableColumns(table)))}}
async function child(phase,namespace){
 assert.match(namespace,/^b1_credentials_[a-f0-9]{32}$/);assert.ok(['write','read'].includes(phase));
 const pool=new Pool({connectionString:target,options:`-c search_path=${namespace}`,max:2,statement_timeout:15000}),db=drizzle(pool),checks=[];
 try{for(const[method,name]of cases){const table=schema[name],campaign=method,read=()=>storage(db,method)[method](campaign),saved=()=>db.select().from(table).where(orm.eq(table.campaignId,campaign));
  const fields=name==='shopifyConnections'?['accessToken']:name==='metaConnections'?['accessToken','refreshToken']:['accessToken','refreshToken','clientSecret'];
  const tokens=label=>Object.fromEntries(Object.entries(tokenValues(label)).map(([k,v])=>[k,fields.includes(k)?v:null]));
  const encrypted=label=>({...Object.fromEntries(fields.map(k=>[k,null])),encryptedTokens:vault.buildEncryptedTokens(tokens(label))});
  if(phase==='read'){
   const rows=await saved();assert.equal(rows.length,1);assert.deepEqual(vault.decryptTokens(rows[0].encryptedTokens),tokens('replacement'));
   const result=await read(),connection=Array.isArray(result)?result[0]:result;assert.equal(connection.accessToken,tokens('replacement').accessToken);assert.equal(connection.campaignId,campaign);
   for(const field of fields)assert.equal(rows[0][field],null);
   checks.push(`${method}: fresh process decrypts replacement; plaintext remains empty`);continue;
  }
  const foreign=(await db.insert(table).values(values(table,{campaignId:campaign+'-foreign',method:'access_token',mappingConfig:'{}',isActive:true,...encrypted('foreign')})).returning())[0];
  for(const mode of ['migration','renewal','plaintext-change','delete','replace']){
   await db.delete(table).where(orm.eq(table.campaignId,campaign));
   const initial=(await db.insert(table).values(values(table,{campaignId:campaign,method:'access_token',mappingConfig:'{}',isActive:true,...tokens('old'),encryptedTokens:null})).returning())[0];
   let ran=false;
   const racing=new Proxy(db,{get(target,key){if(key!=='update')return typeof target[key]==='function'?target[key].bind(target):target[key];return selected=>({set:updates=>({where:async predicate=>{
    assert.equal(selected,table);assert.equal(ran,false);ran=true;
    if(mode==='renewal')await db.update(table).set(encrypted('replacement')).where(orm.eq(table.id,initial.id));
    if(mode==='plaintext-change')await db.update(table).set(tokens('replacement')).where(orm.eq(table.id,initial.id));
    if(mode==='delete'||mode==='replace')await db.delete(table).where(orm.eq(table.id,initial.id));
    if(mode==='replace')await db.insert(table).values({...initial,id:crypto.randomUUID(),...encrypted('replacement')});
    return db.update(table).set(updates).where(predicate);
   }})})}});
   await storage(racing,method)[method](campaign);assert.equal(ran,true);
   let rows=await saved();
   if(mode==='delete'){assert.equal(rows.length,0);const result=await read();assert.ok(Array.isArray(result)?result.length===0:result===undefined)}
   else{
    assert.equal(rows.length,1);assert.equal(rows[0].campaignId,campaign);
    if(mode==='plaintext-change'){assert.equal(rows[0].encryptedTokens,null);assert.equal(rows[0].accessToken,tokens('replacement').accessToken);await read();rows=await saved()}
    assert.deepEqual(vault.decryptTokens(rows[0].encryptedTokens),tokens(mode==='migration'?'old':'replacement'));
    for(const field of fields)assert.equal(rows[0][field],null);
    assert.equal(rows[0].id===initial.id,mode!=='replace');
    for(const[key,value]of Object.entries(initial))if(!['id','encryptedTokens','accessToken','refreshToken','clientSecret'].includes(key))assert.deepEqual(rows[0][key],value,`${method} ${mode} ${key}`);
   }
   assert.deepEqual((await db.select().from(table).where(orm.eq(table.id,foreign.id)))[0],foreign);
   checks.push(`${method}: ${mode}; foreign row and noncredential fields preserved`);
  }
 }}finally{await pool.end()}
 console.log(JSON.stringify({phase,pid:process.pid,result:'PASS',checks}));
}
async function main(){
 const namespace='b1_credentials_'+crypto.randomUUID().replaceAll('-',''),admin=new Pool({connectionString:target,max:1}),receipt={at:new Date().toISOString(),boundary:'Exact ten storage getters and vault; synthetic competing writes and separate Node restart against isolated real PostgreSQL. Not provider OAuth reconnect, Render restart or saved-key recovery.',phases:[],storageSha256:crypto.createHash('sha256').update(fs.readFileSync('server/storage.ts')).digest('hex')};let created=false;
 try{
  assert.equal((await admin.query('SELECT inet_server_port() port')).rows[0].port,55444);await admin.query(`CREATE SCHEMA "${namespace}"`);created=true;await admin.query(`SET search_path TO "${namespace}"`);const dialect=new PgDialect();
  for(const name of new Set(cases.map(c=>c[1]))){const table=schema[name],columns=Object.values(orm.getTableColumns(table)).map(c=>{const v=c.default,def=v instanceof orm.SQL?dialect.sqlToQuery(v).sql:typeof v==='string'?`'${v.replaceAll("'","''")}'`:String(v);return `"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${v!==undefined?` DEFAULT ${def}`:''}${c.primary?' PRIMARY KEY':''}`});await admin.query(`CREATE TABLE "${orm.getTableName(table)}" (${columns.join(',')})`)}
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k)));
  Object.assign(env,{DATABASE_URL:'',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
  for(const phase of ['write','read']){const r=spawnSync(process.execPath,[__filename,'--child',phase,namespace],{env,encoding:'utf8',windowsHide:true,timeout:120000});assert.equal(r.status,0,r.stderr);receipt.phases.push(JSON.parse(r.stdout))}
  assert.notEqual(receipt.phases[0].pid,receipt.phases[1].pid);receipt.result='PASS';
 }catch(e){receipt.result='FAIL';receipt.error=e.message;process.exitCode=1}
 finally{if(created){assert.match(namespace,/^b1_credentials_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);receipt.schemaRemoved=(await admin.query('SELECT count(*)::int n FROM pg_namespace WHERE nspname=$1',[namespace])).rows[0].n===0}await admin.end();fs.writeFileSync(path.join(__dirname,'credential-lifecycle.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:receipt.result,checks:receipt.phases.reduce((n,p)=>n+p.checks.length,0),schemaRemoved:receipt.schemaRemoved,error:receipt.error}))}
}
if(process.argv[2]==='--child')child(process.argv[3],process.argv[4]).catch(e=>{console.error(e.message);process.exitCode=1});else main().catch(e=>{console.error(e.message);process.exitCode=1});

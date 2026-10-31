// Executes current reader bodies/SQL against a new loopback-only PostgreSQL schema.
// No .env, application startup, provider requests or production connection.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const {Pool}=require('pg'),orm=require('drizzle-orm'),{drizzle}=require('drizzle-orm/node-postgres');
const connectionString=process.env.GA4_TEST_DATABASE_URL;
assert.ok(connectionString&&!process.env.DATABASE_URL,'Isolated test URL required');
const url=new URL(connectionString);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55444');assert.equal(url.pathname,'/ga4_alignment_test');assert.equal(url.search,'');
const schemaName='b1_spend_readers_'+crypto.randomBytes(8).toString('hex');
const admin=new Pool({connectionString,max:1}),pool=new Pool({connectionString,max:1,options:`-c search_path=${schemaName}`,statement_timeout:10000});
const sourceNames=['server/storage.ts','server/routes-oauth.ts','server/scheduler.ts','shared/schema.ts'];
const sources=Object.fromEntries(sourceNames.map(f=>[f,fs.readFileSync(f,'utf8')]));
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const schemaExports={};new Function('exports','require',transpile(sources['shared/schema.ts']))(schemaExports,require);
const db=drizzle(pool,{schema:schemaExports});
const storageAst=ts.createSourceFile('storage.ts',sources['server/storage.ts'],ts.ScriptTarget.Latest,true);
const methods=[],named=new Map();
function visit(n){if(ts.isMethodDeclaration(n)&&['getSpendTotalForRange','getSpendBreakdownBySource'].includes(n.name.getText(storageAst)))methods.push(n.getText(storageAst));if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))named.set(n.name.text,`const ${n.getText(storageAst)};`);ts.forEachChild(n,visit)}visit(storageAst);assert.equal(methods.length,2);
const env={db,...orm,...schemaExports};
const storage=new Function(...Object.keys(env),transpile(named.get('spendPlatformContextPredicate')+'\nclass Readers {\n'+methods.join('\n')+'\n}\n')+'return new Readers();')(...Object.values(env));
const queries=[];
for(const file of ['server/routes-oauth.ts','server/scheduler.ts']){
 const ast=ts.createSourceFile(file,sources[file],ts.ScriptTarget.Latest,true);
 function scan(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='db.execute'&&n.arguments[0]?.getText(ast).includes('FROM spend_records sr'))queries.push({file,line:ast.getLineAndCharacterOfPosition(n.pos).line+1,expression:n.arguments[0].getText(ast)});ts.forEachChild(n,scan)}scan(ast);
}
assert.equal(queries.length,3,'Review any new direct spend SQL reader');
const receipt={at:new Date().toISOString(),result:'NOT_VERIFIED',productionAccess:false,providerCalls:0,checks:[],sourceHashes:Object.fromEntries(sourceNames.map(f=>[f,crypto.createHash('sha256').update(sources[f]).digest('hex')]))};let created=false;
const record=(name,passed)=>{assert.ok(passed,name);receipt.checks.push({name,passed:true})};
(async()=>{try{
 await admin.query(`CREATE SCHEMA ${schemaName}`);created=true;
 for(const table of [schemaExports.spendSources,schemaExports.spendRecords,schemaExports.revenueSources,schemaExports.revenueRecords]){
  const columns=Object.values(orm.getTableColumns(table)).map(c=>`"${c.name}" ${c.getSQLType()}`);
  await pool.query(`CREATE TABLE "${orm.getTableName(table)}" (${columns.join(',')})`);
 }
 const active=crypto.randomUUID(),inactive=crypto.randomUUID(),foreign=crypto.randomUUID();
 await pool.query("INSERT INTO spend_sources(id,campaign_id,source_type,platform_context,currency,is_active,display_name) VALUES($1,'owned','connector_derived','ga4','EUR',true,'fixture'),($2,'owned','manual','ga4','EUR',false,'inactive'),($3,'foreign','manual','ga4','EUR',true,'foreign')",[active,inactive,foreign]);
 await pool.query("INSERT INTO spend_records(id,campaign_id,spend_source_id,date,spend,currency,source_type) VALUES('orphan-linkedin','owned','linkedin_daily_metrics','2026-10-30',100000,'EUR','linkedin_api'),('orphan-meta','owned','meta_daily_metrics','2026-10-30',200000,'EUR','meta_api'),('orphan-parent','deleted','missing','2026-10-30',300000,'EUR','meta_api'),('inactive','owned',$1,'2026-10-30',100,'EUR','manual'),('foreign','foreign',$2,'2026-10-30',200,'EUR','manual'),('future','owned',$3,'2026-11-01',300,'EUR','connector_derived')",[inactive,foreign,active]);
 for(const positive of [false,true]){
  if(positive)await pool.query("INSERT INTO spend_records(id,campaign_id,spend_source_id,date,spend,currency,source_type) VALUES('eligible','owned',$1,'2026-10-30',0.02,'EUR','connector_derived')",[active]);
  const total=await storage.getSpendTotalForRange('owned','2026-10-01','2026-10-30','ga4');
  const breakdown=await storage.getSpendBreakdownBySource('owned','2026-10-01','2026-10-30','ga4');
  record(`storage total: ${positive?'positive source preserved':'orphans/inactive/foreign/out-of-range excluded'}`,total.totalSpend===(positive?0.02:0));
  record(`storage provenance: ${positive?'exact eligible source':'no invented sources'}`,JSON.stringify(total.sourceIds)===JSON.stringify(positive?[active]:[]));
  record(`storage breakdown: ${positive?'exact two cents':'empty'}`,breakdown.length===(positive?1:0)&&(!positive||breakdown[0].spend===0.02));
  for(const q of queries){
   const bindings={sql:orm.sql,campaignId:'owned',startDate:'2026-10-01',endDate:'2026-10-30',financialSpend:total,financialRevenue:{sourceIds:[]}};
   const query=new Function(...Object.keys(bindings),'return '+transpile(q.expression).trim().replace(/;$/,''))(...Object.values(bindings));
   const rows=(await db.execute(query)).rows;
   const sum=rows.reduce((n,r)=>n+Number(r.total_spend??r.spend??r.value??0),0);
   record(`${q.file}:${q.line} ${positive?'positive preserved':'orphans excluded'}`,Math.abs(sum-(positive?0.02:0))<0.000001);
  }
 }
 receipt.result='PASS';receipt.limits='Current normalized-spend readers only. Does not reconstruct historical campaign overwrite values, certify cached historical reports, or certify every platform analytics formula.';
}catch(e){receipt.error=e.message;process.exitCode=1}finally{
 await pool.end();if(created){await admin.query(`DROP SCHEMA ${schemaName} CASCADE`);receipt.exactIsolatedSchemaRemoved=true}await admin.end();
 fs.writeFileSync(path.join(__dirname,'spend-readers.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}})();

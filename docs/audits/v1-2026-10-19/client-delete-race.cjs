// Executes the current extracted storage method against a disposable local PostgreSQL schema.
const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Pool}=require('pg');const {drizzle}=require('drizzle-orm/node-postgres');
const {pgTable,text}=require('drizzle-orm/pg-core');const {and,eq,or,isNull,sql}=require('drizzle-orm');
const url=new URL(process.env.NOTIFICATION_TEST_DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/notifications_test');assert.equal(url.port,'55442');
assert.equal(String(process.env.DATABASE_URL||''),'');
const schema='v1_client_race_'+crypto.randomUUID().replaceAll('-','');
const pool=new Pool({connectionString:url.href,options:`-c search_path=${schema}`});
const admin=new Pool({connectionString:url.href});
const clients=pgTable('clients',{id:text('id'),ownerId:text('owner_id'),name:text('name'),createdAt:text('created_at')});
const campaigns=pgTable('campaigns',{id:text('id'),ownerId:text('owner_id'),clientId:text('client_id')});
(async()=>{
 try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await pool.query('CREATE TABLE clients(id text primary key, owner_id text, name text, created_at text)');
  await pool.query('CREATE TABLE campaigns(id text primary key, owner_id text, client_id text)');
  await pool.query("INSERT INTO clients VALUES('client-fixture','owner-fixture','Fixture','2026-10-19')");
  const realDb=drizzle(pool);let inserted=false;
  const db=new Proxy(realDb,{get(target,key){if(key==='transaction')return async cb=>{
    // Interleaving: an owner-authorized creation validated this client before deletion.
    await pool.query("INSERT INTO campaigns VALUES('concurrent-campaign','owner-fixture','client-fixture')");inserted=true;
    return target.transaction(cb);
  };const value=target[key];return typeof value==='function'?value.bind(target):value}});
  const sf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true);
  const cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage');
  const method=cls.members.find(n=>n.name?.getText(sf)==='deleteClientCascade');assert.ok(method);
  const source='class Extracted { '+method.getText(sf)+' }';
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const instance=new Function('db','clients','campaigns','and','eq','or','isNull','sql',js+';return new Extracted();')(db,clients,campaigns,and,eq,or,isNull,sql);
  const reportedSuccess=await instance.deleteClientCascade('owner-fixture','client-fixture');
  const remainingClients=(await pool.query('SELECT id FROM clients')).rows;
  const remainingCampaigns=(await pool.query('SELECT id,client_id FROM campaigns')).rows;
  assert.ok(inserted);assert.equal(reportedSuccess,true);assert.equal(remainingClients.length,0);assert.equal(remainingCampaigns.length,1);
  const result={case:'Concurrent campaign creation between client child enumeration and transaction leaves orphan',method:'server/storage.ts:6742 deleteClientCascade (exact extraction)',schemaBoundary:'Minimal fixture tables reflecting absent client foreign key in shared/schema.ts; no application database',reportedSuccess,remainingClients,remainingCampaigns,productionImpact:'Not inspected; no production mutation'};
  fs.writeFileSync('docs/audits/v1-2026-10-19/client-delete-race.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 } finally {await pool.end();assert.match(schema,/^v1_client_race_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}
})().catch(e=>{console.error(e);process.exitCode=1});

// Exact current CSV write and ordinary GA4 write wrapper against an isolated PostgreSQL schema.
const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),{pgTable,text,boolean}=require('drizzle-orm/pg-core');
const {and,eq,or,isNull,inArray,sql}=require('drizzle-orm');
const url=new URL(process.env.NOTIFICATION_TEST_DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55442');assert.equal(url.pathname,'/notifications_test');assert.equal(process.env.DATABASE_URL||'','');
const schema='v1_ga4_parent_'+crypto.randomUUID().replaceAll('-','');
const admin=new Pool({connectionString:url.href}),pool=new Pool({connectionString:url.href,options:`-c search_path=${schema}`});
const campaigns=pgTable('campaigns',{id:text('id')});
const revenueSources=pgTable('revenue_sources',{id:text('id').default(sql`gen_random_uuid()`),campaignId:text('campaign_id'),sourceType:text('source_type'),platformContext:text('platform_context'),isActive:boolean('is_active'),currency:text('currency'),mappingConfig:text('mapping_config')});
const revenueRecords=pgTable('revenue_records',{campaignId:text('campaign_id'),revenueSourceId:text('revenue_source_id'),sourceType:text('source_type'),date:text('date'),revenue:text('revenue'),currency:text('currency')});
(async()=>{try{
 await admin.query(`CREATE SCHEMA "${schema}"`);
 await pool.query('CREATE TABLE campaigns(id text primary key)');
 await pool.query('CREATE TABLE revenue_sources(id text primary key default gen_random_uuid(),campaign_id text not null,source_type text not null,platform_context text,is_active boolean not null,currency text,mapping_config text)');
 await pool.query('CREATE TABLE revenue_records(campaign_id text not null,revenue_source_id text not null,source_type text,date text not null,revenue numeric(12,2) not null,currency text)');
 const sf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage');
 const methods=['writeGA4RefreshInputChange','replaceGa4CsvRevenueSourceWithRecords'].map(name=>{const n=cls.members.find(n=>n.name?.getText(sf)===name);assert.ok(n);return n.getText(sf);});
 const js=ts.transpileModule('class Extracted {'+methods.join('\n')+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const instance=new Function('db','campaigns','revenueSources','revenueRecords','and','eq','or','isNull','inArray','sql',js+';return new Extracted();')(drizzle(pool),campaigns,revenueSources,revenueRecords,and,eq,or,isNull,inArray,sql);
 const results=[];
 for(const missing of [false,true]){
  const id=missing?'deleted-parent':'existing-parent';await pool.query('INSERT INTO campaigns VALUES($1)',[id]);
  // An owner-authorized import started while the parent existed; deletion completed before its final write.
  if(missing)await pool.query('DELETE FROM campaigns WHERE id=$1',[id]);
  const saved=await instance.replaceGa4CsvRevenueSourceWithRecords(id,null,{campaignId:id,currency:'USD',mappingConfig:'{}'},[{campaignId:id,date:'2026-10-18',revenue:'100.00',currency:'USD'}]);
  const counts=(await pool.query('SELECT (SELECT count(*) FROM campaigns WHERE id=$1)::int AS parents,(SELECT count(*) FROM revenue_sources WHERE campaign_id=$1)::int AS sources,(SELECT count(*) FROM revenue_records WHERE campaign_id=$1)::int AS records',[id])).rows[0];
  assert.ok(saved.id);assert.deepEqual(counts,{parents:missing?0:1,sources:1,records:1});results.push({case:missing?'Parent deleted before final write: committed orphan source and record':'Existing parent control: committed source and record',counts});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-parent-delete-race.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact two storage methods; minimal isolated tables preserve relevant not-null/no-FK schema. Durable work table absent (supported ordinary-save branch). Parent deletion is the completed interleaving before save; full HTTP/upload and deployed migrations not exercised.',results},null,2)+'\n');console.log(`${results.length} real PostgreSQL GA4 parent-write cases executed`);
 }finally{await pool.end();assert.match(schema,/^v1_ga4_parent_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

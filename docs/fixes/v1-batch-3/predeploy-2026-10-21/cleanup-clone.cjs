// Remove only the disposable database created by this packet's restore.
const fs=require('node:fs'),assert=require('node:assert/strict'),{Client}=require('pg');
const dir='docs/fixes/v1-batch-3/predeploy-2026-10-21',target='v1_batch3_production_clone';
const c=new Client({host:'127.0.0.1',port:55443,user:'v1_audit',database:'postgres',statement_timeout:15000});
const result={at:new Date().toISOString(),target:'127.0.0.1:55443/'+target};
(async()=>{
 const rehearsal=JSON.parse(fs.readFileSync(dir+'/clone-results.json','utf8'));assert.equal(rehearsal.result,'PASS');assert.equal(rehearsal.target,result.target);
 await c.connect();const id=(await c.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];assert.equal(id.host,'127.0.0.1');assert.equal(id.port,55443);assert.equal(id.db,'postgres');
 assert.equal((await c.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',[target])).rows[0].n,0);
 assert.equal((await c.query('SELECT datistemplate FROM pg_database WHERE datname=$1',[target])).rows[0]?.datistemplate,false);
 await c.query('DROP DATABASE v1_batch3_production_clone');
 result.cloneAbsent=(await c.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1',[target])).rows[0].n===0;assert.ok(result.cloneAbsent);
 result.otherClientConnections=(await c.query("SELECT count(*)::int n FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()")).rows[0].n;
 result.encryptedBackupRetained=true;result.result='PASS';
})().catch(e=>{result.result='FAIL';result.errorCode=e.code||e.name;process.exitCode=1;}).finally(async()=>{await c.end();fs.writeFileSync(dir+'/cleanup.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));});

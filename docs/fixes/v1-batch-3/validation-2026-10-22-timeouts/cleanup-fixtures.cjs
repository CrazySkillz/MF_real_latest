const fs=require('node:fs'),assert=require('node:assert/strict'),{Client}=require('pg');
(async()=>{const result={at:new Date().toISOString(),databases:[]};
 for(const database of ['ga4_alignment_test','notifications_test']){
  const c=new Client({host:'127.0.0.1',port:55443,user:'v1_audit',database});await c.connect();
  try{const identity=(await c.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];assert.equal(identity.db,database);assert.equal(identity.host,'127.0.0.1');assert.equal(identity.port,55443);
   const schemas=(await c.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'")).rows[0].n;
   const clients=(await c.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n;
   assert.equal(schemas,0);assert.equal(clients,0);result.databases.push({database,remainingFixtureSchemas:schemas,otherClientConnections:clients});
  }finally{await c.end();}
 }
 result.result='PASS';fs.writeFileSync(__dirname+'/fixture-cleanup.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.name+': local cleanup verification failed');process.exitCode=1;});

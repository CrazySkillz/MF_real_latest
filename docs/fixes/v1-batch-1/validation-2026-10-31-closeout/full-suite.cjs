const {Client}=require('pg'),{spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const db=new Client({connectionString:'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test'}),r={at:new Date().toISOString(),result:'NOT_VERIFIED'};
(async()=>{try{
 await db.connect();assert.equal((await db.query('SELECT inet_server_port() port')).rows[0].port,55444);
 r.createdNotificationsDatabase=!(await db.query("SELECT 1 FROM pg_database WHERE datname='notifications_test'")).rowCount;
 if(r.createdNotificationsDatabase)await db.query('CREATE DATABASE notifications_test');
 r.exitCode=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[path.join(__dirname,'run-checks.cjs'),'full'],{windowsHide:true,stdio:'inherit'});c.on('error',reject);c.on('exit',resolve)});
 r.result=r.exitCode===0?'PASS':'FAIL';process.exitCode=r.exitCode??1;
}catch{r.result='FAIL';process.exitCode=1}finally{
 if(r.createdNotificationsDatabase){await db.query('DROP DATABASE notifications_test');r.notificationsDatabaseRemoved=true}
 await db.end();r.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'full-suite.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));
}})();

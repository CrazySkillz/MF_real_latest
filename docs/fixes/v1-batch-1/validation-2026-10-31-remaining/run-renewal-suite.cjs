// CI-equivalent current suite, isolated loopback databases, sanitized environment,
// no external network. Preserve existing generated PDF artifacts.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{Client}=require('pg'),assert=require('node:assert/strict');
const receipt={at:new Date().toISOString(),result:'NOT_VERIFIED',externalNetworkBlocked:true,createdNotificationDatabase:false};
const admin=new Client({connectionString:'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test'});
(async()=>{let fd;try{
 await admin.connect();assert.equal((await admin.query('SELECT inet_server_port() AS port')).rows[0].port,55444);
 if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='notifications_test'")).rowCount){await admin.query('CREATE DATABASE notifications_test');receipt.createdNotificationDatabase=true}
 const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k))env[k]=v;
 Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',GA4_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test',NOTIFICATION_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/notifications_test',V1_BATCH7_PRESERVE_ARTIFACTS:'1',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
 fd=fs.openSync(path.join(__dirname,'renewal-full-suite.log'),'w');
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','scripts/ga4-kpi-current-version-test-boundary.ts','current'],{env,stdio:['ignore',fd,fd],windowsHide:true});child.on('error',reject);child.on('exit',resolve)});
 receipt.exitCode=code;receipt.result=code===0?'PASS':'FAIL';process.exitCode=code??1;
}catch(e){receipt.error=e.message;process.exitCode=1}finally{
 if(fd!==undefined)fs.closeSync(fd);
 if(receipt.createdNotificationDatabase){try{await admin.query('DROP DATABASE notifications_test');receipt.notificationDatabaseRemoved=true}catch(e){receipt.cleanupError=e.code;process.exitCode=1}}
 await admin.end();receipt.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'renewal-full-suite.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}})();

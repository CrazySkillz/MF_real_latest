// Backup reads production; restore writes only an explicitly named localhost fixture DB.
// The archive is encrypted while streaming; its key is protected by Windows CurrentUser DPAPI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process'),{pipeline}=require('node:stream/promises'),{parseEnv}=require('node:util');
const {Client}=require('pg');
const privateDir=path.resolve('audit-temp/v1-batch3-predeploy-private');
const bin='C:/Program Files/PostgreSQL/18/bin', target='v1_batch3_production_clone';
const archive=path.join(privateDir,'production.dump.aes'), keyFile=path.join(privateDir,'backup-key.dpapi');
const output='docs/fixes/v1-batch-3/predeploy-2026-10-21/backup-restore-results.json';
const mode=process.argv[2],result=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(k)));
function dpapi(input,protect){
 const code=`Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{input:input.toString('base64'),encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw Object.assign(new Error(),{code:'DPAPI_FAILED'});
 return Buffer.from(r.stdout.trim(),'base64');
}
function child(exe,args,env,label){
 const c=spawn(path.join(bin,exe),args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const log=fs.createWriteStream(path.join(privateDir,label+'.stderr'));c.stderr.pipe(log);
 const done=new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',code=>code===0?resolve():reject(Object.assign(new Error(),{code:label+'_EXIT_'+code})));});
 return {c,done};
}
(async()=>{
 if(mode==='backup'){
  if(fs.existsSync(archive))throw Object.assign(new Error(),{code:'BACKUP_ALREADY_EXISTS'});
  const env=parseEnv(fs.readFileSync('.env','utf8')),u=new URL(env.DATABASE_URL);
  const caFile=path.join(privateDir,'node-public-root-certificates.pem');fs.writeFileSync(caFile,require('node:tls').rootCertificates.join('\n'));
  const pgEnv={...cleanEnv,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:caFile,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=3000'};
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12);
  fs.writeFileSync(keyFile,dpapi(key,true));fs.writeFileSync(archive,iv);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  result.backup={startedAt:new Date().toISOString(),productionReadOnly:true,tlsVerification:true,format:'pg_dump custom archive, AES-256-GCM; key CurrentUser DPAPI; directory user-only ACL; excluded by local .gitignore'};
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  const {c,done}=child('pg_dump.exe',['--format=custom','--no-owner','--no-privileges','--lock-wait-timeout=3s'],pgEnv,'backup');c.stdin.end();
  await Promise.all([done,pipeline(c.stdout,cipher,fs.createWriteStream(archive,{flags:'a'}))]);
  fs.appendFileSync(archive,cipher.getAuthTag());key.fill(0);
  result.backup.completedAt=new Date().toISOString();result.backup.encryptedBytes=fs.statSync(archive).size;result.backup.result='PASS';delete result.error;
 }else if(mode==='restore'){
  if(result.backup?.result!=='PASS')throw Object.assign(new Error(),{code:'BACKUP_NOT_COMPLETE'});
  const admin=new Client({host:'127.0.0.1',port:55443,user:'v1_audit',database:'postgres'});await admin.connect();
  try {const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target]);if(exists.rowCount)throw Object.assign(new Error(),{code:'CLONE_ALREADY_EXISTS'});await admin.query(`CREATE DATABASE ${target}`);}finally{await admin.end();}
  const key=dpapi(fs.readFileSync(keyFile),false),size=fs.statSync(archive).size,fd=fs.openSync(archive,'r'),iv=Buffer.alloc(12),tag=Buffer.alloc(16);
  fs.readSync(fd,iv,0,12,0);fs.readSync(fd,tag,0,16,size-16);fs.closeSync(fd);
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
  result.restore={startedAt:new Date().toISOString(),target:'127.0.0.1:55443/'+target,providersAndWorkers:'Not started',result:'RUNNING'};
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  const env={...cleanEnv,PGHOST:'127.0.0.1',PGPORT:'55443',PGUSER:'v1_audit',PGDATABASE:target,PGSSLMODE:'disable',PGPASSWORD:'',PGOPTIONS:''};
  const {c,done}=child('pg_restore.exe',['--dbname='+target,'--exit-on-error','--no-owner','--no-privileges'],env,'restore');c.stdout.resume();
  await Promise.all([done,pipeline(fs.createReadStream(archive,{start:12,end:size-17}),decipher,c.stdin)]);key.fill(0);
  result.restore.completedAt=new Date().toISOString();result.restore.result='PASS';
 }else throw Object.assign(new Error(),{code:'EXPECTED_BACKUP_OR_RESTORE'});
})().catch(e=>{result.error={mode,code:e.code||e.name,at:new Date().toISOString()};process.exitCode=1;}).finally(()=>{fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));});

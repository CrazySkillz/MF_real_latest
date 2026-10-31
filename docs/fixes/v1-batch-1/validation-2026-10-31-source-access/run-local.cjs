const {spawnSync}=require('node:child_process'),path=require('node:path');
const env={};for(const [key,value]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(key))env[key]=value;
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',B1_ACCOUNT_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/notifications_test',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
const result=spawnSync(process.execPath,[path.join(__dirname,'rehearse.cjs')],{env,stdio:'inherit',timeout:180000,windowsHide:true});process.exitCode=result.status??1;

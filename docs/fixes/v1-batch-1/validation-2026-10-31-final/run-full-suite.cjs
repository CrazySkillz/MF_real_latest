// Same disposable database configuration as CI, with external networking blocked.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k))env[k]=v;
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',GA4_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test',NOTIFICATION_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/notifications_test',V1_BATCH7_PRESERVE_ARTIFACTS:'1',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
const fd=fs.openSync(path.join(__dirname,'connector-context-full-suite-database.log'),'w');
const child=spawn(process.execPath,['--import','tsx','scripts/ga4-kpi-current-version-test-boundary.ts','current'],{env,stdio:['ignore',fd,fd],windowsHide:true});
child.on('error',e=>{console.error(e.message);process.exitCode=1});child.on('exit',code=>{fs.closeSync(fd);console.log(JSON.stringify({exitCode:code,log:'connector-context-full-suite-database.log'}));process.exitCode=code??1});

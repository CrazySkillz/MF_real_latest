// Isolated actual PostgreSQL and synthetic browser checks; no live providers.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k))env[k]=v;
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',GA4_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test',V1_BATCH7_PRESERVE_ARTIFACTS:'1',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
const fd=fs.openSync(path.join(__dirname,'renewal-affected.log'),'w');
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','server/ga4-revenue-publication-postgres.test.ts','server/v1-batch5-ga4-browser.test.ts','--maxWorkers=2','--reporter=default','--reporter=json',`--outputFile.json=${path.join(__dirname,'renewal-affected.json')}`],{env,stdio:['ignore',fd,fd],windowsHide:true});
child.on('error',()=>{fs.closeSync(fd);process.exitCode=1;console.log('LAUNCH_FAILED')});
child.on('exit',code=>{fs.closeSync(fd);process.exitCode=code??1;console.log(JSON.stringify({exitCode:code}))});

// Runs isolated tests/builds without inherited application secrets or .env.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),out=__dirname;
const target=process.argv[2];if(!['fallback','candidate'].includes(target))throw new Error('Expected fallback or candidate');
const cwd=target==='fallback'?path.join(root,'audit-temp/v1-batch3-fallback-worktree'):root;
const env={};for(const [k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(k))env[k]=v;
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',GA4_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55443/ga4_alignment_test',NOTIFICATION_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55443/notifications_test',V1_BATCH2_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55443/notifications_test'});
env.NODE_OPTIONS=`--require "${path.join(out,'local-network-only.cjs').replaceAll('\\','/')}"`;
function run(label,exe,args){const fd=fs.openSync(path.join(out,`${target}-${label}.log`),'wx');const r=spawnSync(exe,args,{cwd,env,stdio:['ignore',fd,fd],windowsHide:true,timeout:900000});fs.closeSync(fd);const result={label,exitCode:r.status,error:r.error?.code||null};console.log(JSON.stringify(result));return result;}
const mode=process.argv[3],results=[];
const suffix=process.argv[4]||'';if(suffix&&!/^[a-z0-9-]+$/.test(suffix))throw new Error('Invalid result suffix');
if(mode==='full')results.push(run('full-suite'+suffix,process.execPath,[path.join(root,'node_modules/vitest/vitest.mjs'),'run','server','--maxWorkers=2','--reporter=json',`--outputFile=${path.join(out,`${target}-full-suite${suffix}.json`)}`]));
else if(mode==='targeted')results.push(run('targeted'+suffix,process.execPath,[path.join(root,'node_modules/vitest/vitest.mjs'),'run',...process.argv.slice(5),'--maxWorkers=2','--reporter=json',`--outputFile=${path.join(out,`${target}-targeted${suffix}.json`)}`]));
else if(mode==='build'){
 env.NODE_ENV='production';
 results.push(run('typecheck',process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit']));
 results.push(run('client-build',process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build']));
 results.push(run('server-build',path.join(root,'node_modules/@esbuild/win32-x64/esbuild.exe'),['server/index.ts','--platform=node','--packages=external','--bundle','--format=esm','--outdir=dist']));
}else if(mode==='startup')results.push(run('startup',process.execPath,[path.join(out,'startup-regression.cjs')]));
else throw new Error('Expected full, build or startup');
fs.writeFileSync(path.join(out,`${target}-${mode}${suffix}-checks.json`),JSON.stringify({at:new Date().toISOString(),target,mode,results},null,2)+'\n');
if(results.some(r=>r.exitCode!==0))process.exitCode=1;

const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const env={};for(const [key,value]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key))env[key]=value;
const out='docs/fixes/v1-batch-8/validation-2026-10-27-ci-scheduler';
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',PLAYWRIGHT_BROWSERS_PATH:path.resolve('audit-temp/absent-ci-browser-fixture'),V1_BATCH7_PRESERVE_ARTIFACTS:'1',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
const fd=fs.openSync(`${out}/missing-prerequisites.log`,'wx');
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','server/ga4-ad-comparison-download-browser.test.ts','server/v1-batch7-metric-routes.test.ts','--maxWorkers=2','--reporter=json',`--outputFile=${out}/missing-prerequisites.json`],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout:120000});fs.closeSync(fd);
const report=JSON.parse(fs.readFileSync(`${out}/missing-prerequisites.json`,'utf8'));
console.log(JSON.stringify({exit:result.status,passed:report.numPassedTests,failed:report.numFailedTests,failures:report.testResults.flatMap(f=>f.assertionResults.filter(a=>a.status==='failed').map(a=>({name:a.fullName,error:a.failureMessages[0]?.slice(0,350)})))}));

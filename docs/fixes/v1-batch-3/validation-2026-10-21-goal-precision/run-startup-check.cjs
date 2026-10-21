const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) environment[key] = value;
}
Object.assign(environment, {NODE_ENV:'test',DATABASE_URL:'',V1_BATCH2_TEST_DATABASE_URL:'postgresql://v1_audit@127.0.0.1:55443/notifications_test'});
const fd=fs.openSync('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/startup.log','w');
const result=spawnSync(process.execPath,['docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/startup-regression.cjs'],{env:environment,stdio:['ignore',fd,fd],windowsHide:true,timeout:180000});
fs.closeSync(fd);console.log(JSON.stringify({exitCode:result.status,errorCode:result.error?.code||null}));process.exitCode=result.status??1;

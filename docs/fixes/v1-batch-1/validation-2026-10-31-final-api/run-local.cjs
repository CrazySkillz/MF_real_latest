// Child receives no inherited application credentials. Network limited to loopback.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k))env[k]=v;
Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
const r=spawnSync(process.execPath,[path.join(__dirname,'rehearse.cjs')],{env,encoding:'utf8',windowsHide:true,timeout:180000});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.error)console.error(r.error.message);process.exitCode=r.status??1;

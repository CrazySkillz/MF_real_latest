const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin='https://marketforensics.onrender.com';
const normalize=text=>text.replace(/([\w.-]+)-[A-Za-z0-9_-]{8,}\.(js|css)(?=["'])/g,'$1-HASH.$2').replace(/pk_(test|live)_[A-Za-z0-9]+/g,'PUBLIC_CLERK_KEY');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.text();}
(async()=>{
 const html=await get(origin+'/'); const entry=html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)[1];
 const code=await get(origin+entry); const filename=code.match(/(?:\.\/|\/assets\/|assets\/)?(AddRevenueWizardModal-[A-Za-z0-9_-]+\.js)/)[1];
 const remote=normalize(await get(origin+'/assets/'+filename));
 const dir=path.resolve('dist/public/assets'), localName=fs.readdirSync(dir).find(n=>/^AddRevenueWizardModal-[A-Za-z0-9_-]+\.js$/.test(n));
 const local=normalize(fs.readFileSync(path.join(dir,localName),'utf8'));
 let first=0;while(first<local.length&&local[first]===remote[first])first++;
 let suffix=0;while(suffix<Math.min(local.length,remote.length)-first&&local[local.length-1-suffix]===remote[remote.length-1-suffix])suffix++;
 console.log(JSON.stringify({filename,localName,lengths:[local.length,remote.length],first,suffix,
   localDifference:local.slice(Math.max(0,first-90),Math.min(local.length-suffix+90,first+1000)),
   remoteDifference:remote.slice(Math.max(0,first-90),Math.min(remote.length-suffix+90,first+1000))}));
})().catch(e=>{console.error(e.message);process.exitCode=1});

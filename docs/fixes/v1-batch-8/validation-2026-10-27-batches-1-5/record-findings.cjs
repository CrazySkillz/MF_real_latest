// Index every original Batch 1-5 finding without changing its acceptance status.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const expected = [20,14,10,24,6];
const tests = execFileSync('git', ['ls-files','-z','--','server','client'], {encoding:'utf8'}).split('\0').filter(file => /\.test\.[tj]sx?$/.test(file));
const testTexts = tests.map(file => ({file, text:fs.readFileSync(file,'utf8')}));
const findings = [];
for (let batch=1; batch<=5; batch++) {
  const reference = `docs/fixes/v1-batch-${batch}/README.md`;
  const text = fs.readFileSync(reference,'utf8');
  const entries = [...text.matchAll(/^\| \[(V1-\d+)\]\([^)]*\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm)];
  if (entries.length !== expected[batch-1]) throw new Error(`Incomplete Batch ${batch} inventory`);
  for (const entry of entries) {
    const id = entry[1], start = text.indexOf('### '+id+'\n') >= 0 ? text.indexOf('### '+id+'\n') : text.indexOf('### '+id+'\r\n');
    if (start < 0) throw new Error('Missing finding narrative: '+id);
    const next = text.indexOf('\n### ', start+4);
    const section = text.slice(start, next < 0 ? text.length : next).split(/\n## /)[0];
    const directTestReferences = testTexts.filter(test => test.text.includes(id)).map(test => test.file);
    const linkedFiles = [...section.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map(match => path.posix.normalize(path.posix.join(path.posix.dirname(reference),match[1]))).filter(file => !file.includes(':/'));
    findings.push({id,batch,severity:entry[2].trim(),recordedFixStatus:entry[3].trim(),releaseAcceptance:entry[4].trim(),reference:reference+'#'+id.toLowerCase(),recordedNarrative:section.trim(),directTestReferences,linkedFiles:[...new Set(linkedFiles)],evidenceLimit:'Original root-cause/implementation record plus current regression execution; direct text references are an index, not proof that every lifecycle or provider case is covered.'});
  }
}
if (new Set(findings.map(row=>row.id)).size !== 74) throw new Error('Duplicate or missing finding');
const files = execFileSync('git',['ls-files','-z','--','server','client/src','shared','migrations','package.json','package-lock.json','tsconfig.json','vitest.config.ts','vite.config.ts','.github/workflows'],{encoding:'utf8'}).split('\0').filter(file=>file&&fs.existsSync(file));
const result={at:new Date().toISOString(),baseHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'All 74 original findings assigned to Batches 1-5; no release acceptance silently closed',counts:expected.map((count,index)=>({batch:index+1,count})),findings,sourceManifest:files.map(file=>({file,sha256:hash(fs.readFileSync(file))}))};
fs.writeFileSync(__dirname+'/finding-inventory.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({counts:result.counts,total:findings.length,findingsWithDirectTestId:findings.filter(row=>row.directTestReferences.length).length,sourceFiles:files.length}));

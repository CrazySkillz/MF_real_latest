// Reproducible, exact-revision fallback composition. Writes only the isolated worktree.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const root = process.cwd(), out = path.join(root, 'docs/fixes/v1-batch-3/deployment-2026-10-22');
const target = path.join(root, 'audit-temp/v1-batch3-fallback-worktree');
const base = '839bf508bffea4742f992616753dc68eabcfab3e', candidate = '001ddfa87c445a51e63320cde9737b774aa1af0c';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 20000000 });
assert.equal(execFileSync('git', ['rev-parse','HEAD'], { cwd:target, encoding:'utf8', windowsHide:true }).trim(), candidate);
const read = (rev, file) => git('show', `${rev}:${file}`);
const manifest = [];
function compose(file, keep) {
  const old = read(base, file).split('\n'), diff = git('diff','--unified=0',base,candidate,'--',file);
  const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@[^\n]*\n([\s\S]*?)(?=^@@ |$(?![\s\S]))/gm)].map(m => ({
    oldStart:Number(m[1]), oldCount:m[2]===undefined?1:Number(m[2]), header:m[0].split('\n')[0],
    before:m[5].split('\n').filter(l=>l.startsWith('-')).map(l=>l.slice(1)),
    after:m[5].split('\n').filter(l=>l.startsWith('+')).map(l=>l.slice(1)),
  }));
  assert.ok(hunks.length, file);
  for (const h of [...hunks].reverse()) {
    const at = h.oldCount ? h.oldStart-1 : h.oldStart;
    assert.deepEqual(old.slice(at, at+h.oldCount), h.before, file+' '+h.header);
    h.retained = keep(h);
    if(h.retained) old.splice(at,h.oldCount,...h.after);
  }
  const value=old.join('\n');fs.writeFileSync(path.join(target,file),value);
  manifest.push({file,sha256:crypto.createHash('sha256').update(value).digest('hex'),hunks:hunks.map(({header,retained})=>({header,retained}))});
}
compose('server/analytics.ts',h=>h.after.some(l=>l.includes('conversionCreditsMatch')) || (h.before.some(l=>l.includes('parseInt')) && h.after.some(l=>l.includes('parseFloat'))));
compose('client/src/pages/ga4-metrics.tsx',h=>h.oldStart!==1 && !(h.oldStart>=1939&&h.oldStart<=3020));
const page=path.join(target,'client/src/pages/ga4-metrics.tsx');
fs.writeFileSync(page,'import { conversionCreditsMatch } from "@shared/metric-math";\n'+fs.readFileSync(page,'utf8'));
compose('server/storage.ts',h=>[6584,6620].includes(h.oldStart));
compose('server/routes-oauth.ts',h=>h.oldStart!==9247);
compose('shared/schema.ts',h=>![1037,1065].includes(h.oldStart));
for(const file of ['server/utils/campaign-cumulative-financials.ts','server/utils/revenue-record-total.ts',
  'server/financial-daily-comparison.test.ts','server/ga4-browser-publication-refresh.test.ts',
  'server/ga4-initial-import-route.test.ts','server/ga4-refresh-input-invalidation-postgres.test.ts',
  'server/ga4-request-timeout.test.ts','server/ga4-overview-reporting-note.test.ts']) compose(file,()=>false);
compose('server/ga4-ui-regression.test.ts',h=>h.oldStart===388);
compose('server/financial-daily-snapshot-writer.test.ts',()=>false);
compose('server/ga4-kpi-snapshot-display.test.ts',()=>false);
compose('server/ga4-derived-publication-postgres.test.ts',h=>h.oldStart!==110);
compose('server/ga4-insights-live-production-regression.test.ts',h=>h.oldStart!==18);
// These new tests exercise only the other Batch 3 fixes, absent from this fallback.
for(const file of ['server/v1-batch3-acquisition.test.ts','server/v1-batch3-revenue-contracts.test.ts']) {
  if(fs.existsSync(path.join(target,file))){
    assert.equal(fs.readFileSync(path.join(target,file),'utf8').replace(/\r\n/g,'\n'),read(candidate,file));
    fs.unlinkSync(path.join(target,file));
  }
  manifest.push({file,action:'omit tests for reverted nonprecision fixes'});
}
// Keep the rendered fractional UI assertions; omit only the other fixes' scenario.
const browser=path.join(target,'server/ga4-publication-browser.test.ts');
let text=read(candidate,'server/ga4-publication-browser.test.ts');
const start=text.indexOf('      // V1-087: a cached EUR publication'),end=text.indexOf('      conversionCredit = 0.75;',start);
assert.ok(start>0&&end>start);text=text.slice(0,start)+text.slice(end);fs.writeFileSync(browser,text);
manifest.push({file:'server/ga4-publication-browser.test.ts',action:'retain fractional scenario and preceding publication checks; omit currency/refund scenario'});
const providerFile='server/v1-batch3-conversion-precision.test.ts';
let provider=read(candidate,providerFile);
for(const marker of ['    const series = await service.getTimeSeriesWithToken', '    expect((await service.getTimeSeriesWithToken']){
  assert.equal(provider.split(marker).length,2);
  provider=provider.replace(marker,'    vi.stubGlobal("fetch", (...args: any[]) => (service as any).requestReport(...args));\n'+marker);
}
fs.writeFileSync(path.join(target,providerFile),provider);
manifest.push({file:providerFile,action:'stub both legacy direct fetch and requestReport transports with the same synthetic responses; assertions unchanged'});
// Source-string tests assume LF. Normalize this isolated checkout to Git's source bytes.
for(const file of git('ls-files','client','server','shared','migrations').trim().split('\n').filter(f=>/\.(tsx?|sql)$/.test(f))){
  const p=path.join(target,file);if(!fs.existsSync(p))continue;
  const s=fs.readFileSync(p,'utf8');if(s.includes('\r\n'))fs.writeFileSync(p,s.replace(/\r\n/g,'\n'));
}
// Final hashes also cover the two explicitly composed mixed import/scenario files.
for(const entry of manifest) if(fs.existsSync(path.join(target,entry.file))) entry.sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(target,entry.file),'utf8').replace(/\r\n/g,'\n')).digest('hex');
fs.writeFileSync(path.join(out,'fallback-composition.json'),JSON.stringify({base,candidate,target:'audit-temp/v1-batch3-fallback-worktree',manifest,scope:'Old deployed application plus the full fractional conversion correction; other Batch 3 fixes intentionally absent. Emergency recovery only, not V1 certification.'},null,2)+'\n');
console.log(JSON.stringify({files:manifest.length,result:'fallback composed; main runtime unchanged'}));

const fs = require('node:fs'), path = require('node:path');
const files = ['docs/V1_RELEASE_READINESS.md', 'docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md',
  ...Array.from({ length: 8 }, (_, i) => `docs/fixes/v1-batch-${i + 1}/README.md`)];
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
const failures = []; let count = 0;
for (const file of files) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1]; if (/^(https?:|mailto:)/.test(link)) continue;
    const [relative, anchor] = link.split('#'), target = path.resolve(path.dirname(file), relative || path.basename(file));
    count++;
    if (!fs.existsSync(target)) { failures.push({ file, link, reason: 'missing file' }); continue; }
    if (anchor && target.endsWith('.md')) {
      const text = fs.readFileSync(target, 'utf8');
      const anchors = new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(row => slug(row[1].trim())));
      for (const row of text.matchAll(/<a\s+id="([^"]+)"/g)) anchors.add(row[1]);
      if (!anchors.has(anchor)) failures.push({ file, link, reason: 'missing anchor' });
    }
  }
}
const queue = fs.readFileSync(files[1], 'utf8');
const identifiers = [...queue.matchAll(/^\| \[(V1-\d{3})\]/gm)].map(row => row[1]);
if (identifiers.length !== 130 || new Set(identifiers).size !== 130) failures.push({ reason: 'finding identity/count mismatch' });
for (const number of ['040', '071', '073', '126']) {
  const row = queue.split('\n').find(line => line.startsWith(`| [V1-${number}]`));
  if (!row?.includes('| 4 | VERIFIED LOCALLY | OPEN |')) failures.push({ reason: `incorrect status V1-${number}` });
}
const result = { at: new Date().toISOString(), files: files.length, checkedLinks: count, findings: identifiers.length, failures };
fs.writeFileSync(`${__dirname}/documentation-check.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result)); if (failures.length) process.exitCode = 1;

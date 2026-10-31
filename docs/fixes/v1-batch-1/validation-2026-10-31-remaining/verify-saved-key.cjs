// Offline only. Actual key arrives via stdin from a hidden local prompt, never argv/env/file.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm'), assert = require('node:assert/strict'), { spawnSync } = require('node:child_process'), ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');
const vaultFile = path.join(root, 'server/utils/tokenVault.ts');
const vaultHash = 'ffd53cd965ca441262fbf27cf9c45479e546a3038ea80581230ceb731fab0cfc';
const fields = ['accessToken', 'refreshToken', 'clientSecret'];
function vault(key) {
  const source = fs.readFileSync(vaultFile, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), vaultHash);
  const context = { exports: {}, Buffer, process: { env: { NODE_ENV: 'production', TOKEN_ENCRYPTION_KEY: key } }, require: name => { assert.equal(name, 'crypto'); return crypto; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context, { timeout: 3000 });
  return context.exports;
}
function shape(rows) {
  const groups = [];
  for (const row of rows) {
    assert.equal(row.tokens?.v, 1);
    const present = fields.filter(f => row.tokens[f] != null);
    for (const f of present) {
      const b = row.tokens[f]; assert.equal(b.v, 1);
      for (const k of ['iv', 'tag', 'data']) { assert.equal(typeof b[k], 'string'); assert.match(b[k], /^[A-Za-z0-9_-]*$/); }
      assert.equal(Buffer.from(b.iv, 'base64url').length, 12); assert.equal(Buffer.from(b.tag, 'base64url').length, 16); assert.ok(b.data.length > 0);
    }
    groups.push({ table: row.table, active: row.active, encryptedFields: present.length });
  }
  return groups;
}
function verify(rows, key) {
  assert.ok(typeof key === 'string' && key.trim().length > 0 && key.length <= 4096);
  const groups = shape(rows), module = vault(key); let authenticated = 0, failed = 0;
  for (const row of rows) for (const field of fields) if (row.tokens[field]) {
    try { if (!module.decryptString(row.tokens[field]).length) throw Error(); authenticated++; } catch { failed++; }
  }
  const encrypted = groups.reduce((sum, g) => sum + g.encryptedFields, 0);
  return { result: encrypted > 0 && failed === 0 && authenticated === encrypted ? 'PASS_SAVED_KEY_RECOVERY' : 'KEY_NOT_VERIFIED', containers: rows.length, encryptedFields: encrypted, authenticatedFields: authenticated, failedFields: failed, emptyContainers: groups.filter(g => !g.encryptedFields).length };
}
function readArchive() {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k)));
  const child = spawnSync('python', [path.join(__dirname, 'read-backup-key-containers.py'), '--private-pipe'], { cwd: root, env: clean, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 128 * 1024 });
  if (child.status !== 0) throw Error('BACKUP_SCOPE_NOT_VERIFIED');
  const data = JSON.parse(child.stdout); child.stdout = '';
  assert.equal(data.archiveSha256, 'aeadd0ca9ff0caaa81960c00f5a81aa8739671e8f72f8ea74f3d6bc2ca8a3ae9');
  assert.equal(data.rows.length, 7); return data;
}
async function main() {
  const mode = process.argv[2]; let receipt;
  try {
    assert.ok(['--preflight', '--verify'].includes(mode));
    let key = '';
    if (mode === '--verify') {
      process.stdin.setEncoding('utf8');
      for await (const chunk of process.stdin) { key += chunk; if (key.length > 4100) throw Error(); }
      key = key.replace(/\r?\n$/, ''); assert.ok(key.trim());
    }
    const data = readArchive(), groups = shape(data.rows);
    receipt = mode === '--preflight' ? { result: 'PASS_BACKUP_KEY_PREFLIGHT', containers: data.rows.length, encryptedFields: groups.reduce((s, g) => s + g.encryptedFields, 0), emptyContainers: groups.filter(g => !g.encryptedFields).length } : verify(data.rows, key);
    key = ''; data.rows = [];
    Object.assign(receipt, { at: new Date().toISOString(), archiveSha256: data.archiveSha256, vaultRevisionSha256: vaultHash, databaseAccess: false, providerCalls: 0, applicationStartup: false, secretValuesEmitted: false, keyPersisted: false, sourceModified: false, scope: 'Archived credentials of Promo and V1 Batch 5 Test only. No provider validity, key rotation, independently rebuilt hosted application or full disaster recovery is claimed.' });
  } catch { receipt = { result: 'NOT_VERIFIED', code: 'LOCAL_KEY_CHECK_FAILED', secretValuesEmitted: false, keyPersisted: false }; }
  const file = (mode === '--preflight' ? 'backup-key-preflight-' : 'saved-key-recovery-') + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.result.startsWith('PASS_')) process.exitCode = 1;
}
module.exports = { verify, vault, shape };
if (require.main === module) main();

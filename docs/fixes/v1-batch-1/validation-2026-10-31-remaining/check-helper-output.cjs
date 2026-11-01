// Synthetic only: exercise the actual PowerShell wrapper's stdin and output pipeline.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inputChecks } = require('./verify-saved-key.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mimo-key-wrapper-control-'));
const checks = [], check = (name, fn) => { fn(); checks.push({ check: name, passed: true }); };
const wrapper = path.join(directory, 'check-saved-key.ps1');
fs.copyFileSync(path.join(__dirname, 'check-saved-key.ps1'), wrapper);
for (const [format, key] of [['base64', crypto.randomBytes(32).toString('base64')], ['hex', crypto.randomBytes(32).toString('hex')], ['text', 'synthetic-only-text-\u00a3']]) {
  fs.writeFileSync(path.join(directory, 'verify-saved-key.cjs'), `
const { verify, vault, inputChecks } = require(${JSON.stringify(path.join(__dirname, 'verify-saved-key.cjs'))});
const fs = require('node:fs');
(async () => {
 let input = ''; process.stdin.setEncoding('utf8'); for await (const chunk of process.stdin) input += chunk;
 const rows = [{ tokens: vault(${JSON.stringify(key)}).buildEncryptedTokens({ accessToken:'synthetic-access', refreshToken:'synthetic-refresh', clientSecret:'synthetic-secret' }) }];
 const result = verify(rows, input);
 result.inputChecks = inputChecks(input);
 fs.writeFileSync(__dirname + '/result.json', JSON.stringify(result));
 console.log(JSON.stringify(result));
 if (result.result !== 'PASS_SAVED_KEY_RECOVERY') process.exitCode = 1;
})();
`);
  for (const correct of [true, false]) {
    const input = correct ? key : 'wrong-synthetic-input';
    const command = `function Read-Host { param([string]$Prompt, [switch]$AsSecureString) ConvertTo-SecureString -String '${input.replace(/'/g, "''")}' -AsPlainText -Force }; $result = @(& '${wrapper.replace(/'/g, "''")}'); if ($result.Count -ne 1) { throw 'Result was not forwarded to PowerShell' }; [Console]::Out.WriteLine($result[0])`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
    check(`${format}: ${correct ? 'correct' : 'wrong'} synthetic input and visible redacted result`, () => {
      assert.equal(result.status, 0);
      const output = JSON.parse(result.stdout.trim());
      assert.deepEqual(output, JSON.parse(fs.readFileSync(path.join(directory, 'result.json'), 'utf8')));
      assert.equal(output.result, correct ? 'PASS_SAVED_KEY_RECOVERY' : 'KEY_NOT_VERIFIED');
      assert.equal(output.authenticatedFields, correct ? 3 : 0);
      assert.equal(output.failedFields, correct ? 0 : 3);
      assert.ok(!result.stdout.includes(key) && !result.stdout.includes(input) && !result.stdout.includes('synthetic-access'));
    });
  }
}
for (const [label, value, field] of [
  ['control character', '\u0016', 'containsControlCharacters'],
  ['assignment', 'TOKEN_ENCRYPTION_KEY="synthetic"', 'containsAssignment'],
  ['copied command', "& 'C:\\test\\check-saved-key.ps1'", 'containsCommand'],
  ['outer quotes', '"synthetic"', 'hasOuterQuotes'],
]) check(`reports ${label} without printing input`, () => {
  const flags = inputChecks(value); assert.equal(flags[field], true);
  assert.ok(Object.values(flags).every(flag => typeof flag === 'boolean'));
});
check('ordinary synthetic key has no paste-format flags', () => assert.ok(Object.values(inputChecks('synthetic-value')).every(flag => flag === false)));
const receipt = { result:'PASS_HELPER_OUTPUT_CONTROLS', at:new Date().toISOString(), checks, syntheticKeysOnly:true, realKeyRead:false, databaseAccess:false, providerCalls:0, applicationSourceChanged:false };
fs.writeFileSync(path.join(__dirname, 'helper-output-controls.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
// Only the three exact synthetic files created above are removed.
for (const name of ['check-saved-key.ps1', 'verify-saved-key.cjs', 'result.json']) fs.unlinkSync(path.join(directory, name));
fs.rmdirSync(directory);

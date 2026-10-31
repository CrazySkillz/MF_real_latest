const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { verify, vault, shape } = require('./verify-saved-key.cjs');
const checks = [], check = (name, fn) => { fn(); checks.push({ check: name, passed: true }); };
for (const [format, key] of [['base64', crypto.randomBytes(32).toString('base64')], ['hex', crypto.randomBytes(32).toString('hex')], ['text', 'synthetic-key-for-test-only-£']]) {
  const cipher = vault(key).buildEncryptedTokens({ accessToken: 'synthetic-access-not-a-token', refreshToken: 'synthetic-refresh-not-a-token', clientSecret: 'synthetic-client-not-a-secret' });
  const rows = [{ table: 'ga4_connections', active: true, tokens: cipher }, { table: 'ga4_connections', active: true, tokens: { v: 1 } }];
  check(format + ' key authenticates all fields and accepts service-account empty container', () => {
    const r = verify(rows, key); assert.equal(r.result, 'PASS_SAVED_KEY_RECOVERY'); assert.equal(r.authenticatedFields, 3); assert.equal(r.failedFields, 0); assert.equal(r.emptyContainers, 1);
    assert.ok(!JSON.stringify(r).includes(key) && !JSON.stringify(r).includes('synthetic-access'));
  });
  // Appending after base64 padding can decode to the same key; change key bytes.
  const changedKey = format === 'text' ? 'different-synthetic-key' : (() => { const b = Buffer.from(key, format); b[0] ^= 255; return b.toString(format); })();
  check(format + ' wrong key is not accepted', () => { const r = verify(rows, changedKey); assert.equal(r.result, 'KEY_NOT_VERIFIED'); assert.equal(r.failedFields, 3); });
  check(format + ' one corrupted authenticated field refuses overall pass', () => {
    const changed = structuredClone(rows); changed[0].tokens.accessToken.tag = Buffer.alloc(16, 7).toString('base64url');
    const r = verify(changed, key); assert.equal(r.result, 'KEY_NOT_VERIFIED'); assert.equal(r.failedFields, 1);
  });
  check(format + ' source ciphertext retained byte-for-byte', () => assert.deepEqual(rows[0].tokens, cipher));
}
check('empty key rejected', () => assert.throws(() => verify([], '')));
check('all empty containers cannot pass', () => assert.equal(verify([{ tokens: { v: 1 } }], 'synthetic').result, 'KEY_NOT_VERIFIED'));
check('malformed version rejected', () => assert.throws(() => shape([{ tokens: { v: 2 } }])));
check('malformed tag rejected', () => assert.throws(() => shape([{ tokens: { v: 1, accessToken: { v: 1, iv: 'a'.repeat(16), tag: 'a', data: 'x' } } }])));
const result = { at: new Date().toISOString(), result: 'PASS', checks, syntheticKeysOnly: true, productionKeyRead: false, databaseAccess: false, providerCalls: 0 };
fs.writeFileSync(path.join(__dirname, 'saved-key-rehearsal.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));

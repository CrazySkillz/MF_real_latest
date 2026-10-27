// Vitest's JSON reporter omits unhandled worker errors. Keep a separate receipt
// so deferred assertion failures cannot conceal an interrupted or crashed run.
const { writeFileSync } = require('node:fs');
module.exports = class TestRunErrors {
  onTestRunEnd(_modules, errors, reason) {
    const file = process.env.CURRENT_VERSION_TEST_ERRORS_FILE;
    if (!file) throw new Error('Missing test-run error receipt path');
    writeFileSync(file, JSON.stringify({ reason, errors: errors.map(error => String(error.message || error)) }) + '\n', { flag: 'wx' });
  }
};

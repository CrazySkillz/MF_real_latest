// Build-time installation only. Uses the repository's existing, locked Playwright
// version and fails the monitor deploy if Chromium cannot launch on the host.
const { execFileSync } = require('node:child_process');
const { join, dirname } = require('node:path');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' };
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/monitor-application-source.ts'], { env, stdio: 'inherit', windowsHide: true });
execFileSync(process.execPath, [join(dirname(require.resolve('playwright/package.json')), 'cli.js'), 'install', 'chromium', '--only-shell'], { env, stdio: 'inherit', windowsHide: true });
execFileSync(process.execPath, ['--input-type=module', '-e', "import { chromium } from 'playwright'; const browser = await chromium.launch({headless:true,args:['--disable-dev-shm-usage']}); await browser.close(); console.log('Monitor Chromium launch verified');"], { env, stdio: 'inherit', windowsHide: true });

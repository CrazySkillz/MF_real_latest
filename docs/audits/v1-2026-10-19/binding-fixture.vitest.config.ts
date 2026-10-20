import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(process.cwd(), 'shared') } },
  test: { include: ['docs/audits/v1-2026-10-19/*.binding-diagnostic.test.ts'],
    environment: 'node', globals: true, pool: 'forks', maxWorkers: 1, minWorkers: 1,
    testTimeout: 15000, hookTimeout: 15000 },
});

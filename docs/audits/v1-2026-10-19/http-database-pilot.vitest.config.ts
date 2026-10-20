import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve:{alias:{'@shared':path.resolve(process.cwd(),'shared')}},
  test:{include:['docs/audits/v1-2026-10-19/http-database-pilot.test.ts'],environment:'node',pool:'forks',maxWorkers:1,minWorkers:1,testTimeout:60000,hookTimeout:60000},
});

import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["docs/fixes/v1-batch-8/validation-2026-10-26/ci-reporter.fixture.ts"], pool: "forks" } });

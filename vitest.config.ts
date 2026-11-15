import { defineConfig } from "vitest/config";
import path from "path";
import DurationSequencer from "./scripts/ci-test-sequencer";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  test: {
    include: ["server/**/*.test.ts"],
    environment: "node",
    globals: true,
    reporters: ["default"],
    pool: "forks",
    sequence: process.env.CURRENT_VERSION_TEST_SHARD ? { sequencer: DurationSequencer } : undefined,
  },
});



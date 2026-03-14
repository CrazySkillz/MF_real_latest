import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["server/**/*.test.ts"],
    environment: "node",
    globals: true,
    reporters: ["default"],
  },
});



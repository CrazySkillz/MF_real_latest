import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 live property mock boundary", () => {
  it("does not classify numeric live GA4 property ids as the Yesop simulator", () => {
    const routes = read("server", "routes-oauth.ts");
    const kpiJobs = read("server", "ga4-kpi-benchmark-jobs.ts");
    const currentValues = read("server", "utils", "campaign-current-values.ts");

    for (const source of [routes, kpiJobs, currentValues]) {
      expect(source).toContain('normalized === "yesop"');
      expect(source).not.toContain('normalized === "498536418"');
    }
  });
});

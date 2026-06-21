import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 reporting timezone contract", () => {
  it("persists a campaign reporting timezone with UTC fallback", () => {
    const schema = read("shared", "schema.ts");
    const index = read("server", "index.ts");
    const routes = read("server", "routes-oauth.ts");
    const campaigns = read("client", "src", "pages", "campaigns.tsx");

    expect(schema).toContain('reportingTimeZone: text("reporting_time_zone").notNull().default("UTC"),');
    expect(schema).toContain('reportingTimeZone: z.string().trim().min(1).default("UTC"),');
    expect(schema).toContain("reportingTimeZone: true,");
    expect(index).toContain("ADD COLUMN IF NOT EXISTS reporting_time_zone TEXT NOT NULL DEFAULT 'UTC';");

    expect(routes).toContain('const DEFAULT_REPORTING_TIME_ZONE = "UTC";');
    expect(routes).toContain("function normalizeReportingTimeZone(value: any): string");
    expect(routes).toContain("new Intl.DateTimeFormat(\"en-US\", { timeZone: tz }).format(new Date(0));");
    expect(routes).toContain("sanitizedData.reportingTimeZone = normalizeReportingTimeZone(sanitizedData.reportingTimeZone);");
    expect(routes).toContain('Object.prototype.hasOwnProperty.call(sanitizedData, "reportingTimeZone")');
    expect(routes).toContain("reportingTimeZone: normalizeReportingTimeZone((campaign as any)?.reportingTimeZone),");

    expect(campaigns).toContain("const getBrowserReportingTimeZone = () =>");
    expect(campaigns).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone || \"UTC\"");
    expect(campaigns).toContain("reportingTimeZone: data.reportingTimeZone || getBrowserReportingTimeZone(),");
  });
});

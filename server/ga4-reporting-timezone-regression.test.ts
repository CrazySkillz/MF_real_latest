import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 reporting timezone contract", () => {
  it("persists a campaign reporting timezone with UTC fallback", () => {
    const schema = read("shared", "schema.ts");
    const index = read("server", "index.ts");
    const routes = read("server", "routes-oauth.ts");
    const timezoneUtil = read("server", "utils", "reporting-timezone.ts");
    const campaigns = read("client", "src", "pages", "campaigns.tsx");

    expect(schema).toContain('reportingTimeZone: text("reporting_time_zone").notNull().default("UTC"),');
    expect(schema).toContain('reportingTimeZone: z.string().trim().min(1).default("UTC"),');
    expect(schema).toContain("reportingTimeZone: true,");
    expect(index).toContain("ADD COLUMN IF NOT EXISTS reporting_time_zone TEXT NOT NULL DEFAULT 'UTC';");

    expect(timezoneUtil).toContain('export const DEFAULT_REPORTING_TIME_ZONE = "UTC";');
    expect(timezoneUtil).toContain("export function normalizeReportingTimeZone(value: any): string");
    expect(timezoneUtil).toContain("new Intl.DateTimeFormat(\"en-US\", { timeZone: tz }).format(new Date(0));");
    expect(routes).toContain('import { getExpectedDailyRefreshAt, getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";');
    expect(routes).toContain("sanitizedData.reportingTimeZone = normalizeReportingTimeZone(sanitizedData.reportingTimeZone);");
    expect(routes).toContain('Object.prototype.hasOwnProperty.call(sanitizedData, "reportingTimeZone")');
    expect(routes).toContain("reportingTimeZone: normalizeReportingTimeZone(campaign?.reportingTimeZone),");

    expect(campaigns).toContain('const DEFAULT_REPORTING_TIME_ZONE = "UTC";');
    expect(campaigns).toContain("const getBrowserReportingTimeZone = () =>");
    expect(campaigns).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_REPORTING_TIME_ZONE");
    expect(campaigns).toContain("reportingTimeZone: getBrowserReportingTimeZone(),");
    expect(campaigns).toContain("reportingTimeZone: data.reportingTimeZone || getBrowserReportingTimeZone(),");
    expect(campaigns).toContain("reportingTimeZone: data.reportingTimeZone || DEFAULT_REPORTING_TIME_ZONE,");
    expect(campaigns).toContain("reportingTimeZone: editingCampaign.reportingTimeZone || DEFAULT_REPORTING_TIME_ZONE,");
    expect(campaigns).toContain('data-testid="select-edit-reporting-time-zone"');
    expect(campaigns).toContain('onValueChange={(value) => editForm.setValue("reportingTimeZone", value, { shouldDirty: true, shouldValidate: true })}');
    expect(campaigns).toContain('DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col"');
    expect(campaigns).toContain('<input type="hidden" {...editForm.register("conversionValue")} />');
  });
});

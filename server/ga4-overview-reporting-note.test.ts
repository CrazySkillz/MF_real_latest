import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile("ga4-metrics.tsx", readFileSync("client/src/pages/ga4-metrics.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = [
  "normalizeClientReportingTimeZone", "formatReportingDateLabel", "formatReportingTimestampLabel",
  "overviewFinancialSnapshot", "overviewFinancialReportingDate", "ga4DailyLatestStoredDate", "overviewGA4ReportingDate",
  "overviewGA4MetadataAvailable", "overviewGA4ReportingStartDate", "overviewGA4ReportingTimeZone",
  "overviewFinancialWindow", "overviewFinancialReportingTimeZone", "overviewGA4UpdatedAt", "overviewFinancialUpdatedAt",
  "overviewRefreshScheduleHours", "overviewRefreshScheduleMinute", "overviewRefreshSchedule",
];
const expressions = new Map<string, string>();
let note: ts.JsxElement | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && names.includes(node.name.getText(source))) {
    expressions.set(node.name.getText(source), node.initializer.getText(source));
  }
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((attribute) =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "data-testid"
    && attribute.initializer?.getText(source) === '"ga4-overview-reporting-dates"')) note = node;
  ts.forEachChild(node, visit);
}
visit(source);
if (!note || names.some((name) => !expressions.has(name))) throw new Error("Overview reporting note not found");
const compiled = ts.transpileModule(
  `${names.map((name) => `const ${name} = ${expressions.get(name)};`).join("\n")} return (${note.getText(source)});`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } },
).outputText;

const daily = {
  propertyId: "542352127", overviewStartDate: "2026-09-04", latestStoredDailyDate: "2026-10-16",
  dataThroughDate: "2026-10-16", reportingTimeZone: "Europe/Amsterdam", lastUpdated: "2026-10-17T12:10:25.000Z",
  lastCompletedRefreshAt: "2026-10-17T12:10:25.000Z", refreshScheduleTimeZone: "Europe/Amsterdam",
  refreshScheduleHours: [8, 14, 20], refreshScheduleMinute: 0, providerRefreshOutcome: "read_only",
};
const snapshot = {
  reportingDate: "2026-10-16", recordedAt: "2026-10-17T12:11:12.000Z",
  metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-09-04", endDate: "2026-10-16", reportingTimeZone: "Europe/Amsterdam" } } },
};
function render(overrides: Record<string, any> = {}) {
  const bindings = {
    React, DEFAULT_GA4_TRENDS_REPORTING_TIME_ZONE: "UTC", ga4ConnectionUsable: true, ga4DailyPlaceholder: false,
    selectedGA4PropertyId: daily.propertyId, ga4ReportDate: null, ga4DailyResp: daily, campaignCurrency: "EUR",
    financialDailySnapshotResp: { snapshot }, pipelineProxyConfigured: false, ...overrides,
  };
  return renderToStaticMarkup(new Function(...Object.keys(bindings), compiled)(...Object.values(bindings)));
}
const paragraphs = (html: string) => [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));

describe("Overview reporting note uses the displayed data's metadata", () => {
  it("renders the saved import window, distinct successful timestamps and configured schedule", () => {
    const lines = paragraphs(render());
    expect(lines[0]).toContain("Data from Sep 4, 2026 through Oct 16, 2026 (Europe/Amsterdam)");
    expect(lines[0]).toContain("Last successful update: Oct 17, 2026, 02:10 PM");
    expect(lines[1]).toContain("Data through Oct 16, 2026 (Europe/Amsterdam)");
    expect(lines[1]).toContain("Last successful update: Oct 17, 2026, 02:11 PM");
    expect(lines[2]).toContain("Imported Revenue and Spend include eligible source history through that date, which may start earlier");
    expect(lines[3]).toContain("08:00, 14:00, 20:00 (Europe/Amsterdam)");
  });

  it.each(["running", "failed", "delayed"])("retains the saved date/time during a %s attempt", (refreshStatus) => {
    const lines = paragraphs(render({ ga4DailyResp: { ...daily, latestStoredDailyDate: "2026-10-15",
      lastUpdated: "2026-10-16T18:05:00.000Z", lastCompletedRefreshAt: null, refreshStatus,
      expectedRefreshAt: "2026-10-17T12:00:00.000Z", refreshAttempt: { finishedAt: "2026-10-17T12:10:00.000Z" } } }));
    expect(lines[0]).toContain("through Oct 15, 2026");
    expect(lines[0]).toContain("Last successful update: Oct 16, 2026, 08:05 PM");
    expect(lines[0]).not.toContain("Oct 17, 2026");
  });

  it("shows an earlier financial publication's own dates and timestamp", () => {
    const lines = paragraphs(render({ financialDailySnapshotResp: { snapshot: { ...snapshot,
      reportingDate: "2026-10-15", recordedAt: "2026-10-16T18:06:00.000Z",
      metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-08-01", endDate: "2026-10-15", reportingTimeZone: "UTC" } } },
    } } }));
    expect(lines[0]).toContain("through Oct 16, 2026");
    expect(lines[1]).toContain("Data through Oct 15, 2026 (UTC)");
    expect(lines[1]).toContain("Last successful update: Oct 16, 2026, 06:06 PM UTC");
    expect(lines[2]).toContain("Aug 1, 2026 through Oct 15, 2026");
  });

  it("honors a different schedule timezone and nonzero minutes independently of reporting timezone", () => {
    const lines = paragraphs(render({ ga4DailyResp: { ...daily, refreshScheduleHours: [3], refreshScheduleMinute: 35, refreshScheduleTimeZone: "UTC" } }));
    expect(lines[0]).toContain("Europe/Amsterdam");
    expect(lines[3]).toContain("03:35 (UTC)");
    expect(lines[3]).not.toContain("08:00");
  });

  it("renders winter timestamps in the reporting timezone without assuming a fixed UTC offset", () => {
    expect(paragraphs(render({ ga4DailyResp: { ...daily, lastUpdated: "2026-10-25T13:10:00.000Z" } }))[0])
      .toContain("Last successful update: Oct 25, 2026, 02:10 PM");
  });

  it.each([
    { ga4DailyPlaceholder: true }, { ga4ConnectionUsable: false }, { selectedGA4PropertyId: "other-property" },
    { ga4DailyResp: undefined },
  ])("does not label absent, placeholder or another property's data as a successful update: %j", (overrides) => {
    const lines = paragraphs(render({ ...overrides, financialDailySnapshotResp: undefined }));
    expect(lines[0]).toContain("Reporting date unavailable. Last successful update: Not available yet");
    expect(lines[1]).toContain("Reporting date unavailable. Last successful update: Not available yet");
    expect(lines.some((line) => line.includes("Schedule unavailable"))).toBe(true);
  });

  it.each([{ refreshScheduleHours: undefined }, { refreshScheduleHours: [8, 25] }, { refreshScheduleMinute: null }, { refreshScheduleMinute: 60 }])
    ("does not invent a schedule for missing or malformed metadata: %j", (overrides) => {
      expect(render({ ga4DailyResp: { ...daily, ...overrides } })).toContain("Schedule unavailable");
    });

  it("does not expose invalid timestamps or simulated request times as successful imports", () => {
    const lines = paragraphs(render({ ga4DailyResp: { ...daily, providerRefreshOutcome: "simulated" },
      financialDailySnapshotResp: { snapshot: { ...snapshot, recordedAt: "invalid-date" } } }));
    expect(lines[0]).toContain("Last successful update: Not available yet");
    expect(lines[1]).toContain("Last successful update: Not available yet");
    expect(render({ ga4DailyResp: { ...daily, lastUpdated: "invalid-date" } })).not.toContain("invalid-date");
  });

  it("explains provisional figures and preserves Pipeline Proxy's separate current-value scope", () => {
    const html = render({ pipelineProxyConfigured: true });
    expect(html).toContain("24–48 hours, sometimes longer");
    expect(html).toContain("up to 12 days after the event");
    expect(html).toContain("ratios that use GA4 data");
    expect(html).toContain("Pipeline Proxy shows the latest available CRM stage values");
    expect(html).toContain('href="https://support.google.com/analytics/answer/11198161?hl=en"');
  });
});

import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = ts.createSourceFile("campaign-performance.tsx", readFileSync("client/src/pages/campaign-performance.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let query: ts.Node | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source).includes("data: performanceGA4RevenueResponse") && node.initializer && ts.isCallExpression(node.initializer)) {
    const config = node.initializer.arguments[0] as ts.ObjectLiteralExpression;
    query = (config.properties.find(p => p.name?.getText(source) === "queryFn") as ts.PropertyAssignment).initializer;
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!query) throw new Error("Performance Summary Revenue query not found");
const compile = (fetch: any) => new Function("fetch", "campaignId", "performanceGA4PropertyId", "performanceGA4FinancialEndDate", "campaign", "performanceGA4SummaryResponse",
  ts.transpileModule(`return (${query!.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    fetch, "campaign-a", "123", "2026-10-16", { currency: "EUR" }, { reportingTimeZone: "Europe/Amsterdam" });

describe("Performance Summary published Revenue query", () => {
  it.each(["aligned", "new revenue", "new conversions", "wrong campaign", "wrong date", "wrong currency", "wrong window", "wrong timezone", "unavailable", "failed read"])("handles %s inputs without showing mixed totals", async condition => {
    const native = { success: true, propertyId: "123", startDate: "2026-10-15", endDate: "2026-10-16", totals: { revenue: 100, conversions: 5 } };
    const imported = { success: true, platformContext: "ga4", endDate: "2026-10-16", totalRevenue: 30 };
    const saved: any = { campaignId: "campaign-a", reportingDate: "2026-10-16", metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" }, inputs: { revenue: { available: true, value: "130.00" }, conversions: { available: true, value: 5 } } } } };
    if (condition === "new revenue") imported.totalRevenue = 40;
    if (condition === "new conversions") native.totals.conversions = 6;
    if (condition === "wrong campaign") saved.campaignId = "other";
    if (condition === "wrong date") saved.reportingDate = "2026-10-15";
    if (condition === "wrong currency") saved.metrics.financialDaily.currency = "USD";
    if (condition === "wrong window") saved.metrics.financialDaily.currentValueWindow.startDate = "2026-10-14";
    if (condition === "wrong timezone") saved.metrics.financialDaily.currentValueWindow.reportingTimeZone = "UTC";
    if (condition === "unavailable") saved.metrics.financialDaily.inputs.revenue.available = false;
    const fetch = vi.fn(async (url: string) => ({ ok: condition !== "failed read", json: async () => url.includes("financial-daily-snapshot") ? { snapshot: saved } : url.includes("revenue-to-date") ? imported : native }));
    if (condition === "aligned") await expect(compile(fetch)()).resolves.toEqual({ native, imported });
    else await expect(compile(fetch)()).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.every(([url]) => url.includes("2026-10-16"))).toBe(true);
  });
});

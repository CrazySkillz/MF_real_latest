import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { buildGoogleSheetsMetricSummary } from "./utils/google-sheets-aggregate-source";
import { filterGoogleSheetsRows } from "./utils/googleSheetsSelection";
import { hasCompleteGoogleSheetsCache } from "./utils/google-sheets-revenue-ranges";
import { parseGA4FinancialNumber } from "../shared/ga4-financial-source";
import { blockAlertDecision, isAlertDecisionBreached } from "./utils/alert-decision";

const file = "server/utils/ga4-alert-current-value.ts";
const text = process.env.V1_BATCH7_BASELINE ? execFileSync("git", ["show", `1de80e15:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "resolveAlertCurrentValueForDecision")!;
const code = ts.transpileModule(node.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const campaign = { id: "c", ownerId: "owner", clientId: "client", status: "active", name: "A", currency: "EUR" };
const connection = (value = 10) => ({ id: "sheet", campaignId: "c", isActive: true, purpose: "general", spreadsheetId: "book", sheetName: "Data", lastDataRefreshAt: new Date(), columnMappings: [{ targetFieldId: "campaign_name", sourceColumnIndex: 0, sourceColumnName: "Campaign", selectedValues: ["A"] }], cachedData: { complete: true, spreadsheetId: "book", sheetName: "Data", totalRows: 2, headers: ["Campaign", "Clicks"], rows: [["A", value], ["B", 999]] } });
function setup(platform: string, value = 10, stored = 100, kind = "kpi") {
  const integration = { id: "integration", campaignId: "c" };
  const imported = { id: "import", campaignId: "c", clicks: value, conversions: 0.75, parserMetadata: { validationVersion: 2, requiresReview: false, warnings: [], confidence: 100, extractedFields: 2 } };
  const sheet = connection(value);
  const scope = platform === "custom_integration" ? { platform, integrationId: "integration", scopeType: "latest_validated_import" } : { platform, activeSpreadsheetId: "book:sheet", connectionId: "sheet", spreadsheetId: "book", sheetName: "Data" };
  const row: any = { id: kind, campaignId: "c", platformType: platform, metric: platform === "custom_integration" ? "clicks" : "Clicks", currentValue: String(stored), alertsEnabled: true, alertThreshold: "50", alertCondition: "above", calculationConfig: JSON.stringify({ sourceScope: scope }) };
  const storage: any = { getCampaign: vi.fn(async () => campaign), getCustomIntegration: vi.fn(async () => integration), getLatestCustomIntegrationMetrics: vi.fn(async () => imported), getGoogleSheetsConnections: vi.fn(async () => [sheet]), getRevenueTotalForRange: vi.fn(async () => ({ totalRevenue: 200, sourceIds: ["r"], currency: "EUR" })), getSpendTotalForRange: vi.fn(async () => ({ totalSpend: 100, sourceIds: ["s"], currency: "EUR" })), getRevenueSources: vi.fn(async () => [{ id: "r", isActive: true }]), getSpendSources: vi.fn(async () => [{ id: "s", isActive: true }]) };
  const env = { storage, resolveCampaignCurrentValueForAlert: async (value: any) => value, isGA4Platform: () => false, buildGoogleSheetsMetricSummary, filterGoogleSheetsRows, hasCompleteGoogleSheetsCache, parseGA4FinancialNumber, blockAlertDecision };
  const resolve = new Function(...Object.keys(env), `${code}; return resolveAlertCurrentValueForDecision;`)(...Object.values(env));
  return { row, storage, resolve, imported, sheet, integration };
}

describe.each(["custom_integration", "google_sheets"])("V1-122 %s source-backed decision lifecycle", platform => {
  for (const kind of ["kpi", "benchmark"]) {
    it.each([0, 10, 100])(`${kind} decides from latest source value %s, without changing the saved goal`, async value => {
      const { row, storage, resolve } = setup(platform, value, value > 50 ? 10 : 100, kind);
      const result = await resolve(row);
      expect(Number(result.currentValue)).toBe(value);
      expect(isAlertDecisionBreached(result)).toBe(value > 50);
      expect(row.currentValue).toBe(value > 50 ? "10" : "100");
      expect(storage.getCampaign).toHaveBeenCalledWith("c");
      if (platform === "google_sheets") expect(storage.getGoogleSheetsConnections).toHaveBeenCalledWith("c", undefined, { migrateLegacyTokens: false, resolveRuntimeCredentials: false });
    });
    it.each(["missing-scope", "wrong-source", "deleted-source", "read-failure", "campaign-deleted", "campaign-owner-changed", "source-changed"])(`${kind} blocks %s without falling back to stored 100`, async failure => {
      const { row, storage, resolve } = setup(platform, 10, 100, kind);
      if (failure === "missing-scope") row.calculationConfig = "{}";
      if (failure === "wrong-source") {
        const cfg = JSON.parse(row.calculationConfig); cfg.sourceScope.integrationId = "different"; cfg.sourceScope.connectionId = "different"; row.calculationConfig = JSON.stringify(cfg);
      }
      const read = platform === "custom_integration" ? storage.getCustomIntegration : storage.getGoogleSheetsConnections;
      if (failure === "deleted-source") read.mockResolvedValue(platform === "custom_integration" ? undefined : []);
      if (failure === "read-failure") read.mockRejectedValue(new Error("read failed"));
      if (failure === "campaign-deleted") storage.getCampaign.mockResolvedValue(undefined);
      if (failure === "campaign-owner-changed") storage.getCampaign.mockResolvedValueOnce(campaign).mockResolvedValue({ ...campaign, ownerId: "other" });
      if (failure === "source-changed") {
        if (platform === "custom_integration") storage.getLatestCustomIntegrationMetrics.mockResolvedValueOnce({ id: "old", campaignId: "c", clicks: 10 }).mockResolvedValue({ id: "new", campaignId: "c", clicks: 100 });
        else storage.getGoogleSheetsConnections.mockResolvedValueOnce([connection(10)]).mockResolvedValue([connection(100)]);
      }
      const result = await resolve(row);
      expect(result.__alertDecisionEligible).toBe(false);
      expect(isAlertDecisionBreached(result)).toBe(false);
    });
  }
  it.each(["overview.total_revenue", "overview.total_spend", "overview.roas", "overview.roi"])("resolves %s from the same platform financial totals", async metric => {
    const { row, storage, resolve } = setup(platform);
    row.metric = metric;
    if (platform === "google_sheets") row.calculationConfig = JSON.stringify({ valueSource: "confirmed_financial_overview" });
    const expected = { "overview.total_revenue": 200, "overview.total_spend": 100, "overview.roas": 2, "overview.roi": 100 };
    const result = await resolve(row);
    expect(Number(result.currentValue)).toBe(expected[metric]);
    if (metric !== "overview.total_spend") expect(storage.getRevenueTotalForRange).toHaveBeenCalledWith("c", "1900-01-01", "2999-12-31", platform);
    if (metric !== "overview.total_revenue") expect(storage.getSpendTotalForRange).toHaveBeenCalledWith("c", "1900-01-01", "2999-12-31", platform);
    if (metric === "overview.total_revenue") expect(storage.getSpendTotalForRange).not.toHaveBeenCalled();
    if (metric === "overview.total_spend") expect(storage.getRevenueTotalForRange).not.toHaveBeenCalled();
  });
  it("keeps source loss and read failure out of financial alerts", async () => {
    const { row, storage, resolve } = setup(platform);
    row.metric = "overview.roas";
    if (platform === "google_sheets") row.calculationConfig = JSON.stringify({ valueSource: "confirmed_financial_overview" });
    storage.getRevenueTotalForRange.mockRejectedValue(new Error("unavailable"));
    expect((await resolve(row)).__alertDecisionEligible).toBe(false);
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 200, sourceIds: [], currency: "EUR" });
    expect((await resolve(row)).__alertDecisionEligible).toBe(false);
  });
  it.each(["currency", "zero-spend", "unmaterialized-source"])("blocks financial %s without a false threshold decision", async failure => {
    const { row, storage, resolve } = setup(platform);
    row.metric = "overview.roas";
    if (platform === "google_sheets") row.calculationConfig = JSON.stringify({ valueSource: "confirmed_financial_overview" });
    if (failure === "currency") storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 200, sourceIds: ["r"], currency: "USD" });
    if (failure === "zero-spend") storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: ["s"], currency: "EUR" });
    if (failure === "unmaterialized-source") storage.getRevenueSources.mockResolvedValue([{ id: "pending", isActive: true }]);
    expect((await resolve(row)).__alertDecisionEligible).toBe(false);
  });
});

it("V1-122 preserves intentional Custom manual values and disabled alerts", async () => {
  const { row, storage, resolve } = setup("custom_integration"); row.metric = "custom";
  expect(await resolve(row)).toBe(row);
  expect(storage.getCampaign).not.toHaveBeenCalled();
  row.alertsEnabled = false; expect(isAlertDecisionBreached(await resolve(row))).toBe(false);
});
it.each(["stale", "incomplete", "different-tab", "missing-metric"])("V1-122 Sheets blocks %s cached input", async failure => {
  const { row, sheet, resolve } = setup("google_sheets");
  if (failure === "stale") sheet.lastDataRefreshAt = new Date(Date.now() - 26 * 3600000);
  if (failure === "incomplete") sheet.cachedData.complete = false;
  if (failure === "different-tab") sheet.cachedData.sheetName = "Other";
  if (failure === "missing-metric") row.metric = "Missing";
  expect((await resolve(row)).__alertDecisionEligible).toBe(false);
});
it("V1-122 Sheets ratios use filtered totals and exact saved columns", async () => {
  const { row, sheet, resolve } = setup("google_sheets");
  sheet.columnMappings = [];
  sheet.cachedData.headers = ["Spend", "Clicks", "CPC"];
  sheet.cachedData.rows = [[100, 100, 1], [90, 10, 9]] as any;
  row.metric = "CPC";
  expect(Number((await resolve(row)).currentValue)).toBeCloseTo(190 / 110);
});
it("V1-122 Custom fractional credits remain precise and refresh replaces prior decision value", async () => {
  const { row, imported, resolve } = setup("custom_integration"); row.metric = "conversions";
  expect(Number((await resolve(row)).currentValue)).toBe(0.75);
  imported.conversions = 1.25;
  expect(Number((await resolve(row)).currentValue)).toBe(1.25);
});

describe("Sheets cached alert reads preserve credential behavior for other callers", () => {
  const storageText = readFileSync("server/storage.ts", "utf8");
  const storageSource = ts.createSourceFile("storage.ts", storageText, ts.ScriptTarget.Latest, true);
  const declaration = storageSource.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === "DatabaseStorage") as ts.ClassDeclaration;
  const method = declaration.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(storageSource) === "getGoogleSheetsConnections")!;
  const methodCode = ts.transpileModule(method.getText(storageSource).replace(/^async /, "async function "), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  it.each(["cached-only", "default", "refresh-scope", "legacy-fallback"])("executes the actual storage method: %s", async mode => {
    const row = { ...connection(), accessToken: "fixture-only", method: "service_account" };
    const orderBy = vi.fn(async () => [row]);
    if (mode === "legacy-fallback") orderBy.mockRejectedValue(Object.assign(new Error("missing column"), { code: "42703" }));
    const update = vi.fn(() => ({ set: () => ({ where: async () => undefined }) }));
    const db = { select: () => ({ from: () => ({ where: () => ({ orderBy }) }) }), update, execute: vi.fn(async () => ({ rows: [{ id: "sheet", campaign_id: "c", spreadsheet_id: "book", is_active: true }] })) };
    const hydrate = vi.fn(async value => value);
    const env = { db, googleSheetsConnections: {}, and: (...args: any[]) => args, or: (...args: any[]) => args, eq: (...args: any[]) => args, isNull: (value: any) => value, sql: () => "fixture", buildEncryptedTokens: () => "fixture-encrypted", hydrateDecryptedTokens: (value: any) => value, hydrateGoogleSheetsConnectionForRead: hydrate, devLog: () => undefined };
    const read = new Function(...Object.keys(env), `${methodCode}; return getGoogleSheetsConnections;`)(...Object.values(env));
    const options = mode === "default" ? undefined : mode === "refresh-scope" ? { refreshScope: {} } : { migrateLegacyTokens: false, resolveRuntimeCredentials: false };
    const result = await read("c", undefined, options);
    expect(result[0].id).toBe("sheet");
    expect(update).toHaveBeenCalledTimes(mode === "default" ? 1 : 0);
    expect(hydrate).toHaveBeenCalledTimes(mode === "default" || mode === "refresh-scope" ? 1 : 0);
  });
});

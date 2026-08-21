import { readFileSync } from "fs";
import { join } from "path";
import { findOrphanGA4KpiParents, hashSortedIds, parseArgs } from "./ga4-kpi-damaged-data-cleanup";

describe("GA4 KPI damaged-data cleanup boundary", () => {
  const readScript = () => readFileSync(join(process.cwd(), "server", "ga4-kpi-damaged-data-cleanup.ts"), "utf-8");

  it("defaults to read-only inventory and requires an explicit apply flag", () => {
    const script = readScript();
    const parseArgsStart = script.indexOf("export function parseArgs");
    const parseArgsEnd = script.indexOf("export function printResult", parseArgsStart);
    const parseArgs = script.slice(parseArgsStart, parseArgsEnd);

    expect(parseArgs).toContain('argv.includes("--apply-orphan-kpi-parents")');
    expect(parseArgs).toContain('argv.includes("--apply") ? "apply" : "dry-run"');
    expect(script).toContain("Dry run only. Re-run with --apply only after reviewing the candidate and skipped-row inventory.");
    expect(script).toContain("candidate count=");
    expect(script).toContain("skipped count=");
    expect(script).toContain("sample row IDs=");
    expect(script).toContain("source windows=");
    expect(script).toContain("reason codes=");
  });

  it("detects only GA4 parents whose non-null campaign no longer exists", () => {
    const rows = [
      { id: "orphan", platformType: "google_analytics", campaignId: "missing" },
      { id: "valid", platformType: "google_analytics", campaignId: "present" },
      { id: "platform", platformType: "google_analytics", campaignId: null },
      { id: "other", platformType: "linkedin", campaignId: "missing" },
    ];
    expect(findOrphanGA4KpiParents(rows, new Set(["present"])).map((row) => row.id)).toEqual(["orphan"]);
    expect(findOrphanGA4KpiParents(rows, new Set(["present"]), "different")).toEqual([]);
    expect(hashSortedIds(["b", "a"])).toBe(hashSortedIds(["a", "b"]));
  });

  it("requires exact count and identity guards for the orphan-only apply mode", () => {
    expect(parseArgs(["--apply-orphan-kpi-parents", "--expected-orphan-count=4", `--expected-orphan-set-sha256=${"a".repeat(64)}`])).toEqual({
      mode: "apply-orphan-kpi-parents",
      campaignId: undefined,
      expectedOrphanCount: 4,
      expectedOrphanSetSha256: "a".repeat(64),
    });
    const script = readScript();
    const orphanStart = script.indexOf("async function inspectOrphanKpiParents");
    const orphanEnd = script.indexOf("async function inspectDuplicateAlertState", orphanStart);
    const orphan = script.slice(orphanStart, orphanEnd);
    expect(orphan).toContain("candidate.relatedRows?.progress");
    expect(orphan).toContain("candidate.relatedRows?.alerts");
    expect(orphan).toContain("candidate.relatedRows?.periods");
    expect(orphan).toContain("candidate.relatedRows?.activeNotifications");
    expect(orphan).toContain("await db.transaction");
    expect(orphan).toContain("restoredCampaigns.length > 0");
    expect(orphan).toContain("deleted.length !== options.expectedOrphanCount");
    expect(orphan).not.toContain("delete(notifications)");
  });

  it("limits financial source-window repair to rows that match the old formula exactly", () => {
    const script = readScript();
    const financialStart = script.indexOf("async function inspectFinancialSourceWindowDrift");
    const financialEnd = script.indexOf("async function inspectCustomZeroOverwrites", financialStart);
    const financial = script.slice(financialStart, financialEnd);

    expect(script).toContain('OLD_FINANCIAL_SOURCE_START_DATE = "2000-01-01"');
    expect(financial).toContain("resolveGA4ImportToDateWindow(primary?.importStartDate, (campaign as any)?.reportingTimeZone)");
    expect(financial).toContain("latestDate !== newWindow.endDate");
    expect(script).toContain("storage.getGA4DailyMetrics(campaignId, propertyId, nativeStartDate, nativeEndDate)");
    expect(script).toContain('storage.getSpendTotalForRange(campaignId, "1900-01-01", financialEndDate, "ga4")');
    expect(financial).toContain('campaignStartDate(campaign), newWindow.endDate, "1900-01-01", newWindow.endDate');
    expect(financial).toContain('String(primary?.method || "").trim().toLowerCase() === "access_token"');
    expect(financial).toContain("financial_live_ga4_totals_not_local");
    expect(financial).toContain("matches(currentValue, oldValue) && differs(oldValue, newValue)");
    expect(financial).toContain('reasonCode: "financial_matches_old_window"');
    expect(financial).toContain("await storage.updateKPI(id, { currentValue: String(newValue) } as any);");
    expect(financial).toContain('reasonCode: "financial_current_value_unproven"');
  });

  it("leaves custom zero rows unchanged with an explicit skip reason", () => {
    const script = readScript();
    const customStart = script.indexOf("export const isUnprovenCustomZeroOverwrite");
    const customEnd = script.indexOf("const parseMetadata", customStart);
    const customClassifier = script.slice(customStart, customEnd);
    const inspectStart = script.indexOf("async function inspectCustomZeroOverwrites");
    const inspectEnd = script.indexOf("async function inspectDuplicateAlertState", inspectStart);
    const inspectCustom = script.slice(inspectStart, inspectEnd);

    expect(customClassifier).toContain('platform !== "google_analytics"');
    expect(customClassifier).toContain("isComputableGA4KpiMetric");
    expect(customClassifier).toContain("matches(parseNumber(row?.currentValue), 0)");
    expect(inspectCustom).toContain('kind: "custom_zero_overwrite"');
    expect(inspectCustom).toContain('reasonCode: "custom_zero_previous_value_unproven"');
    expect(inspectCustom).not.toContain("updateKPI");
  });

  it("resolves only active duplicate notifications and retains email audit history", () => {
    const script = readScript();
    const duplicateStart = script.indexOf("async function inspectDuplicateAlertState");
    const duplicateEnd = script.indexOf("export async function inventoryGA4KPIDamagedData", duplicateStart);
    const duplicate = script.slice(duplicateStart, duplicateEnd);

    expect(duplicate).toContain("getLatestGA4KPIIdsByDuplicateKey(rows)");
    expect(duplicate).toContain("!isLatestGA4KPIForDuplicateKey(row, latestIdsByKey)");
    expect(duplicate).toContain('eq(notifications.type, "performance-alert")');
    expect(duplicate).toContain("if (meta?.resolved || meta?.dismissedAt) continue;");
    expect(duplicate).toContain('kind: "duplicate_notification_state"');
    expect(duplicate).toContain('resolvedReason: "superseded"');
    expect(duplicate).toContain('kind: "duplicate_email_audit_state"');
    expect(duplicate).toContain('reasonCode: "duplicate_email_audit_retained"');
    expect(duplicate).not.toContain("delete");
  });

  it("documents the current cleanup boundary and unproven rows", () => {
    const doc = readFileSync(join(process.cwd(), "GA4", "KPIS_PRODUCTION_READINESS.md"), "utf-8");

    expect(doc).toContain("server/ga4-kpi-damaged-data-cleanup.ts");
    expect(doc).toContain("financial_source_window_drift");
    expect(doc).toContain("custom_zero_previous_value_unproven");
    expect(doc).toContain("duplicate_notification_state");
    expect(doc).toContain("Email audit rows are inventoried but retained");
  });
});

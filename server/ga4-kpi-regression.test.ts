import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 KPI regression guard", () => {
  it("routes GA4 KPI notifications to ga4-metrics instead of LinkedIn", () => {
    const notificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );

    expect(notificationsFile).toContain("function buildKPIActionUrl(kpi: KPI): string {");
    expect(notificationsFile).toContain('if (platform === "google_analytics") {');
    expect(notificationsFile).toContain('/ga4-metrics?tab=kpis&highlight=');
    expect(notificationsFile).toContain('/linkedin-analytics?tab=kpis&highlight=');
    expect(notificationsFile).toContain("const actionUrl = buildKPIActionUrl(kpi);");
  });

  it("allows breached alert-enabled GA4 KPIs to be considered by the alert checker", () => {
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "kpi-scheduler.ts"),
      "utf-8"
    );
    const activeKpisQueryMatch = schedulerFile.match(
      /const activeKPIsRaw = await db\.select\(\)\s*\.from\(kpis\)\s*\.where\(and\(([\s\S]*?)\)\);/
    );
    const activeKpisQuery = activeKpisQueryMatch?.[0] || "";

    expect(activeKpisQuery).toContain("eq(kpis.alertsEnabled, true)");
    expect(activeKpisQuery).not.toContain("eq(kpis.status, 'active')");
    expect(schedulerFile).toContain("if (shouldTriggerAlert(kpi)) {");
    expect(schedulerFile).toContain("await createKPIAlert(kpi);");
  });

  it("opens GA4 Create KPI with a clean empty form state", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const getEmptyKpiFormValues = (): KPIFormData => ({");
    expect(ga4MetricsFile).toContain("kpiForm.reset(getEmptyKpiFormValues());");
    expect(ga4MetricsFile).toContain("kpiForm.reset({");
    expect(ga4MetricsFile).toContain("...getEmptyKpiFormValues(),");
    expect(ga4MetricsFile).not.toContain('kpiForm.reset({ ...kpiForm.getValues(), name: "", metric: "", description: "", unit: "%", currentValue: "", targetValue: "", priority: "medium" });');
  });

  it("renders the GA4 KPI unit field as a constrained dropdown", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const unitStart = ga4MetricsFile.indexOf('<Label htmlFor="kpi-unit">Unit</Label>');
    const unitEnd = ga4MetricsFile.indexOf('{/* Priority', unitStart);
    const unitSection = ga4MetricsFile.slice(unitStart, unitEnd);

    expect(unitStart).toBeGreaterThan(-1);
    expect(unitEnd).toBeGreaterThan(unitStart);
    expect(ga4MetricsFile).toContain("const getKpiUnitOptions = (selectedUnit?: string) => {");
    expect(unitSection).toContain('<Select value={String(kpiForm.watch("unit") || SELECT_UNIT)}');
    expect(unitSection).toContain('<SelectTrigger id="kpi-unit">');
    expect(unitSection).toContain('<SelectItem value={SELECT_UNIT} disabled>Select unit</SelectItem>');
    expect(ga4MetricsFile).toContain('{ value: "%", label: "Percentage (%)" }');
    expect(ga4MetricsFile).toContain('{ value: campaignCurrency, label: `Currency (${campaignCurrency})` }');
    expect(ga4MetricsFile).toContain('{ value: "count", label: "Count" }');
    expect(ga4MetricsFile).toContain('{ value: "ratio", label: "Ratio (x)" }');
    expect(unitSection).not.toContain("<Input");
  });

  it("renders the GA4 Benchmark unit field as a constrained dropdown", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const currentValueStart = ga4MetricsFile.indexOf("{/* Current Value + Benchmark Value + Unit */}");
    const unitStart = ga4MetricsFile.indexOf('<div className="text-sm font-medium text-foreground/80/60">Unit</div>', currentValueStart);
    const unitEnd = ga4MetricsFile.indexOf("</Select>", unitStart);
    const unitSection = ga4MetricsFile.slice(unitStart, unitEnd);

    expect(currentValueStart).toBeGreaterThan(-1);
    expect(unitStart).toBeGreaterThan(currentValueStart);
    expect(unitEnd).toBeGreaterThan(unitStart);
    expect(unitSection).toContain('<Select value={String(newBenchmark.unit || SELECT_UNIT)}');
    expect(unitSection).toContain('<SelectTrigger id="benchmark-unit">');
    expect(unitSection).toContain('<SelectItem value={SELECT_UNIT} disabled>Select unit</SelectItem>');
    expect(unitSection).toContain('getKpiUnitOptions(String(newBenchmark.unit || "")).map');
    expect(ga4MetricsFile).not.toContain('placeholder="%, $, count, etc."');
  });

  it("keeps custom Benchmark values as generic numbers until a unit is selected", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const valuesStart = ga4MetricsFile.indexOf("{/* Current Value + Benchmark Value + Unit */}");
    const valuesEnd = ga4MetricsFile.indexOf("{/* Alert Settings */}", valuesStart);
    const valuesSection = ga4MetricsFile.slice(valuesStart, valuesEnd);

    expect(valuesStart).toBeGreaterThan(-1);
    expect(valuesEnd).toBeGreaterThan(valuesStart);
    expect(valuesSection).toContain("currentValue: formatNumberByUnit(e.target.value, String(prev.unit || SELECT_UNIT))");
    expect(valuesSection).toContain("benchmarkValue: formatNumberWhileTyping(e.target.value, String(newBenchmark.unit || SELECT_UNIT))");
    expect(valuesSection).toContain("benchmarkValue: formatNumberByUnit(e.target.value, String(prev.unit || SELECT_UNIT))");
    expect(valuesSection).not.toContain('String(prev.unit || "%")');
    expect(valuesSection).not.toContain('String(newBenchmark.unit || "%")');
  });

  it("highlights the custom KPI tile when selected", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const templateStart = ga4MetricsFile.indexOf('name: "Create Custom KPI"');
    const templateEnd = ga4MetricsFile.indexOf('Choose name + unit, then set values', templateStart);
    const templateSection = ga4MetricsFile.slice(templateStart, templateEnd);

    expect(templateStart).toBeGreaterThan(-1);
    expect(templateEnd).toBeGreaterThan(templateStart);
    expect(templateSection).toContain("selectedKPITemplate?.name === template.name");
    expect(templateSection).toContain("setSelectedKPITemplate(template);");
    expect(templateSection).not.toContain("!isCustom && selectedKPITemplate?.name === template.name");
    expect(ga4MetricsFile).toContain("if (selectedKPITemplate && !(selectedKPITemplate as any)?._isCustom)");
  });

  it("renders and highlights the custom benchmark tile", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const benchmarkStart = ga4MetricsFile.indexOf("Select Benchmark Template");
    const benchmarkEnd = ga4MetricsFile.indexOf("{/* Benchmark Name */}", benchmarkStart);
    const benchmarkSection = ga4MetricsFile.slice(benchmarkStart, benchmarkEnd);

    expect(benchmarkStart).toBeGreaterThan(-1);
    expect(benchmarkEnd).toBeGreaterThan(benchmarkStart);
    expect(benchmarkSection).toContain('name: "Create Custom Benchmark"');
    expect(benchmarkSection).toContain("Choose name + unit, then set values");
    expect(benchmarkSection).toContain("selectedBenchmarkTemplate?.metric === template.metric");
    expect(benchmarkSection).toContain("setSelectedBenchmarkTemplate(template);");
    expect(benchmarkSection).not.toContain("!isCustom && selectedBenchmarkTemplate?.metric === template.metric");
  });

  it("keeps custom KPI values as generic numbers until a unit is selected", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const formatStart = ga4MetricsFile.indexOf("const formatNumberByUnit = (raw: string, unit: string) => {");
    const formatEnd = ga4MetricsFile.indexOf("// UX-friendly formatting", formatStart);
    const formatSection = ga4MetricsFile.slice(formatStart, formatEnd);

    expect(formatStart).toBeGreaterThan(-1);
    expect(formatEnd).toBeGreaterThan(formatStart);
    expect(formatSection).toContain('const normalizedUnit = String(unit || "").trim();');
    expect(formatSection).toContain("if (!normalizedUnit || normalizedUnit === SELECT_UNIT) {");
    expect(formatSection).toContain("minimumFractionDigits: 0, maximumFractionDigits: 2");
    expect(formatSection.indexOf("normalizedUnit === SELECT_UNIT")).toBeLessThan(formatSection.indexOf('normalizedUnit === "count"'));
  });

  it("disables the GA4 edit KPI submit button until the form changes", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const editStart = ga4MetricsFile.indexOf("const editValues: KPIFormData = {");
    const editEnd = ga4MetricsFile.indexOf("setShowKPIDialog(true);", editStart);
    const editSection = ga4MetricsFile.slice(editStart, editEnd);
    const dialogStart = ga4MetricsFile.indexOf("{/* Create KPI Dialog */}");
    const footerStart = ga4MetricsFile.indexOf("<DialogFooter>", dialogStart);
    const footerEnd = ga4MetricsFile.indexOf("</DialogFooter>", footerStart);
    const footerSection = ga4MetricsFile.slice(footerStart, footerEnd);

    expect(ga4MetricsFile).toContain("const [kpiEditInitialValues, setKpiEditInitialValues] = useState<KPIFormData | null>(null);");
    expect(ga4MetricsFile).toContain("const areKpiFormValuesEqual = (current: Partial<KPIFormData>, initial: Partial<KPIFormData>) =>");
    expect(ga4MetricsFile).toContain("const watchedKpiFormValues = kpiForm.watch();");
    expect(ga4MetricsFile).toContain("const isKpiEditUnchanged = Boolean(editingKPI) && (!kpiEditInitialValues || areKpiFormValuesEqual(watchedKpiFormValues, kpiEditInitialValues));");
    expect(ga4MetricsFile).toContain("const isKpiSubmitDisabled = createKPIMutation.isPending || updateKPIMutation.isPending || isKpiEditUnchanged;");
    expect(editStart).toBeGreaterThan(-1);
    expect(editEnd).toBeGreaterThan(editStart);
    expect(editSection).toContain("const editValues: KPIFormData = {");
    expect(editSection).toContain("kpiForm.reset(editValues);");
    expect(editSection).toContain("setKpiEditInitialValues(editValues);");
    expect(footerSection).toContain('disabled={isKpiSubmitDisabled}');
  });

  it("disables the GA4 edit Benchmark submit button until the form changes", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const editStart = ga4MetricsFile.indexOf("const editValues = {");
    const editEnd = ga4MetricsFile.indexOf("setBenchmarkEditInitialValues(editValues);", editStart);
    const editSection = ga4MetricsFile.slice(editStart, editEnd);
    const dialogStart = ga4MetricsFile.indexOf("{/* Header with Create Button */}");
    const footerStart = ga4MetricsFile.indexOf("<DialogFooter>", dialogStart);
    const footerEnd = ga4MetricsFile.indexOf("</DialogFooter>", footerStart);
    const footerSection = ga4MetricsFile.slice(footerStart, footerEnd);

    expect(ga4MetricsFile).toContain("const [benchmarkEditInitialValues, setBenchmarkEditInitialValues] = useState<typeof newBenchmark | null>(null);");
    expect(ga4MetricsFile).toContain("const areBenchmarkFormValuesEqual = (current: Record<string, unknown>, initial: Record<string, unknown>) =>");
    expect(ga4MetricsFile).toContain("const isBenchmarkEditUnchanged = Boolean(editingBenchmark) && (!benchmarkEditInitialValues || areBenchmarkFormValuesEqual(newBenchmark, benchmarkEditInitialValues));");
    expect(ga4MetricsFile).toContain("const isBenchmarkSubmitDisabled = createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending || isBenchmarkEditUnchanged;");
    expect(editStart).toBeGreaterThan(-1);
    expect(editEnd).toBeGreaterThan(editStart);
    expect(editSection).toContain("const editValues = {");
    expect(ga4MetricsFile).toContain("setBenchmarkEditInitialValues(editValues);");
    expect(footerSection).toContain("disabled={isBenchmarkSubmitDisabled}");
  });

  it("keeps GA4 KPI percentage card values precise enough to explain progress math", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain('const formatKpiCardValue = (value: string, unit: string) => {');
    expect(ga4MetricsFile).toContain("const rounded = Math.round(numValue * 100) / 100;");
    expect(ga4MetricsFile).toContain('formatPct(abs).replace("%", "")');
    expect(ga4MetricsFile).toContain('formatKpiCardValue(getLiveKpiValue(kpi) || "0", kpi.unit)');
    expect(ga4MetricsFile).toContain('formatKpiCardValue(String(t.effectiveTarget), kpi.unit)');
  });
});

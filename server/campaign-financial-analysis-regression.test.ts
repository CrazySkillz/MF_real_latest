import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { insertCampaignSchema } from "@shared/schema";
import { buildFinancialAllocationAction, buildFinancialBudgetAction } from "../client/src/lib/financial-executive-actions";

describe("campaign Budget & Financial Analysis regression guard", () => {
  it("uses actual budget pacing instead of total-budget utilization alone", () => {
    const base = {
      hasCampaignBudget: true,
      spendAvailable: true,
      spendUnavailableText: "Spend unavailable",
      isOverBudget: false,
      overBudgetAmountText: "$0.00",
      hasValidDateRange: true,
      elapsedDays: 21,
      pacingVarianceText: "92.2%",
      budgetUtilizationText: "1.3%",
      remainingBudgetText: "$197,300.25",
    };

    expect(buildFinancialBudgetAction({ ...base, pacingStatus: "behind" })).toEqual(expect.objectContaining({
      title: "Budget is pacing below target",
      body: expect.stringContaining("92.2% below target after 21 elapsed budget-period days"),
      tone: "warning",
    }));
    expect(buildFinancialBudgetAction({ ...base, pacingStatus: "on-track" })).toEqual(expect.objectContaining({
      title: "Budget pacing is on track",
      body: expect.stringContaining("$197,300.25 remains available"),
      tone: "success",
    }));
  });

  it("withholds pacing decisions when dates are missing or the budget period has not started", () => {
    const base = {
      hasCampaignBudget: true,
      spendAvailable: true,
      spendUnavailableText: "Spend unavailable",
      isOverBudget: false,
      overBudgetAmountText: "$0.00",
      pacingStatus: "unavailable" as const,
      pacingVarianceText: "0.0%",
      budgetUtilizationText: "1.3%",
      remainingBudgetText: "$197,300.25",
    };

    expect(buildFinancialBudgetAction({ ...base, hasValidDateRange: false, elapsedDays: 0 }).title).toBe("Budget pacing unavailable");
    expect(buildFinancialBudgetAction({ ...base, hasValidDateRange: true, elapsedDays: 0 }).title).toBe("Budget period has not started");
    expect(buildFinancialBudgetAction({ ...base, spendAvailable: false, hasValidDateRange: true, elapsedDays: 21 }).body).toBe("Spend unavailable");
  });

  it("distinguishes over-budget and above-target pacing", () => {
    const base = {
      hasCampaignBudget: true,
      spendAvailable: true,
      spendUnavailableText: "Spend unavailable",
      overBudgetAmountText: "$500.00",
      hasValidDateRange: true,
      elapsedDays: 10,
      pacingStatus: "ahead" as const,
      pacingVarianceText: "20.0%",
      budgetUtilizationText: "60.0%",
      remainingBudgetText: "$40,000.00",
    };

    expect(buildFinancialBudgetAction({ ...base, isOverBudget: true })).toEqual(expect.objectContaining({
      title: "Campaign is over budget",
      body: expect.stringContaining("$500.00"),
    }));
    expect(buildFinancialBudgetAction({ ...base, isOverBudget: false })).toEqual(expect.objectContaining({
      title: "Budget is pacing above target",
      body: expect.stringContaining("20.0% above target"),
    }));
  });

  it("reports the exact source-allocation availability reason", () => {
    const base = {
      spendInputs: [] as Array<{ label: string; spend: number }>,
      authoritativeSpend: 2_699.75,
      formatCurrency: (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      formatPercentage: (value: number) => `${value.toFixed(1)}%`,
    };
    expect(buildFinancialAllocationAction({ ...base, hasCampaignToDateWindow: false, sources: [] }).title).toBe("Allocation window unavailable");

    const spendSourceMix = buildFinancialAllocationAction({
      ...base,
      hasCampaignToDateWindow: true,
      sources: [],
      spendInputs: [
        { label: "Test_rev_spend.csv", spend: 550 },
        { label: "spend.csv", spend: 200 },
        { label: "Test_spend_alpha.csv", spend: 1_250 },
        { label: "Google Sheets", spend: 699.75 },
      ],
    });
    expect(spendSourceMix.title).toBe("Review spend source mix");
    expect(spendSourceMix.body).toContain("Test_spend_alpha.csv is the largest of 4 spend sources at $1,250.00 (46.3%)");

    expect(buildFinancialAllocationAction({
      ...base,
      hasCampaignToDateWindow: true,
      sources: [],
      spendInputs: [{ label: "Incomplete.csv", spend: 550 }],
    }).title).toBe("Spend source allocation unavailable");

    expect(buildFinancialAllocationAction({
      ...base,
      hasCampaignToDateWindow: true,
      sources: [{ label: "Google Ads", roas: 2 }],
    }).title).toBe("No reallocation decision yet");

    expect(buildFinancialAllocationAction({
      ...base,
      hasCampaignToDateWindow: true,
      sources: [{ label: "Google Ads", roas: 2 }, { label: "LinkedIn Ads", roas: null }],
    }).title).toBe("Source return comparison unavailable");

    expect(buildFinancialAllocationAction({
      ...base,
      hasCampaignToDateWindow: true,
      sources: [{ label: "Google Ads", roas: 2 }, { label: "LinkedIn Ads", roas: 3 }],
    }).title).toBe("Review source allocation");
  });

  it("persists a valid Budget when Step 1 is resubmitted for an existing campaign draft", () => {
    const campaignsPage = readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf-8");
    const submitStart = campaignsPage.indexOf("const handleSubmit = async");
    const submitEnd = campaignsPage.indexOf("const handleConnectorsComplete = async", submitStart);
    const submitHandler = campaignsPage.slice(submitStart, submitEnd);
    const existingDraftStart = submitHandler.indexOf("if (draftCampaignId)");
    const existingDraftEnd = submitHandler.indexOf("// Create a real campaign first", existingDraftStart);
    const existingDraftBranch = submitHandler.slice(existingDraftStart, existingDraftEnd);

    expect(existingDraftBranch).toContain('apiRequest("PATCH", `/api/campaigns/${draftCampaignId}`');
    expect(existingDraftBranch).toContain("budget: data.budget ? data.budget.replace(/,/g, '') : null");
    expect(existingDraftBranch).toContain('currency: data.currency || "USD"');
    expect(existingDraftBranch.indexOf('apiRequest("PATCH"')).toBeLessThan(existingDraftBranch.indexOf("setWizardStep(2)"));
    expect(existingDraftBranch).not.toContain("pacingStartDate");
    expect(existingDraftBranch).not.toContain("pacingEndDate");
  });

  it("keeps pacing dates separate from campaign financial dates", () => {
    const schema = readFileSync(join(process.cwd(), "shared", "schema.ts"), "utf-8");
    const migration = readFileSync(join(process.cwd(), "migrations", "0013_add_campaign_pacing_dates.sql"), "utf-8");
    const startup = readFileSync(join(process.cwd(), "server", "index.ts"), "utf-8");
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const mutationStart = page.indexOf("const updatePacingInputsMutation = useMutation({");
    const mutationEnd = page.indexOf("const comparisonType", mutationStart);
    const mutation = page.slice(mutationStart, mutationEnd);

    expect(schema).toContain('pacingStartDate: text("pacing_start_date")');
    expect(schema).toContain('pacingEndDate: text("pacing_end_date")');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS pacing_start_date TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS pacing_end_date TEXT");
    expect(startup).toContain("ADD COLUMN IF NOT EXISTS pacing_start_date TEXT");
    expect(startup).toContain("ADD COLUMN IF NOT EXISTS pacing_end_date TEXT");
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\b(start_date|end_date)\s*=/i);
    expect(page).toContain("pacingStartDate?: string | null;");
    expect(page).toContain("pacingEndDate?: string | null;");
    expect(mutation).toContain("pacingStartDate: data.pacingStartDate || null");
    expect(mutation).toContain("pacingEndDate: data.pacingEndDate || null");
    expect(mutation).not.toContain("startDate:");
    expect(mutation).not.toContain("endDate:");
    expect(page).toContain("campaign.pacingStartDate");
    expect(page).toContain("campaign.pacingEndDate");
    expect(page).not.toContain("setPacingStartDateInput(formatDateInputValue(campaign.startDate))");
    expect(page).not.toContain("setPacingEndDateInput(formatDateInputValue(campaign.endDate))");
    expect(page).toContain("Budget Period Start");
    expect(page).toContain("Budget Period End");
    expect(insertCampaignSchema.partial().safeParse({ pacingStartDate: "2026-08-01", pacingEndDate: "2026-11-30" }).success).toBe(true);
    expect(insertCampaignSchema.partial().safeParse({ pacingStartDate: "2026-02-30" }).success).toBe(false);
  });

  it("requires campaign access before returning outcome totals", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(routes).toContain('app.get("/api/campaigns/:id/outcome-totals", requireCampaignAccessParamId, async (req, res) => {');
  });

  it("adds the shared performanceSummary aggregate contract for Budget & Financial tabs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");

    expect(page).toContain("const { data: outcomeTotals, isLoading: outcomeTotalsLoading, isError: outcomeTotalsError } = useQuery<any>({");
    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days"');
    expect(page).toContain("outcome-totals?dateRange=90days");
    expect(page).toContain('if (!response.ok) throw new Error("Failed to load aggregate financial totals");');
    expect(page).toContain("<TabsList>");
    expect(page).not.toContain('TabsList className="grid w-full grid-cols-5"');
    expect(page).toContain("Campaign-wide budget, pacing, ROI, ROAS, and financial decisioning");
    expect(page).toContain("Campaign-level financial health from aggregate spend, revenue, budget, pacing, ROI, and ROAS");
    expect(page).toContain("placeholderData: (previousData: any) => previousData");
    expect(page).toContain("const FINANCIAL_ANALYSIS_REFRESH_MS = 30000;");
    expect(page).toContain("refetchInterval: FINANCIAL_ANALYSIS_REFRESH_MS");
    expect(page).toContain("refetchIntervalInBackground: false");
    expect(page).toContain("refetchOnWindowFocus: true");
    expect(page).toContain('queryKey: ["/api/campaigns", campaignId]');
    expect(page).toContain("const financialComparisonDate = resolveFinancialComparisonDate(");
    expect(page).toContain("snapshotType=financial_daily&comparisonDate=${financialComparisonDate}");
    expect(page).toContain("enabled: !!campaignId && !!financialComparisonDate && !demoMode");
    expect(page).toContain("comparisonData?.comparisonDate === financialComparisonDate");
    expect(page).not.toContain("enabled: false, // Withhold comparisons until the protected exact-date snapshot path is certified.");
    expect(page).not.toContain("snapshots?date=");
    expect(page).toContain("const performanceSummary = outcomeTotals?.performanceSummary;");
    expect(page).toContain('const hasCampaignToDateWindow = performanceSummary?.version === "performance_summary_aggregate_v3"');
    expect(page).toContain('currentValueWindow?.mode === "initial_import_to_latest_completed_day"');
    expect(page).toContain("const aggregateUnavailable = !demoMode && !performanceSummary && (outcomeTotalsError || outcomeTotals !== undefined);");
    expect(page).toContain("const performanceSources = Array.isArray(performanceSummary?.sources) ? performanceSummary.sources : [];");
    expect(page).toContain("const aggregateMetric = (metricName: string) => performanceSummary?.totals?.[metricName];");
    expect(page).toContain("const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;");
    expect(page).toContain("const aggregateMetricValue = (metricName: string): number | null => {");
    expect(page).toContain("const aggregateMetricSources = (metricName: string): string[] => {");
    expect(page).toContain("const aggregateMetricUnavailableReasons = (metricName: string): string[] => {");
    expect(page).toContain('effectiveSnapshot?.snapshotType === "financial_daily"');
    expect(page).toContain("effectiveSnapshot?.reportingDate === financialComparisonDate");
    expect(page).toContain('snapshotFinancialDaily?.currentValueWindow?.mode === "initial_import_to_latest_completed_day"');
    expect(page).toContain("snapshotFinancialDaily?.currentValueWindow?.startDate === currentValueWindow?.startDate");
    expect(page).toContain('const historicalSpend = historicalFinancialInputValue("spend")');
    expect(page).toContain('const historicalRevenue = historicalFinancialInputValue("revenue")');
    expect(page).toContain('const historicalConversions = historicalFinancialInputValue("conversions")');
    expect(page).toContain("void budgetFinancialAggregate;");
    expect(page).not.toContain("Demo Data");
    expect(page).not.toContain("Showing demo data");
  });

  it("renders one executive financial view without duplicate tabs or unverified trends", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const executiveStart = page.indexOf('<div className="space-y-8" data-testid="executive-financial-analysis">');
    const legacyStart = page.indexOf("{/* Legacy tab renderer retained as a non-rendering rollback reference. */}", executiveStart);
    const executiveView = page.slice(executiveStart, legacyStart);
    const executiveDecisionStart = page.indexOf("const executiveFinancialActions");
    const executiveDecisionEnd = page.indexOf("const executiveActionClass", executiveDecisionStart);
    const executiveDecisions = page.slice(executiveDecisionStart, executiveDecisionEnd);
    const financialPositionStart = executiveView.indexOf('aria-labelledby="financial-position-heading"');
    const budgetPacingStart = executiveView.indexOf('aria-labelledby="budget-pacing-heading"');
    const financialPosition = executiveView.slice(financialPositionStart, budgetPacingStart);
    const allocationSourcesStart = executiveView.indexOf('aria-labelledby="allocation-sources-heading"');
    const executiveActionStart = executiveView.indexOf('aria-labelledby="executive-action-heading"');
    const allocationSources = executiveView.slice(allocationSourcesStart, executiveActionStart);

    expect(executiveStart).toBeGreaterThan(-1);
    expect(legacyStart).toBeGreaterThan(executiveStart);
    expect(executiveView).toContain('aria-labelledby="financial-position-heading"');
    expect(executiveView).toContain('aria-labelledby="budget-pacing-heading"');
    expect(financialPosition).toContain('<h3 id="conversion-efficiency-heading"');
    expect(executiveView.match(/id="conversion-efficiency-heading"/g)).toHaveLength(1);
    expect(executiveView).toContain('aria-labelledby="paid-media-efficiency-heading"');
    expect(executiveView).toContain('aria-labelledby="allocation-sources-heading"');
    expect(executiveView).toContain('aria-labelledby="executive-action-heading"');
    expect(executiveView).toContain('label: "Total Spend"');
    expect(executiveView).toContain('label: "Total Revenue"');
    expect(executiveView).toContain('label: "Profit"');
    expect(executiveView).toContain('label: "ROAS"');
    expect(executiveView).toContain('label: "ROI"');
    expect(executiveView).toContain('label: "CPA"');
    expect(allocationSources).toContain("<CardTitle>Sources Used</CardTitle>");
    expect(allocationSources).not.toContain("<CardTitle>Budget Allocation</CardTitle>");
    expect(allocationSources).not.toContain('className="grid gap-6 xl:grid-cols-2"');
    expect(allocationSources.match(/grid-cols-\[minmax\(0,1fr\)_7rem\]/g)).toHaveLength(2);
    expect(allocationSources.match(/whitespace-nowrap font-medium tabular-nums/g)).toHaveLength(2);
    expect(executiveView).toContain("financialChildSourceBreakdowns.length > 0");
    expect(executiveView).toContain("financialSpendInputBreakdowns.length > 0");
    expect(executiveView).toContain("executiveFinancialActions.map");
    expect(executiveDecisions).toContain("buildFinancialBudgetAction({");
    expect(executiveDecisions).toContain("buildFinancialAllocationAction({");
    expect(executiveDecisions).not.toContain("overviewBudgetUtilization < 50");
    expect(executiveView).toContain("Financial return, pacing, and spend-source guidance from the same displayed aggregate values.");
    expect(executiveView).not.toContain("Prioritized financial risks and actions");
    expect(page).toContain("const paidMediaEfficiencyMetrics = [");
    expect(page).toContain("].filter((item) => item.metric.available);");
    expect(page).toContain("const paidMediaEfficiencySourceLabels = financialMainSources");
    expect(page).toContain("const conversionEfficiencySourceLabels = financialMainSources");
    expect(page).toContain("const conversionEfficiencyCvrMetric = campaignToDateEfficiencyMetric(overviewCvrMetric, \"CVR\");");
    expect(executiveView).toContain("paidMediaEfficiencyMetrics.length > 0");
    expect(executiveView).toContain("conversionEfficiencyCvrMetric.available");
    expect(executiveView).not.toContain('id="cost-efficiency-heading"');
    expect(page).toContain("const campaignToDateAllocationSources: FinancialSourceBreakdown[] = demoMode || hasCampaignToDateWindow ? budgetAllocationSources : [];");
    expect(executiveView).not.toContain("<TabsList>");
    expect(executiveView).not.toContain("<TabsTrigger");
    expect(executiveView).not.toContain("Campaign Health Score");
    expect(executiveView).not.toContain("historicalMetrics");
    expect(executiveView).not.toContain("renderTrendIndicator");
    expect(page).toContain("{((): boolean => false)() && (");
  });

  it("keeps every visible financial section on the same authoritative aggregate inputs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const executiveStart = page.indexOf('<div className="space-y-8" data-testid="executive-financial-analysis">');
    const legacyStart = page.indexOf("{/* Legacy tab renderer retained as a non-rendering rollback reference. */}", executiveStart);
    const executiveView = page.slice(executiveStart, legacyStart);

    expect(page).toContain("const financialSpendMetric = overviewSpendMetric;");
    expect(page).toContain("const financialRevenueMetric = overviewRevenueMetric;");
    expect(page).toContain("const financialRoiMetric = overviewRoiMetric;");
    expect(page).toContain("const financialRoasMetric = overviewRoasMetric;");
    expect(executiveView).toContain("formatOverviewCurrency(financialSpendMetric)");
    expect(executiveView).toContain("formatOverviewCurrency(financialRevenueMetric)");
    expect(page).toContain("financialRevenueMetric.value - financialSpendMetric.value");
    expect(executiveView).toContain("formatOverviewCurrency(overviewCpaMetric)");
    expect(executiveView).toContain("formatOverviewPercentage(conversionEfficiencyCvrMetric)");
    expect(executiveView).not.toContain("{conversionEfficiencyDescription}");
    expect(executiveView).not.toContain("CVR shows how effectively campaign sessions or clicks become conversions.");
    expect(page).not.toContain("conversionEfficiencyDescription");
    expect(page).not.toContain("cumulative reporting window");
    expect(executiveView).toContain("formatCurrency(overviewRemainingBudget)");
    expect(page).toContain("campaignToDateEfficiencyMetric(overviewCpcMetric, \"CPC\")");
    expect(page).toContain("campaignToDateEfficiencyMetric(overviewCpmMetric, \"CPM\")");
    expect(page).toContain("campaignToDateEfficiencyMetric(overviewCtrMetric, \"CTR\")");
    expect(executiveView).toContain("financialChildSourceBreakdowns.length > 0");
    expect(executiveView).toContain("financialSpendInputBreakdowns.length > 0");
    expect(page).toContain("authoritativeSpend: financialSpendMetric.available ? financialSpendMetric.value : null");
  });

  it("feeds first-class Connected Platform sources into the shared aggregate contract", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routes).toContain("async function buildGoogleAdsPlatformSourceForAggregate(campaignId: string, startDate: string, endDate: string, requirePersistedRows = false)");
    expect(routes).toContain("exactWindow?: { startDate: string; endDate: string }");
    expect(routes).toContain("const googleAdsConn = await storage.getGoogleAdsConnection(campaignId).catch(() => null);");
    expect(routes).toContain("const googleAdsRows = (await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate))");
    expect(routes).toContain('id: "google_ads"');
    expect(routes).toContain('label: "Google Ads"');
    expect(routes).toContain('category: "paid_media"');
    expect(routes).toContain('includedMetrics: hasWindowData ? ["impressions", "clicks", ...(spendAvailable ? ["spend"] : []), "conversions", ...(hasImportedAttributedRevenue ? ["attributedRevenue"] : [])] : []');
    expect(routes).toContain('Google Ads Total Revenue requires a Google Ads-scoped imported revenue source');
    expect(routes).toContain('selectedCampaignIds.every((id) => coveredCampaignIds.has(id))');
    expect(routes).toContain('observedCurrencies.size === 1 && observedCurrencies.has(String(expectedCurrency || "").trim().toUpperCase())');
    expect(route).toContain("spendAvailable: !currentValueWindow");
    expect(route).toContain("custom = { connected: true, available: false };");
    expect(route).toContain("const aggregateStartDate = currentValueWindow?.startDate || startDate;");
    expect(route).toContain("buildGoogleAdsPlatformSourceForAggregate(campaignId, aggregateStartDate, aggregateEndDate, requireExactPlatformRows)");
    expect(route).toContain("currentValueWindow ? { startDate: currentValueWindow.startDate, endDate: currentValueWindow.endDate } : undefined");
    expect(route).toContain("const platformSpendFallback = parseFloat((linkedInSpend + metaSpend + googleAdsSpend + instagramSpendForAggregate + tiktokSpend + parseNum(googleSheets?.metrics?.spend) + parseNum(custom?.spend)).toFixed(2));");
    expect(route).toContain("mainPlatformSources: { googleAds, instagram, tiktok, googleSheets }");
    expect(route).toContain("buildGoogleSheetsPlatformSourceForAggregate(campaign, googleSheetsConnections as any[], googleSheetsFinancials, !currentValueWindow)");
  });

  it("wires the Overview tab to aggregate financial metrics with unavailable states", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="roi-roas"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain("const dataLoading = !demoMode && (linkedInLoading || ciLoading || metaLoading || ga4Loading || outcomeTotalsLoading);");
    expect(page).toContain('const overviewSpendMetric = getOverviewMetric("spend", totalSpend);');
    expect(page).toContain('const overviewRevenueMetric = getOverviewMetric("revenue", estimatedRevenue);');
    expect(page).toContain('const overviewConversionsMetric = getOverviewMetric("conversions", totalConversions);');
    expect(page).toContain('const overviewCpcMetric = getOverviewMetric("cpc", cpc);');
    expect(page).toContain('const overviewCpaMetric = getOverviewMetric("cpa", cpa);');
    expect(page).toContain('const overviewCpmMetric = getOverviewMetric("cpm", cpm);');
    expect(page).toContain('const overviewCtrMetric = getOverviewMetric("ctr", ctr);');
    expect(page).toContain('const overviewCvrMetric = getOverviewMetric("cvr", conversionRate);');
    expect(page).toContain('const overviewRoiMetric = getOverviewMetric("roi", roi);');
    expect(page).toContain('const overviewRoasMetric = getOverviewMetric("roas", roas);');
    expect(page).toContain('unavailableReasons: ["Aggregate financial totals are unavailable"]');
    expect(page).toContain("if (aggregateUnavailable) {");
    expect(page).toContain("{demoMode && !performanceSummary && (");
    expect(page).toContain('aggregateUnavailable\n                              ? "Aggregate financial totals are unavailable."');
    expect(page).not.toContain("{!performanceSummary && (");
    expect(page).toContain("const hasCampaignBudget = campaignBudget > 0;");
    expect(page).toContain("const hasCampaignStartDate = Boolean(campaignStartDate && !Number.isNaN(campaignStartDate.getTime()));");
    expect(page).toContain("const hasCampaignEndDate = Boolean(campaignEndDate && !Number.isNaN(campaignEndDate.getTime()));");
    expect(page).toContain("const hasCampaignDateRange = Boolean(campaignStartDay && campaignEndDay && campaignEndDay.getTime() >= campaignStartDay.getTime());");
    expect(overview).toContain("const hasBudgetHealthInputs = hasCampaignBudget && overviewSpendMetric.available;");
    expect(page).toContain("const campaignElapsedDays = campaignStartDay && campaignElapsedEndDay.getTime() >= campaignStartDay.getTime()");
    expect(page).toContain("const campaignTotalDays = hasCampaignDateRange");
    expect(overview).toContain("const hasPacingHealthInputs = hasBudgetHealthInputs && hasCampaignDateRange && campaignElapsedDays > 0;");
    expect(overview).toContain("const budgetScore = hasBudgetHealthInputs ?");
    expect(overview).toContain("const pacingScore = hasPacingHealthInputs ?");
    expect(overview).toContain("status: hasBudgetHealthInputs ?");
    expect(overview).toContain("status: hasPacingHealthInputs ?");
    expect(overview).toContain("status: overviewRoiMetric.available ?");
    expect(overview).toContain("status: overviewRoasMetric.available ?");
    expect(overview).toContain("Campaign ROI");
    expect(overview).toContain("Campaign ROAS");
    expect(overview).toContain("const availableHealthMetricCount = [");
    expect(overview).toContain("const hasAnyHealthInputs = availableHealthMetricCount > 0;");
    expect(overview).toContain("const displayHealthScore = hasAnyHealthInputs ? Math.round((healthData.total / (availableHealthMetricCount * 25)) * 100) : null;");
    expect(overview).toContain('const healthRating = displayHealthScore === null ? "Unavailable"');
    expect(overview).toContain('{displayHealthScore ?? "Unavailable"}');
    expect(overview).toContain('`out of 100 (${availableHealthMetricCount}/4 inputs)`');
    expect(overview).toContain("const formatHealthStatus = (status: string) => status === 'unavailable' ? 'Unavailable' : status;");
    expect(overview).toContain("Campaign budget is required for budget health");
    expect(overview).toContain("Campaign budget is required for pacing");
    expect(overview).toContain("Budget period end is required for pacing");
    expect(overview).toContain("const hasPacingInputs = hasCampaignBudget && overviewSpendMetric.available && hasCampaignDateRange && campaignElapsedDays > 0;");
    expect(overview).toContain('{hasPacingInputs ? formatCurrency(targetDailySpend) : "Unavailable"}');
    expect(overview).toContain('{overviewSpendMetric.available && campaignElapsedDays > 0 ? formatCurrency(dailyBurnRate) : "Unavailable"}');
    expect(overview).toContain("const isOverBudget = hasCampaignBudget && overviewSpendMetric.available && overviewRemainingBudget < 0;");
    expect(page).toContain("const updatePacingInputsMutation = useMutation({");
    expect(page).toContain('apiRequest("PATCH", `/api/campaigns/${campaignId}`');
    expect(page).toContain('queryClient.setQueryData(["/api/campaigns", campaignId], updatedCampaign);');
    expect(page).toContain('queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`] });');
    expect(page).toContain("const handleDeletePacingInputs = () => {");
    expect(page).toContain("const handleCancelPacingInputs = () => {");
    expect(page).toContain("setIsEditingPacingInputs(false);");
    expect(page).toContain("const formatBudgetInputValue = (value?: string | number | null, padDecimals = false) => {");
    expect(page).toContain('if (padDecimals) return `${formattedInteger}.${decimalPart.slice(0, 2).padEnd(2, "0")}`;');
    expect(page).toContain('replace(/[^\\d.]/g, "")');
    expect(page).toContain("setPacingBudgetInput(formatBudgetInputValue(campaign.budget, true));");
    expect(overview).toContain("Requires campaign spend and budget period start");
    expect(overview).toContain('Based on {campaignElapsedDays} elapsed budget-period {campaignElapsedDays === 1 ? "day" : "days"}');
    expect(overview).toContain("Requires campaign budget and budget period dates");
    expect(overview).toContain("Requires campaign spend, budget, and budget period dates");
    expect(overview).toContain("const shouldShowPacingInputForm = isEditingPacingInputs || !hasCampaignBudget || !hasCampaignStartDate || !hasCampaignEndDate || !hasCampaignDateRange;");
    expect(overview).toContain('data-testid="input-pacing-budget"');
    expect(overview).toContain("onChange={(event) => setPacingBudgetInput(formatBudgetInputValue(event.target.value))}");
    expect(overview).toContain("onBlur={() => setPacingBudgetInput(formatBudgetInputValue(pacingBudgetInput, true))}");
    expect(overview).toContain('data-testid="input-pacing-start-date"');
    expect(overview).toContain('data-testid="input-pacing-end-date"');
    expect(overview).toContain("Save");
    expect(overview).toContain("Delete inputs");
    expect(overview).toContain("Edit inputs");
    expect(overview).toContain('aria-label="Cancel editing pacing inputs"');
    expect(overview).not.toContain("Save pacing inputs");
    expect(overview).not.toContain("Campaign start date is required to calculate daily burn rate and pacing.");
    expect(overview).not.toContain("Campaign end date is required to calculate target daily spend and pacing.");
    expect(overview).not.toContain("Set a campaign end date to enable Target Daily Spend and Pacing Status.");

    expect(overview).toContain("formatOverviewCurrency(overviewSpendMetric)");
    expect(overview).toContain("formatOverviewNumber(overviewConversionsMetric)");
    expect(overview).toContain("formatOverviewCurrency(overviewCpcMetric)");
    expect(overview).toContain("formatOverviewCurrency(overviewCpaMetric)");
    expect(overview).toContain("formatOverviewPercentage(overviewCvrMetric)");
    expect(overview).toContain("formatOverviewPercentage(overviewRoiMetric)");
    expect(overview).toContain("overviewRoasMetric.available ? `${overviewRoasMetric.value.toFixed(2)}x` : \"Unavailable\"");
    expect(overview).toContain("pacingStatus === 'unavailable' ? 'Unavailable'");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCpcMetric");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCpaMetric");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCvrMetric");
    expect(overview).not.toContain("{formatCurrency(cpc)}");
    expect(overview).not.toContain("{formatCurrency(cpa)}");
    expect(overview).not.toContain("{formatPercentage(conversionRate)}");
  });

  it("wires the ROI & ROAS tab to aggregate totals and source breakdowns", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const roiStart = page.indexOf('<TabsContent value="roi-roas"');
    const roiEnd = page.indexOf('<TabsContent value="costs"', roiStart);
    const roiTab = page.slice(roiStart, roiEnd);

    expect(page).toContain("const financialSpendMetric = overviewSpendMetric;");
    expect(page).toContain("const financialRevenueMetric = overviewRevenueMetric;");
    expect(page).toContain("const financialRoiMetric = overviewRoiMetric;");
    expect(page).toContain("const financialRoasMetric = overviewRoasMetric;");
    expect(page).toContain("const financialMainSources = performanceSources");
    expect(page).toContain("const useAggregateSourceTotals = financialMainSources.length === 1;");
    expect(page).toContain("const financialSourceBreakdowns: FinancialSourceBreakdown[] = financialMainSources");
    expect(page).toContain("const aggregateRevenueInputBreakdowns: FinancialChildSourceBreakdown[] = performanceSources");
    expect(page).toContain("const financialChildSourceBreakdowns: FinancialChildSourceBreakdown[] = financialRevenueInputs.length > 0");
    expect(page).toContain("const revenue = useAggregateSourceTotals && financialRevenueMetric.available ? financialRevenueMetric.value : sourceRevenue;");
    expect(page).toContain("const spend = useAggregateSourceTotals && financialSpendMetric.available ? financialSpendMetric.value : sourceSpend;");
    expect(page).toContain("const financialRevenueInputs = Array.isArray(outcomeTotals?.financialInputs?.revenue) ? outcomeTotals.financialInputs.revenue : [];");
    expect(page).toContain("const financialSpendInputs = Array.isArray(outcomeTotals?.financialInputs?.spend) ? outcomeTotals.financialInputs.spend : [];");

    expect(roiTab).toContain("financialRoasMetric.available ? `${financialRoasMetric.value.toFixed(2)}x` : \"Unavailable\"");
    expect(roiTab).toContain("formatOverviewCurrency(financialSpendMetric)");
    expect(roiTab).toContain("formatOverviewCurrency(financialRevenueMetric)");
    expect(roiTab).toContain("formatOverviewPercentage(financialRoiMetric)");
    expect(roiTab).toContain("performanceSummary && financialSourceBreakdowns.map");
    expect(roiTab).toContain("Financial Inputs");
    expect(roiTab).toContain('className="text-sm font-semibold">Revenue</h5>');
    expect(roiTab).toContain('className="text-sm font-semibold">Spend</h5>');
    expect(roiTab).toContain("are not separate main Connected Platforms");
    expect(roiTab).not.toContain("formatSourceType(source.sourceType)");
    expect(roiTab).not.toContain("{roas.toFixed(2)}x");
    expect(roiTab).not.toContain("{formatPercentage(roi)}");
    expect(roiTab).not.toContain("{formatCurrency(estimatedRevenue)}");
  });

  it("wires the Cost Analysis tab to aggregate metrics with unavailable states", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const costStart = page.indexOf('<TabsContent value="costs"');
    const costEnd = page.indexOf('<TabsContent value="budget"', costStart);
    const costTab = page.slice(costStart, costEnd);

    expect(costTab).toContain("formatOverviewCurrency(overviewCpcMetric)");
    expect(costTab).toContain("formatOverviewCurrency(overviewCpaMetric)");
    expect(costTab).toContain("formatOverviewCurrency(overviewCpmMetric)");
    expect(costTab).toContain("formatOverviewPercentage(overviewCtrMetric)");
    expect(costTab).toContain("formatOverviewPercentage(overviewCvrMetric)");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpcMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpaMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpmMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCtrMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCvrMetric");
    expect(page).toContain("const costAnalysisSourceLabels: string[] = Array.from(new Set<string>(");
    expect(costTab).toContain('<h4 className="font-semibold mb-2">Sources</h4>');
    expect(costTab).toContain("costAnalysisSourceLabels.map");
    expect(costTab).toContain("No connected source provides cost-analysis metrics yet.");
    expect(costTab).not.toContain("{formatCurrency(cpc)}");
    expect(costTab).not.toContain("clickThroughCPA");
    expect(costTab).not.toContain("clickThroughCVR");
    expect(costTab).not.toContain("totalImpressions > 0 ? formatCurrency");
  });

  it("wires the Budget Allocation tab to spend-capable aggregate sources", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const budgetStart = page.indexOf('<TabsContent value="budget"');
    const budgetEnd = page.indexOf('<TabsContent value="insights"', budgetStart);
    const budgetTab = page.slice(budgetStart, budgetEnd);

    expect(page).toContain("const budgetAllocationSources: FinancialSourceBreakdown[] = financialMainSources");
    expect(page).toContain('.filter((source: any) => sourceIncludesMetric(source, "spend"))');
    expect(budgetTab).toContain("const allocationSpend = budgetAllocationSources.reduce");
    expect(budgetTab).toContain("Imported spend labels inside GA4");
    expect(budgetTab).toContain("are not connected ad platforms");
    expect(budgetTab).toContain("Budget Allocation only shows sources after a spend-capable ad platform is connected in Connected Platforms.");
    expect(budgetTab).toContain("budgetAllocationSources.length === 0");
    expect(budgetTab).toContain("No spend-capable connected source is available for budget allocation yet.");
    expect(budgetTab).toContain("budgetAllocationSources.length === 1");
    expect(budgetTab).toContain("Budget reallocation recommendations require at least two spend-capable sources.");
    expect(budgetTab).toContain("budgetAllocationSources.length > 1");
    expect(budgetTab).toContain("Allocation Guidance");
    expect(budgetTab).not.toContain("platformMetrics.linkedIn.spend");
    expect(budgetTab).not.toContain("platformMetrics.meta.spend");
    expect(budgetTab).not.toContain("platformMetrics.customIntegration.spend");
    expect(budgetTab).not.toContain("const platforms = [");
  });

  it("wires the Insights tab to aggregate metrics and spend-capable sources", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const insightsStart = page.indexOf('<TabsContent value="insights"');
    const insightsTab = page.slice(insightsStart);

    expect(insightsTab).toContain("const platforms = budgetAllocationSources.map");
    expect(insightsTab).toContain("const platformsWithRoas = platformsWithSpend.filter");
    expect(insightsTab).toContain("financialRoasMetric.available && financialRoiMetric.available");
    expect(insightsTab).toContain("overviewCpaMetric.available");
    expect(insightsTab).toContain("overviewSpendMetric.available");
    expect(insightsTab).toContain("overviewCtrMetric.available");
    expect(insightsTab).toContain("overviewCvrMetric.available");
    expect(insightsTab).toContain("const isBudgetUnderutilized = overviewSpendMetric.available && overviewBudgetUtilization < 50;");
    expect(insightsTab).toContain("const hasBudgetCapacity = overviewSpendMetric.available && overviewBudgetUtilization > 85 && overviewBudgetUtilization <= 100;");
    expect(insightsTab).toContain("const financialPerformanceTone: InsightTone = !financialRoasMetric.available || !financialRoiMetric.available");
    expect(insightsTab).toContain("financialRoasMetric.value < 1 || financialRoiMetric.value < 0");
    expect(insightsTab).toContain("const topPerformerTone: InsightTone = !topPerformer");
    expect(insightsTab).toContain('const topPerformerLabel = hasMultiplePlatforms ? "Strongest Source" : "Source Performance";');
    expect(insightsTab).toContain("insightCardClass[financialPerformanceTone]");
    expect(insightsTab).toContain("insightCardClass[topPerformerTone]");
    expect(insightsTab).toContain("performance is not high enough to recommend scaling");
    expect(insightsTab).toContain("Budget is underutilized relative to the total campaign budget.");
    expect(insightsTab).toContain("Budget Underutilized");
    expect(insightsTab).toContain("Only {formatPercentage(overviewBudgetUtilization)} of budget is utilized");
    expect(insightsTab).toContain("bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800");
    expect(insightsTab).toContain("No spend-capable connected ad platform is available.");
    expect(insightsTab).not.toContain("platformMetrics.linkedIn.spend");
    expect(insightsTab).not.toContain("platformMetrics.meta.spend");
    expect(insightsTab).not.toContain("platformMetrics.customIntegration.spend");
    expect(insightsTab).not.toContain("const platforms = [");
    expect(insightsTab).not.toContain("formatCurrency(cpa)");
    expect(insightsTab).not.toContain("formatPercentage(conversionRate)");
    expect(insightsTab).not.toContain("formatPercentage(budgetUtilization)");
    expect(insightsTab).not.toContain("roas.toFixed(2)");
    expect(insightsTab).not.toContain("Scale High-Performing Campaigns");
    expect(insightsTab).not.toContain("With {financialRoasMetric.value.toFixed(2)}x ROAS");
  });
});

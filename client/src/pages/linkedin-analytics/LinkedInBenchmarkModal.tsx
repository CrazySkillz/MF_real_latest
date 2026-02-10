// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

/**
 * Split out from `pages/linkedin-analytics.tsx` to prevent single-file OOM.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */
export function LinkedInBenchmarkModal(props: any) {
  const {
    isBenchmarkModalOpen,
    setIsBenchmarkModalOpen,
    editingBenchmark,
    setEditingBenchmark,
    benchmarkForm,
    setBenchmarkForm,
    aggregated,
    openAddRevenueModal,
    toast,
    devLog,
    campaignCurrencySymbol,
    getCampaignSpecificMetrics,
    getBenchmarkModalCurrentValue,
    getBenchmarkUnitForMetric,
    getDefaultBenchmarkDescription,
    BENCHMARK_DESC_MAX,
    industries,
    isCurrencyLikeMetric,
    getBenchmarkValueFallback,
    formatMetricValueForInput,
    formatNumberAsYouType,
    getMaxDecimalsForMetric,
    DEFAULT_BENCHMARK_DESCRIPTION,
    handleCreateBenchmark,
    availableCampaigns,
    selectedCampaignDetails,
    campaignData,
    benchmarks,
    renderPerformanceBadge,
    formatCurrency,
    formatPercentage,
    formatNumber,
  } = props;

  return (
    <Dialog open={isBenchmarkModalOpen} onOpenChange={setIsBenchmarkModalOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingBenchmark ? "Edit Benchmark" : "Create New Benchmark"}</DialogTitle>
          <DialogDescription>
            {editingBenchmark
              ? "Update the benchmark details below. The current value can be auto-populated from your LinkedIn metrics data."
              : "Define a new benchmark for your LinkedIn campaigns. You can select metrics from the Overview tab as current values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Conversion Value Required Alert - Moved above Benchmark Name */}
          {!aggregated?.hasRevenueTracking && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Revenue Metrics Unavailable</h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                    To create benchmarks for ROI, ROAS, Total Revenue, Profit, Profit Margin, or Revenue Per Lead, you need to add
                    a conversion value to your campaign first.
                  </p>
                  <button
                    onClick={() => {
                      setIsBenchmarkModalOpen(false);
                      openAddRevenueModal("add");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Add revenue/conversion value
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="benchmark-name">Benchmark Name *</Label>
            <Input
              id="benchmark-name"
              placeholder="e.g., LinkedIn CTR Benchmark"
              value={benchmarkForm.name}
              onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
              data-testid="input-benchmark-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-metric">Metric Source</Label>
              <Select
                value={benchmarkForm.metric || undefined}
                onValueChange={(value) => {
                  // Check if revenue metric is selected but conversion value is not set
                  const revenueMetrics = ["roi", "roas", "totalRevenue", "profit", "profitMargin", "revenuePerLead"];
                  if (revenueMetrics.includes(value) && !aggregated?.hasRevenueTracking) {
                    toast({
                      title: "Conversion Value Required",
                      description:
                        "Revenue metrics require a conversion value. Please edit your campaign and add a conversion value to track ROI, ROAS, Revenue, and Profit.",
                      variant: "destructive",
                    });
                    return; // Don't select this metric
                  }

                  // Determine which metrics to use based on scope
                  let metricsSource = aggregated;

                  // If campaign-specific is selected and a LinkedIn campaign is chosen, use campaign-specific metrics
                  if (benchmarkForm.applyTo === "specific" && benchmarkForm.specificCampaignId) {
                    const campaignMetrics = getCampaignSpecificMetrics(benchmarkForm.specificCampaignId);
                    if (campaignMetrics) {
                      metricsSource = campaignMetrics;
                      devLog("[Metric Selection] Using campaign-specific metrics for:", benchmarkForm.specificCampaignId);
                    }
                  }

                  // Auto-populate current value from metrics
                  let currentValue = "";
                  let unit = "";
                  if (metricsSource) {
                    switch (value) {
                      case "impressions":
                        currentValue = String(metricsSource.impressions || metricsSource.totalImpressions || 0);
                        break;
                      case "reach":
                        currentValue = String(metricsSource.reach || metricsSource.totalReach || 0);
                        break;
                      case "clicks":
                        currentValue = String(metricsSource.clicks || metricsSource.totalClicks || 0);
                        break;
                      case "engagements":
                        currentValue = String(metricsSource.engagements || metricsSource.totalEngagements || 0);
                        break;
                      case "spend":
                        currentValue = String(metricsSource.spend || metricsSource.totalSpend || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "conversions":
                        currentValue = String(metricsSource.conversions || metricsSource.totalConversions || 0);
                        break;
                      case "leads":
                        currentValue = String(metricsSource.leads || metricsSource.totalLeads || 0);
                        break;
                      case "videoViews":
                        currentValue = String(metricsSource.videoViews || metricsSource.totalVideoViews || 0);
                        break;
                      case "viralImpressions":
                        currentValue = String(metricsSource.viralImpressions || metricsSource.totalViralImpressions || 0);
                        break;
                      case "ctr":
                        currentValue = String(metricsSource.ctr || 0);
                        unit = "%";
                        break;
                      case "cpc":
                        currentValue = String(metricsSource.cpc || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cpm":
                        currentValue = String(metricsSource.cpm || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cvr":
                        currentValue = String(metricsSource.cvr || 0);
                        unit = "%";
                        break;
                      case "cpa":
                        currentValue = String(metricsSource.cpa || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cpl":
                        currentValue = String(metricsSource.cpl || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "er":
                        currentValue = String(metricsSource.er || 0);
                        unit = "%";
                        break;
                      case "roi":
                        currentValue = String(metricsSource.roi || 0);
                        unit = "%";
                        break;
                      case "roas":
                        currentValue = String(metricsSource.roas || 0);
                        unit = "×";
                        break;
                      case "totalRevenue":
                        currentValue = String(metricsSource.totalRevenue || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "profit":
                        currentValue = String(metricsSource.profit || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "profitMargin":
                        currentValue = String(metricsSource.profitMargin || 0);
                        unit = "%";
                        break;
                      case "revenuePerLead":
                        currentValue = String(metricsSource.revenuePerLead || 0);
                        unit = campaignCurrencySymbol;
                        break;
                    }
                  }
                  devLog("[Metric Selection] Auto-filled currentValue:", currentValue, unit);

                  // Update form with metric, currentValue, and unit (format for correct decimals/integers)
                  const prevDefaultDesc = getDefaultBenchmarkDescription(benchmarkForm.metric);
                  const nextDefaultDesc = getDefaultBenchmarkDescription(value);
                  const shouldAutoUpdateDesc =
                    !String(benchmarkForm.description || "").trim() || String(benchmarkForm.description || "") === prevDefaultDesc;

                  const updatedForm = {
                    ...benchmarkForm,
                    metric: value,
                    currentValue: formatMetricValueForInput(value, currentValue),
                    unit: String(value || "").toLowerCase() === "roas" ? "×" : unit,
                    description: shouldAutoUpdateDesc ? nextDefaultDesc : benchmarkForm.description,
                  };
                  setBenchmarkForm(updatedForm);

                  // If industry is already selected, also auto-fill benchmark value
                  if (benchmarkForm.industry && benchmarkForm.industry !== "none" && benchmarkForm.industry !== "other") {
                    devLog("[Metric Selection] Industry already selected, fetching benchmark value...");
                    (async () => {
                      try {
                        const response = await fetch(`/api/industry-benchmarks/${benchmarkForm.industry}/${value}`);
                        if (response.ok) {
                          const data = await response.json();
                          devLog("[Metric Selection] Benchmark data from API:", data);
                          setBenchmarkForm((prev: any) => ({
                            ...prev,
                            benchmarkValue: formatNumberAsYouType(String(data.value), { maxDecimals: getMaxDecimalsForMetric(value) }),
                            unit:
                              String(value || "").toLowerCase() === "roas"
                                ? "×"
                                : isCurrencyLikeMetric(value)
                                  ? campaignCurrencySymbol
                                  : data.unit || prev.unit,
                          }));
                        } else {
                          // Fallback to hardcoded values
                          const fallbackData = getBenchmarkValueFallback(benchmarkForm.industry, value);
                          if (fallbackData) {
                            devLog("[Metric Selection] Using fallback benchmark data:", fallbackData);
                            setBenchmarkForm((prev: any) => ({
                              ...prev,
                              benchmarkValue: formatNumberAsYouType(String(fallbackData.value), { maxDecimals: getMaxDecimalsForMetric(value) }),
                              unit:
                                String(value || "").toLowerCase() === "roas"
                                  ? "×"
                                  : isCurrencyLikeMetric(value)
                                    ? campaignCurrencySymbol
                                    : fallbackData.unit || prev.unit,
                            }));
                          }
                        }
                      } catch (error) {
                        console.error("[Metric Selection] Failed to fetch benchmark value:", error);
                        const fallbackData = getBenchmarkValueFallback(benchmarkForm.industry, value);
                        if (fallbackData) {
                          devLog("[Metric Selection] Using fallback benchmark data after error:", fallbackData);
                          setBenchmarkForm((prev: any) => ({
                            ...prev,
                            benchmarkValue: formatNumberAsYouType(String(fallbackData.value), { maxDecimals: getMaxDecimalsForMetric(value) }),
                            unit:
                              String(value || "").toLowerCase() === "roas"
                                ? "×"
                                : isCurrencyLikeMetric(value)
                                  ? campaignCurrencySymbol
                                  : fallbackData.unit || prev.unit,
                          }));
                        }
                      }
                    })();
                  }
                }}
              >
                <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                  <SelectValue placeholder="Select metric to benchmark" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Impressions</SelectItem>
                  <SelectItem value="reach">Reach</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="engagements">Engagements</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="videoViews">Video Views</SelectItem>
                  <SelectItem value="viralImpressions">Viral Impressions</SelectItem>
                  <SelectItem value="ctr">Click-Through Rate (CTR)</SelectItem>
                  <SelectItem value="cpc">Cost Per Click (CPC)</SelectItem>
                  <SelectItem value="cpm">Cost Per Mille (CPM)</SelectItem>
                  <SelectItem value="cvr">Conversion Rate (CVR)</SelectItem>
                  <SelectItem value="cpa">Cost Per Acquisition (CPA)</SelectItem>
                  <SelectItem value="cpl">Cost Per Lead (CPL)</SelectItem>
                  <SelectItem value="er">Engagement Rate (ER)</SelectItem>
                  <SelectItem value="roi" disabled={!aggregated?.hasRevenueTracking}>
                    Return on Investment (ROI) {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="roas" disabled={!aggregated?.hasRevenueTracking}>
                    Return on Ad Spend (ROAS) {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="totalRevenue" disabled={!aggregated?.hasRevenueTracking}>
                    Total Revenue {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="profit" disabled={!aggregated?.hasRevenueTracking}>
                    Profit {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="profitMargin" disabled={!aggregated?.hasRevenueTracking}>
                    Profit Margin {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="revenuePerLead" disabled={!aggregated?.hasRevenueTracking}>
                    Revenue Per Lead {!aggregated?.hasRevenueTracking && "(Requires Conversion Value)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark-description">Description</Label>
            <Textarea
              id="benchmark-description"
              placeholder="Describe this benchmark and why it's important"
              value={benchmarkForm.description}
              maxLength={BENCHMARK_DESC_MAX}
              onChange={(e) =>
                setBenchmarkForm({ ...benchmarkForm, description: e.target.value.slice(0, BENCHMARK_DESC_MAX) })
              }
              rows={3}
              data-testid="input-benchmark-description"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
              {benchmarkForm.description.length}/{BENCHMARK_DESC_MAX}
            </div>
          </div>

          {/* Apply To Section - Only show if multiple campaigns */}
          {availableCampaigns.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="benchmark-apply-to" className="text-base font-semibold">
                Apply Benchmark To
              </Label>
              <Select
                value={benchmarkForm.applyTo}
                onValueChange={(value) => {
                  const nextApplyTo = value as "all" | "specific";
                  // When switching scope, recompute Current Value from the same source-of-truth used elsewhere.
                  if (!benchmarkForm.metric) {
                    setBenchmarkForm({
                      ...benchmarkForm,
                      applyTo: nextApplyTo,
                      specificCampaignId: nextApplyTo === "all" ? "" : "",
                      // Clear currentValue when switching to specific until a campaign is selected.
                      currentValue: nextApplyTo === "specific" ? "" : benchmarkForm.currentValue,
                    });
                    return;
                  }

                  if (nextApplyTo === "all") {
                    const next = getBenchmarkModalCurrentValue(benchmarkForm.metric, "all");
                    setBenchmarkForm({
                      ...benchmarkForm,
                      applyTo: "all",
                      specificCampaignId: "",
                      currentValue: next.currentValue,
                      unit: next.unit,
                    });
                    return;
                  }

                  // specific
                  setBenchmarkForm({
                    ...benchmarkForm,
                    applyTo: "specific",
                    specificCampaignId: "",
                    currentValue: "",
                    unit: getBenchmarkUnitForMetric(benchmarkForm.metric),
                  });
                }}
              >
                <SelectTrigger id="benchmark-apply-to" data-testid="select-benchmark-apply-to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns (Aggregate)</SelectItem>
                  <SelectItem value="specific">Specific Campaign</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose whether this benchmark applies to all campaigns combined or a specific individual campaign
              </p>
            </div>
          )}

          {/* Campaign Selector - Only show if 'specific' is selected */}
          {benchmarkForm.applyTo === "specific" && (
            <div className="space-y-2">
              <Label htmlFor="benchmark-campaign">Select Campaign *</Label>
              <Select
                value={benchmarkForm.specificCampaignId}
                onValueChange={(value) => {
                  devLog("[Dropdown] Selected campaign:", value);

                  if (!benchmarkForm.metric) {
                    setBenchmarkForm({ ...benchmarkForm, specificCampaignId: value });
                    return;
                  }

                  const next = getBenchmarkModalCurrentValue(benchmarkForm.metric, "specific", value);
                  setBenchmarkForm({
                    ...benchmarkForm,
                    specificCampaignId: value,
                    currentValue: next.currentValue,
                    unit: next.unit,
                  });
                }}
              >
                <SelectTrigger id="benchmark-campaign" data-testid="select-benchmark-campaign">
                  <SelectValue placeholder="Choose a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaigns.length > 0 ? (
                    availableCampaigns.map((campaign: any) => (
                      <SelectItem key={campaign.name} value={campaign.linkedInCampaignName || campaign.name}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-campaigns" disabled>
                      No campaigns available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select the specific LinkedIn campaign this benchmark applies to
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-current">Current Value</Label>
              <Input
                id="benchmark-current"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={benchmarkForm.currentValue}
                onChange={(e) => {
                  const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) });
                  setBenchmarkForm({ ...benchmarkForm, currentValue: formatted });
                }}
                data-testid="input-benchmark-current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark-value">Benchmark Value *</Label>
              <Input
                id="benchmark-value"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={benchmarkForm.benchmarkValue}
                onChange={(e) => {
                  const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) });
                  setBenchmarkForm({ ...benchmarkForm, benchmarkValue: formatted });
                }}
                data-testid="input-benchmark-value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark-unit">Unit</Label>
              <Input
                id="benchmark-unit"
                placeholder="%, $, etc."
                value={benchmarkForm.unit}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, unit: e.target.value })}
                data-testid="input-benchmark-unit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark-type">Benchmark Type</Label>
            <Select
              value={benchmarkForm.benchmarkType || "custom"}
              onValueChange={(value) => {
                setBenchmarkForm({
                  ...benchmarkForm,
                  benchmarkType: value,
                  // Clear industry and benchmark value when switching types
                  industry: value === "custom" ? "" : benchmarkForm.industry,
                  // If switching to Industry Standard, clear any custom value so we don't accidentally save it
                  // as an "industry" benchmark before the auto-fill runs.
                  benchmarkValue: value === "custom" ? "" : "",
                });
              }}
            >
              <SelectTrigger id="benchmark-type" data-testid="select-benchmark-type">
                <SelectValue placeholder="Select benchmark type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="industry">Industry Standard</SelectItem>
                <SelectItem value="custom">Custom Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Industry Selection - Only shown when "Industry Standard" is selected */}
          {benchmarkForm.benchmarkType === "industry" && (
            <div className="space-y-2">
              <Label htmlFor="benchmark-industry">Select Industry</Label>
              <Select
                value={benchmarkForm.industry}
                onValueChange={async (value) => {
                  // Update industry
                  setBenchmarkForm({ ...benchmarkForm, industry: value });

                  // Auto-fill benchmark value if metric is selected
                  if (value && benchmarkForm.metric) {
                    try {
                      // Try API first
                      const response = await fetch(`/api/industry-benchmarks/${value}/${benchmarkForm.metric}`);
                      if (response.ok) {
                        const data = await response.json();
                        setBenchmarkForm((prev: any) => ({
                          ...prev,
                          benchmarkValue: formatNumberAsYouType(String(data.value), { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) }),
                          unit:
                            String(benchmarkForm.metric || "").toLowerCase() === "roas"
                              ? ""
                              : isCurrencyLikeMetric(benchmarkForm.metric)
                                ? campaignCurrencySymbol
                                : data.unit,
                        }));
                      } else {
                        // Fallback to hardcoded values
                        const fallbackData = getBenchmarkValueFallback(value, benchmarkForm.metric);
                        if (fallbackData) {
                          setBenchmarkForm((prev: any) => ({
                            ...prev,
                            benchmarkValue: formatNumberAsYouType(String(fallbackData.value), { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) }),
                            unit:
                              String(benchmarkForm.metric || "").toLowerCase() === "roas"
                                ? ""
                                : isCurrencyLikeMetric(benchmarkForm.metric)
                                  ? campaignCurrencySymbol
                                  : fallbackData.unit,
                          }));
                        }
                      }
                    } catch (error) {
                      console.error("Failed to fetch benchmark value, using fallback:", error);
                      // Use fallback on error
                      const fallbackData = getBenchmarkValueFallback(value, benchmarkForm.metric);
                      if (fallbackData) {
                        setBenchmarkForm((prev: any) => ({
                          ...prev,
                          benchmarkValue: formatNumberAsYouType(String(fallbackData.value), { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) }),
                          unit:
                            String(benchmarkForm.metric || "").toLowerCase() === "roas"
                              ? ""
                              : isCurrencyLikeMetric(benchmarkForm.metric)
                                ? campaignCurrencySymbol
                                : fallbackData.unit,
                        }));
                      }
                    }
                  }
                }}
              >
                <SelectTrigger id="benchmark-industry" data-testid="select-benchmark-industry">
                  <SelectValue placeholder="Choose an industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry: any) => (
                    <SelectItem key={industry.value} value={industry.value}>
                      {industry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">💡 Benchmark value will be auto-filled based on industry standards</p>
            </div>
          )}

          {/* Email Alerts Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="benchmark-alerts-enabled"
                checked={benchmarkForm.alertsEnabled}
                onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, alertsEnabled: checked as boolean })}
                data-testid="checkbox-benchmark-alerts"
              />
              <Label htmlFor="benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                Enable alerts for this Benchmark
              </Label>
            </div>

            {benchmarkForm.alertsEnabled && (
              <div className="space-y-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="benchmark-alert-threshold">Alert Threshold *</Label>
                    <Input
                      id="benchmark-alert-threshold"
                      type="text"
                      placeholder="e.g., 80"
                      inputMode="decimal"
                      value={benchmarkForm.alertThreshold}
                      onChange={(e) => {
                        const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(benchmarkForm.metric) });
                        setBenchmarkForm({ ...benchmarkForm, alertThreshold: formatted });
                      }}
                      data-testid="input-benchmark-alert-threshold"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Value at which to trigger the alert</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="benchmark-alert-condition">Alert When</Label>
                    <Select value={benchmarkForm.alertCondition} onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, alertCondition: value })}>
                      <SelectTrigger id="benchmark-alert-condition" data-testid="select-benchmark-alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Value Goes Below</SelectItem>
                        <SelectItem value="above">Value Goes Above</SelectItem>
                        <SelectItem value="equals">Value Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="benchmark-alert-frequency">Alert Frequency</Label>
                    <Select
                      value={benchmarkForm.alertFrequency || "daily"}
                      onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, alertFrequency: value })}
                    >
                      <SelectTrigger id="benchmark-alert-frequency" data-testid="select-benchmark-alert-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Controls how often you’re notified while the alert condition stays true.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id="benchmark-email-notifications"
                        checked={!!benchmarkForm.emailNotifications}
                        onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, emailNotifications: checked as boolean })}
                        data-testid="checkbox-benchmark-email-notifications"
                      />
                      <Label htmlFor="benchmark-email-notifications" className="cursor-pointer font-medium">
                        Send email notifications
                      </Label>
                    </div>
                    {benchmarkForm.emailNotifications && (
                      <div className="space-y-2">
                        <Label htmlFor="benchmark-email-recipients">Email addresses *</Label>
                        <Input
                          id="benchmark-email-recipients"
                          type="text"
                          placeholder="email1@example.com, email2@example.com"
                          value={benchmarkForm.emailRecipients}
                          onChange={(e) => setBenchmarkForm({ ...benchmarkForm, emailRecipients: e.target.value })}
                          data-testid="input-benchmark-email-recipients"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Comma-separated email addresses for alerts.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsBenchmarkModalOpen(false);
                setEditingBenchmark(null);
                setBenchmarkForm({
                  metric: "",
                  name: "",
                  unit: "",
                  benchmarkValue: "",
                  currentValue: "",
                  benchmarkType: "custom",
                  industry: "",
                  description: DEFAULT_BENCHMARK_DESCRIPTION,
                  applyTo: "all",
                  specificCampaignId: "",
                  alertsEnabled: false,
                  emailNotifications: false,
                  alertFrequency: "daily",
                  alertThreshold: "",
                  alertCondition: "below",
                  emailRecipients: "",
                });
              }}
              data-testid="button-benchmark-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBenchmark}
              disabled={!benchmarkForm.name || !benchmarkForm.benchmarkValue}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-benchmark-submit"
            >
              {editingBenchmark ? "Update Benchmark" : "Create Benchmark"}
            </Button>
          </div>

          {/* Performance Indicators - shown in Campaign Details Modal context only */}
          {campaignData?.industry && selectedCampaignDetails && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Performance Analysis</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {(() => {
                  // This section uses selectedCampaignDetails, not linkedInCampaign
                  const campaignName = selectedCampaignDetails.name;

                  const impressions = selectedCampaignDetails.metrics.impressions || 0;
                  const clicks = selectedCampaignDetails.metrics.clicks || 0;
                  const spend = selectedCampaignDetails.metrics.spend || 0;
                  const conversions = selectedCampaignDetails.metrics.conversions || 0;
                  const engagements = selectedCampaignDetails.metrics.engagements || 0;

                  const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

                  return (
                    <>
                      {/* ER (Engagement Rate) Badge */}
                      {Array.isArray(benchmarks) &&
                        (() => {
                          const erBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "er" && b.linkedInCampaignName === campaignName
                          );
                          if (erBenchmark) {
                            return renderPerformanceBadge("er", engagementRate, "higher-better");
                          }
                          return null;
                        })()}

                      {/* ROI Badge */}
                      {Array.isArray(benchmarks) &&
                        aggregated?.hasRevenueTracking === 1 &&
                        (() => {
                          const roiBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "roi" && b.linkedInCampaignName === campaignName
                          );
                          if (roiBenchmark) {
                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                            const campaignROI = spend > 0 ? ((campaignRevenue - spend) / spend) * 100 : 0;
                            return renderPerformanceBadge("roi", campaignROI, "higher-better");
                          }
                          return null;
                        })()}

                      {/* ROAS Badge */}
                      {Array.isArray(benchmarks) &&
                        aggregated?.hasRevenueTracking === 1 &&
                        (() => {
                          const roasBenchmark = benchmarks.find(
                            (b: any) => b.metric?.toLowerCase() === "roas" && b.linkedInCampaignName === campaignName
                          );
                          if (roasBenchmark) {
                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                            const campaignROAS = spend > 0 ? campaignRevenue / spend : 0;
                            return renderPerformanceBadge("roas", campaignROAS, "higher-better");
                          }
                          return null;
                        })()}

                      {/* CVR summary */}
                      {renderPerformanceBadge("cvr", convRate, "higher-better")}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const BENCHMARK_DESC_MAX = 500;

/* ------------------------------------------------------------------ */
/*  Google Ads industry benchmark fallback values                      */
/*  Google Ads typically has higher CTRs and CPCs than Meta/Facebook   */
/* ------------------------------------------------------------------ */
const GOOGLE_ADS_INDUSTRY_BENCHMARKS: Record<string, Record<string, { value: number; unit: string }>> = {
  ecommerce: {
    ctr: { value: 2.69, unit: "%" },
    cpc: { value: 1.16, unit: "$" },
    cpm: { value: 31.22, unit: "$" },
    conversionRate: { value: 2.81, unit: "%" },
    costPerConversion: { value: 45.27, unit: "$" },
  },
  saas: {
    ctr: { value: 2.14, unit: "%" },
    cpc: { value: 2.62, unit: "$" },
    cpm: { value: 56.07, unit: "$" },
    conversionRate: { value: 2.35, unit: "%" },
    costPerConversion: { value: 68.94, unit: "$" },
  },
  technology: {
    ctr: { value: 2.09, unit: "%" },
    cpc: { value: 3.80, unit: "$" },
    cpm: { value: 79.42, unit: "$" },
    conversionRate: { value: 2.92, unit: "%" },
    costPerConversion: { value: 56.11, unit: "$" },
  },
  healthcare: {
    ctr: { value: 3.27, unit: "%" },
    cpc: { value: 2.62, unit: "$" },
    cpm: { value: 85.67, unit: "$" },
    conversionRate: { value: 3.36, unit: "%" },
    costPerConversion: { value: 78.09, unit: "$" },
  },
  finance: {
    ctr: { value: 2.91, unit: "%" },
    cpc: { value: 3.44, unit: "$" },
    cpm: { value: 100.11, unit: "$" },
    conversionRate: { value: 5.10, unit: "%" },
    costPerConversion: { value: 81.93, unit: "$" },
  },
  education: {
    ctr: { value: 3.78, unit: "%" },
    cpc: { value: 2.40, unit: "$" },
    cpm: { value: 90.72, unit: "$" },
    conversionRate: { value: 3.39, unit: "%" },
    costPerConversion: { value: 72.70, unit: "$" },
  },
  real_estate: {
    ctr: { value: 3.71, unit: "%" },
    cpc: { value: 2.37, unit: "$" },
    cpm: { value: 87.93, unit: "$" },
    conversionRate: { value: 2.47, unit: "%" },
    costPerConversion: { value: 116.61, unit: "$" },
  },
  travel: {
    ctr: { value: 4.68, unit: "%" },
    cpc: { value: 1.53, unit: "$" },
    cpm: { value: 71.60, unit: "$" },
    conversionRate: { value: 3.55, unit: "%" },
    costPerConversion: { value: 44.73, unit: "$" },
  },
  retail: {
    ctr: { value: 2.81, unit: "%" },
    cpc: { value: 1.35, unit: "$" },
    cpm: { value: 37.94, unit: "$" },
    conversionRate: { value: 3.11, unit: "%" },
    costPerConversion: { value: 38.87, unit: "$" },
  },
  media: {
    ctr: { value: 3.85, unit: "%" },
    cpc: { value: 1.12, unit: "$" },
    cpm: { value: 43.12, unit: "$" },
    conversionRate: { value: 2.82, unit: "%" },
    costPerConversion: { value: 52.68, unit: "$" },
  },
  automotive: {
    ctr: { value: 4.00, unit: "%" },
    cpc: { value: 2.46, unit: "$" },
    cpm: { value: 98.40, unit: "$" },
    conversionRate: { value: 6.03, unit: "%" },
    costPerConversion: { value: 33.52, unit: "$" },
  },
  food_beverage: {
    ctr: { value: 3.54, unit: "%" },
    cpc: { value: 1.08, unit: "$" },
    cpm: { value: 38.23, unit: "$" },
    conversionRate: { value: 3.72, unit: "%" },
    costPerConversion: { value: 29.02, unit: "$" },
  },
  fitness: {
    ctr: { value: 3.19, unit: "%" },
    cpc: { value: 1.75, unit: "$" },
    cpm: { value: 55.83, unit: "$" },
    conversionRate: { value: 3.44, unit: "%" },
    costPerConversion: { value: 50.91, unit: "$" },
  },
  legal: {
    ctr: { value: 2.93, unit: "%" },
    cpc: { value: 6.75, unit: "$" },
    cpm: { value: 197.78, unit: "$" },
    conversionRate: { value: 6.98, unit: "%" },
    costPerConversion: { value: 86.02, unit: "$" },
  },
  other: {},
};

const INDUSTRIES = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "real_estate", label: "Real Estate" },
  { value: "travel", label: "Travel" },
  { value: "retail", label: "Retail" },
  { value: "media", label: "Media & Entertainment" },
  { value: "automotive", label: "Automotive" },
  { value: "food_beverage", label: "Food & Beverage" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "legal", label: "Legal Services" },
  { value: "other", label: "Other" },
];

/* ------------------------------------------------------------------ */
/*  Helper utilities (self-contained so the modal has zero coupling)    */
/* ------------------------------------------------------------------ */

/** Metrics that represent currency amounts. */
const CURRENCY_METRICS = new Set(["spend", "cpc", "cpm", "costPerConversion"]);

/** Metrics that are expressed as percentages. */
const PERCENTAGE_METRICS = new Set(["ctr", "conversionRate", "searchImpressionShare"]);

function isCurrencyLikeMetric(metric: string): boolean {
  return CURRENCY_METRICS.has(metric);
}

function getMetricUnit(metric: string, currencySymbol = "$"): string {
  if (CURRENCY_METRICS.has(metric)) return currencySymbol;
  if (PERCENTAGE_METRICS.has(metric)) return "%";
  return "";
}

function getMaxDecimalsForMetric(metric: string): number {
  if (PERCENTAGE_METRICS.has(metric)) return 2;
  if (CURRENCY_METRICS.has(metric)) return 2;
  return 0; // counts like impressions, clicks, etc.
}

/** Format a number string while the user types, respecting max decimals. */
function formatNumberAsYouType(raw: string, opts?: { maxDecimals?: number }): string {
  const maxDec = opts?.maxDecimals ?? 2;
  // Strip everything except digits, dots, and leading minus
  let cleaned = raw.replace(/[^0-9.\-]/g, "");
  // Only allow one dot
  const parts = cleaned.split(".");
  if (parts.length > 2) cleaned = parts[0] + "." + parts.slice(1).join("");
  // Limit decimals
  if (cleaned.includes(".")) {
    const [intPart, decPart] = cleaned.split(".");
    cleaned = intPart + "." + (decPart || "").slice(0, maxDec);
  }
  return cleaned;
}

function formatMetricValueForInput(metric: string, raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return "";
  const maxDec = getMaxDecimalsForMetric(metric);
  return maxDec === 0 ? String(Math.round(num)) : num.toFixed(maxDec);
}

function getDefaultBenchmarkDescription(metric: string): string {
  const descriptions: Record<string, string> = {
    impressions: "Track total impressions delivered by your Google Ads campaigns against the target benchmark.",
    clicks: "Measure click volume from Google Ads to gauge audience interest and keyword relevance.",
    conversions: "Track conversion events to evaluate how effectively Google Ads drive desired actions.",
    spend: "Monitor Google Ads spend to ensure budget is being utilised efficiently.",
    videoViews: "Measure video view volume to assess video content engagement on Google Ads (YouTube).",
    ctr: "Compare click-through rate against the benchmark to assess ad copy and keyword effectiveness on Google Ads.",
    cpc: "Track cost per click to optimise Google Ads bidding strategy and budget allocation.",
    cpm: "Monitor cost per thousand impressions to evaluate delivery efficiency on the Google Display Network.",
    conversionRate: "Evaluate the percentage of clicks that result in conversions from Google Ads campaigns.",
    costPerConversion: "Track cost per conversion to ensure profitable Google Ads campaign performance.",
    searchImpressionShare: "Monitor search impression share to understand your visibility in Google search auctions.",
    conversionValue: "Track the total value of conversions generated by your Google Ads campaigns.",
  };
  return descriptions[metric] || "";
}

function getBenchmarkValueFallback(industry: string, metric: string): { value: number; unit: string } | null {
  return GOOGLE_ADS_INDUSTRY_BENCHMARKS[industry]?.[metric] ?? null;
}

const DEFAULT_BENCHMARK_DESCRIPTION = "";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Google Ads benchmark creation/editing modal.
 * Adapted from MetaBenchmarkModal for Google Ads specific metrics and benchmarks.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */
export function GoogleAdsBenchmarkModal(props: any) {
  const {
    isBenchmarkModalOpen,
    setIsBenchmarkModalOpen,
    editingBenchmark,
    setEditingBenchmark,
    benchmarkForm,
    setBenchmarkForm,
    summary,
    toast,
    handleCreateBenchmark,
  } = props;

  /* ----- Auto-populate current value from summary when a metric is selected ----- */
  const autoPopulateCurrentValue = (metric: string): { currentValue: string; unit: string } => {
    if (!summary) return { currentValue: "", unit: "" };
    let currentValue = "";
    let unit = "";
    switch (metric) {
      case "impressions":
        currentValue = String(summary.impressions || 0);
        break;
      case "clicks":
        currentValue = String(summary.clicks || 0);
        break;
      case "conversions":
        currentValue = String(summary.conversions || 0);
        break;
      case "spend":
        currentValue = String(summary.spend || 0);
        unit = "$";
        break;
      case "conversionValue":
        currentValue = String(summary.conversionValue || 0);
        unit = "$";
        break;
      case "videoViews":
        currentValue = String(summary.videoViews || 0);
        break;
      case "ctr":
        currentValue = String(summary.ctr || 0);
        unit = "%";
        break;
      case "cpc":
        currentValue = String(summary.cpc || 0);
        unit = "$";
        break;
      case "cpm":
        currentValue = String(summary.cpm || 0);
        unit = "$";
        break;
      case "conversionRate":
        currentValue = String(summary.convRate || 0);
        unit = "%";
        break;
      case "costPerConversion":
        currentValue = String(summary.costPerConv || 0);
        unit = "$";
        break;
      case "searchImpressionShare":
        currentValue = "";
        unit = "%";
        break;
    }
    return { currentValue, unit };
  };

  /* ----- Industry benchmark fetch with fallback ----- */
  const fetchIndustryBenchmark = async (industry: string, metric: string) => {
    try {
      const response = await fetch(`/api/industry-benchmarks/google-ads/${industry}/${metric}`);
      if (response.ok) {
        const data = await response.json();
        setBenchmarkForm((prev: any) => ({
          ...prev,
          benchmarkValue: formatNumberAsYouType(String(data.value), { maxDecimals: getMaxDecimalsForMetric(metric) }),
          unit: isCurrencyLikeMetric(metric) ? "$" : data.unit || prev.unit,
        }));
        return;
      }
    } catch (error) {
      console.error("[GoogleAdsBenchmarkModal] Failed to fetch industry benchmark:", error);
    }
    // Fallback to hardcoded values
    const fallback = getBenchmarkValueFallback(industry, metric);
    if (fallback) {
      setBenchmarkForm((prev: any) => ({
        ...prev,
        benchmarkValue: formatNumberAsYouType(String(fallback.value), { maxDecimals: getMaxDecimalsForMetric(metric) }),
        unit: isCurrencyLikeMetric(metric) ? "$" : fallback.unit || prev.unit,
      }));
    }
  };

  return (
    <Dialog open={isBenchmarkModalOpen} onOpenChange={setIsBenchmarkModalOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingBenchmark ? "Edit Benchmark" : "Create New Benchmark"}</DialogTitle>
          <DialogDescription>
            {editingBenchmark
              ? "Update the benchmark details below. The current value can be auto-populated from your Google Ads analytics data."
              : "Define a new benchmark for your Google Ads campaigns. You can select metrics from the Overview tab as current values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Benchmark Name */}
          <div className="space-y-2">
            <Label htmlFor="benchmark-name">Benchmark Name *</Label>
            <Input
              id="benchmark-name"
              placeholder="e.g., Google Ads CTR Benchmark"
              value={benchmarkForm.name}
              onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
              data-testid="input-benchmark-name"
            />
          </div>

          {/* Metric Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-metric">Metric Source</Label>
              <Select
                value={benchmarkForm.metric || undefined}
                onValueChange={(value) => {
                  const autoFill = autoPopulateCurrentValue(value);

                  // Auto-update description if it was default or empty
                  const prevDefaultDesc = getDefaultBenchmarkDescription(benchmarkForm.metric);
                  const nextDefaultDesc = getDefaultBenchmarkDescription(value);
                  const shouldAutoUpdateDesc =
                    !String(benchmarkForm.description || "").trim() || String(benchmarkForm.description || "") === prevDefaultDesc;

                  const updatedForm = {
                    ...benchmarkForm,
                    metric: value,
                    currentValue: formatMetricValueForInput(value, autoFill.currentValue),
                    unit: autoFill.unit || getMetricUnit(value),
                    description: shouldAutoUpdateDesc ? nextDefaultDesc : benchmarkForm.description,
                  };
                  setBenchmarkForm(updatedForm);

                  // If industry is already selected, also auto-fill benchmark value
                  if (benchmarkForm.benchmarkType === "industry" && benchmarkForm.industry && benchmarkForm.industry !== "none" && benchmarkForm.industry !== "other") {
                    fetchIndustryBenchmark(benchmarkForm.industry, value);
                  }
                }}
              >
                <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                  <SelectValue placeholder="Select metric to benchmark" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Impressions</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="videoViews">Video Views</SelectItem>
                  <SelectItem value="ctr">Click-Through Rate (CTR)</SelectItem>
                  <SelectItem value="cpc">Cost Per Click (CPC)</SelectItem>
                  <SelectItem value="cpm">Cost Per Mille (CPM)</SelectItem>
                  <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                  <SelectItem value="costPerConversion">Cost Per Conversion</SelectItem>
                  <SelectItem value="searchImpressionShare">Search Impression Share</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
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

          {/* Current Value / Benchmark Value / Unit */}
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

          {/* Benchmark Type */}
          <div className="space-y-2">
            <Label htmlFor="benchmark-type">Benchmark Type</Label>
            <Select
              value={benchmarkForm.benchmarkType || "custom"}
              onValueChange={(value) => {
                setBenchmarkForm({
                  ...benchmarkForm,
                  benchmarkType: value,
                  industry: value === "custom" ? "" : benchmarkForm.industry,
                  benchmarkValue: "",
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
                  setBenchmarkForm({ ...benchmarkForm, industry: value });

                  // Auto-fill benchmark value if metric is selected
                  if (value && benchmarkForm.metric) {
                    await fetchIndustryBenchmark(value, benchmarkForm.metric);
                  }
                }}
              >
                <SelectTrigger id="benchmark-industry" data-testid="select-benchmark-industry">
                  <SelectValue placeholder="Choose an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry.value} value={industry.value}>
                      {industry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">Benchmark value will be auto-filled based on Google Ads industry standards</p>
            </div>
          )}

          {/* Alert Settings Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
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
              <p className="text-sm text-slate-600 dark:text-slate-400 pl-6">
                Receive notifications for Benchmark performance alerts on the bell icon &amp; in your Notifications center
              </p>
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
                      Controls how often you're notified while the alert condition stays true.
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

          {/* Action Buttons */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const BENCHMARK_DESC_MAX = 500;

/* ------------------------------------------------------------------ */
/*  Meta / Facebook Ads industry benchmark fallback values             */
/* ------------------------------------------------------------------ */
const META_INDUSTRY_BENCHMARKS: Record<string, Record<string, { value: number; unit: string }>> = {
  ecommerce: {
    ctr: { value: 1.24, unit: "%" },
    cpc: { value: 0.86, unit: "$" },
    cpm: { value: 11.54, unit: "$" },
    cpp: { value: 18.42, unit: "$" },
    conversionRate: { value: 3.26, unit: "%" },
    costPerConversion: { value: 12.54, unit: "$" },
    frequency: { value: 1.82, unit: "" },
  },
  saas: {
    ctr: { value: 0.98, unit: "%" },
    cpc: { value: 1.27, unit: "$" },
    cpm: { value: 14.12, unit: "$" },
    cpp: { value: 22.18, unit: "$" },
    conversionRate: { value: 2.31, unit: "%" },
    costPerConversion: { value: 28.64, unit: "$" },
    frequency: { value: 2.14, unit: "" },
  },
  technology: {
    ctr: { value: 1.04, unit: "%" },
    cpc: { value: 1.16, unit: "$" },
    cpm: { value: 13.68, unit: "$" },
    cpp: { value: 20.95, unit: "$" },
    conversionRate: { value: 2.52, unit: "%" },
    costPerConversion: { value: 25.12, unit: "$" },
    frequency: { value: 2.06, unit: "" },
  },
  healthcare: {
    ctr: { value: 0.83, unit: "%" },
    cpc: { value: 1.32, unit: "$" },
    cpm: { value: 10.97, unit: "$" },
    cpp: { value: 16.84, unit: "$" },
    conversionRate: { value: 2.15, unit: "%" },
    costPerConversion: { value: 44.28, unit: "$" },
    frequency: { value: 1.76, unit: "" },
  },
  finance: {
    ctr: { value: 0.72, unit: "%" },
    cpc: { value: 1.86, unit: "$" },
    cpm: { value: 13.4, unit: "$" },
    cpp: { value: 21.52, unit: "$" },
    conversionRate: { value: 1.92, unit: "%" },
    costPerConversion: { value: 52.36, unit: "$" },
    frequency: { value: 2.24, unit: "" },
  },
  education: {
    ctr: { value: 1.06, unit: "%" },
    cpc: { value: 0.72, unit: "$" },
    cpm: { value: 7.64, unit: "$" },
    cpp: { value: 12.35, unit: "$" },
    conversionRate: { value: 3.58, unit: "%" },
    costPerConversion: { value: 16.48, unit: "$" },
    frequency: { value: 1.68, unit: "" },
  },
  real_estate: {
    ctr: { value: 1.08, unit: "%" },
    cpc: { value: 0.98, unit: "$" },
    cpm: { value: 10.62, unit: "$" },
    cpp: { value: 17.14, unit: "$" },
    conversionRate: { value: 2.88, unit: "%" },
    costPerConversion: { value: 19.52, unit: "$" },
    frequency: { value: 1.92, unit: "" },
  },
  travel: {
    ctr: { value: 1.18, unit: "%" },
    cpc: { value: 0.63, unit: "$" },
    cpm: { value: 7.46, unit: "$" },
    cpp: { value: 11.86, unit: "$" },
    conversionRate: { value: 3.12, unit: "%" },
    costPerConversion: { value: 14.68, unit: "$" },
    frequency: { value: 1.86, unit: "" },
  },
  retail: {
    ctr: { value: 1.32, unit: "%" },
    cpc: { value: 0.74, unit: "$" },
    cpm: { value: 9.78, unit: "$" },
    cpp: { value: 15.42, unit: "$" },
    conversionRate: { value: 3.42, unit: "%" },
    costPerConversion: { value: 11.86, unit: "$" },
    frequency: { value: 1.94, unit: "" },
  },
  media: {
    ctr: { value: 1.16, unit: "%" },
    cpc: { value: 0.58, unit: "$" },
    cpm: { value: 6.72, unit: "$" },
    cpp: { value: 10.48, unit: "$" },
    conversionRate: { value: 2.68, unit: "%" },
    costPerConversion: { value: 18.34, unit: "$" },
    frequency: { value: 2.08, unit: "" },
  },
  automotive: {
    ctr: { value: 0.94, unit: "%" },
    cpc: { value: 1.42, unit: "$" },
    cpm: { value: 13.36, unit: "$" },
    cpp: { value: 21.68, unit: "$" },
    conversionRate: { value: 2.04, unit: "%" },
    costPerConversion: { value: 38.52, unit: "$" },
    frequency: { value: 2.18, unit: "" },
  },
  food_beverage: {
    ctr: { value: 1.28, unit: "%" },
    cpc: { value: 0.52, unit: "$" },
    cpm: { value: 6.68, unit: "$" },
    cpp: { value: 10.24, unit: "$" },
    conversionRate: { value: 3.84, unit: "%" },
    costPerConversion: { value: 10.12, unit: "$" },
    frequency: { value: 1.72, unit: "" },
  },
  fitness: {
    ctr: { value: 1.14, unit: "%" },
    cpc: { value: 0.82, unit: "$" },
    cpm: { value: 9.36, unit: "$" },
    cpp: { value: 14.72, unit: "$" },
    conversionRate: { value: 3.16, unit: "%" },
    costPerConversion: { value: 15.86, unit: "$" },
    frequency: { value: 1.88, unit: "" },
  },
  legal: {
    ctr: { value: 0.68, unit: "%" },
    cpc: { value: 2.14, unit: "$" },
    cpm: { value: 14.56, unit: "$" },
    cpp: { value: 23.42, unit: "$" },
    conversionRate: { value: 1.84, unit: "%" },
    costPerConversion: { value: 62.48, unit: "$" },
    frequency: { value: 2.32, unit: "" },
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
const CURRENCY_METRICS = new Set(["spend", "cpc", "cpm", "cpp", "costPerConversion", "totalRevenue", "profit", "revenuePerConversion"]);

/** Metrics that are expressed as percentages. */
const PERCENTAGE_METRICS = new Set(["ctr", "conversionRate", "roi", "profitMargin"]);

function isCurrencyLikeMetric(metric: string): boolean {
  return CURRENCY_METRICS.has(metric);
}

function getMetricUnit(metric: string, currencySymbol = "$"): string {
  if (CURRENCY_METRICS.has(metric)) return currencySymbol;
  if (PERCENTAGE_METRICS.has(metric)) return "%";
  if (metric === "roas") return "\u00d7"; // multiplication sign
  if (metric === "frequency") return "";
  return "";
}

function getMaxDecimalsForMetric(metric: string): number {
  if (PERCENTAGE_METRICS.has(metric)) return 2;
  if (CURRENCY_METRICS.has(metric)) return 2;
  if (metric === "roas" || metric === "frequency") return 2;
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
    impressions: "Track total impressions delivered by your Meta campaigns against the target benchmark.",
    reach: "Monitor unique reach performance to ensure your Meta ads are reaching enough people.",
    clicks: "Measure click volume from Meta ads to gauge audience interest and ad relevance.",
    conversions: "Track conversion events to evaluate how effectively Meta ads drive desired actions.",
    spend: "Monitor Meta ad spend to ensure budget is being utilised efficiently.",
    ctr: "Compare click-through rate against the benchmark to assess ad creative effectiveness.",
    cpc: "Track cost per click to optimise Meta ad bidding and budget allocation.",
    cpm: "Monitor cost per thousand impressions to evaluate delivery efficiency on Meta.",
    cpp: "Track cost per purchase/point to measure acquisition efficiency on Meta.",
    frequency: "Monitor ad frequency to prevent audience fatigue across Meta placements.",
    conversionRate: "Evaluate the percentage of clicks that result in conversions from Meta campaigns.",
    costPerConversion: "Track cost per conversion to ensure profitable Meta campaign performance.",
    videoViews: "Measure video view volume to assess video content engagement on Meta.",
    roi: "Calculate return on investment from Meta campaigns relative to the target benchmark.",
    roas: "Monitor return on ad spend to ensure Meta campaigns generate sufficient revenue.",
    totalRevenue: "Track total revenue attributed to Meta ad campaigns.",
    profit: "Monitor net profit generated from Meta advertising activities.",
    profitMargin: "Evaluate profit margin percentage for Meta campaign returns.",
    revenuePerConversion: "Track average revenue per conversion to gauge Meta campaign quality.",
  };
  return descriptions[metric] || "";
}

function getBenchmarkValueFallback(industry: string, metric: string): { value: number; unit: string } | null {
  return META_INDUSTRY_BENCHMARKS[industry]?.[metric] ?? null;
}

const DEFAULT_BENCHMARK_DESCRIPTION = "";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Split out from `pages/meta-analytics.tsx` to prevent single-file OOM.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */
export function MetaBenchmarkModal(props: any) {
  const {
    isBenchmarkModalOpen,
    setIsBenchmarkModalOpen,
    editingBenchmark,
    setEditingBenchmark,
    benchmarkForm,
    setBenchmarkForm,
    summary,
    revenueSummary,
    campaigns,
    toast,
    handleCreateBenchmark,
  } = props;

  /* ----- Revenue-gated metrics ----- */
  const revenueMetrics = ["roi", "roas", "totalRevenue", "profit", "profitMargin", "revenuePerConversion"];
  const hasRevenue = !!revenueSummary?.hasRevenueTracking;

  /* ----- Auto-populate current value from summary when a metric is selected ----- */
  const autoPopulateCurrentValue = (metric: string): { currentValue: string; unit: string } => {
    if (!summary) return { currentValue: "", unit: "" };
    let currentValue = "";
    let unit = "";
    switch (metric) {
      case "impressions":
        currentValue = String(summary.totalImpressions || 0);
        break;
      case "reach":
        currentValue = String(summary.totalReach || 0);
        break;
      case "clicks":
        currentValue = String(summary.totalClicks || 0);
        break;
      case "conversions":
        currentValue = String(summary.totalConversions || 0);
        break;
      case "spend":
        currentValue = String(summary.totalSpend || 0);
        unit = "$";
        break;
      case "ctr":
        currentValue = String(summary.avgCTR || 0);
        unit = "%";
        break;
      case "cpc":
        currentValue = String(summary.avgCPC || 0);
        unit = "$";
        break;
      case "cpm":
        currentValue = String(summary.avgCPM || 0);
        unit = "$";
        break;
      case "cpp":
        currentValue = String(summary.avgCPP || 0);
        unit = "$";
        break;
      case "frequency":
        currentValue = String(summary.avgFrequency || 0);
        break;
      case "conversionRate":
        currentValue = String(summary.conversionRate || 0);
        unit = "%";
        break;
      case "costPerConversion":
        currentValue = String(summary.costPerConversion || 0);
        unit = "$";
        break;
      case "videoViews":
        currentValue = String(summary.totalVideoViews || 0);
        break;
      case "roi":
        currentValue = String(revenueSummary?.roi || 0);
        unit = "%";
        break;
      case "roas":
        currentValue = String(revenueSummary?.roas || 0);
        unit = "\u00d7";
        break;
      case "totalRevenue":
        currentValue = String(revenueSummary?.totalRevenue || 0);
        unit = "$";
        break;
      case "profit":
        currentValue = String(revenueSummary?.profit || 0);
        unit = "$";
        break;
      case "profitMargin":
        currentValue = String(revenueSummary?.profitMargin || 0);
        unit = "%";
        break;
      case "revenuePerConversion":
        currentValue = String(revenueSummary?.conversionValue || 0);
        unit = "$";
        break;
    }
    return { currentValue, unit };
  };

  /* ----- Campaign-specific metric extraction ----- */
  const getCampaignMetricValue = (campaign: any, metric: string): { currentValue: string; unit: string } => {
    if (!campaign) return { currentValue: "", unit: "" };
    const m = campaign.metrics || campaign;
    let currentValue = "";
    let unit = "";
    switch (metric) {
      case "impressions":
        currentValue = String(m.impressions || 0);
        break;
      case "reach":
        currentValue = String(m.reach || 0);
        break;
      case "clicks":
        currentValue = String(m.clicks || 0);
        break;
      case "conversions":
        currentValue = String(m.conversions || 0);
        break;
      case "spend":
        currentValue = String(m.spend || 0);
        unit = "$";
        break;
      case "ctr":
        currentValue = String(m.ctr || 0);
        unit = "%";
        break;
      case "cpc":
        currentValue = String(m.cpc || 0);
        unit = "$";
        break;
      case "cpm":
        currentValue = String(m.cpm || 0);
        unit = "$";
        break;
      case "cpp":
        currentValue = String(m.cpp || 0);
        unit = "$";
        break;
      case "frequency":
        currentValue = String(m.frequency || 0);
        break;
      case "conversionRate":
        currentValue = String(m.conversionRate || 0);
        unit = "%";
        break;
      case "costPerConversion":
        currentValue = String(m.costPerConversion || 0);
        unit = "$";
        break;
      case "videoViews":
        currentValue = String(m.videoViews || m.video_views || 0);
        break;
    }
    return { currentValue, unit };
  };

  /* ----- Industry benchmark fetch with fallback ----- */
  const fetchIndustryBenchmark = async (industry: string, metric: string) => {
    try {
      const response = await fetch(`/api/industry-benchmarks/${industry}/${metric}`);
      if (response.ok) {
        const data = await response.json();
        setBenchmarkForm((prev: any) => ({
          ...prev,
          benchmarkValue: formatNumberAsYouType(String(data.value), { maxDecimals: getMaxDecimalsForMetric(metric) }),
          unit:
            metric === "roas"
              ? "\u00d7"
              : isCurrencyLikeMetric(metric)
                ? "$"
                : data.unit || prev.unit,
        }));
        return;
      }
    } catch (error) {
      console.error("[MetaBenchmarkModal] Failed to fetch industry benchmark:", error);
    }
    // Fallback to hardcoded values
    const fallback = getBenchmarkValueFallback(industry, metric);
    if (fallback) {
      setBenchmarkForm((prev: any) => ({
        ...prev,
        benchmarkValue: formatNumberAsYouType(String(fallback.value), { maxDecimals: getMaxDecimalsForMetric(metric) }),
        unit:
          metric === "roas"
            ? "\u00d7"
            : isCurrencyLikeMetric(metric)
              ? "$"
              : fallback.unit || prev.unit,
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
              ? "Update the benchmark details below. The current value can be auto-populated from your Meta analytics data."
              : "Define a new benchmark for your Meta campaigns. You can select metrics from the Overview tab as current values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Revenue Metrics Unavailable Alert */}
          {!hasRevenue && (
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
                    To create benchmarks for ROI, ROAS, Total Revenue, Profit, Profit Margin, or Revenue Per Conversion, you need to add
                    a conversion value to your campaign first.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benchmark Name */}
          <div className="space-y-2">
            <Label htmlFor="benchmark-name">Benchmark Name *</Label>
            <Input
              id="benchmark-name"
              placeholder="e.g., Meta Ads CTR Benchmark"
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
                  // Block revenue-gated metrics when no revenue tracking
                  if (revenueMetrics.includes(value) && !hasRevenue) {
                    toast({
                      title: "Conversion Value Required",
                      description:
                        "Revenue metrics require a conversion value. Please add a conversion value to track ROI, ROAS, Revenue, and Profit.",
                      variant: "destructive",
                    });
                    return;
                  }

                  // Determine metrics source
                  let autoFill: { currentValue: string; unit: string };
                  if (benchmarkForm.applyTo === "specific" && benchmarkForm.specificCampaignId) {
                    const campaign = (campaigns || []).find(
                      (c: any) => c.id === benchmarkForm.specificCampaignId || c.campaign_id === benchmarkForm.specificCampaignId || c.name === benchmarkForm.specificCampaignId
                    );
                    autoFill = campaign ? getCampaignMetricValue(campaign, value) : autoPopulateCurrentValue(value);
                  } else {
                    autoFill = autoPopulateCurrentValue(value);
                  }

                  // Auto-update description if it was default or empty
                  const prevDefaultDesc = getDefaultBenchmarkDescription(benchmarkForm.metric);
                  const nextDefaultDesc = getDefaultBenchmarkDescription(value);
                  const shouldAutoUpdateDesc =
                    !String(benchmarkForm.description || "").trim() || String(benchmarkForm.description || "") === prevDefaultDesc;

                  const updatedForm = {
                    ...benchmarkForm,
                    metric: value,
                    currentValue: formatMetricValueForInput(value, autoFill.currentValue),
                    unit: value === "roas" ? "\u00d7" : autoFill.unit || getMetricUnit(value),
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
                  <SelectItem value="reach">Reach</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="videoViews">Video Views</SelectItem>
                  <SelectItem value="ctr">Click-Through Rate (CTR)</SelectItem>
                  <SelectItem value="cpc">Cost Per Click (CPC)</SelectItem>
                  <SelectItem value="cpm">Cost Per Mille (CPM)</SelectItem>
                  <SelectItem value="cpp">Cost Per Purchase (CPP)</SelectItem>
                  <SelectItem value="frequency">Frequency</SelectItem>
                  <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                  <SelectItem value="costPerConversion">Cost Per Conversion</SelectItem>
                  <SelectItem value="roi" disabled={!hasRevenue}>
                    Return on Investment (ROI) {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="roas" disabled={!hasRevenue}>
                    Return on Ad Spend (ROAS) {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="totalRevenue" disabled={!hasRevenue}>
                    Total Revenue {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="profit" disabled={!hasRevenue}>
                    Profit {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="profitMargin" disabled={!hasRevenue}>
                    Profit Margin {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
                  <SelectItem value="revenuePerConversion" disabled={!hasRevenue}>
                    Revenue Per Conversion {!hasRevenue && "(Requires Conversion Value)"}
                  </SelectItem>
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

          {/* Apply To Section - Only show if multiple campaigns */}
          {Array.isArray(campaigns) && campaigns.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="benchmark-apply-to" className="text-base font-semibold">
                Apply Benchmark To
              </Label>
              <Select
                value={benchmarkForm.applyTo}
                onValueChange={(value) => {
                  const nextApplyTo = value as "all" | "specific";
                  if (!benchmarkForm.metric) {
                    setBenchmarkForm({
                      ...benchmarkForm,
                      applyTo: nextApplyTo,
                      specificCampaignId: "",
                      currentValue: nextApplyTo === "specific" ? "" : benchmarkForm.currentValue,
                    });
                    return;
                  }

                  if (nextApplyTo === "all") {
                    const autoFill = autoPopulateCurrentValue(benchmarkForm.metric);
                    setBenchmarkForm({
                      ...benchmarkForm,
                      applyTo: "all",
                      specificCampaignId: "",
                      currentValue: formatMetricValueForInput(benchmarkForm.metric, autoFill.currentValue),
                      unit: autoFill.unit || getMetricUnit(benchmarkForm.metric),
                    });
                    return;
                  }

                  // specific - clear until a campaign is selected
                  setBenchmarkForm({
                    ...benchmarkForm,
                    applyTo: "specific",
                    specificCampaignId: "",
                    currentValue: "",
                    unit: getMetricUnit(benchmarkForm.metric),
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
                  if (!benchmarkForm.metric) {
                    setBenchmarkForm({ ...benchmarkForm, specificCampaignId: value });
                    return;
                  }

                  const campaign = (campaigns || []).find(
                    (c: any) => c.id === value || c.campaign_id === value || c.name === value
                  );
                  const autoFill = campaign
                    ? getCampaignMetricValue(campaign, benchmarkForm.metric)
                    : { currentValue: "", unit: getMetricUnit(benchmarkForm.metric) };

                  setBenchmarkForm({
                    ...benchmarkForm,
                    specificCampaignId: value,
                    currentValue: formatMetricValueForInput(benchmarkForm.metric, autoFill.currentValue),
                    unit: autoFill.unit || getMetricUnit(benchmarkForm.metric),
                  });
                }}
              >
                <SelectTrigger id="benchmark-campaign" data-testid="select-benchmark-campaign">
                  <SelectValue placeholder="Choose a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(campaigns) && campaigns.length > 0 ? (
                    campaigns.map((campaign: any) => (
                      <SelectItem key={campaign.id || campaign.campaign_id || campaign.name} value={campaign.id || campaign.campaign_id || campaign.name}>
                        {campaign.name || campaign.campaign_name || campaign.id}
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
                Select the specific Meta campaign this benchmark applies to
              </p>
            </div>
          )}

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
              <p className="text-xs text-slate-500 dark:text-slate-400">Benchmark value will be auto-filled based on Meta Ads industry standards</p>
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

// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const KPI_DESC_MAX = 500;

/**
 * Meta/Facebook Ads KPI creation & editing modal.
 * Split out from `pages/meta-analytics.tsx` to prevent single-file OOM.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */

/** Generate a sensible default description based on the selected metric key. */
function getDefaultKpiDescription(metricKey: string): string {
  switch (metricKey) {
    case "impressions":
      return "Track total ad impressions delivered across Meta campaigns to measure brand visibility and ad delivery volume.";
    case "reach":
      return "Monitor unique users reached by Meta ads to understand audience breadth and potential market penetration.";
    case "clicks":
      return "Measure total link clicks on Meta ads to evaluate audience engagement and traffic generation effectiveness.";
    case "conversions":
      return "Track conversion actions completed from Meta ad traffic to measure campaign effectiveness at driving desired outcomes.";
    case "spend":
      return "Monitor total advertising spend across Meta campaigns to control budget allocation and optimize cost efficiency.";
    case "ctr":
      return "Track click-through rate to evaluate how effectively ad creative and targeting drives user engagement on Meta.";
    case "cpc":
      return "Monitor cost per click to assess the efficiency of Meta ad spend in generating traffic to landing pages.";
    case "cpm":
      return "Track cost per thousand impressions to evaluate the cost efficiency of reach and awareness campaigns on Meta.";
    case "cpp":
      return "Monitor cost per purchase to measure how efficiently Meta ads convert spend into completed transactions.";
    case "frequency":
      return "Track average ad frequency to ensure optimal exposure without causing audience fatigue across Meta campaigns.";
    case "conversionRate":
      return "Measure the percentage of clicks that result in conversions to evaluate landing page and funnel effectiveness.";
    case "costPerConversion":
      return "Track the average cost to acquire each conversion, measuring the ROI efficiency of Meta campaign spend.";
    case "videoViews":
      return "Monitor total video views from Meta ads to measure video content engagement and brand storytelling reach.";
    case "roi":
      return "Track return on investment to measure the overall profitability of Meta advertising spend relative to revenue generated.";
    case "roas":
      return "Monitor return on ad spend to evaluate how much revenue is generated for every dollar spent on Meta ads.";
    case "totalRevenue":
      return "Track total revenue attributed to Meta campaigns to measure the direct financial impact of advertising efforts.";
    case "profit":
      return "Monitor net profit (revenue minus ad spend) from Meta campaigns to assess true financial return.";
    case "profitMargin":
      return "Track profit margin percentage to evaluate the profitability ratio of Meta advertising investments.";
    default:
      return "";
  }
}

/** Maximum decimal places appropriate for each metric type. */
function getMaxDecimalsForMetric(metricKey: string): number {
  switch (metricKey) {
    case "impressions":
    case "reach":
    case "clicks":
    case "conversions":
    case "videoViews":
      return 0;
    case "ctr":
    case "conversionRate":
    case "profitMargin":
    case "frequency":
      return 2;
    case "cpc":
    case "cpm":
    case "cpp":
    case "costPerConversion":
    case "spend":
    case "totalRevenue":
    case "profit":
    case "roi":
      return 2;
    case "roas":
      return 2;
    default:
      return 2;
  }
}

/**
 * Format a numeric string while the user types, respecting maxDecimals.
 * Allows intermediate states like "" and "1." for a fluid typing experience.
 */
function formatNumberAsYouType(raw: string, opts?: { maxDecimals?: number }): string {
  const maxDecimals = opts?.maxDecimals ?? 2;
  // Strip everything except digits, dots, and leading minus
  let cleaned = raw.replace(/[^0-9.\-]/g, "");
  // Only allow one minus, at the start
  if (cleaned.indexOf("-") > 0) cleaned = cleaned.replace(/-/g, "");
  // Only allow one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }
  // Truncate decimal places
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    cleaned = parts[0] + "." + parts[1].slice(0, maxDecimals);
  }
  return cleaned;
}

export function MetaKpiModal(props: any) {
  const {
    isKPIModalOpen,
    setIsKPIModalOpen,
    editingKPI,
    setEditingKPI,
    kpiForm,
    setKpiForm,
    summary,
    revenueSummary,
    campaigns,
    toast,
    handleCreateKPI,
  } = props;

  /** Revenue metrics that require revenue tracking to be enabled. */
  const REVENUE_METRICS = ["roi", "roas", "totalRevenue", "profit", "profitMargin"];
  const hasRevenue = !!revenueSummary?.hasRevenueTracking;

  /**
   * Given a metric key and optional campaign object, resolve the current value
   * and appropriate unit from the summary or campaign data.
   */
  const getMetricValue = (metricKey: string, campaign?: any): { value: string; unit: string } => {
    let currentValue = "";
    let unit = "";

    if (campaign) {
      // Campaign-level metric resolution
      const imp = Number(campaign.impressions || 0);
      const rch = Number(campaign.reach || 0);
      const clk = Number(campaign.clicks || 0);
      const conv = Number(campaign.conversions || 0);
      const spd = Number(campaign.spend || 0);
      const vidViews = Number(campaign.videoViews || 0);

      // Derived rates at campaign level
      const ctr = imp > 0 ? (clk / imp) * 100 : 0;
      const cpc = clk > 0 ? spd / clk : 0;
      const cpm = imp > 0 ? (spd / imp) * 1000 : 0;
      const cpp = conv > 0 ? spd / conv : 0;
      const freq = rch > 0 ? imp / rch : 0;
      const cvr = clk > 0 ? (conv / clk) * 100 : 0;
      const costPerConv = conv > 0 ? spd / conv : 0;

      switch (metricKey) {
        case "impressions":
          currentValue = String(imp);
          break;
        case "reach":
          currentValue = String(rch);
          break;
        case "clicks":
          currentValue = String(clk);
          break;
        case "conversions":
          currentValue = String(conv);
          break;
        case "spend":
          currentValue = String(spd);
          unit = "$";
          break;
        case "ctr":
          currentValue = String(ctr);
          unit = "%";
          break;
        case "cpc":
          currentValue = String(cpc);
          unit = "$";
          break;
        case "cpm":
          currentValue = String(cpm);
          unit = "$";
          break;
        case "cpp":
          currentValue = String(cpp);
          unit = "$";
          break;
        case "frequency":
          currentValue = String(freq);
          break;
        case "conversionRate":
          currentValue = String(cvr);
          unit = "%";
          break;
        case "costPerConversion":
          currentValue = String(costPerConv);
          unit = "$";
          break;
        case "videoViews":
          currentValue = String(vidViews);
          break;
        case "roi":
          if (hasRevenue) {
            const revenue = conv * (revenueSummary.conversionValue || 0);
            const profit = revenue - spd;
            currentValue = spd > 0 ? String((profit / spd) * 100) : "0";
            unit = "%";
          }
          break;
        case "roas":
          if (hasRevenue) {
            const revenue = conv * (revenueSummary.conversionValue || 0);
            currentValue = spd > 0 ? String(revenue / spd) : "0";
            unit = "x";
          }
          break;
        case "totalRevenue":
          if (hasRevenue) {
            currentValue = String(conv * (revenueSummary.conversionValue || 0));
            unit = "$";
          }
          break;
        case "profit":
          if (hasRevenue) {
            const revenue = conv * (revenueSummary.conversionValue || 0);
            currentValue = String(revenue - spd);
            unit = "$";
          }
          break;
        case "profitMargin":
          if (hasRevenue) {
            const revenue = conv * (revenueSummary.conversionValue || 0);
            const profit = revenue - spd;
            currentValue = revenue > 0 ? String((profit / revenue) * 100) : "0";
            unit = "%";
          }
          break;
      }
    } else if (summary) {
      // Aggregate-level metric resolution from the summary object
      switch (metricKey) {
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
          currentValue = String(summary.conversionRate || summary.avgConversionRate || 0);
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
          if (hasRevenue) {
            const totalRevenue = revenueSummary.totalRevenue || 0;
            const totalSpend = summary.totalSpend || 0;
            const profit = totalRevenue - totalSpend;
            currentValue = totalSpend > 0 ? String((profit / totalSpend) * 100) : "0";
            unit = "%";
          }
          break;
        case "roas":
          if (hasRevenue) {
            const totalRevenue = revenueSummary.totalRevenue || 0;
            const totalSpend = summary.totalSpend || 0;
            currentValue = totalSpend > 0 ? String(totalRevenue / totalSpend) : "0";
            unit = "x";
          }
          break;
        case "totalRevenue":
          if (hasRevenue) {
            currentValue = String(revenueSummary.totalRevenue || 0);
            unit = "$";
          }
          break;
        case "profit":
          if (hasRevenue) {
            const totalRevenue = revenueSummary.totalRevenue || 0;
            const totalSpend = summary.totalSpend || 0;
            currentValue = String(totalRevenue - totalSpend);
            unit = "$";
          }
          break;
        case "profitMargin":
          if (hasRevenue) {
            const totalRevenue = revenueSummary.totalRevenue || 0;
            const totalSpend = summary.totalSpend || 0;
            const profit = totalRevenue - totalSpend;
            currentValue = totalRevenue > 0 ? String((profit / totalRevenue) * 100) : "0";
            unit = "%";
          }
          break;
      }
    }

    return { value: currentValue, unit };
  };

  /**
   * Find a campaign object from the campaigns array by its id (or name).
   */
  const findCampaign = (campaignId: string): any | null => {
    if (!campaigns || !Array.isArray(campaigns)) return null;
    return (
      campaigns.find(
        (c: any) => String(c.id) === String(campaignId) || c.name === campaignId || c.metaCampaignId === campaignId
      ) || null
    );
  };

  /**
   * Recalculate and apply the current value when metric or campaign selection changes.
   */
  const recalculateCurrentValue = (metricKey: string, applyTo: string, specificCampaignId: string) => {
    const campaign = applyTo === "specific" && specificCampaignId ? findCampaign(specificCampaignId) : null;
    const result = getMetricValue(metricKey, campaign);
    const formattedCurrentValue = result.value
      ? formatNumberAsYouType(String(result.value), { maxDecimals: getMaxDecimalsForMetric(metricKey) })
      : "";
    return { currentValue: formattedCurrentValue, unit: result.unit };
  };

  return (
    <Dialog
      open={isKPIModalOpen}
      onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          setEditingKPI(null);
          setKpiForm({
            name: "",
            unit: "",
            description: "",
            metric: "",
            targetValue: "",
            currentValue: "",
            priority: "high",
            status: "active",
            category: "",
            timeframe: "monthly",
            trackingPeriod: "30",
            alertsEnabled: false,
            emailNotifications: false,
            alertFrequency: "daily",
            alertThreshold: "",
            alertCondition: "below",
            emailRecipients: "",
            applyTo: "all",
            specificCampaignId: "",
          });
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingKPI ? "Edit KPI" : "Create New KPI"}</DialogTitle>
          <DialogDescription>
            {editingKPI
              ? "Update the KPI details below. The current value can be auto-populated from your Meta Ads metrics data."
              : "Define a new KPI for your Meta campaign. You can select metrics from the selected campaign as current values."}
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
                    To create KPIs for ROI, ROAS, Total Revenue, Profit, or Profit Margin, you need to add a
                    conversion value to your campaign first. You can do this from your campaign settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-name">KPI Name *</Label>
              <Input
                id="kpi-name"
                placeholder="e.g., Meta CTR Target"
                value={kpiForm.name}
                onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                data-testid="input-kpi-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-metric">Metric Source</Label>
              <Select
                value={kpiForm.metric || ""}
                onValueChange={(value) => {
                  const prevDefaultDesc = getDefaultKpiDescription(kpiForm.metric);
                  const nextDefaultDesc = getDefaultKpiDescription(value);
                  const shouldAutoUpdateDesc =
                    !String(kpiForm.description || "").trim() || String(kpiForm.description || "") === prevDefaultDesc;

                  // Block revenue metrics when no revenue tracking
                  if (REVENUE_METRICS.includes(value) && !hasRevenue) {
                    toast({
                      title: "Conversion Value Required",
                      description:
                        "Revenue metrics require a conversion value. Please add a conversion value to your campaign to track ROI, ROAS, Revenue, and Profit.",
                      variant: "destructive",
                    });
                    return;
                  }

                  const { currentValue, unit } = recalculateCurrentValue(
                    value,
                    kpiForm.applyTo || "all",
                    kpiForm.specificCampaignId || ""
                  );

                  setKpiForm({
                    ...kpiForm,
                    metric: value,
                    currentValue,
                    unit,
                    description: shouldAutoUpdateDesc ? nextDefaultDesc : kpiForm.description,
                  });
                }}
              >
                <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                  <SelectValue placeholder="Select metric to track" />
                </SelectTrigger>
                <SelectContent className="scroll-smooth max-h-[300px]">
                  <SelectItem value="impressions">Impressions</SelectItem>
                  <SelectItem value="reach">Reach</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="ctr">Click-Through Rate (CTR)</SelectItem>
                  <SelectItem value="cpc">Cost Per Click (CPC)</SelectItem>
                  <SelectItem value="cpm">Cost Per Mille (CPM)</SelectItem>
                  <SelectItem value="cpp">Cost Per Purchase (CPP)</SelectItem>
                  <SelectItem value="frequency">Frequency</SelectItem>
                  <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                  <SelectItem value="costPerConversion">Cost Per Conversion</SelectItem>
                  <SelectItem value="videoViews">Video Views</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-description">Description</Label>
            <Textarea
              id="kpi-description"
              placeholder="Describe what this KPI measures and why it's important"
              value={kpiForm.description}
              maxLength={KPI_DESC_MAX}
              onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value.slice(0, KPI_DESC_MAX) })}
              rows={3}
              data-testid="input-kpi-description"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
              {(kpiForm.description || "").length}/{KPI_DESC_MAX}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-current">Current Value</Label>
              <Input
                id="kpi-current"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={kpiForm.currentValue || ""}
                onChange={(e) => {
                  const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(kpiForm.metric) });
                  setKpiForm({ ...kpiForm, currentValue: formatted });
                }}
                data-testid="input-kpi-current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-target">Target Value *</Label>
              <Input
                id="kpi-target"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={kpiForm.targetValue}
                onChange={(e) => {
                  const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(kpiForm.metric) });
                  setKpiForm({ ...kpiForm, targetValue: formatted });
                }}
                data-testid="input-kpi-target"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-unit">Unit</Label>
              <Input
                id="kpi-unit"
                placeholder="%, $, etc."
                value={kpiForm.unit}
                onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                data-testid="input-kpi-unit"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-priority">Priority</Label>
              <Select value={kpiForm.priority} onValueChange={(value) => setKpiForm({ ...kpiForm, priority: value })}>
                <SelectTrigger id="kpi-priority" data-testid="select-kpi-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-category">Category</Label>
              <Select value={kpiForm.category || ""} onValueChange={(value) => setKpiForm({ ...kpiForm, category: value })}>
                <SelectTrigger id="kpi-category" data-testid="select-kpi-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awareness">Awareness</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="conversion">Conversion</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                  <SelectItem value="reach">Reach</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-timeframe">Timeframe</Label>
              <Select
                value={kpiForm.timeframe || "monthly"}
                onValueChange={(value) => setKpiForm({ ...kpiForm, timeframe: value })}
              >
                <SelectTrigger id="kpi-timeframe" data-testid="select-kpi-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-tracking-period">Tracking Period (days)</Label>
              <Input
                id="kpi-tracking-period"
                type="text"
                placeholder="30"
                inputMode="numeric"
                value={kpiForm.trackingPeriod || ""}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setKpiForm({ ...kpiForm, trackingPeriod: cleaned });
                }}
                data-testid="input-kpi-tracking-period"
              />
            </div>
          </div>

          {/* Apply To Section - Only show if multiple campaigns */}
          {campaigns && campaigns.length > 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-apply-to">Apply To</Label>
                <Select
                  value={kpiForm.applyTo || "all"}
                  onValueChange={(value) => {
                    if (value === "all" && kpiForm.metric) {
                      const { currentValue, unit } = recalculateCurrentValue(kpiForm.metric, "all", "");
                      setKpiForm((prev: any) => ({
                        ...prev,
                        applyTo: value,
                        specificCampaignId: "",
                        currentValue,
                        unit,
                      }));
                    } else {
                      setKpiForm({
                        ...kpiForm,
                        applyTo: value,
                        specificCampaignId: value === "all" ? "" : kpiForm.specificCampaignId,
                      });
                    }
                  }}
                >
                  <SelectTrigger id="kpi-apply-to">
                    <SelectValue placeholder="All Campaigns (Aggregate)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns (Aggregate)</SelectItem>
                    <SelectItem value="specific">Specific Campaign</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">Track KPI across all campaigns or for a specific campaign</p>
              </div>

              {kpiForm.applyTo === "specific" && (
                <div className="space-y-2">
                  <Label htmlFor="kpi-campaign">Select Campaign</Label>
                  <Select
                    value={kpiForm.specificCampaignId || ""}
                    onValueChange={(value) => {
                      if (kpiForm.metric) {
                        const campaign = findCampaign(value);
                        if (campaign) {
                          const result = getMetricValue(kpiForm.metric, campaign);
                          const formattedCurrentValue = result.value
                            ? formatNumberAsYouType(String(result.value), { maxDecimals: getMaxDecimalsForMetric(kpiForm.metric) })
                            : "";
                          setKpiForm((prev: any) => ({
                            ...prev,
                            specificCampaignId: value,
                            currentValue: formattedCurrentValue,
                            unit: result.unit,
                          }));
                          return;
                        }
                      }
                      setKpiForm({ ...kpiForm, specificCampaignId: value });
                    }}
                  >
                    <SelectTrigger id="kpi-campaign">
                      <SelectValue placeholder="Choose a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign: any) => (
                        <SelectItem key={campaign.id || campaign.name} value={String(campaign.id || campaign.name)}>
                          {campaign.name || campaign.campaignName || `Campaign ${campaign.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">KPI will track metrics for this campaign only</p>
                </div>
              )}
            </div>
          )}

          {/* Alert Settings Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpi-alerts-enabled"
                  checked={kpiForm.alertsEnabled}
                  onCheckedChange={(checked) => setKpiForm({ ...kpiForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-kpi-alerts"
                />
                <Label htmlFor="kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable alerts for this KPI
                </Label>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 pl-6">
                Receive notifications for KPI performance alerts on the bell icon &amp; in your Notifications center
              </p>
            </div>

            {kpiForm.alertsEnabled && (
              <div className="space-y-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kpi-alert-threshold">Alert Threshold *</Label>
                    <Input
                      id="kpi-alert-threshold"
                      type="text"
                      placeholder="e.g., 80"
                      inputMode="decimal"
                      value={kpiForm.alertThreshold}
                      onChange={(e) => {
                        const formatted = formatNumberAsYouType(e.target.value, { maxDecimals: getMaxDecimalsForMetric(kpiForm.metric) });
                        setKpiForm({ ...kpiForm, alertThreshold: formatted });
                      }}
                      data-testid="input-kpi-alert-threshold"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Value at which to trigger the alert</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kpi-alert-condition">Alert When</Label>
                    <Select value={kpiForm.alertCondition} onValueChange={(value) => setKpiForm({ ...kpiForm, alertCondition: value })}>
                      <SelectTrigger id="kpi-alert-condition" data-testid="select-kpi-alert-condition">
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
                    <Label htmlFor="kpi-alert-frequency">Alert Frequency</Label>
                    <Select
                      value={kpiForm.alertFrequency || "daily"}
                      onValueChange={(value) => setKpiForm({ ...kpiForm, alertFrequency: value })}
                    >
                      <SelectTrigger id="kpi-alert-frequency" data-testid="select-kpi-alert-frequency">
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
                        id="kpi-email-notifications"
                        checked={!!kpiForm.emailNotifications}
                        onCheckedChange={(checked) => setKpiForm({ ...kpiForm, emailNotifications: checked as boolean })}
                        data-testid="checkbox-kpi-email-notifications"
                      />
                      <Label htmlFor="kpi-email-notifications" className="cursor-pointer font-medium">
                        Send email notifications
                      </Label>
                    </div>
                    {kpiForm.emailNotifications && (
                      <div className="space-y-2">
                        <Label htmlFor="kpi-email-recipients">Email addresses *</Label>
                        <Input
                          id="kpi-email-recipients"
                          type="text"
                          placeholder="email1@example.com, email2@example.com"
                          value={kpiForm.emailRecipients}
                          onChange={(e) => setKpiForm({ ...kpiForm, emailRecipients: e.target.value })}
                          data-testid="input-kpi-email-recipients"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Comma-separated. Best for execs who want alerts outside the app.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsKPIModalOpen(false)} data-testid="button-cancel-kpi">
              Cancel
            </Button>
            <Button onClick={handleCreateKPI} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-kpi">
              {editingKPI ? "Update KPI" : "Create KPI"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
 * Google Ads KPI creation & editing modal.
 * Adapted from the Meta KPI modal for Google Ads metrics.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */

/** Generate a sensible default description based on the selected metric key. */
function getDefaultKpiDescription(metricKey: string): string {
  switch (metricKey) {
    case "impressions":
      return "Track total ad impressions delivered across Google Ads campaigns to measure brand visibility and ad delivery volume.";
    case "clicks":
      return "Measure total clicks on Google Ads to evaluate audience engagement and traffic generation effectiveness.";
    case "conversions":
      return "Track conversion actions completed from Google Ads traffic to measure campaign effectiveness at driving desired outcomes.";
    case "spend":
      return "Monitor total advertising spend across Google Ads campaigns to control budget allocation and optimize cost efficiency.";
    case "videoViews":
      return "Monitor total video views from Google Ads to measure video content engagement and brand storytelling reach.";
    case "ctr":
      return "Track click-through rate to evaluate how effectively ad creative and targeting drives user engagement on Google Ads.";
    case "cpc":
      return "Monitor cost per click to assess the efficiency of Google Ads spend in generating traffic to landing pages.";
    case "cpm":
      return "Track cost per thousand impressions to evaluate the cost efficiency of reach and awareness campaigns on Google Ads.";
    case "conversionRate":
      return "Measure the percentage of clicks that result in conversions to evaluate landing page and funnel effectiveness.";
    case "costPerConversion":
      return "Track the average cost to acquire each conversion, measuring the ROI efficiency of Google Ads campaign spend.";
    case "searchImpressionShare":
      return "Monitor the percentage of impressions received versus the total eligible impressions in Google Ads search results.";
    default:
      return "";
  }
}

/** Maximum decimal places appropriate for each metric type. */
function getMaxDecimalsForMetric(metricKey: string): number {
  switch (metricKey) {
    case "impressions":
    case "clicks":
    case "conversions":
    case "videoViews":
      return 0;
    case "ctr":
    case "conversionRate":
    case "searchImpressionShare":
      return 2;
    case "cpc":
    case "cpm":
    case "costPerConversion":
    case "spend":
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

export function GoogleAdsKpiModal(props: any) {
  const {
    isKPIModalOpen,
    setIsKPIModalOpen,
    editingKPI,
    setEditingKPI,
    kpiForm,
    setKpiForm,
    summary,
    toast,
    handleCreateKPI,
  } = props;

  /**
   * Given a metric key, resolve the current value and appropriate unit
   * from the Google Ads summary data (aggregate-level only).
   */
  const getMetricValue = (metricKey: string): { value: string; unit: string } => {
    let currentValue = "";
    let unit = "";

    if (summary) {
      switch (metricKey) {
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
          currentValue = String(summary.searchImpressionShare || 0);
          unit = "%";
          break;
      }
    }

    return { value: currentValue, unit };
  };

  /**
   * Recalculate and apply the current value when the metric selection changes.
   */
  const recalculateCurrentValue = (metricKey: string) => {
    const result = getMetricValue(metricKey);
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
          });
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingKPI ? "Edit KPI" : "Create New KPI"}</DialogTitle>
          <DialogDescription>
            {editingKPI
              ? "Update the KPI details below. The current value can be auto-populated from your Google Ads metrics data."
              : "Define a new KPI for your Google Ads account. You can select metrics from your campaign data as current values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-name">KPI Name *</Label>
              <Input
                id="kpi-name"
                placeholder="e.g., Google Ads CTR Target"
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

                  const { currentValue, unit } = recalculateCurrentValue(value);

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

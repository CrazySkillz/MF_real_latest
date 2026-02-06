// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Split out from `pages/linkedin-analytics.tsx` to prevent single-file OOM.
 * Uses `any` props intentionally to avoid tight coupling while we continue refactoring.
 */
export function LinkedInKpiModal(props: any) {
  const {
    isKPIModalOpen,
    setIsKPIModalOpen,
    setModalStep,
    setSelectedTemplate,
    editingKPI,
    setEditingKPI,
    kpiForm,
    setKpiForm,
    aggregated,
    openAddRevenueModal,
    toast,
    sessionData,
    campaignCurrencySymbol,
    availableCampaigns,
    KPI_DESC_MAX,
    formatNumberAsYouType,
    getMaxDecimalsForMetric,
    handleCreateKPI,
  } = props;

  return (
    <Dialog
      open={isKPIModalOpen}
      onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          setModalStep("configuration");
          setSelectedTemplate(null);
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
              ? "Update the KPI details below. The current value can be auto-populated from your LinkedIn metrics data."
              : "Define a new KPI for your LinkedIn campaign. You can select metrics from the selected campaign as current values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Conversion Value Required Alert */}
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
                    To create KPIs for ROI, ROAS, Total Revenue, Profit, Profit Margin, or Revenue Per Lead, you need to add a
                    conversion value to your campaign first.
                  </p>
                  <button
                    onClick={() => {
                      setIsKPIModalOpen(false);
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-name">KPI Name *</Label>
              <Input
                id="kpi-name"
                placeholder="e.g., LinkedIn CTR Target"
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
                  const revenueMetrics = ["roi", "roas", "totalRevenue", "profit", "profitMargin", "revenuePerLead"];
                  if (revenueMetrics.includes(value) && !aggregated?.hasRevenueTracking) {
                    toast({
                      title: "Conversion Value Required",
                      description:
                        "Revenue metrics require a conversion value. Please edit your campaign and add a conversion value to track ROI, ROAS, Revenue, and Profit.",
                      variant: "destructive",
                    });
                    return;
                  }

                  const getMetricValue = (metricKey: string): { value: string; unit: string } => {
                    let currentValue = "";
                    let unit = "";

                    if (kpiForm.applyTo === "specific" && kpiForm.specificCampaignId) {
                      const { metrics: rawMetrics } = (sessionData as any) || {};
                      let campaignData = null;

                      if (rawMetrics && Array.isArray(rawMetrics)) {
                        const campaignMetrics: any = {};
                        rawMetrics.forEach((m: any) => {
                          if (m.campaignName === kpiForm.specificCampaignId) {
                            campaignMetrics[m.metricKey] = parseFloat(m.metricValue || 0);
                          }
                        });

                        if (Object.keys(campaignMetrics).length > 0) {
                          const imp = campaignMetrics.impressions || 0;
                          const clk = campaignMetrics.clicks || 0;
                          const spd = campaignMetrics.spend || 0;
                          const conv = campaignMetrics.conversions || 0;
                          const lds = campaignMetrics.leads || 0;
                          const eng = campaignMetrics.engagements || 0;

                          campaignData = {
                            impressions: imp,
                            clicks: clk,
                            spend: spd,
                            conversions: conv,
                            leads: lds,
                            engagements: eng,
                            reach: campaignMetrics.reach || 0,
                            videoViews: campaignMetrics.videoViews || 0,
                            viralImpressions: campaignMetrics.viralImpressions || 0,
                            ctr: imp > 0 ? (clk / imp) * 100 : 0,
                            cpc: clk > 0 ? spd / clk : 0,
                            cpm: imp > 0 ? (spd / imp) * 1000 : 0,
                            cvr: clk > 0 ? (conv / clk) * 100 : 0,
                            cpa: conv > 0 ? spd / conv : 0,
                            cpl: lds > 0 ? spd / lds : 0,
                            er: imp > 0 ? (eng / imp) * 100 : 0,
                          };
                        }
                      }

                      if (campaignData) {
                        const impressions = campaignData.impressions || 0;
                        const clicks = campaignData.clicks || 0;
                        const spend = campaignData.spend || 0;
                        const conversions = campaignData.conversions || 0;
                        const leads = campaignData.leads || 0;

                        switch (metricKey) {
                          case "impressions":
                            currentValue = String(impressions);
                            break;
                          case "reach":
                            currentValue = String(campaignData.reach || 0);
                            break;
                          case "clicks":
                            currentValue = String(clicks);
                            break;
                          case "engagements":
                            currentValue = String(campaignData.engagements || 0);
                            break;
                          case "spend":
                            currentValue = String(spend);
                            unit = campaignCurrencySymbol;
                            break;
                          case "conversions":
                            currentValue = String(conversions);
                            break;
                          case "leads":
                            currentValue = String(leads);
                            break;
                          case "videoViews":
                            currentValue = String(campaignData.videoViews || 0);
                            break;
                          case "viralImpressions":
                            currentValue = String(campaignData.viralImpressions || 0);
                            break;
                          case "ctr":
                            currentValue = String(campaignData.ctr || 0);
                            unit = "%";
                            break;
                          case "cpc":
                            currentValue = String(campaignData.cpc || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cpm":
                            currentValue = String(campaignData.cpm || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cvr":
                            currentValue = String(campaignData.cvr || 0);
                            unit = "%";
                            break;
                          case "cpa":
                            currentValue = String(campaignData.cpa || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cpl":
                            currentValue = String(campaignData.cpl || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "er":
                            currentValue = String(campaignData.er || 0);
                            unit = "%";
                            break;
                          case "roi":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              const profit = revenue - spend;
                              currentValue = spend > 0 ? String((profit / spend) * 100) : "0";
                              unit = "%";
                            }
                            break;
                          case "roas":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = spend > 0 ? String(revenue / spend) : "0";
                              unit = "x";
                            }
                            break;
                          case "totalRevenue":
                            if (aggregated?.hasRevenueTracking) {
                              currentValue = String(conversions * (aggregated.conversionValue || 0));
                              unit = campaignCurrencySymbol;
                            }
                            break;
                          case "profit":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = String(revenue - spend);
                              unit = campaignCurrencySymbol;
                            }
                            break;
                          case "profitMargin":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              const profit = revenue - spend;
                              currentValue = revenue > 0 ? String((profit / revenue) * 100) : "0";
                              unit = "%";
                            }
                            break;
                          case "revenuePerLead":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = leads > 0 ? String(revenue / leads) : "0";
                              unit = campaignCurrencySymbol;
                            }
                            break;
                        }
                      }
                    } else if (aggregated) {
                      switch (metricKey) {
                        case "impressions":
                          currentValue = String(aggregated.totalImpressions || 0);
                          break;
                        case "reach":
                          currentValue = String(aggregated.totalReach || 0);
                          break;
                        case "clicks":
                          currentValue = String(aggregated.totalClicks || 0);
                          break;
                        case "engagements":
                          currentValue = String(aggregated.totalEngagements || 0);
                          break;
                        case "spend":
                          currentValue = String(aggregated.totalSpend || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "conversions":
                          currentValue = String(aggregated.totalConversions || 0);
                          break;
                        case "leads":
                          currentValue = String(aggregated.totalLeads || 0);
                          break;
                        case "videoViews":
                          currentValue = String(aggregated.totalVideoViews || 0);
                          break;
                        case "viralImpressions":
                          currentValue = String(aggregated.totalViralImpressions || 0);
                          break;
                        case "ctr":
                          currentValue = String(aggregated.ctr || 0);
                          unit = "%";
                          break;
                        case "cpc":
                          currentValue = String(aggregated.cpc || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "cpm":
                          currentValue = String(aggregated.cpm || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "cvr":
                          currentValue = String(aggregated.cvr || 0);
                          unit = "%";
                          break;
                        case "cpa":
                          currentValue = String(aggregated.cpa || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "cpl":
                          currentValue = String(aggregated.cpl || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "er":
                          currentValue = String(aggregated.er || 0);
                          unit = "%";
                          break;
                        case "roi":
                          currentValue = String(aggregated.roi || 0);
                          unit = "%";
                          break;
                        case "roas":
                          currentValue = String(aggregated.roas || 0);
                          unit = "x";
                          break;
                        case "totalRevenue":
                          currentValue = String(aggregated.totalRevenue || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "profit":
                          currentValue = String(aggregated.profit || 0);
                          unit = campaignCurrencySymbol;
                          break;
                        case "profitMargin":
                          currentValue = String(aggregated.profitMargin || 0);
                          unit = "%";
                          break;
                        case "revenuePerLead":
                          currentValue = String(aggregated.revenuePerLead || 0);
                          unit = campaignCurrencySymbol;
                          break;
                      }
                    }
                    return { value: currentValue, unit };
                  };

                  const result = getMetricValue(value);
                  setKpiForm({ ...kpiForm, metric: value, currentValue: result.value, unit: result.unit });
                }}
              >
                <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                  <SelectValue placeholder="Select metric to track" />
                </SelectTrigger>
                <SelectContent className="scroll-smooth max-h-[300px]">
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
              {kpiForm.description.length}/{KPI_DESC_MAX}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-current">Current Value</Label>
              <Input
                id="kpi-current"
                type="text"
                placeholder="0"
                value={kpiForm.currentValue ? parseFloat(kpiForm.currentValue).toLocaleString("en-US") : ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/,/g, "");
                  if (value === "" || !isNaN(parseFloat(value))) {
                    setKpiForm({ ...kpiForm, currentValue: value });
                  }
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Apply To Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi-apply-to">Apply To</Label>
              <Select
                value={kpiForm.applyTo}
                onValueChange={(value) => {
                  const updatedForm = { ...kpiForm, applyTo: value, specificCampaignId: value === "all" ? "" : kpiForm.specificCampaignId };
                  setKpiForm(updatedForm);

                  if (value === "all" && kpiForm.metric && aggregated) {
                    let currentValue = "";
                    let unit = kpiForm.unit || "";

                    switch (kpiForm.metric) {
                      case "impressions":
                        currentValue = String(aggregated.totalImpressions || 0);
                        break;
                      case "reach":
                        currentValue = String(aggregated.totalReach || 0);
                        break;
                      case "clicks":
                        currentValue = String(aggregated.totalClicks || 0);
                        break;
                      case "engagements":
                        currentValue = String(aggregated.totalEngagements || 0);
                        break;
                      case "spend":
                        currentValue = String(aggregated.totalSpend || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "conversions":
                        currentValue = String(aggregated.totalConversions || 0);
                        break;
                      case "leads":
                        currentValue = String(aggregated.totalLeads || 0);
                        break;
                      case "videoViews":
                        currentValue = String(aggregated.totalVideoViews || 0);
                        break;
                      case "viralImpressions":
                        currentValue = String(aggregated.totalViralImpressions || 0);
                        break;
                      case "ctr":
                        currentValue = String(aggregated.ctr || 0);
                        unit = "%";
                        break;
                      case "cpc":
                        currentValue = String(aggregated.cpc || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cpm":
                        currentValue = String(aggregated.cpm || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cvr":
                        currentValue = String(aggregated.cvr || 0);
                        unit = "%";
                        break;
                      case "cpa":
                        currentValue = String(aggregated.cpa || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "cpl":
                        currentValue = String(aggregated.cpl || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "er":
                        currentValue = String(aggregated.er || 0);
                        unit = "%";
                        break;
                      case "roi":
                        currentValue = String(aggregated.roi || 0);
                        unit = "%";
                        break;
                      case "roas":
                        currentValue = String(aggregated.roas || 0);
                        unit = "x";
                        break;
                      case "totalRevenue":
                        currentValue = String(aggregated.totalRevenue || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "profit":
                        currentValue = String(aggregated.profit || 0);
                        unit = campaignCurrencySymbol;
                        break;
                      case "profitMargin":
                        currentValue = String(aggregated.profitMargin || 0);
                        unit = "%";
                        break;
                      case "revenuePerLead":
                        currentValue = String(aggregated.revenuePerLead || 0);
                        unit = campaignCurrencySymbol;
                        break;
                    }

                    setKpiForm((prev: any) => ({ ...prev, applyTo: value, specificCampaignId: "", currentValue, unit }));
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
                  value={kpiForm.specificCampaignId}
                  onValueChange={(value) => {
                    setKpiForm({ ...kpiForm, specificCampaignId: value });

                    if (kpiForm.metric) {
                      const { metrics: rawMetrics } = (sessionData as any) || {};
                      let campaignData = null;

                      if (rawMetrics && Array.isArray(rawMetrics)) {
                        const campaignMetrics: any = {};
                        rawMetrics.forEach((m: any) => {
                          if (m.campaignName === value) {
                            campaignMetrics[m.metricKey] = parseFloat(m.metricValue || 0);
                          }
                        });

                        if (Object.keys(campaignMetrics).length > 0) {
                          const imp = campaignMetrics.impressions || 0;
                          const clk = campaignMetrics.clicks || 0;
                          const spd = campaignMetrics.spend || 0;
                          const conv = campaignMetrics.conversions || 0;
                          const lds = campaignMetrics.leads || 0;
                          const eng = campaignMetrics.engagements || 0;

                          campaignData = {
                            impressions: imp,
                            clicks: clk,
                            spend: spd,
                            conversions: conv,
                            leads: lds,
                            engagements: eng,
                            reach: campaignMetrics.reach || 0,
                            videoViews: campaignMetrics.videoViews || 0,
                            viralImpressions: campaignMetrics.viralImpressions || 0,
                            ctr: imp > 0 ? (clk / imp) * 100 : 0,
                            cpc: clk > 0 ? spd / clk : 0,
                            cpm: imp > 0 ? (spd / imp) * 1000 : 0,
                            cvr: clk > 0 ? (conv / clk) * 100 : 0,
                            cpa: conv > 0 ? spd / conv : 0,
                            cpl: lds > 0 ? spd / lds : 0,
                            er: imp > 0 ? (eng / imp) * 100 : 0,
                          };
                        }
                      }

                      if (campaignData) {
                        let currentValue = "";
                        let unit = kpiForm.unit || "";
                        const conversions = campaignData.conversions || 0;
                        const leads = campaignData.leads || 0;
                        const spend = campaignData.spend || 0;

                        switch (kpiForm.metric) {
                          case "impressions":
                            currentValue = String(campaignData.impressions || 0);
                            break;
                          case "reach":
                            currentValue = String(campaignData.reach || 0);
                            break;
                          case "clicks":
                            currentValue = String(campaignData.clicks || 0);
                            break;
                          case "engagements":
                            currentValue = String(campaignData.engagements || 0);
                            break;
                          case "spend":
                            currentValue = String(spend);
                            unit = campaignCurrencySymbol;
                            break;
                          case "conversions":
                            currentValue = String(conversions);
                            break;
                          case "leads":
                            currentValue = String(leads);
                            break;
                          case "videoViews":
                            currentValue = String(campaignData.videoViews || 0);
                            break;
                          case "viralImpressions":
                            currentValue = String(campaignData.viralImpressions || 0);
                            break;
                          case "ctr":
                            currentValue = String(campaignData.ctr || 0);
                            unit = "%";
                            break;
                          case "cpc":
                            currentValue = String(campaignData.cpc || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cpm":
                            currentValue = String(campaignData.cpm || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cvr":
                            currentValue = String(campaignData.cvr || 0);
                            unit = "%";
                            break;
                          case "cpa":
                            currentValue = String(campaignData.cpa || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "cpl":
                            currentValue = String(campaignData.cpl || 0);
                            unit = campaignCurrencySymbol;
                            break;
                          case "er":
                            currentValue = String(campaignData.er || 0);
                            unit = "%";
                            break;
                          case "roi":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = spend > 0 ? String(((revenue - spend) / spend) * 100) : "0";
                              unit = "%";
                            }
                            break;
                          case "roas":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = spend > 0 ? String(revenue / spend) : "0";
                              unit = "x";
                            }
                            break;
                          case "totalRevenue":
                            if (aggregated?.hasRevenueTracking) {
                              currentValue = String(conversions * (aggregated.conversionValue || 0));
                              unit = campaignCurrencySymbol;
                            }
                            break;
                          case "profit":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = String(revenue - spend);
                              unit = campaignCurrencySymbol;
                            }
                            break;
                          case "profitMargin":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = revenue > 0 ? String(((revenue - spend) / revenue) * 100) : "0";
                              unit = "%";
                            }
                            break;
                          case "revenuePerLead":
                            if (aggregated?.hasRevenueTracking) {
                              const revenue = conversions * (aggregated.conversionValue || 0);
                              currentValue = leads > 0 ? String(revenue / leads) : "0";
                              unit = campaignCurrencySymbol;
                            }
                            break;
                        }

                        setKpiForm((prev: any) => ({ ...prev, specificCampaignId: value, currentValue, unit }));
                      }
                    }
                  }}
                >
                  <SelectTrigger id="kpi-campaign">
                    <SelectValue placeholder="Choose a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCampaigns.map((campaign: any) => (
                      <SelectItem key={campaign.id} value={campaign.linkedInCampaignName}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">KPI will track metrics for this campaign only</p>
              </div>
            )}
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
                      Controls how often you’re notified while the alert condition stays true.
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
            <Button onClick={handleCreateKPI} className="bg-purple-600 hover:bg-purple-700" data-testid="button-create-kpi">
              {editingKPI ? "Update KPI" : "Create KPI"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


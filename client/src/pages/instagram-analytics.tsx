import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, AlertTriangle, CheckCircle2, Loader2, Eye, MousePointer, DollarSign, Target, BarChart3, Percent, Video, Plus, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";

const INSTAGRAM_KPI_METRICS = [
  { key: "impressions", label: "Impressions", unit: "" },
  { key: "clicks", label: "Clicks", unit: "" },
  { key: "spend", label: "Spend", unit: "$" },
  { key: "conversions", label: "Conversions", unit: "" },
  { key: "videoViews", label: "Video Views", unit: "" },
  { key: "ctr", label: "CTR", unit: "%" },
  { key: "cpc", label: "CPC", unit: "$" },
  { key: "cpm", label: "CPM", unit: "$" },
  { key: "costPerConversion", label: "Cost per Conversion", unit: "$" },
  { key: "conversionRate", label: "Conversion Rate", unit: "%" },
  { key: "totalRevenue", label: "Total Revenue", unit: "$" },
  { key: "roas", label: "ROAS", unit: "ratio" },
  { key: "roi", label: "ROI", unit: "%" },
  { key: "profit", label: "Profit", unit: "$" },
];

const LOWER_IS_BETTER_KPIS = new Set(["cpc", "cpm", "costPerConversion"]);
const KPI_DESC_MAX = 200;

function getInstagramKpiMetric(metricKey: string) {
  return INSTAGRAM_KPI_METRICS.find((metric) => metric.key === metricKey) || INSTAGRAM_KPI_METRICS[0];
}

function formatInstagramKpiValue(metricKey: string, rawValue: any) {
  const value = Number(rawValue || 0);
  const unit = getInstagramKpiMetric(metricKey).unit;
  if (unit === "$") return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "ratio") return value.toFixed(2);
  return value.toLocaleString();
}

function formatInstagramMetricInputValue(metricKey: string, rawValue: number | null) {
  if (rawValue === null || rawValue === undefined) return "";
  const value = Number(rawValue || 0);
  if (!Number.isFinite(value)) return "";
  return ["roas", "roi"].includes(String(metricKey || "").toLowerCase()) ? value.toFixed(2) : String(value);
}

function stripNumberFormatting(value: string) {
  return String(value || "").replace(/,/g, "");
}

function formatNumericInput(value: string) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = cleaned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length > 0 ? `${integer || "0"}.${decimal}` : integer;
}

function formatPctValue(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(2)}%`;
}

function getInstagramKpiProgress(kpi: any) {
  const metricKey = String(kpi?.metric || "");
  const current = Number(kpi?.currentValue || 0);
  const target = Number(kpi?.targetValue || 0);
  if (target <= 0) return { pct: 0, status: "blocked" };
  const pct = LOWER_IS_BETTER_KPIS.has(metricKey)
    ? target > 0 ? (target / Math.max(current, 0.000001)) * 100 : 0
    : (current / target) * 100;
  const boundedPct = Math.max(0, Math.min(100, pct));
  const status = pct >= 95 ? "above" : pct >= 70 ? "near" : "below";
  return { pct: boundedPct, status };
}

function getInstagramBenchmarkProgress(benchmark: any) {
  const metricKey = String(benchmark?.metric || "");
  const current = Number(benchmark?.currentValue || 0);
  const target = Number(benchmark?.benchmarkValue || benchmark?.targetValue || 0);
  if (target <= 0) return { pct: 0, status: "blocked" };
  const pct = LOWER_IS_BETTER_KPIS.has(metricKey)
    ? target > 0 ? (target / Math.max(current, 0.000001)) * 100 : 0
    : (current / target) * 100;
  const boundedPct = Math.max(0, Math.min(100, pct));
  const status = pct >= 90 ? "onTrack" : pct >= 70 ? "needsAttention" : "behind";
  return { pct: boundedPct, status };
}

export default function InstagramAnalytics() {
  const [, params] = useRoute("/campaigns/:id/instagram-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<any>(null);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [isRevenueWizardOpen, setIsRevenueWizardOpen] = useState(false);
  const [revenueWizardInitialSource, setRevenueWizardInitialSource] = useState<any>(null);
  const [showRevenueSourcesDialog, setShowRevenueSourcesDialog] = useState(false);
  const [deletingRevenueSourceId, setDeletingRevenueSourceId] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({
    name: "",
    metric: "",
    currentValue: "",
    targetValue: "",
    unit: "",
    description: "",
    priority: "medium",
    trackingPeriod: "30",
    alertsEnabled: false,
    alertThreshold: "",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
    emailRecipients: "",
  });
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: "",
    metric: "",
    currentValue: "",
    benchmarkValue: "",
    unit: "",
    description: "",
    industry: "",
    alertsEnabled: false,
    alertThreshold: "",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
    emailRecipients: "",
  });

  const { data: connection, isLoading, error } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/connection`],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/connection`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram connection");
      }
      return response.json();
    },
  });

  const connected = connection?.connected === true && Array.isArray(connection?.selectedCampaignIds) && connection.selectedCampaignIds.length > 0;
  const showConnectionError = !isLoading && !!error;
  const showDisconnectedState = !isLoading && !error && !connected;
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/daily-metrics`, "30days"],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/daily-metrics?dateRange=30days`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram metrics");
      }
      return response.json();
    },
  });
  const { data: kpis = [], isLoading: kpisLoading, error: kpisError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/kpis", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/kpis?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram KPIs");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const { data: benchmarks = [], isLoading: benchmarksLoading, error: benchmarksError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/benchmarks", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram Benchmarks");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/reports", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/reports?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram Reports");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const { data: instagramRevenueSourcesData } = useQuery<{ success: boolean; sources: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "revenue-sources", "instagram"],
    enabled: !!campaignId && connected,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=instagram`);
      if (!response.ok) return { success: false, sources: [] };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, sources: Array.isArray(json?.sources) ? json.sources : [] };
    },
  });
  const { data: instagramRevenueTotalsData } = useQuery<{ success: boolean; totalRevenue: number }>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=instagram&dateRange=90days`],
    enabled: !!campaignId && connected,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-totals?platformContext=instagram&dateRange=90days`);
      if (!response.ok) return { success: false, totalRevenue: 0 };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, totalRevenue: Number(json?.totalRevenue || 0) };
    },
  });
  const { data: hubspotPipelineProxyData } = useQuery<any>({
    queryKey: ["/api/hubspot", campaignId, "pipeline-proxy", "instagram"],
    enabled: !!campaignId && connected,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/hubspot/${encodeURIComponent(String(campaignId))}/pipeline-proxy?platformContext=instagram`);
      if (!response.ok) return null;
      return response.json().catch(() => null);
    },
  });
  const { data: salesforcePipelineProxyData } = useQuery<any>({
    queryKey: ["/api/salesforce", campaignId, "pipeline-proxy", "instagram"],
    enabled: !!campaignId && connected,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/salesforce/${encodeURIComponent(String(campaignId))}/pipeline-proxy?platformContext=instagram`);
      if (!response.ok) return null;
      return response.json().catch(() => null);
    },
  });
  const activeInstagramRevenueSources = useMemo(() => {
    const sources = Array.isArray(instagramRevenueSourcesData?.sources) ? instagramRevenueSourcesData.sources : [];
    return sources.filter((source: any) => source?.isActive !== false);
  }, [instagramRevenueSourcesData]);
  const overviewTotals = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const totals = rows.reduce((acc: any, row: any) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.spend += Number(row.spend || 0);
      acc.conversions += Number(row.conversions || 0);
      acc.videoViews += Number(row.videoViews || 0);
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0 });
    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
      costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : null,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : null,
    };
  }, [dailyMetrics]);
  const hasInstagramAttributedRevenue = activeInstagramRevenueSources.length > 0;
  const instagramAttributedRevenueFromSources = activeInstagramRevenueSources.reduce(
    (sum: number, source: any) => sum + Number(source?.lastTotalRevenue || 0),
    0
  );
  const instagramAttributedRevenue = instagramAttributedRevenueFromSources > 0
    ? instagramAttributedRevenueFromSources
    : Number(instagramRevenueTotalsData?.totalRevenue || 0);
  const instagramAttributedProfit = instagramAttributedRevenue - overviewTotals.spend;
  const instagramAttributedRoas = overviewTotals.spend > 0 ? instagramAttributedRevenue / overviewTotals.spend : 0;
  const instagramAttributedRoi = overviewTotals.spend > 0 ? ((instagramAttributedRevenue - overviewTotals.spend) / overviewTotals.spend) * 100 : 0;
  const pipelineProxyData = hubspotPipelineProxyData?.success ? hubspotPipelineProxyData : salesforcePipelineProxyData?.success ? salesforcePipelineProxyData : null;
  const instagramComparisonRows = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const grouped = new Map<string, any>();
    rows.forEach((row: any) => {
      const id = String(row.instagramCampaignId || "").trim();
      if (!id) return;
      const existing = grouped.get(id) || {
        id,
        name: String(row.instagramCampaignName || id),
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        videoViews: 0,
      };
      existing.impressions += Number(row.impressions || 0);
      existing.clicks += Number(row.clicks || 0);
      existing.spend += Number(row.spend || 0);
      existing.conversions += Number(row.conversions || 0);
      existing.videoViews += Number(row.videoViews || 0);
      grouped.set(id, existing);
    });
    return Array.from(grouped.values())
      .map((row: any) => ({
        ...row,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        costPerConversion: row.conversions > 0 ? row.spend / row.conversions : null,
        conversionRate: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : null,
      }))
      .sort((a: any, b: any) => b.spend - a.spend);
  }, [dailyMetrics]);
  const instagramComparisonChartRows = useMemo(() => instagramComparisonRows.map((row: any) => ({
    name: String(row.name || row.id).slice(0, 18),
    spend: Number(row.spend || 0),
    conversions: Number(row.conversions || 0),
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0),
    costPerConversion: Number(row.costPerConversion || 0),
  })), [instagramComparisonRows]);
  const instagramComparisonLeaders = useMemo(() => ({
    highestSpend: instagramComparisonRows[0],
    bestCtr: [...instagramComparisonRows].filter((row: any) => row.ctr !== null).sort((a: any, b: any) => Number(b.ctr || 0) - Number(a.ctr || 0))[0],
    lowestCpc: [...instagramComparisonRows].filter((row: any) => row.cpc !== null).sort((a: any, b: any) => Number(a.cpc || 0) - Number(b.cpc || 0))[0],
  }), [instagramComparisonRows]);
  const instagramInsightTrendRows = useMemo(() => {
    const grouped = new Map<string, any>();
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    rows.forEach((row: any) => {
      const date = String(row.date || "").slice(0, 10);
      if (!date) return;
      const existing = grouped.get(date) || { date, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      existing.impressions += Number(row.impressions || 0);
      existing.clicks += Number(row.clicks || 0);
      existing.spend += Number(row.spend || 0);
      existing.conversions += Number(row.conversions || 0);
      grouped.set(date, existing);
    });
    return Array.from(grouped.values())
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
      .map((row: any) => ({
        ...row,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
        conversionRate: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
      }));
  }, [dailyMetrics]);
  const instagramInsights = useMemo(() => {
    const insights: Array<{ title: string; severity: "high" | "medium" | "positive"; description: string; recommendation: string }> = [];
    const ctr = overviewTotals.ctr;
    const cpc = overviewTotals.cpc;
    const conversionRate = overviewTotals.conversionRate;
    const costPerConversion = overviewTotals.costPerConversion;
    if (instagramInsightTrendRows.length < 7) {
      insights.push({
        title: "Limited trend history",
        severity: "medium",
        description: `${instagramInsightTrendRows.length} day(s) of selected Instagram history are available.`,
        recommendation: "Use current performance directionally until at least 7 days of source-backed history are available.",
      });
    }
    if (ctr !== null && ctr < 1) {
      insights.push({
        title: "Low click-through rate",
        severity: "high",
        description: `Instagram CTR is ${formatPctValue(ctr)} across selected campaign rows.`,
        recommendation: "Review creative hooks, first-frame clarity, audience fit, and placement-specific messaging.",
      });
    } else if (ctr !== null && ctr >= 3) {
      insights.push({
        title: "Strong engagement signal",
        severity: "positive",
        description: `Instagram CTR is ${formatPctValue(ctr)}, indicating strong click engagement.`,
        recommendation: "Compare high-CTR campaign creative against lower performers and reuse the strongest messaging patterns.",
      });
    }
    if (cpc !== null && cpc > 2) {
      insights.push({
        title: "High CPC pressure",
        severity: "medium",
        description: `Instagram CPC is $${cpc.toFixed(2)} across selected campaign rows.`,
        recommendation: "Check audience overlap, bid settings, and creative fatigue before scaling spend.",
      });
    }
    if (conversionRate !== null && conversionRate < 2 && overviewTotals.clicks > 0) {
      insights.push({
        title: "Post-click conversion weakness",
        severity: "high",
        description: `Conversion rate is ${formatPctValue(conversionRate)} from ${overviewTotals.clicks.toLocaleString()} clicks.`,
        recommendation: "Audit landing-page continuity, offer clarity, load speed, and conversion tracking.",
      });
    }
    if (costPerConversion !== null && overviewTotals.conversions > 0) {
      insights.push({
        title: "Cost per conversion baseline",
        severity: "positive",
        description: `Current Instagram cost per conversion is $${costPerConversion.toFixed(2)}.`,
        recommendation: "Use this as the benchmark for KPI targets and campaign-level optimization decisions.",
      });
    }
    if (hasInstagramAttributedRevenue) {
      insights.push({
        title: instagramAttributedProfit >= 0 ? "Revenue efficiency available" : "Revenue efficiency risk",
        severity: instagramAttributedProfit >= 0 ? "positive" : "high",
        description: `Instagram ROAS is ${instagramAttributedRoas.toFixed(2)}x and ROI is ${instagramAttributedRoi.toFixed(1)}%.`,
        recommendation: "Use Instagram revenue-derived KPIs and Benchmarks to monitor budget-return performance against targets.",
      });
    } else {
      insights.push({
        title: "Revenue attribution required",
        severity: "medium",
        description: "Instagram revenue, ROAS, ROI, and profit are unavailable until an Instagram-scoped revenue source is imported.",
        recommendation: "Use delivery metrics for media diagnostics, then add source-backed Instagram revenue before making budget-return decisions.",
      });
    }
    return insights.length > 0 ? insights : [{
      title: "No major issues detected",
      severity: "positive",
      description: "Selected Instagram source-backed rows do not show obvious CTR, CPC, or conversion-rate risks.",
      recommendation: "Continue monitoring trends as more source-backed history accumulates.",
    }];
  }, [hasInstagramAttributedRevenue, instagramAttributedProfit, instagramAttributedRoas, instagramAttributedRoi, instagramInsightTrendRows.length, overviewTotals]);
  const instagramMissingInsightInputs = useMemo(() => [
    ...(!hasInstagramAttributedRevenue ? ["Instagram-attributed revenue for Total Revenue, ROAS, ROI, and profit."] : []),
    "Ad or creative-level rows for winner/loser creative diagnostics.",
    "Audience, placement, and device breakdowns for budget allocation guidance.",
    "At least 14 days of daily history for reliable short-term trend comparison.",
  ], [hasInstagramAttributedRevenue]);
  const latestImportedAt = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const latest = rows
      .map((row: any) => row.importedAt ? new Date(row.importedAt).getTime() : 0)
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .sort((a: number, b: number) => b - a)[0];
    return latest ? new Date(latest).toLocaleString() : null;
  }, [dailyMetrics]);
  const hasRows = connected && Array.isArray(dailyMetrics?.rows) && dailyMetrics.rows.length > 0;
  const kpiTracker = useMemo(() => {
    const rows = Array.isArray(kpis) ? kpis : [];
    const scored = rows.map(getInstagramKpiProgress).filter((item) => item.status !== "blocked");
    return {
      total: rows.length,
      above: scored.filter((item) => item.status === "above").length,
      near: scored.filter((item) => item.status === "near").length,
      below: scored.filter((item) => item.status === "below").length,
      avgPct: scored.length > 0 ? scored.reduce((sum, item) => sum + item.pct, 0) / scored.length : 0,
    };
  }, [kpis]);
  const currentByMetric = useMemo<Record<string, number | null>>(() => ({
    impressions: overviewTotals.impressions,
    clicks: overviewTotals.clicks,
    spend: overviewTotals.spend,
    conversions: overviewTotals.conversions,
    videoViews: overviewTotals.videoViews,
    ctr: overviewTotals.ctr,
    cpc: overviewTotals.cpc,
    cpm: overviewTotals.cpm,
    costPerConversion: overviewTotals.costPerConversion,
    conversionRate: overviewTotals.conversionRate,
    totalRevenue: hasInstagramAttributedRevenue ? instagramAttributedRevenue : null,
    roas: hasInstagramAttributedRevenue && overviewTotals.spend > 0 ? instagramAttributedRoas : null,
    roi: hasInstagramAttributedRevenue && overviewTotals.spend > 0 ? instagramAttributedRoi : null,
    profit: hasInstagramAttributedRevenue ? instagramAttributedProfit : null,
  }), [hasInstagramAttributedRevenue, instagramAttributedProfit, instagramAttributedRevenue, instagramAttributedRoas, instagramAttributedRoi, overviewTotals]);
  const benchmarkTracker = useMemo(() => {
    const rows = Array.isArray(benchmarks) ? benchmarks : [];
    const scored = rows.map(getInstagramBenchmarkProgress).filter((item) => item.status !== "blocked");
    return {
      total: rows.length,
      onTrack: scored.filter((item) => item.status === "onTrack").length,
      needsAttention: scored.filter((item) => item.status === "needsAttention").length,
      behind: scored.filter((item) => item.status === "behind").length,
      avgPct: scored.length > 0 ? scored.reduce((sum, item) => sum + item.pct, 0) / scored.length : 0,
    };
  }, [benchmarks]);
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const parseRevenueSourceConfig = (source: any): any => {
    try {
      return source?.mappingConfig
        ? (typeof source.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source.mappingConfig)
        : {};
    } catch {
      return {};
    }
  };
  const revenueSourceTypeLabel = (type: any) => {
    const map: Record<string, string> = {
      csv: "CSV",
      google_sheets: "Google Sheets",
      hubspot: "HubSpot",
      salesforce: "Salesforce",
      shopify: "Shopify",
      manual: "Manual",
      connector_derived: "Imported",
    };
    return map[String(type || "").trim().toLowerCase()] || "Imported";
  };
  const instagramRevenueSourceLabel = (source: any) => {
    const displayName = String(source?.displayName || "").trim();
    return displayName || revenueSourceTypeLabel(source?.sourceType);
  };
  const openInstagramRevenueModal = (source?: any) => {
    setRevenueWizardInitialSource(source || null);
    setIsRevenueWizardOpen(true);
  };
  const resetKpiForm = (kpi?: any) => {
    const metric = String(kpi?.metric || "");
    const metricDef = getInstagramKpiMetric(metric);
    setEditingKpi(kpi || null);
    setKpiForm({
      name: String(kpi?.name || ""),
      metric,
      currentValue: String(kpi?.currentValue || ""),
      targetValue: formatNumericInput(String(kpi?.targetValue || "")),
      unit: String(kpi?.unit || metricDef.unit || ""),
      description: String(kpi?.description || ""),
      priority: String(kpi?.priority || "medium"),
      trackingPeriod: String(kpi?.trackingPeriod || "30"),
      alertsEnabled: !!kpi?.alertsEnabled,
      alertThreshold: String(kpi?.alertThreshold || ""),
      alertCondition: String(kpi?.alertCondition || "below"),
      alertFrequency: String(kpi?.alertFrequency || "daily"),
      emailNotifications: !!kpi?.emailNotifications,
      emailRecipients: String(kpi?.emailRecipients || ""),
    });
  };
  const applyKpiTemplate = (metricKey: string) => {
    const metricDef = getInstagramKpiMetric(metricKey);
    setKpiForm((form) => ({
      ...form,
      name: metricDef.label,
      metric: metricDef.key,
      unit: metricDef.unit,
      description: `Track Instagram ${metricDef.label.toLowerCase()} against target.`,
      currentValue: formatInstagramMetricInputValue(metricDef.key, currentByMetric[metricDef.key]),
      targetValue: "",
    }));
  };
  const resetBenchmarkForm = (benchmark?: any) => {
    const metric = String(benchmark?.metric || "");
    const metricDef = getInstagramKpiMetric(metric);
    setEditingBenchmark(benchmark || null);
    setBenchmarkForm({
      name: String(benchmark?.name || ""),
      metric,
      currentValue: String(benchmark?.currentValue || ""),
      benchmarkValue: formatNumericInput(String(benchmark?.benchmarkValue || benchmark?.targetValue || "")),
      unit: String(benchmark?.unit || metricDef.unit || ""),
      description: String(benchmark?.description || ""),
      industry: String(benchmark?.industry || ""),
      alertsEnabled: !!benchmark?.alertsEnabled,
      alertThreshold: String(benchmark?.alertThreshold || ""),
      alertCondition: String(benchmark?.alertCondition || "below"),
      alertFrequency: String(benchmark?.alertFrequency || "daily"),
      emailNotifications: !!benchmark?.emailNotifications,
      emailRecipients: String(benchmark?.emailRecipients || ""),
    });
  };
  const applyBenchmarkTemplate = (metricKey: string) => {
    const metricDef = getInstagramKpiMetric(metricKey);
    setBenchmarkForm((form) => ({
      ...form,
      name: metricDef.label,
      metric: metricDef.key,
      unit: metricDef.unit,
      description: `Compare Instagram ${metricDef.label.toLowerCase()} against benchmark targets.`,
      currentValue: formatInstagramMetricInputValue(metricDef.key, currentByMetric[metricDef.key]),
      benchmarkValue: "",
    }));
  };
  const saveKpiMutation = useMutation({
    mutationFn: async () => {
      const metricDef = getInstagramKpiMetric(kpiForm.metric);
      const payload = {
        campaignId,
        name: kpiForm.name || metricDef.label,
        metric: kpiForm.metric || "",
        targetValue: stripNumberFormatting(kpiForm.targetValue) || "0",
        currentValue: stripNumberFormatting(kpiForm.currentValue) || "0",
        unit: kpiForm.unit || metricDef.unit,
        description: kpiForm.description,
        priority: kpiForm.priority,
        status: "active",
        category: "performance",
        timeframe: "monthly",
        trackingPeriod: Number(kpiForm.trackingPeriod || 30),
        applyTo: "all",
        alertsEnabled: kpiForm.alertsEnabled,
        alertThreshold: kpiForm.alertsEnabled && kpiForm.alertThreshold ? kpiForm.alertThreshold : null,
        alertCondition: kpiForm.alertCondition,
        alertFrequency: kpiForm.alertFrequency,
        emailNotifications: kpiForm.emailNotifications,
        emailRecipients: kpiForm.emailNotifications ? kpiForm.emailRecipients : null,
      };
      const response = await fetch(editingKpi ? `/api/platforms/instagram/kpis/${editingKpi.id}` : "/api/platforms/instagram/kpis", {
        method: editingKpi ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to save Instagram KPI");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/kpis", campaignId] });
      setKpiDialogOpen(false);
      resetKpiForm();
      toast({ title: editingKpi ? "KPI updated" : "KPI created" });
    },
    onError: (mutationError: any) => {
      toast({ title: "Failed to save KPI", description: mutationError?.message || "Check the KPI values and try again.", variant: "destructive" });
    },
  });
  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: string | number) => {
      const response = await fetch(`/api/platforms/instagram/kpis/${kpiId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to delete Instagram KPI");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/kpis", campaignId] });
      toast({ title: "KPI deleted" });
    },
    onError: (mutationError: any) => {
      toast({ title: "Failed to delete KPI", description: mutationError?.message || "Try again.", variant: "destructive" });
    },
  });
  const saveBenchmarkMutation = useMutation({
    mutationFn: async () => {
      const metricDef = getInstagramKpiMetric(benchmarkForm.metric);
      const payload = {
        campaignId,
        name: benchmarkForm.name || metricDef.label,
        metric: benchmarkForm.metric || "",
        benchmarkValue: stripNumberFormatting(benchmarkForm.benchmarkValue) || "0",
        targetValue: stripNumberFormatting(benchmarkForm.benchmarkValue) || "0",
        currentValue: stripNumberFormatting(benchmarkForm.currentValue) || "0",
        unit: benchmarkForm.unit || metricDef.unit,
        description: benchmarkForm.description,
        industry: benchmarkForm.industry,
        benchmarkType: "custom",
        status: "active",
        category: "performance",
        alertsEnabled: benchmarkForm.alertsEnabled,
        alertThreshold: benchmarkForm.alertsEnabled && benchmarkForm.alertThreshold ? benchmarkForm.alertThreshold : null,
        alertCondition: benchmarkForm.alertCondition,
        alertFrequency: benchmarkForm.alertFrequency,
        emailNotifications: benchmarkForm.emailNotifications,
        emailRecipients: benchmarkForm.emailNotifications ? benchmarkForm.emailRecipients : null,
      };
      const response = await fetch(editingBenchmark ? `/api/platforms/instagram/benchmarks/${editingBenchmark.id}` : "/api/platforms/instagram/benchmarks", {
        method: editingBenchmark ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to save Instagram Benchmark");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/benchmarks", campaignId] });
      setBenchmarkDialogOpen(false);
      resetBenchmarkForm();
      toast({ title: editingBenchmark ? "Benchmark updated" : "Benchmark created" });
    },
    onError: (mutationError: any) => {
      toast({ title: "Failed to save Benchmark", description: mutationError?.message || "Check the Benchmark values and try again.", variant: "destructive" });
    },
  });
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkId: string | number) => {
      const response = await fetch(`/api/platforms/instagram/benchmarks/${benchmarkId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to delete Instagram Benchmark");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/benchmarks", campaignId] });
      toast({ title: "Benchmark deleted" });
    },
    onError: (mutationError: any) => {
      toast({ title: "Failed to delete Benchmark", description: mutationError?.message || "Try again.", variant: "destructive" });
    },
  });
  const deleteInstagramRevenueSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources/${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to remove Instagram revenue source");
      }
      return json;
    },
    onSuccess: async () => {
      setDeletingRevenueSourceId(null);
      toast({ title: "Revenue source removed", description: "Instagram revenue source controls have been refreshed." });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "instagram"], exact: false });
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=instagram&dateRange=90days`], exact: false });
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/kpis", campaignId], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/benchmarks", campaignId], exact: false });
    },
    onError: (mutationError: any) => {
      setDeletingRevenueSourceId(null);
      toast({ title: "Failed to remove revenue source", description: mutationError?.message || "Try again.", variant: "destructive" });
    },
  });
  const renderSimpleRows = (rows: any[], loading: boolean, rowError: unknown, emptyText: string, renderRow: (row: any) => any) => {
    if (rowError) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{(rowError as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (loading) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading Instagram rows...
            </div>
          </CardContent>
        </Card>
      );
    }
    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">{emptyText}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return <div className="space-y-3">{rows.map(renderRow)}</div>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <SiInstagram className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Instagram Ads Analytics</h1>
                <p className="text-muted-foreground">Campaign-scoped Instagram source analytics</p>
              </div>
            </div>

            {isLoading && <div className="min-h-[260px]" aria-hidden="true" />}

            {(showConnectionError || showDisconnectedState) && (
              <Card>
                <CardContent className="p-4">
                  {showConnectionError ? (
                    <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-700 dark:text-red-300">{(error as Error).message}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-muted-foreground">
                        Connect Instagram Ads from the campaign Connected Platforms section before opening Instagram analytics.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!isLoading && connected && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>
                {metricsError && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-red-700 dark:text-red-300">{(metricsError as Error).message}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {latestImportedAt && (
                  <p className="text-xs text-muted-foreground">Latest Instagram row import: {latestImportedAt}</p>
                )}
                <TabsContent value="overview" className="space-y-4">
                  {metricsError ? null : metricsLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : hasRows ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Impressions", value: overviewTotals.impressions.toLocaleString(), Icon: Eye },
                        { label: "Clicks", value: overviewTotals.clicks.toLocaleString(), Icon: MousePointer },
                        { label: "Spend", value: `$${overviewTotals.spend.toFixed(2)}`, Icon: DollarSign },
                        { label: "Conversions", value: overviewTotals.conversions.toLocaleString(), Icon: Target },
                        {
                          label: "Total Revenue",
                          value: hasInstagramAttributedRevenue ? formatCurrency(instagramAttributedRevenue) : "Not connected",
                          Icon: DollarSign,
                          helper: hasInstagramAttributedRevenue ? "Imported Instagram attributed revenue" : "Connect attributed revenue",
                          onAdd: () => openInstagramRevenueModal(),
                          sourceCount: activeInstagramRevenueSources.length,
                        },
                        { label: "ROAS", value: hasInstagramAttributedRevenue && overviewTotals.spend > 0 ? `${instagramAttributedRoas.toFixed(2)}x` : "Unavailable", Icon: TrendingUp, helper: hasInstagramAttributedRevenue ? "Attributed revenue / spend" : "Requires source-backed revenue" },
                        { label: "ROI", value: hasInstagramAttributedRevenue && overviewTotals.spend > 0 ? `${instagramAttributedRoi.toFixed(1)}%` : "Unavailable", Icon: Percent, helper: hasInstagramAttributedRevenue ? "Attributed revenue ROI" : "Requires source-backed revenue" },
                        { label: "Profit", value: hasInstagramAttributedRevenue ? formatCurrency(instagramAttributedProfit) : "Unavailable", Icon: DollarSign, helper: hasInstagramAttributedRevenue ? "Attributed revenue - spend" : "Requires source-backed revenue" },
                        ...(pipelineProxyData?.success ? [{
                          label: "Pipeline Proxy",
                          value: formatCurrency(Number(pipelineProxyData.totalToDate || 0)),
                          Icon: Target,
                          helper: `${pipelineProxyData.pipelineStageLabel || "Selected stage"} open CRM value; not counted in revenue, ROI, or ROAS`,
                        }] : []),
                        { label: "CTR", value: overviewTotals.ctr === null ? "Unavailable" : `${overviewTotals.ctr.toFixed(2)}%`, Icon: Percent },
                        { label: "CPC", value: overviewTotals.cpc === null ? "Unavailable" : `$${overviewTotals.cpc.toFixed(2)}`, Icon: DollarSign },
                        { label: "CPM", value: overviewTotals.cpm === null ? "Unavailable" : `$${overviewTotals.cpm.toFixed(2)}`, Icon: BarChart3 },
                        { label: "Cost / Conversion", value: overviewTotals.costPerConversion === null ? "Unavailable" : `$${overviewTotals.costPerConversion.toFixed(2)}`, Icon: Target },
                        { label: "Conversion Rate", value: overviewTotals.conversionRate === null ? "Unavailable" : `${overviewTotals.conversionRate.toFixed(2)}%`, Icon: Percent },
                        { label: "Video Views", value: overviewTotals.videoViews.toLocaleString(), Icon: Video },
                      ].map(({ label, value, Icon, helper, onAdd, sourceCount }: any) => (
                        <Card key={label}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="text-2xl font-semibold text-foreground">{value}</p>
                                {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
                                {sourceCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowRevenueSourcesDialog(true)}
                                    className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground"
                                  >
                                    Sources ({sourceCount})
                                  </button>
                                )}
                              </div>
                              {onAdd ? (
                                <button
                                  type="button"
                                  onClick={onAdd}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
                                  title="Add Instagram revenue source"
                                  aria-label="Add Instagram revenue source"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              ) : (
                                <Icon className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected source-backed Instagram metric rows are available yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="kpis" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Key Performance Indicators</h2>
                      <p className="text-sm text-muted-foreground mt-1">Track Instagram KPIs and progress toward selected source-backed targets.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        resetKpiForm();
                        setKpiDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create KPI
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total KPIs</p><p className="text-2xl font-bold text-foreground">{kpiTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Above Target</p><p className="text-2xl font-bold text-green-600">{kpiTracker.above}</p><p className="text-xs text-muted-foreground">at least 95% of target</p></div><TrendingUp className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">On Track</p><p className="text-2xl font-bold text-blue-600">{kpiTracker.near}</p><p className="text-xs text-muted-foreground">70-94% of target</p></div><CheckCircle2 className="w-8 h-8 text-blue-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Below Target</p><p className="text-2xl font-bold text-red-600">{kpiTracker.below}</p><p className="text-xs text-muted-foreground">below 70% of target</p></div><AlertCircle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg. Progress</p><p className="text-2xl font-bold text-foreground">{kpiTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
                  </div>

                  {kpisError ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-red-700 dark:text-red-300">{(kpisError as Error).message}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : kpisLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-32 bg-muted rounded"></div>
                      <div className="h-32 bg-muted rounded"></div>
                    </div>
                  ) : kpis.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first KPI to track Instagram performance for this campaign.</p>
                        <Button
                          onClick={() => {
                            resetKpiForm();
                            setKpiDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {kpis.map((kpi: any) => {
                        const metricKey = String(kpi.metric || "impressions");
                        const progress = getInstagramKpiProgress(kpi);
                        const progressColor = progress.status === "above" ? "bg-green-500" : progress.status === "near" ? "bg-blue-500" : "bg-red-500";
                        return (
                          <Card key={kpi.id}>
                            <CardContent className="p-5 space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-foreground">{kpi.name || getInstagramKpiMetric(metricKey).label}</p>
                                  <p className="text-sm text-muted-foreground">{kpi.description || `Track ${getInstagramKpiMetric(metricKey).label} against target`}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      resetKpiForm(kpi);
                                      setKpiDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600 hover:text-red-700"
                                        disabled={deleteKpiMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Delete "{kpi.name || getInstagramKpiMetric(metricKey).label}" from this Instagram campaign?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteKpiMutation.mutate(kpi.id)} className="bg-red-600 hover:bg-red-700">
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Current</p>
                                  <p className="text-xl font-bold text-foreground">{formatInstagramKpiValue(metricKey, kpi.currentValue)}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Target</p>
                                  <p className="text-xl font-bold text-foreground">{formatInstagramKpiValue(metricKey, kpi.targetValue)}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Progress</span>
                                  <span>{progress.pct.toFixed(1)}%</span>
                                </div>
                                <Progress value={progress.pct} className="h-2" indicatorClassName={progressColor} />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="benchmarks" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Performance Benchmarks</h2>
                      <p className="text-sm text-muted-foreground mt-1">Track Instagram performance against selected source-backed targets.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        resetBenchmarkForm();
                        setBenchmarkDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Benchmark
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Benchmarks</p><p className="text-2xl font-bold text-foreground">{benchmarkTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">On Track</p><p className="text-2xl font-bold text-green-600">{benchmarkTracker.onTrack}</p><p className="text-xs text-muted-foreground">90% or more of benchmark</p></div><CheckCircle2 className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Needs Attention</p><p className="text-2xl font-bold text-amber-600">{benchmarkTracker.needsAttention}</p><p className="text-xs text-muted-foreground">70% to under 90% of benchmark</p></div><AlertCircle className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Behind</p><p className="text-2xl font-bold text-red-600">{benchmarkTracker.behind}</p><p className="text-xs text-muted-foreground">below 70% of benchmark</p></div><AlertTriangle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg. Progress</p><p className="text-2xl font-bold text-foreground">{benchmarkTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
                  </div>

                  {benchmarksError ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-red-700 dark:text-red-300">{(benchmarksError as Error).message}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : benchmarksLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : Array.isArray(benchmarks) && benchmarks.length > 0 ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {benchmarks.map((benchmark: any) => {
                        const metricKey = String(benchmark.metric || "");
                        const metricDef = getInstagramKpiMetric(metricKey);
                        const progress = getInstagramBenchmarkProgress(benchmark);
                        const progressColor = progress.status === "onTrack" ? "bg-green-500" : progress.status === "needsAttention" ? "bg-amber-500" : "bg-red-500";
                        return (
                          <Card key={benchmark.id}>
                            <CardContent className="p-6 space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-semibold text-foreground">{benchmark.name || metricDef.label}</h3>
                                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{metricDef.label}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{benchmark.description || `Benchmark Instagram ${metricDef.label.toLowerCase()} against selected source-backed performance.`}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { resetBenchmarkForm(benchmark); setBenchmarkDialogOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                        <AlertDialogDescription>Delete "{benchmark.name || metricDef.label}"? This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Current</p>
                                  <p className="text-xl font-bold text-foreground">{formatInstagramKpiValue(metricKey, benchmark.currentValue)}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Benchmark</p>
                                  <p className="text-xl font-bold text-foreground">{formatInstagramKpiValue(metricKey, benchmark.benchmarkValue || benchmark.targetValue)}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Progress</span>
                                  <span>{progress.pct.toFixed(1)}%</span>
                                </div>
                                <Progress value={progress.pct} className="h-2" indicatorClassName={progressColor} />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-10 text-center">
                        <TrendingUp className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No Benchmarks Yet</h3>
                        <p className="text-sm text-muted-foreground">Create your first benchmark to start tracking Instagram performance against selected source-backed targets.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="ads" className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Campaign Comparison</h2>
                    <p className="text-sm text-muted-foreground mt-1">Compare selected source-backed Instagram campaigns.</p>
                  </div>
                  {metricsError ? null : metricsLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : instagramComparisonRows.length > 0 ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Selected Campaigns</p><p className="text-2xl font-bold text-foreground">{instagramComparisonRows.length}</p></CardContent></Card>
                        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Highest Spend</p><p className="text-xl font-bold text-foreground">{instagramComparisonLeaders.highestSpend?.name || "Unavailable"}</p><p className="text-xs text-muted-foreground">${Number(instagramComparisonLeaders.highestSpend?.spend || 0).toFixed(2)}</p></CardContent></Card>
                        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Best CTR</p><p className="text-xl font-bold text-foreground">{instagramComparisonLeaders.bestCtr?.name || "Unavailable"}</p><p className="text-xs text-muted-foreground">{Number(instagramComparisonLeaders.bestCtr?.ctr || 0).toFixed(2)}%</p></CardContent></Card>
                        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Lowest CPC</p><p className="text-xl font-bold text-foreground">{instagramComparisonLeaders.lowestCpc?.name || "Unavailable"}</p><p className="text-xs text-muted-foreground">${Number(instagramComparisonLeaders.lowestCpc?.cpc || 0).toFixed(2)}</p></CardContent></Card>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardContent className="p-5">
                            <h3 className="text-lg font-semibold text-foreground mb-4">Spend vs Conversions</h3>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={instagramComparisonChartRows}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis yAxisId="left" />
                                  <YAxis yAxisId="right" orientation="right" />
                                  <Tooltip />
                                  <Legend />
                                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#f97316" />
                                  <Bar yAxisId="right" dataKey="conversions" name="Conversions" fill="#2563eb" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <h3 className="text-lg font-semibold text-foreground mb-4">Efficiency: CTR vs CPC</h3>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={instagramComparisonChartRows}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis yAxisId="left" />
                                  <YAxis yAxisId="right" orientation="right" />
                                  <Tooltip />
                                  <Legend />
                                  <Bar yAxisId="left" dataKey="ctr" name="CTR %" fill="#16a34a" />
                                  <Bar yAxisId="right" dataKey="cpc" name="CPC $" fill="#7c3aed" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="w-full text-sm">
                          <thead className="bg-muted text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Campaign</th>
                              <th className="px-4 py-3 text-right font-medium">Spend</th>
                              <th className="px-4 py-3 text-right font-medium">Conversions</th>
                              <th className="px-4 py-3 text-right font-medium">CTR</th>
                              <th className="px-4 py-3 text-right font-medium">CPC</th>
                              <th className="px-4 py-3 text-right font-medium">Cost / Conv.</th>
                              <th className="px-4 py-3 text-right font-medium">Video Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instagramComparisonRows.map((row: any) => (
                              <tr key={row.id} className="border-t border-border">
                                <td className="px-4 py-3"><p className="font-medium text-foreground">{row.name}</p><p className="text-xs text-muted-foreground">{row.id}</p></td>
                                <td className="px-4 py-3 text-right">${row.spend.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right">{row.conversions.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{row.ctr === null ? "Unavailable" : `${row.ctr.toFixed(2)}%`}</td>
                                <td className="px-4 py-3 text-right">{row.cpc === null ? "Unavailable" : `$${row.cpc.toFixed(2)}`}</td>
                                <td className="px-4 py-3 text-right">{row.costPerConversion === null ? "Unavailable" : `$${row.costPerConversion.toFixed(2)}`}</td>
                                <td className="px-4 py-3 text-right">{row.videoViews.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected source-backed Instagram campaign comparison rows are available yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="insights" className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Insights</h2>
                    <p className="text-sm text-muted-foreground mt-1">Actionable Instagram insights from selected source-backed daily rows.</p>
                  </div>
                  {metricsError ? null : metricsLoading ? (
                    <div className="min-h-[220px]" aria-hidden="true" />
                  ) : hasRows ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Insights</p><p className="text-2xl font-bold text-foreground">{instagramInsights.length}</p></CardContent></Card>
                        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">High Priority</p><p className="text-2xl font-bold text-red-600">{instagramInsights.filter((insight) => insight.severity === "high").length}</p></CardContent></Card>
                        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Trend Days</p><p className="text-2xl font-bold text-foreground">{instagramInsightTrendRows.length}</p></CardContent></Card>
                      </div>

                      {instagramMissingInsightInputs.length > 0 && (
                        <Card>
                          <CardContent className="p-5">
                            <h3 className="text-lg font-semibold text-foreground mb-3">Missing data to unlock richer Instagram Insights</h3>
                            <div className="grid gap-3 md:grid-cols-2">
                              {instagramMissingInsightInputs.map((item) => (
                                <div key={item} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">Performance Trend</h3>
                              <p className="text-sm text-muted-foreground">Daily selected Instagram campaign performance.</p>
                            </div>
                          </div>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={instagramInsightTrendRows}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="spend" name="Spend" stroke="#f97316" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#2563eb" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="conversions" name="Conversions" stroke="#16a34a" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {instagramInsights.map((insight) => {
                          const borderClass = insight.severity === "high" ? "border-red-200 dark:border-red-800" : insight.severity === "medium" ? "border-amber-200 dark:border-amber-800" : "border-green-200 dark:border-green-800";
                          const Icon = insight.severity === "high" ? AlertTriangle : insight.severity === "medium" ? AlertCircle : CheckCircle2;
                          const iconClass = insight.severity === "high" ? "text-red-600" : insight.severity === "medium" ? "text-amber-600" : "text-green-600";
                          return (
                            <Card key={insight.title} className={borderClass}>
                              <CardContent className="p-5">
                                <div className="flex items-start gap-3">
                                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconClass}`} />
                                  <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                                    <p className="text-sm font-medium text-foreground">{insight.recommendation}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected source-backed Instagram rows are available for insights yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="reports" className="space-y-4">
                  {renderSimpleRows(reports, reportsLoading, reportsError, "No Instagram Reports have been created yet.", (report: any) => (
                    <Card key={report.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{report.name || "Instagram Report"}</p>
                            <p className="text-xs text-muted-foreground">{report.reportType || "report"}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{report.scheduleEnabled ? "Scheduled" : "Standard"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
      {campaignId && (
        <AddRevenueWizardModal
          open={isRevenueWizardOpen}
          onOpenChange={(open) => {
            setIsRevenueWizardOpen(open);
            if (!open) setRevenueWizardInitialSource(null);
          }}
          campaignId={campaignId}
          currency="USD"
          dateRange="90days"
          platformContext="instagram"
          initialSource={revenueWizardInitialSource || undefined}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "instagram"], exact: false });
            void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=instagram&dateRange=90days`], exact: false });
            void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
            void queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/kpis", campaignId], exact: false });
            void queryClient.invalidateQueries({ queryKey: ["/api/platforms/instagram/benchmarks", campaignId], exact: false });
          }}
        />
      )}
      <Dialog open={showRevenueSourcesDialog} onOpenChange={setShowRevenueSourcesDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Instagram Revenue Sources</DialogTitle>
            <DialogDescription className="text-muted-foreground/70">
              Sources connected for Instagram Total Revenue.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {activeInstagramRevenueSources.length > 0 ? activeInstagramRevenueSources.map((source: any) => {
              const config = parseRevenueSourceConfig(source);
              const selectedCount = Array.isArray(config?.selectedValues) ? config.selectedValues.length : 0;
              return (
                <div key={source.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground" title={instagramRevenueSourceLabel(source)}>
                      {instagramRevenueSourceLabel(source)}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {revenueSourceTypeLabel(source.sourceType)}{selectedCount > 0 ? ` - ${selectedCount} selected attribution value${selectedCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(Number(source.lastTotalRevenue || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRevenueSourcesDialog(false);
                        openInstagramRevenueModal(source);
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground"
                      title="Edit revenue source"
                      aria-label="Edit revenue source"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRevenueSourceId(String(source.id))}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/70 hover:text-red-600"
                      title="Remove revenue source"
                      aria-label="Remove revenue source"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground/70">No Instagram revenue sources connected.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deletingRevenueSourceId} onOpenChange={(open) => { if (!open) setDeletingRevenueSourceId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remove revenue source?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/70">
              This removes only the selected Instagram revenue source. Financial totals are not recalculated until the Instagram revenue resolver is implemented.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deletingRevenueSourceId) {
                  deleteInstagramRevenueSourceMutation.mutate(deletingRevenueSourceId);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle>{editingKpi ? "Edit Campaign KPI" : "Create Campaign KPI"}</DialogTitle>
            <DialogDescription>Set up a key performance indicator for this Instagram campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {!editingKpi && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground">Select KPI Template</h4>
                <p className="text-sm text-muted-foreground">
                  Choose a predefined KPI that will automatically calculate from your Instagram source data, or create a custom one.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {INSTAGRAM_KPI_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      type="button"
                      className={`p-3 text-left border-2 rounded-lg transition-all ${kpiForm.metric === metric.key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-border hover:border-blue-300"}`}
                      onClick={() => applyKpiTemplate(metric.key)}
                    >
                      <div className="font-medium text-sm text-foreground">{metric.label}</div>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="p-3 text-left border-2 rounded-lg border-border hover:border-blue-300 transition-all"
                    onClick={() => resetKpiForm()}
                  >
                    <div className="font-medium text-sm text-foreground">Create Custom KPI</div>
                    <div className="mt-1 text-xs text-muted-foreground">Choose name + unit, then set values</div>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="instagram-kpi-name">KPI Name *</Label>
              <Input
                id="instagram-kpi-name"
                value={kpiForm.name}
                onChange={(event) => setKpiForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="e.g., Overall Instagram CTR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram-kpi-description">Description</Label>
              <Textarea
                id="instagram-kpi-description"
                value={kpiForm.description}
                maxLength={KPI_DESC_MAX}
                rows={3}
                onChange={(event) => setKpiForm((form) => ({ ...form, description: event.target.value.slice(0, KPI_DESC_MAX) }))}
                placeholder="Describe what this KPI measures and why it's important"
              />
              <div className="text-xs text-muted-foreground text-right">{kpiForm.description.length}/{KPI_DESC_MAX}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="instagram-kpi-current">Current Value</Label>
                <Input
                  id="instagram-kpi-current"
                  type="text"
                  inputMode="decimal"
                  value={kpiForm.currentValue}
                  onChange={(event) => setKpiForm((form) => ({ ...form, currentValue: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram-kpi-target">Target Value *</Label>
                <Input
                  id="instagram-kpi-target"
                  type="text"
                  inputMode="decimal"
                  value={kpiForm.targetValue}
                  onChange={(event) => setKpiForm((form) => ({ ...form, targetValue: formatNumericInput(event.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram-kpi-unit">Unit</Label>
                <Input
                  id="instagram-kpi-unit"
                  value={kpiForm.unit}
                  onChange={(event) => setKpiForm((form) => ({ ...form, unit: event.target.value }))}
                  placeholder="%, $, etc."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instagram-kpi-priority">Priority</Label>
                <Select value={kpiForm.priority} onValueChange={(value) => setKpiForm((form) => ({ ...form, priority: value }))}>
                  <SelectTrigger id="instagram-kpi-priority">
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

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="instagram-kpi-alerts-enabled"
                    checked={kpiForm.alertsEnabled}
                    onCheckedChange={(checked) => setKpiForm((form) => ({ ...form, alertsEnabled: checked === true }))}
                  />
                  <Label htmlFor="instagram-kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                    Enable alerts for this KPI
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Receive notifications for KPI performance alerts on the bell icon &amp; in your Notifications center
                </p>
              </div>

              {kpiForm.alertsEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="instagram-kpi-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="instagram-kpi-alert-threshold"
                        type="text"
                        inputMode="decimal"
                        value={kpiForm.alertThreshold}
                        onChange={(event) => setKpiForm((form) => ({ ...form, alertThreshold: event.target.value }))}
                        placeholder="e.g., 80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram-kpi-alert-condition">Alert When</Label>
                      <Select value={kpiForm.alertCondition} onValueChange={(value) => setKpiForm((form) => ({ ...form, alertCondition: value }))}>
                        <SelectTrigger id="instagram-kpi-alert-condition">
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="instagram-kpi-alert-frequency">Alert Frequency</Label>
                      <Select value={kpiForm.alertFrequency} onValueChange={(value) => setKpiForm((form) => ({ ...form, alertFrequency: value }))}>
                        <SelectTrigger id="instagram-kpi-alert-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 pt-1">
                        <Checkbox
                          id="instagram-kpi-email-notifications"
                          checked={kpiForm.emailNotifications}
                          onCheckedChange={(checked) => setKpiForm((form) => ({ ...form, emailNotifications: checked === true }))}
                        />
                        <Label htmlFor="instagram-kpi-email-notifications" className="cursor-pointer font-medium">
                          Send email notifications
                        </Label>
                      </div>
                      {kpiForm.emailNotifications && (
                        <Input
                          type="text"
                          value={kpiForm.emailRecipients}
                          onChange={(event) => setKpiForm((form) => ({ ...form, emailRecipients: event.target.value }))}
                          placeholder="email1@example.com, email2@example.com"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveKpiMutation.mutate()}
              disabled={saveKpiMutation.isPending || !kpiForm.name || !kpiForm.targetValue || (kpiForm.alertsEnabled && !kpiForm.alertThreshold)}
            >
              {saveKpiMutation.isPending ? "Saving..." : editingKpi ? "Update KPI" : "Create KPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={benchmarkDialogOpen} onOpenChange={setBenchmarkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle>{editingBenchmark ? "Edit Benchmark" : "Create Benchmark"}</DialogTitle>
            <DialogDescription>Set up a performance benchmark for this Instagram campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {!editingBenchmark && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground">Select Benchmark Template</h4>
                <p className="text-sm text-muted-foreground">
                  Choose a predefined Instagram metric or create a custom benchmark.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {INSTAGRAM_KPI_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      type="button"
                      className={`p-3 text-left border-2 rounded-lg transition-all ${benchmarkForm.metric === metric.key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-border hover:border-blue-300"}`}
                      onClick={() => applyBenchmarkTemplate(metric.key)}
                    >
                      <div className="font-medium text-sm text-foreground">{metric.label}</div>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="p-3 text-left border-2 rounded-lg border-border hover:border-blue-300 transition-all"
                    onClick={() => resetBenchmarkForm()}
                  >
                    <div className="font-medium text-sm text-foreground">Create Custom Benchmark</div>
                    <div className="mt-1 text-xs text-muted-foreground">Choose name + unit, then set values</div>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="instagram-benchmark-name">Benchmark Name *</Label>
              <Input
                id="instagram-benchmark-name"
                value={benchmarkForm.name}
                onChange={(event) => setBenchmarkForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="e.g., Instagram CTR Benchmark"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram-benchmark-description">Description</Label>
              <Textarea
                id="instagram-benchmark-description"
                value={benchmarkForm.description}
                maxLength={KPI_DESC_MAX}
                rows={3}
                onChange={(event) => setBenchmarkForm((form) => ({ ...form, description: event.target.value.slice(0, KPI_DESC_MAX) }))}
                placeholder="Describe what this benchmark measures and why it's important"
              />
              <div className="text-xs text-muted-foreground text-right">{benchmarkForm.description.length}/{KPI_DESC_MAX}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram-benchmark-metric">Metric *</Label>
              <Select
                value={benchmarkForm.metric}
                onValueChange={(value) => {
                  const metricDef = getInstagramKpiMetric(value);
                  setBenchmarkForm((form) => ({
                    ...form,
                    metric: value,
                    unit: form.unit || metricDef.unit,
                    currentValue: formatInstagramMetricInputValue(value, currentByMetric[value]),
                  }));
                }}
              >
                <SelectTrigger id="instagram-benchmark-metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {INSTAGRAM_KPI_METRICS.map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>{metric.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="instagram-benchmark-current">Current Value</Label>
                <Input
                  id="instagram-benchmark-current"
                  type="text"
                  inputMode="decimal"
                  value={benchmarkForm.currentValue}
                  onChange={(event) => setBenchmarkForm((form) => ({ ...form, currentValue: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram-benchmark-value">Benchmark Value *</Label>
                <Input
                  id="instagram-benchmark-value"
                  type="text"
                  inputMode="decimal"
                  value={benchmarkForm.benchmarkValue}
                  onChange={(event) => setBenchmarkForm((form) => ({ ...form, benchmarkValue: formatNumericInput(event.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram-benchmark-unit">Unit</Label>
                <Input
                  id="instagram-benchmark-unit"
                  value={benchmarkForm.unit}
                  onChange={(event) => setBenchmarkForm((form) => ({ ...form, unit: event.target.value }))}
                  placeholder="%, $, etc."
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="instagram-benchmark-alerts-enabled"
                    checked={benchmarkForm.alertsEnabled}
                    onCheckedChange={(checked) => setBenchmarkForm((form) => ({ ...form, alertsEnabled: checked === true }))}
                  />
                  <Label htmlFor="instagram-benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                    Enable alerts for this benchmark
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  Receive notifications for benchmark performance alerts on the bell icon &amp; in your Notifications center
                </p>
              </div>

              {benchmarkForm.alertsEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="instagram-benchmark-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="instagram-benchmark-alert-threshold"
                        type="text"
                        inputMode="decimal"
                        value={benchmarkForm.alertThreshold}
                        onChange={(event) => setBenchmarkForm((form) => ({ ...form, alertThreshold: event.target.value }))}
                        placeholder="e.g., 80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram-benchmark-alert-condition">Alert When</Label>
                      <Select value={benchmarkForm.alertCondition} onValueChange={(value) => setBenchmarkForm((form) => ({ ...form, alertCondition: value }))}>
                        <SelectTrigger id="instagram-benchmark-alert-condition">
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
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBenchmarkDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveBenchmarkMutation.mutate()}
              disabled={saveBenchmarkMutation.isPending || !benchmarkForm.name || !benchmarkForm.metric || !benchmarkForm.benchmarkValue || (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold)}
            >
              {saveBenchmarkMutation.isPending ? "Saving..." : editingBenchmark ? "Update Benchmark" : "Create Benchmark"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

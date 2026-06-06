import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, Eye, MousePointer, DollarSign, Target, BarChart3, Percent, Video, Plus, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { SiInstagram } from "react-icons/si";
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
  return value.toLocaleString();
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

export default function InstagramAnalytics() {
  const [, params] = useRoute("/campaigns/:id/instagram-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<any>(null);
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
    const currentByMetric: Record<string, number | null> = {
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
    };
    setKpiForm((form) => ({
      ...form,
      name: metricDef.label,
      metric: metricDef.key,
      unit: metricDef.unit,
      description: `Track Instagram ${metricDef.label.toLowerCase()} against target.`,
      currentValue: currentByMetric[metricDef.key] === null ? "" : String(currentByMetric[metricDef.key] || 0),
      targetValue: "",
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
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
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
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading source-backed Instagram metrics...
                        </div>
                      </CardContent>
                    </Card>
                  ) : hasRows ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Impressions", value: overviewTotals.impressions.toLocaleString(), Icon: Eye },
                        { label: "Clicks", value: overviewTotals.clicks.toLocaleString(), Icon: MousePointer },
                        { label: "Spend", value: `$${overviewTotals.spend.toFixed(2)}`, Icon: DollarSign },
                        { label: "Conversions", value: overviewTotals.conversions.toLocaleString(), Icon: Target },
                        { label: "CTR", value: overviewTotals.ctr === null ? "Unavailable" : `${overviewTotals.ctr.toFixed(2)}%`, Icon: Percent },
                        { label: "CPC", value: overviewTotals.cpc === null ? "Unavailable" : `$${overviewTotals.cpc.toFixed(2)}`, Icon: DollarSign },
                        { label: "CPM", value: overviewTotals.cpm === null ? "Unavailable" : `$${overviewTotals.cpm.toFixed(2)}`, Icon: BarChart3 },
                        { label: "Cost / Conversion", value: overviewTotals.costPerConversion === null ? "Unavailable" : `$${overviewTotals.costPerConversion.toFixed(2)}`, Icon: Target },
                        { label: "Conversion Rate", value: overviewTotals.conversionRate === null ? "Unavailable" : `${overviewTotals.conversionRate.toFixed(2)}%`, Icon: Percent },
                        { label: "Video Views", value: overviewTotals.videoViews.toLocaleString(), Icon: Video },
                      ].map(({ label, value, Icon }) => (
                        <Card key={label}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="text-2xl font-semibold text-foreground">{value}</p>
                              </div>
                              <Icon className="w-5 h-5 text-muted-foreground" />
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
                <TabsContent value="benchmarks" className="space-y-4">
                  {renderSimpleRows(benchmarks, benchmarksLoading, benchmarksError, "No Instagram Benchmarks have been created yet.", (benchmark: any) => (
                    <Card key={benchmark.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{benchmark.name || benchmark.metric || "Instagram Benchmark"}</p>
                            <p className="text-xs text-muted-foreground">{benchmark.metric || "Metric"} benchmark: {benchmark.benchmarkValue ?? "Not set"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-6 text-sm md:text-right">
                            <div>
                              <p className="text-muted-foreground">Current Value</p>
                              <p className="font-medium">{benchmark.currentValue ?? "Unavailable"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Variance</p>
                              <p className="font-medium">{benchmark.variance ?? "Unavailable"}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                <TabsContent value="ads" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-muted-foreground">No source-backed Instagram ad comparison rows are available yet.</p>
                      </div>
                    </CardContent>
                  </Card>
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
    </div>
  );
}

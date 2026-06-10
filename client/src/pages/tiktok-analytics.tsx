import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Activity, AlertCircle, AlertTriangle, BarChart3, CheckCircle2, DollarSign, Download, Eye, FileText, Info, MousePointer, Percent, Pencil, Plus, Settings, Target, Trash2, TrendingUp, Trophy, Video } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TIKTOK_GOAL_METRICS = [
  { key: "impressions", label: "Impressions", unit: "count" },
  { key: "clicks", label: "Clicks", unit: "count" },
  { key: "spend", label: "Spend", unit: "$" },
  { key: "conversions", label: "Conversions", unit: "count" },
  { key: "videoViews", label: "Video Views", unit: "count" },
  { key: "engagements", label: "Engagements", unit: "count" },
  { key: "ctr", label: "CTR", unit: "%" },
  { key: "cpc", label: "CPC", unit: "$" },
  { key: "cpm", label: "CPM", unit: "$" },
  { key: "costPerConversion", label: "Cost / Conversion", unit: "$" },
  { key: "conversionRate", label: "Conversion Rate", unit: "%" },
  { key: "totalRevenue", label: "Total Revenue", unit: "$" },
  { key: "roi", label: "ROI", unit: "%" },
  { key: "roas", label: "ROAS", unit: "x" },
];
const TIKTOK_GOAL_DESC_MAX = 200;
const TIKTOK_REPORT_TEMPLATES = [
  { key: "overview", title: "Overview", desc: "Comprehensive overview of TikTok campaign performance metrics", Icon: BarChart3, chips: ["Overview", "Metrics", "Insights"] },
  { key: "kpis", title: "KPIs", desc: "Key performance indicators and progress tracking", Icon: Target, chips: ["Metrics", "Targets", "Progress"] },
  { key: "benchmarks", title: "Benchmarks", desc: "Performance benchmarks and comparisons", Icon: Trophy, chips: ["Industry", "Historical", "Goals"] },
  { key: "ads", title: "Ad Comparison", desc: "Campaign-level TikTok performance analysis", Icon: Activity, chips: ["Performance", "Ranking", "Insights"] },
  { key: "insights", title: "Insights", desc: "Executive financials, trends, and recommended checks", Icon: Info, chips: ["Executive", "Trends", "Actions"] },
];
const TIKTOK_CUSTOM_REPORT_DEFAULT_CONFIG = {
  sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false },
  subsections: {
    overview: { summary: false, sourceMetrics: false, revenueFinancial: false, efficiencyMetrics: false },
    kpis: {},
    benchmarks: {},
    ads: { availability: false },
    insights: { summaryCards: false, revenueGuidance: false, sourceDataGuidance: false },
  },
  selectedKpiIds: [] as string[],
  selectedBenchmarkIds: [] as string[],
};
const TIKTOK_REPORT_TIMES = [
  ["06:00", "6:00 AM"],
  ["07:00", "7:00 AM"],
  ["08:00", "8:00 AM"],
  ["09:00", "9:00 AM"],
  ["10:00", "10:00 AM"],
  ["11:00", "11:00 AM"],
  ["12:00", "12:00 PM"],
  ["13:00", "1:00 PM"],
  ["14:00", "2:00 PM"],
  ["15:00", "3:00 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
  ["18:00", "6:00 PM"],
];
const TIKTOK_WEEKDAY_TO_INT: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function tiktokDayOfWeekToKey(value: any) {
  const day = Number(value);
  return Object.entries(TIKTOK_WEEKDAY_TO_INT).find(([, index]) => index === day)?.[0] || "monday";
}

function tiktokDayOfMonthToKey(value: any) {
  const day = Number(value);
  if (day === 0) return "last";
  return Number.isFinite(day) && day > 0 ? String(day) : "first";
}

function tiktokDayOfMonthToInt(value: string) {
  if (value === "last") return 0;
  if (value === "first") return 1;
  const day = Number(value);
  return Number.isFinite(day) ? day : 1;
}

function getTikTokGoalMetric(metricKey: string) {
  return TIKTOK_GOAL_METRICS.find((metric) => metric.key === metricKey) || TIKTOK_GOAL_METRICS[0];
}

function cloneTikTokCustomReportConfig() {
  return JSON.parse(JSON.stringify(TIKTOK_CUSTOM_REPORT_DEFAULT_CONFIG));
}

function stripNumberFormatting(value: any) {
  return String(value || "").replace(/[$,%x,\s]/g, "");
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

function formatPct(value: number | null) {
  return value === null || value === undefined ? "Unavailable" : `${value.toFixed(2)}%`;
}

function formatTikTokNumberAsYouType(raw: string, unit: string) {
  const input = String(raw || "");
  const noCommas = stripNumberFormatting(input);
  if (!noCommas) return "";
  const negative = noCommas.startsWith("-");
  const body = negative ? noCommas.slice(1) : noCommas;
  if (String(unit || "").toLowerCase() === "count") {
    const digitsOnly = body.replace(/\D+/g, "");
    if (!digitsOnly) return negative ? "-" : "";
    return `${negative ? "-" : ""}${digitsOnly.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }
  const sanitized = body.replace(/[^0-9.]/g, "");
  if (!sanitized) return negative ? "-" : "";
  const dotIndex = sanitized.indexOf(".");
  const hasDot = dotIndex >= 0;
  let intPart = hasDot ? sanitized.slice(0, dotIndex) : sanitized;
  const fracPart = hasDot ? sanitized.slice(dotIndex + 1).replace(/\./g, "") : "";
  if (hasDot && !intPart) intPart = "0";
  if (!intPart && !hasDot) return negative ? "-" : "";
  const grouped = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") || (hasDot ? "0" : "");
  return `${negative ? "-" : ""}${grouped}${hasDot ? "." : ""}${fracPart}`;
}

function formatTikTokNumberByUnit(raw: string, unit: string) {
  const cleaned = stripNumberFormatting(raw);
  if (!cleaned) return "";
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return raw;
  const normalizedUnit = String(unit || "").toLowerCase();
  if (normalizedUnit === "count") return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (normalizedUnit === "%" || normalizedUnit === "percent") {
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  if (normalizedUnit === "$" || normalizedUnit === "currency" || normalizedUnit === "x") {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString();
}

const REVENUE_DEPENDENT_METRICS = new Set(["totalrevenue", "revenue", "roi", "roas", "profit"]);

function normalizeMetricKey(value: any) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRevenueDependentMetric(metricKey: string) {
  return REVENUE_DEPENDENT_METRICS.has(normalizeMetricKey(metricKey));
}

function formatGoalValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) {
    return { value: "Unavailable", helper: "Requires TikTok-scoped attributed revenue." };
  }
  const raw = row?.currentValue;
  if (raw === null || raw === undefined || raw === "") return { value: "Unavailable", helper: undefined };
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return { value: String(raw), helper: undefined };
  const unit = String(row?.unit || "").toLowerCase();
  if (unit === "$" || unit === "currency") return { value: formatCurrency(numeric), helper: undefined };
  if (unit === "%" || unit === "percent") return { value: `${numeric.toFixed(2)}%`, helper: undefined };
  if (unit === "ratio" || metricKey === "roas") return { value: `${numeric.toFixed(2)}x`, helper: undefined };
  return { value: numeric.toLocaleString(), helper: undefined };
}

function getGoalNumericValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) return null;
  const value = Number(row?.currentValue);
  return Number.isFinite(value) ? value : null;
}

function getTargetNumericValue(row: any) {
  const value = Number(row?.targetValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getGoalProgress(row: any, hasAttributedRevenue: boolean) {
  const current = getGoalNumericValue(row, hasAttributedRevenue);
  const target = getTargetNumericValue(row);
  if (current === null || target === null) return null;
  return (current / target) * 100;
}

function buildGoalTracker(rows: any[], hasAttributedRevenue: boolean) {
  const progress = rows
    .map((row) => getGoalProgress(row, hasAttributedRevenue))
    .filter((value): value is number => Number.isFinite(value));
  return {
    total: rows.length,
    above: progress.filter((value) => value > 105).length,
    near: progress.filter((value) => value >= 95 && value <= 105).length,
    below: progress.filter((value) => value < 95).length,
    avgPct: progress.length > 0 ? progress.reduce((sum, value) => sum + value, 0) / progress.length : 0,
  };
}

function getBenchmarkNumericValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) return null;
  const value = Number(row?.currentValue);
  return Number.isFinite(value) ? value : null;
}

function getBenchmarkTargetValue(row: any) {
  const value = Number(row?.benchmarkValue ?? row?.targetValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getBenchmarkProgress(row: any, hasAttributedRevenue: boolean) {
  const current = getBenchmarkNumericValue(row, hasAttributedRevenue);
  const benchmark = getBenchmarkTargetValue(row);
  if (current === null || benchmark === null) return null;
  return (current / benchmark) * 100;
}

function buildBenchmarkTracker(rows: any[], hasAttributedRevenue: boolean) {
  const progress = rows
    .map((row) => getBenchmarkProgress(row, hasAttributedRevenue))
    .filter((value): value is number => Number.isFinite(value));
  return {
    total: rows.length,
    onTrack: progress.filter((value) => value >= 90).length,
    needsAttention: progress.filter((value) => value >= 70 && value < 90).length,
    behind: progress.filter((value) => value < 70).length,
    avgPct: progress.length > 0 ? progress.reduce((sum, value) => sum + value, 0) / progress.length : 0,
  };
}

function metricCard(label: string, value: string, Icon: any, helper?: string, valueClass = "text-foreground", iconClass = "text-muted-foreground") {
  return (
    <Card key={label}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
            {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
          </div>
          <Icon className={`w-5 h-5 ${iconClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TikTokAnalytics() {
  const [, params] = useRoute("/campaigns/:id/tiktok-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportModalStep, setReportModalStep] = useState<"standard" | "custom">("standard");
  const [expandedCustomReportSections, setExpandedCustomReportSections] = useState<Record<string, boolean>>({ overview: true });
  const [editingReport, setEditingReport] = useState<any>(null);
  const [downloadingReportId, setDownloadingReportId] = useState("");
  const [reportForm, setReportForm] = useState({
    name: "",
    description: "",
    reportType: "",
    configuration: cloneTikTokCustomReportConfig(),
    scheduleEnabled: false,
    scheduleFrequency: "weekly",
    scheduleDayOfWeek: "monday",
    scheduleDayOfMonth: "first",
    quarterTiming: "end",
    scheduleTime: "09:00",
    scheduleTimeZone: "UTC",
    scheduleRecipients: "",
  });
  const [kpiForm, setKpiForm] = useState({
    name: "",
    metric: "",
    currentValue: "",
    targetValue: "",
    unit: "",
    description: "",
    priority: "medium",
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
    alertsEnabled: false,
    alertThreshold: "",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
    emailRecipients: "",
  });

  const resetKpiForm = (metricKey?: string) => {
    if (!metricKey) {
      setKpiForm({
        name: "",
        metric: "",
        currentValue: "",
        targetValue: "",
        unit: "",
        description: "",
        priority: "medium",
        alertsEnabled: false,
        alertThreshold: "",
        alertCondition: "below",
        alertFrequency: "daily",
        emailNotifications: false,
        emailRecipients: "",
      });
      return;
    }
    const metric = getTikTokGoalMetric(metricKey);
    setKpiForm({
      name: metric.label,
      metric: metric.key,
      currentValue: getTikTokCurrentMetricValue(metric.key),
      targetValue: "",
      unit: metric.unit,
      description: `Track TikTok ${metric.label.toLowerCase()} against a campaign target.`,
      priority: "medium",
      alertsEnabled: false,
      alertThreshold: "",
      alertCondition: "below",
      alertFrequency: "daily",
      emailNotifications: false,
      emailRecipients: "",
    });
  };

  const resetBenchmarkForm = (metricKey?: string) => {
    if (!metricKey) {
      setBenchmarkForm({
        name: "",
        metric: "",
        currentValue: "",
        benchmarkValue: "",
        unit: "",
        description: "",
        alertsEnabled: false,
        alertThreshold: "",
        alertCondition: "below",
        alertFrequency: "daily",
        emailNotifications: false,
        emailRecipients: "",
      });
      return;
    }
    const metric = getTikTokGoalMetric(metricKey);
    setBenchmarkForm({
      name: `${metric.label} Benchmark`,
      metric: metric.key,
      currentValue: getTikTokCurrentMetricValue(metric.key),
      benchmarkValue: "",
      unit: metric.unit,
      description: `Compare TikTok ${metric.label.toLowerCase()} against a campaign benchmark.`,
      alertsEnabled: false,
      alertThreshold: "",
      alertCondition: "below",
      alertFrequency: "daily",
      emailNotifications: false,
      emailRecipients: "",
    });
  };

  const resetReportForm = (report?: any) => {
    const parsedConfiguration = (() => {
      if (!report?.configuration) return cloneTikTokCustomReportConfig();
      try {
        const parsed = typeof report.configuration === "string" ? JSON.parse(report.configuration) : report.configuration;
        const defaults = cloneTikTokCustomReportConfig();
        return {
          ...defaults,
          ...parsed,
          sections: { ...defaults.sections, ...(parsed?.sections || {}) },
          subsections: { ...defaults.subsections, ...(parsed?.subsections || {}) },
          selectedKpiIds: Array.isArray(parsed?.selectedKpiIds) ? parsed.selectedKpiIds.map(String) : [],
          selectedBenchmarkIds: Array.isArray(parsed?.selectedBenchmarkIds) ? parsed.selectedBenchmarkIds.map(String) : [],
        };
      } catch {
        return cloneTikTokCustomReportConfig();
      }
    })();
    setEditingReport(report || null);
    setReportModalStep(String(report?.reportType || "overview") === "custom" ? "custom" : "standard");
    setExpandedCustomReportSections({ overview: true });
    setReportForm({
      name: report?.name || "",
      description: report?.description || "",
      reportType: report?.reportType || "",
      configuration: parsedConfiguration,
      scheduleEnabled: !!report?.scheduleEnabled,
      scheduleFrequency: report?.scheduleFrequency || "weekly",
      scheduleDayOfWeek: tiktokDayOfWeekToKey(report?.scheduleDayOfWeek),
      scheduleDayOfMonth: tiktokDayOfMonthToKey(report?.scheduleDayOfMonth),
      quarterTiming: report?.quarterTiming || "end",
      scheduleTime: report?.scheduleTime || "09:00",
      scheduleTimeZone: report?.scheduleTimeZone || "UTC",
      scheduleRecipients: Array.isArray(report?.scheduleRecipients) ? report.scheduleRecipients.join(", ") : "",
    });
  };

  const { data: connection, isLoading: connectionLoading, error: connectionError } = useQuery<any>({
    queryKey: [`/api/tiktok/${campaignId}/connection`],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/connection`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load TikTok connection");
      }
      return response.json();
    },
  });

  const connected = connection?.connected === true && Array.isArray(connection?.selectedCampaignIds) && connection.selectedCampaignIds.length > 0;
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: [`/api/tiktok/${campaignId}/daily-metrics`, "30days"],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/daily-metrics?dateRange=30days`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load TikTok metrics");
      }
      return response.json();
    },
  });

  const { data: kpisData, isLoading: kpisLoading } = useQuery<any[]>({
    queryKey: [`/api/platforms/tiktok/kpis`, campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/tiktok/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error("Failed to load TikTok KPIs");
      return response.json();
    },
  });

  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery<any[]>({
    queryKey: [`/api/platforms/tiktok/benchmarks`, campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/tiktok/benchmarks?campaignId=${campaignId}`);
      if (!response.ok) throw new Error("Failed to load TikTok Benchmarks");
      return response.json();
    },
  });

  const { data: reportsData, isLoading: reportsLoading, error: reportsError } = useQuery<any[]>({
    queryKey: [`/api/platforms/tiktok/reports`, campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/tiktok/reports?campaignId=${campaignId}`);
      if (!response.ok) throw new Error("Failed to load TikTok Reports");
      return response.json();
    },
  });

  const createKpiMutation = useMutation({
    mutationFn: async () => {
      const metric = getTikTokGoalMetric(kpiForm.metric);
      const response = await fetch("/api/platforms/tiktok/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: kpiForm.name || metric.label,
          metric: kpiForm.metric,
          targetValue: stripNumberFormatting(kpiForm.targetValue) || "0",
          currentValue: stripNumberFormatting(kpiForm.currentValue) || "0",
          unit: kpiForm.unit || metric.unit,
          description: kpiForm.description,
          priority: kpiForm.priority,
          status: "active",
          category: "performance",
          timeframe: "monthly",
          trackingPeriod: 30,
          applyTo: "all",
          alertsEnabled: kpiForm.alertsEnabled,
          alertThreshold: kpiForm.alertsEnabled && kpiForm.alertThreshold ? stripNumberFormatting(kpiForm.alertThreshold) : null,
          alertCondition: kpiForm.alertCondition,
          alertFrequency: kpiForm.alertFrequency,
          emailNotifications: kpiForm.emailNotifications,
          emailRecipients: kpiForm.emailNotifications ? kpiForm.emailRecipients : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to create TikTok KPI");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/platforms/tiktok/kpis`, campaignId] });
      setKpiDialogOpen(false);
      resetKpiForm();
    },
  });

  const createBenchmarkMutation = useMutation({
    mutationFn: async () => {
      const metric = getTikTokGoalMetric(benchmarkForm.metric);
      const benchmarkValue = stripNumberFormatting(benchmarkForm.benchmarkValue) || "0";
      const response = await fetch("/api/platforms/tiktok/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: benchmarkForm.name || `${metric.label} Benchmark`,
          metric: benchmarkForm.metric,
          benchmarkValue,
          targetValue: benchmarkValue,
          currentValue: stripNumberFormatting(benchmarkForm.currentValue) || "0",
          unit: benchmarkForm.unit || metric.unit,
          description: benchmarkForm.description,
          industry: "Custom",
          benchmarkType: "custom",
          status: "active",
          category: "performance",
          alertsEnabled: benchmarkForm.alertsEnabled,
          alertThreshold: benchmarkForm.alertsEnabled && benchmarkForm.alertThreshold ? stripNumberFormatting(benchmarkForm.alertThreshold) : null,
          alertCondition: benchmarkForm.alertCondition,
          alertFrequency: benchmarkForm.alertFrequency,
          emailNotifications: benchmarkForm.emailNotifications,
          emailRecipients: benchmarkForm.emailNotifications ? benchmarkForm.emailRecipients : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to create TikTok Benchmark");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/platforms/tiktok/benchmarks`, campaignId] });
      setBenchmarkDialogOpen(false);
      resetBenchmarkForm();
    },
  });

  const saveReportMutation = useMutation({
    mutationFn: async () => {
      const recipients = reportForm.scheduleRecipients.split(",").map((value) => value.trim()).filter(Boolean);
      const payload = {
        campaignId,
        name: reportForm.name || "TikTok Report",
        description: reportForm.description,
        reportType: reportForm.reportType,
        configuration: reportForm.reportType === "custom" ? reportForm.configuration : { sections: reportForm.configuration?.sections || {} },
        status: "active",
        scheduleEnabled: reportForm.scheduleEnabled,
        scheduleFrequency: reportForm.scheduleEnabled ? reportForm.scheduleFrequency : null,
        scheduleTime: reportForm.scheduleEnabled ? reportForm.scheduleTime : null,
        scheduleTimeZone: reportForm.scheduleEnabled ? reportForm.scheduleTimeZone : null,
        scheduleRecipients: reportForm.scheduleEnabled ? recipients : [],
        scheduleDayOfWeek: reportForm.scheduleEnabled && reportForm.scheduleFrequency === "weekly" ? TIKTOK_WEEKDAY_TO_INT[reportForm.scheduleDayOfWeek] : null,
        scheduleDayOfMonth: reportForm.scheduleEnabled && (reportForm.scheduleFrequency === "monthly" || reportForm.scheduleFrequency === "quarterly") ? tiktokDayOfMonthToInt(reportForm.scheduleDayOfMonth) : null,
        quarterTiming: reportForm.scheduleEnabled && reportForm.scheduleFrequency === "quarterly" ? reportForm.quarterTiming : null,
      };
      const response = await fetch(editingReport ? `/api/platforms/tiktok/reports/${editingReport.id}` : "/api/platforms/tiktok/reports", {
        method: editingReport ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to save TikTok report");
      }
      return response.json();
    },
    onSuccess: async (report: any) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/platforms/tiktok/reports`, campaignId] });
      if (!reportForm.scheduleEnabled && !editingReport) {
        await downloadTikTokReport(report);
      }
      setReportDialogOpen(false);
      resetReportForm();
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/platforms/tiktok/reports/${encodeURIComponent(String(reportId))}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to delete TikTok report");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/platforms/tiktok/reports`, campaignId] });
    },
  });

  const downloadTikTokReport = async (report: any) => {
    const reportId = String(report?.id || "");
    if (!reportId) return;
    setDownloadingReportId(reportId);
    try {
      const snapshotResponse = await fetch(`/api/platforms/tiktok/reports/${encodeURIComponent(reportId)}/snapshots`, { method: "POST" });
      const snapshotBody = await snapshotResponse.json().catch(() => ({}));
      if (!snapshotResponse.ok || !snapshotBody?.snapshot?.id) {
        throw new Error(snapshotBody?.error || "Failed to generate TikTok report snapshot");
      }
      const pdfResponse = await fetch(`/api/report-snapshots/${encodeURIComponent(String(snapshotBody.snapshot.id))}/pdf`);
      if (!pdfResponse.ok) throw new Error("Failed to download TikTok report PDF");
      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${String(report?.name || "tiktok-report").replace(/\s+/g, "_")}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadingReportId("");
    }
  };

  const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
  const hasRows = rows.length > 0;
  const refreshTestMetrics = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/refresh-test`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to refresh TikTok test metrics");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/tiktok/${campaignId}/daily-metrics`], exact: false });
      await queryClient.invalidateQueries({ queryKey: [`/api/tiktok/${campaignId}/connection`], exact: false });
    },
  });
  const shouldAutoRefreshTestMetrics =
    connection?.method === "test_mode" &&
    !!dailyMetrics &&
    !metricsLoading &&
    !metricsError &&
    !hasRows &&
    !refreshTestMetrics.isPending &&
    !refreshTestMetrics.isSuccess &&
    !refreshTestMetrics.error;
  useEffect(() => {
    if (shouldAutoRefreshTestMetrics) {
      refreshTestMetrics.mutate();
    }
  }, [shouldAutoRefreshTestMetrics, refreshTestMetrics]);
  const totals = useMemo(() => {
    const summed = rows.reduce((acc: any, row: any) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.spend += Number(row.spend || 0);
      acc.conversions += Number(row.conversions || 0);
      acc.videoViews += Number(row.videoViews || 0);
      acc.engagements += Number(row.engagements || 0);
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, engagements: 0 });
    return {
      ...summed,
      ctr: summed.impressions > 0 ? (summed.clicks / summed.impressions) * 100 : null,
      cpc: summed.clicks > 0 ? summed.spend / summed.clicks : null,
      cpm: summed.impressions > 0 ? (summed.spend / summed.impressions) * 1000 : null,
      costPerConversion: summed.conversions > 0 ? summed.spend / summed.conversions : null,
      conversionRate: summed.clicks > 0 ? (summed.conversions / summed.clicks) * 100 : null,
    };
  }, [rows]);

  const campaignRows = useMemo(() => {
    const grouped = new Map<string, any>();
    rows.forEach((row: any) => {
      const id = String(row.tiktokCampaignId || "").trim();
      if (!id) return;
      const existing = grouped.get(id) || {
        id,
        name: String(row.tiktokCampaignName || id),
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        videoViews: 0,
        engagements: 0,
      };
      existing.impressions += Number(row.impressions || 0);
      existing.clicks += Number(row.clicks || 0);
      existing.spend += Number(row.spend || 0);
      existing.conversions += Number(row.conversions || 0);
      existing.videoViews += Number(row.videoViews || 0);
      existing.engagements += Number(row.engagements || 0);
      grouped.set(id, existing);
    });
    return Array.from(grouped.values()).map((row: any) => ({
      ...row,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
      cpc: row.clicks > 0 ? row.spend / row.clicks : null,
      costPerConversion: row.conversions > 0 ? row.spend / row.conversions : null,
    })).sort((a: any, b: any) => b.spend - a.spend);
  }, [rows]);

  const financialSummary = dailyMetrics?.financialSummary || {};
  const hasAttributedRevenue = financialSummary?.hasAttributedRevenue === true && Number(financialSummary?.attributedRevenue || 0) > 0;
  const attributedRevenue = hasAttributedRevenue ? Number(financialSummary.attributedRevenue || 0) : null;
  const roi = hasAttributedRevenue && attributedRevenue !== null && totals.spend > 0 ? ((attributedRevenue - totals.spend) / totals.spend) * 100 : null;
  const roas = hasAttributedRevenue && attributedRevenue !== null && totals.spend > 0 ? attributedRevenue / totals.spend : null;
  const unavailableReason = dailyMetrics?.unavailableReason || "No persisted TikTok metric rows exist for the selected campaigns yet.";
  const platformKPIs = Array.isArray(kpisData) ? kpisData : [];
  const kpiTracker = buildGoalTracker(platformKPIs, hasAttributedRevenue);
  const platformBenchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
  const benchmarkTracker = buildBenchmarkTracker(platformBenchmarks, hasAttributedRevenue);
  const reportSelectionMade = reportModalStep === "custom"
    ? reportForm.reportType === "custom" && Object.values(reportForm.configuration?.sections || {}).some(Boolean)
    : TIKTOK_REPORT_TEMPLATES.some((template) => template.key === reportForm.reportType);

  function getTikTokCurrentMetricValue(metricKey: string) {
    if (!hasRows) return "";
    const values: Record<string, number | null> = {
      impressions: totals.impressions,
      clicks: totals.clicks,
      spend: totals.spend,
      conversions: totals.conversions,
      videoViews: totals.videoViews,
      engagements: totals.engagements,
      ctr: totals.ctr,
      cpc: totals.cpc,
      cpm: totals.cpm,
      costPerConversion: totals.costPerConversion,
      conversionRate: totals.conversionRate,
      totalRevenue: attributedRevenue,
      revenue: attributedRevenue,
      roi,
      roas,
    };
    const value = values[metricKey];
    if (value === null || value === undefined || !Number.isFinite(value)) return "";
    return formatTikTokNumberByUnit(String(value), getTikTokGoalMetric(metricKey).unit);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            <div>
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center">
                <SiTiktok className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">TikTok Ads Analytics</h1>
                <p className="text-muted-foreground">Campaign-scoped TikTok source analytics</p>
              </div>
            </div>

            {connectionLoading && <div className="min-h-[220px]" aria-hidden="true" />}

            {!connectionLoading && (connectionError || !connected) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">
                      {connectionError ? (connectionError as Error).message : "Connect TikTok Ads from the campaign Connected Platforms section before opening TikTok analytics."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!connectionLoading && connected && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
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

                <TabsContent value="overview" className="space-y-4">
                  {metricsLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : !hasRows && (shouldAutoRefreshTestMetrics || refreshTestMetrics.isPending || refreshTestMetrics.isSuccess) ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : !hasRows ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-muted-foreground">{refreshTestMetrics.error ? (refreshTestMetrics.error as Error).message : unavailableReason}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {metricCard("Impressions", formatNumber(totals.impressions), Eye)}
                      {metricCard("Clicks", formatNumber(totals.clicks), MousePointer)}
                      {metricCard("Spend", formatCurrency(totals.spend), DollarSign)}
                      {metricCard("Conversions", formatNumber(totals.conversions), Target)}
                      {metricCard("Video Views", formatNumber(totals.videoViews), Video)}
                      {metricCard("Engagements", formatNumber(totals.engagements), BarChart3)}
                      {metricCard("CTR", formatPct(totals.ctr), Percent)}
                      {metricCard("CPC", totals.cpc === null ? "Unavailable" : formatCurrency(totals.cpc), DollarSign)}
                      {metricCard("CPM", totals.cpm === null ? "Unavailable" : formatCurrency(totals.cpm), BarChart3)}
                      {metricCard("Cost / Conversion", totals.costPerConversion === null ? "Unavailable" : formatCurrency(totals.costPerConversion), Target)}
                      {metricCard("Conversion Rate", formatPct(totals.conversionRate), Percent)}
                      {metricCard("Total Revenue", attributedRevenue === null ? "Unavailable" : formatCurrency(attributedRevenue), DollarSign, attributedRevenue === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                      {metricCard("ROI", roi === null ? "Unavailable" : `${roi.toFixed(2)}%`, Percent, roi === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                      {metricCard("ROAS", roas === null ? "Unavailable" : `${roas.toFixed(2)}x`, TrendingUp, roas === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ads" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        TikTok ad-level comparison is unavailable until persisted TikTok rows include ad-level source identifiers.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis" className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Key Performance Indicators</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track daily TikTok KPIs and progress toward targets.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => { resetKpiForm(); setKpiDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create KPI
                    </Button>
                  </div>

                  {kpisLoading ? (
                    <div className="min-h-[180px]" aria-hidden="true" />
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        {metricCard("Total KPIs", formatNumber(kpiTracker.total), Target, undefined, "text-foreground", "text-purple-500")}
                        {metricCard("Above Target", formatNumber(kpiTracker.above), TrendingUp, "more than +5% above target", "text-green-600", "text-green-500")}
                        {metricCard("On Track", formatNumber(kpiTracker.near), CheckCircle2, "within +/-5% of target", "text-blue-600", "text-blue-500")}
                        {metricCard("Below Target", formatNumber(kpiTracker.below), AlertCircle, "more than -5% below target", "text-red-600", "text-red-500")}
                        {metricCard("Avg. Progress", `${kpiTracker.avgPct.toFixed(1)}%`, TrendingUp, undefined, "text-foreground", "text-violet-600")}
                      </div>

                      {platformKPIs.length === 0 ? (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs yet</h3>
                            <p>Create your first KPI to track TikTok performance for this campaign.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {platformKPIs.map((kpi: any) => {
                            const current = formatGoalValue(kpi, hasAttributedRevenue);
                            const target = formatGoalValue({ ...kpi, currentValue: kpi?.targetValue }, true);
                            const progress = getGoalProgress(kpi, hasAttributedRevenue);
                            const boundedProgress = progress === null ? 0 : Math.min(Math.max(progress, 0), 100);
                            const statusText = progress === null
                              ? current.helper || "Current value unavailable."
                              : progress > 105
                                ? `${(progress - 100).toFixed(1)}% above target`
                                : progress < 95
                                  ? `${(100 - progress).toFixed(1)}% below target`
                                  : "within +/-5% of target";
                            const progressColor = progress === null
                              ? "bg-muted"
                              : progress > 105
                                ? "bg-green-500"
                                : progress < 95
                                  ? "bg-red-500"
                                  : "bg-blue-500";

                            return (
                              <Card key={kpi.id || kpi.name || kpi.metric}>
                                <CardContent className="p-5 space-y-5">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                      <Target className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-semibold text-foreground">{kpi?.name || "TikTok KPI"}</h4>
                                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{kpi?.metric || "KPI"}</span>
                                      </div>
                                      {kpi?.description && <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Current</p>
                                      <p className="text-2xl font-semibold text-foreground">{current.value}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Target</p>
                                      <p className="text-2xl font-semibold text-foreground">{target.value}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Progress</span>
                                      <span>{progress === null ? "Unavailable" : `${progress.toFixed(1)}%`}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${boundedProgress}%` }} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">{statusText}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="benchmarks" className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Performance Benchmarks</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track and measure TikTok performance against industry standards and custom targets.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => { resetBenchmarkForm(); setBenchmarkDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Benchmark
                    </Button>
                  </div>

                  {benchmarksLoading ? (
                    <div className="min-h-[180px]" aria-hidden="true" />
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        {metricCard("Total Benchmarks", formatNumber(benchmarkTracker.total), Target, undefined, "text-foreground", "text-purple-500")}
                        {metricCard("On Track", formatNumber(benchmarkTracker.onTrack), CheckCircle2, "90% or more of benchmark", "text-green-600", "text-green-500")}
                        {metricCard("Needs Attention", formatNumber(benchmarkTracker.needsAttention), AlertCircle, "70% to under 90% of benchmark", "text-amber-600", "text-amber-500")}
                        {metricCard("Behind", formatNumber(benchmarkTracker.behind), AlertTriangle, "below 70% of benchmark", "text-red-600", "text-red-500")}
                        {metricCard("Avg. Progress", `${benchmarkTracker.avgPct.toFixed(1)}%`, TrendingUp, undefined, "text-foreground", "text-violet-600")}
                      </div>

                      {platformBenchmarks.length === 0 ? (
                        <Card>
                          <CardContent className="py-12 text-center text-muted-foreground">
                            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No Benchmarks Yet</h3>
                            <p>Create your first benchmark to start tracking performance against industry standards.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {platformBenchmarks.map((benchmark: any) => {
                            const current = formatGoalValue(benchmark, hasAttributedRevenue);
                            const target = formatGoalValue({ ...benchmark, currentValue: benchmark?.benchmarkValue ?? benchmark?.targetValue }, true);
                            const progress = getBenchmarkProgress(benchmark, hasAttributedRevenue);
                            const boundedProgress = progress === null ? 0 : Math.min(Math.max(progress, 0), 100);
                            const statusLabel = progress === null
                              ? "Unavailable"
                              : progress >= 90
                                ? "On Track"
                                : progress >= 70
                                  ? "Needs Attention"
                                  : "Behind";
                            const statusText = progress === null
                              ? current.helper || "Current value unavailable."
                              : `${(progress - 100).toFixed(1)}% vs benchmark`;
                            const progressColor = progress === null
                              ? "bg-muted"
                              : progress >= 90
                                ? "bg-green-500"
                                : progress >= 70
                                  ? "bg-amber-500"
                                  : "bg-red-500";

                            return (
                              <Card key={benchmark.id || benchmark.name || benchmark.metric}>
                                <CardContent className="p-5 space-y-5">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                      <TrendingUp className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-semibold text-foreground">{benchmark?.name || "TikTok Benchmark"}</h4>
                                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{benchmark?.metric || "Benchmark"}</span>
                                      </div>
                                      {benchmark?.description && <p className="text-sm text-muted-foreground mt-1">{benchmark.description}</p>}
                                      {benchmark?.industry && <p className="text-xs text-muted-foreground mt-1">Industry: {benchmark.industry}</p>}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Current Value</p>
                                      <p className="text-2xl font-semibold text-foreground">{current.value}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Benchmark Value</p>
                                      <p className="text-2xl font-semibold text-foreground">{target.value}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Progress</span>
                                      <span>{progress === null ? "Unavailable" : `${progress.toFixed(1)}%`}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${boundedProgress}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Performance</span>
                                      <span className="font-medium text-foreground">{statusLabel}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{statusText}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Insights are limited to selected persisted TikTok rows. Revenue, ROI, and ROAS remain unavailable until TikTok-scoped attributed revenue exists.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {metricCard("Selected Campaign Rows", hasRows ? formatNumber(campaignRows.length) : "Unavailable", Target, hasRows ? "Persisted TikTok metric rows only." : unavailableReason)}
                        {metricCard("Spend", hasRows ? formatCurrency(totals.spend) : "Unavailable", DollarSign, hasRows ? "From selected TikTok rows." : unavailableReason)}
                        {metricCard("Attributed Revenue", attributedRevenue === null ? "Unavailable" : formatCurrency(attributedRevenue), DollarSign, attributedRevenue === null ? "Requires TikTok-scoped attributed revenue." : "From TikTok-scoped revenue source.")}
                        {metricCard("ROAS", roas === null ? "Unavailable" : `${roas.toFixed(2)}x`, TrendingUp, roas === null ? "Requires TikTok-scoped attributed revenue." : "Spend and revenue are TikTok-scoped.")}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reports" className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">TikTok Reports</h2>
                      <p className="text-sm text-muted-foreground mt-1">Create campaign-scoped TikTok reports from selected source-backed rows.</p>
                    </div>
                    <Button size="sm" onClick={() => { resetReportForm(); setReportDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Report
                    </Button>
                  </div>
                  {reportsError ? (
                    <Card>
                      <CardContent className="p-4 text-sm text-red-600">{(reportsError as Error).message}</CardContent>
                    </Card>
                  ) : reportsLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : !Array.isArray(reportsData) || reportsData.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No Reports Yet</h3>
                        <p className="mb-4">Create your first TikTok report from selected persisted TikTok rows.</p>
                        <Button onClick={() => { resetReportForm(); setReportDialogOpen(true); }}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Report
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {reportsData.map((report: any) => (
                        <Card key={report.id}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold text-foreground">{report.name || "TikTok Report"}</h3>
                                {report.description && <p className="text-sm text-muted-foreground mt-1">{report.description}</p>}
                                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-3">
                                  <span>{String(report.reportType || "overview")}</span>
                                  {report.scheduleEnabled && <span>Scheduled {report.scheduleFrequency || "weekly"} at {report.scheduleTime || "09:00"} {report.scheduleTimeZone || "UTC"}</span>}
                                  {report.lastSentAt && <span>Last sent {new Date(report.lastSentAt).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" disabled={downloadingReportId === String(report.id)} onClick={() => downloadTikTokReport(report)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  {downloadingReportId === String(report.id) ? "Downloading..." : "Download"}
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Edit report" onClick={() => { resetReportForm(report); setReportDialogOpen(true); }}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Delete report" disabled={deleteReportMutation.isPending} onClick={() => deleteReportMutation.mutate(String(report.id))}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader className="pb-4 pr-8">
                  <DialogTitle>Create New KPI</DialogTitle>
                  <DialogDescription>Set up a key performance indicator for TikTok Ads.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium text-foreground">Select KPI Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {TIKTOK_GOAL_METRICS.map((metric) => {
                        const disabled = isRevenueDependentMetric(metric.key) && !hasAttributedRevenue;
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            disabled={disabled}
                            title={disabled ? "Requires TikTok-scoped attributed revenue." : undefined}
                            className={`p-3 text-left border-2 rounded-lg transition-all ${kpiForm.metric === metric.key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-border hover:border-blue-300"} ${disabled ? "opacity-50 cursor-not-allowed hover:border-border" : ""}`}
                            onClick={() => resetKpiForm(metric.key)}
                          >
                            <div className="font-medium text-sm text-foreground">{metric.label}</div>
                            {disabled && <div className="mt-1 text-xs text-muted-foreground">Requires TikTok-scoped attributed revenue.</div>}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="p-3 text-left border-2 rounded-lg border-border hover:border-blue-300 transition-all"
                        onClick={() => setKpiForm({
                          name: "",
                          metric: "custom",
                          currentValue: "",
                          targetValue: "",
                          unit: "",
                          description: "",
                          priority: "medium",
                          alertsEnabled: false,
                          alertThreshold: "",
                          alertCondition: "below",
                          alertFrequency: "daily",
                          emailNotifications: false,
                          emailRecipients: "",
                        })}
                      >
                        <div className="font-medium text-sm text-foreground">Create Custom KPI</div>
                        <div className="mt-1 text-xs text-muted-foreground">Choose name + unit, then set values</div>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok-kpi-name">KPI Name *</Label>
                    <Input id="tiktok-kpi-name" value={kpiForm.name} onChange={(event) => setKpiForm((form) => ({ ...form, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok-kpi-description">Description</Label>
                    <Textarea
                      id="tiktok-kpi-description"
                      rows={3}
                      maxLength={TIKTOK_GOAL_DESC_MAX}
                      value={kpiForm.description}
                      onChange={(event) => setKpiForm((form) => ({ ...form, description: event.target.value.slice(0, TIKTOK_GOAL_DESC_MAX) }))}
                      placeholder="Describe what this KPI measures and why it's important"
                    />
                    <div className="text-xs text-muted-foreground text-right">{kpiForm.description.length}/{TIKTOK_GOAL_DESC_MAX}</div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-kpi-current">Current Value</Label>
                      <Input id="tiktok-kpi-current" inputMode="decimal" value={kpiForm.currentValue} onChange={(event) => setKpiForm((form) => ({ ...form, currentValue: formatTikTokNumberAsYouType(event.target.value, form.unit) }))} onBlur={(event) => setKpiForm((form) => ({ ...form, currentValue: formatTikTokNumberByUnit(event.target.value, form.unit) }))} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-kpi-target">Target Value *</Label>
                      <Input id="tiktok-kpi-target" inputMode="decimal" value={kpiForm.targetValue} onChange={(event) => setKpiForm((form) => ({ ...form, targetValue: formatTikTokNumberAsYouType(event.target.value, form.unit) }))} onBlur={(event) => setKpiForm((form) => ({ ...form, targetValue: formatTikTokNumberByUnit(event.target.value, form.unit) }))} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-kpi-unit">Unit</Label>
                      <Input id="tiktok-kpi-unit" value={kpiForm.unit} onChange={(event) => setKpiForm((form) => ({ ...form, unit: event.target.value }))} placeholder="%, $, x" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-kpi-priority">Priority</Label>
                      <Select value={kpiForm.priority} onValueChange={(value) => setKpiForm((form) => ({ ...form, priority: value }))}>
                        <SelectTrigger id="tiktok-kpi-priority">
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
                          id="tiktok-kpi-alerts-enabled"
                          checked={kpiForm.alertsEnabled}
                          onCheckedChange={(checked) => setKpiForm((form) => ({ ...form, alertsEnabled: checked === true }))}
                        />
                        <Label htmlFor="tiktok-kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
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
                            <Label htmlFor="tiktok-kpi-alert-threshold">Alert Threshold *</Label>
                            <Input id="tiktok-kpi-alert-threshold" inputMode="decimal" value={kpiForm.alertThreshold} onChange={(event) => setKpiForm((form) => ({ ...form, alertThreshold: event.target.value }))} placeholder="e.g., 80" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-kpi-alert-condition">Alert When</Label>
                            <Select value={kpiForm.alertCondition} onValueChange={(value) => setKpiForm((form) => ({ ...form, alertCondition: value }))}>
                              <SelectTrigger id="tiktok-kpi-alert-condition">
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
                            <Label htmlFor="tiktok-kpi-alert-frequency">Alert Frequency</Label>
                            <Select value={kpiForm.alertFrequency} onValueChange={(value) => setKpiForm((form) => ({ ...form, alertFrequency: value }))}>
                              <SelectTrigger id="tiktok-kpi-alert-frequency">
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
                                id="tiktok-kpi-email-notifications"
                                checked={kpiForm.emailNotifications}
                                onCheckedChange={(checked) => setKpiForm((form) => ({ ...form, emailNotifications: checked === true }))}
                              />
                              <Label htmlFor="tiktok-kpi-email-notifications" className="cursor-pointer font-medium">
                                Send email notifications
                              </Label>
                            </div>
                            {kpiForm.emailNotifications && (
                              <Input value={kpiForm.emailRecipients} onChange={(event) => setKpiForm((form) => ({ ...form, emailRecipients: event.target.value }))} placeholder="email1@example.com, email2@example.com" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {createKpiMutation.error && <p className="text-sm text-red-600">{(createKpiMutation.error as Error).message}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setKpiDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createKpiMutation.mutate()} disabled={createKpiMutation.isPending || !kpiForm.name || !kpiForm.targetValue || (kpiForm.alertsEnabled && !kpiForm.alertThreshold)}>
                    {createKpiMutation.isPending ? "Creating..." : "Create KPI"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={benchmarkDialogOpen} onOpenChange={setBenchmarkDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader className="pb-4 pr-8">
                  <DialogTitle>Create New Benchmark</DialogTitle>
                  <DialogDescription>Set up a new performance benchmark to track against industry standards or custom targets.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium text-foreground">Select Benchmark Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose a metric to benchmark, then fill in the benchmark details below.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {TIKTOK_GOAL_METRICS.map((metric) => {
                        const disabled = isRevenueDependentMetric(metric.key) && !hasAttributedRevenue;
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            disabled={disabled}
                            title={disabled ? "Requires TikTok-scoped attributed revenue." : undefined}
                            className={`p-3 text-left border-2 rounded-lg transition-all ${benchmarkForm.metric === metric.key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-border hover:border-blue-300"} ${disabled ? "opacity-50 cursor-not-allowed hover:border-border" : ""}`}
                            onClick={() => resetBenchmarkForm(metric.key)}
                          >
                            <div className="font-medium text-sm text-foreground">{metric.label}</div>
                            {disabled && <div className="mt-1 text-xs text-muted-foreground">Requires TikTok-scoped attributed revenue.</div>}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="p-3 text-left border-2 rounded-lg border-border hover:border-blue-300 transition-all"
                        onClick={() => setBenchmarkForm({
                          name: "",
                          metric: "custom",
                          currentValue: "",
                          benchmarkValue: "",
                          unit: "",
                          description: "",
                          alertsEnabled: false,
                          alertThreshold: "",
                          alertCondition: "below",
                          alertFrequency: "daily",
                          emailNotifications: false,
                          emailRecipients: "",
                        })}
                      >
                        <div className="font-medium text-sm text-foreground">Create Custom Benchmark</div>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok-benchmark-name">Benchmark Name *</Label>
                    <Input id="tiktok-benchmark-name" value={benchmarkForm.name} onChange={(event) => setBenchmarkForm((form) => ({ ...form, name: event.target.value }))} placeholder="e.g., Target sessions for this campaign" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok-benchmark-description">Description</Label>
                    <Textarea
                      id="tiktok-benchmark-description"
                      rows={3}
                      maxLength={TIKTOK_GOAL_DESC_MAX}
                      value={benchmarkForm.description}
                      onChange={(event) => setBenchmarkForm((form) => ({ ...form, description: event.target.value.slice(0, TIKTOK_GOAL_DESC_MAX) }))}
                      placeholder="What is this benchmark and why does it matter?"
                    />
                    <div className="text-xs text-muted-foreground text-right">{benchmarkForm.description.length}/{TIKTOK_GOAL_DESC_MAX}</div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-benchmark-current">Current Value</Label>
                      <Input id="tiktok-benchmark-current" inputMode="decimal" value={benchmarkForm.currentValue} onChange={(event) => setBenchmarkForm((form) => ({ ...form, currentValue: formatTikTokNumberAsYouType(event.target.value, form.unit) }))} onBlur={(event) => setBenchmarkForm((form) => ({ ...form, currentValue: formatTikTokNumberByUnit(event.target.value, form.unit) }))} placeholder="Auto-filled from TikTok" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-benchmark-value">Benchmark Value *</Label>
                      <Input id="tiktok-benchmark-value" inputMode="decimal" value={benchmarkForm.benchmarkValue} onChange={(event) => setBenchmarkForm((form) => ({ ...form, benchmarkValue: formatTikTokNumberAsYouType(event.target.value, form.unit) }))} onBlur={(event) => setBenchmarkForm((form) => ({ ...form, benchmarkValue: formatTikTokNumberByUnit(event.target.value, form.unit) }))} placeholder="Enter benchmark value" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiktok-benchmark-unit">Unit</Label>
                      <Input id="tiktok-benchmark-unit" value={benchmarkForm.unit} onChange={(event) => setBenchmarkForm((form) => ({ ...form, unit: event.target.value }))} placeholder="%, $, count, etc." />
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tiktok-benchmark-alerts-enabled"
                          checked={benchmarkForm.alertsEnabled}
                          onCheckedChange={(checked) => setBenchmarkForm((form) => ({ ...form, alertsEnabled: checked === true }))}
                        />
                        <Label htmlFor="tiktok-benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                          Enable alerts for this Benchmark
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        Receive notifications when this benchmark crosses a threshold you define.
                      </p>
                    </div>
                    {benchmarkForm.alertsEnabled && (
                      <div className="space-y-4 pl-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-benchmark-alert-threshold">Alert Threshold *</Label>
                            <Input id="tiktok-benchmark-alert-threshold" inputMode="decimal" value={benchmarkForm.alertThreshold} onChange={(event) => setBenchmarkForm((form) => ({ ...form, alertThreshold: event.target.value }))} placeholder="e.g., 80" />
                            <p className="text-xs text-muted-foreground">Value at which to trigger the alert</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-benchmark-alert-condition">Alert When</Label>
                            <Select value={benchmarkForm.alertCondition} onValueChange={(value) => setBenchmarkForm((form) => ({ ...form, alertCondition: value }))}>
                              <SelectTrigger id="tiktok-benchmark-alert-condition">
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
                            <Label htmlFor="tiktok-benchmark-alert-frequency">Alert Frequency</Label>
                            <Select value={benchmarkForm.alertFrequency} onValueChange={(value) => setBenchmarkForm((form) => ({ ...form, alertFrequency: value }))}>
                              <SelectTrigger id="tiktok-benchmark-alert-frequency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="immediate">Immediate</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Bell and Notifications keep one active alert record. This setting controls reminder emails while the breach stays unresolved.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 pt-1">
                              <Checkbox
                                id="tiktok-benchmark-email-notifications"
                                checked={benchmarkForm.emailNotifications}
                                onCheckedChange={(checked) => setBenchmarkForm((form) => ({ ...form, emailNotifications: checked === true }))}
                              />
                              <Label htmlFor="tiktok-benchmark-email-notifications" className="cursor-pointer font-medium">
                                Send email notifications
                              </Label>
                            </div>
                            {benchmarkForm.emailNotifications && (
                              <div className="space-y-2">
                                <Label>Email addresses *</Label>
                                <Input value={benchmarkForm.emailRecipients} onChange={(event) => setBenchmarkForm((form) => ({ ...form, emailRecipients: event.target.value }))} placeholder="email1@example.com, email2@example.com" />
                                <p className="text-xs text-muted-foreground">Comma-separated email addresses for alerts.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {createBenchmarkMutation.error && <p className="text-sm text-red-600">{(createBenchmarkMutation.error as Error).message}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBenchmarkDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createBenchmarkMutation.mutate()} disabled={createBenchmarkMutation.isPending || !benchmarkForm.name || !benchmarkForm.benchmarkValue || (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold)}>
                    {createBenchmarkMutation.isPending ? "Creating..." : "Create Benchmark"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={reportDialogOpen} onOpenChange={(open) => { setReportDialogOpen(open); if (!open) resetReportForm(); }}>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
                </DialogHeader>

                <div className="py-4">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div
                      className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${reportModalStep === "standard" ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-border"}`}
                      onClick={() => {
                        setReportModalStep("standard");
                        setReportForm((form) => ({
                          ...form,
                          reportType: form.reportType === "custom" ? "" : form.reportType,
                          name: form.reportType === "custom" ? "" : form.name,
                        }));
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-6 h-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="text-lg font-bold text-foreground">Standard Templates</h3>
                          <p className="text-sm text-muted-foreground/70 mt-1">Pre-built professional report templates</p>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${reportModalStep === "custom" ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-border"}`}
                      onClick={() => {
                        setReportModalStep("custom");
                        setReportForm((form) => ({ ...form, reportType: "custom", name: form.name || "Custom Report", configuration: form.configuration || cloneTikTokCustomReportConfig() }));
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Settings className="w-6 h-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="text-lg font-bold text-foreground">Custom Report</h3>
                          <p className="text-sm text-muted-foreground/70 mt-1">Build your own customized report</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {reportModalStep === "standard" ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-4">Choose Template</h3>
                        <div className="space-y-4">
                          {TIKTOK_REPORT_TEMPLATES.map((template) => {
                            const selected = reportForm.reportType === template.key;
                            return (
                              <div
                                key={template.key}
                                className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${selected ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-border"}`}
                                onClick={() => setReportForm((form) => ({
                                  ...form,
                                  reportType: template.key,
                                  name: `TikTok ${template.title} Report`,
                                  configuration: {
                                    ...form.configuration,
                                    sections: {
                                      overview: template.key === "overview",
                                      kpis: template.key === "kpis",
                                      benchmarks: template.key === "benchmarks",
                                      ads: template.key === "ads",
                                      insights: template.key === "insights",
                                    },
                                  },
                                }))}
                              >
                                <div className="flex items-start gap-3">
                                  <template.Icon className="w-5 h-5 text-foreground mt-0.5" />
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-foreground">{template.title}</h4>
                                    <p className="text-sm text-muted-foreground/70 mt-1">{template.desc}</p>
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                      {template.chips.map((chip) => (
                                        <span key={chip} className="text-xs px-2 py-1 bg-muted rounded">{chip}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-2">Custom Report</h3>
                        <p className="text-sm text-muted-foreground/70">Choose which TikTok sections to include in your PDF.</p>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-sm font-medium text-foreground mb-3">Sections</div>
                        <div className="space-y-4 text-sm">
                          {[
                            { key: "overview", label: "Overview", options: [["summary", "Summary"], ["sourceMetrics", "Source Metrics"], ["revenueFinancial", "Revenue & Financial"], ["efficiencyMetrics", "Efficiency Metrics"]] as Array<[string, string]> },
                            { key: "kpis", label: "KPIs", options: [] as Array<[string, string]> },
                            { key: "benchmarks", label: "Benchmarks", options: [] as Array<[string, string]> },
                            { key: "ads", label: "Ad Comparison", options: [["availability", "Ad-Level Availability Guidance"]] as Array<[string, string]> },
                            { key: "insights", label: "Insights", options: [["summaryCards", "Executive Summary Cards"], ["revenueGuidance", "Revenue Availability Guidance"], ["sourceDataGuidance", "Source Data Guidance"]] as Array<[string, string]> },
                          ].map((section) => {
                            const expanded = !!expandedCustomReportSections[section.key];
                            const sectionChecked = !!reportForm.configuration?.sections?.[section.key];
                            const subsectionConfig = reportForm.configuration?.subsections?.[section.key] || {};
                            return (
                              <div key={section.key} className="rounded-md border border-border p-3 space-y-3">
                                <button
                                  type="button"
                                  className={`w-full text-left font-medium ${sectionChecked ? "text-foreground" : "text-muted-foreground/80"}`}
                                  onClick={() => setExpandedCustomReportSections((sections) => ({ ...sections, [section.key]: !sections[section.key] }))}
                                >
                                  {section.label}
                                </button>
                                {expanded && (
                                  <div className="pl-6 space-y-2">
                                    {section.key === "kpis" ? (
                                      platformKPIs.length > 0 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {platformKPIs.map((kpi: any) => {
                                            const id = String(kpi.id);
                                            const selectedIds = Array.isArray(reportForm.configuration?.selectedKpiIds) ? reportForm.configuration.selectedKpiIds.map(String) : [];
                                            return (
                                              <label key={id} className="flex items-center gap-2">
                                                <Checkbox
                                                  checked={selectedIds.includes(id)}
                                                  onCheckedChange={(checked) => {
                                                    const nextIds = new Set(selectedIds);
                                                    if (checked === true) nextIds.add(id); else nextIds.delete(id);
                                                    setReportForm((form) => ({
                                                      ...form,
                                                      configuration: {
                                                        ...form.configuration,
                                                        sections: { ...form.configuration.sections, kpis: nextIds.size > 0 },
                                                        selectedKpiIds: Array.from(nextIds),
                                                      },
                                                    }));
                                                  }}
                                                />
                                                <span>{String(kpi.name || kpi.metric || "KPI")}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-muted-foreground/70">No TikTok KPIs have been created yet.</p>
                                      )
                                    ) : section.key === "benchmarks" ? (
                                      platformBenchmarks.length > 0 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {platformBenchmarks.map((benchmark: any) => {
                                            const id = String(benchmark.id);
                                            const selectedIds = Array.isArray(reportForm.configuration?.selectedBenchmarkIds) ? reportForm.configuration.selectedBenchmarkIds.map(String) : [];
                                            return (
                                              <label key={id} className="flex items-center gap-2">
                                                <Checkbox
                                                  checked={selectedIds.includes(id)}
                                                  onCheckedChange={(checked) => {
                                                    const nextIds = new Set(selectedIds);
                                                    if (checked === true) nextIds.add(id); else nextIds.delete(id);
                                                    setReportForm((form) => ({
                                                      ...form,
                                                      configuration: {
                                                        ...form.configuration,
                                                        sections: { ...form.configuration.sections, benchmarks: nextIds.size > 0 },
                                                        selectedBenchmarkIds: Array.from(nextIds),
                                                      },
                                                    }));
                                                  }}
                                                />
                                                <span>{String(benchmark.name || benchmark.metric || "Benchmark")}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-muted-foreground/70">No TikTok Benchmarks have been created yet.</p>
                                      )
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {section.options.map(([optionKey, optionLabel]) => (
                                          <label key={optionKey} className="flex items-center gap-2">
                                            <Checkbox
                                              checked={subsectionConfig[optionKey] === true}
                                              onCheckedChange={(checked) => {
                                                setReportForm((form) => {
                                                  const nextSubsections = {
                                                    ...form.configuration.subsections,
                                                    [section.key]: { ...(form.configuration.subsections?.[section.key] || {}), [optionKey]: checked === true },
                                                  };
                                                  const hasSelectedOption = Object.values(nextSubsections[section.key] || {}).some(Boolean);
                                                  return {
                                                    ...form,
                                                    configuration: {
                                                      ...form.configuration,
                                                      sections: { ...form.configuration.sections, [section.key]: hasSelectedOption },
                                                      subsections: nextSubsections,
                                                    },
                                                  };
                                                });
                                              }}
                                            />
                                            <span>{optionLabel}</span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Checkbox id="tiktok-report-schedule" checked={reportForm.scheduleEnabled} onCheckedChange={(checked) => setReportForm((form) => ({ ...form, scheduleEnabled: checked === true }))} />
                      <Label htmlFor="tiktok-report-schedule" className="text-base font-semibold cursor-pointer">Schedule Automated Reports</Label>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="tiktok-report-name">Report Name</Label>
                        <Input id="tiktok-report-name" value={reportForm.name} onChange={(event) => setReportForm((form) => ({ ...form, name: event.target.value }))} placeholder="Enter report name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tiktok-report-description">Description (Optional)</Label>
                        <Textarea id="tiktok-report-description" rows={3} value={reportForm.description} onChange={(event) => setReportForm((form) => ({ ...form, description: event.target.value }))} placeholder="Add a description for this report" />
                      </div>
                    </div>

                    {reportForm.scheduleEnabled && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="tiktok-schedule-frequency">Frequency</Label>
                          <Select value={reportForm.scheduleFrequency} onValueChange={(value) => setReportForm((form) => ({ ...form, scheduleFrequency: value }))}>
                            <SelectTrigger id="tiktok-schedule-frequency"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {reportForm.scheduleFrequency === "weekly" && (
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-schedule-day">Day of Week</Label>
                            <Select value={reportForm.scheduleDayOfWeek} onValueChange={(value) => setReportForm((form) => ({ ...form, scheduleDayOfWeek: value }))}>
                              <SelectTrigger id="tiktok-schedule-day"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monday">Monday</SelectItem>
                                <SelectItem value="tuesday">Tuesday</SelectItem>
                                <SelectItem value="wednesday">Wednesday</SelectItem>
                                <SelectItem value="thursday">Thursday</SelectItem>
                                <SelectItem value="friday">Friday</SelectItem>
                                <SelectItem value="saturday">Saturday</SelectItem>
                                <SelectItem value="sunday">Sunday</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {reportForm.scheduleFrequency === "quarterly" && (
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-quarter-timing">Quarter Timing</Label>
                            <Select value={reportForm.quarterTiming} onValueChange={(value) => setReportForm((form) => ({ ...form, quarterTiming: value }))}>
                              <SelectTrigger id="tiktok-quarter-timing"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                                <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70">Choose whether to run reports at the start or end of each quarter</p>
                          </div>
                        )}

                        {(reportForm.scheduleFrequency === "monthly" || reportForm.scheduleFrequency === "quarterly") && (
                          <div className="space-y-2">
                            <Label htmlFor="tiktok-schedule-day-month">Day of Month</Label>
                            <Select value={reportForm.scheduleDayOfMonth} onValueChange={(value) => setReportForm((form) => ({ ...form, scheduleDayOfMonth: value }))}>
                              <SelectTrigger id="tiktok-schedule-day-month"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {reportForm.scheduleFrequency === "quarterly" ? (
                                  <>
                                    <SelectItem value="first">First day of month</SelectItem>
                                    <SelectItem value="last">Last day of month</SelectItem>
                                    <SelectItem value="15">Mid-month (15th)</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="first">1st (First day of month)</SelectItem>
                                    <SelectItem value="last">Last day of month</SelectItem>
                                    <SelectItem value="15">15th (Mid-month)</SelectItem>
                                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                      <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70">For months with fewer days, the report will run on the last available day.</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="tiktok-report-time">Time</Label>
                          <Select value={reportForm.scheduleTime} onValueChange={(value) => setReportForm((form) => ({ ...form, scheduleTime: value }))}>
                            <SelectTrigger id="tiktok-report-time"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIKTOK_REPORT_TIMES.map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground/70">All times are saved in the selected time zone.</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tiktok-report-timezone">Time Zone</Label>
                          <Input id="tiktok-report-timezone" value={reportForm.scheduleTimeZone} onChange={(event) => setReportForm((form) => ({ ...form, scheduleTimeZone: event.target.value }))} placeholder="UTC" />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tiktok-report-recipients">Email Recipients</Label>
                          <Input id="tiktok-report-recipients" value={reportForm.scheduleRecipients} onChange={(event) => setReportForm((form) => ({ ...form, scheduleRecipients: event.target.value }))} placeholder="Enter email addresses (comma-separated)" />
                          <p className="text-sm text-muted-foreground/70">Reports will be automatically generated and sent to these email addresses</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {saveReportMutation.error && <p className="text-sm text-red-600">{(saveReportMutation.error as Error).message}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => saveReportMutation.mutate()} disabled={saveReportMutation.isPending || !reportSelectionMade || (reportForm.scheduleEnabled && !reportForm.scheduleRecipients.trim())}>
                    {saveReportMutation.isPending ? "Saving..." : editingReport ? "Update Report" : reportForm.scheduleEnabled ? "Schedule Report" : "Generate & Download Report"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}

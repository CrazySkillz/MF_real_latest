import { useQuery, useMutation, useQueryClient, keepPreviousData, useQueries } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target, Plus, X, Trash2, Edit, MoreVertical, TrendingDown, DollarSign, BadgeCheck, AlertTriangle, AlertCircle, Download, FileText, Settings, RefreshCw, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { SiGoogle } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import InteractiveWorldMap from "@/components/InteractiveWorldMap";
import SimpleGeographicMap from "@/components/SimpleGeographicMap";
import WorldMapSVG from "@/components/WorldMapSVG";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { AddSpendWizardModal } from "@/components/AddSpendWizardModal";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";
import GA4CampaignComparison from "@/pages/ga4-campaign-comparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { computeCpa, computeConversionRatePercent, computeProgress, computeRoiPercent, computeRoasPercent } from "@shared/metric-math";

interface Campaign {
  id: string;
  name: string;
  platform?: string;
  status: string;
  ga4CampaignFilter?: string;
}

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
  newUsers?: number;
  userEngagementDuration?: number;
  engagedSessions?: number;
  engagementRate?: number;
  eventCount?: number;
  eventsPerSession?: number;
  screenPageViewsPerSession?: number;
}

const SELECT_UNIT = "__select_unit__";
const BENCHMARK_DESC_MAX = 200;
const KPI_DESC_MAX = 200;

const kpiFormSchema = z.object({
  name: z.string().min(1, "KPI name is required"),
  metric: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  currentValue: z.string().min(1, "Current value is required"),
  targetValue: z.string().min(1, "Target value is required"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  timeframe: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("daily"),
  trackingPeriod: z.number().min(1).max(365).default(1),
  rollingAverage: z.enum(["1day", "7day", "30day", "none"]).default("7day"),
  targetDate: z.string().optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  alertsEnabled: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  slackNotifications: z.boolean().default(false),
  alertFrequency: z.enum(["immediate", "daily", "weekly"]).default("daily"),
});

type KPIFormData = z.infer<typeof kpiFormSchema>;

interface Benchmark {
  id: string;
  campaignId?: string;
  platformType: string;
  category: string;
  name: string;
  description?: string;
  metric?: string;
  benchmarkValue: string;
  currentValue?: string;
  unit: string;
  benchmarkType: string;
  source?: string;
  industry?: string;
  geoLocation?: string;
  period: string;
  status: string;
  variance?: string;
  confidenceLevel?: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export default function GA4Metrics() {
  const [, params] = useRoute("/campaigns/:id/ga4-metrics");
  const campaignId = params?.id;
  // GA4 UI now operates on strict daily values (persisted server-side).
  // We keep an internal lookback window for charts/supporting reports, but there is no user-selectable date range.
  // Need at least 60 days to compute "last 30 vs prior 30" and 14 days for WoW anomaly detection.
  // Use 90 to be safe (and to keep mock simulation consistent with existing mock logic).
  // dateRange MUST match the daily lookback so Summary totals equal the sum of daily rows.
  const GA4_DAILY_LOOKBACK_DAYS = 90;
  const dateRange = "90days";
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [showAutoRefresh, setShowAutoRefresh] = useState(false);
  const [showGa4CampaignPicker, setShowGa4CampaignPicker] = useState(false);
  const [ga4CampaignSearch, setGa4CampaignSearch] = useState("");
  const [selectedGa4Campaigns, setSelectedGa4Campaigns] = useState<string[]>([]);
  const [showKPIDialog, setShowKPIDialog] = useState(false);
  const [selectedKPITemplate, setSelectedKPITemplate] = useState<any>(null);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [deleteKPIId, setDeleteKPIId] = useState<string | null>(null);
  const [showSpendDialog, setShowSpendDialog] = useState(false);
  const [showDeleteSpendDialog, setShowDeleteSpendDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [showDeleteRevenueDialog, setShowDeleteRevenueDialog] = useState(false);
  const [deleteBenchmarkId, setDeleteBenchmarkId] = useState<string | null>(null);
  const [showDeleteBenchmarkDialog, setShowDeleteBenchmarkDialog] = useState(false);
  // Spend ingestion is handled via AddSpendWizardModal and persisted server-side.

  // Benchmark-related state
  const [showCreateBenchmark, setShowCreateBenchmark] = useState(false);
  const [selectedBenchmarkTemplate, setSelectedBenchmarkTemplate] = useState<any>(null);
  const [editingBenchmark, setEditingBenchmark] = useState<Benchmark | null>(null);
  const [showGA4ReportModal, setShowGA4ReportModal] = useState(false);
  const [ga4ReportModalStep, setGa4ReportModalStep] = useState<"standard" | "custom">("standard");
  const [editingGA4ReportId, setEditingGA4ReportId] = useState<string | null>(null);
  const [deleteGA4ReportId, setDeleteGA4ReportId] = useState<string | null>(null);
  // Campaign Comparison tab state
  const [campaignComparisonMetric, setCampaignComparisonMetric] = useState<string>("sessions");
  // Insights Trends state
  const [insightsTrendMode, setInsightsTrendMode] = useState<"daily" | "7d" | "30d">("daily");
  const [insightsTrendMetric, setInsightsTrendMetric] = useState<string>("sessions");
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);
  const [ga4ReportForm, setGa4ReportForm] = useState<{
    name: string;
    description: string;
    reportType: string;
    configuration: any;
  }>({
    name: "",
    description: "",
    reportType: "overview",
    configuration: {
      sections: { overview: true, acquisition: false, trends: false, kpis: false, benchmarks: false },
    },
  });
  const [newBenchmark, setNewBenchmark] = useState({
    name: "",
    category: "",
    benchmarkType: "custom",
    unit: SELECT_UNIT as any,
    benchmarkValue: "",
    currentValue: "",
    metric: "",
    industry: "",
    geoLocation: "",
    description: "",
    source: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedGA4PropertyId, setSelectedGA4PropertyId] = useState<string>("");

  const parseStoredGa4CampaignFilter = (raw: any): string[] => {
    if (raw === null || raw === undefined) return [];
    const s = String(raw || "").trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    return [s];
  };

  // Spend is now persisted server-side (via the Add Spend wizard), so we no longer store
  // manual overrides or spend mode in localStorage.

  const kpiForm = useForm<KPIFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      metric: "",
      description: "",
      unit: "%",
      currentValue: "",
      targetValue: "",
      priority: "medium",
      timeframe: "daily",
      trackingPeriod: 1,
      rollingAverage: "7day",
      targetDate: "",
      alertThreshold: 80,
      alertsEnabled: true,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: "daily",
    },
  });

  const stripNumberFormatting = (s: string) => String(s || "").replace(/,/g, "").trim();

  const isIsoCurrencyCode = (unit: string) => /^[A-Z]{3}$/.test(String(unit || "").trim());

  const formatNumberByUnit = (raw: string, unit: string) => {
    const cleaned = stripNumberFormatting(raw);
    if (!cleaned) return "";
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return raw;
    const decimals = unit === "count" ? 0 : 2;
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // UX-friendly formatting that updates while typing (keeps decimals as typed; adds commas).
  // Final normalization (e.g., forcing 2 decimals) still happens onBlur via formatNumberByUnit.
  const formatNumberAsYouType = (raw: string, unit: string) => {
    const input = String(raw || "");
    const noCommas = stripNumberFormatting(input);
    if (!noCommas) return "";

    const neg = noCommas.startsWith("-");
    const body = neg ? noCommas.slice(1) : noCommas;

    if (unit === "count") {
      const digitsOnly = body.replace(/\D+/g, "");
      if (!digitsOnly) return neg ? "-" : "";
      const grouped = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return `${neg ? "-" : ""}${grouped}`;
    }

    const sanitized = body.replace(/[^0-9.]/g, "");
    if (!sanitized) return neg ? "-" : "";
    const dotIdx = sanitized.indexOf(".");
    const hasDot = dotIdx >= 0;
    let intPart = hasDot ? sanitized.slice(0, dotIdx) : sanitized;
    let fracPart = hasDot ? sanitized.slice(dotIdx + 1).replace(/\./g, "") : "";

    // If user types "." first, show "0."
    if (hasDot && !intPart) intPart = "0";
    // Avoid empty integer part (but keep empty when user is typing "-")
    if (!intPart && !hasDot) return neg ? "-" : "";

    const intGrouped = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") || (hasDot ? "0" : "");

    return `${neg ? "-" : ""}${intGrouped}${hasDot ? "." : ""}${fracPart}`;
  };

  const openCreateKPI = () => {
    setEditingKPI(null);
    setSelectedKPITemplate(null);
    kpiForm.reset({ ...kpiForm.getValues(), name: "", metric: "", description: "", unit: "%", currentValue: "", targetValue: "", priority: "medium" });
    setShowKPIDialog(true);
  };

  // GA4 rates can come back as a ratio (0..1) or a percent (0..100). Normalize to percent.
  const normalizeRateToPercent = (v: number) => (v <= 1 ? v * 100 : v);

  const getDefaultKpiDescription = (name: string): string | undefined => {
    const n = String(name || "").trim();
    switch (n) {
      case "ROAS":
        return "Revenue generated per dollar of spend (as a %)";
      case "ROI":
        return "Return relative to spend (revenue-based ROI)";
      case "CPA":
        return "Average cost per conversion";
      case "Revenue":
        return "Total revenue in GA4 for the selected period";
      case "Total Conversions":
        return "Total GA4 conversions for the selected period";
      case "Engagement Rate":
        return "Percent of sessions that were engaged (GA4 engagement rate)";
      case "Conversion Rate":
        return "Overall conversion rate for the selected period";
      case "Total Users":
        return "Total users for the selected period";
      case "Total Sessions":
        return "Total sessions for the selected period";
      default:
        return undefined;
    }
  };

  // KPI templates should be executive-grade and consistent with the GA4 Overview's spend/revenue logic.
  // We compute "current" values live elsewhere; this helper is used only when creating a KPI from a template
  // (to store an initial snapshot value) and uses strict daily values.
  const calculateKPIValueFromSources = (templateName: string, sources: {
    revenue: number;
    conversions: number;
    sessions: number;
    users: number;
    engagementRate?: number;
    spend: number;
  }) => {
    try {
      const revenue = Number(sources.revenue || 0);
      const conversions = Number(sources.conversions || 0);
      const sessions = Number(sources.sessions || 0);
      const users = Number(sources.users || 0);
      const engagementRate = Number(sources.engagementRate || 0);
      const spend = Number(sources.spend || 0);

      switch (templateName) {
        case "Revenue":
          return revenue.toFixed(2);
        case "Total Conversions":
          return String(Math.round(conversions));
        case "Conversion Rate":
          return sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : "0.00";
        case "Engagement Rate":
          return normalizeRateToPercent(engagementRate).toFixed(2);
        case "Total Users":
          return String(Math.round(users));
        case "Total Sessions":
          return String(Math.round(sessions));
        case "ROAS":
          // Present ROAS as a percentage (Revenue ÷ Spend × 100) for consistency with modal units.
          return spend > 0 ? ((revenue / spend) * 100).toFixed(2) : "0.00";
        case "ROI":
          return spend > 0 ? (((revenue - spend) / spend) * 100).toFixed(2) : "0.00";
        case "CPA":
          return conversions > 0 ? (spend / conversions).toFixed(2) : "0.00";
        default:
          return "0.00";
      }
    } catch (e) {
      console.error("Error calculating KPI value:", e);
      return "0.00";
    }
  };

  // Create KPI mutation
  const createKPIMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      // Store an initial snapshot currentValue (optional), but ensure it matches the GA4 Overview logic:
      // GA4 Breakdown totals + Spend totals (+ LinkedIn spend fallback).
      let calculatedValue = "0.00";
      if (selectedKPITemplate) {
        try {
          calculatedValue = calculateKPIValueFromSources(selectedKPITemplate.name, {
            // Use the same daily sources as the GA4 Overview:
            // - GA4 daily: sessions/users/conversions/revenue
            // - Imported revenue daily: only if GA4 revenue is 0
            // - Spend daily: imported spend only (no LinkedIn fallback in daily mode)
            revenue: Number(financialRevenue || 0),
            conversions: Number(financialConversions || 0),
            sessions: Number(breakdownTotals.sessions || 0),
            users: Number(breakdownTotals.users || 0),
            engagementRate: dailySummedTotals.engagementRate || Number((ga4Metrics as any)?.engagementRate || 0),
            spend: Number(financialSpend || 0),
          });
        } catch (error) {
          console.error("Error fetching platform data for KPI calculation:", error);
        }
      }

      const response = await fetch(`/api/platforms/google_analytics/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          campaignId, // Scope KPI to this MetricMind campaign
          // GA4 KPIs are defined and evaluated on daily values (no UI windowing/scaling).
          timeframe: data.timeframe || "daily",
          trackingPeriod: data.trackingPeriod || 1,
          // Prefer the user-visible current value (prefilled live when selecting a template).
          // Fallback to the computed value if for any reason the field is empty.
          currentValue: stripNumberFormatting((data as any)?.currentValue) || calculatedValue,
          targetValue: stripNumberFormatting((data as any)?.targetValue),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create KPI");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/kpis`, campaignId] });
      setShowKPIDialog(false);
      kpiForm.reset();
      toast({ title: "KPI created successfully" });
    },
    onError: (error) => {
      console.error("KPI creation error:", error);
      toast({
        title: "Failed to create KPI",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    },
  });

  const updateKPIMutation = useMutation({
    mutationFn: async (payload: { kpiId: string; data: KPIFormData }) => {
      const resp = await fetch(`/api/platforms/google_analytics/kpis/${encodeURIComponent(payload.kpiId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload.data,
          campaignId,
          // GA4 KPIs are defined and evaluated on daily values (no UI windowing/scaling).
          timeframe: (editingKPI as any)?.timeframe || payload.data.timeframe || "daily",
          trackingPeriod: (editingKPI as any)?.trackingPeriod || payload.data.trackingPeriod || 1,
          currentValue: stripNumberFormatting((payload.data as any)?.currentValue),
          targetValue: stripNumberFormatting((payload.data as any)?.targetValue),
        }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.message || json?.error || "Failed to update KPI");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/kpis`, campaignId] });
      setShowKPIDialog(false);
      setEditingKPI(null);
      kpiForm.reset();
      toast({ title: "KPI updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update KPI",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete KPI mutation
  const deleteKPIMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const response = await fetch(`/api/platforms/google_analytics/kpis/${kpiId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete KPI";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Handle successful response
      try {
        return await response.json();
      } catch {
        // If response is not JSON (e.g., empty body), return success
        return { message: "KPI deleted successfully" };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/kpis`, campaignId] });
      toast({ title: "KPI deleted successfully" });
    },
    onError: (error) => {
      console.error("KPI deletion error:", error);
      toast({
        title: "Failed to delete KPI",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    },
  });

  // Mock refresh mutation: simulate a daily data update with known values
  const mockRefreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/ga4/mock-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: selectedGA4PropertyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Mock refresh failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all GA4 queries so the UI picks up the new data
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/ga4-to-date`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`] });
      toast({
        title: "Mock Refresh Complete",
        description: data?.summary || "Daily mock data injected. Check cards for updated values.",
      });
    },
    onError: (error) => {
      toast({ title: "Mock refresh failed", description: error.message, variant: "destructive" });
    },
  });

  // GA4 Reports (stored as platform reports)
  const { data: ga4Reports, isLoading: ga4ReportsLoading } = useQuery<any[]>({
    queryKey: ["/api/platforms/google_analytics/reports", campaignId],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const resp = await fetch(`/api/platforms/google_analytics/reports?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!resp.ok) return [];
      const json = await resp.json().catch(() => []);
      return Array.isArray(json) ? json : [];
    },
  });

  const createGA4ReportMutation = useMutation({
    mutationFn: async (payload: any) => {
      const resp = await fetch(`/api/platforms/google_analytics/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.message || json?.error || "Failed to create report");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/reports", campaignId] });
      setShowGA4ReportModal(false);
      setEditingGA4ReportId(null);
      toast({ title: "Report saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save report", description: err?.message, variant: "destructive" });
    },
  });

  const updateGA4ReportMutation = useMutation({
    mutationFn: async ({ reportId, payload }: { reportId: string; payload: any }) => {
      const resp = await fetch(`/api/platforms/google_analytics/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.message || json?.error || "Failed to update report");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/reports", campaignId] });
      setShowGA4ReportModal(false);
      setEditingGA4ReportId(null);
      toast({ title: "Report updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update report", description: err?.message, variant: "destructive" });
    },
  });

  const deleteGA4ReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const resp = await fetch(`/api/platforms/google_analytics/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.message || json?.error || "Failed to delete report");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/reports", campaignId] });
      toast({ title: "Report deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete report", description: err?.message, variant: "destructive" });
    },
  });

  const onSubmitKPI = async (data: KPIFormData) => {
    const cleaned: KPIFormData = {
      ...data,
      currentValue: stripNumberFormatting(data.currentValue),
      targetValue: stripNumberFormatting(data.targetValue),
    };

    // For custom KPIs, require an explicit unit selection.
    if (!cleaned.unit || String(cleaned.unit) === SELECT_UNIT) {
      toast({
        title: "Select a unit",
        description: "Please choose a unit before saving this KPI.",
        variant: "destructive",
      });
      return;
    }

    // If Description is blank, use the template default (exec-friendly).
    const desc = String(cleaned.description || "").trim();
    if (desc.length > KPI_DESC_MAX) {
      toast({
        title: "Description is too long",
        description: `Please keep the description under ${KPI_DESC_MAX} characters.`,
        variant: "destructive",
      });
      return;
    }
    if (!desc) {
      const defaultDesc = getDefaultKpiDescription(cleaned.name);
      if (defaultDesc) cleaned.description = defaultDesc;
    }

    if (editingKPI?.id) {
      updateKPIMutation.mutate({ kpiId: String(editingKPI.id), data: cleaned });
      return;
    }
    createKPIMutation.mutate(cleaned);
  };

  const onDeleteKPI = (kpiId: string) => {
    setDeleteKPIId(kpiId);
  };

  const confirmDeleteKPI = () => {
    if (deleteKPIId) {
      deleteKPIMutation.mutate(deleteKPIId);
      setDeleteKPIId(null);
    }
  };

  // Benchmark mutations
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const response = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...benchmarkData,
          // Enterprise-grade: benchmarks are campaign-scoped by default.
          // Platform-level (campaignId=null) benchmarks are treated as "library/templates" and should not
          // appear as active benchmarks inside a newly created campaign.
          campaignId: String(campaignId || ""),
          platformType: "google_analytics",
          period: "monthly",
          status: "active"
        }),
      });
      if (!response.ok) throw new Error("Failed to create benchmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")] });
      setShowCreateBenchmark(false);
      setSelectedBenchmarkTemplate(null);
      setEditingBenchmark(null);
      setNewBenchmark({
        name: "",
        category: "",
        benchmarkType: "custom",
        unit: SELECT_UNIT as any,
        benchmarkValue: "",
        currentValue: "",
        metric: "",
        industry: "",
        geoLocation: "",
        description: "",
        source: ""
      });
      toast({ title: "Benchmark created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create benchmark", description: error.message, variant: "destructive" });
    },
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ benchmarkId, data }: { benchmarkId: string; data: any }) => {
      const response = await fetch(`/api/benchmarks/${benchmarkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          campaignId: String(campaignId || ""),
          platformType: "google_analytics",
          period: "monthly",
          status: "active",
        }),
      });
      if (!response.ok) throw new Error("Failed to update benchmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")] });
      setShowCreateBenchmark(false);
      setSelectedBenchmarkTemplate(null);
      setEditingBenchmark(null);
      setNewBenchmark({
        name: "",
        category: "",
        benchmarkType: "custom",
        unit: SELECT_UNIT as any,
        benchmarkValue: "",
        currentValue: "",
        metric: "",
        industry: "",
        geoLocation: "",
        description: "",
        source: "",
      });
      toast({ title: "Benchmark updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update benchmark", description: error.message, variant: "destructive" });
    },
  });

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkId: string) => {
      const response = await fetch(`/api/benchmarks/${benchmarkId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete benchmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")] });
      toast({ title: "Benchmark deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete benchmark", description: error.message, variant: "destructive" });
    },
  });

  // Benchmark handlers
  const handleCreateBenchmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (String(newBenchmark.benchmarkType || "custom") === "industry" && !newBenchmark.metric) {
      toast({ title: "Please select a benchmark metric", variant: "destructive" });
      return;
    }
    const cleanedBenchmark = {
      ...newBenchmark,
      currentValue: stripNumberFormatting(String(newBenchmark.currentValue || "")),
      benchmarkValue: stripNumberFormatting(String(newBenchmark.benchmarkValue || "")),
      // Backward-compatible storage: use 'goal' for custom benchmarks in the DB.
      benchmarkType: String(newBenchmark.benchmarkType || "custom") === "custom" ? "goal" : (newBenchmark.benchmarkType || "industry"),
    };
    // Benchmarks table requires a category; for fully custom benchmarks (no metric selected),
    // default to a generic category.
    if (!String(cleanedBenchmark.category || "").trim()) {
      cleanedBenchmark.category = newBenchmark.metric ? deriveBenchmarkCategoryFromMetric(String(newBenchmark.metric)) : "performance";
    }
    if (!String(cleanedBenchmark.description || "").trim()) {
      cleanedBenchmark.description = getDefaultBenchmarkDescription(String(newBenchmark.metric || ""));
    }
    if (String(cleanedBenchmark.description || "").length > BENCHMARK_DESC_MAX) {
      toast({
        title: "Description is too long",
        description: `Please keep the description under ${BENCHMARK_DESC_MAX} characters.`,
        variant: "destructive",
      });
      return;
    }
    if (!cleanedBenchmark.unit || String(cleanedBenchmark.unit) === SELECT_UNIT) {
      toast({
        title: "Select a unit",
        description: "Please choose a unit before saving this benchmark.",
        variant: "destructive",
      });
      return;
    }
    if (String(newBenchmark.benchmarkType || "custom") === "custom" && !String(cleanedBenchmark.currentValue || "").trim()) {
      toast({
        title: "Current Value is required",
        description: "Please enter a Current Value for a custom benchmark.",
        variant: "destructive",
      });
      return;
    }
    if (!cleanedBenchmark.name || !cleanedBenchmark.category || !cleanedBenchmark.benchmarkValue || !cleanedBenchmark.unit) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (editingBenchmark?.id) {
      updateBenchmarkMutation.mutate({ benchmarkId: String(editingBenchmark.id), data: cleanedBenchmark });
      return;
    }
    createBenchmarkMutation.mutate(cleanedBenchmark);
  };

  const handleEditBenchmark = (benchmark: Benchmark) => {
    setEditingBenchmark(benchmark);
    setShowCreateBenchmark(true);
    const metric = (benchmark as any).metric || "";
    const normalizedType =
      String((benchmark as any)?.benchmarkType || "").toLowerCase() === "goal"
        ? "custom"
        : (benchmark as any)?.benchmarkType || "industry";
    setSelectedBenchmarkTemplate(metric ? { metric } : null);
    setNewBenchmark({
      name: benchmark.name || "",
      category: benchmark.category || "",
      benchmarkType: normalizedType,
      unit: benchmark.unit || "",
      benchmarkValue: formatNumberByUnit(String(benchmark.benchmarkValue ?? ""), String(benchmark.unit || "%")),
      currentValue: formatNumberByUnit(String(benchmark.currentValue ?? ""), String(benchmark.unit || "%")),
      metric: metric,
      industry: benchmark.industry || "",
      geoLocation: benchmark.geoLocation || "",
      description: benchmark.description || "",
      source: benchmark.source || "",
    });
  };

  const handleDeleteBenchmark = (benchmarkId: string) => {
    setDeleteBenchmarkId(benchmarkId);
    setShowDeleteBenchmarkDialog(true);
  };

  const confirmDeleteBenchmark = () => {
    if (!deleteBenchmarkId) return;
    deleteBenchmarkMutation.mutate(deleteBenchmarkId);
    setDeleteBenchmarkId(null);
    setShowDeleteBenchmarkDialog(false);
  };

  const getBenchmarkMetricLabel = (metricKey: string | undefined, fallbackName?: string) => {
    const m = String(metricKey || "").trim();
    switch (m) {
      case "roas":
        return "ROAS";
      case "roi":
        return "ROI";
      case "cpa":
        return "CPA";
      case "revenue":
        return "Revenue";
      case "conversions":
        return "Total Conversions";
      case "conversionRate":
        return "Conversion Rate";
      case "engagementRate":
        return "Engagement Rate";
      case "users":
        return "Total Users";
      case "sessions":
        return "Total Sessions";
      default:
        return String(fallbackName || m || "Benchmark");
    }
  };

  const getDefaultBenchmarkDescription = (metricKey: string): string => {
    switch (String(metricKey || "")) {
      case "roas":
        return "Revenue generated per dollar of spend (as a %)";
      case "roi":
        return "Return relative to spend (revenue-based ROI)";
      case "cpa":
        return "Average cost per conversion";
      case "revenue":
        return "Total revenue in GA4 for the selected period";
      case "conversions":
        return "Total GA4 conversions for the selected period";
      case "conversionRate":
        return "Overall conversion rate for the selected period";
      case "engagementRate":
        return "Percent of sessions that were engaged (GA4 engagement rate)";
      case "users":
        return "Total users for the selected period";
      case "sessions":
        return "Total sessions for the selected period";
      default:
        return "Benchmark target for this metric.";
    }
  };

  // UX: format numbers while typing without forcing trailing decimals.
  const formatNumberWhileTyping = (raw: string, unit: string) => {
    const cleaned = stripNumberFormatting(String(raw || ""));
    if (cleaned === "") return "";
    if (cleaned === "-" || cleaned === "." || cleaned === "-.") return cleaned;

    const isCount = String(unit) === "count";
    const neg = cleaned.startsWith("-") ? "-" : "";
    const unsigned = cleaned.replace(/^-/, "");

    if (isCount) {
      const digitsOnly = unsigned.replace(/[^\d]/g, "");
      if (!digitsOnly) return neg ? "-" : "";
      const n = Number(digitsOnly);
      if (!Number.isFinite(n)) return raw;
      return `${neg}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    const parts = unsigned.split(".");
    const intPart = parts[0].replace(/[^\d]/g, "");
    const fracPart = (parts[1] ?? "").replace(/[^\d]/g, "");
    const intFormatted = intPart ? Number(intPart).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0";
    if (unsigned.includes(".")) return `${neg}${intFormatted}.${fracPart}`;
    return `${neg}${intFormatted}`;
  };

  const resetBenchmarkDraft = () => {
    if (editingBenchmark) {
      const metric = (editingBenchmark as any).metric || "";
      const normalizedType =
        String((editingBenchmark as any)?.benchmarkType || "").toLowerCase() === "goal"
          ? "custom"
          : (editingBenchmark as any)?.benchmarkType || "industry";
      setSelectedBenchmarkTemplate(metric ? { metric } : null);
      setNewBenchmark({
        name: editingBenchmark.name || "",
        category: editingBenchmark.category || "",
        benchmarkType: normalizedType,
        unit: editingBenchmark.unit || "",
        benchmarkValue: formatNumberByUnit(String((editingBenchmark as any).benchmarkValue ?? ""), String((editingBenchmark as any).unit || "%")),
        currentValue: formatNumberByUnit(String((editingBenchmark as any).currentValue ?? ""), String((editingBenchmark as any).unit || "%")),
        metric: metric,
        industry: (editingBenchmark as any).industry || "",
        geoLocation: (editingBenchmark as any).geoLocation || "",
        description: (editingBenchmark as any).description || "",
        source: (editingBenchmark as any).source || "",
      });
      return;
    }

    setSelectedBenchmarkTemplate(null);
    setNewBenchmark({
      name: "",
      category: "",
      benchmarkType: "custom",
      unit: SELECT_UNIT as any,
      benchmarkValue: "",
      currentValue: "",
      metric: "",
      industry: "",
      geoLocation: "",
      description: "",
      source: "",
    });
  };

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch all campaigns for this client — used to filter Ad Comparison tab to only imported campaigns
  const { data: allCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns", { clientId: (campaign as any)?.clientId }],
    queryFn: async () => {
      const cid = (campaign as any)?.clientId;
      const url = cid
        ? `/api/campaigns?clientId=${encodeURIComponent(cid)}`
        : "/api/campaigns";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    enabled: !!campaign,
  });

  // Helper functions for KPI display
  const campaignCurrency = String((campaign as any)?.currency || "USD");
  const formatMoney = (n: number) => {
    const num = Number(n || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: campaignCurrency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${campaignCurrency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const formatValue = (value: string, unit: string) => {
    const numValue = parseFloat(value);
    switch (unit) {
      case "%":
        return `${numValue.toFixed(2)}%`;
      case "$": {
        // Legacy stored KPIs may use "$" as the unit; render using the campaign's configured currency.
        return formatMoney(numValue);
      }
      case "ratio":
        return `${numValue.toFixed(2)}x`;
      default:
        if (isIsoCurrencyCode(unit)) {
          try {
            return new Intl.NumberFormat(undefined, { style: "currency", currency: unit, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
          } catch {
            return numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        }
        return numValue.toLocaleString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "achieved":
        return "bg-green-100 text-green-800 border-green-200";
      case "tracking":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "at_risk":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getKpiIcon = (kpiName: string) => {
    const n = String(kpiName || "").toLowerCase();
    if (n === "revenue") return { Icon: DollarSign, color: "text-emerald-600" };
    if (n === "roas" || n === "roi") return { Icon: TrendingUp, color: "text-violet-600" };
    if (n === "cpa") return { Icon: Target, color: "text-blue-600" };
    if (n.includes("conversion")) return { Icon: Target, color: "text-indigo-600" };
    if (n.includes("engagement")) return { Icon: MousePointer, color: "text-orange-600" };
    if (n.includes("session")) return { Icon: Clock, color: "text-slate-600" };
    if (n.includes("user")) return { Icon: Users, color: "text-slate-600" };
    return { Icon: BarChart3, color: "text-slate-600" };
  };

  // Helper function for benchmark values
  const formatBenchmarkValue = (value: string | undefined, unit: string) => {
    if (!value) return "N/A";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "N/A";

    switch (unit) {
      case "%":
        return `${numValue.toFixed(1)}%`;
      case "$": {
        // Legacy stored Benchmarks may use "$" as the unit; render using the campaign's configured currency.
        return formatMoney(numValue);
      }
      case "ratio":
        return `${numValue.toFixed(2)}:1`;
      case "seconds":
        return `${numValue.toFixed(1)}s`;
      case "count":
        return numValue.toLocaleString();
      default:
        if (isIsoCurrencyCode(unit)) {
          try {
            return new Intl.NumberFormat(undefined, { style: "currency", currency: unit, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
          } catch {
            return numValue.toLocaleString();
          }
        }
        return numValue.toLocaleString();
    }
  };

  const selectedGa4CampaignFilterList = useMemo(() => {
    return parseStoredGa4CampaignFilter((campaign as any)?.ga4CampaignFilter);
  }, [campaign]);

  const ga4CampaignFilterLabel = useMemo(() => {
    const items = selectedGa4CampaignFilterList;
    if (!items || items.length === 0) return "All campaigns";
    if (items.length === 1) return items[0];
    if (items.length <= 3) return items.join(" + ");
    return `${items.slice(0, 2).join(" + ")} + ${items.length - 2} more`;
  }, [selectedGa4CampaignFilterList]);

  const { data: ga4CampaignValuesResp } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-campaign-values", selectedGA4PropertyId],
    enabled: !!campaignId && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-campaign-values?dateRange=30days&limit=200&propertyId=${encodeURIComponent(
          String(selectedGA4PropertyId)
        )}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return null;
      return json;
    },
  });

  // Helper: safely parse numbers from API payloads
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === "") return 0;
    const n = typeof val === "string" ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  // Check GA4 connection status - Updated for multiple connections
  const { data: ga4Connection, isLoading: ga4ConnLoading } = useQuery({
    queryKey: ["/api/ga4/check-connection", campaignId],
    enabled: !!campaignId,
    // Make the page frictionless: keep connection state fresh without requiring manual refresh.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(`/api/ga4/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false, totalConnections: 0, connections: [] };
      return response.json();
    },
  });

  // Get all GA4 connections for this campaign
  const { data: allGA4Connections } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-connections"],
    enabled: !!campaignId && !!ga4Connection?.connected,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-connections`);
      if (!response.ok) return { success: false, connections: [] };
      return response.json();
    },
  });

  const ga4PropsFromCheck: Array<{ propertyId: string; displayName?: string; propertyName?: string; isPrimary?: boolean }> =
    Array.isArray((ga4Connection as any)?.connections) ? (ga4Connection as any).connections : [];
  const ga4PropsFromAll: Array<{ propertyId: string; displayName?: string; propertyName?: string; isPrimary?: boolean }> =
    Array.isArray((allGA4Connections as any)?.connections) ? (allGA4Connections as any).connections : [];
  const availableGA4Properties: Array<{ propertyId: string; displayName?: string; propertyName?: string; isPrimary?: boolean }> =
    ga4PropsFromCheck.length > 0 ? ga4PropsFromCheck : ga4PropsFromAll;

  // Always scope GA4 metrics to a single selected property (default: primary).
  useEffect(() => {
    const props = Array.isArray(availableGA4Properties) ? availableGA4Properties : [];
    if (props.length === 0) return;
    const exists = selectedGA4PropertyId && props.some((p) => String(p?.propertyId) === String(selectedGA4PropertyId));
    if (exists) return;
    const primary = props.find((p) => p?.isPrimary) || props[0];
    if (primary?.propertyId) setSelectedGA4PropertyId(String(primary.propertyId));
  }, [availableGA4Properties, selectedGA4PropertyId]);

  // Fetch platform KPIs
  const { data: platformKPIs = [], isLoading: kpisLoading } = useQuery({
    queryKey: [`/api/platforms/google_analytics/kpis`, campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to fetch KPIs");
      return response.json();
    },
  });

  // Fetch campaign-scoped benchmarks only (new campaigns should start empty).
  const { data: benchmarks = [], isLoading: benchmarksLoading } = useQuery<Benchmark[]>({
    queryKey: [`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(String(campaignId || ""))}`);
      if (!response.ok) throw new Error("Failed to fetch benchmarks");
      return response.json();
    },
  });

  // Fetch industries list (used for Benchmarks -> Industry type)
  const { data: industryData } = useQuery<{ industries: Array<{ value: string; label: string }> }>({
    queryKey: ["/api/industry-benchmarks"],
    // Keep fresh so newly-added industries appear without requiring a hard refresh.
    staleTime: 0,
    queryFn: async () => {
      // Cache-proof for hosted deployments (CDNs/proxies can aggressively cache GET responses).
      const resp = await fetch(`/api/industry-benchmarks?ts=${Date.now()}`, { cache: "no-store" as any });
      if (!resp.ok) return { industries: [] };
      return resp.json().catch(() => ({ industries: [] }));
    },
  });

  const industries = industryData?.industries || [];

  // Stored-series analytics (used to make Insights richer: streaks/trends/volatility)
  const kpiAnalyticsQueries = useQueries({
    queries: (Array.isArray(platformKPIs) ? platformKPIs : []).map((k: any) => ({
      queryKey: ["/api/kpis", String(k?.id || ""), "analytics", "30d"],
      enabled: activeTab === "insights" && !!k?.id,
      staleTime: 0,
      queryFn: async () => {
        const id = String(k?.id || "");
        const resp = await fetch(`/api/kpis/${encodeURIComponent(id)}/analytics?timeframe=30d`);
        if (!resp.ok) return null;
        return resp.json().catch(() => null);
      },
    })),
  });

  const benchmarkAnalyticsQueries = useQueries({
    queries: (Array.isArray(benchmarks) ? benchmarks : []).map((b: any) => ({
      queryKey: ["/api/benchmarks", String(b?.id || ""), "analytics"],
      enabled: activeTab === "insights" && !!b?.id,
      staleTime: 0,
      queryFn: async () => {
        const id = String(b?.id || "");
        const resp = await fetch(`/api/benchmarks/${encodeURIComponent(id)}/analytics`);
        if (!resp.ok) return null;
        return resp.json().catch(() => null);
      },
    })),
  });

  const kpiAnalyticsById = useMemo(() => {
    const map = new Map<string, any>();
    (kpiAnalyticsQueries || []).forEach((q: any, idx: number) => {
      const k = (Array.isArray(platformKPIs) ? platformKPIs : [])[idx];
      const id = String((k as any)?.id || "");
      if (!id) return;
      if (q?.data) map.set(id, q.data);
    });
    return map;
  }, [kpiAnalyticsQueries, platformKPIs]);

  const benchmarkAnalyticsById = useMemo(() => {
    const map = new Map<string, any>();
    (benchmarkAnalyticsQueries || []).forEach((q: any, idx: number) => {
      const b = (Array.isArray(benchmarks) ? benchmarks : [])[idx];
      const id = String((b as any)?.id || "");
      if (!id) return;
      if (q?.data) map.set(id, q.data);
    });
    return map;
  }, [benchmarkAnalyticsQueries, benchmarks]);

  const deriveBenchmarkCategoryFromMetric = (metric: string): string => {
    const m = String(metric || "").toLowerCase();
    if (m === "revenue") return "revenue";
    if (m === "conversions" || m === "conversionrate") return "conversion";
    if (m === "roas" || m === "roi" || m === "cpa") return "financial";
    if (m === "users" || m === "sessions" || m === "pageviews") return "traffic";
    if (m === "engagementrate") return "engagement";
    return "performance";
  };

  const getLiveBenchmarkCurrentValue = (metric: string): number => {
    const m = String(metric || "");
    const users =
      Number(breakdownTotals?.users || 0) ||
      Number((ga4Metrics as any)?.users || (ga4Metrics as any)?.totalUsers || (ga4Metrics as any)?.impressions || 0);
    const sessions = Number(breakdownTotals?.sessions || 0) || Number((ga4Metrics as any)?.sessions || 0);
    const pageviews = dailySummedTotals.pageviews || Number((ga4Metrics as any)?.pageviews || 0);
    const conversions = Number(breakdownTotals?.conversions || 0) || Number((ga4Metrics as any)?.conversions || 0);
    // Benchmarks should prefill from the same values shown in the Overview.
    // Revenue is a to-date (lifetime) metric in this GA4 surface.
    const revenue = Number(financialRevenue || 0);

    switch (m) {
      case "roas":
        // Present ROAS as a percentage (Revenue ÷ Spend × 100) for consistency with modal units.
        return Number(financialROAS || 0) * 100;
      case "roi":
        return Number(financialROI || 0);
      case "cpa":
        return Number(financialCPA || 0);
      case "users":
        return users;
      case "sessions":
        return sessions;
      case "pageviews":
        return pageviews;
      case "conversions":
        return conversions;
      case "revenue":
        return revenue;
      case "conversionRate":
        return sessions > 0 ? (conversions / sessions) * 100 : 0;
      case "engagementRate": {
        const er = dailySummedTotals.engagementRate || Number((ga4Metrics as any)?.engagementRate || 0);
        return Number.isFinite(er) && er > 0 ? normalizeRateToPercent(er) : 0;
      }
      default:
        return 0;
    }
  };

  const { data: ga4DailyResp, isLoading: ga4Loading, error: ga4Error } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-daily", GA4_DAILY_LOOKBACK_DAYS, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(
        `/api/campaigns/${campaignId}/ga4-daily?days=${encodeURIComponent(String(GA4_DAILY_LOOKBACK_DAYS))}&propertyId=${encodeURIComponent(
          String(selectedGA4PropertyId)
        )}`
      );
      const data = await response.json().catch(() => ({} as any));
      if (!response.ok && data?.requiresReauthorization) {
        throw new Error(data?.message || "Google Analytics needs to be reconnected.");
      }
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || "Failed to fetch GA4 daily metrics");
      }
      return data;
    },
  });

  const ga4DailyRows = useMemo<any[]>(() => {
    const rows = Array.isArray(ga4DailyResp?.data) ? ga4DailyResp.data : Array.isArray(ga4DailyResp) ? ga4DailyResp : [];
    return rows
      .map((r: any) => ({
        date: String(r?.date || "").trim(),
        users: Number(r?.users || 0) || 0,
        sessions: Number(r?.sessions || 0) || 0,
        pageviews: Number(r?.pageviews || 0) || 0,
        conversions: Number(r?.conversions || 0) || 0,
        revenue: Number(r?.revenue || 0) || 0,
        engagementRate: Number(r?.engagementRate || 0) || 0,
        engagedSessions: Number(r?.engagedSessions || 0) || 0,
        eventCount: Number(r?.eventCount || 0) || 0,
        eventsPerSession: Number(r?.eventsPerSession || 0) || 0,
        bounceRate: Number(r?.bounceRate || 0) || 0,
        avgSessionDuration: Number(r?.avgSessionDuration || 0) || 0,
        _raw: r,
      }))
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")))
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  }, [ga4DailyResp]);

  const ga4ReportDate = useMemo<string | null>(() => {
    // Prefer the most recent COMPLETE UTC day (avoid partial "today" rows).
    const todayUTC = new Date().toISOString().slice(0, 10);
    const rows = ga4DailyRows;
    if (rows.length === 0) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const d = String(rows[i]?.date || "");
      if (d && d < todayUTC) return d;
    }
    return String(rows[rows.length - 1]?.date || "") || null;
  }, [ga4DailyRows]);

  const ga4Metrics = useMemo<any>(() => {
    if (!ga4ReportDate) return null;
    const row = ga4DailyRows.find((r: any) => String(r?.date) === String(ga4ReportDate));
    if (!row) return null;
    return {
      date: ga4ReportDate,
      sessions: row.sessions,
      users: row.users,
      pageviews: row.pageviews,
      conversions: row.conversions,
      revenue: row.revenue,
      engagementRate: row.engagementRate,
      engagedSessions: row.engagedSessions,
      eventCount: row.eventCount,
      eventsPerSession: row.eventsPerSession,
      bounceRate: row.bounceRate,
      avgSessionDuration: row.avgSessionDuration,
      propertyId: ga4DailyResp?.propertyId,
      displayName: ga4DailyResp?.displayName,
      propertyName: ga4DailyResp?.propertyName,
      lastUpdated: ga4DailyResp?.lastUpdated,
      _isDaily: true,
    };
  }, [ga4DailyRows, ga4ReportDate, ga4DailyResp]);

  // Diagnostics (provenance + report shape checks)
  const { data: ga4Diagnostics } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-diagnostics", dateRange, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-diagnostics?dateRange=${encodeURIComponent(dateRange)}&propertyId=${encodeURIComponent(
          String(selectedGA4PropertyId)
        )}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return null;
      return json;
    },
  });

  // Trends/time series come directly from persisted GA4 daily facts.
  const ga4TimeSeries: any[] = ga4DailyRows;
  const timeSeriesLoading = ga4Loading;

  const { data: ga4Breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-breakdown", dateRange, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-breakdown?dateRange=${encodeURIComponent(dateRange)}&propertyId=${encodeURIComponent(
          String(selectedGA4PropertyId)
        )}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.message || json?.error || "Failed to fetch GA4 breakdown");
      }
      return json as any;
    },
  });

  // Compute campaign start date for cumulative queries (no arbitrary date range limit)
  const campaignStartDateISO = useMemo(() => {
    const sd = (campaign as any)?.startDate || (campaign as any)?.createdAt;
    if (!sd) return undefined;
    try { return new Date(sd).toISOString().slice(0, 10); } catch { return undefined; }
  }, [campaign]);

  const { data: ga4LandingPages } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-landing-pages", campaignStartDateISO, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: String(selectedGA4PropertyId),
        limit: '50',
      });
      if (campaignStartDateISO) params.set('startDate', campaignStartDateISO);
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-landing-pages?${params.toString()}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return null;
      return json;
    },
  });

  const { data: ga4ConversionEvents } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-conversion-events", campaignStartDateISO, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: String(selectedGA4PropertyId),
        limit: '50',
      });
      if (campaignStartDateISO) params.set('startDate', campaignStartDateISO);
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-conversion-events?${params.toString()}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return null;
      return json;
    },
  });

  // Spend/Revenue to-date for executive financial metrics (lifetime).
  const { data: spendToDateResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/spend-to-date`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/spend-to-date`);
      if (!resp.ok) return { success: false, spendToDate: 0, sourceIds: [] };
      return resp.json().catch(() => ({ success: false, spendToDate: 0, sourceIds: [] }));
    },
  });

  const { data: ga4ToDateResp, error: ga4ToDateError } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/ga4-to-date`, selectedGA4PropertyId, dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${campaignId}/ga4-to-date?propertyId=${encodeURIComponent(String(selectedGA4PropertyId))}&dateRange=${encodeURIComponent(dateRange)}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) {
        // Maintain existing GA4 reconnect UX.
        if (json?.requiresReauthorization) throw new Error(json?.message || "Google Analytics needs to be reconnected.");
        throw new Error(json?.message || json?.error || "Failed to fetch GA4 to-date totals");
      }
      return json;
    },
  });

  // Sum all daily rows for a ground-truth total (avoids mismatch between ga4-to-date and ga4-daily endpoints).
  const dailySummedTotals = useMemo(() => {
    const rows = ga4DailyRows;
    let sessions = 0, users = 0, conversions = 0, revenue = 0, engagedSessions = 0, pageviews = 0;
    for (const r of rows) {
      sessions += r.sessions;
      users += r.users;
      conversions += r.conversions;
      revenue += r.revenue;
      engagedSessions += r.engagedSessions || 0;
      pageviews += r.pageviews || 0;
    }
    return {
      sessions, users, conversions, pageviews, engagedSessions,
      revenue: Number(revenue.toFixed(2)),
      engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
      bounceRate: sessions > 0 ? 1 - (engagedSessions / sessions) : 0,
    };
  }, [ga4DailyRows]);

  // Use the higher of (to-date API total, summed daily rows) so cumulative totals
  // are never less than individual daily values.
  const breakdownTotals = {
    date: ga4ReportDate,
    sessions: Math.max(Number((ga4ToDateResp as any)?.totals?.sessions || 0), dailySummedTotals.sessions),
    conversions: Math.max(Number((ga4ToDateResp as any)?.totals?.conversions || 0), dailySummedTotals.conversions),
    revenue: Math.max(Number((ga4ToDateResp as any)?.totals?.revenue || 0), dailySummedTotals.revenue),
    users: Math.max(Number((ga4ToDateResp as any)?.totals?.users || 0), dailySummedTotals.users),
  };

  const { data: importedRevenueToDateResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue-to-date`);
      if (!resp.ok) return { success: false, totalRevenue: 0, sourceIds: [] };
      return resp.json().catch(() => ({ success: false, totalRevenue: 0, sourceIds: [] }));
    },
  });

  const { data: revenueSourcesResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-sources`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue-sources`);
      if (!resp.ok) return { success: false, sources: [] };
      return resp.json().catch(() => ({ success: false, sources: [] }));
    },
  });

  // Note: In GA4 daily mode we do NOT auto-fallback to LinkedIn spend.
  // For accuracy, spend must come from explicit spend sources (CSV/Sheets/manual/connector) that materialize daily spend rows.

  // Resolve spend source labels for the Financial section (so we don't show a broken/undefined label).
  const { data: spendSourcesResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/spend-sources`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/spend-sources`);
      if (!resp.ok) return { success: false, sources: [] };
      return resp.json().catch(() => ({ success: false, sources: [] }));
    },
  });

  const spendSourceLabels = useMemo(() => {
    const persistedSpend = Number(spendToDateResp?.spendToDate || 0);
    const ids = Array.isArray(spendToDateResp?.sourceIds) ? spendToDateResp.sourceIds.map(String) : [];
    const sources = Array.isArray(spendSourcesResp?.sources) ? spendSourcesResp.sources : Array.isArray(spendSourcesResp) ? spendSourcesResp : [];
    const labels: string[] = [];
    for (const id of ids) {
      const s = sources.find((x: any) => String(x?.id) === String(id));
      if (!s) continue;
      const label = String(s.displayName || s.sourceType || "").trim();
      if (label) labels.push(label);
    }
    return labels;
  }, [spendToDateResp?.spendToDate, spendToDateResp?.sourceIds, spendSourcesResp]);

  const activeSpendSource = useMemo(() => {
    const sources = Array.isArray(spendSourcesResp?.sources) ? spendSourcesResp.sources : Array.isArray(spendSourcesResp) ? spendSourcesResp : [];
    // Backend returns only active sources; pick the most recent if multiple.
    return sources?.[0] || null;
  }, [spendSourcesResp]);
  const activeRevenueSource = useMemo(() => {
    const sources = Array.isArray(revenueSourcesResp?.sources) ? revenueSourcesResp.sources : Array.isArray(revenueSourcesResp) ? revenueSourcesResp : [];
    return sources?.[0] || null;
  }, [revenueSourcesResp]);
  // Availability flags for UI gating (KPI/Benchmark templates):
  // - Spend is "available" if a spend source exists (even if value is 0).
  // - Revenue is "available" if GA4 has a revenue metric configured OR an imported revenue source exists.
  const spendMetricAvailable = useMemo(() => {
    const ids = Array.isArray(spendToDateResp?.sourceIds) ? spendToDateResp.sourceIds : [];
    return !!activeSpendSource || ids.length > 0;
  }, [activeSpendSource, spendToDateResp?.sourceIds]);
  const revenueMetricAvailable = useMemo(() => {
    const ga4RevenueMetric = String((ga4ToDateResp as any)?.totals?.revenueMetric || "").trim();
    return !!activeRevenueSource || !!ga4RevenueMetric;
  }, [activeRevenueSource, ga4ToDateResp]);

  const getMissingDependenciesForMetric = (metricKey: string) => {
    const key = String(metricKey || "").trim();
    const lower = key.toLowerCase();
    // KPI templates use display names ("ROAS"), while Benchmarks use metric keys ("roas").
    const m =
      lower === "roas" || key === "ROAS"
        ? "roas"
        : lower === "roi" || key === "ROI"
          ? "roi"
          : lower === "cpa" || key === "CPA"
            ? "cpa"
            : lower === "revenue" || key === "Revenue"
              ? "revenue"
              : lower;

    const requiresSpend = m === "roas" || m === "roi" || m === "cpa";
    const requiresRevenue = m === "roas" || m === "roi" || m === "revenue";
    const missing: Array<"Spend" | "Revenue"> = [];
    if (requiresSpend && !spendMetricAvailable) missing.push("Spend");
    if (requiresRevenue && !revenueMetricAvailable) missing.push("Revenue");
    return { requiresSpend, requiresRevenue, missing };
  };
  const totalSpendForFinancials = Number(spendToDateResp?.spendToDate || 0);
  const usingAutoLinkedInSpend = false;

  const importedRevenueForFinancials = Number((importedRevenueToDateResp as any)?.totalRevenue || 0);
  const ga4RevenueFromToDate = Number((ga4ToDateResp as any)?.totals?.revenue || 0);
  const ga4RevenueMetricName = String((ga4ToDateResp as any)?.revenueMetric || "").trim();
  const ga4HasRevenueMetric = !!ga4RevenueMetricName || dailySummedTotals.revenue > 0;
  // Use the higher of (to-date total, summed daily rows) so Total Revenue is never less than Latest Day Revenue.
  const ga4RevenueForFinancials = Math.max(ga4RevenueFromToDate, dailySummedTotals.revenue);
  // Enterprise policy: prefer GA4 revenue when a GA4 revenue metric is configured (even if it's 0).
  // Only fall back to imported revenue when GA4 revenue metric is not configured/available.
  const financialRevenue = ga4HasRevenueMetric ? ga4RevenueForFinancials : importedRevenueForFinancials;
  const financialConversions = Math.max(Number((ga4ToDateResp as any)?.totals?.conversions || 0), dailySummedTotals.conversions);
  const financialSpend = Number(totalSpendForFinancials || 0);
  const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;
  const financialROI = computeRoiPercent(financialRevenue, financialSpend);
  const financialCPA = computeCpa(financialSpend, financialConversions);

  // GA4 KPIs are evaluated on strict daily values (no UI window scaling).
  // Targets should therefore be defined as daily targets.
  const getKpiEffectiveTarget = (kpi: any) => {
    const rawTarget = parseFloat(String(kpi?.targetValue || "0"));
    const safeTarget = Number.isFinite(rawTarget) ? rawTarget : 0;
    const baseDaysRaw = Number((kpi as any)?.trackingPeriod || 0);
    const baseDays = Number.isFinite(baseDaysRaw) && baseDaysRaw > 0 ? baseDaysRaw : 0;
    return { effectiveTarget: safeTarget, baseDays, viewDays: baseDays, scaled: false };
  };

  const getLiveKpiValue = (kpi: any): string => {
    const name = String(kpi?.metric || kpi?.name || "").trim();
    // Use the same sources as the GA4 Overview:
    // - Revenue/Conversions/Sessions/Users from GA4 breakdown totals
    // - Spend/Revenue for financial metrics from spend-to-date + revenue-to-date (no LinkedIn fallback)
    if (name === "Revenue") return Number(financialRevenue || 0).toFixed(2);
    if (name === "Total Conversions") return String(Math.round(Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0)));
    if (name === "Conversion Rate") {
      const s = Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0);
      const c = Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0);
      return computeConversionRatePercent(c, s).toFixed(2);
    }
    if (name === "Engagement Rate") {
      const er = dailySummedTotals.engagementRate || Number((ga4Metrics as any)?.engagementRate || 0);
      return normalizeRateToPercent(er).toFixed(2);
    }
    if (name === "Total Users") return String(Math.round(Number(breakdownTotals.users || ga4Metrics?.users || 0)));
    if (name === "Total Sessions") return String(Math.round(Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0)));
    // Present ROAS as a percentage (Revenue ÷ Spend × 100) for consistency with modal units.
    if (name === "ROAS") return computeRoasPercent(financialRevenue, financialSpend).toFixed(2);
    if (name === "ROI") return Number(financialROI || 0).toFixed(2);
    if (name === "CPA") return Number(financialCPA || 0).toFixed(2);
    // Fallback to stored value for any legacy/custom KPI.
    return String(kpi?.currentValue ?? "0.00");
  };

  const computeKpiProgress = (kpi: any) => {
    const current = parseFloat(String(getLiveKpiValue(kpi) || "0"));
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const { effectiveTarget } = getKpiEffectiveTarget(kpi);
    const safeTarget = Number.isFinite(effectiveTarget) ? effectiveTarget : 0;

    // Direction: most exec KPIs here are "higher is better".
    // CPA is "lower is better" (cost per conversion).
    const name = String(kpi?.metric || kpi?.name || "").toLowerCase();
    const lowerIsBetter = name === "cpa";
    const p = computeProgress({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const color = p.ratio >= 0.9 ? "bg-green-500" : p.ratio >= 0.7 ? "bg-yellow-500" : "bg-red-500";
    return { ...p, color };
  };

  const computeBenchmarkProgress = (benchmark: any) => {
    const metric = String((benchmark as any)?.metric || "");
    const currentRaw = stripNumberFormatting(
      metric && metric !== "__custom__"
        ? String(getLiveBenchmarkCurrentValue(metric))
        : String((benchmark as any)?.currentValue ?? "0")
    );
    const benchRaw = stripNumberFormatting(String((benchmark as any)?.benchmarkValue ?? "0"));
    const current = parseFloat(currentRaw || "0");
    const bench = parseFloat(benchRaw || "0");
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeBench = Number.isFinite(bench) ? bench : 0;

    const metricKey = String((benchmark as any)?.metric || (benchmark as any)?.name || "").toLowerCase();
    const lowerIsBetter = metricKey === "cpa" || metricKey.includes("cpa");

    let ratio = 0;
    if (lowerIsBetter) {
      ratio = safeCurrent > 0 ? (safeBench / safeCurrent) : 0;
    } else {
      ratio = safeBench > 0 ? (safeCurrent / safeBench) : 0;
    }

    const pct = Math.max(0, Math.min(ratio * 100, 100));
    const status =
      ratio >= 0.9 ? "on_track" :
        ratio >= 0.7 ? "needs_attention" :
          "behind";
    const color =
      ratio >= 0.9 ? "bg-green-500" :
        ratio >= 0.7 ? "bg-yellow-500" :
          "bg-red-500";

    // Positive means "better than benchmark" (direction-aware).
    const deltaPct =
      safeBench > 0
        ? (lowerIsBetter ? ((safeBench - safeCurrent) / safeBench) * 100 : ((safeCurrent - safeBench) / safeBench) * 100)
        : 0;

    return {
      ratio,
      pct,
      labelPct: pct.toFixed(1),
      status,
      color,
      deltaPct,
    };
  };

  const getBenchmarkDisplayCurrentValue = (benchmark: any): string => {
    const metric = String((benchmark as any)?.metric || "");
    if (metric && metric !== "__custom__") {
      return String(getLiveBenchmarkCurrentValue(metric));
    }
    return String((benchmark as any)?.currentValue ?? "0");
  };

  const buildGA4ReportPayload = () => {
    const name = String(ga4ReportForm.name || "").trim();
    const reportType = String(ga4ReportForm.reportType || "overview");
    const description = String(ga4ReportForm.description || "").trim();
    const cfg = ga4ReportForm.configuration || {};
    return {
      campaignId,
      name,
      description: description || null,
      reportType,
      configuration: JSON.stringify({
        ...cfg,
        meta: {
          reportingMode: "daily",
          reportDateUtc: ga4ReportDate || null,
          lookbackDays: GA4_DAILY_LOOKBACK_DAYS,
          createdFrom: "ga4-metrics",
        },
      }),
      status: "active",
    };
  };

  const downloadGA4Report = async (opts: { reportType: string; configuration?: any; reportName?: string }) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const marginX = 14;
    let y = 14;
    const lineHeight = 6;
    const pageBottom = 285;

    const ensureSpace = (extra: number) => {
      if (y + extra > pageBottom) {
        doc.addPage();
        y = 14;
      }
    };

    const write = (text: string, size = 11, bold = false) => {
      ensureSpace(lineHeight);
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(String(text || ""), 180);
      for (const l of lines) {
        ensureSpace(lineHeight);
        doc.text(l, marginX, y);
        y += lineHeight;
      }
    };

    const currency = String((campaign as any)?.currency || "USD");
    const fmtCurrency = (n: number) =>
      `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtPct = (n: number) => `${Number(n || 0).toFixed(2)}%`;
    const fmtCount = (n: number) => `${Math.round(Number(n || 0)).toLocaleString()}`;

    const reportName = String(opts.reportName || ga4ReportForm.name || "GA4 Report").trim() || "GA4 Report";
    const reportType = String(opts.reportType || "overview");
    const cfg = opts.configuration || ga4ReportForm.configuration || {};

    // Header
    write(reportName, 16, true);
    write(`Campaign: ${String((campaign as any)?.name || "")}`);
    write(`Date Range: ${String((selectedPeriodLabel as any) || dateRange)}`);
    const ga4m = ga4Metrics as any;
    if (ga4m?.propertyId) write(`Property: ${String(ga4m?.displayName || ga4m?.propertyName || "")} (${ga4m?.propertyId})`);
    if ((campaign as any)?.ga4CampaignFilter) write(`Campaign Filter: ${String((campaign as any).ga4CampaignFilter)}`);
    write(`Generated: ${new Date().toLocaleString()}`);
    write(" ");

    const sections =
      reportType === "custom"
        ? (cfg?.sections || { overview: true })
        : {
          overview: reportType === "overview",
          acquisition: reportType === "acquisition",
          trends: reportType === "trends",
          kpis: reportType === "kpis",
          benchmarks: reportType === "benchmarks",
        };

    // Overview section
    if (sections.overview) {
      write("Overview", 13, true);
      const revenue = Number(breakdownTotals?.revenue || 0);
      const conversions = Number(breakdownTotals?.conversions || 0);
      const sessions = Number(breakdownTotals?.sessions || 0);
      const users = Number(breakdownTotals?.users || 0);
      const engagementRate = normalizeRateToPercent(dailySummedTotals.engagementRate || Number(ga4m?.metrics?.engagementRate ?? 0));
      const spend = Number(spendToDateResp?.spendToDate || 0);
      const revenueToDate = Number(financialRevenue || 0);
      const conversionsToDate = Number(financialConversions || 0);

      const roas = spend > 0 ? (revenueToDate / spend) * 100 : 0;
      const roi = spend > 0 ? ((revenueToDate - spend) / spend) * 100 : 0;
      const cpa = conversionsToDate > 0 ? spend / conversionsToDate : 0;
      const convRate = sessions > 0 ? (conversions / sessions) * 100 : 0;

      write(`Revenue (to date): ${fmtCurrency(revenueToDate)}`);
      write(`Spend (to date): ${fmtCurrency(spend)}`);
      write(`ROAS: ${fmtPct(roas)}`);
      write(`ROI: ${fmtPct(roi)}`);
      write(`CPA: ${fmtCurrency(cpa)}`);
      write(`Conversions: ${fmtCount(conversions)}`);
      write(`Conversion Rate: ${fmtPct(convRate)}`);
      write(`Users: ${fmtCount(users)}`);
      write(`Sessions: ${fmtCount(sessions)}`);
      write(`Engagement Rate: ${fmtPct(engagementRate)}`);
      write(" ");
    }

    // Acquisition breakdown
    if (sections.acquisition) {
      write("Acquisition Breakdown (top rows)", 13, true);
      const rows = Array.isArray(ga4Breakdown?.rows) ? ga4Breakdown.rows : [];
      const top = rows.slice(0, 25);
      for (const r of top) {
        const sessionsRow = Number((r as any)?.sessionsRaw ?? (r as any)?.sessions ?? 0);
        write(
          `${String((r as any)?.channel || "")} • ${String((r as any)?.source || "")}/${String((r as any)?.medium || "")} • Sessions ${fmtCount(
            sessionsRow
          )} • Users ${fmtCount((r as any)?.users)} • Conv ${fmtCount((r as any)?.conversions)} • Rev ${fmtCurrency((r as any)?.revenue || 0)}`,
          10
        );
      }
      if (rows.length > top.length) write(`… ${rows.length - top.length} more rows`, 10);
      write(" ");
    }

    // Trends (time series)
    if (sections.trends) {
      write("Trends (time series)", 13, true);
      const pts = Array.isArray(ga4TimeSeries) ? ga4TimeSeries : [];
      const last = pts.slice(Math.max(0, pts.length - 25));
      for (const p of last) {
        write(
          `${String((p as any)?.date || "")} • Sessions ${fmtCount((p as any)?.sessions || 0)} • Users ${fmtCount(
            (p as any)?.users || 0
          )} • Conv ${fmtCount((p as any)?.conversions || 0)} • Rev ${fmtCurrency((p as any)?.revenue || 0)}`,
          10
        );
      }
      write(" ");
    }

    // KPIs snapshot
    if (sections.kpis) {
      write("KPIs Snapshot", 13, true);
      const items = Array.isArray(platformKPIs) ? platformKPIs : [];
      for (const k of items) {
        const deps = getMissingDependenciesForMetric(String((k as any)?.metric || (k as any)?.name || ""));
        if (deps.missing.length > 0) {
          write(`${String(k?.name || "")} • Blocked (missing ${deps.missing.join(" + ")})`, 10);
          continue;
        }
        const p = computeKpiProgress(k);
        const t = getKpiEffectiveTarget(k);
        const statusLabel = p.status === "on_track" ? "On Track" : p.status === "needs_attention" ? "Needs Attention" : "Behind";
        write(
          `${String(k?.name || "")} • Current ${formatNumberByUnit(String(getLiveKpiValue(k) || "0"), String(k?.unit || "%"))} • Target ${formatNumberByUnit(
            String(t.effectiveTarget || ""),
            String(k?.unit || "%")
          )} • Progress ${p.pct.toFixed(1)}% • ${statusLabel}`,
          10
        );
      }
      write(" ");
    }

    // Benchmarks snapshot
    if (sections.benchmarks) {
      write("Benchmarks Snapshot", 13, true);
      const items = Array.isArray(benchmarks) ? benchmarks : [];
      for (const b of items) {
        const deps = getMissingDependenciesForMetric(String((b as any)?.metric || ""));
        if (deps.missing.length > 0) {
          write(`${String((b as any)?.name || "")} • Blocked (missing ${deps.missing.join(" + ")})`, 10);
          continue;
        }
        const p = computeBenchmarkProgress(b);
        const statusLabel = p.status === "on_track" ? "On Track" : p.status === "needs_attention" ? "Needs Attention" : "Behind";
        const currentLive = getBenchmarkDisplayCurrentValue(b);
        write(
          `${String((b as any)?.name || "")} • Current ${formatBenchmarkValue(currentLive, (b as any)?.unit)} • Benchmark ${formatBenchmarkValue(
            (b as any)?.benchmarkValue || "0",
            (b as any)?.unit
          )} • Progress ${p.pct.toFixed(1)}% • ${statusLabel}`,
          10
        );
      }
      write(" ");
    }

    doc.save(`${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const connectedPropertyCount =
    Number(ga4Connection?.totalConnections || 0) ||
    (Array.isArray(ga4Connection?.connections) ? ga4Connection.connections.length : 0) ||
    1;

  const rateToPercent = (v: number) => normalizeRateToPercent(v);

  // Geographic data query
  const { data: geographicData, isLoading: geoLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-geographic", dateRange, selectedGA4PropertyId],
    enabled: !!campaignId && !!ga4Connection?.connected && !!selectedGA4PropertyId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(
        `/api/campaigns/${campaignId}/ga4-geographic?dateRange=${encodeURIComponent(dateRange)}&propertyId=${encodeURIComponent(
          String(selectedGA4PropertyId)
        )}`
      );
      const data = await response.json();

      // Professional platforms show geographic data even during connectivity issues
      return data;
    },
  });

  const timeSeriesData = ga4TimeSeries || [];

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const kpiTracker = useMemo(() => {
    const items = Array.isArray(platformKPIs) ? platformKPIs : [];
    let scored = 0;
    let onTrack = 0;
    let needsAttention = 0;
    let behind = 0;
    let blocked = 0;
    let sumPct = 0;

    for (const kpi of items) {
      const metricKey = String((kpi as any)?.metric || (kpi as any)?.name || "");
      const deps = getMissingDependenciesForMetric(metricKey);
      if (deps.missing.length > 0) {
        blocked += 1;
        continue; // do NOT score blocked KPIs (missing inputs ≠ poor performance)
      }
      const target = parseFloat(String((kpi as any)?.targetValue || "0"));
      if (!Number.isFinite(target) || target <= 0) continue; // can't score without a target
      const p = computeKpiProgress(kpi);
      scored += 1;
      sumPct += Number(p?.pct || 0);
      if (p.status === "on_track") onTrack += 1;
      else if (p.status === "needs_attention") needsAttention += 1;
      else if (p.status === "behind") behind += 1;
    }

    const avgPct = scored > 0 ? sumPct / scored : 0;
    return {
      total: items.length,
      scored,
      onTrack,
      needsAttention,
      behind,
      blocked,
      avgPct,
    };
    // computeKpiProgress depends on live values; include the main value inputs so the tracker updates correctly.
  }, [platformKPIs, breakdownTotals, ga4Metrics, financialSpend, spendMetricAvailable, revenueMetricAvailable]);

  const benchmarkTracker = useMemo(() => {
    const items = Array.isArray(benchmarks) ? benchmarks : [];
    let scored = 0;
    let onTrack = 0;
    let needsAttention = 0;
    let behind = 0;
    let blocked = 0;
    let sumPct = 0;

    for (const b of items) {
      const metricKey = String((b as any)?.metric || "");
      const deps = getMissingDependenciesForMetric(metricKey);
      if (deps.missing.length > 0) {
        blocked += 1;
        continue; // do NOT score blocked benchmarks (missing inputs ≠ poor performance)
      }
      const bench = parseFloat(stripNumberFormatting(String((b as any)?.benchmarkValue || "0")));
      if (!Number.isFinite(bench) || bench <= 0) continue;
      const p = computeBenchmarkProgress(b);
      scored += 1;
      sumPct += Number(p?.pct || 0);
      if (p.status === "on_track") onTrack += 1;
      else if (p.status === "needs_attention") needsAttention += 1;
      else if (p.status === "behind") behind += 1;
    }

    const avgPct = scored > 0 ? sumPct / scored : 0;
    return { total: items.length, scored, onTrack, needsAttention, behind, blocked, avgPct };
  }, [benchmarks, spendMetricAvailable, revenueMetricAvailable]);

  type InsightItem = {
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    recommendation?: string;
  };

  const insights = useMemo<InsightItem[]>(() => {
    const out: InsightItem[] = [];

    // 0) Executive financial integrity checks (to-date / lifetime)
    // These should update immediately when a user imports Spend/Revenue, even if no KPIs/Benchmarks exist yet.
    const toDateRangeLabel =
      (ga4ToDateResp as any)?.startDate
        ? `${String((ga4ToDateResp as any)?.startDate)} → ${String((ga4ToDateResp as any)?.endDate || "yesterday")}`
        : "to date";

    // 0a) Data integrity alerts for blocked KPIs/Benchmarks (missing spend/revenue inputs)
    const blockedKpis = (Array.isArray(platformKPIs) ? platformKPIs : [])
      .map((k: any) => {
        const metricKey = String((k as any)?.metric || (k as any)?.name || "");
        const deps = getMissingDependenciesForMetric(metricKey);
        return deps.missing.length > 0 ? { k, missing: deps.missing } : null;
      })
      .filter(Boolean) as Array<{ k: any; missing: Array<"Spend" | "Revenue"> }>;

    const blockedBenchmarks = (Array.isArray(benchmarks) ? benchmarks : [])
      .map((b: any) => {
        const metricKey = String((b as any)?.metric || "");
        const deps = getMissingDependenciesForMetric(metricKey);
        return deps.missing.length > 0 ? { b, missing: deps.missing } : null;
      })
      .filter(Boolean) as Array<{ b: any; missing: Array<"Spend" | "Revenue"> }>;

    for (const item of blockedKpis) {
      const name = String(item.k?.name || item.k?.metric || "KPI");
      const missingLabel = item.missing.join(" + ");
      out.push({
        id: `integrity:kpi_blocked:${String(item.k?.id || name)}`,
        severity: "high",
        title: `KPI paused: missing ${missingLabel}`,
        description: `"${name}" cannot be evaluated because ${missingLabel} is not connected for this campaign. Showing 0 would be misleading, so this KPI is marked Blocked until inputs are restored.`,
        recommendation:
          item.missing.includes("Revenue") && item.missing.includes("Spend")
            ? "Add both Spend and Revenue sources to resume KPI evaluation."
            : item.missing.includes("Revenue")
              ? "Add a GA4 revenue metric (if available) or import revenue (HubSpot/Sheets/CSV) to resume KPI evaluation."
              : "Add spend-to-date to resume KPI evaluation.",
      });
    }

    for (const item of blockedBenchmarks) {
      const name = String(item.b?.name || item.b?.metric || "Benchmark");
      const missingLabel = item.missing.join(" + ");
      out.push({
        id: `integrity:bench_blocked:${String(item.b?.id || name)}`,
        severity: "high",
        title: `Benchmark paused: missing ${missingLabel}`,
        description: `"${name}" cannot be evaluated because ${missingLabel} is not connected for this campaign. Restore inputs to resume accurate benchmark tracking.`,
        recommendation:
          item.missing.includes("Revenue") && item.missing.includes("Spend")
            ? "Add both Spend and Revenue sources to resume benchmark tracking."
            : item.missing.includes("Revenue")
              ? "Add a GA4 revenue metric (if available) or import revenue to resume benchmark tracking."
              : "Add spend-to-date to resume benchmark tracking.",
      });
    }

    // 0b) Executive financial integrity checks (to-date / lifetime)
    // These should update immediately when a user imports Spend/Revenue, even if no KPIs/Benchmarks exist yet.
    // IMPORTANT: distinguish "missing configuration" from true zeros (enterprise-grade reliability).
    if (ga4ToDateError) {
      out.push({
        id: "financial:ga4_to_date_unavailable",
        severity: "high",
        title: "GA4 lifetime totals are unavailable",
        description: "We couldn’t fetch GA4 to-date totals for this campaign/property, so revenue/conversion-based executive metrics may be incomplete.",
        recommendation: "Reconnect GA4 for this campaign, then refresh. If the issue persists, verify OAuth scopes and property access.",
      });
    }
    if (spendMetricAvailable && !revenueMetricAvailable) {
      out.push({
        id: "financial:revenue_missing",
        severity: "high",
        title: "Revenue is not connected",
        description: "Revenue is not configured for this campaign, so ROI/ROAS and revenue-based KPIs/Benchmarks are blocked until a revenue source is added.",
        recommendation: "Connect a GA4 revenue metric if available, or import revenue from HubSpot/Salesforce/Shopify/Sheets/CSV.",
      });
    }
    if (revenueMetricAvailable && !spendMetricAvailable) {
      out.push({
        id: "financial:spend_missing",
        severity: "high",
        title: "Spend is not connected",
        description: "Spend is not configured for this campaign, so ROI/ROAS/CPA and spend-based KPIs/Benchmarks are blocked until a spend source is added.",
        recommendation: "Import spend-to-date (CSV/Sheets/manual) to enable spend-based executive metrics.",
      });
    }

    if (spendMetricAvailable && revenueMetricAvailable && Number(financialSpend || 0) > 0 && Number(financialRevenue || 0) <= 0) {
      out.push({
        id: "financial:spend_no_revenue",
        severity: "high",
        title: "Spend recorded, but revenue is $0 to date",
        description: `Spend-to-date is ${formatMoney(Number(financialSpend || 0))}, but revenue-to-date is ${formatMoney(0)} (${toDateRangeLabel}).`,
        recommendation: ga4RevenueForFinancials > 0
          ? "Verify GA4 revenue tracking and conversion configuration for this campaign filter."
          : "Connect a GA4 revenue metric if available, or import revenue from HubSpot/Salesforce/Shopify/Sheets/CSV for accurate ROI/ROAS.",
      });
    }

    if (spendMetricAvailable && revenueMetricAvailable && Number(financialSpend || 0) <= 0 && Number(financialRevenue || 0) > 0) {
      out.push({
        id: "financial:revenue_no_spend",
        severity: "medium",
        title: "Revenue exists, but spend is $0 to date",
        description: `Revenue-to-date is ${formatMoney(Number(financialRevenue || 0))} (${toDateRangeLabel}), but spend-to-date is ${formatMoney(0)}.`,
        recommendation: "Import spend-to-date for this campaign so ROI/ROAS/CPA reflect actual performance.",
      });
    }

    if (Number(financialSpend || 0) > 0 && Number(financialRevenue || 0) > 0) {
      const roi = Number(financialROI || 0);
      const roas = Number(financialROAS || 0);
      if (Number.isFinite(roi) && roi < 0) {
        out.push({
          id: "financial:negative_roi",
          severity: roi <= -20 ? "high" : "medium",
          title: "ROI is negative to date",
          description: `ROI is ${formatPercentage(roi)} (${toDateRangeLabel}).`,
          recommendation: "Confirm revenue attribution for this campaign filter, then review conversion rate, AOV, and spend allocation. If this is a new campaign, allow more time/volume before judging.",
        });
      }
      if (Number.isFinite(roas) && roas > 0 && roas < 1) {
        out.push({
          id: "financial:roas_below_1",
          severity: "medium",
          title: "ROAS is below 1.0x to date",
          description: `ROAS is ${roas.toFixed(2)}x (${toDateRangeLabel}).`,
          recommendation: "Audit the conversion funnel (landing page → conversion event) and traffic mix; verify the revenue source and campaign filter are correct.",
        });
      }
    }

    // NOTE: We intentionally do NOT count "revenue source policy/provenance" as an Insight.
    // Execs can audit provenance in the "Sources used" footer; Insights should remain actionable.

    if (ga4HasRevenueMetric && Number(importedRevenueForFinancials || 0) > 0) {
      out.push({
        id: "financial:ga4_revenue_present_import_ignored",
        severity: "low",
        title: "GA4 revenue is present (imported revenue is ignored for platform financials)",
        description: "To avoid double counting, when GA4 revenue is available we use GA4 revenue for platform financials and ignore imported revenue in these calculations.",
      });
    }

    // 1) Actionable insights from KPI performance
    for (const k of Array.isArray(platformKPIs) ? platformKPIs : []) {
      const deps = getMissingDependenciesForMetric(String((k as any)?.metric || (k as any)?.name || ""));
      if (deps.missing.length > 0) continue; // blocked KPIs are handled in integrity checks above
      const p = computeKpiProgress(k);
      const status = String(p?.status || "");
      if (status !== "behind" && status !== "needs_attention") continue;

      const sev: InsightItem["severity"] = status === "behind" ? "high" : "medium";
      const metric = String((k as any)?.metric || (k as any)?.name || "KPI");
      const effectiveTarget = (getKpiEffectiveTarget(k) as any)?.effectiveTarget ?? (k as any)?.targetValue ?? "";
      const analytics = kpiAnalyticsById.get(String((k as any)?.id || "")) || null;

      // Streak: how many consecutive recorded days are in the same "not on track" state.
      const streak = (() => {
        const prog = Array.isArray(analytics?.progress) ? analytics.progress : [];
        if (prog.length === 0) return 0;
        const lowerIsBetter = String(metric || "").toLowerCase() === "cpa";
        const target = parseFloat(String((k as any)?.targetValue || "0"));
        const statusFor = (val: number) => computeProgress({ current: val, target: target, lowerIsBetter }).status;
        const first = statusFor(parseFloat(String(prog[0]?.value || "0")));
        if (first === "on_track") return 0;
        let n = 0;
        for (const pt of prog) {
          const st = statusFor(parseFloat(String(pt?.value || "0")));
          if (st !== first) break;
          n += 1;
        }
        return n;
      })();

      const trendNote =
        analytics?.trendAnalysis
          ? ` Trend ${String(analytics.trendAnalysis.direction || "neutral")} (${Number(analytics.trendAnalysis.percentage || 0).toFixed(1)}% over ${String(
            analytics.trendAnalysis.period || "30d"
          )}).`
          : "";
      const streakNote = streak > 1 ? ` Streak: ${streak} days.` : "";

      out.push({
        id: `kpi:${String((k as any)?.id || metric)}`,
        severity: sev,
        title: `${metric} is ${status === "behind" ? "Behind" : "Needs Attention"}`,
        description: `Current ${formatNumberByUnit(String(getLiveKpiValue(k) || "0"), String((k as any)?.unit || "%"))} vs target ${formatNumberByUnit(
          String(effectiveTarget),
          String((k as any)?.unit || "%")
        )} (${String(p?.labelPct || "0")}% progress).${streakNote}${trendNote}`,
        recommendation:
          metric.toLowerCase().includes("conversion")
            ? "Check landing page changes, funnel breaks, and traffic mix shifts (source/medium)."
            : metric.toLowerCase().includes("revenue")
              ? "Check top channels/campaigns for traffic or conversion drops; validate revenue tracking configuration."
              : metric.toLowerCase() === "cpa"
                ? "Audit conversion volume and spend allocation; verify conversion events are firing correctly."
                : "Review the primary drivers for this KPI and adjust budgets/creative/landing pages accordingly.",
      });
    }

    // 2) Actionable insights from Benchmark performance
    for (const b of Array.isArray(benchmarks) ? benchmarks : []) {
      const deps = getMissingDependenciesForMetric(String((b as any)?.metric || ""));
      if (deps.missing.length > 0) continue; // blocked benchmarks are handled in integrity checks above
      const p = computeBenchmarkProgress(b);
      const status = String(p?.status || "");
      if (status !== "behind" && status !== "needs_attention") continue;

      const sev: InsightItem["severity"] = status === "behind" ? "high" : "medium";
      const metric = String((b as any)?.metric || (b as any)?.name || "Benchmark");
      const ban = benchmarkAnalyticsById.get(String((b as any)?.id || "")) || null;
      const trendNote = ban?.performanceTrend ? ` Trend ${String(ban.performanceTrend)}.` : "";
      const avgVar = Number(ban?.averageVariance || 0);
      const volNote = Number.isFinite(avgVar) && avgVar !== 0 ? ` Avg variance ${avgVar.toFixed(1)}%.` : "";
      out.push({
        id: `bench:${String((b as any)?.id || metric)}`,
        severity: sev,
        title: `${String((b as any)?.name || metric)} is ${status === "behind" ? "Behind benchmark" : "Below benchmark"}`,
        description: `Current ${formatBenchmarkValue(getBenchmarkDisplayCurrentValue(b), String((b as any)?.unit || "%"))} vs benchmark ${formatBenchmarkValue(
          String((b as any)?.benchmarkValue || "0"),
          String((b as any)?.unit || "%")
        )} (${String(p?.labelPct || "0")}% to benchmark).${trendNote}${volNote}`,
        recommendation:
          metric.toLowerCase().includes("conversion")
            ? "Focus on landing page UX and traffic quality; validate conversion tagging."
            : metric.toLowerCase().includes("engagement")
              ? "Review content relevance and landing page engagement; check mobile performance."
              : "Identify which channels/campaigns are underperforming and iterate targeting/creative/landing page.",
      });
    }

    // 3) Anomaly detection (WoW) using GA4 daily facts (requires >= 14 days)
    const dailyRows = Array.isArray(ga4TimeSeries) ? (ga4TimeSeries as any[]) : [];
    const daily = new Map<string, { sessions: number; conversions: number; revenue: number; pageviews: number }>();
    for (const r of dailyRows) {
      const d = String((r as any)?.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      daily.set(d, {
        sessions: Number((r as any)?.sessions || 0) || 0,
        conversions: Number((r as any)?.conversions || 0) || 0,
        revenue: Number((r as any)?.revenue || 0) || 0,
        pageviews: Number((r as any)?.pageviews || 0) || 0,
      });
    }

    const dates = Array.from(daily.keys()).sort();
    if (dates.length >= 14) {
      const last7 = new Set(dates.slice(-7));
      const prev7 = new Set(dates.slice(-14, -7));

      const sum = (set: Set<string>) => {
        let sessions = 0;
        let conversions = 0;
        let revenue = 0;
        let pageviews = 0;
        Array.from(set).forEach((d) => {
          const v = daily.get(d);
          if (!v) return;
          sessions += v.sessions;
          conversions += v.conversions;
          revenue += v.revenue;
          pageviews += v.pageviews;
        });
        return { sessions, conversions, revenue, pageviews };
      };
      const a = sum(last7);
      const b = sum(prev7);
      const crA = a.sessions > 0 ? (a.conversions / a.sessions) * 100 : 0;
      const crB = b.sessions > 0 ? (b.conversions / b.sessions) * 100 : 0;
      const crDeltaPct = crB > 0 ? ((crA - crB) / crB) * 100 : 0;

      if (crB > 0 && crDeltaPct <= -15) {
        out.push({
          id: "anomaly:cr:wow",
          severity: "high",
          title: `Conversion rate dropped ${Math.abs(crDeltaPct).toFixed(1)}% week-over-week`,
          description: `Last 7d ${crA.toFixed(2)}% vs prior 7d ${crB.toFixed(2)}% (GA4 sessions/conversions).`,
          recommendation:
            "Check landing page changes, conversion event configuration, and traffic mix by source/medium. If paid traffic is involved, validate targeting/creative changes.",
        });
      }

      // Engagement depth proxy: pageviews per session (from GA4 daily facts)
      const pvpsA = a.sessions > 0 ? a.pageviews / a.sessions : 0;
      const pvpsB = b.sessions > 0 ? b.pageviews / b.sessions : 0;
      const pvpsDelta = pvpsB > 0 ? ((pvpsA - pvpsB) / pvpsB) * 100 : 0;
      if (pvpsB > 0 && pvpsDelta <= -20) {
        out.push({
          id: "anomaly:pvps:wow",
          severity: "medium",
          title: `Engagement depth decreased ${Math.abs(pvpsDelta).toFixed(1)}% week-over-week`,
          description: `Pageviews/session last 7d ${pvpsA.toFixed(2)} vs prior 7d ${pvpsB.toFixed(2)}.`,
          recommendation: "Review landing page relevance, page speed, and mobile UX; check if traffic sources shifted toward lower-intent audiences.",
        });
      }
    } else if (dates.length > 0) {
      out.push({
        id: "anomaly:not-enough-history",
        severity: "low",
        title: "Anomaly detection needs more history",
        description: `Need at least 14 days of daily data to compute week-over-week deltas. Available days: ${dates.length}.`,
      });
    }

    // Stable ordering: high -> medium -> low
    const order = { high: 0, medium: 1, low: 2 } as const;
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    return out;
  }, [
    platformKPIs,
    benchmarks,
    ga4TimeSeries,
    breakdownTotals,
    ga4Metrics,
    financialSpend,
    financialRevenue,
    financialROI,
    financialROAS,
    ga4RevenueForFinancials,
    importedRevenueForFinancials,
    String((ga4ToDateResp as any)?.startDate || ""),
    String((ga4ToDateResp as any)?.endDate || ""),
    kpiAnalyticsById,
    benchmarkAnalyticsById,
  ]);

  const insightsRollups = useMemo(() => {
    const rows = Array.isArray(ga4TimeSeries) ? (ga4TimeSeries as any[]) : [];
    const byDate = rows
      .map((r: any) => ({
        date: String(r?.date || "").trim(),
        sessions: Number(r?.sessions || 0) || 0,
        conversions: Number(r?.conversions || 0) || 0,
        revenue: Number(r?.revenue || 0) || 0,
        pageviews: Number(r?.pageviews || 0) || 0,
      }))
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    const dates = byDate.map((r: any) => r.date);
    const rollup = (n: number, offsetFromEnd: number = 0) => {
      const endIdxExclusive = Math.max(0, dates.length - offsetFromEnd);
      const startIdx = Math.max(0, endIdxExclusive - n);
      const slice = byDate.slice(startIdx, endIdxExclusive);
      const sums = slice.reduce(
        (acc: any, r: any) => {
          acc.sessions += r.sessions;
          acc.conversions += r.conversions;
          acc.revenue += r.revenue;
          acc.pageviews += r.pageviews;
          return acc;
        },
        { sessions: 0, conversions: 0, revenue: 0, pageviews: 0 }
      );
      const cr = sums.sessions > 0 ? (sums.conversions / sums.sessions) * 100 : 0;
      const pvps = sums.sessions > 0 ? sums.pageviews / sums.sessions : 0;
      const startDate = slice[0]?.date || null;
      const endDate = slice[slice.length - 1]?.date || null;
      return { ...sums, cr, pvps, startDate, endDate, days: slice.length };
    };

    const last7 = rollup(7, 0);
    const prior7 = rollup(7, 7);
    const last30 = rollup(30, 0);
    const prior30 = rollup(30, 30);

    const deltaPct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return {
      availableDays: dates.length,
      last7,
      prior7,
      last30,
      prior30,
      deltas: {
        sessions7: deltaPct(last7.sessions, prior7.sessions),
        conversions7: deltaPct(last7.conversions, prior7.conversions),
        revenue7: deltaPct(last7.revenue, prior7.revenue),
        cr7: prior7.cr > 0 ? ((last7.cr - prior7.cr) / prior7.cr) * 100 : 0,
        pvps7: prior7.pvps > 0 ? ((last7.pvps - prior7.pvps) / prior7.pvps) * 100 : 0,
        sessions30: deltaPct(last30.sessions, prior30.sessions),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        revenue30: deltaPct(last30.revenue, prior30.revenue),
        cr30: prior30.cr > 0 ? ((last30.cr - prior30.cr) / prior30.cr) * 100 : 0,
        pvps30: prior30.pvps > 0 ? ((last30.pvps - prior30.pvps) / prior30.pvps) * 100 : 0,
      },
    };
  }, [ga4TimeSeries]);

  // Collect GA4 campaign names from all imported campaigns (for filtering Ad Comparison)
  const importedGA4CampaignNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of (allCampaigns || [])) {
      const filters = parseStoredGa4CampaignFilter((c as any)?.ga4CampaignFilter);
      for (const f of filters) names.add(f.trim().toLowerCase());
    }
    return names;
  }, [allCampaigns]);

  // Aggregate breakdown rows by campaign name for Campaign Performance & Campaign Comparison
  const campaignBreakdownAgg = useMemo(() => {
    const rows = Array.isArray(ga4Breakdown?.rows) ? ga4Breakdown.rows : [];
    const byName = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number }>();
    for (const r of rows) {
      const name = String((r as any)?.campaign || "(not set)").trim();
      const existing = byName.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
      existing.sessions += Number((r as any)?.sessions || 0);
      existing.users += Number((r as any)?.users || 0);
      existing.conversions += Number((r as any)?.conversions || 0);
      existing.revenue += Number((r as any)?.revenue || 0);
      byName.set(name, existing);
    }
    return Array.from(byName.values())
      .map(c => ({
        ...c,
        conversionRate: c.sessions > 0 ? (c.conversions / c.sessions) * 100 : 0,
        revenuePerSession: c.sessions > 0 ? c.revenue / c.sessions : 0,
      }))
      .filter(c => importedGA4CampaignNames.size === 0 || importedGA4CampaignNames.has(c.name.trim().toLowerCase()))
      .sort((a, b) => b.sessions - a.sessions);
  }, [ga4Breakdown, importedGA4CampaignNames]);

  const selectedPeriodLabel = ga4ReportDate ? `Daily (UTC: ${ga4ReportDate})` : "Daily";

  const provenanceLastUpdated =
    (ga4Breakdown as any)?.lastUpdated ||
    (ga4Metrics as any)?.lastUpdated ||
    (ga4Diagnostics as any)?.lastUpdated ||
    null;
  const provenanceProperty =
    (ga4Diagnostics as any)?.connection?.displayName ||
    (ga4Diagnostics as any)?.connection?.propertyName ||
    (ga4Metrics as any)?.propertyId ||
    (ga4Connection as any)?.connections?.find((c: any) => c?.isPrimary)?.displayName ||
    (ga4Connection as any)?.connections?.[0]?.displayName ||
    "GA4";
  const provenancePropertyId =
    (ga4Diagnostics as any)?.connection?.propertyId ||
    (ga4Metrics as any)?.propertyId ||
    (ga4Connection as any)?.connections?.find((c: any) => c?.isPrimary)?.propertyId ||
    (ga4Connection as any)?.connections?.[0]?.propertyId ||
    "";
  const provenanceCampaignFilter = (campaign as any)?.ga4CampaignFilter || (ga4Diagnostics as any)?.campaignFilter || "";
  const diagnosticsWarnings: string[] = Array.isArray((ga4Diagnostics as any)?.warnings) ? (ga4Diagnostics as any).warnings : [];
  // Hide warnings that are noisy/confusing in the MVP UI.
  const visibleDiagnosticsWarnings = diagnosticsWarnings.filter((w) => {
    const s = String(w || "");
    return !s.startsWith("Total Conversions match Total Users.");
  });

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Prevent a "flash" of the GA4 connection flow before the connection check finishes.
  if (ga4ConnLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Campaign not found</h2>
              <Link href="/campaigns">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaigns
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // If GA4 is not connected or has no connections, show connection flow
  if (!ga4Connection?.connected || ga4Connection?.totalConnections === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-6">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics Metrics</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">for {campaign.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                  <SiGoogle className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Connect Google Analytics</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
                  Connect your Google Analytics account to view detailed metrics and insights for this campaign.
                </p>
                <GA4ConnectionFlow
                  campaignId={campaign.id}
                  onConnectionSuccess={() => {
                    window.location.reload();
                  }}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <SiGoogle className="w-8 h-8 text-orange-500" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics</h1>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Detailed metrics for {campaign.name}</p>

                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedGa4Campaigns(selectedGa4CampaignFilterList);
                    setGa4CampaignSearch("");
                    setShowGa4CampaignPicker(true);
                  }}
                  disabled={!selectedGA4PropertyId}
                  title={!selectedGA4PropertyId ? "Select a GA4 property first" : "Select GA4 campaigns to import"}
                >
                  Campaigns{selectedGa4CampaignFilterList.length > 0 ? ` (${selectedGa4CampaignFilterList.length})` : ""}
                </Button>
                {selectedGa4CampaignFilterList.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                    {selectedGa4CampaignFilterList.slice(0, 3).map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 max-w-[160px] truncate"
                        title={name}
                      >
                        {name}
                      </span>
                    ))}
                    {selectedGa4CampaignFilterList.length > 3 && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        title={selectedGa4CampaignFilterList.slice(3).join(", ")}
                      >
                        +{selectedGa4CampaignFilterList.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">Data:</span> {provenanceProperty}
              {provenancePropertyId ? ` (Property ID: ${provenancePropertyId})` : ""}
              {" • "}
              <span className="font-medium text-slate-600 dark:text-slate-300">Report date (UTC):</span> {ga4ReportDate || "—"}
              {(
                (Array.isArray(selectedGa4CampaignFilterList) && selectedGa4CampaignFilterList.length > 0) ||
                provenanceCampaignFilter
              ) ? (
                <>
                  {" • "}
                  <span className="font-medium text-slate-600 dark:text-slate-300">Campaigns:</span>{" "}
                  {selectedGa4CampaignFilterList.length} selected
                </>
              ) : null}
              {provenanceLastUpdated ? (
                <>
                  {" • "}
                  <span className="font-medium text-slate-600 dark:text-slate-300">Last updated:</span>{" "}
                  {new Date(provenanceLastUpdated).toLocaleString()}
                </>
              ) : null}
            </div>
            {/* Intentionally no inline "Data warnings" banner in the MVP UI (keeps the page clean for execs). */}
          </div>

          {/* Connected Properties Management */}
          {ga4Connection?.connected && ga4Connection?.totalConnections > 1 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-5 h-5" />
                    <span>Connected GA4 Properties ({ga4Connection?.totalConnections})</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Open connection flow to add another property
                      window.location.href = `/campaigns/${campaignId}/ga4-metrics?add-property=true`;
                    }}
                    data-testid="button-add-property"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Property
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {ga4Connection?.connections?.map((connection: any, index: number) => (
                    <div
                      key={connection.id}
                      className={`p-4 rounded-lg border ${connection.isPrimary
                        ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      data-testid={`property-card-${connection.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-slate-900 dark:text-white">
                              {connection.displayName || connection.propertyName}
                            </h4>
                            {connection.isPrimary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Property ID: {connection.propertyId}
                          </p>
                          {connection.websiteUrl && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              {connection.websiteUrl}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            Connected {new Date(connection.connectedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`menu-${connection.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!connection.isPrimary && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/campaigns/${campaignId}/ga4-connections/${connection.id}/primary`,
                                      { method: 'PUT' }
                                    );
                                    if (response.ok) {
                                      queryClient.invalidateQueries({ queryKey: ["/api/ga4/check-connection", campaignId] });
                                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-connections"] });
                                      toast({ title: "Primary property updated" });
                                    }
                                  } catch (error) {
                                    toast({ title: "Failed to set primary property", variant: "destructive" });
                                  }
                                }}
                                data-testid={`action-set-primary-${connection.id}`}
                              >
                                Set as Primary
                              </DropdownMenuItem>
                            )}
                            {ga4Connection?.totalConnections > 1 && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  if (confirm('Are you sure you want to remove this GA4 property?')) {
                                    try {
                                      const response = await fetch(`/api/ga4-connections/${connection.id}`, {
                                        method: 'DELETE'
                                      });
                                      if (response.ok) {
                                        queryClient.invalidateQueries({ queryKey: ["/api/ga4/check-connection", campaignId] });
                                        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-connections"] });
                                        toast({ title: "GA4 property removed" });
                                      }
                                    } catch (error) {
                                      toast({ title: "Failed to remove property", variant: "destructive" });
                                    }
                                  }
                                }}
                                data-testid={`action-remove-${connection.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnostics dialog removed from main GA4 page UI */}

          {ga4Loading && !ga4Metrics ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <>
              {/* Charts and Detailed Analytics */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="campaigns">Ad Comparison</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="space-y-8">
                    {/* Summary Cards */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Summary</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Key performance metrics for your GA4 property</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatNumber(breakdownTotals.sessions || ga4Metrics?.sessions || 0)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected property</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Users</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatNumber(breakdownTotals.users || ga4Metrics?.users || 0)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected property</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatNumber(financialConversions || 0)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To date</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Revenue</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatMoney(Number(financialRevenue || 0))}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To date</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engagement Rate</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatPercentage(rateToPercent(dailySummedTotals.engagementRate || ga4Metrics?.engagementRate || 0))}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To date</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Bounce Rate</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                              {formatPercentage(rateToPercent(dailySummedTotals.bounceRate || ga4Metrics?.bounceRate || 0))}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To date</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Revenue & Financial */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Revenue & Financial</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Financial performance and return on investment</p>
                      </div>
                      {financialSpend > 0 ? (
                        <>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            {`Spend source: ${spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "Imported spend"} · Revenue range: ${(ga4ToDateResp as any)?.startDate ? `${String((ga4ToDateResp as any)?.startDate)} → ${String((ga4ToDateResp as any)?.endDate || "yesterday")}` : "to date"}`}
                          </p>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {formatMoney(Number(financialRevenue || 0))}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cumulative to date</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {formatMoney(Number(financialSpend || 0))}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "—"}
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Latest Day Revenue</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {formatMoney(Number(ga4DailyRows.length > 0 ? ga4DailyRows[ga4DailyRows.length - 1]?.revenue || 0 : 0))}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {ga4DailyRows.length > 0 ? ga4DailyRows[ga4DailyRows.length - 1]?.date : "—"}
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Latest Day Spend</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {formatMoney(Number(ga4DailyRows.length > 0 ? ga4DailyRows[ga4DailyRows.length - 1]?._raw?.spend || 0 : 0))}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {ga4DailyRows.length > 0 ? ga4DailyRows[ga4DailyRows.length - 1]?.date : "—"}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {financialROAS.toFixed(2)}x
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revenue ÷ Spend</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {formatPercentage(financialROI)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">(Revenue − Spend) ÷ Spend</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-5">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">CPA</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                  {Number(financialConversions || 0) > 0 ? formatMoney(Number(financialCPA || 0)) : "—"}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Spend ÷ Conversions{Number(financialConversions || 0) <= 0 ? " (needs conversions > 0)" : ""}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Add spend to unlock ROAS / ROI / CPA</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Revenue and conversions come from GA4. To calculate ROAS/ROI/CPA, add spend from any source (ad platform, spreadsheet, or manual entry).
                          </p>
                          {Array.isArray(spendSourcesResp?.sources) && spendSourcesResp.sources.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                              Spend sources exist, but <span className="font-medium">Spend to date</span> is{" "}
                              <span className="font-medium">{formatMoney(Number(spendToDateResp?.spendToDate || 0))}</span>. If this looks wrong, edit the spend source and re-import/update the total.
                            </p>
                          )}
                          <div className="mt-3">
                            <Link href={`/campaigns/${campaignId}#data-sources`}>
                              <Button variant="outline" size="sm">Manage in Data Sources</Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Campaign Breakdown */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Campaign Breakdown</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Performance metrics aggregated by UTM campaign</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {breakdownLoading ? (
                            <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                          ) : campaignBreakdownAgg.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <div className="max-h-[420px] overflow-y-auto">
                                <table className="w-full text-sm table-fixed">
                                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b">
                                    <tr>
                                      <th className="text-left font-medium px-2 py-2">Campaign</th>
                                      <th className="text-right font-medium px-2 py-2 w-[90px]">Sessions</th>
                                      <th className="text-right font-medium px-2 py-2 w-[80px]">Users</th>
                                      <th className="text-right font-medium px-2 py-2 w-[100px]">Conversions</th>
                                      <th className="text-right font-medium px-2 py-2 w-[100px]">Conv Rate</th>
                                      <th className="text-right font-medium px-2 py-2 w-[100px]">Revenue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {campaignBreakdownAgg.map((c, idx) => (
                                      <tr key={c.name || idx} className="border-b last:border-b-0">
                                        <td className="px-2 py-2 truncate" title={c.name}>{c.name}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.sessions)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.users)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.conversions)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{c.conversionRate.toFixed(2)}%</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(c.revenue)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              No campaign breakdown data available for this date range.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Landing Pages */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Landing Pages</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Cumulative across all campaigns — where users land and which pages drive outcomes</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {Array.isArray(ga4LandingPages?.rows) && ga4LandingPages.rows.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[34%]">Landing page</th>
                                    <th className="text-left p-3 w-[16%]">Source/Medium</th>
                                    <th className="text-right p-3">Sessions</th>
                                    <th className="text-right p-3">
                                      <div className="flex items-center justify-end gap-1">
                                        Users
                                        <AlertCircle className="w-3.5 h-3.5 text-slate-400" title="Non-additive: Unique users can appear on multiple landing pages" />
                                      </div>
                                    </th>
                                    <th className="text-right p-3">Conversions</th>
                                    <th className="text-right p-3">Conv. rate</th>
                                    <th className="text-right p-3">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ga4LandingPages.rows.slice(0, 20).map((r: any, idx: number) => {
                                    const sessions = Number(r?.sessions || 0);
                                    const conversions = Number(r?.conversions || 0);
                                    const cr = sessions > 0 ? (conversions / sessions) * 100 : 0;
                                    return (
                                      <tr key={`${r?.landingPage || idx}:${idx}`} className="border-b">
                                        <td className="p-3">
                                          <div className="font-medium text-slate-900 dark:text-white truncate" title={String(r?.landingPage || "(not set)")}>
                                            {String(r?.landingPage || "(not set)")}
                                          </div>
                                        </td>
                                        <td className="p-3 text-slate-600 dark:text-slate-400">
                                          <span className="truncate" title={`${String(r?.source || "(not set)")}/${String(r?.medium || "(not set)")}`}>
                                            {String(r?.source || "(not set)")}/{String(r?.medium || "(not set)")}
                                          </span>
                                        </td>
                                        <td className="p-3 text-right">{formatNumber(Number(r?.sessions || 0))}</td>
                                        <td className="p-3 text-right">{formatNumber(Number(r?.users || 0))}</td>
                                        <td className="p-3 text-right">{formatNumber(Number(r?.conversions || 0))}</td>
                                        <td className="p-3 text-right">{formatPercentage(cr)}</td>
                                        <td className="p-3 text-right">{formatMoney(Number(r?.revenue || 0))}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              No landing page data available yet for this property/campaign selection.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Conversion Events */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Conversion Events</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Cumulative across all campaigns — which conversion events are driving results</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {Array.isArray(ga4ConversionEvents?.rows) && ga4ConversionEvents.rows.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[36%]">Event</th>
                                    <th className="text-right p-3">Conversions</th>
                                    <th className="text-right p-3">Event count</th>
                                    <th className="text-right p-3">Users</th>
                                    <th className="text-right p-3">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ga4ConversionEvents.rows.slice(0, 25).map((r: any, idx: number) => (
                                    <tr key={`${r?.eventName || idx}:${idx}`} className="border-b">
                                      <td className="p-3">
                                        <div className="font-medium text-slate-900 dark:text-white truncate" title={String(r?.eventName || "(not set)")}>
                                          {String(r?.eventName || "(not set)")}
                                        </div>
                                      </td>
                                      <td className="p-3 text-right">{formatNumber(Number(r?.conversions || 0))}</td>
                                      <td className="p-3 text-right">{formatNumber(Number(r?.eventCount || 0))}</td>
                                      <td className="p-3 text-right">{formatNumber(Number(r?.users || 0))}</td>
                                      <td className="p-3 text-right">{formatMoney(Number(r?.revenue || 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              No conversion event breakdown available yet for this property/campaign selection.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Modals (rendered always) */}
                  <AddSpendWizardModal
                    campaignId={campaignId as string}
                    open={showSpendDialog}
                    onOpenChange={setShowSpendDialog}
                    currency={(campaign as any)?.currency || "USD"}
                    dateRange={dateRange}
                    initialSource={activeSpendSource || undefined}
                    onProcessed={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                    }}
                  />
                  <AddRevenueWizardModal
                    campaignId={campaignId as string}
                    open={showRevenueDialog}
                    onOpenChange={setShowRevenueDialog}
                    currency={(campaign as any)?.currency || "USD"}
                    dateRange={dateRange}
                    initialSource={activeRevenueSource || undefined}
                    platformContext="ga4"
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                    }}
                  />
                  <AlertDialog open={showDeleteSpendDialog} onOpenChange={setShowDeleteSpendDialog}>
                    <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900 dark:text-white">Remove spend data?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                          This will remove spend from Financial metrics (ROAS/ROI/CPA) for this campaign until you add spend again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={async () => {
                            try {
                              const resp = await fetch(`/api/campaigns/${campaignId}/spend-sources`, { method: "DELETE" });
                              const json = await resp.json().catch(() => null);
                              if (!resp.ok || json?.success === false) {
                                throw new Error(json?.error || "Failed to remove spend");
                              }
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setShowDeleteSpendDialog(false);
                            }
                          }}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog open={showDeleteRevenueDialog} onOpenChange={setShowDeleteRevenueDialog}>
                    <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900 dark:text-white">Remove revenue source?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                          This will remove imported revenue for this campaign until you add a revenue source again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={async () => {
                            try {
                              const resp = await fetch(`/api/campaigns/${campaignId}/revenue-sources`, { method: "DELETE" });
                              const json = await resp.json().catch(() => null);
                              if (!resp.ok || json?.success === false) {
                                throw new Error(json?.error || "Failed to remove revenue source");
                              }
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setShowDeleteRevenueDialog(false);
                            }
                          }}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                <TabsContent value="kpis">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track daily GA4 KPIs and progress toward targets (blocked items are excluded from scoring).
                        </p>
                      </div>
                      <Button size="sm" onClick={openCreateKPI}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create KPI
                      </Button>
                    </div>

                    <Card>
                      <CardContent>
                        {kpisLoading ? (
                          <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* KPI performance tracker (exec snapshot) */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                              <Card>
                                <CardContent className="p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total KPIs</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpiTracker.total}</p>
                                    </div>
                                    <Target className="w-7 h-7 text-slate-500" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">On Track</p>
                                      <p className="text-2xl font-bold text-emerald-600">{kpiTracker.onTrack}</p>
                                    </div>
                                    <BadgeCheck className="w-7 h-7 text-emerald-600" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Needs Attention</p>
                                      <p className="text-2xl font-bold text-amber-600">{kpiTracker.needsAttention}</p>
                                    </div>
                                    <AlertTriangle className="w-7 h-7 text-amber-600" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Behind</p>
                                      <p className="text-2xl font-bold text-red-600">{kpiTracker.behind}</p>
                                    </div>
                                    <TrendingDown className="w-7 h-7 text-red-600" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg. Progress</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {kpiTracker.avgPct.toFixed(1)}%
                                      </p>
                                    </div>
                                    <TrendingUp className="w-7 h-7 text-violet-600" />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {kpiTracker.blocked > 0 ? (
                              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 dark:text-white">Some KPIs are Blocked</div>
                                    <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                      {kpiTracker.blocked} KPI{kpiTracker.blocked === 1 ? "" : "s"} can’t be evaluated because Spend and/or Revenue was removed.
                                      Blocked KPIs are excluded from performance scoring to avoid misleading executives.
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Link href={`/campaigns/${campaignId}#data-sources`}>
                                      <Button type="button" variant="outline" size="sm">
                                        Manage Data Sources
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {platformKPIs.length === 0 ? (
                              <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                                <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No KPIs yet</h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                  Create your first KPI to track GA4 performance for this campaign.
                                </p>
                              </div>
                            ) : (
                              <div className="grid gap-4 md:grid-cols-2">
                                {platformKPIs.map((kpi: any) => {
                                  const deps = getMissingDependenciesForMetric(String(kpi?.metric || kpi?.name || ""));
                                  const isBlocked = deps.missing.length > 0;
                                  const p = isBlocked ? null : computeKpiProgress(kpi);
                                  const t = getKpiEffectiveTarget(kpi);
                                  const metricKey = String(kpi?.metric || kpi?.name || "");
                                  const { Icon, color } = getKpiIcon(metricKey);
                                  const statusLabel = isBlocked
                                    ? "Blocked"
                                    : p!.status === "on_track"
                                      ? "On Track"
                                      : p!.status === "needs_attention"
                                        ? "Needs Attention"
                                        : "Behind";
                                  const statusColor = isBlocked
                                    ? "text-slate-700 dark:text-slate-300"
                                    : p!.status === "on_track"
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : p!.status === "needs_attention"
                                        ? "text-amber-700 dark:text-amber-300"
                                        : "text-red-700 dark:text-red-300";

                                  return (
                                    <Card key={kpi.id} className="border-slate-200 dark:border-slate-700">
                                      <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                              <Icon className={`w-5 h-5 ${color}`} />
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                                                  {kpi.name}
                                                </h4>
                                                <Badge className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                  {String(kpi?.metric || kpi?.name || "Custom")}
                                                </Badge>
                                              </div>
                                              {kpi.description ? (
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                  {kpi.description}
                                                </p>
                                              ) : null}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => {
                                                setEditingKPI(kpi);
                                                setSelectedKPITemplate(null);
                                                kpiForm.reset({
                                                  ...kpiForm.getValues(),
                                                  name: String(kpi?.name || ""),
                                                  metric: String(kpi?.metric || kpi?.name || ""),
                                                  description: String(kpi?.description || ""),
                                                  unit: String(kpi?.unit || "%"),
                                                  currentValue: formatNumberByUnit(String(getLiveKpiValue(kpi) || "0"), String(kpi?.unit || "%")),
                                                  targetValue: formatNumberByUnit(String(kpi?.targetValue || ""), String(kpi?.unit || "%")),
                                                  priority: (kpi?.priority || "medium") as any,
                                                  alertsEnabled: Boolean(kpi?.alertsEnabled ?? true),
                                                  alertThreshold: typeof kpi?.alertThreshold === "number" ? kpi.alertThreshold : Number(kpi?.alertThreshold || 80),
                                                  emailNotifications: Boolean(kpi?.emailNotifications ?? false),
                                                  slackNotifications: Boolean(kpi?.slackNotifications ?? false),
                                                  alertFrequency: (kpi?.alertFrequency || "daily") as any,
                                                });
                                                setShowKPIDialog(true);
                                              }}
                                              title="Edit KPI"
                                              aria-label="Edit KPI"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => onDeleteKPI(kpi.id)}
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                              disabled={deleteKPIMutation.isPending}
                                              title="Delete KPI"
                                              aria-label="Delete KPI"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Current</div>
                                            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                              {isBlocked ? "—" : formatValue(getLiveKpiValue(kpi) || "0", kpi.unit)}
                                            </div>
                                          </div>
                                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Target</div>
                                            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                              {formatValue(String(t.effectiveTarget), kpi.unit)}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-4">
                                          <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">Progress</span>
                                            <span className="text-slate-700 dark:text-slate-300">{isBlocked ? "—" : `${p!.labelPct}%`}</span>
                                          </div>
                                          <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                            <div
                                              className={`h-2.5 rounded-full ${isBlocked ? "bg-slate-400" : p!.color}`}
                                              style={{ width: `${isBlocked ? 0 : p!.pct}%` }}
                                            />
                                          </div>
                                          <div className={`mt-3 text-sm font-medium ${statusColor}`}>
                                            {statusLabel}
                                          </div>
                                          {isBlocked ? (
                                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                              Missing: <span className="font-medium">{deps.missing.join(" + ")}</span>. This KPI is paused until inputs are restored.
                                              <div className="mt-2">
                                                <Link href={`/campaigns/${campaignId}#data-sources`}>
                                                  <Button type="button" variant="outline" size="sm">
                                                    Manage Data Sources
                                                  </Button>
                                                </Link>
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="benchmarks">
                  <div className="space-y-6">
                    <AlertDialog open={showDeleteBenchmarkDialog} onOpenChange={setShowDeleteBenchmarkDialog}>
                      <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-900 dark:text-white">Delete benchmark?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                            This will permanently remove the benchmark from this GA4 Benchmarks list.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteBenchmarkId(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={confirmDeleteBenchmark}
                            disabled={deleteBenchmarkMutation.isPending}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance Benchmarks</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and measure performance against industry standards and custom targets
                        </p>
                      </div>
                      <Dialog
                        open={showCreateBenchmark}
                        onOpenChange={(open) => {
                          setShowCreateBenchmark(open);
                          if (!open) {
                            setSelectedBenchmarkTemplate(null);
                            setEditingBenchmark(null);
                            setNewBenchmark({
                              name: "",
                              category: "",
                              benchmarkType: "custom",
                              unit: SELECT_UNIT as any,
                              benchmarkValue: "",
                              currentValue: "",
                              metric: "",
                              industry: "",
                              geoLocation: "",
                              description: "",
                              source: "",
                            });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              setEditingBenchmark(null);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Benchmark
                          </Button>
                        </DialogTrigger>
                        {/* Avoid forcing extreme z-index here; it can cause Radix Select menus to render behind the modal. */}
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-6">
                          <DialogClose className="absolute right-4 top-4 rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors z-[60]">
                            <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            <span className="sr-only">Close</span>
                          </DialogClose>
                          <DialogHeader className="pb-4 pr-8">
                            <DialogTitle className="pr-8 text-lg">{editingBenchmark ? "Edit Benchmark" : "Create New Benchmark"}</DialogTitle>
                            <DialogDescription className="text-sm">
                              {editingBenchmark
                                ? "Update this benchmark to reflect your latest targets or industry standard."
                                : "Set up a new performance benchmark to track against industry standards or custom targets"}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateBenchmark} className="space-y-6">
                            {/* Select Benchmark Template (mirrors KPI modal template grid) */}
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="font-medium text-slate-900 dark:text-white">Select Benchmark Template</h4>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Choose a metric to benchmark, then fill in the benchmark details below.
                                  </p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={resetBenchmarkDraft}>
                                  Reset
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { name: "ROAS", metric: "roas", unit: "%", description: "Revenue ÷ Spend × 100" },
                                  { name: "ROI", metric: "roi", unit: "%", description: "(Revenue − Spend) ÷ Spend × 100" },
                                  { name: "CPA", metric: "cpa", unit: "$", description: "Spend ÷ Conversions" },
                                  { name: "Revenue", metric: "revenue", unit: "$", description: "Total revenue in GA4 for the selected period" },
                                  { name: "Total Conversions", metric: "conversions", unit: "count", description: "Total GA4 conversions for the selected period" },
                                  { name: "Conversion Rate", metric: "conversionRate", unit: "%", description: "Conversions ÷ Sessions × 100" },
                                  { name: "Engagement Rate", metric: "engagementRate", unit: "%", description: "Engaged Sessions ÷ Sessions × 100" },
                                  { name: "Total Users", metric: "users", unit: "count", description: "Total users for the selected period" },
                                  { name: "Total Sessions", metric: "sessions", unit: "count", description: "Total sessions for the selected period" },
                                  { name: "Create Custom Benchmark", metric: "__custom__", unit: SELECT_UNIT as any, _isCustom: true },
                                ].map((template) => {
                                  const isCustom = (template as any)?._isCustom === true;
                                  const requiresSpend = template.metric === "roas" || template.metric === "roi" || template.metric === "cpa";
                                  const requiresRevenue = template.metric === "roas" || template.metric === "roi" || template.metric === "revenue";
                                  const disabled =
                                    (requiresSpend && !spendMetricAvailable) ||
                                    (requiresRevenue && !revenueMetricAvailable);
                                  return (
                                    <div
                                      key={template.metric}
                                      className={`p-3 border-2 rounded-lg transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                        } ${!isCustom && selectedBenchmarkTemplate?.metric === template.metric
                                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                                        }`}
                                      onClick={() => {
                                        if (disabled) return;
                                        if (isCustom) {
                                          setSelectedBenchmarkTemplate(null);
                                          setNewBenchmark((prev) => ({
                                            ...prev,
                                            benchmarkType: "custom",
                                            metric: "",
                                            category: "",
                                            name: "",
                                            unit: SELECT_UNIT as any,
                                            currentValue: "",
                                            benchmarkValue: "",
                                            industry: "",
                                            description: prev.description || "Benchmark target for this metric.",
                                          }));
                                          return;
                                        }
                                        setSelectedBenchmarkTemplate(template);
                                        const industry = newBenchmark.industry;
                                        const isIndustryType = (newBenchmark.benchmarkType || "industry") === "industry";
                                        const liveCurrent = getLiveBenchmarkCurrentValue(template.metric);
                                        const derivedCategory = deriveBenchmarkCategoryFromMetric(template.metric);
                                        const defaultDesc = getDefaultBenchmarkDescription(template.metric);
                                        const campaignCurrencyCode = String((campaign as any)?.currency || "USD");
                                        const resolvedUnit = template.unit === "$" ? campaignCurrencyCode : template.unit;
                                        setNewBenchmark((prev) => ({
                                          ...prev,
                                          metric: template.metric,
                                          category: derivedCategory,
                                          // When selecting a template, keep name/unit in sync with the selected metric
                                          // so switching tiles (e.g. ROAS -> ROI) updates both fields predictably.
                                          name: template.name,
                                          unit: resolvedUnit,
                                          description: prev.description ? prev.description : defaultDesc,
                                          // Format using the selected metric's unit (important when switching from % -> count).
                                          currentValue: formatNumberByUnit(String(liveCurrent), String(resolvedUnit || "%")),
                                          // If we're benchmarking against Industry, avoid leaving a stale benchmarkValue
                                          // from the previously selected metric; we'll refetch below.
                                          benchmarkValue: isIndustryType && industry ? "" : prev.benchmarkValue,
                                        }));

                                        // If an industry is already selected, switching metrics should refetch the
                                        // industry benchmark for the new metric and populate Benchmark Value.
                                        if (isIndustryType && industry) {
                                          fetch(
                                            `/api/industry-benchmarks/${encodeURIComponent(industry)}/${encodeURIComponent(template.metric)}`
                                          )
                                            .then((resp) => (resp.ok ? resp.json().catch(() => null) : null))
                                            .then((data) => {
                                              if (data && typeof data.value !== "undefined") {
                                                const formatted = formatNumberByUnit(String(data.value), String(data.unit || resolvedUnit || "%"));
                                                setNewBenchmark((prev) => ({
                                                  ...prev,
                                                  benchmarkValue: formatted,
                                                  unit:
                                                    (prev.unit && String(prev.unit) !== SELECT_UNIT ? prev.unit : "") ||
                                                    (data.unit === "$" ? String((campaign as any)?.currency || "USD") : data.unit) ||
                                                    "",
                                                }));
                                              }
                                            })
                                            .catch(() => {
                                              // ignore - industry benchmarks are best-effort
                                            });
                                        }
                                      }}
                                    >
                                      <div className="font-medium text-sm text-slate-900 dark:text-white">
                                        {template.name}
                                      </div>
                                      {disabled ? (
                                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                          {requiresSpend && !spendMetricAvailable && requiresRevenue && !revenueMetricAvailable
                                            ? "Spend + Revenue required (add both to unlock)"
                                            : requiresSpend && !spendMetricAvailable
                                              ? "Spend required (add spend to unlock)"
                                              : requiresRevenue && !revenueMetricAvailable
                                                ? "Revenue required (add GA4 revenue metric or import revenue)"
                                                : "Unavailable"}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Benchmark Name + Unit */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Benchmark Name *</div>
                                <Input
                                  value={newBenchmark.name}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, name: e.target.value })}
                                  placeholder="e.g., Target sessions for this campaign"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Unit *</div>
                                <Select
                                  value={String(newBenchmark.unit || SELECT_UNIT)}
                                  onValueChange={(v) => setNewBenchmark({ ...newBenchmark, unit: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[10000]">
                                    <SelectItem value={SELECT_UNIT}>Select unit</SelectItem>
                                    <SelectItem value="%">Percentage (%)</SelectItem>
                                    <SelectItem value="count">Count</SelectItem>
                                    <SelectItem value={String((campaign as any)?.currency || "USD")}>
                                      Currency ({String((campaign as any)?.currency || "USD")})
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</div>
                              <Textarea
                                value={newBenchmark.description}
                                maxLength={BENCHMARK_DESC_MAX}
                                onChange={(e) => setNewBenchmark({ ...newBenchmark, description: e.target.value.slice(0, BENCHMARK_DESC_MAX) })}
                                rows={3}
                                placeholder="What is this benchmark and why does it matter?"
                              />
                              <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                                {(newBenchmark.description || "").length}/{BENCHMARK_DESC_MAX}
                              </div>
                            </div>

                            {/* Current Value + Benchmark Value */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Value</div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={newBenchmark.currentValue}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, currentValue: e.target.value })}
                                  onBlur={(e) =>
                                    setNewBenchmark((prev) => ({
                                      ...prev,
                                      currentValue: formatNumberByUnit(e.target.value, String(prev.unit || "%")),
                                    }))
                                  }
                                  placeholder="Auto-filled from GA4 for the selected metric (edit if needed)"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Benchmark Value *</div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={newBenchmark.benchmarkValue}
                                  onChange={(e) => {
                                    const nextRaw = e.target.value;
                                    // UX: always enforce numeric-only input and format as the user types (commas, no forced .00).
                                    setNewBenchmark({
                                      ...newBenchmark,
                                      benchmarkValue: formatNumberWhileTyping(nextRaw, String(newBenchmark.unit || "%")),
                                    });
                                  }}
                                  onBlur={(e) =>
                                    setNewBenchmark((prev) => ({
                                      ...prev,
                                      benchmarkValue: formatNumberByUnit(e.target.value, String(prev.unit || "%")),
                                    }))
                                  }
                                  placeholder="Enter your benchmark value"
                                  required
                                />
                              </div>
                            </div>

                            {/* Benchmark Type */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Benchmark Type *</div>
                                <Select
                                  value={newBenchmark.benchmarkType || "custom"}
                                  onValueChange={(v) => {
                                    if (v === "custom") {
                                      // Custom Value: leave Benchmark Value empty so user can enter it manually.
                                      setNewBenchmark({ ...newBenchmark, benchmarkType: v, industry: "", benchmarkValue: "" });
                                      return;
                                    }
                                    // Industry suggestion: clear benchmark value until industry is selected.
                                    setNewBenchmark({ ...newBenchmark, benchmarkType: v, benchmarkValue: "", industry: "" });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[10000]">
                                    <SelectItem value="industry">Industry suggestion (optional)</SelectItem>
                                    <SelectItem value="custom">Custom Value</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {newBenchmark.benchmarkType === "industry" && (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Industry</div>
                                  <Select
                                    value={newBenchmark.industry}
                                    onValueChange={async (industry) => {
                                      setNewBenchmark({ ...newBenchmark, industry });
                                      if (!industry || !newBenchmark.metric) return;
                                      try {
                                        const resp = await fetch(
                                          `/api/industry-benchmarks/${encodeURIComponent(industry)}/${encodeURIComponent(newBenchmark.metric)}`
                                        );
                                        if (!resp.ok) {
                                          setNewBenchmark((prev) => ({ ...prev, benchmarkValue: "" }));
                                          return;
                                        }
                                        const data = await resp.json().catch(() => null);
                                        if (data && typeof data.value !== "undefined") {
                                          setNewBenchmark((prev) => ({
                                            ...prev,
                                            benchmarkValue: formatNumberByUnit(String(data.value), String(prev.unit || data.unit || "%")),
                                            unit: prev.unit || data.unit || prev.unit,
                                          }));
                                        }
                                      } catch {
                                        // ignore - industry benchmarks are best-effort
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select industry" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64 z-[10000]">
                                      {(industries || []).length === 0 ? (
                                        <SelectItem value="__none__" disabled>
                                          No industries loaded (refresh page or try again)
                                        </SelectItem>
                                      ) : null}
                                      {(industries || []).map((i) => (
                                        <SelectItem key={i.value} value={i.value}>
                                          {i.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Selecting an industry will auto-fill a suggested Benchmark Value for the chosen metric.
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                              <Button type="button" variant="outline" onClick={() => setShowCreateBenchmark(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                                {editingBenchmark ? "Update Benchmark" : "Create Benchmark"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Benchmarks List */}
                    <div className="space-y-4">
                      {benchmarksLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                              <CardContent className="p-6">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Benchmarks performance tracker (exec snapshot) */}
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                            <Card>
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{benchmarkTracker.total}</p>
                                  </div>
                                  <Target className="w-7 h-7 text-slate-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">On Track</p>
                                    <p className="text-2xl font-bold text-emerald-600">{benchmarkTracker.onTrack}</p>
                                  </div>
                                  <BadgeCheck className="w-7 h-7 text-emerald-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Needs Attention</p>
                                    <p className="text-2xl font-bold text-amber-600">{benchmarkTracker.needsAttention}</p>
                                  </div>
                                  <AlertTriangle className="w-7 h-7 text-amber-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Behind</p>
                                    <p className="text-2xl font-bold text-red-600">{benchmarkTracker.behind}</p>
                                  </div>
                                  <TrendingDown className="w-7 h-7 text-red-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg. Progress</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                      {benchmarkTracker.avgPct.toFixed(1)}%
                                    </p>
                                  </div>
                                  <TrendingUp className="w-7 h-7 text-violet-600" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {benchmarkTracker.blocked > 0 ? (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white">Some Benchmarks are Blocked</div>
                                  <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                    {benchmarkTracker.blocked} benchmark{benchmarkTracker.blocked === 1 ? "" : "s"} can’t be evaluated because Spend and/or Revenue was removed.
                                    Blocked benchmarks are excluded from performance scoring to avoid misleading executives.
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Link href={`/campaigns/${campaignId}#data-sources`}>
                                    <Button type="button" variant="outline" size="sm">
                                      Manage Data Sources
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {benchmarks && benchmarks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {benchmarks.map((benchmark) => (
                                <Card key={benchmark.id} className="hover:shadow-lg transition-shadow">
                                  <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-slate-900 dark:text-white">{benchmark.name}</h4>
                                        {benchmark.description ? (
                                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                            {benchmark.description}
                                          </div>
                                        ) : null}
                                        <div className="flex items-center space-x-2 mt-1">
                                          <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                            {getBenchmarkMetricLabel((benchmark as any)?.metric, benchmark.name)}
                                          </span>
                                        </div>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => handleEditBenchmark(benchmark)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteBenchmark(benchmark.id)}
                                            className="text-red-600 dark:text-red-400"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Benchmark</span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {formatBenchmarkValue(benchmark.benchmarkValue, benchmark.unit)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Current</span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {(() => {
                                            const deps = getMissingDependenciesForMetric(String((benchmark as any)?.metric || ""));
                                            const isBlocked = deps.missing.length > 0;
                                            return isBlocked ? "—" : formatBenchmarkValue(getBenchmarkDisplayCurrentValue(benchmark), benchmark.unit);
                                          })()}
                                        </span>
                                      </div>

                                      {(() => {
                                        const deps = getMissingDependenciesForMetric(String((benchmark as any)?.metric || ""));
                                        const isBlocked = deps.missing.length > 0;
                                        if (isBlocked) {
                                          return (
                                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                                              <div className="text-sm font-medium text-slate-900 dark:text-white">Blocked</div>
                                              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                Missing: <span className="font-medium">{deps.missing.join(" + ")}</span>. Restore inputs to resume accurate tracking.
                                              </div>
                                              <div className="mt-2">
                                                <Link href={`/campaigns/${campaignId}#data-sources`}>
                                                  <Button type="button" variant="outline" size="sm">
                                                    Manage Data Sources
                                                  </Button>
                                                </Link>
                                              </div>
                                            </div>
                                          );
                                        }
                                        const bench = parseFloat(stripNumberFormatting(String((benchmark as any)?.benchmarkValue || "0")));
                                        if (!Number.isFinite(bench) || bench <= 0) return null;
                                        const p = computeBenchmarkProgress(benchmark);
                                        const statusLabel =
                                          p.status === "on_track" ? "On Track" : p.status === "needs_attention" ? "Needs Attention" : "Behind";
                                        const statusColor =
                                          p.status === "on_track"
                                            ? "text-green-600 dark:text-green-400"
                                            : p.status === "needs_attention"
                                              ? "text-yellow-600 dark:text-yellow-400"
                                              : "text-red-600 dark:text-red-400";

                                        const delta = Number.isFinite(p.deltaPct) ? p.deltaPct : 0;
                                        const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;

                                        return (
                                          <>
                                            <div className="space-y-2 pt-1">
                                              <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress to Benchmark</span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400">{p.labelPct}%</span>
                                              </div>
                                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                                              </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-slate-600 dark:text-slate-400">Performance</span>
                                              <div className="flex items-center space-x-2">
                                                <span className={`font-medium ${statusColor}`}>{deltaLabel}</span>
                                                {delta >= 0 ? (
                                                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                ) : (
                                                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                )}
                                                <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                                              </div>
                                            </div>
                                          </>
                                        );
                                      })()}

                                      {benchmark.industry && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Industry: {benchmark.industry}
                                        </div>
                                      )}

                                      {benchmark.source && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Source: {benchmark.source}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <Card>
                              <CardContent className="p-8 text-center">
                                <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Benchmarks Yet</h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                  Create your first benchmark to start tracking performance against industry standards
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reports">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reports</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Create and download exec-ready GA4 reports (PDF) from this campaign’s live data.
                        </p>
                      </div>
                      <Button
                        className="gap-2"
                        onClick={() => {
                          setEditingGA4ReportId(null);
                          setGa4ReportModalStep("standard");
                          setGa4ReportForm({
                            name: "",
                            description: "",
                            reportType: "overview",
                            configuration: {
                              sections: { overview: true, acquisition: false, trends: false, kpis: false, benchmarks: false },
                            },
                          });
                          setShowGA4ReportModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Create Report
                      </Button>
                    </div>

                    {ga4ReportsLoading ? (
                      <div className="animate-pulse space-y-4">
                        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    ) : Array.isArray(ga4Reports) && ga4Reports.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {ga4Reports.map((r: any) => (
                          <Card key={r.id} className="border-slate-200 dark:border-slate-700">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{r.name}</h3>
                                    <Badge variant="outline">{String(r.reportType || "overview")}</Badge>
                                  </div>
                                  {r.description ? (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{r.description}</p>
                                  ) : null}
                                  {r.createdAt ? (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                      Created {new Date(r.createdAt).toLocaleDateString()}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                      let cfg: any = {};
                                      try {
                                        cfg = r.configuration ? JSON.parse(String(r.configuration)) : {};
                                      } catch {
                                        cfg = {};
                                      }
                                      downloadGA4Report({
                                        reportType: String(r.reportType || "overview"),
                                        configuration: cfg,
                                        reportName: String(r.name || "GA4 Report"),
                                      });
                                    }}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingGA4ReportId(String(r.id));
                                      setGa4ReportModalStep(String(r.reportType || "overview") === "custom" ? "custom" : "standard");
                                      let cfg: any = {};
                                      try {
                                        cfg = r.configuration ? JSON.parse(String(r.configuration)) : {};
                                      } catch {
                                        cfg = {};
                                      }
                                      setGa4ReportForm({
                                        name: String(r.name || ""),
                                        description: String(r.description || ""),
                                        reportType: String(r.reportType || "overview"),
                                        configuration: cfg?.sections ? cfg : { sections: { overview: true } },
                                      });
                                      setShowGA4ReportModal(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 dark:text-red-400"
                                    onClick={() => setDeleteGA4ReportId(String(r.id))}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-10 text-center">
                          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                          <div className="text-slate-900 dark:text-white font-medium">No reports created yet</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Create your first GA4 report to download a PDF snapshot.
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="campaigns">
                  <GA4CampaignComparison
                    campaignBreakdownAgg={campaignBreakdownAgg}
                    breakdownLoading={breakdownLoading}
                    selectedMetric={campaignComparisonMetric}
                    onMetricChange={setCampaignComparisonMetric}
                    formatNumber={formatNumber}
                    formatMoney={formatMoney}
                  />
                </TabsContent>

                <TabsContent value="insights">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Insights</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Actionable insights from financial integrity checks, KPI + Benchmark performance, plus anomaly detection from daily deltas.
                      </p>
                    </div>

                    <Card className="border-slate-200 dark:border-slate-700">
                      <CardHeader>
                        <CardTitle>Executive financials (to date)</CardTitle>
                        <CardDescription>
                          Uses spend-to-date and GA4 revenue-to-date (or imported revenue-to-date when GA4 revenue is missing).
                          {(ga4ToDateResp as any)?.startDate ? ` Range: ${String((ga4ToDateResp as any)?.startDate)} → ${String((ga4ToDateResp as any)?.endDate || "yesterday")}.` : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend (to date)</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatMoney(Number(financialSpend || 0))}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Source: {spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "—"}
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Revenue (to date)</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatMoney(Number(financialRevenue || 0))}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {ga4HasRevenueMetric ? "From GA4 revenue metric" : "Imported revenue (used when GA4 revenue is missing)"}
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS (to date)</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {Number(financialROAS || 0).toFixed(2)}x
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revenue ÷ Spend</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI (to date)</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(Number(financialROI || 0))}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">(\(Revenue - Spend\)) ÷ Spend</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Sources used (provenance) */}
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                          <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">Sources used</div>
                          <div className="grid gap-1">
                            <div>
                              <span className="font-medium">Spend</span>: {spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "Not connected"}
                            </div>
                            <div>
                              <span className="font-medium">Revenue</span>:{" "}
                              {ga4HasRevenueMetric
                                ? `GA4 revenue metric (${ga4RevenueMetricName || "totalRevenue"})`
                                : activeRevenueSource
                                  ? `Imported (${String((activeRevenueSource as any)?.displayName || (activeRevenueSource as any)?.sourceType || "revenue source")})`
                                  : "Not connected"}
                            </div>
                            <div>
                              <span className="font-medium">Policy</span>: Use GA4 revenue when a GA4 revenue metric is available; otherwise fall back to imported revenue-to-date to avoid double counting.
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Trends card — replaces Performance Rollups with chart + metric selector */}
                    <Card className="border-slate-200 dark:border-slate-700">
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <CardTitle>Trends</CardTitle>
                            <CardDescription>
                              Daily shows day-by-day values. 7d/30d show rolling-window summaries vs the prior window.
                            </CardDescription>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex items-center gap-1">
                              {(["daily", "7d", "30d"] as const).map((mode) => (
                                <Button
                                  key={mode}
                                  variant={insightsTrendMode === mode ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => { setInsightsDailyShowMore(false); setInsightsTrendMode(mode); }}
                                >
                                  {mode === "daily" ? "Daily" : mode}
                                </Button>
                              ))}
                            </div>
                            <div className="min-w-[200px]">
                              <Select value={insightsTrendMetric} onValueChange={setInsightsTrendMetric}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Metric" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sessions">Sessions</SelectItem>
                                  <SelectItem value="users">Users</SelectItem>
                                  <SelectItem value="conversions">Conversions</SelectItem>
                                  <SelectItem value="revenue">Revenue</SelectItem>
                                  <SelectItem value="pageviews">Page Views</SelectItem>
                                  <SelectItem value="engagementRate">Engagement Rate</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Trends line chart */}
                        {(() => {
                          const dailyRows = Array.isArray(ga4TimeSeries) ? (ga4TimeSeries as any[]).filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(r?.date || ""))) : [];
                          if (dailyRows.length < 2) {
                            return (
                              <div className="text-sm text-slate-600 dark:text-slate-400 py-4">
                                Need at least 2 days of GA4 daily history. Available: {dailyRows.length}.
                              </div>
                            );
                          }

                          const sorted = [...dailyRows].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
                          const metric = insightsTrendMetric;
                          const isRate = metric === "engagementRate";
                          const isMoney = metric === "revenue";

                          // Build chart data depending on mode
                          let chartData: any[] = [];
                          if (insightsTrendMode === "daily") {
                            chartData = sorted.map((r: any) => ({
                              date: String(r.date || "").slice(5), // MM-DD
                              value: isRate ? Number((Number(r[metric] || 0) * 100).toFixed(2)) : Number(r[metric] || 0),
                            }));
                          } else {
                            const windowDays = insightsTrendMode === "7d" ? 7 : 30;
                            for (let i = windowDays - 1; i < sorted.length; i++) {
                              const slice = sorted.slice(i - windowDays + 1, i + 1);
                              let val = 0;
                              if (isRate) {
                                const totalSessions = slice.reduce((s: number, r: any) => s + Number(r.sessions || 0), 0);
                                const totalEngaged = slice.reduce((s: number, r: any) => s + Number(r.engagedSessions || r.sessions * Number(r.engagementRate || 0) || 0), 0);
                                val = totalSessions > 0 ? (totalEngaged / totalSessions) * 100 : 0;
                              } else {
                                val = slice.reduce((s: number, r: any) => s + Number(r[metric] || 0), 0);
                              }
                              chartData.push({ date: String(sorted[i].date || "").slice(5), value: Number(val.toFixed(2)) });
                            }
                          }

                          const fmtValue = (v: any) => {
                            const n = Number(v || 0);
                            if (isMoney) return formatMoney(n);
                            if (isRate) return `${n.toFixed(2)}%`;
                            return formatNumber(n);
                          };

                          const trendMetricLabels: Record<string, string> = {
                            sessions: "Sessions", users: "Users", conversions: "Conversions",
                            revenue: "Revenue", pageviews: "Page Views", engagementRate: "Engagement Rate",
                          };

                          const deltaColor = (n: number) => n >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300";
                          const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                          const deltaPct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

                          return (
                            <>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickMargin={6} />
                                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => fmtValue(v)} />
                                    <Tooltip formatter={(value: any) => [fmtValue(value), trendMetricLabels[metric] || metric]} labelFormatter={(l) => `Date: ${l}`} />
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name={trendMetricLabels[metric] || metric} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Comparison table */}
                              {insightsTrendMode === "daily" ? (
                                <div className="overflow-hidden border rounded-md">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                      <tr>
                                        <th className="text-left p-3">Date</th>
                                        <th className="text-right p-3">{trendMetricLabels[metric] || metric}</th>
                                        <th className="text-right p-3">vs prior day</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const showCount = insightsDailyShowMore ? 14 : 7;
                                        const recentRows = sorted.slice(-showCount).reverse();
                                        return recentRows.map((r: any, idx: number) => {
                                          const curVal = isRate ? Number(r[metric] || 0) * 100 : Number(r[metric] || 0);
                                          const prevRow = sorted[sorted.indexOf(r) - 1];
                                          const prevVal = prevRow ? (isRate ? Number(prevRow[metric] || 0) * 100 : Number(prevRow[metric] || 0)) : 0;
                                          const delta = prevRow ? deltaPct(curVal, prevVal) : 0;
                                          return (
                                            <tr key={r.date || idx} className="border-b last:border-b-0">
                                              <td className="p-3 text-slate-900 dark:text-white">{r.date}</td>
                                              <td className="p-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">{fmtValue(curVal)}</td>
                                              <td className="p-3 text-right">
                                                {prevRow ? <span className={`text-xs ${deltaColor(delta)}`}>{fmtDelta(delta)}</span> : <span className="text-xs text-slate-400">—</span>}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                  {sorted.length > 7 && (
                                    <div className="px-3 py-2 border-t bg-slate-50 dark:bg-slate-800">
                                      <Button variant="ghost" size="sm" onClick={() => setInsightsDailyShowMore(!insightsDailyShowMore)}>
                                        {insightsDailyShowMore ? "Show less" : "View more"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="overflow-hidden border rounded-md">
                                  <table className="w-full text-sm table-fixed">
                                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                      <tr>
                                        <th className="text-left p-3 w-[30%]">Window</th>
                                        <th className="text-right p-3">Sessions</th>
                                        <th className="text-right p-3">Conversions</th>
                                        <th className="text-right p-3">CR</th>
                                        <th className="text-right p-3">Revenue</th>
                                        <th className="text-right p-3">PV/Session</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[
                                        { key: "7d", cur: insightsRollups.last7, d: insightsRollups.deltas, label: "Last 7d vs prior 7d", minDays: 14 },
                                        { key: "30d", cur: insightsRollups.last30, d: insightsRollups.deltas, label: "Last 30d vs prior 30d", minDays: 60 },
                                      ].filter(row => insightsTrendMode === row.key && Number(insightsRollups?.availableDays || 0) >= row.minDays)
                                       .map((row) => {
                                        const sd = row.key === "7d" ? row.d.sessions7 : row.d.sessions30;
                                        const cd = row.key === "7d" ? row.d.conversions7 : row.d.conversions30;
                                        const rd = row.key === "7d" ? row.d.revenue7 : row.d.revenue30;
                                        const crd = row.key === "7d" ? row.d.cr7 : row.d.cr30;
                                        const pvd = row.key === "7d" ? row.d.pvps7 : row.d.pvps30;
                                        return (
                                          <tr key={row.key} className="border-b">
                                            <td className="p-3">
                                              <div className="font-medium text-slate-900 dark:text-white">{row.label}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.cur.startDate} → {row.cur.endDate}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">{formatNumber(row.cur.sessions || 0)}</div>
                                              <div className={`text-xs ${deltaColor(sd)}`}>{fmtDelta(sd)}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">{formatNumber(row.cur.conversions || 0)}</div>
                                              <div className={`text-xs ${deltaColor(cd)}`}>{fmtDelta(cd)}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">{row.cur.cr.toFixed(2)}%</div>
                                              <div className={`text-xs ${deltaColor(crd)}`}>{fmtDelta(crd)}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">{formatMoney(Number(row.cur.revenue || 0))}</div>
                                              <div className={`text-xs ${deltaColor(rd)}`}>{fmtDelta(rd)}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">{row.cur.pvps.toFixed(2)}</div>
                                              <div className={`text-xs ${deltaColor(pvd)}`}>{fmtDelta(pvd)}</div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  {Number(insightsRollups?.availableDays || 0) < (insightsTrendMode === "7d" ? 14 : 60) && (
                                    <div className="p-3 text-sm text-slate-600 dark:text-slate-400">
                                      Need at least {insightsTrendMode === "7d" ? 14 : 60} days of history. Available: {Number(insightsRollups?.availableDays || 0)}.
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total insights</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">{insights.length}</p>
                            </div>
                            <BarChart3 className="w-7 h-7 text-slate-600" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High priority</p>
                              <p className="text-2xl font-bold text-red-600">
                                {insights.filter((i) => i.severity === "high").length}
                              </p>
                            </div>
                            <AlertTriangle className="w-7 h-7 text-red-600" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Needs attention</p>
                              <p className="text-2xl font-bold text-amber-600">
                                {insights.filter((i) => i.severity === "medium").length}
                              </p>
                            </div>
                            <TrendingDown className="w-7 h-7 text-amber-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-slate-200 dark:border-slate-700">
                      <CardHeader>
                        <CardTitle>What changed, what to do next</CardTitle>
                        <CardDescription>
                          We compare the last 7 days vs the previous 7 days (when enough daily history exists) and cross-check KPI/Benchmark performance.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {insights.length === 0 ? (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            No issues detected for the selected range. Create KPIs/Benchmarks to unlock more insights.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {insights.slice(0, 12).map((i) => {
                              const badgeClass =
                                i.severity === "high"
                                  ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900"
                                  : i.severity === "medium"
                                    ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900"
                                    : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                              const badgeText = i.severity === "high" ? "High" : i.severity === "medium" ? "Medium" : "Low";
                              return (
                                <div key={i.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-semibold text-slate-900 dark:text-white">{i.title}</div>
                                        <Badge className={`text-xs border ${badgeClass}`}>{badgeText}</Badge>
                                      </div>
                                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{i.description}</div>
                                      {i.recommendation ? (
                                        <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                                          <span className="font-medium">Next step:</span> {i.recommendation}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

              </Tabs>
            </>
          )}
        </main>
      </div>

      {/* Create KPI Dialog */}
      <Dialog open={showKPIDialog} onOpenChange={setShowKPIDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle>{editingKPI ? "Edit KPI" : "Create New KPI"}</DialogTitle>
            <DialogDescription>
              Set up a key performance indicator for Google Analytics.
            </DialogDescription>
          </DialogHeader>

          <Form {...kpiForm}>
            <form onSubmit={kpiForm.handleSubmit(onSubmitKPI)} className="space-y-6">
              {/* KPI Template Selection */}
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-medium text-slate-900 dark:text-white">Select KPI Template</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedKPITemplate(null);
                      kpiForm.reset({
                        ...kpiForm.getValues(),
                        name: "",
                        metric: "",
                        description: "",
                        unit: SELECT_UNIT as any,
                        currentValue: "",
                        targetValue: "",
                        priority: "medium",
                      });
                    }}
                  >
                    Reset
                  </Button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      name: "ROAS",
                      formula: "Revenue ÷ Spend × 100",
                      unit: "%",
                      description: "Revenue generated per dollar of spend (as a %)",
                    },
                    {
                      name: "ROI",
                      formula: "(Revenue − Spend) ÷ Spend × 100",
                      unit: "%",
                      description: "Return relative to spend (revenue-based ROI)",
                    },
                    {
                      name: "CPA",
                      formula: "Spend ÷ Conversions",
                      unit: "$",
                      description: "Average cost per conversion",
                    },
                    {
                      name: "Revenue",
                      formula: "Revenue to date",
                      unit: "$",
                      description: "Total revenue for this campaign (to date)",
                    },
                    {
                      name: "Total Conversions",
                      formula: "GA4 conversions total",
                      unit: "count",
                      description: "Total GA4 conversions for the selected period",
                    },
                    {
                      name: "Engagement Rate",
                      formula: "Engaged Sessions ÷ Sessions × 100",
                      unit: "%",
                      description: "Percent of sessions that were engaged (GA4 engagement rate)",
                    },
                    {
                      name: "Conversion Rate",
                      formula: "Conversions ÷ Sessions × 100",
                      unit: "%",
                      description: "Overall conversion rate for the selected period",
                    },
                    {
                      name: "Total Users",
                      formula: "GA4 total users",
                      unit: "count",
                      description: "Total users for the selected period",
                    },
                    {
                      name: "Create Custom KPI",
                      _isCustom: true,
                      formula: "",
                      unit: SELECT_UNIT,
                      description: "Build your own KPI (choose name, unit, and values)",
                    },
                    {
                      name: "Total Sessions",
                      formula: "GA4 sessions total",
                      unit: "count",
                      description: "Total sessions for the selected period",
                    }
                  ].map((template) => {
                    const isCustom = (template as any)?._isCustom === true;
                    const requiresSpend = template.name === "ROAS" || template.name === "ROI" || template.name === "CPA";
                    const requiresRevenue = template.name === "ROAS" || template.name === "ROI" || template.name === "Revenue";
                    const disabled =
                      (requiresSpend && !spendMetricAvailable) ||
                      (requiresRevenue && !revenueMetricAvailable);
                    return (
                      <div
                        key={template.name}
                        className={`p-3 border-2 rounded-lg transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          } ${!isCustom && selectedKPITemplate?.name === template.name
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                          }`}
                        onClick={() => {
                          if (disabled) return;
                          if (isCustom) {
                            setSelectedKPITemplate(null);
                            kpiForm.reset({
                              ...kpiForm.getValues(),
                              name: "",
                              metric: "",
                              description: "",
                              unit: SELECT_UNIT as any,
                              currentValue: "",
                              targetValue: "",
                              priority: "medium",
                            });
                            return;
                          }
                          const campaignCurrencyCode = String((campaign as any)?.currency || "USD");
                          const resolvedUnit = template.unit === "$" ? campaignCurrencyCode : template.unit;
                          setSelectedKPITemplate(template);
                          kpiForm.setValue("name", template.name);
                          kpiForm.setValue("metric", template.name);
                          kpiForm.setValue("unit", resolvedUnit);
                          kpiForm.setValue("description", template.description);
                          // Target is intentionally left blank for new KPIs (user must set it explicitly).
                          kpiForm.setValue("targetValue", "");
                          // Prefill current value from the same live sources as the GA4 Overview (no extra fetch).
                          const useLifetimeRevenue = template.name === "Revenue" || template.name === "ROAS" || template.name === "ROI";
                          // Only CPA needs conversions-to-date (because Spend is to-date). "Total Conversions" KPI matches the Overview conversions card (daily).
                          const useLifetimeConversions = template.name === "CPA";
                          const liveCurrent = calculateKPIValueFromSources(template.name, {
                            revenue: useLifetimeRevenue ? Number(financialRevenue || 0) : Number(breakdownTotals.revenue || 0),
                            conversions: useLifetimeConversions
                              ? Number(financialConversions || 0)
                              : Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0),
                            sessions: Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0),
                            users: Number(breakdownTotals.users || ga4Metrics?.users || 0),
                            engagementRate: dailySummedTotals.engagementRate || Number((ga4Metrics as any)?.engagementRate || 0),
                            spend: Number(financialSpend || 0),
                          });
                          kpiForm.setValue("currentValue", formatNumberByUnit(liveCurrent, resolvedUnit));
                        }}
                      >
                        <div className="font-medium text-sm text-slate-900 dark:text-white">
                          {template.name}
                        </div>
                        {isCustom && (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Choose name + unit, then set values
                          </div>
                        )}
                        {!isCustom && disabled && (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {requiresSpend && !spendMetricAvailable && requiresRevenue && !revenueMetricAvailable
                              ? "Spend + Revenue required (add both to unlock)"
                              : requiresSpend && !spendMetricAvailable
                                ? "Spend required (add spend to unlock)"
                                : requiresRevenue && !revenueMetricAvailable
                                  ? "Revenue required (add GA4 revenue metric or import revenue)"
                                  : "Unavailable"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={kpiForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KPI Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ROI, ROAS, CTR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={kpiForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_UNIT}>Select unit</SelectItem>
                          <SelectItem value="%">Percentage (%)</SelectItem>
                          <SelectItem value={String((campaign as any)?.currency || "USD")}>
                            Currency ({String((campaign as any)?.currency || "USD")})
                          </SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={kpiForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this KPI measures and why it's important"
                        value={field.value || ""}
                        maxLength={KPI_DESC_MAX}
                        onChange={(e) => field.onChange(String(e.target.value || "").slice(0, KPI_DESC_MAX))}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                      {(String(field.value || "")).length}/{KPI_DESC_MAX}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={kpiForm.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Current value"
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(formatNumberAsYouType(e.target.value, String(kpiForm.getValues().unit || "%")))
                          }
                          onBlur={(e) => field.onChange(formatNumberByUnit(e.target.value, String(kpiForm.getValues().unit || "%")))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={kpiForm.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Value *</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Target goal"
                          value={field.value || ""}
                          required
                          onChange={(e) =>
                            field.onChange(formatNumberAsYouType(e.target.value, String(kpiForm.getValues().unit || "%")))
                          }
                          onBlur={(e) => field.onChange(formatNumberByUnit(e.target.value, String(kpiForm.getValues().unit || "%")))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={kpiForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Medium" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="font-medium text-slate-900 dark:text-white">Alert Settings</h4>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-3">
                    <FormField
                      control={kpiForm.control}
                      name="alertsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Enable alerts for this KPI
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={kpiForm.control}
                      name="alertThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alert Threshold (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="80"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <p className="text-xs text-slate-500">Alert when performance falls below this % of target</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={kpiForm.control}
                      name="alertFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alert Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="immediate">Immediate</SelectItem>
                              <SelectItem value="daily">Daily summary</SelectItem>
                              <SelectItem value="weekly">Weekly summary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center space-x-6">
                    <FormField
                      control={kpiForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Email notifications
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={kpiForm.control}
                      name="slackNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Slack notifications
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowKPIDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createKPIMutation.isPending || updateKPIMutation.isPending}>
                  {editingKPI
                    ? (updateKPIMutation.isPending ? "Updating..." : "Update KPI")
                    : (createKPIMutation.isPending ? "Creating..." : "Create KPI")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete KPI Confirmation Dialog */}
      <AlertDialog open={deleteKPIId !== null} onOpenChange={() => setDeleteKPIId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Delete KPI</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this KPI? This action cannot be undone and will remove all associated progress tracking and alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteKPIId(null)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteKPI}
              disabled={deleteKPIMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteKPIMutation.isPending ? "Deleting..." : "Delete KPI"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GA4 Reports Modal */}
      <Dialog
        open={showGA4ReportModal}
        onOpenChange={(open) => {
          setShowGA4ReportModal(open);
          if (!open) setEditingGA4ReportId(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${ga4ReportModalStep === "standard"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
                  }`}
                onClick={() => {
                  setGa4ReportModalStep("standard");
                  setGa4ReportForm((p) => ({
                    ...p,
                    reportType: p.reportType === "custom" ? "overview" : p.reportType,
                    configuration: { sections: { overview: true, acquisition: false, trends: false, kpis: false, benchmarks: false } },
                  }));
                }}
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Templates</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pre-built professional report templates</p>
                  </div>
                </div>
              </div>

              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${ga4ReportModalStep === "custom"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
                  }`}
                onClick={() => {
                  setGa4ReportModalStep("custom");
                  setGa4ReportForm((p) => ({
                    ...p,
                    reportType: "custom",
                    configuration: p.configuration?.sections
                      ? p.configuration
                      : { sections: { overview: true, acquisition: true, trends: true, kpis: true, benchmarks: true } },
                  }));
                }}
              >
                <div className="flex items-start gap-3">
                  <Settings className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Report</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Build your own customized report</p>
                  </div>
                </div>
              </div>
            </div>

            {ga4ReportModalStep === "standard" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose Template</h3>
                  <div className="space-y-4">
                    {[
                      {
                        key: "overview",
                        title: "Overview",
                        desc: "Comprehensive overview of campaign performance metrics",
                        Icon: BarChart3,
                        chips: ["Overview", "Metrics", "Insights"],
                      },
                      {
                        key: "kpis",
                        title: "KPIs",
                        desc: "Key performance indicators and progress tracking",
                        Icon: Target,
                        chips: ["Metrics", "Targets", "Progress"],
                      },
                      {
                        key: "benchmarks",
                        title: "Benchmarks",
                        desc: "Performance benchmarks and comparisons",
                        Icon: TrendingUp,
                        chips: ["Current", "Benchmark", "Progress"],
                      },
                      {
                        key: "acquisition",
                        title: "Acquisition Breakdown",
                        desc: "Top channels/sources/mediums driving sessions, conversions, and revenue",
                        Icon: Users,
                        chips: ["Channel", "Source/Medium", "Revenue"],
                      },
                      {
                        key: "trends",
                        title: "Trends",
                        desc: "Time series trends for sessions, users, conversions, and revenue",
                        Icon: TrendingUp,
                        chips: ["Time", "Trend", "Totals"],
                      },
                    ].map((t) => {
                      const selected = ga4ReportForm.reportType === t.key;
                      return (
                        <div
                          key={t.key}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${selected ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"
                            }`}
                          onClick={() => {
                            const nextType = String(t.key);
                            setGa4ReportForm((p) => ({
                              ...p,
                              reportType: nextType,
                              configuration: {
                                sections: {
                                  overview: nextType === "overview",
                                  acquisition: nextType === "acquisition",
                                  trends: nextType === "trends",
                                  kpis: nextType === "kpis",
                                  benchmarks: nextType === "benchmarks",
                                },
                              },
                              name: p.name ? p.name : `GA4 ${t.title} Report`,
                            }));
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <t.Icon className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900 dark:text-white">{t.title}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t.desc}</p>
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {t.chips.map((c) => (
                                  <span key={c} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                                    {c}
                                  </span>
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Custom Report</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Choose which GA4 sections to include in your PDF.
                  </p>
                </div>

                <div className="border rounded-lg p-4 border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Sections</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { key: "overview", label: "Overview" },
                      { key: "acquisition", label: "Acquisition Breakdown" },
                      { key: "trends", label: "Trends" },
                      { key: "kpis", label: "KPIs Snapshot" },
                      { key: "benchmarks", label: "Benchmarks Snapshot" },
                    ].map((s) => {
                      const checked = !!ga4ReportForm.configuration?.sections?.[s.key];
                      return (
                        <label key={s.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = { ...(ga4ReportForm.configuration?.sections || {}) };
                              next[s.key] = e.target.checked;
                              setGa4ReportForm((p) => ({ ...p, configuration: { ...(p.configuration || {}), sections: next } }));
                            }}
                          />
                          {s.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Report Name *</div>
                  <Input
                    value={ga4ReportForm.name}
                    onChange={(e) => setGa4ReportForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Monthly GA4 Overview"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</div>
                  <Input
                    value={ga4ReportForm.description}
                    onChange={(e) => setGa4ReportForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description for your report library"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <Button variant="outline" onClick={() => setShowGA4ReportModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadGA4Report({
                      reportType: ga4ReportForm.reportType,
                      configuration: ga4ReportForm.configuration,
                      reportName: ga4ReportForm.name || "GA4 Report",
                    })
                  }
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  disabled={createGA4ReportMutation.isPending || updateGA4ReportMutation.isPending}
                  onClick={() => {
                    const payload = buildGA4ReportPayload();
                    if (!String(payload.name || "").trim()) {
                      toast({ title: "Report name is required", variant: "destructive" });
                      return;
                    }
                    if (editingGA4ReportId) {
                      updateGA4ReportMutation.mutate({ reportId: editingGA4ReportId, payload });
                      return;
                    }
                    createGA4ReportMutation.mutate(payload);
                  }}
                >
                  {editingGA4ReportId
                    ? updateGA4ReportMutation.isPending
                      ? "Updating..."
                      : "Update Report"
                    : createGA4ReportMutation.isPending
                      ? "Saving..."
                      : "Save Report"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GA4 Campaign Picker (multi-select) */}
      <Dialog
        open={showGa4CampaignPicker}
        onOpenChange={(open) => {
          setShowGa4CampaignPicker(open);
          if (!open) setGa4CampaignSearch("");
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle>Select GA4 campaigns to import</DialogTitle>
            <DialogDescription>
              Choose one or more GA4 campaign values to scope this MetricMind campaign. If you select none, we’ll track all campaigns in the selected property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ga4-campaign-search">Search</Label>
              <Input
                id="ga4-campaign-search"
                value={ga4CampaignSearch}
                onChange={(e) => setGa4CampaignSearch(e.target.value)}
                placeholder="Search campaign names…"
              />
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 max-h-[45vh] overflow-y-auto">
              {Array.isArray(ga4CampaignValuesResp?.campaigns) && ga4CampaignValuesResp.campaigns.length > 0 ? (
                <div className="space-y-2">
                  {ga4CampaignValuesResp.campaigns
                    .filter((c: any) => {
                      const name = String(c?.name || "");
                      const q = String(ga4CampaignSearch || "").trim().toLowerCase();
                      if (!q) return true;
                      return name.toLowerCase().includes(q);
                    })
                    .map((c: any) => {
                      const name = String(c?.name || "").trim();
                      if (!name) return null;
                      const checked = selectedGa4Campaigns.includes(name);
                      return (
                        <label key={name} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedGa4Campaigns((prev) => {
                                  if (prev.includes(name)) return prev.filter((x) => x !== name);
                                  return [...prev, name];
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">Users: {Number(c?.users || 0).toLocaleString()}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  No campaigns found. This can happen if GA4 reporting is delayed or the selected range has no campaign-tagged traffic.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedGa4Campaigns([])}
                type="button"
              >
                Track all campaigns
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowGa4CampaignPicker(false)} type="button">
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const payload =
                        selectedGa4Campaigns.length > 0 ? JSON.stringify(selectedGa4Campaigns) : null;
                      const resp = await fetch(`/api/campaigns/${campaignId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ga4CampaignFilter: payload }),
                      });
                      const json = await resp.json().catch(() => null);
                      if (!resp.ok) throw new Error(json?.message || "Failed to save GA4 campaign selection");

                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-diagnostics"], exact: false });
                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-breakdown"], exact: false });
                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-timeseries"], exact: false });
                      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-metrics"], exact: false });

                      setShowGa4CampaignPicker(false);
                    } catch (e: any) {
                      toast({
                        title: "Failed to save campaigns",
                        description: e?.message || "Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  type="button"
                  disabled={!campaignId}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Report Confirmation */}
      <AlertDialog open={deleteGA4ReportId !== null} onOpenChange={() => setDeleteGA4ReportId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Delete Report</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteGA4ReportId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteGA4ReportId) return;
                deleteGA4ReportMutation.mutate(deleteGA4ReportId);
                setDeleteGA4ReportId(null);
              }}
              disabled={deleteGA4ReportMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

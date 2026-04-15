import { useQuery, useMutation, useQueryClient, keepPreviousData, useQueries } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target, Plus, X, Trash2, Edit, Pencil, MoreVertical, TrendingDown, DollarSign, BadgeCheck, AlertTriangle, AlertCircle, CheckCircle2, Download, FileText, Settings, RefreshCw, Loader2, Activity, Info, Trophy } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { computeCpa, computeConversionRatePercent, computeProgress, computeRoiPercent, computeRoasPercent, normalizeRateToPercent, formatPct } from "@shared/metric-math";
import { isLowerIsBetterKpi, computeEffectiveDeltaPct, classifyKpiBand, computeAttainmentPct, computeAttainmentFillPct } from "@shared/kpi-math";

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
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  targetDate: z.string().optional(),
  alertsEnabled: z.boolean().default(false),
  alertThreshold: z.string().optional(),
  alertCondition: z.enum(["below", "above", "equals"]).default("below"),
  alertFrequency: z.enum(["immediate", "daily", "weekly"]).default("daily"),
  emailNotifications: z.boolean().default(false),
  emailRecipients: z.string().optional(),
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

// --- Insights engine thresholds (extracted for readability and future tuning) ---
// Anomaly detection: negative WoW deltas (drop thresholds)
const ANOMALY_CR_DROP_PCT = -15;
const ANOMALY_ENGAGEMENT_DROP_PCT = -20;
const ANOMALY_SESSIONS_DROP_PCT = -20;
const ANOMALY_REVENUE_DROP_PCT = -25;
const ANOMALY_CONVERSIONS_DROP_PCT = -20;
// Short-window (3d vs 3d) thresholds — higher to reduce false positives from smaller samples
const ANOMALY_SHORT_CR_DROP_PCT = -25;
const ANOMALY_SHORT_ENGAGEMENT_DROP_PCT = -30;
const ANOMALY_SHORT_SESSIONS_DROP_PCT = -30;
const ANOMALY_SHORT_REVENUE_DROP_PCT = -35;
const ANOMALY_SHORT_CONVERSIONS_DROP_PCT = -30;
// Positive signal thresholds
const POSITIVE_SESSIONS_UP_PCT = 15;
const POSITIVE_SESSIONS_MIN_PRIOR = 50;
const POSITIVE_REVENUE_UP_PCT = 20;
const POSITIVE_CONVERSIONS_UP_PCT = 15;
const POSITIVE_CONVERSIONS_MIN_PRIOR = 5;
const POSITIVE_ROAS_STRONG = 3;
const POSITIVE_KPI_EXCEEDS_PCT = 110;
// KPI underperformance bands
const KPI_BEHIND_PCT = 70;
const KPI_NEEDS_ATTENTION_PCT = 90;
// Minimum daily history for anomaly detection
const INSIGHTS_MIN_HISTORY_DAYS = 14;
const INSIGHTS_SHORT_WINDOW_DAYS = 6;
// Canonical metric sets for exact matching (avoids false positives from loose .includes())
const CONVERSION_METRICS = new Set(["conversionrate", "conversion rate", "total conversions", "conversions"]);
const REVENUE_METRICS = new Set(["revenue"]);
const TRAFFIC_METRICS = new Set(["sessions", "total sessions", "users", "total users"]);
const CPA_METRICS = new Set(["cpa"]);
const ENGAGEMENT_METRICS = new Set(["engagementrate", "engagement rate"]);

export default function GA4Metrics() {
  const [, params] = useRoute("/campaigns/:id/ga4-metrics");
  const campaignId = params?.id;

  // Scroll to top on mount (smooth transition from campaign detail)
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // GA4 UI now operates on strict daily values (persisted server-side).
  // We keep an internal lookback window for charts/supporting reports, but there is no user-selectable date range.
  // Need at least 60 days to compute "last 30 vs prior 30" and 14 days for WoW anomaly detection.
  // Use 90 to be safe (and to keep mock simulation consistent with existing mock logic).
  // dateRange MUST match the daily lookback so Summary totals equal the sum of daily rows.
  // GA4_DAILY_LOOKBACK_DAYS is computed after allGA4Connections query loads (see below)
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
  // showDeleteSpendDialog removed — dead code, was never triggered
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [editingRevenueSource, setEditingRevenueSource] = useState<any>(null);
  const [deletingRevenueSourceId, setDeletingRevenueSourceId] = useState<string | null>(null);
  const [editingSpendSource, setEditingSpendSource] = useState<any>(null);
  const [deletingSpendSourceId, setDeletingSpendSourceId] = useState<string | null>(null);
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
  const [insightsTrendMode, setInsightsTrendMode] = useState<"daily" | "7d" | "30d" | "monthly">("daily");
  const [insightsTrendMetric, setInsightsTrendMetric] = useState<string>("sessions");
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);
  const [ga4ReportForm, setGa4ReportForm] = useState({
    name: "",
    description: "",
    reportType: "",
    configuration: {
      sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false },
    } as any,
    scheduleEnabled: false,
    scheduleFrequency: "daily",
    scheduleDayOfWeek: "monday",
    scheduleDayOfMonth: "first",
    quarterTiming: "end",
    scheduleTime: "9:00 AM",
    emailRecipients: "",
    status: "active" as const,
  });
  const [ga4ReportFormErrors, setGa4ReportFormErrors] = useState<{ emailRecipients?: string }>({});
  // Timezone helpers for report scheduling
  const [userTimeZone, setUserTimeZone] = useState('');
  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimeZone(detectedTimeZone);
  }, []);
  const getTimeZoneDisplay = () => {
    if (!userTimeZone) return '';
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'short' });
      const parts = formatter.formatToParts(now);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || userTimeZone;
    } catch { return userTimeZone; }
  };
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  };
  const dayOfWeekKeyToInt = (v: any): number | null => {
    const key = String(v || '').trim().toLowerCase();
    const map: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return typeof map[key] === 'number' ? map[key] : null;
  };
  const dayOfWeekIntToKey = (v: any): string => {
    const n = Number(v);
    const map: Record<number, string> = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
    return map[n] || 'monday';
  };
  const dayOfMonthToInt = (v: any): number | null => {
    const raw = String(v || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'last') return 0;
    if (raw === 'first') return 1;
    if (raw === 'mid') return 15;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(31, n));
  };
  const to24HourHHMM = (v: any): string => {
    const s = String(v || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) {
      const m2 = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m2) return `${String(parseInt(m2[1], 10)).padStart(2, '0')}:${m2[2]}`;
      return '09:00';
    }
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = String(m[3] || '').toUpperCase();
    if (ampm === 'AM') { if (hh === 12) hh = 0; } else { if (hh !== 12) hh += 12; }
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };
  const from24HourTo12Hour = (v: any): string => {
    const s = String(v || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '9:00 AM';
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = hh >= 12 ? 'PM' : 'AM';
    if (hh === 0) hh = 12;
    if (hh > 12) hh -= 12;
    return `${hh}:${mm} ${ampm}`;
  };
  const validateGA4ScheduledReportFields = (): boolean => {
    if (!ga4ReportForm.scheduleEnabled) { setGa4ReportFormErrors({}); return true; }
    setGa4ReportFormErrors({});
    return true;
  };

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
    source: "",
    alertsEnabled: false,
    alertThreshold: "",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
    emailRecipients: "",
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
      targetDate: "",
      alertsEnabled: false,
      alertThreshold: "",
      alertCondition: "below",
      alertFrequency: "daily",
      emailNotifications: false,
      emailRecipients: "",
    },
  });
  const getEmptyKpiFormValues = (): KPIFormData => ({
    name: "",
    metric: "",
    description: "",
    unit: "%",
    currentValue: "",
    targetValue: "",
    priority: "medium",
    targetDate: "",
    alertsEnabled: false,
    alertThreshold: "",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
    emailRecipients: "",
  });

  const stripNumberFormatting = (s: string) => String(s || "").replace(/,/g, "").trim();

  const isIsoCurrencyCode = (unit: string) => /^[A-Z]{3}$/.test(String(unit || "").trim());

  const formatNumberByUnit = (raw: string, unit: string) => {
    const cleaned = stripNumberFormatting(raw);
    if (!cleaned) return "";
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return raw;
    if (unit === "count") return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (unit === "%" || unit === "ratio") {
      // Smart formatting: whole numbers when possible, 1 decimal when needed
      const rounded = Math.round(n * 10) / 10;
      if (rounded === Math.floor(rounded)) return Math.round(rounded).toLocaleString();
      return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    // Currency and other units: always 2 decimals
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    kpiForm.reset(getEmptyKpiFormValues());
    setShowKPIDialog(true);
  };

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
          // ROAS as ratio (e.g., 48.91) to match Overview display
          return spend > 0 ? (revenue / spend).toFixed(2) : "0.00";
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
        credentials: "include",
        body: JSON.stringify({
          ...data,
          campaignId, // Scope KPI to this MimoSaaS campaign
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
        credentials: "include",
        body: JSON.stringify({
          ...payload.data,
          campaignId,
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
        credentials: "include",
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
        credentials: "include",
        body: JSON.stringify({ propertyId: selectedGA4PropertyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Mock refresh failed");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // Force refetch all GA4 + financial queries so the UI picks up the new data immediately
      const prefix = `/api/campaigns/${campaignId}`;
      // Refetch ALL active queries for this campaign — covers all query key formats
      // (some use ["/api/campaigns", id, "ga4-daily", ...] and others use ["/api/campaigns/id/ga4-daily"])
      await queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.some((k) => typeof k === "string" && k.includes(campaignId));
        },
        type: "active",
      });
      // Also invalidate campaign-level queries
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      // Refresh the bell / notifications center immediately so alert notifications created during
      // mock refresh are visible without waiting for the navigation poll interval.
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
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
        credentials: "include",
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
        credentials: "include",
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
      const resp = await fetch(`/api/platforms/google_analytics/reports/${encodeURIComponent(reportId)}`, { method: "DELETE", credentials: "include" });
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
      alertThreshold: data.alertThreshold ? stripNumberFormatting(String(data.alertThreshold)) : data.alertThreshold,
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
        credentials: "include",
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
        credentials: "include",
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
      const response = await fetch(`/api/platforms/google_analytics/benchmarks/${benchmarkId}`, {
        method: "DELETE",
        credentials: "include",
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
      alertThreshold: newBenchmark.alertsEnabled ? stripNumberFormatting(String(newBenchmark.alertThreshold || "")) : null,
      alertCondition: newBenchmark.alertCondition || "below",
      alertsEnabled: newBenchmark.alertsEnabled || false,
      alertFrequency: newBenchmark.alertFrequency || "daily",
      emailNotifications: newBenchmark.emailNotifications || false,
      emailRecipients: newBenchmark.emailRecipients || "",
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
    if (!cleanedBenchmark.unit || !String(cleanedBenchmark.unit).trim() || String(cleanedBenchmark.unit) === SELECT_UNIT) {
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
    const liveCurrentValue =
      metric && metric !== "__custom__"
        ? String(getLiveBenchmarkCurrentValue(metric))
        : String(benchmark.currentValue ?? "");
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
      currentValue: formatNumberByUnit(liveCurrentValue, String(benchmark.unit || "%")),
      metric: metric,
      industry: benchmark.industry || "",
      geoLocation: benchmark.geoLocation || "",
      description: benchmark.description || "",
      source: benchmark.source || "",
      alertsEnabled: (benchmark as any).alertsEnabled || false,
      alertThreshold: (benchmark as any).alertThreshold
        ? formatNumberByUnit(String((benchmark as any).alertThreshold), String(benchmark.unit || "%"))
        : "",
      alertCondition: (benchmark as any).alertCondition || "below",
      alertFrequency: (benchmark as any).alertFrequency || "daily",
      emailNotifications: (benchmark as any).emailNotifications || false,
      emailRecipients: (benchmark as any).emailRecipients || "",
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
      const liveCurrentValue =
        metric && metric !== "__custom__"
          ? String(getLiveBenchmarkCurrentValue(metric))
          : String((editingBenchmark as any).currentValue ?? "");
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
        currentValue: formatNumberByUnit(liveCurrentValue, String((editingBenchmark as any).unit || "%")),
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
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: campaignCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const formatValue = (value: string, unit: string) => {
    const numValue = parseFloat(value);
    switch (unit) {
      case "%":
        return formatPct(numValue);
      case "$": {
        // Legacy stored KPIs may use "$" as the unit; render using the campaign's configured currency.
        return formatMoney(numValue);
      }
      case "ratio":
        return `${numValue.toFixed(2)}x`;
      default:
        if (isIsoCurrencyCode(unit)) {
          try {
            return new Intl.NumberFormat("en-US", { style: "currency", currency: unit, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
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
    if (n.includes("session")) return { Icon: Clock, color: "text-muted-foreground" };
    if (n.includes("user")) return { Icon: Users, color: "text-muted-foreground" };
    return { Icon: BarChart3, color: "text-muted-foreground" };
  };

  // Helper function for benchmark values
  const formatBenchmarkValue = (value: string | undefined, unit: string) => {
    if (!value) return "N/A";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "N/A";

    switch (unit) {
      case "%":
        return formatPct(numValue);
      case "$": {
        // Legacy stored Benchmarks may use "$" as the unit; render using the campaign's configured currency.
        return formatMoney(numValue);
      }
      case "ratio":
        return `${numValue.toFixed(2)}x`;
      case "seconds":
        return `${numValue.toFixed(1)}s`;
      case "count":
        return numValue.toLocaleString();
      default:
        if (isIsoCurrencyCode(unit)) {
          try {
            return new Intl.NumberFormat("en-US", { style: "currency", currency: unit, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
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

  // Read lookbackDays from the active GA4 connection (default 90 for backward compatibility)
  const GA4_DAILY_LOOKBACK_DAYS = (() => {
    const conns = ga4PropsFromAll.length > 0 ? ga4PropsFromAll : ga4PropsFromCheck;
    const active = conns.find((c: any) => String(c.propertyId) === String(selectedGA4PropertyId)) || conns[0];
    return Number((active as any)?.lookbackDays) || 90;
  })();

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
        // ROAS as ratio (e.g., 48.91) to match Overview display
        return Number(financialROAS || 0);
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
  // EXCEPTION: Users are non-additive across dates — summing daily rows overcounts.
  // Prefer the deduplicated ga4-to-date count; only fall back to daily sum when unavailable.
  const breakdownTotals = {
    date: ga4ReportDate,
    sessions: Math.max(Number((ga4ToDateResp as any)?.totals?.sessions || 0), dailySummedTotals.sessions),
    conversions: Math.max(Number((ga4ToDateResp as any)?.totals?.conversions || 0), dailySummedTotals.conversions),
    revenue: Math.max(Number((ga4ToDateResp as any)?.totals?.revenue || 0), dailySummedTotals.revenue),
    users: Number((ga4ToDateResp as any)?.totals?.users || 0) || dailySummedTotals.users,
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

  const { data: hubspotPipelineProxyData } = useQuery<any>({
    queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"],
    enabled: !!campaignId,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const resp = await fetch(`/api/hubspot/${encodeURIComponent(String(campaignId))}/pipeline-proxy`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: salesforcePipelineProxyData } = useQuery<any>({
    queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"],
    enabled: !!campaignId,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const resp = await fetch(`/api/salesforce/${encodeURIComponent(String(campaignId))}/pipeline-proxy`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
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

  // Breakdown queries for inline source-level display
  const { data: revenueBreakdownResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-breakdown`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue-breakdown`);
      if (!resp.ok) return { success: false, totalRevenue: 0, sources: [] };
      return resp.json().catch(() => ({ success: false, totalRevenue: 0, sources: [] }));
    },
  });

  const { data: spendBreakdownResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/spend-breakdown`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/spend-breakdown`);
      if (!resp.ok) return { success: false, totalSpend: 0, sources: [] };
      return resp.json().catch(() => ({ success: false, totalSpend: 0, sources: [] }));
    },
  });

  // Latest Day Spend should use the previous complete day across all spend sources.
  const spendDailyYesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { data: spendDailyYesterdayResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/spend-daily`, spendDailyYesterday],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/spend-daily?date=${spendDailyYesterday}`);
      if (!resp.ok) return { success: false, totalSpend: 0 };
      return resp.json().catch(() => ({ success: false, totalSpend: 0 }));
    },
  });
  const spendDailyResp = spendDailyYesterdayResp;

  // Latest Day Revenue should use the previous complete day across GA4 native + imported revenue sources.
  const revenueDailyDate = spendDailyYesterday;
  const { data: revenueDailyResp } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-daily`, revenueDailyDate],
    enabled: !!campaignId,
    staleTime: 0,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue-daily?date=${revenueDailyDate}`, { credentials: "include" });
      if (!resp.ok) return { success: false, totalRevenue: 0 };
      return resp.json().catch(() => ({ success: false, totalRevenue: 0 }));
    },
  });
  const ga4LatestDayRevenue = useMemo(() => {
    return Number(ga4DailyRows.find((r: any) => String(r?.date) === String(revenueDailyDate))?.revenue || 0);
  }, [ga4DailyRows, revenueDailyDate]);

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

  // Friendly labels for spend source types
  const spendSourceTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      google_sheets: "Google Sheets", csv: "CSV", manual: "Manual",
      linkedin_api: "LinkedIn Ads", meta_api: "Meta Ads", google_ads_api: "Google Ads",
      ad_platforms: "Ad Platform",
    };
    return map[type] || type;
  };

  const revenueSourceTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      manual: "Manual", csv: "CSV", google_sheets: "Google Sheets",
      hubspot: "HubSpot", salesforce: "Salesforce", shopify: "Shopify",
      ga4: "GA4 Revenue", custom: "Custom",
    };
    return map[type] || type || "Revenue";
  };

  // Merged spend sources for micro copy display: prefer breakdown (has amounts), fallback to source definitions
  const spendDisplaySources = useMemo(() => {
    const defs = Array.isArray(spendSourcesResp?.sources) ? spendSourcesResp.sources : Array.isArray(spendSourcesResp) ? spendSourcesResp : [];
    const defsMap = new Map<string, any>();
    for (const d of defs) if (d) defsMap.set(String(d.id), d);

    const breakdownSources = Array.isArray(spendBreakdownResp?.sources) ? spendBreakdownResp.sources : [];
    if (breakdownSources.length > 0) {
      return breakdownSources.map((s: any) => ({
        ...s,
        mappingConfig: defsMap.get(String(s.sourceId))?.mappingConfig || null,
      }));
    }
    // Fallback: use spend source definitions when no spend_records exist (e.g., no date column mapped)
    return defs.filter((s: any) => s && s.isActive !== false).map((s: any) => ({
      sourceId: String(s.id),
      displayName: String(s.displayName || s.sourceType || 'Unknown'),
      sourceType: String(s.sourceType || 'unknown'),
      spend: null, // amount unknown — will show total spend instead
      mappingConfig: s.mappingConfig || null,
    }));
  }, [spendBreakdownResp, spendSourcesResp]);
  const activeRevenueSource = useMemo(() => {
    const sources = Array.isArray(revenueSourcesResp?.sources) ? revenueSourcesResp.sources : Array.isArray(revenueSourcesResp) ? revenueSourcesResp : [];
    return sources?.[0] || null;
  }, [revenueSourcesResp]);

  // Revenue display sources — merges breakdown (per-source amounts) with source definitions (fallback)
  const revenueDisplaySources = useMemo(() => {
    const defs = Array.isArray(revenueSourcesResp?.sources) ? revenueSourcesResp.sources : Array.isArray(revenueSourcesResp) ? revenueSourcesResp : [];
    const defsMap = new Map<string, any>();
    for (const d of defs) if (d) defsMap.set(String(d.id), d);
    const defsByType = new Map<string, any>();
    const defsWithCampaignTotalsByType = new Map<string, any>();
    for (const d of defs) {
      const type = String(d?.sourceType || "").toLowerCase();
      if (!type) continue;
      defsByType.set(type, defsByType.has(type) ? null : d);
      const cfg = typeof d?.mappingConfig === "string"
        ? (() => { try { return JSON.parse(d.mappingConfig); } catch { return null; } })()
        : d?.mappingConfig;
      if (Array.isArray(cfg?.campaignValueRevenueTotals) && cfg.campaignValueRevenueTotals.length > 0) {
        defsWithCampaignTotalsByType.set(type, d);
      }
    }

    const breakdownSources = Array.isArray((revenueBreakdownResp as any)?.sources) ? (revenueBreakdownResp as any).sources : [];
    if (breakdownSources.length > 0) {
      return breakdownSources.map((s: any) => ({
        ...s,
        mappingConfig: defsMap.get(String(s.sourceId))?.mappingConfig
          || defsWithCampaignTotalsByType.get(String(s.sourceType || "").toLowerCase())?.mappingConfig
          || defsByType.get(String(s.sourceType || "").toLowerCase())?.mappingConfig
          || null,
      }));
    }
    return defs.filter((d: any) => d?.isActive !== false).map((d: any) => ({
      sourceId: d.id,
      sourceType: d.sourceType,
      displayName: d.displayName,
      revenue: null,
      mappingConfig: d.mappingConfig,
    }));
  }, [revenueSourcesResp, revenueBreakdownResp]);
  const pipelineProxyData = useMemo(() => {
    const sourceDefs = Array.isArray(revenueSourcesResp?.sources) ? revenueSourcesResp.sources : Array.isArray(revenueSourcesResp) ? revenueSourcesResp : [];
    const scopedCampaignValues = Array.isArray(selectedGa4CampaignFilterList)
      ? selectedGa4CampaignFilterList.map((v: any) => String(v || "").trim()).filter(Boolean)
      : [];
    const normalizeValue = (value: any) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const scopedCampaignSet = new Set(scopedCampaignValues.map(normalizeValue).filter(Boolean));
    const parseMappingConfig = (source: any) => typeof source?.mappingConfig === "string"
      ? (() => { try { return JSON.parse(source.mappingConfig); } catch { return {}; } })()
      : (source?.mappingConfig || {});
    const hasPipelineConfig = (source: any) => {
      const cfg = parseMappingConfig(source);
      return cfg?.pipelineEnabled === true && !!(cfg.pipelineStageLabel || cfg.pipelineStageName || cfg.pipelineStageId);
    };
    const getSourceScopeValues = (source: any) => {
      const cfg = parseMappingConfig(source);
      const selected = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v: any) => String(v || "").trim()).filter(Boolean) : [];
      const totals = Array.isArray(cfg.pipelineValueRevenueTotals) ? cfg.pipelineValueRevenueTotals : [];
      const totalValues = totals.map((item: any) => String(item?.campaignValue || "").trim()).filter(Boolean);
      return Array.from(new Set([...selected, ...totalValues]));
    };
    const sourceMatchesGa4Scope = (source: any) => {
      if (scopedCampaignSet.size === 0) return true;
      return getSourceScopeValues(source).some((value) => scopedCampaignSet.has(normalizeValue(value)));
    };
    const normalizeTotal = (data: any) => {
      if (!data?.success) return data;
      const dataTotals = Array.isArray(data.pipelineValueRevenueTotals) ? data.pipelineValueRevenueTotals : [];
      const totalsSum = dataTotals.reduce((sum: number, item: any) => sum + Number(item?.revenue || 0), 0);
      return { ...data, totalToDate: Number(data.totalToDate || 0) || totalsSum, pipelineValueRevenueTotals: dataTotals };
    };
    const getPipelineSourceData = (sourceType: "salesforce" | "hubspot", endpointData: any, label: string) => {
      const eligible = [...sourceDefs, ...(Array.isArray(revenueDisplaySources) ? revenueDisplaySources : [])].filter((s: any) => {
        const type = String(s?.sourceType || "").toLowerCase();
        return s?.isActive !== false && type === sourceType && hasPipelineConfig(s);
      });
      const crmSource = eligible.find(sourceMatchesGa4Scope) || eligible[0] || null;
      if (!crmSource) return null;
      const crmCfg = parseMappingConfig(crmSource);
      const selectedValues = Array.isArray(crmCfg.selectedValues) ? crmCfg.selectedValues.map((v: any) => String(v)).filter(Boolean) : [];
      const pipelineStageLabel = crmCfg.pipelineStageLabel || crmCfg.pipelineStageName || crmCfg.pipelineStageId || null;
      const pipelineValueRevenueTotals = Array.isArray(crmCfg.pipelineValueRevenueTotals) ? crmCfg.pipelineValueRevenueTotals : [];
      const fallback = crmCfg.pipelineEnabled && pipelineStageLabel ? {
        success: true,
        totalToDate: Number(crmCfg.pipelineTotalToDate || 0),
        pipelineStageLabel,
        pipelineValueRevenueTotals,
        providerLabel: label,
        selectedValues: pipelineValueRevenueTotals.length > 0 ? selectedValues : [],
      } : null;
      if (endpointData?.success) {
        const normalized = normalizeTotal(endpointData);
        return {
          ...fallback,
          ...normalized,
          totalToDate: Number(normalized?.totalToDate || 0) || Number(fallback?.totalToDate || 0),
          pipelineValueRevenueTotals: Array.isArray(normalized?.pipelineValueRevenueTotals) && normalized.pipelineValueRevenueTotals.length > 0
            ? normalized.pipelineValueRevenueTotals
            : fallback?.pipelineValueRevenueTotals || [],
          providerLabel: label,
          selectedValues: (Array.isArray(normalized?.pipelineValueRevenueTotals) && normalized.pipelineValueRevenueTotals.length > 0) ? selectedValues : (fallback?.selectedValues || []),
        };
      }
      return fallback;
    };
    const entries = [
      getPipelineSourceData("salesforce", salesforcePipelineProxyData, "Salesforce"),
      getPipelineSourceData("hubspot", hubspotPipelineProxyData, "HubSpot"),
    ].filter((entry: any) => entry?.success);
    if (entries.length === 0) return null;
    const totalsByCampaign = new Map<string, number>();
    for (const entry of entries) {
      for (const item of Array.isArray(entry.pipelineValueRevenueTotals) ? entry.pipelineValueRevenueTotals : []) {
        const campaignValue = String(item?.campaignValue || "").trim();
        if (!campaignValue) continue;
        totalsByCampaign.set(campaignValue, (totalsByCampaign.get(campaignValue) || 0) + Number(item?.revenue || 0));
      }
    }
    return {
      success: true,
      totalToDate: entries.reduce((sum: number, entry: any) => sum + Number(entry?.totalToDate || 0), 0),
      providerLabel: entries.map((entry: any) => entry.providerLabel).filter(Boolean).join(" + "),
      pipelineStageLabel: Array.from(new Set(entries.map((entry: any) => String(entry?.pipelineStageLabel || "").trim()).filter(Boolean))).join(" + "),
      pipelineValueRevenueTotals: Array.from(totalsByCampaign.entries()).map(([campaignValue, revenue]) => ({ campaignValue, revenue })),
      selectedValues: Array.from(new Set(entries.flatMap((entry: any) => Array.isArray(entry.selectedValues) ? entry.selectedValues : []))),
      providerEntries: entries.map((entry: any) => ({
        providerLabel: entry.providerLabel,
        pipelineStageLabel: entry.pipelineStageLabel,
        campaignValues: Array.isArray(entry.pipelineValueRevenueTotals) && entry.pipelineValueRevenueTotals.length > 0
          ? entry.pipelineValueRevenueTotals.map((item: any) => String(item?.campaignValue || "").trim()).filter(Boolean)
          : Array.isArray(entry.selectedValues) ? entry.selectedValues.map((value: any) => String(value || "").trim()).filter(Boolean) : [],
      })),
    };
  }, [hubspotPipelineProxyData, revenueDisplaySources, revenueSourcesResp, salesforcePipelineProxyData, selectedGa4CampaignFilterList]);
  // Availability flags for UI gating (KPI/Benchmark templates):
  // - Spend is "available" if a spend source exists (even if value is 0).
  // - Revenue is "available" if GA4 has a revenue metric configured OR an imported revenue source exists.
  const spendMetricAvailable = useMemo(() => {
    const ids = Array.isArray(spendToDateResp?.sourceIds) ? spendToDateResp.sourceIds : [];
    return !!activeSpendSource || ids.length > 0;
  }, [activeSpendSource, spendToDateResp?.sourceIds]);
  const revenueMetricAvailable = useMemo(() => {
    const ga4RevenueMetric = String((ga4ToDateResp as any)?.totals?.revenueMetric || "").trim();
    const ga4RevenueValue = Number((ga4ToDateResp as any)?.totals?.revenue || 0);
    // Revenue metric is only "available" if there's an actual revenue source with data,
    // OR GA4 reports a revenue metric AND has non-zero revenue. A simulation returning
    // revenueMetric="totalRevenue" with revenue=0 should NOT enable revenue-dependent KPIs.
    return !!activeRevenueSource || (!!ga4RevenueMetric && ga4RevenueValue > 0) || breakdownTotals.revenue > 0;
  }, [activeRevenueSource, ga4ToDateResp, breakdownTotals.revenue]);

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
  // Prefer spend-breakdown total (sums actual spend_records) over spend-to-date (reads campaign.spend column which may be stale/zero).
  // If no spend sources exist at all, force to 0 — the campaign.spend column may be stale after source deletion.
  const hasSpendSources = spendDisplaySources.length > 0;
  const totalSpendForFinancials = hasSpendSources ? Number(spendBreakdownResp?.totalSpend || spendToDateResp?.spendToDate || 0) : 0;
  const usingAutoLinkedInSpend = false;

  const importedRevenueForFinancials = Number((importedRevenueToDateResp as any)?.totalRevenue || 0);
  const ga4RevenueFromToDate = Number((ga4ToDateResp as any)?.totals?.revenue || 0);
  const ga4RevenueMetricName = String((ga4ToDateResp as any)?.revenueMetric || "").trim();
  const ga4HasRevenueMetric = !!ga4RevenueMetricName || dailySummedTotals.revenue > 0;
  // Use the higher of (to-date total, summed daily rows) so Total Revenue is never less than Latest Day Revenue.
  const ga4RevenueForFinancials = Math.max(ga4RevenueFromToDate, dailySummedTotals.revenue);
  // GA4 page: Total Revenue = GA4 native revenue + any imported revenue (manual, CSV, Sheets, CRM).
  // This matches what executives expect: the full revenue picture for this campaign.
  const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;
  const revenueSourceLabels = useMemo(() => {
    const labels: string[] = [];
    if (ga4HasRevenueMetric) labels.push("GA4 native revenue");
    for (const s of Array.isArray(revenueDisplaySources) ? revenueDisplaySources : []) {
      const label = String((s as any)?.displayName || revenueSourceTypeLabel(String((s as any)?.sourceType || ""))).trim();
      if (label && !labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [ga4HasRevenueMetric, revenueDisplaySources]);
  const financialConversions = Math.max(Number((ga4ToDateResp as any)?.totals?.conversions || 0), dailySummedTotals.conversions);
  const financialSpend = Number(totalSpendForFinancials || 0);
  const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;
  const financialROI = computeRoiPercent(financialRevenue, financialSpend);
  const financialCPA = computeCpa(financialSpend, financialConversions);

  // GA4 KPIs are evaluated on cumulative values — target is the absolute goal.
  const getKpiEffectiveTarget = (kpi: any) => {
    const rawTarget = parseFloat(String(kpi?.targetValue || "0"));
    const safeTarget = Number.isFinite(rawTarget) ? rawTarget : 0;
    return { effectiveTarget: safeTarget, scaled: false };
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
    // ROAS as ratio (48.91x) to match Overview display — NOT percentage (4,891%)
    if (name === "ROAS") return (financialSpend > 0 ? financialRevenue / financialSpend : 0).toFixed(2);
    if (name === "ROI") return Number(financialROI || 0).toFixed(2);
    if (name === "CPA") return Number(financialCPA || 0).toFixed(2);
    // Fallback to stored value for any legacy/custom KPI.
    return String(kpi?.currentValue ?? "0.00");
  };

  const NEAR_TARGET_BAND_PCT = 5;

  const computeKpiProgress = (kpi: any) => {
    const current = parseFloat(String(getLiveKpiValue(kpi) || "0"));
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const { effectiveTarget } = getKpiEffectiveTarget(kpi);
    const safeTarget = Number.isFinite(effectiveTarget) ? effectiveTarget : 0;

    const name = String(kpi?.metric || kpi?.name || "");
    const lowerIsBetter = isLowerIsBetterKpi({ metric: name, name: kpi?.name });
    const effectiveDeltaPctVal = computeEffectiveDeltaPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const band = effectiveDeltaPctVal !== null
      ? classifyKpiBand({ effectiveDeltaPct: effectiveDeltaPctVal, nearTargetBandPct: NEAR_TARGET_BAND_PCT })
      : "below" as const;
    const attainmentPct = computeAttainmentPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const fillPct = attainmentPct !== null ? computeAttainmentFillPct(attainmentPct) : 0;
    const progressColor =
      band === "above"
        ? "bg-green-500"
        : band === "near"
          ? "bg-blue-500"
          : "bg-red-500";

    return { band, effectiveDeltaPct: effectiveDeltaPctVal, attainmentPct: attainmentPct ?? 0, fillPct, progressColor, lowerIsBetter };
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
      scheduleEnabled: ga4ReportForm.scheduleEnabled,
      scheduleFrequency: ga4ReportForm.scheduleEnabled ? ga4ReportForm.scheduleFrequency : undefined,
      scheduleDayOfWeek: ga4ReportForm.scheduleEnabled && ga4ReportForm.scheduleFrequency === "weekly"
        ? dayOfWeekKeyToInt(ga4ReportForm.scheduleDayOfWeek) : undefined,
      scheduleDayOfMonth: ga4ReportForm.scheduleEnabled && (ga4ReportForm.scheduleFrequency === "monthly" || ga4ReportForm.scheduleFrequency === "quarterly")
        ? dayOfMonthToInt(ga4ReportForm.scheduleDayOfMonth) : undefined,
      scheduleTime: ga4ReportForm.scheduleEnabled ? to24HourHHMM(ga4ReportForm.scheduleTime) : undefined,
      scheduleTimeZone: ga4ReportForm.scheduleEnabled ? userTimeZone : undefined,
      quarterTiming: ga4ReportForm.scheduleEnabled && ga4ReportForm.scheduleFrequency === "quarterly"
        ? ga4ReportForm.quarterTiming : undefined,
      scheduleRecipients: ga4ReportForm.scheduleEnabled
        ? ga4ReportForm.emailRecipients.split(",").map((e: string) => e.trim()).filter(Boolean) : undefined,
    };
  };

  const downloadGA4Report = async (opts: { reportType: string; configuration?: any; reportName?: string }) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    // --- Clean modern design system (purple accent, white cards, generous spacing) ---
    type C3 = [number, number, number];
    const C = {
      // Primary purple gradient feel
      accent: [120, 80, 220] as C3,        // Primary purple
      accentLight: [147, 112, 237] as C3,   // Lighter purple
      accentBg: [245, 241, 255] as C3,      // Very light purple bg
      // Section accents
      overview: [120, 80, 220] as C3,
      ads: [80, 130, 230] as C3,
      insights: [16, 175, 140] as C3,
      kpis: [120, 80, 220] as C3,
      benchmarks: [80, 130, 230] as C3,
      // Status
      success: [34, 197, 94] as C3,
      warning: [245, 158, 11] as C3,
      danger: [239, 68, 68] as C3,
      info: [99, 102, 241] as C3,
      // Neutrals
      text: [24, 24, 27] as C3,
      textSec: [113, 113, 122] as C3,
      textTert: [161, 161, 170] as C3,
      white: [255, 255, 255] as C3,
      cardBorder: [228, 228, 231] as C3,
      cardBg: [250, 250, 252] as C3,
      divider: [240, 240, 243] as C3,
      barBg: [240, 240, 243] as C3,
    };

    let y = 0;
    const PW = 210; // page width
    const MX = 16;  // margin x
    const CW = PW - MX * 2; // content width

    const checkPage = (need: number) => { if (y + need > 274) { addPageFooter(); doc.addPage(); y = 18; } };

    const addPageFooter = () => {
      // Thin accent line
      doc.setDrawColor(...C.cardBorder);
      doc.setLineWidth(0.3);
      doc.line(MX, 282, PW - MX, 282);
      doc.setFontSize(7);
      doc.setTextColor(...C.textTert);
      doc.text("MimoSaaS Analytics", MX, 287);
      doc.text(new Date().toLocaleDateString(), PW - MX, 287, { align: "right" });
    };

    const sectionTitle = (title: string, color: C3) => {
      checkPage(18);
      // Left accent bar + title
      doc.setFillColor(...color);
      doc.roundedRect(MX, y, 3, 12, 1, 1, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.text);
      doc.text(title, MX + 8, y + 9);
      y += 18;
    };

    const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + "\u2026" : s;

    // --- Formatters ---
    const cur = String((campaign as any)?.currency || "USD");
    const fC = (n: number) => `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fP = (n: number) => formatPct(Number(n || 0));
    const fN = (n: number) => `${Math.round(Number(n || 0)).toLocaleString()}`;

    const reportName = String(opts.reportName || ga4ReportForm.name || "GA4 Report").trim() || "GA4 Report";
    const reportType = String(opts.reportType || "overview");
    const cfg = opts.configuration || ga4ReportForm.configuration || {};
    const ga4m = ga4Metrics as any;

    // ========== HEADER ==========
    // Clean white header with purple accent strip at top
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, PW, 4, "F"); // thin accent strip

    // Report title
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.text);
    doc.text(trunc(reportName, 45), MX, 22);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.textSec);
    doc.text("GA4 Analytics Report", MX, 30);

    // Metadata in a light card
    y = 38;
    doc.setFillColor(...C.cardBg);
    doc.roundedRect(MX, y, CW, 22, 3, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(...C.textSec);
    const metaCol1X = MX + 6;
    const metaCol2X = MX + CW / 2;
    doc.text(`Campaign: ${String((campaign as any)?.name || "\u2014")}`, metaCol1X, y + 7);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, metaCol2X, y + 7);
    if (ga4m?.propertyId) doc.text(`Property: ${String(ga4m?.displayName || ga4m?.propertyName || "")} (${ga4m.propertyId})`, metaCol1X, y + 15);
    if ((campaign as any)?.ga4CampaignFilter) doc.text(`Filter: ${String((campaign as any).ga4CampaignFilter)}`, metaCol2X, y + 15);
    y += 30;

    const sections =
      reportType === "custom"
        ? (cfg?.sections || { overview: true })
        : { overview: reportType === "overview", kpis: reportType === "kpis", benchmarks: reportType === "benchmarks", ads: reportType === "ads", insights: reportType === "insights" };

    // ========== OVERVIEW ==========
    if (sections.overview) {
      sectionTitle("Performance Overview", C.overview);
      const spend = Number(financialSpend || 0);
      const rev = Number(financialRevenue || 0);
      const convTot = Number(financialConversions || 0);
      const sess = Number(breakdownTotals?.sessions || 0);
      const users = Number(breakdownTotals?.users || 0);
      const conv = Number(breakdownTotals?.conversions || 0);
      const engRate = normalizeRateToPercent(dailySummedTotals.engagementRate || Number(ga4m?.metrics?.engagementRate ?? 0));
      const roas = spend > 0 ? (rev / spend) * 100 : 0;
      const roi = spend > 0 ? ((rev - spend) / spend) * 100 : 0;
      const cpa = convTot > 0 ? spend / convTot : 0;
      const cr = sess > 0 ? (conv / sess) * 100 : 0;
      const subheading = (title: string, keepWithNext = 28) => {
        checkPage(10 + keepWithNext);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.text);
        doc.text(title, MX, y + 5);
        y += 10;
      };
      const metricCards = (items: [string, string][], cols: number, cellH = 24) => {
        const width = (CW - (cols - 1) * 4) / cols;
        for (let i = 0; i < items.length; i += cols) {
          checkPage(cellH + 4);
          for (let c = 0; c < cols && i + c < items.length; c++) {
            const [lbl, val] = items[i + c];
            const cx = MX + c * (width + 4);
            doc.setFillColor(...C.white);
            doc.setDrawColor(...C.cardBorder);
            doc.roundedRect(cx, y, width, cellH, 3, 3, "FD");
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
            doc.text(lbl.toUpperCase(), cx + 6, y + 8);
            doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
            doc.text(val, cx + 6, y + 18);
          }
          y += cellH + 4;
        }
      };
      const sourceRows = (title: string, rows: [string, string][]) => {
        if (rows.length === 0) return;
        checkPage(12 + rows.length * 6);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.textTert);
        doc.text(`${title} SOURCES`, MX + 2, y + 4);
        y += 8;
        rows.forEach(([label, val]) => {
          doc.setFontSize(7);
          doc.setTextColor(...C.textSec);
          doc.text(trunc(label, 34), MX + 4, y + 3.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...C.text);
          doc.text(val, MX + CW - 4, y + 3.5, { align: "right" });
          doc.setFont("helvetica", "normal");
          y += 6;
        });
        y += 2;
      };

      subheading("Summary");
      metricCards([
        ["Sessions", fN(sess)],
        ["Users", fN(users)],
        ["Conversions", fN(conv)],
        ["Engagement Rate", fP(engRate)],
        ["Conv. Rate", fP(cr)],
      ], 3);
      y += 2;

      subheading("Revenue & Financial", 10);
      subheading("Revenue");
      const latestDayRevenue = Number(ga4LatestDayRevenue || 0) + Number(revenueDailyResp?.totalRevenue || 0);
      const revenueCards: [string, string][] = [
        ["Total Revenue", fC(rev)],
        ["Latest Day Revenue", fC(latestDayRevenue)],
      ];
      if (pipelineProxyData?.success) revenueCards.push(["Pipeline Proxy", fC(Number(pipelineProxyData.totalToDate || 0))]);
      metricCards(revenueCards, Math.min(revenueCards.length, 3));
      sourceRows("Revenue", [
        ...(ga4RevenueForFinancials > 0 ? [["GA4 Revenue", fC(ga4RevenueForFinancials)] as [string, string]] : []),
        ...revenueDisplaySources.map((s: any) => {
          const cfg = typeof s.mappingConfig === "string" ? (() => { try { return JSON.parse(s.mappingConfig); } catch { return null; } })() : s.mappingConfig;
          const isCrm = s.sourceType === "hubspot" || s.sourceType === "salesforce";
          const dateLabel = isCrm && cfg?.dateField && cfg.dateField !== "closedate" && cfg.dateField !== "CloseDate"
            ? ` · ${cfg.dateField === "hs_lastmodifieddate" || cfg.dateField === "LastModifiedDate" ? "Modified Date" : cfg.dateField === "createdate" || cfg.dateField === "CreatedDate" ? "Created Date" : "Close Date"}`
            : "";
          return [String(s.displayName || revenueSourceTypeLabel(s.sourceType)) + dateLabel, fC(Number(s.revenue != null ? s.revenue : rev))] as [string, string];
        }),
      ]);

      subheading("Spend");
      const latestDaySpend = Number(spendDailyResp?.totalSpend || 0);
      metricCards([
        ["Total Spend", fC(spend)],
        ["Latest Day Spend", fC(latestDaySpend)],
      ], 2);
      sourceRows("Spend", spendDisplaySources.map((s: any) => [
        String(s.displayName || spendSourceTypeLabel(s.sourceType)),
        fC(Number(s.spend != null ? s.spend : spend)),
      ] as [string, string]));

      subheading("Performance");
      metricCards([
        ["Profit", fC(rev - spend)],
        ["ROAS", `${Number(financialROAS || 0).toFixed(2)}x`],
        ["ROI", fP(roi)],
        ["CPA", convTot > 0 ? fC(cpa) : "—"],
      ], 4);
      y += 2;

      const addSimpleTable = (title: string, headers: string[], rows: string[][], widths: number[]) => {
        if (rows.length === 0) return;
        checkPage(36);
        sectionTitle(title, C.overview);
        doc.setFillColor(...C.cardBg);
        doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.textTert);
        let x = MX + 4;
        headers.forEach((h, idx) => {
          doc.text(h, x, y + 5.5, idx === 0 ? undefined : { align: "right" });
          x += widths[idx];
        });
        y += 10;
        rows.forEach((row) => {
          checkPage(9);
          doc.setDrawColor(...C.divider); doc.setLineWidth(0.2);
          doc.line(MX, y - 1.5, MX + CW, y - 1.5);
          let colX = MX + 4;
          row.forEach((cell, idx) => {
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
            const value = idx === 0 ? trunc(cell, 28) : cell;
            doc.text(value, colX, y + 3.5, idx === 0 ? undefined : { align: "right" });
            colX += widths[idx];
          });
          y += 8;
        });
        y += 4;
      };

      addSimpleTable(
        "Campaign Breakdown",
        ["CAMPAIGN", "SESSIONS", "USERS", "CONV", "REVENUE"],
        (Array.isArray(campaignBreakdownAgg) ? campaignBreakdownAgg : []).slice(0, 15).map((c: any) => [
          String(c?.name || "(not set)"),
          fN(Number(c?.sessions || 0)),
          fN(Number(c?.users || 0)),
          fN(Number(c?.conversions || 0)),
          fC(Number((Number(c?.revenue || 0) + Number(campaignBreakdownMatchedExternalRevenue.get(String(c?.name || "")) || 0)).toFixed(2))),
        ]),
        [76, 24, 22, 22, 40]
      );

      addSimpleTable(
        "Landing Pages",
        ["LANDING PAGE", "SESSIONS", "USERS", "CONV", "REVENUE"],
        (Array.isArray(ga4LandingPages?.rows) ? ga4LandingPages.rows : []).slice(0, 15).map((r: any) => [
          String(r?.landingPage || "(not set)"),
          fN(Number(r?.sessions || 0)),
          fN(Number(r?.users || 0)),
          fN(Number(r?.conversions || 0)),
          fC(Number(r?.revenue || 0)),
        ]),
        [76, 24, 22, 22, 40]
      );

      addSimpleTable(
        "Conversion Events",
        ["EVENT", "CONV", "EVENTS", "USERS", "REVENUE"],
        (Array.isArray(ga4ConversionEvents?.rows) ? ga4ConversionEvents.rows : []).slice(0, 15).map((r: any) => [
          String(r?.eventName || "(not set)"),
          fN(Number(r?.conversions || 0)),
          fN(Number(r?.eventCount || 0)),
          fN(Number(r?.users || 0)),
          fC(Number(r?.revenue || 0)),
        ]),
        [76, 22, 24, 22, 40]
      );
    }

    // ========== AD COMPARISON ==========
    if (sections.ads) {
      sectionTitle("Ad Comparison", C.ads);
      const rows = Array.isArray(campaignBreakdownAgg) ? campaignBreakdownAgg : [];
      if (rows.length === 0) {
        doc.setFontSize(10); doc.setTextColor(...C.textSec);
        doc.text("No campaign breakdown data available.", MX + 8, y); y += 12;
      } else {
        const adSummaryCards: [string, string][] = [
          ["Selected Metric", METRIC_LABELS[selectedMetric] || selectedMetric],
          ["Total", fmtMetricValue(selectedMetric, Number(totalMetric || 0))],
          ["Campaigns", String(sortedByMetric.length)],
        ];
        const sumW = (CW - 8) / 3;
        checkPage(24);
        for (let i = 0; i < adSummaryCards.length; i++) {
          const [lbl, val] = adSummaryCards[i];
          const cx = MX + i * (sumW + 4);
          doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
          doc.roundedRect(cx, y, sumW, 18, 3, 3, "FD");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(lbl.toUpperCase(), cx + 5, y + 6);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(trunc(val, 22), cx + 5, y + 13);
        }
        y += 24;

        const sorted = [...rows].sort((a: any, b: any) => Number(b?.sessions || 0) - Number(a?.sessions || 0));
        const top = sortedByMetric.slice(0, 20);
        const colXs = [MX + 4, MX + 80, MX + 105, MX + 126, MX + 146, MX + CW - 8];

        // Table header
        checkPage(14);
        doc.setFillColor(...C.cardBg);
        doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.textTert);
        doc.text("CAMPAIGN", colXs[0], y + 5.5);
        doc.text("SESSIONS", colXs[1], y + 5.5);
        doc.text("USERS", colXs[2], y + 5.5);
        doc.text("CONV", colXs[3], y + 5.5);
        doc.text("REVENUE", colXs[4], y + 5.5);
        doc.text("CR", colXs[5], y + 5.5);
        y += 10;

        // Rows
        for (let i = 0; i < top.length; i++) {
          checkPage(9);
          const r = top[i] as any;
          const s = Number(r?.sessions || 0), u = Number(r?.users || 0);
          const cv = Number(r?.conversions || 0), rv = Number(r?.revenue || 0);
          const rate = s > 0 ? (cv / s) * 100 : 0;

          // Subtle divider
          doc.setDrawColor(...C.divider); doc.setLineWidth(0.2);
          doc.line(MX + 2, y - 1, MX + CW - 2, y - 1);

          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
          doc.text(trunc(String(r?.campaign || "(not set)"), 35), colXs[0], y + 4);
          doc.setTextColor(...C.textSec);
          doc.text(fN(s), colXs[1], y + 4);
          doc.text(fN(u), colXs[2], y + 4);
          doc.text(fN(cv), colXs[3], y + 4);
          doc.text(fC(rv), colXs[4], y + 4);
          doc.text(fP(rate), colXs[5], y + 4);
          y += 8;
        }
        if (sortedByMetric.length > top.length) {
          doc.setFontSize(7); doc.setTextColor(...C.textTert);
          doc.text(`+ ${sortedByMetric.length - top.length} more campaigns`, MX + 4, y + 3); y += 8;
        }

        // Best / Worst cards
        if (sorted.length > 1) {
          y += 4; checkPage(22);
          const best = sorted[0] as any;
          const worst = sorted[sorted.length - 1] as any;
          const halfW = (CW - 6) / 2;

          // Best
          doc.setFillColor(...C.white); doc.setDrawColor(...C.success);
          doc.setLineWidth(0.6); doc.roundedRect(MX, y, halfW, 18, 3, 3, "FD"); doc.setLineWidth(0.3);
          doc.setFillColor(...C.success); doc.circle(MX + 8, y + 9, 2, "F");
          doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.success);
          doc.text("BEST", MX + 13, y + 7);
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
          doc.text(trunc(String(best?.campaign || ""), 28), MX + 13, y + 14);

          // Worst
          const wx = MX + halfW + 6;
          doc.setFillColor(...C.white); doc.setDrawColor(...C.danger);
          doc.setLineWidth(0.6); doc.roundedRect(wx, y, halfW, 18, 3, 3, "FD"); doc.setLineWidth(0.3);
          doc.setFillColor(...C.danger); doc.circle(wx + 8, y + 9, 2, "F");
          doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.danger);
          doc.text("LOWEST", wx + 13, y + 7);
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
          doc.text(trunc(String(worst?.campaign || ""), 28), wx + 13, y + 14);
          y += 24;
        }

        if (tableRevenueSummaryVisible) {
          y += 4;
          sectionTitle("Revenue Breakdown", C.ads);
          const breakdownRows: string[][] = [
            ["GA4 Revenue", fC(ga4Revenue)],
            ...revenueDisplaySources.map((source: any) => [
              String(source.displayName || source.sourceType || "Source"),
              fC(Number(source.revenue || 0)),
            ]),
          ];
          if (allocationSummary.unallocatedExternalRevenue > 0) {
            breakdownRows.push(["Unallocated External Revenue", fC(allocationSummary.unallocatedExternalRevenue)]);
          }
          breakdownRows.push(["Total Revenue", fC(totalRevenue)]);
          checkPage(10);
          doc.setFillColor(...C.cardBg);
          doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.textTert);
          doc.text("SOURCE", MX + 4, y + 5.5);
          doc.text("AMOUNT", MX + CW - 4, y + 5.5, { align: "right" });
          y += 10;
          for (const row of breakdownRows) {
            checkPage(8);
            doc.setDrawColor(...C.divider); doc.setLineWidth(0.2);
            doc.line(MX + 2, y - 1, MX + CW - 2, y - 1);
            doc.setFontSize(8); doc.setFont("helvetica", row[0] === "Total Revenue" ? "bold" : "normal"); doc.setTextColor(...C.text);
            doc.text(trunc(row[0], 42), MX + 4, y + 4);
            doc.text(row[1], MX + CW - 4, y + 4, { align: "right" });
            y += 8;
          }
        }
      }
      y += 6;
    }

    // ========== INSIGHTS ==========
    if (sections.insights) {
      sectionTitle("Insights", C.insights);
      const items = Array.isArray(insights) ? insights : [];
      const availableDays = Number(insightsRollups?.availableDays || 0);
      checkPage(24);
      const insightSummaryCards: [string, string][] = [
        ["Revenue", fC(Number(financialRevenue || 0))],
        ["Spend", fC(Number(financialSpend || 0))],
        ["Profit", fC(Number(financialRevenue || 0) - Number(financialSpend || 0))],
        ["ROAS", `${Number(financialROAS || 0).toFixed(2)}x`],
        ["Days of Data", String(availableDays)],
      ];
      const sumW = (CW - 8) / 3;
      for (let i = 0; i < insightSummaryCards.length; i += 3) {
        checkPage(22);
        for (let c = 0; c < 3 && i + c < insightSummaryCards.length; c++) {
          const [lbl, val] = insightSummaryCards[i + c];
          const cx = MX + c * (sumW + 4);
          doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
          doc.roundedRect(cx, y, sumW, 18, 3, 3, "FD");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(lbl.toUpperCase(), cx + 5, y + 6);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(trunc(val, 22), cx + 5, y + 13);
        }
        y += 22;
      }
      y += 2;

      if (availableDays >= 3) {
        checkPage(24);
        doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
        doc.roundedRect(MX, y, CW, 18, 3, 3, "FD");
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
        doc.text("Trend Snapshot", MX + 6, y + 6);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textSec);
        const trendText = availableDays >= 14
          ? `Last 7d vs prior 7d: Sessions ${formatNumber(insightsRollups.last7.sessions)} vs ${formatNumber(insightsRollups.prior7.sessions)}, Revenue ${formatMoney(insightsRollups.last7.revenue)} vs ${formatMoney(insightsRollups.prior7.revenue)}, Conversions ${formatNumber(insightsRollups.last7.conversions)} vs ${formatNumber(insightsRollups.prior7.conversions)}.`
          : `Last 3d vs prior 3d: Sessions ${formatNumber(insightsRollups.last3.sessions)} vs ${formatNumber(insightsRollups.prior3.sessions)}, Revenue ${formatMoney(insightsRollups.last3.revenue)} vs ${formatMoney(insightsRollups.prior3.revenue)}, Conversions ${formatNumber(insightsRollups.last3.conversions)} vs ${formatNumber(insightsRollups.prior3.conversions)}.`;
        const trendLines = doc.splitTextToSize(trendText, CW - 12);
        let ty = y + 11;
        for (const line of trendLines.slice(0, 3)) {
          doc.text(line, MX + 6, ty);
          ty += 4;
        }
        y += 22;
      }

      if (items.length === 0) {
        doc.setFontSize(10); doc.setTextColor(...C.textSec);
        doc.text("No insights available at this time.", MX + 8, y); y += 12;
      } else {
        const top = items.slice(0, 12);
        for (const item of top) {
          const sev = String((item as any)?.severity || "info").toLowerCase();
          const title = String((item as any)?.title || "");
          const desc = String((item as any)?.description || "");
          const rec = String((item as any)?.recommendation || "");

          const descL = desc ? doc.splitTextToSize(desc, CW - 24).length : 0;
          const recL = rec ? doc.splitTextToSize(rec, CW - 28).length : 0;
          const ch = 16 + descL * 4.5 + (recL > 0 ? recL * 4.5 + 4 : 0) + 4;
          checkPage(ch + 4);

          // Card
          doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
          doc.roundedRect(MX, y, CW, ch, 3, 3, "FD");

          // Severity indicator (colored left strip)
          const sevCol: C3 = sev === "high" ? C.danger : sev === "positive" ? C.success : sev === "medium" ? C.warning : C.info;
          doc.setFillColor(...sevCol);
          doc.roundedRect(MX, y, 3, ch, 1, 1, "F");

          // Severity pill
          doc.setFontSize(6); doc.setFont("helvetica", "bold");
          const sevText = sev.toUpperCase();
          doc.setFillColor(...sevCol);
          const pillW = Math.max(doc.getTextWidth(sevText) * 1.8 + 4, 14);
          doc.roundedRect(MX + 8, y + 4, pillW, 5, 2, 2, "F");
          doc.setTextColor(...C.white);
          doc.text(sevText, MX + 8 + pillW / 2, y + 7.5, { align: "center" });

          // Title
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(trunc(title, 70), MX + 8 + pillW + 4, y + 8);
          let iy = y + 14;

          // Description
          if (desc) {
            doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textSec);
            const dl = doc.splitTextToSize(desc, CW - 24);
            for (const l of dl) { doc.text(l, MX + 8, iy); iy += 4.5; }
          }
          // Recommendation
          if (rec) {
            iy += 2;
            doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(...C.insights);
            const rl = doc.splitTextToSize(rec, CW - 28);
            for (const l of rl) { doc.text(`\u2192 ${l}`, MX + 8, iy); iy += 4.5; }
          }
          y += ch + 4;
        }
        if (items.length > top.length) {
          doc.setFontSize(7); doc.setTextColor(...C.textTert);
          doc.text(`+ ${items.length - top.length} more insights`, MX + 4, y + 2); y += 8;
        }
      }
      y += 4;
    }

    // ========== KPIs ==========
    if (sections.kpis) {
      sectionTitle("Key Performance Indicators", C.kpis);
      const items = Array.isArray(platformKPIs) ? platformKPIs : [];
      if (items.length === 0) {
        doc.setFontSize(10); doc.setTextColor(...C.textSec);
        doc.text("No KPIs configured yet.", MX + 8, y); y += 12;
      } else {
        checkPage(30);
        const kpiTrackerCards: [string, string][] = [
          ["Total KPIs", String(kpiTracker.total || 0)],
          ["Above Target", String(kpiTracker.above || 0)],
          ["On Track", String(kpiTracker.near || 0)],
          ["Below Target", String(kpiTracker.below || 0)],
          ["Avg. Progress", `${Number(kpiTracker.avgPct || 0).toFixed(1)}%`],
        ];
        const trackerW = (CW - 8) / 3;
        for (let i = 0; i < kpiTrackerCards.length; i += 3) {
          for (let c = 0; c < 3 && i + c < kpiTrackerCards.length; c++) {
            const [lbl, val] = kpiTrackerCards[i + c];
            const cx = MX + c * (trackerW + 4);
            doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
            doc.roundedRect(cx, y, trackerW, 18, 3, 3, "FD");
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
            doc.text(lbl.toUpperCase(), cx + 5, y + 6);
            doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
            doc.text(val, cx + 5, y + 13);
          }
          y += 22;
        }
        y += 2;
        for (const k of items) {
          const deps = getMissingDependenciesForMetric(String((k as any)?.metric || (k as any)?.name || ""));
          if (deps.missing.length > 0) {
            checkPage(20);
            doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
            doc.roundedRect(MX, y, CW, 16, 3, 3, "FD");
            doc.setFillColor(...C.danger); doc.roundedRect(MX, y, 3, 16, 1, 1, "F");
            doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
            doc.text(String(k?.name || ""), MX + 8, y + 6);
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.danger);
            doc.text(`Blocked \u2014 missing ${deps.missing.join(" + ")}`, MX + 8, y + 12);
            y += 20;
            continue;
          }

          const kH = 50;
          checkPage(kH + 5);
          const p = computeKpiProgress(k);
          const t = getKpiEffectiveTarget(k);
          const liveVal = getLiveKpiValue(k);
          const progress = Math.min(p.attainmentPct, 100);
          const statusLabel = p.band === "above" ? "Above Target" : p.band === "near" ? "On Track" : "Below Target";
          const statusCol: C3 = p.band === "above" ? C.success : p.band === "near" ? C.info : C.danger;

          // Card
          doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
          doc.roundedRect(MX, y, CW, kH, 4, 4, "FD");
          // Accent strip
          doc.setFillColor(...statusCol);
          doc.roundedRect(MX, y, 3, kH, 1, 1, "F");

          // Name
          doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(String(k?.name || ""), MX + 8, y + 8);

          // Metric pill
          if ((k as any)?.metric) {
            doc.setFillColor(...C.accentBg);
            const ml = String((k as any).metric).toUpperCase();
            const mw = Math.max(doc.getTextWidth(ml) + 6, 18);
            doc.roundedRect(MX + 8, y + 11, mw, 5, 2, 2, "F");
            doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accent);
            doc.text(ml, MX + 8 + mw / 2, y + 14.5, { align: "center" });
          }

          // Current / Target in two mini-boxes
          const boxY = y + 19;
          const bw = (CW - 24) / 2;
          // Current
          doc.setFillColor(...C.cardBg);
          doc.roundedRect(MX + 8, boxY, bw, 12, 2, 2, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(`CURRENT (${String(k?.unit || "%")})`, MX + 12, boxY + 4);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(formatNumberByUnit(String(liveVal || "0"), String(k?.unit || "%")), MX + 12, boxY + 10);
          // Target
          doc.setFillColor(...C.cardBg);
          doc.roundedRect(MX + 12 + bw, boxY, bw, 12, 2, 2, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(`TARGET (${String(k?.unit || "%")})`, MX + 16 + bw, boxY + 4);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(formatNumberByUnit(String(t.effectiveTarget || ""), String(k?.unit || "%")), MX + 16 + bw, boxY + 10);

          // Progress bar
          const barY = y + 35;
          const barW = CW - 58;
          doc.setFillColor(...C.barBg);
          doc.roundedRect(MX + 8, barY, barW, 5, 2, 2, "F");
          if (progress > 0) {
            doc.setFillColor(...statusCol);
            doc.roundedRect(MX + 8, barY, (barW * progress) / 100, 5, 2, 2, "F");
          }
          // Percentage text
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(`${p.attainmentPct.toFixed(1)}%`, MX + 12 + barW, barY + 4);
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textSec);
          doc.text(`Progress: ${p.fillPct.toFixed(1)}%`, MX + 8, barY + 10);

          // Status badge
          doc.setFillColor(...statusCol);
          const slW = Math.max(doc.getTextWidth(statusLabel) + 8, 28);
          doc.roundedRect(MX + 18 + barW + 18, barY - 1, slW, 7, 3, 3, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.white);
          doc.text(statusLabel, MX + 18 + barW + 18 + slW / 2, barY + 4, { align: "center" });

          y += kH + 5;
        }
      }
      y += 4;
    }

    // ========== BENCHMARKS ==========
    if (sections.benchmarks) {
      sectionTitle("Performance Benchmarks", C.benchmarks);
      const items = Array.isArray(benchmarks) ? benchmarks : [];
      if (items.length === 0) {
        doc.setFontSize(10); doc.setTextColor(...C.textSec);
        doc.text("No benchmarks configured yet.", MX + 8, y); y += 12;
      } else {
        checkPage(30);
        const benchmarkTrackerCards: [string, string][] = [
          ["Total Benchmarks", String(benchmarkTracker.total || 0)],
          ["On Track", String(benchmarkTracker.onTrack || 0)],
          ["Needs Attention", String(benchmarkTracker.needsAttention || 0)],
          ["Behind", String(benchmarkTracker.behind || 0)],
          ["Avg. Progress", `${Number(benchmarkTracker.avgPct || 0).toFixed(1)}%`],
        ];
        const trackerW = (CW - 8) / 3;
        for (let i = 0; i < benchmarkTrackerCards.length; i += 3) {
          for (let c = 0; c < 3 && i + c < benchmarkTrackerCards.length; c++) {
            const [lbl, val] = benchmarkTrackerCards[i + c];
            const cx = MX + c * (trackerW + 4);
            doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
            doc.roundedRect(cx, y, trackerW, 18, 3, 3, "FD");
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
            doc.text(lbl.toUpperCase(), cx + 5, y + 6);
            doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
            doc.text(val, cx + 5, y + 13);
          }
          y += 22;
        }
        y += 2;
        for (const b of items) {
          const deps = getMissingDependenciesForMetric(String((b as any)?.metric || ""));
          if (deps.missing.length > 0) {
            checkPage(20);
            doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
            doc.roundedRect(MX, y, CW, 16, 3, 3, "FD");
            doc.setFillColor(...C.danger); doc.roundedRect(MX, y, 3, 16, 1, 1, "F");
            doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
            doc.text(String((b as any)?.name || ""), MX + 8, y + 6);
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.danger);
            doc.text(`Blocked \u2014 missing ${deps.missing.join(" + ")}`, MX + 8, y + 12);
            y += 20;
            continue;
          }

          const bH = 42;
          checkPage(bH + 5);
          const p = computeBenchmarkProgress(b);
          const currentLive = getBenchmarkDisplayCurrentValue(b);
          const progress = Math.min(p.pct, 100);
          const statusLabel = p.status === "on_track" ? "On Track" : p.status === "needs_attention" ? "Needs Attention" : "Behind";
          const statusCol: C3 = p.status === "on_track" ? C.success : p.status === "needs_attention" ? C.warning : C.danger;

          // Card
          doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBorder);
          doc.roundedRect(MX, y, CW, bH, 4, 4, "FD");
          doc.setFillColor(...statusCol);
          doc.roundedRect(MX, y, 3, bH, 1, 1, "F");

          // Name
          doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(String((b as any)?.name || ""), MX + 8, y + 8);

          // Current / Benchmark boxes
          const bbY = y + 13;
          const bbw = (CW - 24) / 2;
          doc.setFillColor(...C.cardBg); doc.roundedRect(MX + 8, bbY, bbw, 10, 2, 2, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(`CURRENT (${String((b as any)?.unit || "%")})`, MX + 12, bbY + 4);
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(formatBenchmarkValue(currentLive, (b as any)?.unit), MX + 12, bbY + 9);

          doc.setFillColor(...C.cardBg); doc.roundedRect(MX + 12 + bbw, bbY, bbw, 10, 2, 2, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textTert);
          doc.text(`BENCHMARK (${String((b as any)?.unit || "%")})`, MX + 16 + bbw, bbY + 4);
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(formatBenchmarkValue((b as any)?.benchmarkValue || "0", (b as any)?.unit), MX + 16 + bbw, bbY + 9);

          // Progress bar
          const pbarY = y + 28;
          const pbarW = CW - 58;
          doc.setFillColor(...C.barBg); doc.roundedRect(MX + 8, pbarY, pbarW, 5, 2, 2, "F");
          if (progress > 0) {
            doc.setFillColor(...statusCol);
            doc.roundedRect(MX + 8, pbarY, (pbarW * progress) / 100, 5, 2, 2, "F");
          }
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
          doc.text(`${p.pct.toFixed(1)}%`, MX + 12 + pbarW, pbarY + 4);
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.textSec);
          doc.text(`Progress: ${Math.min(p.pct, 100).toFixed(1)}%`, MX + 8, pbarY + 10);

          // Status badge
          doc.setFillColor(...statusCol);
          const bslW = Math.max(doc.getTextWidth(statusLabel) + 8, 28);
          doc.roundedRect(MX + 18 + pbarW + 18, pbarY - 1, bslW, 7, 3, 3, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.white);
          doc.text(statusLabel, MX + 18 + pbarW + 18 + bslW / 2, pbarY + 4, { align: "center" });

          y += bH + 5;
        }
      }
      y += 4;
    }

    // Footer on last page
    addPageFooter();
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
    let above = 0;
    let near = 0;
    let below = 0;
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
      // Avg. Progress should reflect bounded progress toward target, not be inflated above 100%
      // by over-performing KPIs.
      sumPct += p.fillPct;
      if (p.band === "above") above += 1;
      else if (p.band === "near") near += 1;
      else below += 1;
    }

    const avgPct = scored > 0 ? sumPct / scored : 0;
    return { total: items.length, scored, above, near, below, blocked, avgPct };
    // computeKpiProgress depends on live values; include the main value inputs so the tracker updates correctly.
  }, [platformKPIs, breakdownTotals, ga4Metrics, dailySummedTotals, financialSpend, financialRevenue, financialROI, financialCPA, spendMetricAvailable, revenueMetricAvailable]);

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
    // benchmark progress depends on the same live inputs used by the individual benchmark cards.
  }, [
    benchmarks,
    breakdownTotals,
    ga4Metrics,
    dailySummedTotals,
    financialRevenue,
    financialROAS,
    financialROI,
    financialCPA,
    spendMetricAvailable,
    revenueMetricAvailable,
  ]);

  // --- Rolling window rollups (moved above insights so insights can use them) ---
  const insightsRollups = useMemo(() => {
    const rows = Array.isArray(ga4TimeSeries) ? (ga4TimeSeries as any[]) : [];
    const byDate = rows
      .map((r: any) => ({
        date: String(r?.date || "").trim(),
        sessions: Number(r?.sessions || 0) || 0,
        users: Number(r?.users || 0) || 0,
        conversions: Number(r?.conversions || 0) || 0,
        revenue: Number(r?.revenue || 0) || 0,
        pageviews: Number(r?.pageviews || 0) || 0,
        engagementRate: Number(r?.engagementRate || 0) || 0,
        engagedSessions: Number(r?.engagedSessions || 0) || 0,
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
          acc.users += Number(r.users || 0);
          // Engagement rate: weight by sessions for proper average
          const er = Number(r.engagementRate || 0);
          acc.engagedSessions += r.sessions * (er <= 1 ? er : er / 100);
          return acc;
        },
        { sessions: 0, conversions: 0, revenue: 0, pageviews: 0, users: 0, engagedSessions: 0 }
      );
      const cr = sums.sessions > 0 ? (sums.conversions / sums.sessions) * 100 : 0;
      const pvps = sums.sessions > 0 ? sums.pageviews / sums.sessions : 0;
      const engagementRate = sums.sessions > 0 ? (sums.engagedSessions / sums.sessions) * 100 : 0;
      const startDate = slice[0]?.date || null;
      const endDate = slice[slice.length - 1]?.date || null;
      return { ...sums, cr, pvps, engagementRate, startDate, endDate, days: slice.length };
    };

    const last3 = rollup(3, 0);
    const prior3 = rollup(3, 3);
    const last7 = rollup(7, 0);
    const prior7 = rollup(7, 7);
    const last30 = rollup(30, 0);
    const prior30 = rollup(30, 30);

    const deltaPct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return {
      availableDays: dates.length,
      last3,
      prior3,
      last7,
      prior7,
      last30,
      prior30,
      deltas: {
        sessions3: deltaPct(last3.sessions, prior3.sessions),
        conversions3: deltaPct(last3.conversions, prior3.conversions),
        revenue3: deltaPct(last3.revenue, prior3.revenue),
        cr3: prior3.cr > 0 ? ((last3.cr - prior3.cr) / prior3.cr) * 100 : 0,
        pvps3: prior3.pvps > 0 ? ((last3.pvps - prior3.pvps) / prior3.pvps) * 100 : 0,
        sessions7: deltaPct(last7.sessions, prior7.sessions),
        conversions7: deltaPct(last7.conversions, prior7.conversions),
        revenue7: deltaPct(last7.revenue, prior7.revenue),
        cr7: prior7.cr > 0 ? ((last7.cr - prior7.cr) / prior7.cr) * 100 : 0,
        pvps7: prior7.pvps > 0 ? ((last7.pvps - prior7.pvps) / prior7.pvps) * 100 : 0,
        users7: deltaPct(last7.users, prior7.users),
        engRate7: prior7.engagementRate > 0 ? ((last7.engagementRate - prior7.engagementRate) / prior7.engagementRate) * 100 : 0,
        sessions30: deltaPct(last30.sessions, prior30.sessions),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        revenue30: deltaPct(last30.revenue, prior30.revenue),
        cr30: prior30.cr > 0 ? ((last30.cr - prior30.cr) / prior30.cr) * 100 : 0,
        pvps30: prior30.pvps > 0 ? ((last30.pvps - prior30.pvps) / prior30.pvps) * 100 : 0,
        users30: deltaPct(last30.users, prior30.users),
        engRate30: prior30.engagementRate > 0 ? ((last30.engagementRate - prior30.engagementRate) / prior30.engagementRate) * 100 : 0,
      },
    };
  }, [ga4TimeSeries]);

  // --- Channel analysis for data-driven recommendations ---
  const channelAnalysis = useMemo(() => {
    const rows = Array.isArray(ga4Breakdown?.rows) ? ga4Breakdown.rows : [];
    if (rows.length === 0) return null;

    const byChannel = new Map<string, { label: string; sessions: number; conversions: number; revenue: number }>();
    let totalSessions = 0;
    let totalConversions = 0;
    let totalRevenue = 0;

    for (const r of rows) {
      const source = String((r as any)?.source || "(direct)").trim();
      const medium = String((r as any)?.medium || "(none)").trim();
      const label = `${source} / ${medium}`;
      const existing = byChannel.get(label) || { label, sessions: 0, conversions: 0, revenue: 0 };
      const s = Number((r as any)?.sessions || 0);
      const c = Number((r as any)?.conversions || 0);
      const rev = Number((r as any)?.revenue || 0);
      existing.sessions += s;
      existing.conversions += c;
      existing.revenue += rev;
      totalSessions += s;
      totalConversions += c;
      totalRevenue += rev;
      byChannel.set(label, existing);
    }

    const channels = Array.from(byChannel.values());

    const bySessionsDesc = [...channels].sort((a, b) => b.sessions - a.sessions);
    const topSessionChannel = bySessionsDesc[0] || null;
    const topSessionShare = totalSessions > 0 && topSessionChannel
      ? (topSessionChannel.sessions / totalSessions * 100)
      : 0;

    const byRevenueDesc = [...channels].sort((a, b) => b.revenue - a.revenue);
    const topRevenueChannel = byRevenueDesc[0] || null;
    const topRevenueShare = totalRevenue > 0 && topRevenueChannel
      ? (topRevenueChannel.revenue / totalRevenue * 100)
      : 0;

    const significantChannels = channels.filter(
      ch => totalSessions > 0 && ch.sessions >= totalSessions * 0.05
    );
    const withCR = significantChannels.map(ch => ({
      ...ch,
      cr: ch.sessions > 0 ? (ch.conversions / ch.sessions) * 100 : 0,
    }));
    const lowestCRChannel = withCR.length > 0
      ? withCR.reduce((a, b) => a.cr < b.cr ? a : b)
      : null;

    return {
      totalSessions,
      totalConversions,
      totalRevenue,
      topSessionChannel,
      topSessionShare,
      topRevenueChannel,
      topRevenueShare,
      lowestCRChannel,
      channelCount: channels.length,
      channels: bySessionsDesc,
    };
  }, [ga4Breakdown]);

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
        recommendation: "Import spend-to-date to enable spend-based executive metrics.",
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
        id: "info:ga4_revenue_and_imported_revenue_included",
        severity: "low",
        title: "GA4 and imported revenue are both included",
        description: "Imported revenue is included alongside GA4 revenue in Total Revenue. Confirm imported sources are not already tracked as GA4 ecommerce to avoid double counting.",
      });
    }

    // 1) Actionable insights from KPI performance
    for (const k of Array.isArray(platformKPIs) ? platformKPIs : []) {
      const deps = getMissingDependenciesForMetric(String((k as any)?.metric || (k as any)?.name || ""));
      if (deps.missing.length > 0) continue; // blocked KPIs are handled in integrity checks above
      const p = computeKpiProgress(k);
      const attPct = p?.attainmentPct ?? 100;
      if (attPct >= KPI_NEEDS_ATTENTION_PCT) continue; // Only flag KPIs below attainment threshold

      const sev: InsightItem["severity"] = attPct < KPI_BEHIND_PCT ? "high" : "medium";
      const metric = String((k as any)?.metric || (k as any)?.name || "KPI");
      const effectiveTarget = (getKpiEffectiveTarget(k) as any)?.effectiveTarget ?? (k as any)?.targetValue ?? "";
      const analytics = kpiAnalyticsById.get(String((k as any)?.id || "")) || null;

      // Streak: how many consecutive recorded days are in the same "not on track" state.
      const streak = (() => {
        const prog = Array.isArray(analytics?.progress) ? analytics.progress : [];
        if (prog.length === 0) return 0;
        const lowerIsBetter = isLowerIsBetterKpi({ metric, name: String((k as any)?.name || "") });
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

      const trendNote = (() => {
        if (!analytics?.trendAnalysis) return "";
        const pct = Number(analytics.trendAnalysis.percentage || 0);
        if (Math.abs(pct) < 0.1) return " Stable over recent period.";
        const dir = pct > 0 ? "up" : "down";
        return ` Trending ${dir} ${Math.abs(pct).toFixed(1)}% over ${String(analytics.trendAnalysis.period || "30d")}.`;
      })();
      const streakNote = streak > 1 ? ` Streak: ${streak} days.` : "";

      out.push({
        id: `kpi:${String((k as any)?.id || metric)}`,
        severity: sev,
        title: `${metric} ${attPct < KPI_BEHIND_PCT ? "Behind Target" : "Needs Attention"}`,
        description: (() => {
          const unit = String((k as any)?.unit || "%");
          const suffix = unit === "%" ? "%" : unit === "$" ? "" : "";
          const prefix = unit === "$" ? "$" : "";
          const curFmt = `${prefix}${formatNumberByUnit(String(getLiveKpiValue(k) || "0"), unit)}${suffix}`;
          const tgtFmt = `${prefix}${formatNumberByUnit(String(effectiveTarget), unit)}${suffix}`;
          return `Current ${curFmt} vs target ${tgtFmt} (${formatPct(attPct)} progress).${streakNote}${trendNote}`;
        })(),
        recommendation: (() => {
          const m = metric.toLowerCase();
          const ch = channelAnalysis;
          const isCustom = !m || m === "__custom__";
          const isConversion = CONVERSION_METRICS.has(m) || (!isCustom && m.includes("conversion"));
          const isRevenue = REVENUE_METRICS.has(m);
          const isTraffic = TRAFFIC_METRICS.has(m);
          const isCpa = CPA_METRICS.has(m);
          if (isConversion) {
            const base = "Check landing page changes, funnel breaks, and traffic mix shifts.";
            return ch?.lowestCRChannel
              ? `${base} "${ch.lowestCRChannel.label}" has the lowest conversion rate (${formatPct(ch.lowestCRChannel.cr)}) among significant channels — audit targeting and landing pages for this source.`
              : base;
          }
          if (isRevenue) {
            const base = "Check top channels for traffic or conversion drops; validate revenue tracking.";
            return ch?.topRevenueChannel
              ? `${base} "${ch.topRevenueChannel.label}" drives ${ch.topRevenueShare.toFixed(0)}% of revenue — prioritize investigation there.`
              : base;
          }
          if (isTraffic) {
            const base = "Review traffic sources and campaign spend allocation.";
            return ch?.topSessionChannel
              ? `${base} "${ch.topSessionChannel.label}" drives ${ch.topSessionShare.toFixed(0)}% of sessions — check if this source declined.`
              : base;
          }
          if (isCpa) {
            return "Audit conversion volume and spend allocation; verify conversion events are firing correctly.";
          }
          const base = "Review the primary drivers for this KPI and adjust budgets/creative/landing pages.";
          return ch?.topSessionChannel
            ? `${base} Top traffic source: "${ch.topSessionChannel.label}" (${ch.topSessionShare.toFixed(0)}% of sessions).`
            : base;
        })(),
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
        title: `${String((b as any)?.name || metric)} ${status === "behind" ? "Behind Benchmark" : "Below Benchmark"}`,
        description: `Current ${formatBenchmarkValue(getBenchmarkDisplayCurrentValue(b), String((b as any)?.unit || "%"))} vs benchmark ${formatBenchmarkValue(
          String((b as any)?.benchmarkValue || "0"),
          String((b as any)?.unit || "%")
        )} (${String(p?.labelPct || "0")}% to benchmark).${trendNote}${volNote}`,
        recommendation: (() => {
          const m = metric.toLowerCase();
          const ch = channelAnalysis;
          const isCustom = !m || m === "__custom__";
          const isConversion = CONVERSION_METRICS.has(m) || (!isCustom && m.includes("conversion"));
          const isEngagement = ENGAGEMENT_METRICS.has(m) || (!isCustom && m.includes("engagement"));
          const isRevenue = REVENUE_METRICS.has(m);
          if (isConversion) {
            const base = "Focus on landing page UX and traffic quality; validate conversion tagging.";
            return ch?.lowestCRChannel
              ? `${base} "${ch.lowestCRChannel.label}" has the lowest conversion rate (${formatPct(ch.lowestCRChannel.cr)}) — start there.`
              : base;
          }
          if (isEngagement) {
            return "Review content relevance and landing page engagement; check mobile performance.";
          }
          if (isRevenue) {
            const base = "Identify which channels are underperforming and iterate targeting/creative.";
            return ch?.topRevenueChannel
              ? `${base} "${ch.topRevenueChannel.label}" drives ${ch.topRevenueShare.toFixed(0)}% of revenue — investigate changes there first.`
              : base;
          }
          const base = "Identify which channels/campaigns are underperforming and iterate targeting/creative/landing page.";
          return ch?.topSessionChannel
            ? `${base} Top traffic source: "${ch.topSessionChannel.label}" (${ch.topSessionShare.toFixed(0)}% of sessions).`
            : base;
        })(),
      });
    }

    // 2b) Scheduler dependency: inform user when analytics history is missing
    const hasKpis = Array.isArray(platformKPIs) && platformKPIs.length > 0;
    const hasKpiAnalytics = kpiAnalyticsById.size > 0;
    const hasBenchmarks = Array.isArray(benchmarks) && benchmarks.length > 0;
    const hasBenchmarkAnalytics = benchmarkAnalyticsById.size > 0;
    if ((hasKpis && !hasKpiAnalytics) || (hasBenchmarks && !hasBenchmarkAnalytics)) {
      const missing: string[] = [];
      if (hasKpis && !hasKpiAnalytics) missing.push("KPI");
      if (hasBenchmarks && !hasBenchmarkAnalytics) missing.push("Benchmark");
      out.push({
        id: "info:scheduler_no_history",
        severity: "low",
        title: `${missing.join(" and ")} trend tracking will activate after the daily analytics job runs`,
        description: `Streak and trend data for ${missing.join("/")} insights require at least one daily analytics snapshot. This data is recorded automatically by the background scheduler.`,
        recommendation: "No action needed — trend data will appear within 24 hours of KPI/Benchmark creation.",
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
    if (dates.length >= INSIGHTS_MIN_HISTORY_DAYS) {
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

      if (crB > 0 && crDeltaPct <= ANOMALY_CR_DROP_PCT) {
        out.push({
          id: "anomaly:cr:wow",
          severity: "high",
          title: `Conversion rate dropped ${Math.abs(crDeltaPct).toFixed(1)}% week-over-week`,
          description: `Last 7d ${formatPct(crA)} vs prior 7d ${formatPct(crB)} (GA4 sessions/conversions).`,
          recommendation:
            "Check landing page changes, conversion event configuration, and traffic mix by source/medium. If paid traffic is involved, validate targeting/creative changes.",
        });
      }

      // Engagement depth proxy: pageviews per session (from GA4 daily facts)
      const pvpsA = a.sessions > 0 ? a.pageviews / a.sessions : 0;
      const pvpsB = b.sessions > 0 ? b.pageviews / b.sessions : 0;
      const pvpsDelta = pvpsB > 0 ? ((pvpsA - pvpsB) / pvpsB) * 100 : 0;
      if (pvpsB > 0 && pvpsDelta <= ANOMALY_ENGAGEMENT_DROP_PCT) {
        out.push({
          id: "anomaly:pvps:wow",
          severity: "medium",
          title: `Engagement depth decreased ${Math.abs(pvpsDelta).toFixed(1)}% week-over-week`,
          description: `Pageviews/session last 7d ${pvpsA.toFixed(2)} vs prior 7d ${pvpsB.toFixed(2)}.`,
          recommendation: "Review landing page relevance, page speed, and mobile UX; check if traffic sources shifted toward lower-intent audiences.",
        });
      }

      // 3b) Volume anomalies using pre-computed insightsRollups deltas
      const sessionsDelta7 = insightsRollups.deltas.sessions7;
      const revenueDelta7 = insightsRollups.deltas.revenue7;
      const convDelta7 = insightsRollups.deltas.conversions7;
      const ch = channelAnalysis;

      if (sessionsDelta7 <= ANOMALY_SESSIONS_DROP_PCT && insightsRollups.prior7.sessions > 0) {
        const channelNote = ch?.topSessionChannel
          ? ` Top source: "${ch.topSessionChannel.label}" (${ch.topSessionShare.toFixed(0)}% of sessions).`
          : "";
        out.push({
          id: "anomaly:sessions:wow",
          severity: "high",
          title: `Sessions dropped ${Math.abs(sessionsDelta7).toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatNumber(insightsRollups.last7.sessions)} sessions vs prior 7d: ${formatNumber(insightsRollups.prior7.sessions)}.${channelNote}`,
          recommendation: "Check paid campaign budgets, SEO ranking changes, and whether any traffic sources were paused or reduced.",
        });
      }

      if (revenueDelta7 <= ANOMALY_REVENUE_DROP_PCT && insightsRollups.prior7.revenue > 0) {
        const channelNote = ch?.topRevenueChannel
          ? ` Top revenue source: "${ch.topRevenueChannel.label}" (${ch.topRevenueShare.toFixed(0)}% of revenue).`
          : "";
        out.push({
          id: "anomaly:revenue:wow",
          severity: "high",
          title: `Revenue dropped ${Math.abs(revenueDelta7).toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatMoney(insightsRollups.last7.revenue)} vs prior 7d: ${formatMoney(insightsRollups.prior7.revenue)}.${channelNote}`,
          recommendation: "Investigate conversion rate changes, AOV shifts, and whether high-value campaigns were paused.",
        });
      }

      if (convDelta7 <= ANOMALY_CONVERSIONS_DROP_PCT && insightsRollups.prior7.conversions > 0) {
        out.push({
          id: "anomaly:conversions:wow",
          severity: "high",
          title: `Conversions dropped ${Math.abs(convDelta7).toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatNumber(insightsRollups.last7.conversions)} vs prior 7d: ${formatNumber(insightsRollups.prior7.conversions)}.`,
          recommendation: "Check conversion event configuration, landing page changes, and traffic quality by source/medium.",
        });
      }

      // 3c) Positive signals — what's working
      if (sessionsDelta7 >= POSITIVE_SESSIONS_UP_PCT && insightsRollups.prior7.sessions > POSITIVE_SESSIONS_MIN_PRIOR) {
        out.push({
          id: "positive:sessions:wow",
          severity: "low",
          title: `Sessions up ${sessionsDelta7.toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatNumber(insightsRollups.last7.sessions)} sessions vs prior 7d: ${formatNumber(insightsRollups.prior7.sessions)}.`,
          recommendation: "Momentum is positive. Consider increasing budget on top-performing channels to accelerate growth.",
        });
      }

      if (revenueDelta7 >= POSITIVE_REVENUE_UP_PCT && insightsRollups.prior7.revenue > 0) {
        out.push({
          id: "positive:revenue:wow",
          severity: "low",
          title: `Revenue up ${revenueDelta7.toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatMoney(insightsRollups.last7.revenue)} vs prior 7d: ${formatMoney(insightsRollups.prior7.revenue)}.`,
          recommendation: "Revenue momentum is strong. Identify which channels drove the increase and double down.",
        });
      }

      if (convDelta7 >= POSITIVE_CONVERSIONS_UP_PCT && insightsRollups.prior7.conversions > POSITIVE_CONVERSIONS_MIN_PRIOR) {
        out.push({
          id: "positive:conversions:wow",
          severity: "low",
          title: `Conversions up ${convDelta7.toFixed(1)}% week-over-week`,
          description: `Last 7d: ${formatNumber(insightsRollups.last7.conversions)} vs prior 7d: ${formatNumber(insightsRollups.prior7.conversions)}.`,
        });
      }
    } else if (dates.length >= INSIGHTS_SHORT_WINDOW_DAYS) {
      // Short-window fallback: 3d vs 3d with higher thresholds to reduce false positives
      const crA3 = insightsRollups.last3.cr;
      const crB3 = insightsRollups.prior3.cr;
      const crDelta3 = crB3 > 0 ? ((crA3 - crB3) / crB3) * 100 : 0;

      if (crB3 > 0 && crDelta3 <= ANOMALY_SHORT_CR_DROP_PCT) {
        out.push({
          id: "anomaly:cr:3d",
          severity: "medium",
          title: `Conversion rate dropped ${Math.abs(crDelta3).toFixed(1)}% (3-day comparison)`,
          description: `Last 3d ${formatPct(crA3)} vs prior 3d ${formatPct(crB3)}. Short window — monitor for confirmation.`,
          recommendation: "Check for recent landing page changes or traffic source shifts. Confirm trend with more data.",
        });
      }

      const pvpsA3 = insightsRollups.last3.pvps;
      const pvpsB3 = insightsRollups.prior3.pvps;
      const pvpsDelta3 = pvpsB3 > 0 ? ((pvpsA3 - pvpsB3) / pvpsB3) * 100 : 0;
      if (pvpsB3 > 0 && pvpsDelta3 <= ANOMALY_SHORT_ENGAGEMENT_DROP_PCT) {
        out.push({
          id: "anomaly:pvps:3d",
          severity: "low",
          title: `Engagement depth decreased ${Math.abs(pvpsDelta3).toFixed(1)}% (3-day comparison)`,
          description: `Pageviews/session last 3d ${pvpsA3.toFixed(2)} vs prior 3d ${pvpsB3.toFixed(2)}. Short window — monitor for confirmation.`,
          recommendation: "Review landing page relevance and mobile UX.",
        });
      }

      const sessionsDelta3 = insightsRollups.deltas.sessions3;
      const revenueDelta3 = insightsRollups.deltas.revenue3;
      const convDelta3 = insightsRollups.deltas.conversions3;

      if (sessionsDelta3 <= ANOMALY_SHORT_SESSIONS_DROP_PCT && insightsRollups.prior3.sessions > 0) {
        out.push({
          id: "anomaly:sessions:3d",
          severity: "medium",
          title: `Sessions dropped ${Math.abs(sessionsDelta3).toFixed(1)}% (3-day comparison)`,
          description: `Last 3d: ${formatNumber(insightsRollups.last3.sessions)} vs prior 3d: ${formatNumber(insightsRollups.prior3.sessions)}. Short window — monitor for confirmation.`,
          recommendation: "Check campaign budgets and traffic sources for recent changes.",
        });
      }

      if (revenueDelta3 <= ANOMALY_SHORT_REVENUE_DROP_PCT && insightsRollups.prior3.revenue > 0) {
        out.push({
          id: "anomaly:revenue:3d",
          severity: "medium",
          title: `Revenue dropped ${Math.abs(revenueDelta3).toFixed(1)}% (3-day comparison)`,
          description: `Last 3d: ${formatMoney(insightsRollups.last3.revenue)} vs prior 3d: ${formatMoney(insightsRollups.prior3.revenue)}. Short window — monitor for confirmation.`,
          recommendation: "Investigate conversion rate and AOV changes.",
        });
      }

      if (convDelta3 <= ANOMALY_SHORT_CONVERSIONS_DROP_PCT && insightsRollups.prior3.conversions > 0) {
        out.push({
          id: "anomaly:conversions:3d",
          severity: "medium",
          title: `Conversions dropped ${Math.abs(convDelta3).toFixed(1)}% (3-day comparison)`,
          description: `Last 3d: ${formatNumber(insightsRollups.last3.conversions)} vs prior 3d: ${formatNumber(insightsRollups.prior3.conversions)}. Short window — monitor for confirmation.`,
          recommendation: "Check conversion event configuration and traffic quality.",
        });
      }

      // Positive signals (3d) — only sessions, with higher threshold
      if (sessionsDelta3 >= 25 && insightsRollups.prior3.sessions > 20) {
        out.push({
          id: "positive:sessions:3d",
          severity: "low",
          title: `Sessions up ${sessionsDelta3.toFixed(1)}% (3-day comparison)`,
          description: `Last 3d: ${formatNumber(insightsRollups.last3.sessions)} vs prior 3d: ${formatNumber(insightsRollups.prior3.sessions)}. Early signal — monitor for sustained trend.`,
        });
      }

      out.push({
        id: "info:short_window",
        severity: "low",
        title: "Using 3-day comparison window (limited history)",
        description: `Only ${dates.length} days of data available. Full 7-day week-over-week analysis will activate after ${INSIGHTS_MIN_HISTORY_DAYS} days. Short-window anomalies use higher thresholds to reduce false positives.`,
      });
    } else if (dates.length > 0) {
      out.push({
        id: "anomaly:not-enough-history",
        severity: "low",
        title: "Anomaly detection needs more history",
        description: `Need at least ${INSIGHTS_SHORT_WINDOW_DAYS} days of daily data for anomaly detection. Available days: ${dates.length}.`,
      });
    }

    // 4) Positive signals that don't depend on daily history
    if (Number(financialROAS || 0) >= POSITIVE_ROAS_STRONG) {
      out.push({
        id: "positive:roas:lifetime",
        severity: "low",
        title: `ROAS is strong at ${Number(financialROAS).toFixed(2)}x`,
        description: `Campaign ROAS is ${Number(financialROAS).toFixed(2)}x to date, well above the 1.0x breakeven point.`,
        recommendation: "Performance is strong. Consider scaling spend on high-ROAS channels or testing new audiences.",
      });
    }

    for (const k of Array.isArray(platformKPIs) ? platformKPIs : []) {
      const deps = getMissingDependenciesForMetric(String((k as any)?.metric || (k as any)?.name || ""));
      if (deps.missing.length > 0) continue;
      const p = computeKpiProgress(k);
      const attPct = p?.attainmentPct ?? 0;
      if (attPct >= POSITIVE_KPI_EXCEEDS_PCT) {
        const metric = String((k as any)?.metric || (k as any)?.name || "KPI");
        out.push({
          id: `positive:kpi:${String((k as any)?.id || metric)}`,
          severity: "low",
          title: `${String((k as any)?.name || metric)} exceeds target by ${(attPct - 100).toFixed(0)}%`,
          description: (() => {
            const unit = String((k as any)?.unit || "%");
            const suffix = unit === "%" ? "%" : "";
            const prefix = unit === "$" ? "$" : "";
            const curFmt = `${prefix}${formatNumberByUnit(String(getLiveKpiValue(k) || "0"), unit)}${suffix}`;
            const tgtFmt = `${prefix}${formatNumberByUnit(String((getKpiEffectiveTarget(k) as any)?.effectiveTarget ?? (k as any)?.targetValue ?? ""), unit)}${suffix}`;
            return `Current ${curFmt} vs target ${tgtFmt}.`;
          })(),
          recommendation: "This KPI is performing well. Consider raising the target or reallocating budget toward underperforming KPIs.",
        });
      }
    }

    // 5) Informational insights — always fire when data exists, even without KPIs/Benchmarks
    const availDays = insightsRollups?.availableDays || 0;
    if (availDays >= 7) {
      const r7 = insightsRollups.last7;
      const avgDailySessions = r7.sessions > 0 ? Math.round(r7.sessions / Math.min(r7.days, 7)) : 0;
      const avgDailyConversions = r7.conversions > 0 ? Math.round((r7.conversions / Math.min(r7.days, 7)) * 10) / 10 : 0;
      const cr7 = r7.sessions > 0 ? ((r7.conversions / r7.sessions) * 100).toFixed(2) : "0";
      const engRate7 = r7.engagementRate > 0 ? r7.engagementRate.toFixed(1) : null;

      if (avgDailySessions > 0) {
        out.push({
          id: "info:avg_sessions",
          severity: "low",
          title: `Average daily sessions: ${formatNumber(avgDailySessions)}`,
          description: `Over the last 7 days, your campaign averaged ${formatNumber(avgDailySessions)} sessions per day with a ${cr7}% conversion rate.`,
          recommendation: avgDailyConversions > 0
            ? `${avgDailyConversions} conversions/day average. Create KPIs to track whether this meets your goals.`
            : "Set up conversion tracking and KPIs to measure campaign effectiveness.",
        });
      }

      if (engRate7 && Number(engRate7) > 0) {
        out.push({
          id: "info:engagement_rate",
          severity: "low",
          title: `Engagement rate: ${engRate7}%`,
          description: `${engRate7}% of sessions in the last 7 days were engaged (active interaction beyond bounce). ${Number(engRate7) >= 60 ? "This is a healthy engagement level." : Number(engRate7) >= 40 ? "Moderate engagement — room for improvement." : "Low engagement — consider reviewing landing page relevance."}`,
        });
      }

      // Top channel insight (from channelAnalysis)
      if (channelAnalysis && channelAnalysis.topSessionChannel && channelAnalysis.channelCount >= 2) {
        const ch = channelAnalysis.topSessionChannel;
        const share = channelAnalysis.topSessionShare;
        out.push({
          id: "info:top_channel",
          severity: "low",
          title: `Top channel: ${ch.label} (${share.toFixed(0)}% of sessions)`,
          description: `Your leading traffic source is ${ch.label} with ${formatNumber(ch.sessions)} sessions across ${channelAnalysis.channelCount} channels. ${share > 70 ? "High concentration — consider diversifying traffic sources." : "Healthy channel mix."}`,
          recommendation: channelAnalysis.lowestCRChannel
            ? `Lowest-converting channel: ${channelAnalysis.lowestCRChannel.label} at ${formatPct(channelAnalysis.lowestCRChannel.cr)} CR. Investigate landing page alignment.`
            : undefined,
        });
      }
    }

    // Revenue summary (fires when revenue exists, regardless of KPIs)
    if (Number(financialRevenue || 0) > 0 && availDays >= 7) {
      const avgDailyRev = Number(financialRevenue) / Math.max(availDays, 1);
      out.push({
        id: "info:revenue_summary",
        severity: "low",
        title: `Revenue: ${formatMoney(Number(financialRevenue))} to date`,
        description: `Averaging ~${formatMoney(avgDailyRev)}/day over ${availDays} days.${Number(financialSpend) > 0 ? ` ROAS: ${Number(financialROAS).toFixed(2)}x.` : ""}`,
        recommendation: Number(financialSpend) > 0 && Number(financialROAS) < 1
          ? "ROAS is below break-even. Review spend allocation and conversion paths."
          : !Number(financialSpend) ? "Add spend data to calculate ROAS and ROI." : undefined,
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
    insightsRollups,
    channelAnalysis,
  ]);

  // Collect GA4 campaign names from all imported campaigns (for filtering Ad Comparison)
  const normalizeCampaignKey = (value: any) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

  const importedGA4CampaignNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of (allCampaigns || [])) {
      const filters = parseStoredGa4CampaignFilter((c as any)?.ga4CampaignFilter);
      for (const f of filters) {
        const key = normalizeCampaignKey(f);
        if (key) names.add(key);
      }
    }
    return names;
  }, [allCampaigns]);

  // Aggregate breakdown rows by campaign name for Campaign Performance & Campaign Comparison
  const campaignBreakdownAgg = useMemo(() => {
    const rows = Array.isArray(ga4Breakdown?.rows) ? ga4Breakdown.rows : [];
    const byName = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number }>();
    let rawTotalSessions = 0, rawTotalUsers = 0, rawTotalConversions = 0, rawTotalRevenue = 0;
    for (const r of rows) {
      const name = String((r as any)?.campaign || "(not set)").trim();
      const existing = byName.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
      const s = Number((r as any)?.sessions || 0);
      const u = Number((r as any)?.users || 0);
      const c = Number((r as any)?.conversions || 0);
      const rev = Number((r as any)?.revenue || 0);
      existing.sessions += s;
      existing.users += u;
      existing.conversions += c;
      existing.revenue += rev;
      rawTotalSessions += s;
      rawTotalUsers += u;
      rawTotalConversions += c;
      rawTotalRevenue += rev;
      byName.set(name, existing);
    }
    const scaleIntsExactly = (items: Array<{ value: number }>, target: number) => {
      const safeTarget = Math.max(0, Math.round(Number(target || 0)));
      const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0);
      if (total <= 0) return items.map(() => 0);
      const raw = items.map((item) => (Math.max(0, Number(item.value || 0)) * safeTarget) / total);
      const base = raw.map((value) => Math.floor(value));
      let remainder = safeTarget - base.reduce((sum, value) => sum + value, 0);
      const order = raw
        .map((value, index) => ({ index, frac: value - base[index] }))
        .sort((a, b) => b.frac - a.frac);
      for (let i = 0; i < order.length && remainder > 0; i += 1, remainder -= 1) {
        base[order[i].index] += 1;
      }
      return base;
    };

    const filteredRows = Array.from(byName.values())
      .filter(c => importedGA4CampaignNames.size === 0 || importedGA4CampaignNames.has(normalizeCampaignKey(c.name)));

    const scaledSessions = scaleIntsExactly(filteredRows.map(c => ({ value: c.sessions })), breakdownTotals.sessions);
    const scaledUsers = scaleIntsExactly(filteredRows.map(c => ({ value: c.users })), breakdownTotals.users);
    const scaledConversions = scaleIntsExactly(filteredRows.map(c => ({ value: c.conversions })), breakdownTotals.conversions);
    const revScale = rawTotalRevenue > 0 ? breakdownTotals.revenue / rawTotalRevenue : 1;

    return filteredRows
      .map((c, index) => {
        const nextSessions = scaledSessions[index] || 0;
        const nextUsers = scaledUsers[index] || 0;
        const nextConversions = scaledConversions[index] || 0;
        const scaledRevenue = Number((c.revenue * revScale).toFixed(2));
        return {
          ...c,
          sessions: nextSessions,
          conversions: nextConversions,
          revenue: scaledRevenue,
          users: nextUsers,
          conversionRate: nextSessions > 0 ? (nextConversions / nextSessions) * 100 : 0,
          revenuePerSession: nextSessions > 0 ? scaledRevenue / nextSessions : 0,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);
  }, [ga4Breakdown, importedGA4CampaignNames, breakdownTotals]);

  const campaignBreakdownMatchedExternalRevenue = useMemo(() => {
    const rowNameByKey = new Map<string, string>();
    for (const row of campaignBreakdownAgg) {
      const key = normalizeCampaignKey(row.name);
      if (key) rowNameByKey.set(key, row.name);
    }
    const matched = new Map<string, number>();
    for (const source of revenueDisplaySources) {
      const rawCfg = (source as any)?.mappingConfig;
      const cfg = typeof rawCfg === "string" ? (() => { try { return JSON.parse(rawCfg); } catch { return null; } })() : rawCfg;
      const totals = Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
      for (const item of totals) {
        const key = normalizeCampaignKey(item?.campaignValue);
        const revenue = Number(item?.revenue || 0);
        const rowName = rowNameByKey.get(key);
        if (rowName && revenue > 0) matched.set(rowName, (matched.get(rowName) || 0) + revenue);
      }
    }
    return matched;
  }, [campaignBreakdownAgg, revenueDisplaySources]);

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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Campaign not found</h2>
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
      <div className="min-h-screen bg-background">
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
                  <h1 className="text-3xl font-bold text-foreground">Google Analytics Metrics</h1>
                  <p className="text-muted-foreground/70 mt-1">for {campaign.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                  <SiGoogle className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Connect Google Analytics</h2>
                <p className="text-muted-foreground/70 mb-8 max-w-md">
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
    <div className="min-h-screen bg-background">
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
                    <h1 className="text-3xl font-bold text-foreground">Google Analytics</h1>
                  </div>
                  <p className="text-muted-foreground/70">Detailed metrics for {campaign.name}</p>

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
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground/70"
                        title={selectedGa4CampaignFilterList.slice(3).join(", ")}
                      >
                        +{selectedGa4CampaignFilterList.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground/70">
              <span className="font-medium text-muted-foreground/60">Data:</span> {provenanceProperty}
              {provenancePropertyId ? ` (Property ID: ${provenancePropertyId})` : ""}
              {" • "}
              <span className="font-medium text-muted-foreground/60">Report date (UTC):</span> {ga4ReportDate || "—"}
              {(
                (Array.isArray(selectedGa4CampaignFilterList) && selectedGa4CampaignFilterList.length > 0) ||
                provenanceCampaignFilter
              ) ? (
                <>
                  {" • "}
                  <span className="font-medium text-muted-foreground/60">Campaigns:</span>{" "}
                  {selectedGa4CampaignFilterList.length} selected
                </>
              ) : null}
              {provenanceLastUpdated ? (
                <>
                  {" • "}
                  <span className="font-medium text-muted-foreground/60">Last updated:</span>{" "}
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
                        : 'border-border bg-muted'
                        }`}
                      data-testid={`property-card-${connection.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-foreground">
                              {connection.displayName || connection.propertyName}
                            </h4>
                            {connection.isPrimary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground/70 mb-1">
                            Property ID: {connection.propertyId}
                          </p>
                          {connection.websiteUrl && (
                            <p className="text-sm text-muted-foreground/70 mb-2">
                              {connection.websiteUrl}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
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
                                        method: 'DELETE',
                                        credentials: 'include',
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
                <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
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

                {/* Run Refresh button — visible for any connected GA4 property (hide behind admin flag for production launch) */}
                {selectedGA4PropertyId && (
                  <div className="flex justify-end -mt-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="run-refresh-btn"
                      onClick={() => mockRefreshMutation.mutate()}
                      disabled={mockRefreshMutation.isPending}
                    >
                      {mockRefreshMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      {mockRefreshMutation.isPending ? "Refreshing..." : "Run Refresh"}
                    </Button>
                  </div>
                )}

                {ga4Error && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Failed to load GA4 data. Metrics shown may be stale or incomplete. Try refreshing the page.</span>
                  </div>
                )}

                <TabsContent value="overview" className="fade-in">
                  <div className="space-y-8">
                    {/* Summary Cards */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-foreground">Summary</h3>
                        <p className="text-sm text-muted-foreground/70">Key performance metrics for your GA4 property</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Sessions</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatNumber(breakdownTotals.sessions || ga4Metrics?.sessions || 0)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Users</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatNumber(breakdownTotals.users || ga4Metrics?.users || 0)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Conversions</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatNumber(financialConversions || 0)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Engagement Rate</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatPercentage(rateToPercent(dailySummedTotals.engagementRate || ga4Metrics?.engagementRate || 0))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Conv. Rate</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatPct((breakdownTotals.sessions || 0) > 0
                                ? ((breakdownTotals.conversions || 0) / (breakdownTotals.sessions || 1)) * 100
                                : 0)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Revenue & Financial */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-foreground">Revenue & Financial</h3>
                        <p className="text-sm text-muted-foreground/70">Financial performance and return on investment</p>
                      </div>
                      {/* Revenue & Spend cards — always show when any financial data exists */}
                      <div className="space-y-5">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Revenue</h4>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Total Revenue — with "+" add, per-source microcopy, edit/trash (mirrors Spend pattern) */}
                        <Card>
                          <CardContent className="p-5">
                            {revenueDisplaySources.length > 0 ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-muted-foreground/70">Total Revenue</p>
                                  <button
                                    onClick={() => { setEditingRevenueSource(null); setShowRevenueDialog(true); }}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/60 transition-colors"
                                    title="Add revenue source"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="text-2xl font-bold text-foreground mt-1">
                                  {formatMoney(Number(financialRevenue || 0))}
                                </p>
                                <table className="w-full mt-2 pt-2 border-t border-slate-100 text-xs">
                                  <tbody>
                                    {ga4RevenueForFinancials > 0 && (
                                      <tr>
                                        <td className="text-muted-foreground/70 py-0.5 pr-2">GA4 Revenue</td>
                                        <td className="text-right font-medium tabular-nums text-foreground/80 py-0.5 whitespace-nowrap">{formatMoney(ga4RevenueForFinancials)}</td>
                                        <td className="w-[36px]"></td>
                                      </tr>
                                    )}
                                    {revenueDisplaySources.map((s: any) => {
                                      const cfg = typeof s.mappingConfig === "string" ? (() => { try { return JSON.parse(s.mappingConfig); } catch { return null; } })() : s.mappingConfig;
                                      const isCrm = s.sourceType === "hubspot" || s.sourceType === "salesforce";
                                      const dateLabel = isCrm && cfg?.dateField && cfg.dateField !== "closedate" && cfg.dateField !== "CloseDate"
                                        ? ` · ${cfg.dateField === "hs_lastmodifieddate" || cfg.dateField === "LastModifiedDate" ? "Modified Date" : cfg.dateField === "createdate" || cfg.dateField === "CreatedDate" ? "Created Date" : "Close Date"}`
                                        : "";
                                      return (
                                        <tr key={s.sourceId} className="group/rev">
                                          <td className="text-muted-foreground/70 py-0.5 pr-2 max-w-[120px] truncate" title={(s.displayName || revenueSourceTypeLabel(s.sourceType)) + dateLabel}>
                                            {s.displayName || revenueSourceTypeLabel(s.sourceType)}{dateLabel}
                                          </td>
                                          <td className="text-right font-medium tabular-nums text-foreground/80 py-0.5 whitespace-nowrap">
                                            {s.revenue != null ? formatMoney(s.revenue) : formatMoney(Number(financialRevenue || 0))}
                                          </td>
                                          <td className="w-[36px] text-right whitespace-nowrap">
                                            <button
                                              onClick={() => { setEditingRevenueSource({ id: s.sourceId, sourceType: s.sourceType, displayName: s.displayName, mappingConfig: s.mappingConfig, revenue: s.revenue }); setShowRevenueDialog(true); }}
                                              className="p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground opacity-0 group-hover/rev:opacity-100 transition-all"
                                              title="Edit"
                                            ><Edit className="h-3 w-3" /></button>
                                            <button
                                              onClick={() => setDeletingRevenueSourceId(s.sourceId)}
                                              className="p-0.5 rounded hover:bg-red-50 text-muted-foreground/60 hover:text-red-600 opacity-0 group-hover/rev:opacity-100 transition-all"
                                              title="Delete"
                                            ><Trash2 className="h-3 w-3" /></button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-muted-foreground/70">Total Revenue</p>
                                  <button
                                    onClick={() => { setEditingRevenueSource(null); setShowRevenueDialog(true); }}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/60 transition-colors"
                                    title="Add revenue source"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="text-2xl font-bold text-foreground mt-1">
                                  {formatMoney(Number(financialRevenue || 0))}
                                </p>
                                {ga4RevenueForFinancials > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-100">
                                    <div className="grid grid-cols-[1fr_auto] items-center text-xs gap-x-3">
                                      <span className="text-muted-foreground/70 truncate">GA4 Revenue</span>
                                      <span className="text-foreground/80 font-medium tabular-nums text-right whitespace-nowrap">{formatMoney(ga4RevenueForFinancials)}</span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </CardContent>
                        </Card>
                        {/* Latest Day Revenue — GA4 native + imported sources for most recent complete day */}
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Latest Day Revenue</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatMoney(
                                Number(ga4LatestDayRevenue || 0)
                                + Number(revenueDailyResp?.totalRevenue || 0)
                              )}
                            </p>
                          </CardContent>
                        </Card>
                        {pipelineProxyData?.success && (
                          <Card>
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-muted-foreground/70">Pipeline Proxy</p>
                                <Target className="h-4 w-4 text-muted-foreground/70" />
                              </div>
                              <p className="text-2xl font-bold text-foreground mt-1">
                                {formatMoney(Number(pipelineProxyData.totalToDate || 0))}
                              </p>
                              <div className="text-xs text-muted-foreground/70 mt-1 space-y-2">
                                {Array.isArray(pipelineProxyData.providerEntries) && pipelineProxyData.providerEntries.length > 0 ? (
                                  pipelineProxyData.providerEntries.map((entry: any, idx: number) => (
                                    <div key={`${entry?.providerLabel || "provider"}-${idx}`} className="space-y-0.5">
                                      <p className="font-medium text-foreground/90">{entry?.providerLabel || "Provider"}</p>
                                      <p>
                                        {[
                                          Array.isArray(entry?.campaignValues) && entry.campaignValues.length > 0 ? entry.campaignValues.join(", ") : null,
                                          entry?.pipelineStageLabel ? `- ${entry.pipelineStageLabel}` : null,
                                        ].filter(Boolean).join(" ")}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <p>
                                    {[
                                      pipelineProxyData.providerLabel,
                                      pipelineProxyData.pipelineStageLabel,
                                      ...(Array.isArray(pipelineProxyData.pipelineValueRevenueTotals) && pipelineProxyData.pipelineValueRevenueTotals.length > 0
                                        ? pipelineProxyData.pipelineValueRevenueTotals.map((item: any) => String(item?.campaignValue || "").trim()).filter(Boolean)
                                        : Array.isArray(pipelineProxyData.selectedValues) && pipelineProxyData.selectedValues.length > 0
                                          ? [`Selected values: ${pipelineProxyData.selectedValues.join(", ")}`]
                                          : []),
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Spend</h4>
                          <div className="grid gap-4 md:grid-cols-2">
                        {/* Total Spend */}
                        <Card>
                          <CardContent className="p-5">
                            {spendDisplaySources.length > 0 ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-muted-foreground/70">Total Spend</p>
                                  <button
                                    onClick={() => { setEditingSpendSource(null); setShowSpendDialog(true); }}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/60 transition-colors"
                                    title="Add spend source"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="text-2xl font-bold text-foreground mt-1">
                                  {formatMoney(Number(financialSpend || 0))}
                                </p>
                                {spendDisplaySources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                  {spendDisplaySources.map((s: any) => (
                                    <div key={s.sourceId} className="flex items-center justify-between text-xs group/spend">
                                      <span className="text-muted-foreground/70 min-w-[60px] truncate">{s.displayName || spendSourceTypeLabel(s.sourceType)}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-foreground/80/60 font-medium tabular-nums">
                                          {s.spend != null ? formatMoney(s.spend) : formatMoney(Number(financialSpend || 0))}
                                        </span>
                                        <button
                                          onClick={() => {
                                            setEditingSpendSource({ id: s.sourceId, sourceType: s.sourceType, displayName: s.displayName, mappingConfig: s.mappingConfig });
                                            setShowSpendDialog(true);
                                          }}
                                          className="p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground dark:hover:text-muted-foreground/60 opacity-0 group-hover/spend:opacity-100 transition-all"
                                          title="Edit spend source"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => setDeletingSpendSourceId(s.sourceId)}
                                          className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/60 hover:text-red-600 opacity-0 group-hover/spend:opacity-100 transition-all"
                                          title="Remove spend source"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-muted-foreground/70">Total Spend</p>
                                  <button
                                    onClick={() => { setEditingSpendSource(null); setShowSpendDialog(true); }}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/60 transition-colors"
                                    title="Add spend source"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="text-2xl font-bold text-foreground mt-1">{formatMoney(0)}</p>
                              </>
                            )}
                          </CardContent>
                        </Card>
                        {/* Latest Day Spend — checks today and yesterday for spend records */}
                        <Card>
                          <CardContent className="p-5">
                            <p className="text-sm font-medium text-muted-foreground/70">Latest Day Spend</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                              {formatMoney(Number(spendDailyResp?.totalSpend || 0))}
                            </p>
                          </CardContent>
                        </Card>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Performance</h4>
                      {/* Profit/ROAS/ROI/CPA — only when both revenue and spend exist */}
                      {financialSpend > 0 && financialRevenue > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4">
                          <Card>
                            <CardContent className="p-5">
                              <p className="text-sm font-medium text-muted-foreground/70">Profit</p>
                              <p className={`text-2xl font-bold mt-1 ${(financialRevenue - financialSpend) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatMoney(financialRevenue - financialSpend)}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">Revenue − Spend</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <p className="text-sm font-medium text-muted-foreground/70">ROAS</p>
                              <p className="text-2xl font-bold text-foreground mt-1">
                                {financialROAS.toFixed(2)}x
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">Revenue ÷ Spend</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <p className="text-sm font-medium text-muted-foreground/70">ROI</p>
                              <p className="text-2xl font-bold text-foreground mt-1">
                                {formatPercentage(financialROI)}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">(Revenue − Spend) ÷ Spend</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <p className="text-sm font-medium text-muted-foreground/70">CPA</p>
                              <p className="text-2xl font-bold text-foreground mt-1">
                                {Number(financialConversions || 0) > 0 ? formatMoney(Number(financialCPA || 0)) : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                Spend ÷ Conversions{Number(financialConversions || 0) <= 0 ? " (needs conversions > 0)" : ""}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      ) : financialSpend <= 0 ? (
                        <div className="rounded-lg border border-border bg-muted/40 p-4">
                          <p className="text-sm font-medium text-foreground">Add spend to unlock ROAS / ROI / CPA</p>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            To calculate ROAS/ROI/CPA, add spend from any source (ad platform, spreadsheet, or manual entry).
                          </p>
                          <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={() => setShowSpendDialog(true)}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Spend
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    </div>

                    {/* Campaign Breakdown */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-foreground">Campaign Breakdown</h3>
                        <p className="text-sm text-muted-foreground/70">Performance metrics aggregated by UTM campaign</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {breakdownLoading ? (
                            <div className="h-32 bg-muted rounded animate-pulse" />
                          ) : campaignBreakdownAgg.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <div className="max-h-[420px] overflow-y-auto">
                                <table className="w-full text-sm table-fixed">
                                  <thead className="sticky top-0 z-10 bg-muted border-b">
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
                                    {campaignBreakdownAgg.map((c, idx) => {
                                      const revenue = Number((c.revenue + (campaignBreakdownMatchedExternalRevenue.get(c.name) || 0)).toFixed(2));
                                      return (
                                        <tr key={c.name || idx} className="border-b last:border-b-0">
                                          <td className="px-2 py-2 truncate" title={c.name}>{c.name}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.sessions)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.users)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{formatNumber(c.conversions)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{formatPct(c.conversionRate)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{formatMoney(revenue)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground/70">
                              No campaign breakdown data available for this date range.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Landing Pages */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-foreground">Landing Pages</h3>
                        <p className="text-sm text-muted-foreground/70">Cumulative for this GA4 property and this campaign&apos;s selected GA4 campaign scope — Revenue is GA4-native only, not campaign-matched imported revenue</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {Array.isArray(ga4LandingPages?.rows) && ga4LandingPages.rows.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-muted border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[34%]">Landing page</th>
                                    <th className="text-left p-3 w-[16%]">Source/Medium</th>
                                    <th className="text-right p-3">Sessions</th>
                                    <th className="text-right p-3">
                                      <div className="flex items-center justify-end gap-1">
                                        Users
                                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/70" title="Non-additive: Unique users can appear on multiple landing pages" />
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
                                          <div className="font-medium text-foreground truncate" title={String(r?.landingPage || "(not set)")}>
                                            {String(r?.landingPage || "(not set)")}
                                          </div>
                                        </td>
                                        <td className="p-3 text-muted-foreground/70">
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
                            <div className="text-sm text-muted-foreground/70">
                              No landing page data available yet for this property/campaign selection.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Conversion Events */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-foreground">Conversion Events</h3>
                        <p className="text-sm text-muted-foreground/70">Cumulative for this GA4 property and this campaign&apos;s selected GA4 campaign scope — Revenue is GA4-native only, not campaign-matched imported revenue</p>
                      </div>
                      <Card>
                        <CardContent className="p-6">
                          {Array.isArray(ga4ConversionEvents?.rows) && ga4ConversionEvents.rows.length > 0 ? (
                            <div className="overflow-hidden border rounded-md">
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-muted border-b">
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
                                        <div className="font-medium text-foreground truncate" title={String(r?.eventName || "(not set)")}>
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
                            <div className="text-sm text-muted-foreground/70">
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
                    initialSource={editingSpendSource || undefined}
                    onProcessed={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-breakdown`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-daily`], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-breakdown`], exact: false });
                    }}
                  />
                  <AddRevenueWizardModal
                    campaignId={campaignId as string}
                    open={showRevenueDialog}
                    onOpenChange={setShowRevenueDialog}
                    currency={(campaign as any)?.currency || "USD"}
                    dateRange={dateRange}
                    initialSource={editingRevenueSource || undefined}
                    platformContext="ga4"
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
                      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-breakdown`], exact: false });
                      queryClient.invalidateQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
                      queryClient.invalidateQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                      queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-breakdown`], exact: false });
                      queryClient.refetchQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
                      queryClient.refetchQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
                    }}
                  />
                  <AlertDialog open={!!deletingSpendSourceId} onOpenChange={(open) => { if (!open) setDeletingSpendSourceId(null); }}>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">Remove spend source?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground/70">
                          This will remove this spend source. Total Spend will be recalculated.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={async () => {
                            try {
                              const resp = await fetch(`/api/campaigns/${campaignId}/spend-sources/${deletingSpendSourceId}`, { method: "DELETE", credentials: "include" });
                              const json = await resp.json().catch(() => null);
                              if (!resp.ok || json?.success === false) {
                                throw new Error(json?.error || "Failed to remove spend source");
                              }
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-breakdown`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-daily`], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-to-date`], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-breakdown`], exact: false });
                              toast({ title: "Spend source removed", description: "Total Spend has been recalculated." });
                            } catch (e: any) {
                              console.error(e);
                              toast({ title: "Delete failed", description: e?.message || "Please try again.", variant: "destructive" });
                            } finally {
                              setDeletingSpendSourceId(null);
                            }
                          }}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog open={!!deletingRevenueSourceId} onOpenChange={(open) => { if (!open) setDeletingRevenueSourceId(null); }}>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">Remove revenue source?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground/70">
                          This will remove this revenue source. Total Revenue will be recalculated.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={async () => {
                            try {
                              const resp = await fetch(`/api/campaigns/${campaignId}/revenue-sources/${deletingRevenueSourceId}`, { method: "DELETE", credentials: "include" });
                              const json = await resp.json().catch(() => null);
                              if (!resp.ok || json?.success === false) {
                                throw new Error(json?.error || "Failed to remove revenue source");
                              }
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-breakdown`], exact: false });
                              queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-daily`], exact: false });
                              queryClient.invalidateQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
                              queryClient.invalidateQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
                              queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-breakdown`], exact: false });
                              queryClient.refetchQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
                              queryClient.refetchQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
                              toast({ title: "Revenue source removed", description: "Total Revenue has been recalculated." });
                            } catch (e: any) {
                              console.error(e);
                              toast({ title: "Delete failed", description: e?.message || "Please try again.", variant: "destructive" });
                            } finally {
                              setDeletingRevenueSourceId(null);
                            }
                          }}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                <TabsContent value="kpis" className="fade-in">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">Key Performance Indicators</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
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
                              <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* KPI performance tracker (exec snapshot) */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground/70">Total KPIs</p>
                                      <p className="text-2xl font-bold text-foreground">{kpiTracker.total}</p>
                                    </div>
                                    <Target className="w-8 h-8 text-purple-500" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground/70">Above Target</p>
                                      <p className="text-2xl font-bold text-green-600">{kpiTracker.above}</p>
                                      <p className="text-xs text-muted-foreground">more than +5% above target</p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-green-500" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground/70">On Track</p>
                                      <p className="text-2xl font-bold text-blue-600">{kpiTracker.near}</p>
                                      <p className="text-xs text-muted-foreground">within ±5% of target</p>
                                    </div>
                                    <CheckCircle2 className="w-8 h-8 text-blue-500" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground/70">Below Target</p>
                                      <p className="text-2xl font-bold text-red-600">{kpiTracker.below}</p>
                                      <p className="text-xs text-muted-foreground">more than −5% below target</p>
                                    </div>
                                    <AlertCircle className="w-8 h-8 text-red-500" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground/70">Avg. Progress</p>
                                      <p className="text-2xl font-bold text-foreground">
                                        {kpiTracker.avgPct.toFixed(1)}%
                                      </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-violet-600" />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {kpiTracker.blocked > 0 ? (
                              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-4">
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground">Some KPIs are Blocked</div>
                                  <div className="text-sm text-foreground/80/60 mt-1">
                                    {kpiTracker.blocked} KPI{kpiTracker.blocked === 1 ? "" : "s"} can’t be evaluated because Spend and/or Revenue was removed.
                                    Blocked KPIs are excluded from performance scoring to avoid misleading executives.
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {platformKPIs.length === 0 ? (
                              <div className="text-center text-muted-foreground/70 py-8">
                                <Target className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs yet</h3>
                                <p className="text-muted-foreground/70 mb-4">
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

                                  return (
                                    <Card key={kpi.id} className="border-border">
                                      <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                              <Icon className={`w-5 h-5 ${color}`} />
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-base font-semibold text-foreground">
                                                  {kpi.name}
                                                </h4>
                                                {/* Alert indicators (matching LinkedIn KPI cards) */}
                                                {kpi.alertsEnabled && (
                                                  <UITooltip>
                                                    <TooltipTrigger asChild>
                                                      <div className="cursor-help">
                                                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                      </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-slate-900 text-white border-slate-700">
                                                      <p className="text-sm">Alerts enabled — threshold: {kpi.alertThreshold ? `${kpi.alertCondition || "below"} ${Number(kpi.alertThreshold).toLocaleString()}` : "not set"}</p>
                                                    </TooltipContent>
                                                  </UITooltip>
                                                )}
                                                {kpi.alertsEnabled && !isBlocked && (() => {
                                                  const currentVal = parseFloat(String(getLiveKpiValue(kpi) || "0"));
                                                  const alertThresh = kpi.alertThreshold ? parseFloat(String(kpi.alertThreshold).replace(/,/g, "")) : null;
                                                  const alertCond = kpi.alertCondition || "below";
                                                  if (alertThresh === null || !Number.isFinite(alertThresh)) return null;

                                                  let hasActiveAlert = false;
                                                  switch (alertCond) {
                                                    case "below": hasActiveAlert = currentVal < alertThresh; break;
                                                    case "above": hasActiveAlert = currentVal > alertThresh; break;
                                                    case "equals": hasActiveAlert = Math.abs(currentVal - alertThresh) < 0.01; break;
                                                  }

                                                  return hasActiveAlert ? (
                                                    <UITooltip>
                                                      <TooltipTrigger asChild>
                                                        <div className="relative flex items-center justify-center cursor-help">
                                                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                          <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                                        </div>
                                                      </TooltipTrigger>
                                                      <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                                                        <div className="space-y-2">
                                                          <p className="font-semibold text-red-400">Alert Threshold Breached</p>
                                                          <div className="text-xs space-y-1">
                                                            <p><span className="text-slate-400">Current:</span> {formatValue(getLiveKpiValue(kpi) || "0", kpi.unit)}</p>
                                                            <p><span className="text-slate-400">Threshold:</span> {alertCond} {formatValue(String(alertThresh), kpi.unit)}</p>
                                                          </div>
                                                        </div>
                                                      </TooltipContent>
                                                    </UITooltip>
                                                  ) : null;
                                                })()}
                                                <Badge className="text-xs bg-muted text-foreground/80 dark:text-slate-200 border border-border">
                                                  {String(kpi?.metric || kpi?.name || "Custom")}
                                                </Badge>
                                              </div>
                                              {kpi.description ? (
                                                <p className="text-sm text-muted-foreground/70 mt-1">
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
                                                  alertsEnabled: Boolean(kpi?.alertsEnabled ?? false),
                                                  alertThreshold: kpi?.alertThreshold ? String(kpi.alertThreshold) : "",
                                                  alertCondition: (kpi?.alertCondition || "below") as any,
                                                  alertFrequency: (kpi?.alertFrequency || "daily") as any,
                                                  emailNotifications: Boolean(kpi?.emailNotifications ?? false),
                                                  emailRecipients: String(kpi?.emailRecipients || ""),
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
                                          <div className="bg-muted rounded-lg p-3">
                                            <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current</div>
                                            <div className="text-xl font-bold text-foreground">
                                              {isBlocked ? "—" : formatValue(getLiveKpiValue(kpi) || "0", kpi.unit)}
                                            </div>
                                          </div>
                                          <div className="bg-muted rounded-lg p-3">
                                            <div className="text-sm font-medium text-muted-foreground/70 mb-1">Target</div>
                                            <div className="text-xl font-bold text-foreground">
                                              {formatValue(String(t.effectiveTarget), kpi.unit)}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Progress bar */}
                                        {!isBlocked && p && (
                                          <div className="mt-4 space-y-2">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                              <span>Progress</span>
                                              <span>{formatPct(p.attainmentPct)}</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2">
                                              <div
                                                className={`h-2 rounded-full ${p.progressColor}`}
                                                style={{ width: `${p.fillPct}%` }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {/* Delta vs target */}
                                        {!isBlocked && p && p.effectiveDeltaPct !== null && (
                                          <div className="mt-2 text-xs text-muted-foreground/70">
                                            {(() => {
                                              if (Math.abs(p.effectiveDeltaPct) < 0.0001) return "At target";
                                              const abs = Math.abs(p.effectiveDeltaPct);
                                              const absStr = abs < 1 ? abs.toFixed(1) : String(Math.round(abs));
                                              return p.effectiveDeltaPct > 0
                                                ? `${absStr}% above target`
                                                : `${absStr}% below target`;
                                            })()}
                                          </div>
                                        )}

                                        {isBlocked ? (
                                          <div className="mt-4 text-sm text-muted-foreground/70">
                                            Missing: <span className="font-medium">{deps.missing.join(" + ")}</span>. This KPI is paused until inputs are restored.
                                          </div>
                                        ) : null}
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

                <TabsContent value="benchmarks" className="fade-in">
                  <div className="space-y-6">
                    <AlertDialog open={showDeleteBenchmarkDialog} onOpenChange={setShowDeleteBenchmarkDialog}>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Delete benchmark?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground/70">
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
                        <h3 className="text-lg font-semibold text-foreground">Performance Benchmarks</h3>
                        <p className="text-sm text-muted-foreground/70 mt-1">
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
                              alertsEnabled: false,
                              alertThreshold: "",
                              alertCondition: "below",
                              alertFrequency: "daily",
                              emailNotifications: false,
                              emailRecipients: "",
                            });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => {
                              setEditingBenchmark(null);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Benchmark
                          </Button>
                        </DialogTrigger>
                        {/* Avoid forcing extreme z-index here; it can cause Radix Select menus to render behind the modal. */}
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-6">
                          <DialogClose className="absolute right-4 top-4 rounded-full p-2 bg-muted hover:bg-muted dark:hover:bg-slate-700 transition-colors z-[60]">
                            <X className="h-4 w-4 text-muted-foreground/70" />
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
                            <div className="space-y-3 p-4 bg-muted rounded-lg">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="font-medium text-foreground">Select Benchmark Template</h4>
                                  <p className="text-sm text-muted-foreground/70">
                                    Choose a metric to benchmark, then fill in the benchmark details below.
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { name: "ROAS", metric: "roas", unit: "ratio", description: "Revenue ÷ Spend (e.g., 5.0 = 5x return)" },
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
                                          : "border-border hover:border-blue-300"
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
                                      <div className="font-medium text-sm text-foreground">
                                        {template.name}
                                      </div>
                                      {disabled ? (
                                        <div className="mt-1 text-xs text-muted-foreground/70">
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

                            {/* Benchmark Name */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-foreground/80/60">Benchmark Name *</div>
                              <Input
                                value={newBenchmark.name}
                                onChange={(e) => setNewBenchmark({ ...newBenchmark, name: e.target.value })}
                                placeholder="e.g., Target sessions for this campaign"
                                required
                              />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-foreground/80/60">Description</div>
                              <Textarea
                                value={newBenchmark.description}
                                maxLength={BENCHMARK_DESC_MAX}
                                onChange={(e) => setNewBenchmark({ ...newBenchmark, description: e.target.value.slice(0, BENCHMARK_DESC_MAX) })}
                                rows={3}
                                placeholder="What is this benchmark and why does it matter?"
                              />
                              <div className="text-xs text-muted-foreground/70 text-right">
                                {(newBenchmark.description || "").length}/{BENCHMARK_DESC_MAX}
                              </div>
                            </div>

                            {/* Current Value + Benchmark Value + Unit */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground/80/60">Current Value</div>
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
                                  placeholder="Auto-filled from GA4"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground/80/60">Benchmark Value *</div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={newBenchmark.benchmarkValue}
                                  onChange={(e) => {
                                    setNewBenchmark({
                                      ...newBenchmark,
                                      benchmarkValue: formatNumberWhileTyping(e.target.value, String(newBenchmark.unit || "%")),
                                    });
                                  }}
                                  onBlur={(e) =>
                                    setNewBenchmark((prev) => ({
                                      ...prev,
                                      benchmarkValue: formatNumberByUnit(e.target.value, String(prev.unit || "%")),
                                    }))
                                  }
                                  placeholder="Enter benchmark value"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground/80/60">Unit</div>
                                <Input
                                  value={newBenchmark.unit === SELECT_UNIT ? "" : newBenchmark.unit}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, unit: e.target.value })}
                                  placeholder="%, $, count, etc."
                                />
                              </div>
                            </div>

                            {/* Benchmark Type */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground/80/60">Benchmark Type *</div>
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
                                  <div className="text-sm font-medium text-foreground/80/60">Industry</div>
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
                                  <div className="text-xs text-muted-foreground/70">
                                    Selecting an industry will auto-fill a suggested Benchmark Value for the chosen metric.
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Alert Settings */}
                            <div className="space-y-4 pt-4 border-t">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="ga4-benchmark-alerts-enabled"
                                  checked={newBenchmark.alertsEnabled}
                                  onCheckedChange={(checked) => setNewBenchmark({ ...newBenchmark, alertsEnabled: checked as boolean })}
                                />
                                <Label htmlFor="ga4-benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                                  Enable alerts for this Benchmark
                                </Label>
                              </div>
                              <p className="text-sm text-muted-foreground/70 -mt-2">
                                Receive notifications when this benchmark crosses a threshold you define.
                              </p>

                              {newBenchmark.alertsEnabled && (
                                <div className="space-y-4 pl-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Alert Threshold *</Label>
                                      <Input
                                        type="text"
                                        placeholder="e.g., 80"
                                        inputMode="decimal"
                                        value={newBenchmark.alertThreshold}
                                        onChange={(e) => {
                                          setNewBenchmark({ ...newBenchmark, alertThreshold: formatNumberWhileTyping(e.target.value, String(newBenchmark.unit || "%")) });
                                        }}
                                        onBlur={(e) =>
                                          setNewBenchmark((prev) => ({
                                            ...prev,
                                            alertThreshold: formatNumberByUnit(e.target.value, String(prev.unit || "%")),
                                          }))
                                        }
                                      />
                                      <p className="text-xs text-muted-foreground/70">Value at which to trigger the alert</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Alert When</Label>
                                      <Select value={newBenchmark.alertCondition} onValueChange={(v) => setNewBenchmark({ ...newBenchmark, alertCondition: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent className="z-[10000]">
                                          <SelectItem value="below">Value Goes Below</SelectItem>
                                          <SelectItem value="above">Value Goes Above</SelectItem>
                                          <SelectItem value="equals">Value Equals</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Alert Frequency</Label>
                                      <Select value={newBenchmark.alertFrequency || "daily"} onValueChange={(v) => setNewBenchmark({ ...newBenchmark, alertFrequency: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent className="z-[10000]">
                                          <SelectItem value="immediate">Immediate</SelectItem>
                                          <SelectItem value="daily">Daily</SelectItem>
                                          <SelectItem value="weekly">Weekly</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground/70">
                                        Controls how often you're notified while the alert condition stays true.
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox
                                          id="ga4-benchmark-email-notifications"
                                          checked={!!newBenchmark.emailNotifications}
                                          onCheckedChange={(checked) => setNewBenchmark({ ...newBenchmark, emailNotifications: checked as boolean })}
                                        />
                                        <Label htmlFor="ga4-benchmark-email-notifications" className="cursor-pointer font-medium">
                                          Send email notifications
                                        </Label>
                                      </div>
                                      {newBenchmark.emailNotifications && (
                                        <div className="space-y-2">
                                          <Label>Email addresses *</Label>
                                          <Input
                                            type="text"
                                            placeholder="email1@example.com, email2@example.com"
                                            value={newBenchmark.emailRecipients}
                                            onChange={(e) => setNewBenchmark({ ...newBenchmark, emailRecipients: e.target.value })}
                                          />
                                          <p className="text-xs text-muted-foreground/70">Comma-separated email addresses for alerts.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setShowCreateBenchmark(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                {editingBenchmark ? "Update Benchmark" : "Create Benchmark"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Benchmarks List */}
                    <div className="space-y-4">
                      <Card>
                        <CardContent>
                      {benchmarksLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                              <CardContent className="p-6">
                                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                                <div className="h-8 bg-muted rounded"></div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Benchmarks performance tracker (exec snapshot) */}
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Total Benchmarks</p>
                                    <p className="text-2xl font-bold text-foreground">{benchmarkTracker.total}</p>
                                  </div>
                                  <Target className="w-8 h-8 text-purple-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">On Track</p>
                                    <p className="text-2xl font-bold text-green-600">{benchmarkTracker.onTrack}</p>
                                    <p className="text-xs text-muted-foreground">90% or more of benchmark</p>
                                  </div>
                                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Needs Attention</p>
                                    <p className="text-2xl font-bold text-amber-600">{benchmarkTracker.needsAttention}</p>
                                    <p className="text-xs text-muted-foreground">70% to under 90% of benchmark</p>
                                  </div>
                                  <AlertCircle className="w-8 h-8 text-amber-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Behind</p>
                                    <p className="text-2xl font-bold text-red-600">{benchmarkTracker.behind}</p>
                                    <p className="text-xs text-muted-foreground">below 70% of benchmark</p>
                                  </div>
                                  <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Avg. Progress</p>
                                    <p className="text-2xl font-bold text-foreground">
                                      {benchmarkTracker.avgPct.toFixed(1)}%
                                    </p>
                                  </div>
                                  <TrendingUp className="w-8 h-8 text-violet-600" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {benchmarkTracker.blocked > 0 ? (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-4">
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground">Some Benchmarks are Blocked</div>
                                <div className="text-sm text-foreground/80/60 mt-1">
                                  {benchmarkTracker.blocked} benchmark{benchmarkTracker.blocked === 1 ? "" : "s"} can’t be evaluated because Spend and/or Revenue was removed.
                                  Blocked benchmarks are excluded from performance scoring to avoid misleading executives.
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {benchmarks && benchmarks.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              {benchmarks.map((benchmark) => {
                                const deps = getMissingDependenciesForMetric(String((benchmark as any)?.metric || ""));
                                const isBlocked = deps.missing.length > 0;
                                return (
                                <Card key={benchmark.id} className="border-border">
                                  <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h3 className="font-semibold text-foreground text-lg">{benchmark.name}</h3>
                                          {(benchmark as any)?.metric && (
                                            <Badge variant="outline" className="bg-muted text-foreground/80/60 font-mono">
                                              {getBenchmarkMetricLabel((benchmark as any)?.metric, benchmark.name)}
                                            </Badge>
                                          )}
                                          {(benchmark as any).alertsEnabled && (
                                            <UITooltip>
                                              <TooltipTrigger asChild>
                                                <div className="cursor-help">
                                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent className="bg-slate-900 text-white border-slate-700">
                                                <p className="text-sm">Alerts enabled — threshold: {(benchmark as any).alertThreshold ? `${(benchmark as any).alertCondition || "below"} ${Number((benchmark as any).alertThreshold).toLocaleString()}` : "not set"}</p>
                                              </TooltipContent>
                                            </UITooltip>
                                          )}
                                          {(benchmark as any).alertsEnabled && !isBlocked && (() => {
                                            const currentVal = parseFloat(String(getBenchmarkDisplayCurrentValue(benchmark) || "0").replace(/,/g, ""));
                                            const alertThresh = (benchmark as any).alertThreshold
                                              ? parseFloat(String((benchmark as any).alertThreshold).replace(/,/g, ""))
                                              : null;
                                            const alertCond = (benchmark as any).alertCondition || "below";
                                            if (alertThresh === null || !Number.isFinite(alertThresh)) return null;
                                            let hasActiveAlert = false;
                                            switch (alertCond) {
                                              case "below": hasActiveAlert = currentVal < alertThresh; break;
                                              case "above": hasActiveAlert = currentVal > alertThresh; break;
                                              case "equals": hasActiveAlert = Math.abs(currentVal - alertThresh) < 0.01; break;
                                            }
                                            return hasActiveAlert ? (
                                              <UITooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="relative flex items-center justify-center cursor-help">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                                                  <div className="space-y-2">
                                                    <p className="font-semibold text-red-400">Alert Threshold Breached</p>
                                                    <div className="text-xs space-y-1">
                                                      <p><span className="text-slate-400">Current:</span> {formatBenchmarkValue(getBenchmarkDisplayCurrentValue(benchmark), benchmark.unit)}</p>
                                                      <p><span className="text-slate-400">Threshold:</span> {alertCond} {formatBenchmarkValue(String(alertThresh), benchmark.unit)}</p>
                                                    </div>
                                                  </div>
                                                </TooltipContent>
                                              </UITooltip>
                                            ) : null;
                                          })()}
                                        </div>
                                        {benchmark.description ? (
                                          <div className="text-sm text-muted-foreground/70 mt-1">
                                            {benchmark.description}
                                          </div>
                                        ) : null}
                                        {benchmark.industry && (
                                          <div className="text-xs text-muted-foreground/70 mt-1">
                                            Industry: {benchmark.industry}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleEditBenchmark(benchmark)}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="bg-card border-border">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle className="text-foreground">Delete Benchmark</AlertDialogTitle>
                                              <AlertDialogDescription className="text-muted-foreground/70">
                                                Are you sure you want to delete "{benchmark.name}"? This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => deleteBenchmarkMutation.mutate(String(benchmark.id))}
                                                className="bg-red-600 hover:bg-red-700 text-white"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>

                                    {/* 3-column metrics grid */}
                                    <div className="grid gap-4 md:grid-cols-3 mb-4">
                                      <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current Value</div>
                                        <div className="text-lg font-bold text-foreground">
                                          {isBlocked ? "—" : formatBenchmarkValue(getBenchmarkDisplayCurrentValue(benchmark), benchmark.unit)}
                                        </div>
                                      </div>
                                      <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-sm font-medium text-muted-foreground/70 mb-1">Benchmark Value</div>
                                        <div className="text-lg font-bold text-foreground">
                                          {formatBenchmarkValue(benchmark.benchmarkValue, benchmark.unit)}
                                        </div>
                                      </div>
                                      <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-sm font-medium text-muted-foreground/70 mb-1">Source</div>
                                        <div className="text-lg font-bold text-foreground">
                                          {benchmark.industry ? `Industry (${benchmark.industry})` : benchmark.source || "Custom"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Progress + Performance */}
                                    {(() => {
                                      if (isBlocked) {
                                        return (
                                          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                                            <div className="text-sm text-muted-foreground/70 mt-1">
                                              Missing: <span className="font-medium">{deps.missing.join(" + ")}</span>. This Benchmark is paused until inputs are restored.
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
                                              <span className="text-xs text-muted-foreground/70">Progress</span>
                                              <span className="text-xs text-muted-foreground/70">{p.labelPct}%</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2">
                                              <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                                            </div>
                                          </div>

                                          <div className="flex justify-between items-center mt-3">
                                            <span className="text-sm text-muted-foreground/70">Performance</span>
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
                                  </CardContent>
                                </Card>
                                );
                              })}
                            </div>
                          ) : (
                            <Card>
                              <CardContent className="p-8 text-center">
                                <TrendingUp className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">No Benchmarks Yet</h3>
                                <p className="text-muted-foreground/70 mb-4">
                                  Create your first benchmark to start tracking performance against industry standards
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reports" className="fade-in">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
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
                            reportType: "",
                            configuration: {
                              sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false },
                            },
                            scheduleEnabled: false,
                            scheduleFrequency: "daily",
                            scheduleDayOfWeek: "monday",
                            scheduleDayOfMonth: "first",
                            quarterTiming: "end",
                            scheduleTime: "9:00 AM",
                            emailRecipients: "",
                            status: "active",
                          });
                          setGa4ReportFormErrors({});
                          setShowGA4ReportModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Create Report
                      </Button>
                    </div>

                    {ga4ReportsLoading ? (
                      <div className="animate-pulse space-y-4">
                        <div className="h-24 bg-muted rounded" />
                        <div className="h-24 bg-muted rounded" />
                      </div>
                    ) : Array.isArray(ga4Reports) && ga4Reports.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {ga4Reports.map((r: any) => (
                          <Card key={r.id} className="border-border">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-foreground mb-1">{r.name}</h3>
                                  {r.description && (
                                    <p className="text-sm text-muted-foreground/70 mb-3">{r.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-sm">
                                    <Badge variant="outline">{String(r.reportType || "overview")}</Badge>
                                    {r.scheduleEnabled && r.scheduleFrequency && (
                                      <span className="text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {(() => {
                                          const time = r.scheduleTime ? from24HourTo12Hour(r.scheduleTime) : '';
                                          const tz = String(r.scheduleTimeZone || '').trim();
                                          const timeLabel = time ? ` at ${time}${tz ? ` ${tz}` : ''}` : '';
                                          return `${r.scheduleFrequency}${timeLabel}`;
                                        })()}
                                      </span>
                                    )}
                                    {r.lastSentAt && (
                                      <span className="text-muted-foreground">
                                        Last sent {new Date(r.lastSentAt).toLocaleDateString()}
                                      </span>
                                    )}
                                    <span className="text-muted-foreground/70">
                                      Created {new Date(r.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      let cfg: any = { sections: { overview: true } };
                                      try {
                                        const parsed = r.configuration ? JSON.parse(String(r.configuration)) : {};
                                        if (parsed?.sections) cfg = parsed;
                                      } catch {
                                        // keep default
                                      }
                                      downloadGA4Report({
                                        reportType: String(r.reportType || "overview"),
                                        configuration: cfg,
                                        reportName: String(r.name || "GA4 Report"),
                                      });
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingGA4ReportId(String(r.id));
                                      setGa4ReportModalStep(String(r.reportType || "overview") === "custom" ? "custom" : "standard");
                                      let cfg: any = { sections: { overview: true } };
                                      try {
                                        const parsed = r.configuration ? JSON.parse(String(r.configuration)) : {};
                                        if (parsed?.sections) cfg = parsed;
                                      } catch {
                                        // keep default
                                      }
                                      const emailRecipientsString = r.scheduleRecipients && Array.isArray(r.scheduleRecipients)
                                        ? r.scheduleRecipients.join(', ')
                                        : '';
                                      setGa4ReportForm({
                                        name: String(r.name || ""),
                                        description: String(r.description || ""),
                                        reportType: String(r.reportType || "overview"),
                                        configuration: cfg?.sections ? cfg : { sections: { overview: true } },
                                        scheduleEnabled: !!r.scheduleEnabled,
                                        scheduleFrequency: r.scheduleFrequency || "daily",
                                        scheduleDayOfWeek: cfg?.scheduleDayOfWeek || dayOfWeekIntToKey(r.scheduleDayOfWeek) || "monday",
                                        scheduleDayOfMonth: cfg?.scheduleDayOfMonth || (r.scheduleDayOfMonth === 0 ? "last" : String(r.scheduleDayOfMonth || "first")),
                                        quarterTiming: cfg?.quarterTiming || r.quarterTiming || "end",
                                        scheduleTime: cfg?.scheduleTime || from24HourTo12Hour(r.scheduleTime) || "9:00 AM",
                                        emailRecipients: emailRecipientsString,
                                        status: r.status || "active",
                                      });
                                      setGa4ReportFormErrors({});
                                      setShowGA4ReportModal(true);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{r.name}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteGA4ReportMutation.mutate(String(r.id))}
                                          className="bg-red-600 hover:bg-red-700 text-white"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-border">
                        <CardContent className="p-10 text-center">
                          <FileText className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
                          <div className="text-foreground font-medium">No reports created yet</div>
                          <div className="text-sm text-muted-foreground/70 mt-1">
                            Create your first GA4 report to download a PDF snapshot.
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="campaigns" className="fade-in">
                  <GA4CampaignComparison
                    campaignBreakdownAgg={campaignBreakdownAgg}
                    breakdownLoading={breakdownLoading}
                    selectedMetric={campaignComparisonMetric}
                    onMetricChange={setCampaignComparisonMetric}
                    formatNumber={formatNumber}
                    formatMoney={formatMoney}
                    totalRevenue={financialRevenue}
                    revenueDisplaySources={revenueDisplaySources}
                  />
                </TabsContent>

                <TabsContent value="insights" className="fade-in">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Insights</h3>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Actionable insights from financial integrity checks, KPI + Benchmark performance, plus anomaly detection from daily deltas.
                      </p>
                    </div>

                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle>Executive financials</CardTitle>
                        <CardDescription>
                          Uses spend-to-date and GA4 revenue-to-date (or imported revenue-to-date when GA4 revenue is missing).
                          {(ga4ToDateResp as any)?.startDate ? ` Range: ${String((ga4ToDateResp as any)?.startDate)} → ${String((ga4ToDateResp as any)?.endDate || "yesterday")}.` : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-5">
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-muted-foreground/70">Spend</div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatMoney(Number(financialSpend || 0))}
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-muted-foreground/70">Revenue</div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatMoney(Number(financialRevenue || 0))}
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-muted-foreground/70">Profit</div>
                              <div className={`text-2xl font-bold ${(financialRevenue - financialSpend) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatMoney(financialRevenue - financialSpend)}
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-muted-foreground/70">ROAS</div>
                              <div className="text-2xl font-bold text-foreground">
                                {Number(financialROAS || 0).toFixed(2)}x
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="text-sm font-medium text-muted-foreground/70">ROI</div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatPercentage(Number(financialROI || 0))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Sources used (provenance) */}
                        <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground/70">
                          <div className="font-medium text-foreground/80/60 mb-1">Sources used</div>
                          <div className="grid gap-1">
                            <div>
                              <span className="font-medium">Spend</span>: {spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "Not connected"}
                            </div>
                            <div>
                              <span className="font-medium">Revenue</span>:{" "}
                              {revenueSourceLabels.length > 0 ? revenueSourceLabels.join(" + ") : "Not connected"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Trends card — replaces Performance Rollups with chart + metric selector */}
                    <Card className="border-border">
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <CardTitle>Trends</CardTitle>
                            <CardDescription>
                              Daily shows day-by-day values. 7d/30d show rolling daily averages. Monthly compares calendar months.
                            </CardDescription>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex items-center gap-1">
                              {(["daily", "7d", "30d", "monthly"] as const).map((mode) => (
                                <Button
                                  key={mode}
                                  variant={insightsTrendMode === mode ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setInsightsDailyShowMore(false);
                                    setInsightsTrendMode(mode);
                                    // Users is non-additive — only accurate in daily mode
                                    if (mode !== "daily" && insightsTrendMetric === "users") setInsightsTrendMetric("sessions");
                                  }}
                                >
                                  {mode === "daily" ? "Daily" : mode === "monthly" ? "Monthly" : mode}
                                </Button>
                              ))}
                            </div>
                            <div className="min-w-[200px]">
                              <Select
                                value={insightsTrendMetric}
                                onValueChange={setInsightsTrendMetric}
                              >
                                <SelectTrigger className="h-9"><SelectValue placeholder="Metric" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sessions">Sessions</SelectItem>
                                  {insightsTrendMode === "daily" && <SelectItem value="users">Users</SelectItem>}
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
                              <div className="text-sm text-muted-foreground/70 py-4">
                                Need at least 2 days of GA4 daily history. Available: {dailyRows.length}.
                              </div>
                            );
                          }

                          let sorted = [...dailyRows].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
                          const metric = insightsTrendMetric;
                          const isRate = metric === "engagementRate";
                          const isMoney = metric === "revenue";

                          // Build chart data depending on mode
                          let chartData: { date: string; value: number; idx: number }[] = [];
                          if (insightsTrendMode === "daily") {
                            // Show last 30 days for a readable daily chart
                            let dailyChartRows = sorted.slice(-30);
                            // Trim leading zero-value rows so the chart starts at real data
                            while (dailyChartRows.length > 0 && Number(dailyChartRows[0]?.[metric] || 0) === 0) {
                              dailyChartRows = dailyChartRows.slice(1);
                            }
                            chartData = dailyChartRows.map((r: any, i: number) => ({
                              date: String(r.date || "").slice(5), // MM-DD
                              value: isRate ? Number((Number(r[metric] || 0) * 100).toFixed(2)) : Number(r[metric] || 0),
                              idx: i,
                            }));
                          } else if (insightsTrendMode === "monthly") {
                            // Group by calendar month
                            const monthMap = new Map<string, any[]>();
                            for (const r of sorted) {
                              const ym = String(r.date).slice(0, 7); // "YYYY-MM"
                              if (!monthMap.has(ym)) monthMap.set(ym, []);
                              monthMap.get(ym)!.push(r);
                            }
                            const monthKeys = [...monthMap.keys()].sort();
                            const todayYM = new Date().toISOString().slice(0, 7);

                            chartData = monthKeys.map((ym, i) => {
                              const rows = monthMap.get(ym)!;
                              let val = 0;
                              if (isRate) {
                                const totalSessions = rows.reduce((s: number, r: any) => s + Number(r.sessions || 0), 0);
                                const totalEngaged = rows.reduce((s: number, r: any) => s + Number(r.engagedSessions || r.sessions * Number(r.engagementRate || 0) || 0), 0);
                                val = totalSessions > 0 ? (totalEngaged / totalSessions) * 100 : 0;
                              } else {
                                val = rows.reduce((s: number, r: any) => s + Number(r[metric] || 0), 0);
                              }
                              const [y, m] = ym.split("-");
                              const monthLabel = new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short" }) + " '" + y.slice(2);
                              return { date: monthLabel, value: Number(val.toFixed(2)), idx: i, partial: ym === todayYM };
                            });
                          } else {
                            const windowDays = insightsTrendMode === "7d" ? 7 : 30;
                            // Limit chart to relevant range: show 2× window (current + prior) for context
                            const chartWindowDays = windowDays * 2;
                            const chartStartIdx = Math.max(0, sorted.length - chartWindowDays);
                            const chartRows = sorted.slice(chartStartIdx);
                            for (let i = windowDays - 1; i < chartRows.length; i++) {
                              const slice = chartRows.slice(i - windowDays + 1, i + 1);
                              let val = 0;
                              if (isRate) {
                                const totalSessions = slice.reduce((s: number, r: any) => s + Number(r.sessions || 0), 0);
                                const totalEngaged = slice.reduce((s: number, r: any) => s + Number(r.engagedSessions || r.sessions * Number(r.engagementRate || 0) || 0), 0);
                                val = totalSessions > 0 ? (totalEngaged / totalSessions) * 100 : 0;
                              } else {
                                val = slice.reduce((s: number, r: any) => s + Number(r[metric] || 0), 0);
                              }
                              // engagementRate is already a weighted average — no further processing needed
                              // Non-rate metrics show rolling window totals (sum of last N days)
                              chartData.push({ date: String(chartRows[i].date || "").slice(5), value: Number(val.toFixed(2)), idx: chartData.length });
                            }
                          }

                          const fmtValue = (v: any) => {
                            const n = Number(v || 0);
                            if (isMoney) return formatMoney(n);
                            if (isRate) return formatPct(n);
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
                                  {insightsTrendMode === "monthly" ? (
                                    <BarChart data={chartData} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickMargin={6} />
                                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => fmtValue(v)} width={45} />
                                      <Tooltip
                                        formatter={(value: any) => [fmtValue(value), `${trendMetricLabels[metric] || metric} (${isRate ? "weighted avg" : "monthly total"})`]}
                                        labelFormatter={(label: any) => String(label)}
                                      />
                                      <Bar dataKey="value" name={trendMetricLabels[metric] || metric} fill="#3b82f6" radius={[4, 4, 0, 0]}
                                        // @ts-ignore — Recharts Cell children for per-bar styling
                                      >
                                        {chartData.map((entry: any, i: number) => (
                                          <Cell key={i} fillOpacity={entry.partial ? 0.5 : 1} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  ) : (
                                    <LineChart data={chartData} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                      <XAxis
                                        dataKey="idx"
                                        type="number"
                                        domain={[0, Math.max(1, chartData.length - 1)]}
                                        tickFormatter={(idx: number) => chartData[Math.round(idx)]?.date || ""}
                                        allowDecimals={false}
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickMargin={6}
                                      />
                                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => fmtValue(v)} width={45} />
                                      <Tooltip
                                        formatter={(value: any) => [fmtValue(value), trendMetricLabels[metric] || metric]}
                                        labelFormatter={(idx: any) => {
                                          const dateLabel = chartData[Math.round(Number(idx))]?.date || idx;
                                          if (insightsTrendMode === "daily") return `Date: ${dateLabel}`;
                                          const periodLabel = insightsTrendMode === "7d" ? "7-day" : "30-day";
                                          return `${periodLabel} period ending: ${dateLabel}`;
                                        }}
                                      />
                                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls name={trendMetricLabels[metric] || metric} />
                                    </LineChart>
                                  )}
                                </ResponsiveContainer>
                              </div>

                              {/* Comparison table */}
                              {insightsTrendMode === "daily" ? (
                                <div className="overflow-hidden border rounded-md">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted border-b">
                                      <tr>
                                        <th className="text-left p-3">Date / Window</th>
                                        <th className="text-right p-3">{trendMetricLabels[metric] || metric}</th>
                                        <th className="text-right p-3">vs prior</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const showCount = insightsDailyShowMore ? 30 : 14;
                                        const recentRows = sorted.slice(-showCount).reverse();
                                        return recentRows.map((r: any, idx: number) => {
                                          const curVal = isRate ? Number(r[metric] || 0) * 100 : Number(r[metric] || 0);
                                          // Use index math instead of fragile indexOf reference scan
                                          const sortedIdx = sorted.length - 1 - idx;
                                          const prevRow = sortedIdx > 0 ? sorted[sortedIdx - 1] : null;
                                          const prevVal = prevRow ? (isRate ? Number(prevRow[metric] || 0) * 100 : Number(prevRow[metric] || 0)) : 0;
                                          const delta = prevRow ? deltaPct(curVal, prevVal) : 0;
                                          return (
                                            <tr key={r.date || idx} className="border-b last:border-b-0">
                                              <td className="p-3 text-foreground">{r.date}</td>
                                              <td className="p-3 text-right font-medium tabular-nums text-foreground">{fmtValue(curVal)}</td>
                                              <td className="p-3 text-right">
                                                {prevRow ? <span className={`text-xs ${deltaColor(delta)}`}>{fmtDelta(delta)}</span> : <span className="text-xs text-muted-foreground/70">—</span>}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                  {sorted.length > 14 && (
                                    <div className="px-3 py-2 border-t bg-muted">
                                      <Button variant="ghost" size="sm" onClick={() => setInsightsDailyShowMore(!insightsDailyShowMore)}>
                                        {insightsDailyShowMore ? "Show less" : "Show all"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ) : insightsTrendMode === "monthly" ? (
                                <div className="overflow-hidden border rounded-md">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted border-b">
                                      <tr>
                                        <th className="text-left p-3">Month</th>
                                        <th className="text-right p-3">
                                          {trendMetricLabels[metric] || metric} {isRate && <span className="text-muted-foreground font-normal">(weighted avg)</span>}
                                        </th>
                                        <th className="text-right p-3">vs prior month</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        // Group by calendar month (same logic as chart)
                                        const monthMap = new Map<string, any[]>();
                                        for (const r of sorted) {
                                          const ym = String(r.date).slice(0, 7);
                                          if (!monthMap.has(ym)) monthMap.set(ym, []);
                                          monthMap.get(ym)!.push(r);
                                        }
                                        const monthKeys = [...monthMap.keys()].sort().reverse(); // most recent first
                                        const todayYM = new Date().toISOString().slice(0, 7);

                                        if (monthKeys.length < 2) {
                                          return (
                                            <tr><td colSpan={3} className="p-3 text-sm text-muted-foreground/70">
                                              Need at least 2 months of data for comparison. Available: {monthKeys.length} month(s).
                                            </td></tr>
                                          );
                                        }

                                        const monthValues = monthKeys.map(ym => {
                                          const rows = monthMap.get(ym)!;
                                          let val = 0;
                                          if (isRate) {
                                            const totalSessions = rows.reduce((s: number, r: any) => s + Number(r.sessions || 0), 0);
                                            const totalEngaged = rows.reduce((s: number, r: any) => s + Number(r.engagedSessions || r.sessions * Number(r.engagementRate || 0) || 0), 0);
                                            val = totalSessions > 0 ? (totalEngaged / totalSessions) * 100 : 0;
                                          } else {
                                            val = rows.reduce((s: number, r: any) => s + Number(r[metric] || 0), 0);
                                          }
                                          const [y, m] = ym.split("-");
                                          const label = new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
                                          const isPartial = ym === todayYM;
                                          return { ym, label, value: val, days: rows.length, isPartial };
                                        });

                                        return monthValues.map((row, i) => {
                                          const prev = i < monthValues.length - 1 ? monthValues[i + 1] : null;
                                          const delta = prev ? deltaPct(row.value, prev.value) : 0;
                                          return (
                                            <tr key={row.ym} className="border-b last:border-b-0">
                                              <td className="p-3">
                                                <div className="font-medium text-foreground">{row.label}</div>
                                                <div className="text-xs text-muted-foreground/70 mt-0.5">
                                                  {row.isPartial ? `partial, ${row.days} days` : `${row.days} days`}
                                                </div>
                                              </td>
                                              <td className="p-3 text-right font-medium tabular-nums text-foreground">{fmtValue(row.value)}</td>
                                              <td className="p-3 text-right">
                                                {prev
                                                  ? <span className={`text-xs ${deltaColor(delta)}`}>{fmtDelta(delta)}</span>
                                                  : <span className="text-xs text-muted-foreground/70">—</span>}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="overflow-hidden border rounded-md">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted border-b">
                                      <tr>
                                        <th className="text-left p-3">Date / Window</th>
                                        <th className="text-right p-3">
                                          {trendMetricLabels[metric] || metric}
                                        </th>
                                        <th className="text-right p-3">vs prior</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const windowDays = insightsTrendMode === "7d" ? 7 : 30;
                                        const minDays = windowDays * 2;
                                        if (Number(insightsRollups?.availableDays || 0) < minDays) return null;

                                        const cur = insightsTrendMode === "7d" ? insightsRollups.last7 : insightsRollups.last30;
                                        const prior = insightsTrendMode === "7d" ? insightsRollups.prior7 : insightsRollups.prior30;

                                        const getVal = (rollup: typeof cur) => {
                                          if (metric === "engagementRate") return rollup.engagementRate;
                                          return (rollup as any)[metric] || 0;
                                        };

                                        const curVal = getVal(cur);
                                        const priorVal = getVal(prior);
                                        const delta = deltaPct(curVal, priorVal);

                                        return [
                                          { label: `Last ${windowDays} days`, dateRange: `${cur.startDate} → ${cur.endDate}`, value: curVal, delta, hasDelta: true },
                                          { label: `Prior ${windowDays} days`, dateRange: `${prior.startDate} → ${prior.endDate}`, value: priorVal, delta: 0, hasDelta: false },
                                        ].map((row, i) => (
                                          <tr key={i} className="border-b last:border-b-0">
                                            <td className="p-3">
                                              <div className="font-medium text-foreground">{row.label}</div>
                                              <div className="text-xs text-muted-foreground/70 mt-0.5">{row.dateRange}</div>
                                            </td>
                                            <td className="p-3 text-right font-medium tabular-nums text-foreground">
                                              {fmtValue(row.value)}
                                            </td>
                                            <td className="p-3 text-right">
                                              {row.hasDelta
                                                ? <span className={`text-xs ${deltaColor(row.delta)}`}>{fmtDelta(row.delta)}</span>
                                                : <span className="text-xs text-muted-foreground/70">baseline</span>}
                                            </td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                  {Number(insightsRollups?.availableDays || 0) < (insightsTrendMode === "7d" ? 14 : 60) && (
                                    <div className="p-3 text-sm text-muted-foreground/70">
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

                    {/* Data Summary — always visible when data exists */}
                    {(breakdownTotals.sessions > 0 || financialRevenue > 0) && (
                      <Card className="border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Data Summary</CardTitle>
                          <CardDescription>
                            Campaign performance at a glance ({insightsRollups?.availableDays || 0} days of data)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {breakdownTotals.sessions > 0 && (
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Sessions</p>
                                <p className="text-xl font-bold text-foreground mt-1">{formatNumber(breakdownTotals.sessions)}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                  ~{formatNumber(Math.round(breakdownTotals.sessions / Math.max(insightsRollups?.availableDays || 1, 1)))}/day avg
                                </p>
                              </div>
                            )}
                            {breakdownTotals.conversions > 0 && (
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Conversions</p>
                                <p className="text-xl font-bold text-foreground mt-1">{formatNumber(breakdownTotals.conversions)}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                  {breakdownTotals.sessions > 0 ? `${formatPct((breakdownTotals.conversions / breakdownTotals.sessions) * 100)} conversion rate` : ""}
                                </p>
                              </div>
                            )}
                            {financialRevenue > 0 && (
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Revenue</p>
                                <p className="text-xl font-bold text-foreground mt-1">{formatMoney(financialRevenue)}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                  ~{formatMoney(financialRevenue / Math.max(insightsRollups?.availableDays || 1, 1))}/day avg
                                </p>
                              </div>
                            )}
                            {channelAnalysis && channelAnalysis.topSessionChannel && (
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Top Channel</p>
                                <p className="text-base font-bold text-foreground mt-1 truncate" title={channelAnalysis.topSessionChannel.label}>
                                  {channelAnalysis.topSessionChannel.label}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                  {channelAnalysis.topSessionShare.toFixed(0)}% of sessions · {channelAnalysis.channelCount} channels
                                </p>
                              </div>
                            )}
                          </div>
                          {financialSpend > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4 pt-4 border-t">
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Total Spend</p>
                                <p className="text-xl font-bold text-foreground mt-1">{formatMoney(financialSpend)}</p>
                              </div>
                              {financialRevenue > 0 && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">Profit</p>
                                  <p className={`text-xl font-bold mt-1 ${(financialRevenue - financialSpend) >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                                    {formatMoney(financialRevenue - financialSpend)}
                                  </p>
                                </div>
                              )}
                              {financialROAS > 0 && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">ROAS</p>
                                  <p className={`text-xl font-bold mt-1 ${financialROAS >= 1 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                                    {financialROAS.toFixed(2)}x
                                  </p>
                                </div>
                              )}
                              {breakdownTotals.conversions > 0 && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">CPA</p>
                                  <p className="text-xl font-bold text-foreground mt-1">{formatMoney(financialSpend / breakdownTotals.conversions)}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {channelAnalysis && channelAnalysis.channels && channelAnalysis.channels.length >= 1 && (() => {
                            // Scale channel values so they sum to breakdownTotals (which includes Run Refresh data)
                            const sessScale = channelAnalysis.totalSessions > 0 ? breakdownTotals.sessions / channelAnalysis.totalSessions : 1;
                            const convScale = (channelAnalysis.channels.reduce((s: number, c: any) => s + c.conversions, 0) || 1);
                            const convScaleFactor = breakdownTotals.conversions > 0 ? breakdownTotals.conversions / convScale : 1;
                            return (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">Channel Breakdown</p>
                              <div className="overflow-hidden border rounded-md">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted border-b">
                                    <tr>
                                      <th className="text-left p-2 pl-3">Channel</th>
                                      <th className="text-right p-2">Sessions</th>
                                      <th className="text-right p-2">Share</th>
                                      <th className="text-right p-2">Conversions</th>
                                      <th className="text-right p-2 pr-3">Conv. Rate</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {channelAnalysis.channels.map((ch: any) => {
                                      const scaledSessions = Math.round(ch.sessions * sessScale);
                                      const scaledConversions = Math.round(ch.conversions * convScaleFactor);
                                      const share = breakdownTotals.sessions > 0 ? (scaledSessions / breakdownTotals.sessions * 100) : 0;
                                      const cr = scaledSessions > 0 ? (scaledConversions / scaledSessions * 100) : 0;
                                      const isLowestCR = channelAnalysis.channels.length > 1 && channelAnalysis.lowestCRChannel?.label === ch.label;
                                      return (
                                        <tr key={ch.label} className="border-b last:border-b-0">
                                          <td className="p-2 pl-3 text-foreground font-medium truncate max-w-[200px]" title={ch.label}>{ch.label}</td>
                                          <td className="p-2 text-right tabular-nums text-foreground">{formatNumber(scaledSessions)}</td>
                                          <td className="p-2 text-right tabular-nums text-muted-foreground/70">{share.toFixed(0)}%</td>
                                          <td className="p-2 text-right tabular-nums text-foreground">{formatNumber(scaledConversions)}</td>
                                          <td className={`p-2 pr-3 text-right tabular-nums ${isLowestCR ? "text-red-600 font-medium" : "text-foreground"}`}>
                                            {formatPct(cr)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground/70">Total insights</p>
                              <p className="text-2xl font-bold text-foreground">{insights.length}</p>
                            </div>
                            <BarChart3 className="w-7 h-7 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground/70">High priority</p>
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
                              <p className="text-sm font-medium text-muted-foreground/70">Needs attention</p>
                              <p className="text-2xl font-bold text-amber-600">
                                {insights.filter((i) => i.severity === "medium").length}
                              </p>
                            </div>
                            <TrendingDown className="w-7 h-7 text-amber-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle>What changed, what to do next</CardTitle>
                        <CardDescription>
                          We compare the last 7 days vs the previous 7 days (when enough daily history exists) and cross-check KPI/Benchmark performance.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {insights.length === 0 ? (
                          <div className="text-sm text-muted-foreground/70">
                            No issues detected for the selected range. Create KPIs and Benchmarks to unlock performance tracking insights.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {insights.slice(0, 12).map((i) => {
                              const isPositive = i.id.startsWith("positive:");
                              const isInfo = i.id.startsWith("info:");
                              const badgeClass =
                                i.severity === "high"
                                  ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900"
                                  : i.severity === "medium"
                                    ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900"
                                    : isPositive
                                      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-900"
                                      : isInfo
                                        ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900"
                                        : "bg-muted text-foreground border-border dark:text-slate-200";
                              const badgeText = i.severity === "high" ? "High" : i.severity === "medium" ? "Medium" : isPositive ? "Positive" : isInfo ? "Info" : "Low";
                              return (
                                <div key={i.id} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-semibold text-foreground">{i.title}</div>
                                        <Badge className={`text-xs border ${badgeClass}`}>{badgeText}</Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground/70 mt-1">{i.description}</div>
                                      {i.recommendation ? (
                                        <div className="text-sm text-foreground/80/60 mt-2">
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
      <Dialog
        open={showKPIDialog}
        onOpenChange={(open) => {
          setShowKPIDialog(open);
          if (!open) {
            setEditingKPI(null);
            setSelectedKPITemplate(null);
            kpiForm.reset(getEmptyKpiFormValues());
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle>{editingKPI ? "Edit KPI" : "Create New KPI"}</DialogTitle>
            <DialogDescription>
              Set up a key performance indicator for Google Analytics.
            </DialogDescription>
          </DialogHeader>

          <Form {...kpiForm}>
            <form onSubmit={kpiForm.handleSubmit(onSubmitKPI)} className="space-y-6">
              {/* KPI Template Selection */}
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-medium text-foreground">Select KPI Template</h4>
                </div>
                <p className="text-sm text-muted-foreground/70">
                  Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      name: "ROAS",
                      formula: "Revenue ÷ Spend",
                      unit: "ratio",
                      description: "Revenue generated per dollar of spend (e.g., 5.0 = 5x return)",
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
                      formula: "Total revenue",
                      unit: "$",
                      description: "Total revenue for this campaign",
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
                            : "border-border hover:border-blue-300"
                          }`}
                        onClick={() => {
                          if (disabled) return;
                          if (isCustom) {
                            setSelectedKPITemplate(null);
                            kpiForm.reset({
                              ...getEmptyKpiFormValues(),
                              unit: SELECT_UNIT as any,
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
                        <div className="font-medium text-sm text-foreground">
                          {template.name}
                        </div>
                        {isCustom && (
                          <div className="mt-1 text-xs text-muted-foreground/70">
                            Choose name + unit, then set values
                          </div>
                        )}
                        {!isCustom && disabled && (
                          <div className="mt-1 text-xs text-muted-foreground/70">
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

              {/* KPI Name (full width, like LinkedIn) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi-name">KPI Name *</Label>
                  <Input
                    id="kpi-name"
                    placeholder="e.g., GA4 ROAS Target"
                    value={kpiForm.watch("name")}
                    onChange={(e) => kpiForm.setValue("name", e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="kpi-description">Description</Label>
                <Textarea
                  id="kpi-description"
                  placeholder="Describe what this KPI measures and why it's important"
                  value={kpiForm.watch("description") || ""}
                  maxLength={KPI_DESC_MAX}
                  onChange={(e) => kpiForm.setValue("description", String(e.target.value || "").slice(0, KPI_DESC_MAX))}
                  rows={3}
                />
                <div className="text-xs text-muted-foreground/70 text-right">
                  {(String(kpiForm.watch("description") || "")).length}/{KPI_DESC_MAX}
                </div>
              </div>

              {/* Current Value | Target Value | Unit (3-col like LinkedIn) */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi-current">Current Value</Label>
                  <Input
                    id="kpi-current"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={kpiForm.watch("currentValue") || ""}
                    onChange={(e) =>
                      kpiForm.setValue("currentValue", formatNumberAsYouType(e.target.value, String(kpiForm.getValues().unit || "%")))
                    }
                    onBlur={(e) => kpiForm.setValue("currentValue", formatNumberByUnit(e.target.value, String(kpiForm.getValues().unit || "%")))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kpi-target">Target Value *</Label>
                  <Input
                    id="kpi-target"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={kpiForm.watch("targetValue") || ""}
                    onChange={(e) =>
                      kpiForm.setValue("targetValue", formatNumberAsYouType(e.target.value, String(kpiForm.getValues().unit || "%")))
                    }
                    onBlur={(e) => kpiForm.setValue("targetValue", formatNumberByUnit(e.target.value, String(kpiForm.getValues().unit || "%")))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kpi-unit">Unit</Label>
                  <Input
                    id="kpi-unit"
                    placeholder="%, $, etc."
                    value={kpiForm.watch("unit")}
                    onChange={(e) => kpiForm.setValue("unit", e.target.value)}
                  />
                </div>
              </div>

              {/* Priority (2-col grid, left only like LinkedIn) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi-priority">Priority</Label>
                  <Select value={kpiForm.watch("priority")} onValueChange={(v) => kpiForm.setValue("priority", v as any)}>
                    <SelectTrigger id="kpi-priority">
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

              {/* Alert Settings (border-t, matching LinkedIn) */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="kpi-alerts-enabled"
                      checked={kpiForm.watch("alertsEnabled")}
                      onCheckedChange={(checked) => kpiForm.setValue("alertsEnabled", checked as boolean)}
                    />
                    <Label htmlFor="kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                      Enable alerts for this KPI
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground/70 pl-6">
                    Receive notifications for KPI performance alerts on the bell icon &amp; in your Notifications center
                  </p>
                </div>

                {kpiForm.watch("alertsEnabled") && (
                  <div className="space-y-4 pl-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kpi-alert-threshold">Alert Threshold *</Label>
                        <Input
                          id="kpi-alert-threshold"
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g., 80"
                          value={kpiForm.watch("alertThreshold") || ""}
                          onChange={(e) => kpiForm.setValue("alertThreshold", formatNumberAsYouType(e.target.value, String(kpiForm.getValues().unit || "%")))}
                          onBlur={(e) => kpiForm.setValue("alertThreshold", formatNumberByUnit(e.target.value, String(kpiForm.getValues().unit || "%")))}
                        />
                        <p className="text-xs text-muted-foreground/70">Value at which to trigger the alert</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kpi-alert-condition">Alert When</Label>
                        <Select value={kpiForm.watch("alertCondition")} onValueChange={(v) => kpiForm.setValue("alertCondition", v as any)}>
                          <SelectTrigger id="kpi-alert-condition">
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
                          value={kpiForm.watch("alertFrequency") || "daily"}
                          onValueChange={(v) => kpiForm.setValue("alertFrequency", v as any)}
                        >
                          <SelectTrigger id="kpi-alert-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground/70">
                          Controls how often you're notified while the alert condition stays true.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 pt-1">
                          <Checkbox
                            id="kpi-email-notifications"
                            checked={kpiForm.watch("emailNotifications")}
                            onCheckedChange={(checked) => kpiForm.setValue("emailNotifications", checked as boolean)}
                          />
                          <Label htmlFor="kpi-email-notifications" className="cursor-pointer font-medium">
                            Send email notifications
                          </Label>
                        </div>
                        {kpiForm.watch("emailNotifications") && (
                          <div className="space-y-2">
                            <Label htmlFor="kpi-email-recipients">Email addresses *</Label>
                            <Input
                              id="kpi-email-recipients"
                              type="text"
                              placeholder="email1@example.com, email2@example.com"
                              value={kpiForm.watch("emailRecipients") || ""}
                              onChange={(e) => kpiForm.setValue("emailRecipients", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground/70">
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
                <Button variant="outline" onClick={() => setShowKPIDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createKPIMutation.isPending || updateKPIMutation.isPending}>
                  {editingKPI
                    ? (updateKPIMutation.isPending ? "Updating..." : "Update KPI")
                    : (createKPIMutation.isPending ? "Creating..." : "Create KPI")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete KPI Confirmation Dialog */}
      <AlertDialog open={deleteKPIId !== null} onOpenChange={() => setDeleteKPIId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete KPI</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/70">
              Are you sure you want to delete this KPI? This action cannot be undone and will remove all associated progress tracking and alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteKPIId(null)}
              className="bg-muted text-foreground border-border hover:bg-muted dark:hover:bg-slate-700"
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
                  : "border-border"
                  }`}
                onClick={() => {
                  setGa4ReportModalStep("standard");
                  setGa4ReportForm((p) => ({
                    ...p,
                    reportType: p.reportType === "custom" ? "overview" : p.reportType,
                    configuration: { sections: { overview: true, kpis: false, benchmarks: false, ads: false, insights: false } },
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
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${ga4ReportModalStep === "custom"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-border"
                  }`}
                onClick={() => {
                  setGa4ReportModalStep("custom");
                  setGa4ReportForm((p) => ({
                    ...p,
                    reportType: "custom",
                    name: p.name || "Custom Report",
                    configuration: p.configuration?.sections
                      ? p.configuration
                      : { sections: { overview: true, kpis: true, benchmarks: true, ads: true, insights: true } },
                  }));
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

            {ga4ReportModalStep === "standard" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-4">Choose Template</h3>
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
                        Icon: Trophy,
                        chips: ["Industry", "Historical", "Goals"],
                      },
                      {
                        key: "ads",
                        title: "Ad Comparison",
                        desc: "Detailed campaign-level performance analysis",
                        Icon: Activity,
                        chips: ["Performance", "Ranking", "Insights"],
                      },
                      {
                        key: "insights",
                        title: "Insights",
                        desc: "Executive financials, trends, and what changed / what to do next",
                        Icon: Info,
                        chips: ["Executive", "Trends", "Actions"],
                      },
                    ].map((t) => {
                      const selected = ga4ReportForm.reportType === t.key;
                      return (
                        <div
                          key={t.key}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${selected ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-border"
                            }`}
                          onClick={() => {
                            const nextType = String(t.key);
                            setGa4ReportForm((p) => ({
                              ...p,
                              reportType: nextType,
                              configuration: {
                                sections: {
                                  overview: nextType === "overview",
                                  kpis: nextType === "kpis",
                                  benchmarks: nextType === "benchmarks",
                                  ads: nextType === "ads",
                                  insights: nextType === "insights",
                                },
                              },
                              name: `GA4 ${t.title} Report`,
                            }));
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <t.Icon className="w-5 h-5 text-foreground mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground">{t.title}</h4>
                              <p className="text-sm text-muted-foreground/70 mt-1">{t.desc}</p>
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {t.chips.map((c) => (
                                  <span key={c} className="text-xs px-2 py-1 bg-muted rounded">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Schedule Automated Reports */}
                    <div className="pt-4 border-t mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Checkbox
                          id="ga4-schedule-reports"
                          checked={ga4ReportForm.scheduleEnabled}
                          onCheckedChange={(checked) => {
                            const enabled = checked as boolean;
                            setGa4ReportForm((p) => ({ ...p, scheduleEnabled: enabled }));
                            if (!enabled) setGa4ReportFormErrors({});
                          }}
                        />
                        <Label htmlFor="ga4-schedule-reports" className="text-base font-semibold cursor-pointer">
                          Schedule Automated Reports
                        </Label>
                      </div>

                      {/* Report Name + Description (always shown) */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ga4-report-name">Report Name</Label>
                          <Input
                            id="ga4-report-name"
                            value={ga4ReportForm.name}
                            onChange={(e) => setGa4ReportForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Enter report name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ga4-report-description">Description (Optional)</Label>
                          <Textarea
                            id="ga4-report-description"
                            value={ga4ReportForm.description}
                            onChange={(e) => setGa4ReportForm((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Add a description for this report"
                            rows={3}
                          />
                        </div>
                      </div>

                      {ga4ReportForm.scheduleEnabled && (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="ga4-schedule-frequency">Frequency</Label>
                            <Select value={ga4ReportForm.scheduleFrequency} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleFrequency: value }))}>
                              <SelectTrigger id="ga4-schedule-frequency"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {ga4ReportForm.scheduleFrequency === "weekly" && (
                            <div className="space-y-2">
                              <Label htmlFor="ga4-schedule-day">Day of Week</Label>
                              <Select value={ga4ReportForm.scheduleDayOfWeek} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleDayOfWeek: value }))}>
                                <SelectTrigger id="ga4-schedule-day"><SelectValue /></SelectTrigger>
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

                          {ga4ReportForm.scheduleFrequency === "quarterly" && (
                            <div className="space-y-2">
                              <Label htmlFor="ga4-quarter-timing">Quarter Timing</Label>
                              <Select value={ga4ReportForm.quarterTiming} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, quarterTiming: value }))}>
                                <SelectTrigger id="ga4-quarter-timing"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                                  <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground/70">Choose whether to run reports at the start or end of each quarter</p>
                            </div>
                          )}

                          {(ga4ReportForm.scheduleFrequency === "monthly" || ga4ReportForm.scheduleFrequency === "quarterly") && (
                            <div className="space-y-2">
                              <Label htmlFor="ga4-schedule-day-month">Day of Month</Label>
                              <Select value={ga4ReportForm.scheduleDayOfMonth} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleDayOfMonth: value }))}>
                                <SelectTrigger id="ga4-schedule-day-month"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {ga4ReportForm.scheduleFrequency === "quarterly" ? (
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
                                      <div className="border-t my-1"></div>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/70">Specific Days</div>
                                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                        const suffix = getOrdinalSuffix(day);
                                        const isCommon = [1, 5, 10, 15, 20, 25].includes(day);
                                        return (
                                          <SelectItem key={day} value={day.toString()} className={isCommon ? "font-medium" : ""}>
                                            {day}{suffix} {isCommon && "⭐"}
                                          </SelectItem>
                                        );
                                      })}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground/70">
                                {ga4ReportForm.scheduleFrequency === "quarterly"
                                  ? "Quarterly reports typically run at the start, end, or middle of the quarter month"
                                  : "For months with fewer days, the report will run on the last available day"}
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="ga4-schedule-time">Time</Label>
                            <Select value={ga4ReportForm.scheduleTime} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleTime: value }))}>
                              <SelectTrigger id="ga4-schedule-time"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                                <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                                <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                                <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                                <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                                <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                                <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                                <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                                <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                                <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                                <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                                <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                                <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                              </SelectContent>
                            </Select>
                            {userTimeZone && (
                              <p className="text-sm text-muted-foreground/70">All times are in your time zone: {getTimeZoneDisplay()}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ga4-email-recipients">Email Recipients</Label>
                            <Input
                              id="ga4-email-recipients"
                              value={ga4ReportForm.emailRecipients}
                              onChange={(e) => {
                                const v = e.target.value;
                                setGa4ReportForm((p) => ({ ...p, emailRecipients: v }));
                                if (ga4ReportFormErrors.emailRecipients && String(v || "").trim()) {
                                  setGa4ReportFormErrors((prev) => ({ ...prev, emailRecipients: undefined }));
                                }
                              }}
                              placeholder="Enter email addresses (comma-separated)"
                              className={ga4ReportFormErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined}
                            />
                            {ga4ReportFormErrors.emailRecipients ? (
                              <p className="text-sm text-red-600 dark:text-red-400">{ga4ReportFormErrors.emailRecipients}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground/70">Reports will be automatically generated and sent to these email addresses</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Custom Report</h3>
                  <p className="text-sm text-muted-foreground/70">
                    Choose which GA4 sections to include in your PDF.
                  </p>
                </div>

                <div className="border rounded-lg p-4 border-border">
                  <div className="text-sm font-medium text-foreground/80/60 mb-3">Sections</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { key: "overview", label: "Overview" },
                      { key: "kpis", label: "KPIs Snapshot" },
                      { key: "benchmarks", label: "Benchmarks Snapshot" },
                      { key: "ads", label: "Ad Comparison" },
                      { key: "insights", label: "Insights" },
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

                {/* Schedule Automated Reports for Custom */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <Checkbox
                      id="ga4-custom-schedule-reports"
                      checked={ga4ReportForm.scheduleEnabled}
                      onCheckedChange={(checked) => {
                        const enabled = checked as boolean;
                        setGa4ReportForm((p) => ({ ...p, scheduleEnabled: enabled }));
                        if (!enabled) setGa4ReportFormErrors({});
                      }}
                    />
                    <Label htmlFor="ga4-custom-schedule-reports" className="text-base font-semibold cursor-pointer">
                      Schedule Automated Reports
                    </Label>
                  </div>

                  <div className="space-y-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="ga4-custom-report-name">Report Name</Label>
                      <Input
                        id="ga4-custom-report-name"
                        value={ga4ReportForm.name}
                        onChange={(e) => setGa4ReportForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Enter report name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ga4-custom-report-description">Description (Optional)</Label>
                      <Textarea
                        id="ga4-custom-report-description"
                        value={ga4ReportForm.description}
                        onChange={(e) => setGa4ReportForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Add a description for this report"
                        rows={2}
                      />
                    </div>

                    {ga4ReportForm.scheduleEnabled && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select value={ga4ReportForm.scheduleFrequency} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleFrequency: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {ga4ReportForm.scheduleFrequency === "weekly" && (
                          <div className="space-y-2">
                            <Label>Day of Week</Label>
                            <Select value={ga4ReportForm.scheduleDayOfWeek} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleDayOfWeek: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
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

                        {ga4ReportForm.scheduleFrequency === "quarterly" && (
                          <div className="space-y-2">
                            <Label>Quarter Timing</Label>
                            <Select value={ga4ReportForm.quarterTiming} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, quarterTiming: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                                <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70">Choose whether to run reports at the start or end of each quarter</p>
                          </div>
                        )}

                        {(ga4ReportForm.scheduleFrequency === "monthly" || ga4ReportForm.scheduleFrequency === "quarterly") && (
                          <div className="space-y-2">
                            <Label>Day of Month</Label>
                            <Select value={ga4ReportForm.scheduleDayOfMonth} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleDayOfMonth: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {ga4ReportForm.scheduleFrequency === "quarterly" ? (
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
                                    <div className="border-t my-1"></div>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/70">Specific Days</div>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                      const suffix = getOrdinalSuffix(day);
                                      const isCommon = [1, 5, 10, 15, 20, 25].includes(day);
                                      return (
                                        <SelectItem key={day} value={day.toString()} className={isCommon ? "font-medium" : ""}>
                                          {day}{suffix} {isCommon && "⭐"}
                                        </SelectItem>
                                      );
                                    })}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70">
                              {ga4ReportForm.scheduleFrequency === "quarterly"
                                ? "Quarterly reports typically run at the start, end, or middle of the quarter month"
                                : "For months with fewer days, the report will run on the last available day"}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Select value={ga4ReportForm.scheduleTime} onValueChange={(value) => setGa4ReportForm((p) => ({ ...p, scheduleTime: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                              <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                              <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                              <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                              <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                              <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                              <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                              <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                              <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                              <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                              <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                              <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                              <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                            </SelectContent>
                          </Select>
                          {userTimeZone && (
                            <p className="text-sm text-muted-foreground/70">All times are in your time zone: {getTimeZoneDisplay()}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Email Recipients{ga4ReportForm.scheduleEnabled ? " *" : ""}</Label>
                          <Input
                            value={ga4ReportForm.emailRecipients}
                            onChange={(e) => {
                              const v = e.target.value;
                              setGa4ReportForm((p) => ({ ...p, emailRecipients: v }));
                              if (ga4ReportFormErrors.emailRecipients && String(v || "").trim()) {
                                setGa4ReportFormErrors((prev) => ({ ...prev, emailRecipients: undefined }));
                              }
                            }}
                            placeholder="Enter email addresses (comma-separated)"
                            className={ga4ReportFormErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined}
                          />
                          {ga4ReportFormErrors.emailRecipients ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{ga4ReportFormErrors.emailRecipients}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground/70">Reports will be automatically generated and sent to these email addresses</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowGA4ReportModal(false);
                  setGa4ReportModalStep("standard");
                  setEditingGA4ReportId(null);
                  setGa4ReportForm({
                    name: "",
                    description: "",
                    reportType: "",
                    configuration: { sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false } },
                    scheduleEnabled: false,
                    scheduleFrequency: "daily",
                    scheduleDayOfWeek: "monday",
                    scheduleDayOfMonth: "first",
                    quarterTiming: "end",
                    scheduleTime: "9:00 AM",
                    emailRecipients: "",
                    status: "active",
                  });
                  setGa4ReportFormErrors({});
                }}
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  disabled={!ga4ReportForm.name || !ga4ReportForm.reportType || createGA4ReportMutation.isPending || updateGA4ReportMutation.isPending}
                  onClick={() => {
                    if (ga4ReportForm.scheduleEnabled) {
                      // Scheduled report: validate, save to library
                      if (!validateGA4ScheduledReportFields()) return;
                      const payload = buildGA4ReportPayload();
                      if (!String(payload.name || "").trim()) {
                        toast({ title: "Report name is required", variant: "destructive" });
                        return;
                      }
                      if (editingGA4ReportId) {
                        updateGA4ReportMutation.mutate({ reportId: editingGA4ReportId, payload });
                      } else {
                        createGA4ReportMutation.mutate(payload);
                      }
                    } else if (editingGA4ReportId) {
                      // Editing an existing scheduled report
                      const payload = buildGA4ReportPayload();
                      if (!String(payload.name || "").trim()) {
                        toast({ title: "Report name is required", variant: "destructive" });
                        return;
                      }
                      updateGA4ReportMutation.mutate({ reportId: editingGA4ReportId, payload });
                    } else {
                      // Generate and download immediately (don't save to library)
                      downloadGA4Report({
                        reportType: ga4ReportForm.reportType || "overview",
                        configuration: ga4ReportForm.configuration,
                        reportName: ga4ReportForm.name || undefined,
                      });
                      setShowGA4ReportModal(false);
                    }
                  }}
                  className="gap-2"
                >
                  {createGA4ReportMutation.isPending || updateGA4ReportMutation.isPending ? (
                    editingGA4ReportId ? "Updating..." : "Creating..."
                  ) : editingGA4ReportId ? (
                    "Update Report"
                  ) : ga4ReportForm.scheduleEnabled ? (
                    "Schedule Report"
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate & Download Report
                    </>
                  )}
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle>Select GA4 campaigns to import</DialogTitle>
            <DialogDescription>
              Choose one or more GA4 campaign values to scope this MimoSaaS campaign. If you select none, we’ll track all campaigns in the selected property.
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

            <div className="rounded-lg border border-border p-3 max-h-[45vh] overflow-y-auto">
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
                        <label key={name} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
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
                              <div className="text-sm font-medium text-foreground truncate">{name}</div>
                              <div className="text-xs text-muted-foreground/70">Users: {Number(c?.users || 0).toLocaleString()}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground/70">
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
                        credentials: "include",
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
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Report</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/70">
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

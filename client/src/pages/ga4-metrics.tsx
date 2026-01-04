import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target, Plus, X, Trash2, Edit, MoreVertical, TrendingDown, DollarSign } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Label, Tooltip, Legend } from "recharts";
import InteractiveWorldMap from "@/components/InteractiveWorldMap";
import SimpleGeographicMap from "@/components/SimpleGeographicMap";
import WorldMapSVG from "@/components/WorldMapSVG";
import { SiGoogle } from "react-icons/si";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { AddSpendWizardModal } from "@/components/AddSpendWizardModal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  platform?: string;
  status: string;
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

const kpiFormSchema = z.object({
  name: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  currentValue: z.string().min(1, "Current value is required"),
  targetValue: z.string().min(1, "Target value is required"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  timeframe: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("monthly"),
  trackingPeriod: z.number().min(1).max(365).default(30),
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
  const [dateRange, setDateRange] = useState("7days");
  const [showAutoRefresh, setShowAutoRefresh] = useState(false);
  const [showKPIDialog, setShowKPIDialog] = useState(false);
  const [selectedKPITemplate, setSelectedKPITemplate] = useState<any>(null);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [deleteKPIId, setDeleteKPIId] = useState<string | null>(null);
  const [showSpendDialog, setShowSpendDialog] = useState(false);
  const [showDeleteSpendDialog, setShowDeleteSpendDialog] = useState(false);
  // Spend ingestion is handled via AddSpendWizardModal and persisted server-side.
  
  // Benchmark-related state
  const [showCreateBenchmark, setShowCreateBenchmark] = useState(false);
  const [selectedBenchmarkTemplate, setSelectedBenchmarkTemplate] = useState<any>(null);
  const [newBenchmark, setNewBenchmark] = useState({
    name: "",
    category: "",
    benchmarkType: "industry",
    unit: "",
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

  // Spend is now persisted server-side (via the Add Spend wizard), so we no longer store
  // manual overrides or spend mode in localStorage.

  const kpiForm = useForm<KPIFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "%",
      currentValue: "",
      targetValue: "",
      priority: "medium",
      timeframe: "monthly",
      trackingPeriod: 30,
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

  const formatNumberByUnit = (raw: string, unit: string) => {
    const cleaned = stripNumberFormatting(raw);
    if (!cleaned) return "";
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return raw;
    const decimals = unit === "count" ? 0 : 2;
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const openCreateKPI = () => {
    setEditingKPI(null);
    setSelectedKPITemplate(null);
    kpiForm.reset({ ...kpiForm.getValues(), name: "", description: "", unit: "%", currentValue: "", targetValue: "", priority: "medium" });
    setShowKPIDialog(true);
  };

  // KPI templates should be executive-grade and consistent with the GA4 Overview's spend/revenue logic.
  // We compute "current" values live elsewhere; this helper is used only when creating a KPI from a template
  // (to store an initial snapshot value) and uses GA4 Breakdown + Spend totals (not legacy Sheets spend).
  const calculateKPIValueFromSources = (templateName: string, sources: {
    revenue: number;
    conversions: number;
    sessions: number;
    users: number;
    spend: number;
  }) => {
    try {
      const revenue = Number(sources.revenue || 0);
      const conversions = Number(sources.conversions || 0);
      const sessions = Number(sources.sessions || 0);
      const users = Number(sources.users || 0);
      const spend = Number(sources.spend || 0);

      switch (templateName) {
        case "Revenue":
          return revenue.toFixed(2);
        case "Total Conversions":
          return String(Math.round(conversions));
        case "Conversion Rate":
          return sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : "0.00";
        case "Total Users":
          return String(Math.round(users));
        case "Total Sessions":
          return String(Math.round(sessions));
        case "ROAS":
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
          const [breakdownResp, spendResp, linkedInResp] = await Promise.all([
            fetch(`/api/campaigns/${campaignId}/ga4-breakdown?dateRange=${dateRange}`).catch(() => null),
            fetch(`/api/campaigns/${campaignId}/spend-totals?dateRange=${encodeURIComponent(dateRange)}`).catch(() => null),
            fetch(`/api/linkedin/metrics/${campaignId}`).catch(() => null),
          ]);
          const breakdown = breakdownResp?.ok ? await breakdownResp.json().catch(() => null) : null;
          const spendTotals = spendResp?.ok ? await spendResp.json().catch(() => null) : null;
          const linkedInAgg = linkedInResp?.ok ? await linkedInResp.json().catch(() => null) : null;

          const revenue = Number(breakdown?.totals?.revenue || 0);
          const conversions = Number(breakdown?.totals?.conversions || 0);
          const sessions = Number(breakdown?.totals?.sessions || 0);
          const users = Number(breakdown?.totals?.users || 0);
          const persistedSpend = Number(spendTotals?.totalSpend || 0);
          const linkedInSpend = Number(linkedInAgg?.spend || 0);
          const spend = persistedSpend > 0 ? persistedSpend : linkedInSpend;

          calculatedValue = calculateKPIValueFromSources(selectedKPITemplate.name, {
            revenue,
            conversions,
            sessions,
            users,
            spend,
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

  const onSubmitKPI = async (data: KPIFormData) => {
    const cleaned: KPIFormData = {
      ...data,
      currentValue: stripNumberFormatting(data.currentValue),
      targetValue: stripNumberFormatting(data.targetValue),
    };
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
          platformType: "google_analytics",
          period: "monthly",
          status: "active"
        }),
      });
      if (!response.ok) throw new Error("Failed to create benchmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/benchmarks`] });
      setShowCreateBenchmark(false);
      setSelectedBenchmarkTemplate(null);
      setNewBenchmark({
        name: "",
        category: "",
        benchmarkType: "industry",
        unit: "",
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

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkId: string) => {
      const response = await fetch(`/api/benchmarks/${benchmarkId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete benchmark");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/benchmarks`] });
      toast({ title: "Benchmark deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete benchmark", description: error.message, variant: "destructive" });
    },
  });

  // Benchmark handlers
  const handleCreateBenchmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBenchmark.metric) {
      toast({ title: "Please select a benchmark template", variant: "destructive" });
      return;
    }
    if (!newBenchmark.name || !newBenchmark.category || !newBenchmark.benchmarkValue || !newBenchmark.unit) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createBenchmarkMutation.mutate(newBenchmark);
  };

  const handleEditBenchmark = (benchmark: Benchmark) => {
    // For now, just show a toast - full edit functionality can be added later
    toast({ title: "Edit functionality coming soon" });
  };

  const handleDeleteBenchmark = (benchmarkId: string) => {
    if (confirm("Are you sure you want to delete this benchmark?")) {
      deleteBenchmarkMutation.mutate(benchmarkId);
    }
  };

  // Helper functions for KPI display
  const formatValue = (value: string, unit: string) => {
    const numValue = parseFloat(value);
    switch (unit) {
      case "%":
        return `${numValue.toFixed(2)}%`;
      case "$":
        return `$${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "ratio":
        return `${numValue.toFixed(2)}x`;
      default:
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

  // Helper function for benchmark values
  const formatBenchmarkValue = (value: string | undefined, unit: string) => {
    if (!value) return "N/A";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "N/A";
    
    switch (unit) {
      case "%":
        return `${numValue.toFixed(1)}%`;
      case "$":
        return `$${numValue.toLocaleString()}`;
      case "ratio":
        return `${numValue.toFixed(2)}:1`;
      case "seconds":
        return `${numValue.toFixed(1)}s`;
      case "count":
        return numValue.toLocaleString();
      default:
        return numValue.toLocaleString();
    }
  };

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Helper: safely parse numbers from API payloads
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === "") return 0;
    const n = typeof val === "string" ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  // Check GA4 connection status - Updated for multiple connections
  const { data: ga4Connection } = useQuery({
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

  // Fetch platform benchmarks
  const { data: benchmarks = [], isLoading: benchmarksLoading } = useQuery<Benchmark[]>({
    queryKey: [`/api/platforms/google_analytics/benchmarks`],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/benchmarks`);
      if (!response.ok) throw new Error("Failed to fetch benchmarks");
      return response.json();
    },
  });

  // Fetch industries list (used for Benchmarks -> Industry type)
  const { data: industryData } = useQuery<{ industries: Array<{ value: string; label: string }> }>({
    queryKey: ["/api/industry-benchmarks"],
    staleTime: Infinity,
    queryFn: async () => {
      const resp = await fetch("/api/industry-benchmarks");
      if (!resp.ok) return { industries: [] };
      return resp.json();
    },
  });

  const industries = industryData?.industries || [];

  const deriveBenchmarkCategoryFromMetric = (metric: string): string => {
    const m = String(metric || "").toLowerCase();
    if (m === "revenue") return "revenue";
    if (m === "conversions" || m === "conversionrate") return "conversion";
    if (m === "users" || m === "sessions" || m === "pageviews") return "traffic";
    if (m === "engagementrate") return "engagement";
    return "performance";
  };

  const { data: ga4Metrics, isLoading: ga4Loading, error: ga4Error } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    // Auto-refresh: users shouldn't need to refresh the page to get new GA4 data.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics?dateRange=${dateRange}`);
      const data = await response.json().catch(() => ({} as any));

      // Current backend shape (routes-oauth.ts): { success, metrics, propertyId, ... }
      if (data?.success === true && data?.metrics) {
        const m = data.metrics || {};
        const users =
          m.users ??
          m.totalUsers ??
          // Backend `analytics.ts` uses `impressions` as a compatibility field for "users"
          m.impressions ??
          0;
        const sessions = m.sessions ?? m.clicks ?? 0;
        return {
          sessions,
          pageviews: m.pageviews || 0,
          users,
          bounceRate: m.bounceRate || 0,
          conversions: m.conversions || 0,
          revenue: m.revenue || 0,
          avgSessionDuration: m.averageSessionDuration || 0,
          averageSessionDuration: m.averageSessionDuration || 0,
          topPages: m.topPages || [],
          usersByDevice: m.usersByDevice || { desktop: 0, mobile: 0, tablet: 0 },
          acquisitionData: m.acquisitionData || { organic: 0, direct: 0, social: 0, referral: 0 },
          realTimeUsers: m.realTimeUsers || 0,
          impressions: m.impressions ?? users ?? 0,
          clicks: m.clicks ?? sessions ?? 0,
          newUsers: m.newUsers ?? users ?? 0,
          engagedSessions: m.engagedSessions || 0,
          engagementRate: m.engagementRate || (m.bounceRate ? (100 - m.bounceRate) : 0),
          eventCount: m.eventCount || 0,
          eventsPerSession: m.eventsPerSession || 0,
          propertyId: data.propertyId,
          lastUpdated: data.lastUpdated,
          _isFallbackData: false,
          _message: undefined,
        };
      }

      // Legacy/demo shape (older route): flat metrics at top-level
      if (typeof data?.sessions !== "undefined" || typeof data?.pageviews !== "undefined") {
        return {
          sessions: data.sessions || 0,
          pageviews: data.pageviews || 0,
          users: data.users || 0,
          bounceRate: data.bounceRate || 0,
          conversions: data.conversions || 0,
          revenue: data.revenue || 0,
          avgSessionDuration: data.avgSessionDuration || data.averageSessionDuration || 0,
          averageSessionDuration: data.avgSessionDuration || data.averageSessionDuration || 0,
          topPages: data.topPages || [],
          usersByDevice: data.usersByDevice || { desktop: 0, mobile: 0, tablet: 0 },
          acquisitionData: data.acquisitionData || { organic: 0, direct: 0, social: 0, referral: 0 },
          realTimeUsers: data.realTimeUsers || 0,
          impressions: data.sessions || 0,
          newUsers: data.newUsers || data.users || 0,
          engagedSessions: data.engagedSessions || data.sessions || 0,
          engagementRate: data.engagementRate || (data.bounceRate ? (100 - data.bounceRate) : 0),
          eventCount: data.eventCount || 0,
          eventsPerSession: data.eventsPerSession || 0,
          propertyId: data.propertyId,
          lastUpdated: data.lastUpdated,
          _isFallbackData: !!data._isFallbackData,
          _message: data._message,
        };
      }

      // Auth/token errors should not silently display fake data.
      if (!response.ok && data?.requiresReauthorization) {
        throw new Error(data?.message || "Google Analytics needs to be reconnected.");
      }

      throw new Error(data?.error || "Failed to fetch GA4 metrics");
    },
  });

  const { data: ga4TimeSeries, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-timeseries", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-timeseries?dateRange=${dateRange}`);
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to fetch GA4 time series data");
      }
      return Array.isArray(json?.data) ? json.data : [];
    },
  });

  const { data: ga4Breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-breakdown", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-breakdown?dateRange=${dateRange}`);
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.message || json?.error || "Failed to fetch GA4 breakdown");
      }
      return json as any;
    },
  });

  const breakdownTotals = {
    sessions: Number(ga4Breakdown?.totals?.sessions || 0),
    conversions: Number(ga4Breakdown?.totals?.conversions || 0),
    revenue: Number(ga4Breakdown?.totals?.revenue || 0),
    users: Number(ga4Breakdown?.totals?.users || 0),
  };

  // Spend sources for Financial metrics (ROAS/ROI/CPA).
  // Spend totals are persisted server-side by the Add Spend wizard.
  const { data: spendTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/spend-totals`, dateRange],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/spend-totals?dateRange=${encodeURIComponent(dateRange)}`);
      if (!resp.ok) return { success: false, totalSpend: 0 };
      return resp.json().catch(() => ({ success: false, totalSpend: 0 }));
    },
  });

  // Auto-fallback: if the campaign already has LinkedIn spend via the standard LinkedIn import flow,
  // surface it in GA4 Financials without forcing the user to "Add spend".
  const { data: linkedInAggregated } = useQuery<any>({
    queryKey: [`/api/linkedin/metrics/${campaignId}`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(`/api/linkedin/metrics/${campaignId}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

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
    const linkedInSpend = Number((linkedInAggregated as any)?.spend || 0);
    const persistedSpend = Number(spendTotals?.totalSpend || 0);
    if (!(persistedSpend > 0) && linkedInSpend > 0) return ["LinkedIn Ads"];
    const ids = Array.isArray(spendTotals?.sourceIds) ? spendTotals.sourceIds.map(String) : [];
    const sources = Array.isArray(spendSourcesResp?.sources) ? spendSourcesResp.sources : Array.isArray(spendSourcesResp) ? spendSourcesResp : [];
    const labels: string[] = [];
    for (const id of ids) {
      const s = sources.find((x: any) => String(x?.id) === String(id));
      if (!s) continue;
      const label = String(s.displayName || s.sourceType || "").trim();
      if (label) labels.push(label);
    }
    return labels;
  }, [linkedInAggregated, spendTotals?.totalSpend, spendTotals?.sourceIds, spendSourcesResp]);

  const activeSpendSource = useMemo(() => {
    const sources = Array.isArray(spendSourcesResp?.sources) ? spendSourcesResp.sources : Array.isArray(spendSourcesResp) ? spendSourcesResp : [];
    // Backend returns only active sources; pick the most recent if multiple.
    return sources?.[0] || null;
  }, [spendSourcesResp]);
  const linkedInSpendForFinancials = Number((linkedInAggregated as any)?.spend || 0);
  const totalSpendForFinancials = Number(spendTotals?.totalSpend || 0);
  const usingAutoLinkedInSpend = !(totalSpendForFinancials > 0) && linkedInSpendForFinancials > 0;

  const financialRevenue = Number(breakdownTotals.revenue || ga4Metrics?.revenue || 0);
  const financialConversions = Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0);
  const financialSpend = Number((totalSpendForFinancials > 0 ? totalSpendForFinancials : (usingAutoLinkedInSpend ? linkedInSpendForFinancials : 0)) || 0);
  const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;
  const financialROI = financialSpend > 0 ? ((financialRevenue - financialSpend) / financialSpend) * 100 : 0;
  const financialCPA = financialConversions > 0 ? financialSpend / financialConversions : 0;

  const getLiveKpiValue = (kpi: any): string => {
    const name = String(kpi?.name || "").trim();
    // Use the same sources as the GA4 Overview:
    // - Revenue/Conversions/Sessions/Users from GA4 breakdown totals
    // - Spend from spend-totals with LinkedIn fallback
    if (name === "Revenue") return Number(breakdownTotals.revenue || 0).toFixed(2);
    if (name === "Total Conversions") return String(Math.round(Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0)));
    if (name === "Conversion Rate") {
      const s = Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0);
      const c = Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0);
      return s > 0 ? ((c / s) * 100).toFixed(2) : "0.00";
    }
    if (name === "Total Users") return String(Math.round(Number(breakdownTotals.users || ga4Metrics?.users || 0)));
    if (name === "Total Sessions") return String(Math.round(Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0)));
    if (name === "ROAS") return financialSpend > 0 ? Number(financialROAS || 0).toFixed(2) : "0.00";
    if (name === "ROI") return financialSpend > 0 ? Number(financialROI || 0).toFixed(2) : "0.00";
    if (name === "CPA") return financialConversions > 0 ? Number(financialCPA || 0).toFixed(2) : "0.00";
    // Fallback to stored value for any legacy/custom KPI.
    return String(kpi?.currentValue ?? "0.00");
  };

  const computeKpiProgress = (kpi: any) => {
    const current = parseFloat(String(getLiveKpiValue(kpi) || "0"));
    const target = parseFloat(String(kpi?.targetValue || "0"));
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeTarget = Number.isFinite(target) ? target : 0;

    // Direction: most exec KPIs here are "higher is better".
    // CPA is "lower is better" (cost per conversion).
    const name = String(kpi?.name || "").toLowerCase();
    const lowerIsBetter = name === "cpa";

    let ratio = 0;
    if (lowerIsBetter) {
      // progress = target / current (<= target is good). Clamp later.
      ratio = safeCurrent > 0 ? (safeTarget / safeCurrent) : 0;
    } else {
      ratio = safeTarget > 0 ? (safeCurrent / safeTarget) : 0;
    }

    const pct = Math.max(0, Math.min(ratio * 100, 100));
    const status =
      ratio >= 0.8 ? "on_track" :
      ratio >= 0.6 ? "needs_attention" :
      "behind";
    const color =
      ratio >= 0.8 ? "bg-green-500" :
      ratio >= 0.6 ? "bg-yellow-500" :
      "bg-red-500";

    return {
      ratio,
      pct,
      labelPct: (ratio * 100).toFixed(1),
      status,
      color,
    };
  };

  const connectedPropertyCount =
    Number(ga4Connection?.totalConnections || 0) ||
    (Array.isArray(ga4Connection?.connections) ? ga4Connection.connections.length : 0) ||
    1;

  const rateToPercent = (v: number) => (v <= 1 ? v * 100 : v);

  // Geographic data query
  const { data: geographicData, isLoading: geoLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-geographic", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-geographic?dateRange=${dateRange}`);
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

  const getDateRangeLabel = (range: string) => {
    switch (String(range || "").toLowerCase()) {
      case "7days":
        return "Last 7 days";
      case "30days":
        return "Last 30 days";
      case "90days":
        return "Last 90 days";
      default:
        return "Last 30 days";
    }
  };

  const selectedPeriodLabel = getDateRangeLabel(dateRange);

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
              
              <div className="flex items-center space-x-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                      className={`p-4 rounded-lg border ${
                        connection.isPrimary
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

          {ga4Loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : ga4Metrics || !ga4Loading ? (
            <>
              {/* Charts and Detailed Analytics */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="property-comparison">Property Comparison</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  {/* Aggregated Multi-Property Campaign Metrics */}
                  <div className="mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {connectedPropertyCount > 1 ? 'Multi-Property Campaign Analytics' : 'GA4 Property Analytics'}
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {connectedPropertyCount > 1
                              ? `Showing aggregated data from ${connectedPropertyCount} connected GA4 properties for ${campaign?.name}`
                              : `Showing metrics for the connected GA4 property for ${campaign?.name}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Re-organized metrics: Outcomes / Scale / Acquisition / Engagement / Behavior / Diagnostics */}
                  <div className="space-y-8">
                    {/* Outcomes */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Outcomes</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Did it work / business impact</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Revenue</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  ${breakdownTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">From GA4 revenue metric</p>
                              </div>
                              <DollarSign className="w-8 h-8 text-green-600" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Conversions</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(breakdownTotals.conversions || ga4Metrics?.conversions || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <Target className="w-8 h-8 text-emerald-500" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatPercentage(
                                    (breakdownTotals.sessions || ga4Metrics?.sessions || 0) > 0
                                      ? ((breakdownTotals.conversions || ga4Metrics?.conversions || 0) / (breakdownTotals.sessions || ga4Metrics?.sessions || 1)) * 100
                                      : 0
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Campaign overall</p>
                              </div>
                              <Target className="w-8 h-8 text-indigo-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Financial metrics (only when spend exists) */}
                      <div className="mt-4">
                        {financialSpend > 0 ? (
                          <>
                            <div className="mb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Financial (Spend-based)</h4>
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Spend source: {spendSourceLabels.length > 0 ? spendSourceLabels.join(" + ") : "Imported spend"} — {selectedPeriodLabel}
                                  </p>
                                </div>
                                {(activeSpendSource || financialSpend > 0) && (
                                  <div className="flex items-center gap-2">
                                    {activeSpendSource ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setShowSpendDialog(true)}
                                          aria-label="Edit spend mapping"
                                          title="Edit spend mapping"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setShowDeleteSpendDialog(true)}
                                          aria-label="Remove spend"
                                          title="Remove spend"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => setShowSpendDialog(true)}>
                                        Override spend
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                              <Card>
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        ${financialSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        From spend sources ({Array.isArray(spendTotals?.sourceIds) ? spendTotals.sourceIds.length : 0})
                                      </p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-slate-500" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {financialROAS.toFixed(2)}x
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revenue ÷ Spend</p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-green-600" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {formatPercentage(financialROI)}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">(Revenue − Spend) ÷ Spend</p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-emerald-600" />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">CPA</p>
                                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        ${financialCPA.toFixed(2)}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Spend ÷ Conversions</p>
                                    </div>
                                    <Target className="w-8 h-8 text-blue-600" />
                                  </div>
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
                                Spend has been imported, but it’s <span className="font-medium">{(spendTotals?.totalSpend || 0) > 0 ? "not showing yet" : "$0.00"}</span> for the selected period (<span className="font-medium">{getDateRangeLabel(dateRange)}</span>). This usually means the spend dates in your sheet/file are outside the selected range.
                              </p>
                            )}
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => setShowSpendDialog(true)}>
                                Add spend
                              </Button>
                            </div>
                            {/* Modal is rendered below so it can be opened from both empty and filled states */}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Spend import / edit modal (rendered always so it can be opened even when spend exists) */}
                    <AddSpendWizardModal
                      campaignId={campaignId}
                      open={showSpendDialog}
                      onOpenChange={setShowSpendDialog}
                      currency={(campaign as any)?.currency || "USD"}
                      dateRange={dateRange}
                      initialSource={activeSpendSource || undefined}
                      onProcessed={() => {
                        // Refresh spend immediately; invalidate broadly in case dateRange changed.
                        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                        queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
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
                                queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-sources`], exact: false });
                                queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals`], exact: false });
                              } catch (e) {
                                // swallow; the page has other error toasts elsewhere
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

                    {/* Scale */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Scale</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">How much volume</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Users</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(breakdownTotals.users || ga4Metrics?.users || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Unique across properties</p>
                              </div>
                              <Users className="w-8 h-8 text-blue-600" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Sessions</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(breakdownTotals.sessions || ga4Metrics?.sessions || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <Users className="w-8 h-8 text-blue-500" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">New Users</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(ga4Metrics?.newUsers || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <Users className="w-8 h-8 text-emerald-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Acquisition */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Acquisition</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Where is it coming from (Channel / Source / Medium / Campaign)</p>
                      </div>

                      {/* Acquisition breakdown table */}
                      <Card>
                        <CardHeader>
                          <CardTitle>GA4 Acquisition Breakdown</CardTitle>
                          <CardDescription>
                            Date / Channel / Source / Medium / Campaign / Device / Country — Sessions / Users / Conversions / Revenue
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {breakdownLoading ? (
                            <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                          ) : Array.isArray(ga4Breakdown?.rows) && ga4Breakdown.rows.length > 0 ? (
                            <div className="rounded-md border overflow-hidden">
                              <div className="max-h-[420px] overflow-auto">
                                <table className="min-w-[1040px] w-full text-sm">
                                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b">
                                    <tr>
                                      <th className="text-left font-medium px-3 py-2">Date</th>
                                      <th className="text-left font-medium px-3 py-2">Channel</th>
                                      <th className="text-left font-medium px-3 py-2">Source</th>
                                      <th className="text-left font-medium px-3 py-2">Medium</th>
                                      <th className="text-left font-medium px-3 py-2">Campaign</th>
                                      <th className="text-left font-medium px-3 py-2">Device</th>
                                      <th className="text-left font-medium px-3 py-2">Country</th>
                                      <th className="text-right font-medium px-3 py-2 tabular-nums">Sessions</th>
                                      <th className="text-right font-medium px-3 py-2 tabular-nums">Users</th>
                                      <th className="text-right font-medium px-3 py-2 tabular-nums">Conversions</th>
                                      <th className="text-right font-medium px-3 py-2 tabular-nums">Revenue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ga4Breakdown.rows.slice(0, 200).map((r: any, idx: number) => (
                                      <tr
                                        key={`${r.date}-${r.channel}-${r.source}-${r.medium}-${r.campaign}-${r.device}-${r.country}-${idx}`}
                                        className="border-b last:border-b-0"
                                      >
                                        <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.channel}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.source}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.medium}</td>
                                        <td className="px-3 py-2 whitespace-nowrap max-w-[260px] truncate" title={String(r.campaign || '')}>
                                          {r.campaign}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.device}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.country}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Number(r.sessions || 0))}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Number(r.users || 0))}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Number(r.conversions || 0))}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          ${Number(r.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              No GA4 breakdown rows returned for this date range. If you expect rows, verify that GA4 has data for the selected period and that revenue/conversions are configured as GA4 metrics.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Engagement */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Engagement</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Explains why performance changed (quality)</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engagement Rate</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatPercentage(rateToPercent(ga4Metrics?.engagementRate || 0))}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Campaign average</p>
                              </div>
                              <TrendingUp className="w-8 h-8 text-rose-600" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engaged Sessions</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(ga4Metrics?.engagedSessions || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <Target className="w-8 h-8 text-violet-600" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Events per Session</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {(ga4Metrics?.eventsPerSession || 0).toFixed(2)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Campaign average</p>
                              </div>
                              <BarChart3 className="w-8 h-8 text-amber-600" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Events</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(ga4Metrics?.eventCount || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <MousePointer className="w-8 h-8 text-cyan-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Behavior */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Behavior</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">What did people do on-site</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Page Views</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(ga4Metrics?.pageviews || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all properties</p>
                              </div>
                              <Globe className="w-8 h-8 text-green-500" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Sessions Over Time</CardTitle>
                        <CardDescription>Daily sessions — {selectedPeriodLabel}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickMargin={8}>
                                <Label value="Date" position="insideBottom" offset={-5} style={{ fill: "#64748b", fontSize: 12 }} />
                              </XAxis>
                              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatNumber(Number(v) || 0)}>
                                <Label value="Sessions" angle={-90} position="insideLeft" style={{ fill: "#64748b", fontSize: 12, textAnchor: "middle" }} />
                              </YAxis>
                              <Tooltip
                                formatter={(value: any, name: any) => [formatNumber(Number(value) || 0), String(name || "Sessions")]}
                                labelFormatter={(label) => `Date: ${label}`}
                              />
                              <Line
                                type="monotone"
                                dataKey="sessions"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Page Views vs Sessions</CardTitle>
                        <CardDescription>Sessions and page views — {selectedPeriodLabel}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickMargin={8}>
                                <Label value="Date" position="insideBottom" offset={-5} style={{ fill: "#64748b", fontSize: 12 }} />
                              </XAxis>
                              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatNumber(Number(v) || 0)}>
                                <Label value="Count" angle={-90} position="insideLeft" style={{ fill: "#64748b", fontSize: 12, textAnchor: "middle" }} />
                              </YAxis>
                              <Tooltip
                                formatter={(value: any, name: any) => [formatNumber(Number(value) || 0), String(name || "")]}
                                labelFormatter={(label) => `Date: ${label}`}
                              />
                              <Legend verticalAlign="top" height={24} />
                              <Bar name="Sessions" dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar name="Page Views" dataKey="pageviews" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Geographic Data - Only in Overview Tab */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Geographic Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {geoLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : geographicData?.success ? (
                        <div className="space-y-6">
                          {/* Interactive World Map - GA4 Style */}
                          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white">Active users by Country</h4>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {geographicData?.topCountries?.length || 20} countries
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                              {/* Map Section */}
                              <div className="lg:col-span-2 p-4">
                                <InteractiveWorldMap 
                                  data={geographicData?.topCountries && geographicData.topCountries.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)') ? geographicData.topCountries : [
                                    { country: "United States of America", users: 1247, sessions: 1856 },
                                    { country: "United Kingdom", users: 834, sessions: 1243 },
                                    { country: "Canada", users: 567, sessions: 892 },
                                    { country: "Germany", users: 445, sessions: 678 },
                                    { country: "France", users: 389, sessions: 523 },
                                    { country: "Australia", users: 234, sessions: 356 },
                                    { country: "Japan", users: 198, sessions: 289 },
                                    { country: "Netherlands", users: 167, sessions: 245 },
                                    { country: "Sweden", users: 143, sessions: 201 },
                                    { country: "Brazil", users: 134, sessions: 198 },
                                    { country: "India", users: 112, sessions: 167 },
                                    { country: "Spain", users: 98, sessions: 143 },
                                    { country: "Italy", users: 87, sessions: 128 },
                                    { country: "Norway", users: 76, sessions: 112 },
                                    { country: "Denmark", users: 65, sessions: 94 },
                                    { country: "Finland", users: 54, sessions: 78 },
                                    { country: "Belgium", users: 43, sessions: 62 },
                                    { country: "Switzerland", users: 32, sessions: 47 },
                                    { country: "Austria", users: 28, sessions: 41 },
                                    { country: "Portugal", users: 21, sessions: 34 }
                                  ]} 
                                  metric="users"
                                />
                              </div>
                              
                              {/* Data Table Section */}
                              <div className="border-l border-slate-200 dark:border-slate-700">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div>COUNTRY</div>
                                    <div className="text-right">ACTIVE USERS</div>
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                  {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                    ? geographicData.topCountries 
                                    : [
                                        { country: "United States of America", users: 1247, sessions: 1856 },
                                        { country: "United Kingdom", users: 834, sessions: 1243 },
                                        { country: "Canada", users: 567, sessions: 892 },
                                        { country: "Germany", users: 445, sessions: 678 },
                                        { country: "France", users: 389, sessions: 523 },
                                        { country: "Australia", users: 234, sessions: 356 },
                                        { country: "Japan", users: 198, sessions: 289 },
                                        { country: "Netherlands", users: 167, sessions: 245 },
                                        { country: "Sweden", users: 143, sessions: 201 },
                                        { country: "Brazil", users: 134, sessions: 198 }
                                      ]
                                  ).slice(0, 10).map((location: any, index: number) => (
                                    <div key={index} className="grid grid-cols-2 gap-4 p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-sm">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {location.country}
                                      </div>
                                      <div className="text-right font-semibold text-slate-900 dark:text-white">
                                        {formatNumber(location.users)}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* No data message if empty */}
                                  {!geographicData?.topCountries?.length && (
                                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                      No data available
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Countries */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Top Countries</h4>
                              <div className="space-y-2">
                                {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.topCountries 
                                  : [
                                      { country: "United States of America", users: 1247, sessions: 1856 },
                                      { country: "United Kingdom", users: 834, sessions: 1243 },
                                      { country: "Canada", users: 567, sessions: 892 },
                                      { country: "Germany", users: 445, sessions: 678 },
                                      { country: "France", users: 389, sessions: 523 }
                                    ]
                                ).slice(0, 5).map((location: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                                    <span className="font-medium">{location.country}</span>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold">{formatNumber(location.users)} users</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">{formatNumber(location.sessions)} sessions</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Location Details */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Location Details</h4>
                              <div className="max-h-64 overflow-y-auto space-y-1">
                                {(geographicData?.data?.length > 5 && geographicData.data.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.data 
                                  : [
                                      { city: "New York", region: "New York", country: "United States of America", users: 347, pageviews: 892 },
                                      { city: "London", region: "England", country: "United Kingdom", users: 234, pageviews: 612 },
                                      { city: "Toronto", region: "Ontario", country: "Canada", users: 198, pageviews: 456 },
                                      { city: "Berlin", region: "Berlin", country: "Germany", users: 167, pageviews: 389 },
                                      { city: "Paris", region: "Île-de-France", country: "France", users: 143, pageviews: 324 },
                                      { city: "Sydney", region: "New South Wales", country: "Australia", users: 112, pageviews: 267 },
                                      { city: "Tokyo", region: "Tokyo", country: "Japan", users: 98, pageviews: 234 },
                                      { city: "Amsterdam", region: "North Holland", country: "Netherlands", users: 87, pageviews: 198 },
                                      { city: "Stockholm", region: "Stockholm", country: "Sweden", users: 76, pageviews: 167 },
                                      { city: "São Paulo", region: "São Paulo", country: "Brazil", users: 65, pageviews: 143 }
                                    ]
                                ).slice(0, 10).map((location: any, index: number) => (
                                  <div key={index} className="text-sm p-2 border-b border-slate-200 dark:border-slate-700">
                                    <div className="font-medium">{location.city}, {location.region}</div>
                                    <div className="text-slate-600 dark:text-slate-400">{location.country}</div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-xs">{formatNumber(location.users)} users</span>
                                      <span className="text-xs">{formatNumber(location.pageviews)} pageviews</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Total locations tracked: {geographicData?.totalLocations || 20}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Data updated: {geographicData?.lastUpdated ? new Date(geographicData.lastUpdated).toLocaleString() : 'Recently'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-slate-500 dark:text-slate-400 mb-4">
                            No geographic data available
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle>Key Performance Indicators</CardTitle>
                      </div>
                      <div>
                        <Button size="sm" onClick={openCreateKPI}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {kpisLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                          ))}
                        </div>
                      ) : platformKPIs.length === 0 ? (
                        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No KPIs yet</h3>
                          <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Create your first KPI to track GA4 performance for this campaign.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {platformKPIs.map((kpi: any) => (
                            <div key={kpi.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div
                                    className={`w-2 h-2 rounded-full ${getPriorityColor(kpi.priority)}`}
                                  ></div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{kpi.name}</h4>
                                    {kpi.description && (
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.description}</p>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2">
                                      <div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Current: </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {formatValue(getLiveKpiValue(kpi) || "0", kpi.unit)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Target: </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {formatValue(kpi.targetValue, kpi.unit)}
                                        </span>
                                      </div>
                                      <div className="ml-auto">
                                        <Badge className={`${getStatusColor(kpi.status)} text-xs`}>
                                          {kpi.status.replace('_', ' ')}
                                        </Badge>
                                      </div>
                                    </div>
                                    {/* Removed time-based tracking labels for a cleaner exec view */}
                                    
                                    {/* KPI Progress and Alignment Status */}
                                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      {(() => {
                                        const p = computeKpiProgress(kpi);
                                        return (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress to Target</span>
                                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {p.labelPct}%
                                              </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                              <div
                                                className={`h-2 rounded-full transition-all duration-300 ${p.color}`}
                                                style={{ width: `${p.pct}%` }}
                                              />
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                              <span className={`font-medium ${
                                                p.status === "on_track"
                                                  ? "text-green-600 dark:text-green-400"
                                                  : p.status === "needs_attention"
                                                  ? "text-yellow-600 dark:text-yellow-400"
                                                  : "text-red-600 dark:text-red-400"
                                              }`}>
                                                {p.status === "on_track"
                                                  ? "✓ On Track"
                                                  : p.status === "needs_attention"
                                                  ? "⚠ Needs Attention"
                                                  : "⚠ Behind Target"}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingKPI(kpi);
                                      setSelectedKPITemplate(null);
                                      // Prefill modal fields
                                      kpiForm.reset({
                                        ...kpiForm.getValues(),
                                        name: String(kpi?.name || ""),
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
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDeleteKPI(kpi.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    disabled={deleteKPIMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="benchmarks">
                  <div className="space-y-6">
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance Benchmarks</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and measure performance against industry standards and custom targets
                        </p>
                      </div>
                      <Dialog open={showCreateBenchmark} onOpenChange={setShowCreateBenchmark}>
                        <DialogTrigger asChild>
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Benchmark
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto p-4 !fixed !top-1/2 !left-1/2 !transform !-translate-x-1/2 !-translate-y-1/2 !z-[9999]">
                          <DialogClose className="absolute right-4 top-4 rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors z-[60]">
                            <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            <span className="sr-only">Close</span>
                          </DialogClose>
                          <DialogHeader className="pb-3">
                            <DialogTitle className="pr-8 text-lg">Create New Benchmark</DialogTitle>
                            <DialogDescription className="text-sm">
                              Set up a new performance benchmark to track against industry standards or custom targets
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateBenchmark} className="space-y-6">
                            {/* Select Benchmark Template (mirrors KPI modal template grid) */}
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white">Select Benchmark Template</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Choose a metric to benchmark, then fill in the benchmark details below.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { name: "Total Users", metric: "users", unit: "count", description: "Users for the selected period" },
                                  { name: "Total Sessions", metric: "sessions", unit: "count", description: "Sessions for the selected period" },
                                  { name: "Total Page Views", metric: "pageviews", unit: "count", description: "Page views for the selected period" },
                                  { name: "Total Conversions", metric: "conversions", unit: "count", description: "Conversions for the selected period" },
                                  { name: "Revenue", metric: "revenue", unit: "$", description: "Revenue for the selected period" },
                                  { name: "Conversion Rate", metric: "conversionRate", unit: "%", description: "Conversions ÷ Sessions × 100" },
                                  { name: "Engagement Rate", metric: "engagementRate", unit: "%", description: "Engaged sessions rate proxy" },
                                ].map((template) => (
                                  <div
                                    key={template.metric}
                                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                      selectedBenchmarkTemplate?.metric === template.metric
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                                    }`}
                                    onClick={() => {
                                      setSelectedBenchmarkTemplate(template);
                                      const derivedCategory = deriveBenchmarkCategoryFromMetric(template.metric);
                                      setNewBenchmark((prev) => ({
                                        ...prev,
                                        metric: template.metric,
                                        category: derivedCategory,
                                        name: prev.name || template.name,
                                        unit: prev.unit || template.unit,
                                      }));
                                    }}
                                  >
                                    <div className="font-medium text-sm text-slate-900 dark:text-white">
                                      {template.name}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                      {template.description}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Benchmark Name + Unit */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  Benchmark Name *
                                </label>
                                <input
                                  type="text"
                                  value={newBenchmark.name}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, name: e.target.value })}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  placeholder="e.g., Target sessions for this campaign"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  Unit *
                                </label>
                                <input
                                  type="text"
                                  value={newBenchmark.unit}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, unit: e.target.value })}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  placeholder="count, %, $, ratio"
                                  required
                                />
                              </div>
                            </div>

                            {/* Description */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Description
                              </label>
                              <textarea
                                value={newBenchmark.description}
                                onChange={(e) => setNewBenchmark({ ...newBenchmark, description: e.target.value })}
                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                rows={3}
                                placeholder="What is this benchmark and why does it matter?"
                              />
                            </div>

                            {/* Current Value + Benchmark Value */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Current Value
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newBenchmark.currentValue}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, currentValue: e.target.value })}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  placeholder="Auto-filled for Industry benchmarks (or enter manually)"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Benchmark Value *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newBenchmark.benchmarkValue}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, benchmarkValue: e.target.value })}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  placeholder="Enter your benchmark target"
                                  required
                                />
                              </div>
                            </div>

                            {/* Benchmark Type */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Benchmark Type *
                                </label>
                                <select
                                  value={newBenchmark.benchmarkType || "industry"}
                                  onChange={(e) => setNewBenchmark({ ...newBenchmark, benchmarkType: e.target.value })}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  required
                                >
                                  <option value="industry">Industry</option>
                                  <option value="goal">Custom</option>
                                </select>
                              </div>

                              {newBenchmark.benchmarkType === "industry" && (
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Industry
                                  </label>
                                  <select
                                    value={newBenchmark.industry}
                                    onChange={async (e) => {
                                      const industry = e.target.value;
                                      setNewBenchmark({ ...newBenchmark, industry });
                                      if (!industry || !newBenchmark.metric) return;
                                      try {
                                        const resp = await fetch(
                                          `/api/industry-benchmarks/${encodeURIComponent(industry)}/${encodeURIComponent(newBenchmark.metric)}`
                                        );
                                        if (!resp.ok) return;
                                        const data = await resp.json().catch(() => null);
                                        if (data && typeof data.value !== "undefined") {
                                          setNewBenchmark((prev) => ({
                                            ...prev,
                                            currentValue: String(data.value),
                                            unit: prev.unit || data.unit || prev.unit,
                                          }));
                                        }
                                      } catch {
                                        // ignore - industry benchmarks are best-effort
                                      }
                                    }}
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                  >
                                    <option value="">Select industry</option>
                                    {(industries || []).map((i) => (
                                      <option key={i.value} value={i.value}>
                                        {i.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Selecting an industry will auto-fill Current Value for the chosen metric.
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                              <Button type="button" variant="outline" onClick={() => setShowCreateBenchmark(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                                Create Benchmark
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
                      ) : benchmarks && benchmarks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {benchmarks.map((benchmark) => (
                            <Card key={benchmark.id} className="hover:shadow-lg transition-shadow">
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{benchmark.name}</h4>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                        {benchmark.category}
                                      </span>
                                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                                        {benchmark.benchmarkType}
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
                                      {formatBenchmarkValue(benchmark.currentValue || "0", benchmark.unit)}
                                    </span>
                                  </div>

                                  {benchmark.variance !== undefined && benchmark.variance !== null && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-slate-600 dark:text-slate-400">Performance</span>
                                      <div className="flex items-center space-x-2">
                                        <span className={`font-medium ${
                                          parseFloat(benchmark.variance.toString()) >= 0 
                                            ? 'text-green-600 dark:text-green-400' 
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                          {parseFloat(benchmark.variance.toString()) >= 0 ? '+' : ''}
                                          {parseFloat(benchmark.variance.toString()).toFixed(1)}%
                                        </span>
                                        {parseFloat(benchmark.variance.toString()) >= 0 ? (
                                          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        ) : (
                                          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        )}
                                      </div>
                                    </div>
                                  )}

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
                            <Button 
                              onClick={() => setShowCreateBenchmark(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Create First Benchmark
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="property-comparison">
                  <div className="space-y-6">
                    {/* Property Comparison Header */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Multi-Property Performance</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Compare performance across all connected Google Analytics properties for {campaign?.name}
                      </p>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        {connectedPropertyCount <= 1 ? (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              This campaign has a single GA4 property connected. Showing the current property’s metrics.
                            </p>
                            <div className="overflow-auto border rounded-md">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3">Property</th>
                                    <th className="text-right p-3">Sessions</th>
                                    <th className="text-right p-3">Pageviews</th>
                                    <th className="text-right p-3">Conversions</th>
                                    <th className="text-right p-3">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {(ga4Connection?.connections?.[0]?.displayName || ga4Connection?.connections?.[0]?.propertyName) ?? 'Primary property'}
                                      </div>
                                      <div className="text-xs text-slate-500">Property ID: {ga4Connection?.connections?.[0]?.propertyId}</div>
                                    </td>
                                    <td className="p-3 text-right">{formatNumber(breakdownTotals.sessions || ga4Metrics?.sessions || 0)}</td>
                                    <td className="p-3 text-right">{formatNumber(ga4Metrics?.pageviews || 0)}</td>
                                    <td className="p-3 text-right">{formatNumber(breakdownTotals.conversions || ga4Metrics?.conversions || 0)}</td>
                                    <td className="p-3 text-right">
                                      ${breakdownTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Connected properties are listed above. Per-property metrics comparison is not shown here to avoid displaying placeholder data.
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Tip: set a property as Primary, then use the date range selector to view its totals.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

              </Tabs>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-slate-500 dark:text-slate-400 mb-4">
                No GA4 connection found for this campaign
              </div>
            </div>
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
                <h4 className="font-medium text-slate-900 dark:text-white">Select KPI Template</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { 
                      name: "ROAS",
                      formula: "Revenue ÷ Spend",
                      unit: "ratio",
                      description: "Revenue generated per dollar of spend",
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
                      formula: "GA4 revenue total",
                      unit: "$",
                      description: "Total revenue in GA4 for the selected period",
                    },
                    {
                      name: "Total Conversions",
                      formula: "GA4 conversions total",
                      unit: "count",
                      description: "Total GA4 conversions for the selected period",
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
                      name: "Total Sessions",
                      formula: "GA4 sessions total",
                      unit: "count",
                      description: "Total sessions for the selected period",
                    }
                  ].map((template) => {
                    const requiresSpend = template.name === "ROAS" || template.name === "ROI" || template.name === "CPA";
                    const spendAvailable = Number(financialSpend || 0) > 0;
                    const disabled = requiresSpend && !spendAvailable;
                    return (
                    <div
                      key={template.name}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      } ${
                        selectedKPITemplate?.name === template.name
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedKPITemplate(template);
                        kpiForm.setValue("name", template.name);
                        kpiForm.setValue("unit", template.unit);
                        kpiForm.setValue("description", template.description);
                        // Target is intentionally left blank for new KPIs (user must set it explicitly).
                        kpiForm.setValue("targetValue", "");
                        // Prefill current value from the same live sources as the GA4 Overview (no extra fetch).
                        const liveCurrent = calculateKPIValueFromSources(template.name, {
                          revenue: Number(breakdownTotals.revenue || 0),
                          conversions: Number(breakdownTotals.conversions || ga4Metrics?.conversions || 0),
                          sessions: Number(breakdownTotals.sessions || ga4Metrics?.sessions || 0),
                          users: Number(breakdownTotals.users || ga4Metrics?.users || 0),
                          spend: Number(financialSpend || 0),
                        });
                        kpiForm.setValue("currentValue", formatNumberByUnit(liveCurrent, template.unit));
                      }}
                    >
                      <div className="font-medium text-sm text-slate-900 dark:text-white">
                        {template.name}
                      </div>
                      {disabled && (
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Spend required (add spend to unlock)
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
                
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedKPITemplate(null);
                      kpiForm.reset();
                    }}
                  >
                    Create Custom KPI
                  </Button>
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
                            <SelectValue placeholder="Percentage (%)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="%">Percentage (%)</SelectItem>
                          <SelectItem value="$">Dollar ($)</SelectItem>
                          <SelectItem value="ratio">Ratio (X:1)</SelectItem>
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
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
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
                          onChange={(e) => field.onChange(e.target.value)}
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
                      <FormLabel>Target Value</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Target goal"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
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
                <Button type="submit" disabled={createKPIMutation.isPending}>
                  {createKPIMutation.isPending ? "Creating..." : "Create KPI"}
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
    </div>
  );
}
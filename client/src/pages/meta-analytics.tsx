import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { formatPct } from "@shared/metric-math";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowUpDown, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Users, Video, Activity, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Filter } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MetaKpiModal } from "./meta-analytics/MetaKpiModal";
import { MetaBenchmarkModal } from "./meta-analytics/MetaBenchmarkModal";
import { MetaReportModal } from "./meta-analytics/MetaReportModal";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";

// Meta-specific metric definitions for KPIs and Benchmarks
const META_METRICS = [
  { key: 'impressions', label: 'Impressions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'reach', label: 'Reach', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'clicks', label: 'Clicks', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'conversions', label: 'Conversions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'spend', label: 'Spend', unit: '$', format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'ctr', label: 'CTR', unit: '%', format: (v: number) => `${formatPct(v)}` },
  { key: 'cpc', label: 'CPC', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpm', label: 'CPM', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpp', label: 'CPP', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'frequency', label: 'Frequency', unit: '', format: (v: number) => v.toFixed(2) },
  { key: 'conversionRate', label: 'Conversion Rate', unit: '%', format: (v: number) => `${formatPct(v)}` },
  { key: 'costPerConversion', label: 'Cost per Conversion', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'videoViews', label: 'Video Views', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'totalRevenue', label: 'Total Revenue', unit: '$', format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'profit', label: 'Profit', unit: '$', format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'roas', label: 'ROAS', unit: 'x', format: (v: number) => `${v.toFixed(2)}x` },
  { key: 'roi', label: 'ROI', unit: '%', format: (v: number) => `${formatPct(v)}` },
  { key: 'profitMargin', label: 'Profit Margin', unit: '%', format: (v: number) => `${formatPct(v)}` },
];

const LOWER_IS_BETTER_METRICS = ['cpc', 'cpm', 'cpp', 'costPerConversion', 'frequency', 'spend'];

function getMetaMetricDef(metricKey: string) {
  return META_METRICS.find(m => m.key === metricKey) || { key: metricKey, label: metricKey, unit: '', format: (v: number) => String(v) };
}

function formatMetaMetricValue(metricKey: string, value: number): string {
  return getMetaMetricDef(metricKey).format(value);
}

function stripNumberFormatting(value: any): any {
  return typeof value === 'string' ? value.replace(/,/g, '') : value;
}

export default function MetaAnalytics() {
  const [, params] = useRoute("/campaigns/:id/meta-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Scroll to top on mount (smooth transition from campaign detail)
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // KPI state
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({
    name: '', metric: '', targetValue: '', description: '', currentValue: '', unit: '',
    priority: 'high', status: 'active', category: '', timeframe: 'monthly', trackingPeriod: '30',
    alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
    alertThreshold: '', alertCondition: 'below', emailRecipients: '',
    applyTo: 'all', specificCampaignId: '',
  });

  // Benchmark state
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '',
    benchmarkType: 'custom' as 'industry' | 'custom',
    applyTo: 'all', specificCampaignId: '',
    alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
    alertThreshold: '', alertCondition: 'below', emailRecipients: '',
  });

  // Campaign filter state
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [selectedBreakdownCampaignId, setSelectedBreakdownCampaignId] = useState<string>('');

  // Insights state
  const [showDailyFinancialsView, setShowDailyFinancialsView] = useState(false);
  const [insightsTrendMetric, setInsightsTrendMetric] = useState('spend');
  const [insightsTrendMode, setInsightsTrendMode] = useState<'daily' | '7d' | '30d'>('daily');
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);

  // Reports state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [reportFormErrors, setReportFormErrors] = useState<any>({});
  const [isRevenueWizardOpen, setIsRevenueWizardOpen] = useState(false);
  const [revenueWizardInitialSource, setRevenueWizardInitialSource] = useState<any>(null);
  const [showRevenueSourcesDialog, setShowRevenueSourcesDialog] = useState(false);
  const [deletingRevenueSourceId, setDeletingRevenueSourceId] = useState<string | null>(null);
  const [customReportConfig, setCustomReportConfig] = useState<any>({
    coreMetrics: [], derivedMetrics: [], revenueMetrics: [], campaignBreakdown: [],
    kpis: [], benchmarks: [], insights: [], demographics: [],
  });
  const [reportForm, setReportForm] = useState<any>({
    name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly',
    scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false,
    scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end',
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch Meta analytics");
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch revenue summary
  const { data: revenueSummary } = useQuery({
    queryKey: ["/api/meta", campaignId, "revenue", "summary"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/revenue/summary`);
      if (!response.ok) throw new Error("Failed to fetch revenue summary");
      return response.json();
    },
    enabled: !!campaignId,
  });

  const { data: metaRevenueSourcesData } = useQuery<{ success: boolean; sources: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "revenue-sources", "meta"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=meta`);
      if (!response.ok) return { success: false, sources: [] };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, sources: Array.isArray(json?.sources) ? json.sources : [] };
    },
  });

  const { data: metaRevenueTotalsData } = useQuery<{ success: boolean; totalRevenue: number }>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=meta&dateRange=90days`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-totals?platformContext=meta&dateRange=90days`);
      if (!response.ok) return { success: false, totalRevenue: 0 };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, totalRevenue: Number(json?.totalRevenue || 0) };
    },
  });

  const { data: metaCampaignRevenueData } = useQuery<{ success: boolean; breakdown: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "meta-campaign-revenue"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/meta-campaign-revenue?dateRange=90days`);
      if (!response.ok) return { success: false, breakdown: [] };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, breakdown: Array.isArray(json?.breakdown) ? json.breakdown : [] };
    },
  });

  // Fetch Meta KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/meta/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/meta/kpis/${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch Meta KPIs');
      const json = await response.json();
      return Array.isArray(json) ? json : Array.isArray(json?.kpis) ? json.kpis : [];
    },
    enabled: !!campaignId,
  });

  // Fetch Meta Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/meta/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error('Failed to fetch Meta Benchmarks');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // KPI mutations
  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/platforms/meta/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId }),
      });
      if (!response.ok) throw new Error('Failed to create KPI');
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      await queryClient.refetchQueries({ queryKey: ['/api/platforms/meta/kpis', campaignId], exact: true });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      toast({ title: 'KPI created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create KPI', description: error?.message || 'Check the KPI values and try again.', variant: 'destructive' });
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/platforms/meta/kpis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      toast({ title: 'KPI updated successfully' });
    },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/platforms/meta/kpis/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      toast({ title: 'KPI deleted' });
    },
  });

  // Benchmark mutations
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/platforms/meta/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId, platform: 'meta' }),
      });
      if (!response.ok) throw new Error('Failed to create benchmark');
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'] });
      await queryClient.refetchQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'], exact: true });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      toast({ title: 'Benchmark created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create benchmark', description: error?.message || 'Check the benchmark values and try again.', variant: 'destructive' });
    },
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/platforms/meta/benchmarks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update benchmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'] });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      toast({ title: 'Benchmark updated successfully' });
    },
  });

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/platforms/meta/benchmarks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete benchmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'] });
      toast({ title: 'Benchmark deleted' });
    },
  });

  // Fetch Meta Reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/platforms/meta/reports', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/meta/reports?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error('Failed to fetch Meta Reports');
      return response.json();
    },
    enabled: !!campaignId,
  });

  const breakdownCampaignOptions = useMemo(() => {
    const rows = Array.isArray((analyticsData as any)?.campaigns) ? (analyticsData as any).campaigns : [];
    return rows.filter((item: any) => {
      const id = String(item?.campaign?.id || '').trim();
      const demographics = Array.isArray(item?.demographics) ? item.demographics : [];
      const geographics = Array.isArray(item?.geographics) ? item.geographics : [];
      const placements = Array.isArray(item?.placements) ? item.placements : [];
      return id && (demographics.length > 0 || geographics.length > 0 || placements.length > 0);
    });
  }, [analyticsData]);

  useEffect(() => {
    const ids = new Set(breakdownCampaignOptions.map((item: any) => String(item?.campaign?.id || '')));
    if (breakdownCampaignOptions.length === 0) {
      if (selectedBreakdownCampaignId) setSelectedBreakdownCampaignId('');
      return;
    }
    if (!selectedBreakdownCampaignId || !ids.has(selectedBreakdownCampaignId)) {
      setSelectedBreakdownCampaignId(String(breakdownCampaignOptions[0]?.campaign?.id || ''));
    }
  }, [breakdownCampaignOptions, selectedBreakdownCampaignId]);

  // Report mutations
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/platforms/meta/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId }),
      });
      if (!response.ok) throw new Error('Failed to create report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/reports'] });
      setIsReportModalOpen(false);
      setEditingReport(null);
      toast({ title: 'Report created successfully' });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/platforms/meta/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/reports'] });
      setIsReportModalOpen(false);
      setEditingReport(null);
      toast({ title: 'Report updated successfully' });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/platforms/meta/reports/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/reports'] });
      toast({ title: 'Report deleted' });
    },
  });

  const activeMetaRevenueSources = Array.isArray(metaRevenueSourcesData?.sources)
    ? metaRevenueSourcesData.sources.filter((source: any) => source?.isActive !== false)
    : [];
  const metaCampaignRevenueById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of Array.isArray(metaCampaignRevenueData?.breakdown) ? metaCampaignRevenueData.breakdown : []) {
      const id = String(row?.campaignId || "").trim();
      const revenue = Number(row?.revenue || 0);
      if (id && Number.isFinite(revenue) && revenue > 0) map.set(id, (map.get(id) || 0) + revenue);
    }
    return map;
  }, [metaCampaignRevenueData]);

  const refreshMetaRevenueQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "meta"] });
    await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=meta&dateRange=90days`], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/meta", campaignId, "revenue", "summary"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/meta", campaignId], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "meta-campaign-revenue"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/platforms/meta/kpis"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "benchmarks", "meta"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/platforms/meta/reports", campaignId], exact: false });
    await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "meta"], exact: true });
    await queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=meta&dateRange=90days`], exact: true });
    await queryClient.refetchQueries({ queryKey: ["/api/meta", campaignId, "revenue", "summary"], exact: true });
    await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "meta-campaign-revenue"], exact: true });
  };

  const deleteMetaRevenueSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources/${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Failed to remove revenue source');
      }
      return json;
    },
    onSuccess: async () => {
      setDeletingRevenueSourceId(null);
      toast({ title: 'Revenue source removed', description: 'Meta Total Revenue has been recalculated.' });
      await refreshMetaRevenueQueries();
    },
    onError: (error: any) => {
      setDeletingRevenueSourceId(null);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to remove revenue source',
        variant: 'destructive',
      });
    },
  });

  // Fetch Meta daily data for time-series (Daily/7d/30d)
  const selectedMetaCampaignIds = useMemo(() => {
    const rows = Array.isArray((analyticsData as any)?.campaigns) ? (analyticsData as any).campaigns : [];
    return rows
      .map((item: any) => String(item?.campaign?.id || '').trim())
      .filter((id: string) => id.length > 0);
  }, [analyticsData]);
  const selectedMetaCampaignKey = selectedMetaCampaignIds.join('|');
  const { data: metaDailyResp, isLoading: metaDailyLoading } = useQuery({
    queryKey: ['/api/meta', campaignId, 'insights/daily', selectedMetaCampaignKey],
    queryFn: async () => {
      const results = await Promise.all(selectedMetaCampaignIds.map(async (metaCampaignId: string) => {
        const resp = await fetch(`/api/meta/${campaignId}/insights/daily?metaCampaignId=${encodeURIComponent(metaCampaignId)}&days=90`);
        if (!resp.ok) return [];
        const json = await resp.json().catch(() => ({}));
        const rows = Array.isArray(json?.dailyInsights) ? json.dailyInsights : [];
        return rows.map((row: any) => ({ ...row, metaCampaignId }));
      }));
      return { dailyInsights: results.flat() };
    },
    enabled: !!campaignId && selectedMetaCampaignIds.length > 0,
  });

  // Process daily data into series and rollups for Daily/7d/30d charts
  // NOTE: These useMemo hooks MUST be before conditional returns to satisfy Rules of Hooks
  const metaDailySeries = useMemo(() => {
    const raw = Array.isArray(metaDailyResp?.dailyInsights) ? metaDailyResp.dailyInsights : [];

    const grouped = new Map<string, any>();
    raw.forEach((r: any) => {
      const date = String(r?.date_start || r?.date || '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const impressions = Number(r?.impressions || 0) || 0;
      const reach = Number(r?.reach || 0) || 0;
      const clicks = Number(r?.clicks || r?.inline_link_clicks || 0) || 0;
      const conversions = Number(r?.conversions || r?.actions?.length || 0) || 0;
      const spend = Number(r?.spend || 0) || 0;
      const current = grouped.get(date) || { date, impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0 };
      current.impressions += impressions;
      current.reach += reach;
      current.clicks += clicks;
      current.conversions += conversions;
      current.spend += spend;
      grouped.set(date, current);
    });

    const byDate = Array.from(grouped.values())
      .map((r: any) => {
        const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
        const cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
        const cpm = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0;
        const conversionRate = r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0;
        return { ...r, ctr, cpc, cpm, conversionRate };
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const rolling = (windowDays: number) => {
      const out: any[] = [];
      for (let i = 0; i < byDate.length; i++) {
        const startIdx = Math.max(0, i - windowDays + 1);
        const slice = byDate.slice(startIdx, i + 1);
        if (slice.length < windowDays) continue;
        const sums = slice.reduce(
          (acc: any, r: any) => {
            acc.impressions += r.impressions;
            acc.clicks += r.clicks;
            acc.conversions += r.conversions;
            acc.spend += r.spend;
            return acc;
          },
          { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
        );
        const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
        const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
        const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
        const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
        out.push({ date: byDate[i].date, ...sums, ctr, cpc, cpm, conversionRate });
      }
      return out;
    };

    return { daily: byDate, rolling7: rolling(7), rolling30: rolling(30) };
  }, [metaDailyResp]);

  const metaInsightsRollups = useMemo(() => {
    const byDate = metaDailySeries.daily;
    const dates = byDate.map((r: any) => r.date);

    const rollup = (n: number, offsetFromEnd: number = 0) => {
      const endIdx = Math.max(0, dates.length - offsetFromEnd);
      const startIdx = Math.max(0, endIdx - n);
      const slice = byDate.slice(startIdx, endIdx);
      const sums = slice.reduce(
        (acc: any, r: any) => {
          acc.impressions += r.impressions;
          acc.clicks += r.clicks;
          acc.conversions += r.conversions;
          acc.spend += r.spend;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
      );
      const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
      const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
      const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
      const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
      return { ...sums, ctr, cpc, cpm, conversionRate, startDate: slice[0]?.date || null, endDate: slice[slice.length - 1]?.date || null, days: slice.length };
    };

    const last7 = rollup(7, 0);
    const prior7 = rollup(7, 7);
    const last30 = rollup(30, 0);
    const prior30 = rollup(30, 30);
    const deltaPct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return {
      availableDays: dates.length,
      last7, prior7, last30, prior30,
      deltas: {
        impressions7: deltaPct(last7.impressions, prior7.impressions),
        clicks7: deltaPct(last7.clicks, prior7.clicks),
        conversions7: deltaPct(last7.conversions, prior7.conversions),
        spend7: deltaPct(last7.spend, prior7.spend),
        ctr7: prior7.ctr > 0 ? ((last7.ctr - prior7.ctr) / prior7.ctr) * 100 : 0,
        cpc7: prior7.cpc > 0 ? ((last7.cpc - prior7.cpc) / prior7.cpc) * 100 : 0,
        cpm7: prior7.cpm > 0 ? ((last7.cpm - prior7.cpm) / prior7.cpm) * 100 : 0,
        conversionRate7: prior7.conversionRate > 0 ? ((last7.conversionRate - prior7.conversionRate) / prior7.conversionRate) * 100 : 0,
        impressions30: deltaPct(last30.impressions, prior30.impressions),
        clicks30: deltaPct(last30.clicks, prior30.clicks),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        spend30: deltaPct(last30.spend, prior30.spend),
        ctr30: prior30.ctr > 0 ? ((last30.ctr - prior30.ctr) / prior30.ctr) * 100 : 0,
        cpc30: prior30.cpc > 0 ? ((last30.cpc - prior30.cpc) / prior30.cpc) * 100 : 0,
        cpm30: prior30.cpm > 0 ? ((last30.cpm - prior30.cpm) / prior30.cpm) * 100 : 0,
        conversionRate30: prior30.conversionRate > 0 ? ((last30.conversionRate - prior30.conversionRate) / prior30.conversionRate) * 100 : 0,
      },
    };
  }, [metaDailySeries]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <p className="text-muted-foreground/70">No Meta analytics data available</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { summary, campaigns } = analyticsData;
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const parseRevenueSourceConfig = (source: any): any => {
    try {
      return source?.mappingConfig
        ? (typeof source.mappingConfig === 'string' ? JSON.parse(source.mappingConfig) : source.mappingConfig)
        : {};
    } catch {
      return {};
    }
  };

  const revenueSourceTypeLabel = (type: any) => {
    const map: Record<string, string> = {
      csv: 'CSV',
      google_sheets: 'Google Sheets',
      hubspot: 'HubSpot',
      salesforce: 'Salesforce',
      shopify: 'Shopify',
      manual: 'Manual',
      connector_derived: 'Imported',
    };
    return map[String(type || '').trim().toLowerCase()] || 'Imported';
  };

  const metaRevenueSourceLabel = (source: any) => {
    const displayName = String(source?.displayName || '').trim();
    return displayName || revenueSourceTypeLabel(source?.sourceType);
  };

  const openMetaRevenueModal = (source?: any) => {
    setRevenueWizardInitialSource(source || null);
    setIsRevenueWizardOpen(true);
  };

  const hasMetaAttributedRevenue = activeMetaRevenueSources.length > 0;
  const metaAttributedRevenueFromSources = activeMetaRevenueSources.reduce(
    (sum: number, source: any) => sum + Number(source?.lastTotalRevenue || 0),
    0
  );
  const metaAttributedRevenue = metaAttributedRevenueFromSources > 0
    ? metaAttributedRevenueFromSources
    : Number(metaRevenueTotalsData?.totalRevenue || 0);
  const metaAttributedProfit = metaAttributedRevenue - (summary.totalSpend || 0);
  const metaAttributedRoas = summary.totalSpend > 0 ? metaAttributedRevenue / summary.totalSpend : 0;
  const metaAttributedRoi = summary.totalSpend > 0 ? ((metaAttributedRevenue - summary.totalSpend) / summary.totalSpend) * 100 : 0;
  const metaAttributedProfitMargin = metaAttributedRevenue > 0 ? (metaAttributedProfit / metaAttributedRevenue) * 100 : 0;
  const metaRevenueMetricSummary = {
    ...(revenueSummary || {}),
    hasRevenueTracking: hasMetaAttributedRevenue,
    totalRevenue: hasMetaAttributedRevenue ? metaAttributedRevenue : 0,
    profit: hasMetaAttributedRevenue ? metaAttributedProfit : 0,
    roas: hasMetaAttributedRevenue ? metaAttributedRoas : 0,
    roi: hasMetaAttributedRevenue ? metaAttributedRoi : 0,
    profitMargin: hasMetaAttributedRevenue ? metaAttributedProfitMargin : 0,
  };
  const selectedBreakdownCampaign = breakdownCampaignOptions.find((item: any) =>
    String(item?.campaign?.id || '') === selectedBreakdownCampaignId
  ) || breakdownCampaignOptions[0] || {};
  const selectedBreakdownCampaignValue = String(selectedBreakdownCampaign?.campaign?.id || '');
  const selectedCampaignDemographics = Array.isArray(selectedBreakdownCampaign?.demographics) ? selectedBreakdownCampaign.demographics : [];
  const selectedCampaignGeographics = Array.isArray(selectedBreakdownCampaign?.geographics) ? selectedBreakdownCampaign.geographics : [];
  const selectedCampaignPlacements = Array.isArray(selectedBreakdownCampaign?.placements) ? selectedBreakdownCampaign.placements : [];

  // Format date helper
  const formatShortDate = (yyyyMmDd: string) => {
    const s = String(yyyyMmDd || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `'${m[1].slice(-2)}-${m[2]}-${m[3]}`;
  };

  // Helper: get live metric value from Meta summary for KPIs/Benchmarks
  const getLiveMetricValue = (metricKey: string): number => {
    const normalizedKey = String(metricKey || '').trim().toLowerCase();
    if (normalizedKey === 'totalrevenue' || normalizedKey === 'revenue') return hasMetaAttributedRevenue ? metaAttributedRevenue : 0;
    if (normalizedKey === 'profit') return hasMetaAttributedRevenue ? metaAttributedProfit : 0;
    if (normalizedKey === 'roas') return hasMetaAttributedRevenue ? metaAttributedRoas : 0;
    if (normalizedKey === 'roi') return hasMetaAttributedRevenue ? metaAttributedRoi : 0;
    if (normalizedKey === 'profitmargin') return hasMetaAttributedRevenue ? metaAttributedProfitMargin : 0;
    const map: Record<string, number> = {
      impressions: summary.totalImpressions || 0,
      reach: summary.totalReach || 0,
      clicks: summary.totalClicks || 0,
      conversions: summary.totalConversions || 0,
      spend: summary.totalSpend || 0,
      ctr: summary.avgCTR || 0,
      cpc: summary.avgCPC || 0,
      cpm: summary.avgCPM || 0,
      cpp: summary.avgCPP || 0,
      frequency: summary.avgFrequency || 0,
      conversionRate: summary.conversionRate || summary.avgConversionRate || 0,
      costPerConversion: summary.costPerConversion || 0,
      videoViews: summary.totalVideoViews || 0,
    };
    return map[metricKey] ?? 0;
  };

  // Helper: compute KPI/Benchmark progress
  const computeProgress = (current: number, target: number, metricKey: string) => {
    if (!target || target === 0) return { pct: 0, status: 'unknown' as const };
    const lowerIsBetter = LOWER_IS_BETTER_METRICS.includes(metricKey);
    let ratio: number;
    if (lowerIsBetter) {
      // For cost metrics, being under target = good (ratio > 1 means better)
      ratio = target / current;
    } else {
      ratio = current / target;
    }
    const pct = ratio * 100;
    const status = pct >= 90 ? 'on_track' as const : pct >= 70 ? 'needs_attention' as const : 'behind' as const;
    return { pct, status };
  };

  // Compute KPI tracker stats
  const kpiTracker = (() => {
    const items = Array.isArray(kpisData) ? kpisData : [];
    let onTrack = 0, needsAttention = 0, behind = 0, totalPct = 0;
    items.forEach((kpi: any) => {
      const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
      const target = parseFloat(kpi.targetValue || '0');
      const p = computeProgress(current, target, kpi.metric || kpi.metricKey || '');
      if (p.status === 'on_track') onTrack++;
      else if (p.status === 'needs_attention') needsAttention++;
      else behind++;
      totalPct += Math.min(p.pct, 200);
    });
    return { total: items.length, onTrack, needsAttention, behind, avgPct: items.length > 0 ? totalPct / items.length : 0 };
  })();

  // Compute Benchmark tracker stats
  const benchmarkTracker = (() => {
    const items = Array.isArray(benchmarksData) ? benchmarksData : [];
    let onTrack = 0, needsAttention = 0, behind = 0, totalPct = 0;
    items.forEach((b: any) => {
      const current = getLiveMetricValue(b.metric || '');
      const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
      const p = computeProgress(current, benchVal, b.metric || '');
      if (p.status === 'on_track') onTrack++;
      else if (p.status === 'needs_attention') needsAttention++;
      else behind++;
      totalPct += Math.min(p.pct, 200);
    });
    return { total: items.length, onTrack, needsAttention, behind, avgPct: items.length > 0 ? totalPct / items.length : 0 };
  })();

  // Prepare data for charts
  const rankingCampaigns = campaigns.filter((c: any) => c?.campaign && c?.totals);
  const bestCtrCampaign = [...rankingCampaigns]
    .sort((a: any, b: any) => Number(b?.totals?.ctr || 0) - Number(a?.totals?.ctr || 0))[0];
  const mostEfficientCampaign = [...rankingCampaigns]
    .filter((c: any) => Number(c?.totals?.clicks || 0) > 0 && Number(c?.totals?.spend || 0) > 0)
    .sort((a: any, b: any) => Number(a?.totals?.cpc || Number.MAX_SAFE_INTEGER) - Number(b?.totals?.cpc || Number.MAX_SAFE_INTEGER))[0];
  const needsAttentionCampaign = [...rankingCampaigns]
    .filter((c: any) => Number(c?.totals?.clicks || 0) > 0)
    .sort((a: any, b: any) => {
      const conversionRateDiff = Number(a?.totals?.conversionRate || 0) - Number(b?.totals?.conversionRate || 0);
      if (conversionRateDiff !== 0) return conversionRateDiff;
      return Number(b?.totals?.costPerConversion || 0) - Number(a?.totals?.costPerConversion || 0);
    })[0];
  const campaignPerformanceData = [...campaigns]
    .sort((a: any, b: any) => Number(b?.totals?.spend || 0) - Number(a?.totals?.spend || 0))
    .slice(0, 5)
    .map((c: any) => ({
      name: c.campaign.name.length > 20 ? c.campaign.name.substring(0, 20) + '...' : c.campaign.name,
      spend: c.totals.spend,
      conversions: c.totals.conversions,
      clicks: c.totals.clicks,
    }));

  const objectiveDistribution = campaigns.reduce((acc: any, c: any) => {
    const objective = c.campaign.objective;
    if (!acc[objective]) {
      acc[objective] = { name: objective, value: 0, campaigns: 0 };
    }
    acc[objective].value += c.totals.spend;
    acc[objective].campaigns += 1;
    return acc;
  }, {});

  const objectiveData = Object.values(objectiveDistribution);

  // Handler: create or update KPI
  const handleCreateKPI = () => {
    const payload = {
      name: kpiForm.name,
      metric: kpiForm.metric,
      metricKey: kpiForm.metric,
      targetValue: stripNumberFormatting(kpiForm.targetValue),
      currentValue: stripNumberFormatting(kpiForm.currentValue) || String(getLiveMetricValue(kpiForm.metric)),
      description: kpiForm.description,
      unit: kpiForm.unit || getMetaMetricDef(kpiForm.metric).unit,
      priority: kpiForm.priority,
      status: 'active',
      category: kpiForm.category || 'performance',
      timeframe: kpiForm.timeframe || 'monthly',
      trackingPeriod: Number(kpiForm.trackingPeriod || 30),
      alertsEnabled: kpiForm.alertsEnabled,
      emailNotifications: kpiForm.emailNotifications,
      alertFrequency: kpiForm.alertFrequency,
      alertThreshold: kpiForm.alertThreshold,
      alertCondition: kpiForm.alertCondition,
      emailRecipients: kpiForm.emailRecipients,
      applyTo: kpiForm.applyTo,
      specificCampaignId: kpiForm.specificCampaignId,
      platformType: 'meta',
    };
    if (editingKPI) {
      updateKpiMutation.mutate({ id: editingKPI.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  // Handler: create or update Benchmark
  const handleCreateBenchmark = () => {
    const payload = {
      name: benchmarkForm.name,
      metric: benchmarkForm.metric,
      benchmarkValue: stripNumberFormatting(benchmarkForm.benchmarkValue),
      targetValue: stripNumberFormatting(benchmarkForm.benchmarkValue),
      currentValue: stripNumberFormatting(benchmarkForm.currentValue) || String(getLiveMetricValue(benchmarkForm.metric)),
      description: benchmarkForm.description,
      industry: benchmarkForm.industry,
      unit: benchmarkForm.unit || getMetaMetricDef(benchmarkForm.metric).unit,
      benchmarkType: benchmarkForm.benchmarkType || 'custom',
      category: 'performance',
      applyTo: benchmarkForm.applyTo,
      specificCampaignId: benchmarkForm.specificCampaignId,
      alertsEnabled: benchmarkForm.alertsEnabled,
      emailNotifications: benchmarkForm.emailNotifications,
      alertFrequency: benchmarkForm.alertFrequency,
      alertThreshold: benchmarkForm.alertThreshold,
      alertCondition: benchmarkForm.alertCondition,
      emailRecipients: benchmarkForm.emailRecipients,
      platformType: 'meta',
      platform: 'meta',
    };
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: payload });
    } else {
      createBenchmarkMutation.mutate(payload);
    }
  };

  // Report handlers
  const handleReportTypeSelect = (type: string) => {
    const nameMap: Record<string, string> = {
      overview: 'Meta Overview Report',
      kpis: 'Meta KPIs Report',
      benchmarks: 'Meta Benchmarks Report',
      ads: 'Meta Ad Comparison Report',
      insights: 'Meta Insights Report',
      custom: 'Custom Report',
    };
    setReportForm((prev: any) => ({
      ...prev,
      reportType: type,
      name: prev.name || nameMap[type] || 'Meta Report',
    }));
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayOfWeekKeyToInt = (value: any): number | null => {
    const map: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return map[String(value || '').trim().toLowerCase()] ?? null;
  };
  const dayOfWeekIntToKey = (value: any): string => {
    const map: Record<number, string> = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
    return map[Number(value)] || 'monday';
  };
  const dayOfMonthToInt = (value: any): number | null => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'last') return 0;
    if (raw === 'first') return 1;
    if (raw === 'mid') return 15;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(31, parsed)) : null;
  };
  const to24HourHHMM = (value: any): string => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return /^\d{1,2}:\d{2}$/.test(raw) ? raw : '09:00';
    let hours = parseInt(match[1], 10);
    if (match[3].toUpperCase() === 'AM') {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }
    return `${String(hours).padStart(2, '0')}:${match[2]}`;
  };
  const from24HourTo12Hour = (value: any): string => {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '9:00 AM';
    let hours = parseInt(match[1], 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    if (hours > 12) hours -= 12;
    return `${hours}:${match[2]} ${suffix}`;
  };
  const parseMetaReportConfiguration = (configuration: any): Record<string, any> => {
    if (!configuration) return {};
    if (typeof configuration === 'string') {
      try {
        return JSON.parse(configuration || '{}') || {};
      } catch {
        return {};
      }
    }
    return typeof configuration === 'object' ? configuration : {};
  };
  const normalizeMetaReportType = (type: any): string => {
    const value = String(type || '').trim();
    return ['overview', 'kpis', 'benchmarks', 'ads', 'insights', 'custom'].includes(value) ? value : 'overview';
  };
  const buildMetaReportPayload = (overrides: Record<string, any> = {}) => {
    const merged = { ...reportForm, ...overrides };
    const configurationInput = Object.prototype.hasOwnProperty.call(overrides, 'configuration')
      ? overrides.configuration
      : merged.configuration;
    return {
      name: merged.name,
      description: merged.description,
      reportType: normalizeMetaReportType(merged.reportType),
      configuration: typeof configurationInput === 'undefined' ? null : configurationInput,
      scheduleEnabled: !!merged.scheduleEnabled,
      status: 'active',
      scheduleFrequency: merged.scheduleEnabled ? merged.scheduleFrequency : undefined,
      scheduleDayOfWeek: merged.scheduleEnabled && merged.scheduleFrequency === 'weekly' ? dayOfWeekKeyToInt(merged.scheduleDayOfWeek) : undefined,
      scheduleDayOfMonth: merged.scheduleEnabled && (merged.scheduleFrequency === 'monthly' || merged.scheduleFrequency === 'quarterly') ? dayOfMonthToInt(merged.scheduleDayOfMonth) : undefined,
      scheduleTime: merged.scheduleEnabled ? to24HourHHMM(merged.scheduleTime) : undefined,
      scheduleTimeZone: merged.scheduleEnabled ? userTimeZone : undefined,
      quarterTiming: merged.scheduleEnabled && merged.scheduleFrequency === 'quarterly' ? merged.quarterTiming : undefined,
      scheduleRecipients: merged.scheduleEnabled ? String(merged.emailRecipients || '').split(',').map((email) => email.trim()).filter(Boolean) : undefined,
    };
  };

  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled && !String(reportForm.emailRecipients || '').trim()) {
      setReportFormErrors({ emailRecipients: 'Email recipients are required for scheduled reports' });
      return;
    }
    const payload = buildMetaReportPayload();
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const handleUpdateReport = handleCreateReport;

  const handleCustomReport = () => {
    if (reportForm.scheduleEnabled && !String(reportForm.emailRecipients || '').trim()) {
      setReportFormErrors({ emailRecipients: 'Email recipients are required for scheduled reports' });
      return;
    }
    const payload = buildMetaReportPayload({ reportType: 'custom', configuration: customReportConfig });
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const getTimeZoneDisplay = () => userTimeZone.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Meta/Facebook Ads Analytics</h1>
                <p className="text-muted-foreground/70 mt-1">
                  Ad Account: {analyticsData.adAccountName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  Test Mode - Realistic Demo Data
                </Badge>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6 fade-in">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="ad-comparison">Ad Comparison</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 fade-in">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.totalCampaigns} campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalImpressions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgCPM.toFixed(2)} CPM
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reach</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReach.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((summary.totalReach / summary.totalImpressions) * 100).toFixed(1)}% of impressions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPct(summary.avgCTR)} CTR
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalConversions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${summary.costPerConversion.toFixed(2)} cost/conv
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Video Views</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalVideoViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Video engagement
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm text-muted-foreground/70">Total Revenue</p>
                <button
                  type="button"
                  onClick={() => openMetaRevenueModal()}
                  className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
                  title="Add Meta revenue source"
                  aria-label="Add Meta revenue source"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {hasMetaAttributedRevenue ? fmtCurrency(metaAttributedRevenue) : "Not connected"}
              </p>
              {!hasMetaAttributedRevenue && (
                <p className="text-xs text-muted-foreground mt-1">Connect attributed revenue</p>
              )}
              {activeMetaRevenueSources.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRevenueSourcesDialog(true)}
                  className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground"
                >
                  Sources ({activeMetaRevenueSources.length})
                </button>
              )}
            </CardContent>
          </Card>

          {/* Performance Metrics - Derived Metrics */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key derived metrics across all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CTR</p>
                  <p className="text-xl font-bold">{formatPct(summary.avgCTR)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <DollarSign className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPC</p>
                  <p className="text-xl font-bold">${summary.avgCPC.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <Eye className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPM</p>
                  <p className="text-xl font-bold">${summary.avgCPM.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <Users className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPP</p>
                  <p className="text-xl font-bold">${summary.avgCPP.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Frequency</p>
                  <p className="text-xl font-bold">{summary.avgFrequency.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <Target className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Cost/Conv</p>
                  <p className="text-xl font-bold">${summary.costPerConversion.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Conv Rate</p>
                  <p className="text-xl font-bold">{formatPct(summary.conversionRate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaign Breakdown - Card Layout */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Campaign Breakdown</CardTitle>
                <CardDescription>Metrics grouped by selected Meta campaign</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <ArrowUpDown className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="spend">Spend (High→Low)</SelectItem>
                    <SelectItem value="impressions">Impressions (High→Low)</SelectItem>
                    <SelectItem value="clicks">Clicks (High→Low)</SelectItem>
                    <SelectItem value="conversions">Conversions (High→Low)</SelectItem>
                    <SelectItem value="reach">Reach (High→Low)</SelectItem>
                    <SelectItem value="ctr">CTR (High→Low)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns
                  .filter((c: any) => filterBy === 'all' || c.campaign.status === filterBy)
                  .sort((a: any, b: any) => {
                    switch (sortBy) {
                      case 'name': return a.campaign.name.localeCompare(b.campaign.name);
                      case 'spend': return (b.totals.spend || 0) - (a.totals.spend || 0);
                      case 'impressions': return (b.totals.impressions || 0) - (a.totals.impressions || 0);
                      case 'clicks': return (b.totals.clicks || 0) - (a.totals.clicks || 0);
                      case 'conversions': return (b.totals.conversions || 0) - (a.totals.conversions || 0);
                      case 'reach': return (b.totals.reach || 0) - (a.totals.reach || 0);
                      case 'ctr': return (b.totals.ctr || 0) - (a.totals.ctr || 0);
                      default: return 0;
                    }
                  })
                  .map((campaignData: any) => {
                  const { campaign, totals } = campaignData;
                  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const formatNum = (v: number) => v.toLocaleString();
                  const campaignRevenue = Number(metaCampaignRevenueById.get(String(campaign.id || "")) || 0);
                  // formatPct imported from @shared/metric-math

                  return (
                    <div key={campaign.id} className="border rounded-lg p-4 bg-card">
                      {/* Campaign header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{campaign.name}</h4>
                          <span className="text-xs text-muted-foreground">{campaign.objective}</span>
                        </div>
                      </div>

                      {/* Core metrics — prominent */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Impressions</p>
                          <p className="text-base font-bold text-foreground">{formatNum(totals.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Reach</p>
                          <p className="text-base font-bold text-foreground">{formatNum(totals.reach)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Clicks</p>
                          <p className="text-base font-bold text-foreground">{formatNum(totals.clicks)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">CTR</p>
                          <p className="text-base font-bold text-foreground">{formatPct(totals.ctr)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Conversions</p>
                          <p className="text-base font-bold text-foreground">{formatNum(totals.conversions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Video Views</p>
                          <p className="text-base font-bold text-foreground">{formatNum(totals.videoViews)}</p>
                        </div>
                      </div>

                      {/* Secondary metrics — smaller */}
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">CPC</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.cpc)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">CPM</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.cpm)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">CPP</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.cpp)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">Frequency</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{totals.frequency.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">Cost/Conv</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.costPerConversion)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">Conv Rate</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatPct(totals.conversionRate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">Total Spend</p>
                          <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.spend)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium">Total Revenue</p>
                          <p className="text-sm font-semibold text-foreground/80/60">
                            {campaignRevenue > 0 ? formatCurrency(campaignRevenue) : <span className="text-muted-foreground/70">-</span>}
                          </p>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Demographics & Geographics */}
          {breakdownCampaignOptions.length > 0 && (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mt-8">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Audience And Placement Breakdowns</h3>
                  <p className="text-sm text-muted-foreground/70">Breakdowns for the selected Meta campaign</p>
                </div>
                <Select value={selectedBreakdownCampaignValue} onValueChange={setSelectedBreakdownCampaignId}>
                  <SelectTrigger className="w-full lg:w-[280px]">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {breakdownCampaignOptions.map((campaignData: any) => {
                      const optionId = String(campaignData?.campaign?.id || '');
                      return (
                        <SelectItem key={optionId} value={optionId}>
                          {campaignData?.campaign?.name || optionId}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {selectedCampaignDemographics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Demographics</CardTitle>
                      <CardDescription>
                        Source: Meta age and gender breakdown for the selected campaign. These rows are not a reconciliation to the metric cards above.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Range</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCampaignDemographics.slice(0, 6).map((demo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{demo.ageRange || demo.age}</TableCell>
                          <TableCell className="capitalize">{demo.gender}</TableCell>
                          <TableCell className="text-right">{demo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{demo.clicks.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </CardContent>
                  </Card>
                )}

                {selectedCampaignGeographics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Locations</CardTitle>
                      <CardDescription>
                        Source: Meta country breakdown for the selected campaign. These rows are not a reconciliation to the metric cards above.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCampaignGeographics.map((geo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{geo.country}</TableCell>
                          <TableCell className="text-right">{geo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{geo.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${geo.spend.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Placements */}
              {selectedCampaignPlacements.length > 0 && (
                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Ad Placements</CardTitle>
                    <CardDescription>
                      Source: Meta placement breakdown for the selected campaign. These rows are not a reconciliation to the metric cards above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placement</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCampaignPlacements.map((placement: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {placement.placement || [placement.publisherPlatform, placement.platformPosition].filter(Boolean).join(' / ')}
                        </TableCell>
                        <TableCell className="text-right">{placement.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${placement.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(placement.conversions || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
            </TabsContent>

            <TabsContent value="kpis" className="space-y-6 fade-in">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Key Performance Indicators</h2>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Track your Meta campaign KPIs and targets
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingKPI(null);
                    setKpiForm({
                      name: '', metric: '', targetValue: '', description: '', currentValue: '', unit: '',
                      priority: 'high', status: 'active', category: '', timeframe: 'monthly', trackingPeriod: '30',
                      alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
                      alertThreshold: '', alertCondition: 'below', emailRecipients: '',
                      applyTo: 'all', specificCampaignId: '',
                    });
                    setIsKPIModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-border"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add KPI
                </Button>
              </div>

              {/* Meta info bar */}
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground/70">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <span className="font-medium text-foreground/80/60">KPIs:</span> {kpiTracker.total}
                  </div>
                  <div>
                    <span className="font-medium text-foreground/80/60">Campaigns:</span> {summary.totalCampaigns}
                  </div>
                  <div>
                    <span className="font-medium text-foreground/80/60">Data source:</span> Meta Graph API
                  </div>
                </div>
              </div>

              {/* Performance Tracker Panel */}
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
                        <p className="text-sm text-muted-foreground/70">On Track</p>
                        <p className="text-2xl font-bold text-green-600">{kpiTracker.onTrack}</p>
                        <p className="text-xs text-muted-foreground">meeting or exceeding target</p>
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
                        <p className="text-2xl font-bold text-amber-600">{kpiTracker.needsAttention}</p>
                        <p className="text-xs text-muted-foreground">within 70–90% of target</p>
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
                        <p className="text-2xl font-bold text-red-600">{kpiTracker.behind}</p>
                        <p className="text-xs text-muted-foreground">below 70% of target</p>
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
                        <p className="text-2xl font-bold text-foreground">{kpiTracker.avgPct.toFixed(1)}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KPI Cards */}
              {kpisLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-muted rounded"></div>
                  <div className="h-32 bg-muted rounded"></div>
                </div>
              ) : Array.isArray(kpisData) && kpisData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {kpisData.map((kpi: any) => {
                    const metricKey = kpi.metric || kpi.metricKey || '';
                    const metricDef = getMetaMetricDef(metricKey);
                    const currentVal = getLiveMetricValue(metricKey);
                    const targetVal = parseFloat(kpi.targetValue || '0');
                    const progress = computeProgress(currentVal, targetVal, metricKey);
                    const progressFill = Math.min(progress.pct, 100);
                    const progressColor = progress.status === 'on_track' ? 'bg-green-500' : progress.status === 'needs_attention' ? 'bg-amber-500' : 'bg-red-500';
                    const deltaPct = targetVal > 0 ? ((currentVal - targetVal) / targetVal * 100) : 0;

                    return (
                      <Card key={kpi.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                {metricKey && (
                                  <Badge variant="outline" className="bg-muted text-foreground/80/60 font-mono">
                                    {metricKey.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="text-sm">
                                {kpi.description || `Track ${metricDef.label} performance against target`}
                              </CardDescription>
                              <div className="mt-2">
                                <Badge variant="outline" className="bg-muted text-foreground/80/20/60 border-border">
                                  All Campaigns
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                onClick={() => {
                                  setEditingKPI(kpi);
                                  setKpiForm({
                                    name: kpi.name || '',
                                    metric: metricKey,
                                    targetValue: kpi.targetValue || '',
                                    description: kpi.description || '',
                                    currentValue: String(currentVal),
                                    unit: kpi.unit || metricDef.unit || '',
                                    priority: kpi.priority || 'high',
                                    status: kpi.status || 'active',
                                    category: kpi.category || '',
                                    timeframe: kpi.timeframe || 'monthly',
                                    trackingPeriod: String(kpi.trackingPeriod || 30),
                                    alertsEnabled: !!kpi.alertsEnabled,
                                    emailNotifications: !!kpi.emailNotifications,
                                    alertFrequency: kpi.alertFrequency || 'daily',
                                    alertThreshold: kpi.alertThreshold || '',
                                    alertCondition: kpi.alertCondition || 'below',
                                    emailRecipients: kpi.emailRecipients || '',
                                    applyTo: kpi.applyTo || 'all',
                                    specificCampaignId: kpi.specificCampaignId || '',
                                  });
                                  setIsKPIModalOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{kpi.name}"? This action cannot be undone.
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
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current</div>
                              <div className="text-xl font-bold text-foreground">
                                {formatMetaMetricValue(metricKey, currentVal)}
                              </div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">Target</div>
                              <div className="text-xl font-bold text-foreground">
                                {formatMetaMetricValue(metricKey, targetVal)}
                              </div>
                            </div>
                          </div>

                          {targetVal > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                <span>Progress</span>
                                <span>{Math.round(progress.pct)}%</span>
                              </div>
                              <Progress value={progressFill} className="h-2" indicatorClassName={progressColor} />
                            </div>
                          )}

                          {targetVal > 0 && (
                            <div className="text-xs text-muted-foreground/70">
                              {Math.abs(deltaPct) < 0.01 ? 'At target' :
                                deltaPct > 0 ? `${Math.round(Math.abs(deltaPct))}% above target (+${deltaPct.toFixed(1)}%)` :
                                `${Math.round(Math.abs(deltaPct))}% below target (${deltaPct.toFixed(1)}%)`}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground/70">
                  No KPIs have been created yet. Click "Add KPI" to track your first Meta performance indicator.
                </div>
              )}
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6 fade-in">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Benchmarks</h2>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Compare your Meta campaign performance against industry benchmarks
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingBenchmark(null);
                    setBenchmarkForm({
                      name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '',
                      benchmarkType: 'custom' as 'industry' | 'custom',
                      applyTo: 'all', specificCampaignId: '',
                      alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
                      alertThreshold: '', alertCondition: 'below', emailRecipients: '',
                    });
                    setIsBenchmarkModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-border"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Benchmark
                </Button>
              </div>

              {/* Meta info bar */}
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground/70">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <span className="font-medium text-foreground/80/60">Benchmarks:</span> {benchmarkTracker.total}
                  </div>
                  <div>
                    <span className="font-medium text-foreground/80/60">Campaigns:</span> {summary.totalCampaigns}
                  </div>
                  <div>
                    <span className="font-medium text-foreground/80/60">Data source:</span> Meta Graph API
                  </div>
                </div>
              </div>

              {/* Performance Tracker Panel */}
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
                        <p className="text-xs text-muted-foreground">meeting or exceeding benchmark</p>
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
                        <p className="text-xs text-muted-foreground">within 70–90% of benchmark</p>
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
                        <p className="text-2xl font-bold text-foreground">{benchmarkTracker.avgPct.toFixed(1)}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Benchmark Cards */}
              {benchmarksLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-muted rounded"></div>
                  <div className="h-32 bg-muted rounded"></div>
                </div>
              ) : Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {benchmarksData.map((benchmark: any) => {
                    const metricKey = benchmark.metric || '';
                    const metricDef = getMetaMetricDef(metricKey);
                    const currentVal = getLiveMetricValue(metricKey);
                    const benchVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue || '0');
                    const progress = computeProgress(currentVal, benchVal, metricKey);
                    const progressFill = Math.min(progress.pct, 100);
                    const progressColor = progress.status === 'on_track' ? 'bg-green-500' : progress.status === 'needs_attention' ? 'bg-amber-500' : 'bg-red-500';

                    return (
                      <Card key={benchmark.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground text-lg">
                                  {benchmark.name}
                                </h3>
                                {metricKey && (
                                  <Badge variant="outline" className="bg-muted text-foreground/80/60 font-mono">
                                    {metricKey.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground/70 mt-1">
                                {benchmark.description || `Compare ${metricDef.label} against benchmark`}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                {benchmark.industry && <span>{benchmark.industry}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingBenchmark(benchmark);
                                  setBenchmarkForm({
                                    metric: metricKey,
                                    name: benchmark.name || '',
                                    benchmarkValue: benchmark.benchmarkValue || benchmark.targetValue || '',
                                    description: benchmark.description || '',
                                    industry: benchmark.industry || '',
                                    currentValue: String(currentVal),
                                    unit: benchmark.unit || metricDef.unit || '',
                                    benchmarkType: benchmark.benchmarkType || 'custom',
                                    applyTo: benchmark.applyTo || 'all',
                                    specificCampaignId: benchmark.specificCampaignId || '',
                                    alertsEnabled: !!benchmark.alertsEnabled,
                                    emailNotifications: !!benchmark.emailNotifications,
                                    alertFrequency: benchmark.alertFrequency || 'daily',
                                    alertThreshold: benchmark.alertThreshold || '',
                                    alertCondition: benchmark.alertCondition || 'below',
                                    emailRecipients: benchmark.emailRecipients || '',
                                  });
                                  setIsBenchmarkModalOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{benchmark.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)} className="bg-red-600 hover:bg-red-700">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current Value</div>
                              <div className="text-lg font-bold text-foreground">
                                {formatMetaMetricValue(metricKey, currentVal)}
                              </div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">Benchmark Value</div>
                              <div className="text-lg font-bold text-foreground">
                                {formatMetaMetricValue(metricKey, benchVal)}
                              </div>
                            </div>
                          </div>

                          {benchVal > 0 && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                <span>Progress</span>
                                <span>{Math.round(progress.pct)}%</span>
                              </div>
                              <Progress value={progressFill} className="mt-2 h-2" indicatorClassName={progressColor} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground/70">
                  No benchmarks have been created yet. Click "Add Benchmark" to compare your Meta performance against industry standards.
                </div>
              )}
            </TabsContent>

            <TabsContent value="ad-comparison" className="space-y-6 fade-in">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-foreground">Campaign Comparison</h2>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Compare performance across selected Meta campaigns
                </p>
              </div>

              {/* Performance Rankings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Best CTR
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-green-600">{bestCtrCampaign?.campaign?.name || 'No selected campaign data'}</p>
                        <p className="text-xs text-muted-foreground/70">
                          CTR: {bestCtrCampaign ? formatPct(Number(bestCtrCampaign?.totals?.ctr || 0)) : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Lowest CPC
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-blue-600">{mostEfficientCampaign?.campaign?.name || 'No selected campaign data'}</p>
                        <p className="text-xs text-muted-foreground/70">
                          CPC: {mostEfficientCampaign ? fmtCurrency(Number(mostEfficientCampaign?.totals?.cpc || 0)) : '-'} | CPM: {mostEfficientCampaign ? fmtCurrency(Number(mostEfficientCampaign?.totals?.cpm || 0)) : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      Lowest Conversion Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-orange-600">{needsAttentionCampaign?.campaign?.name || 'No selected campaign data'}</p>
                        <p className="text-xs text-muted-foreground/70">
                          Conv Rate: {needsAttentionCampaign ? formatPct(Number(needsAttentionCampaign?.totals?.conversionRate || 0)) : '-'} | Cost/Conv: {needsAttentionCampaign ? fmtCurrency(Number(needsAttentionCampaign?.totals?.costPerConversion || 0)) : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign Performance & Spend by Objective Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Top 5 campaigns by spend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaignPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="spend" fill="#3b82f6" name="Spend ($)" />
                        <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Spend by Objective</CardTitle>
                    <CardDescription>Budget allocation across selected campaign objectives</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={objectiveData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name}: $${entry.value.toFixed(0)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {objectiveData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Campaign Comparison - Card Layout */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Campaign Comparison</CardTitle>
                  <CardDescription>Side-by-side metrics for selected campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaigns.map((campaignData: any) => {
                      const { campaign, totals } = campaignData;
                      const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      const formatNum = (v: number) => v.toLocaleString();
                      // formatPct imported from @shared/metric-math
                      const performanceScore = (totals.ctr * 10 + totals.conversionRate * 5) / 2;
                      const performance = performanceScore > 20 ? 'excellent' : performanceScore > 15 ? 'good' : performanceScore > 10 ? 'average' : 'poor';

                      return (
                        <div key={campaign.id} className="border rounded-lg p-4 bg-card">
                          {/* Campaign header with performance badge */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">{campaign.name}</h4>
                              <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                {campaign.status}
                              </Badge>
                              {performance === 'excellent' && <Badge variant="default" className="bg-green-500 text-xs">Excellent</Badge>}
                              {performance === 'good' && <Badge variant="default" className="bg-blue-500 text-xs">Good</Badge>}
                              {performance === 'average' && <Badge variant="secondary" className="text-xs">Average</Badge>}
                              {performance === 'poor' && <Badge variant="destructive" className="text-xs">Poor</Badge>}
                            </div>
                            <span className="text-lg font-bold text-foreground">{formatCurrency(totals.spend || 0)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{campaign.objective}</p>

                          {/* Core metrics — prominent */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Impressions</p>
                              <p className="text-base font-bold text-foreground">{formatNum(totals.impressions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Reach</p>
                              <p className="text-base font-bold text-foreground">{formatNum(totals.reach)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Clicks</p>
                              <p className="text-base font-bold text-foreground">{formatNum(totals.clicks)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">CTR</p>
                              <p className={`text-base font-bold ${totals.ctr > 1.5 ? 'text-green-600' : totals.ctr < 1.0 ? 'text-red-600' : 'text-foreground'}`}>
                                {formatPct(totals.ctr)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Conversions</p>
                              <p className="text-base font-bold text-foreground">{formatNum(totals.conversions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Conv Rate</p>
                              <p className={`text-base font-bold ${totals.conversionRate > 3.0 ? 'text-green-600' : totals.conversionRate < 2.0 ? 'text-red-600' : 'text-foreground'}`}>
                                {formatPct(totals.conversionRate)}
                              </p>
                            </div>
                          </div>

                          {/* Secondary metrics — smaller */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">CPC</p>
                              <p className={`text-sm font-semibold ${totals.cpc < 1.0 ? 'text-green-600' : totals.cpc > 1.5 ? 'text-red-600' : 'text-foreground/80/60'}`}>
                                {formatCurrency(totals.cpc)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">CPM</p>
                              <p className={`text-sm font-semibold ${totals.cpm < 12 ? 'text-green-600' : totals.cpm > 18 ? 'text-red-600' : 'text-foreground/80/60'}`}>
                                {formatCurrency(totals.cpm)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">CPP</p>
                              <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.cpp)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Frequency</p>
                              <p className={`text-sm font-semibold ${totals.frequency > 3.0 ? 'text-orange-600' : 'text-foreground/80/60'}`}>
                                {totals.frequency.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Cost/Conv</p>
                              <p className="text-sm font-semibold text-foreground/80/60">{formatCurrency(totals.costPerConversion)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Video Views</p>
                              <p className="text-sm font-semibold text-foreground/80/60">{formatNum(totals.videoViews)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Comparison Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>CTR Comparison</CardTitle>
                    <CardDescription>Click-through rate across selected campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), ctr: c.totals.ctr }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="ctr" fill="#3b82f6" name="CTR (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Rate Comparison</CardTitle>
                    <CardDescription>Conversion rate across selected campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), convRate: c.totals.conversionRate }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="convRate" fill="#10b981" name="Conv Rate (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

            </TabsContent>

            <TabsContent value="insights" className="space-y-6 fade-in">
              <div className="space-y-6 fade-in">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Insights</h2>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Actionable insights from financial metrics plus KPI + Benchmark performance.
                  </p>
                </div>

                {/* Executive Financials */}
                <Card className="border-border">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle>Executive financials</CardTitle>
                        <CardDescription>
                          Spend comes from Meta imports. Imported revenue is managed in the Overview Total Revenue card.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-muted-foreground/70">Spend</div>
                          <div className="text-2xl font-bold text-foreground">
                            ${summary.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">Source: Meta Ads</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-muted-foreground/70">Total Revenue</div>
                          <div className="text-2xl font-bold text-foreground">
                            {hasMetaAttributedRevenue ? fmtCurrency(metaAttributedRevenue) : "Not connected"}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">Imported Meta attributed revenue</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-muted-foreground/70">Profit</div>
                          <div className={`text-2xl font-bold ${hasMetaAttributedRevenue && metaAttributedProfit < 0 ? 'text-red-600' : 'text-foreground'}`}>
                            {hasMetaAttributedRevenue ? fmtCurrency(metaAttributedProfit) : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">Attributed revenue - spend</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-muted-foreground/70">ROAS</div>
                          <div className="text-2xl font-bold text-foreground">
                            {hasMetaAttributedRevenue ? `${metaAttributedRoas.toFixed(2)}x` : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">Attributed revenue / spend</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-muted-foreground/70">ROI</div>
                          <div className={`text-2xl font-bold ${hasMetaAttributedRevenue && metaAttributedRoi < 0 ? 'text-red-600' : 'text-foreground'}`}>
                            {hasMetaAttributedRevenue ? formatPct(metaAttributedRoi) : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">Attributed revenue ROI</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground/70">
                      <div className="font-medium text-foreground/80/60 mb-1">Sources used</div>
                      <div className="grid gap-1">
                        <div>
                          <span className="font-medium">Spend</span>: Meta Graph API
                        </div>
                        <div>
                          <span className="font-medium">Revenue</span>: {hasMetaAttributedRevenue ? `Meta attributed revenue sources (${activeMetaRevenueSources.length})` : "Not connected"}
                        </div>
                        <div>
                          <span className="font-medium">Profit, ROAS, ROI</span>: {hasMetaAttributedRevenue ? "Meta attributed revenue + Meta spend" : "Unavailable until Meta attributed revenue is connected"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trends - Daily/7d/30d */}
                <Card className="border-border">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <CardTitle>Trends</CardTitle>
                        <CardDescription>
                          Daily shows day-by-day values. 7d/30d smooth the chart with rolling windows; the table summarizes the latest window vs the prior window.
                        </CardDescription>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="flex items-center gap-2">
                          <Button type="button" variant={insightsTrendMode === 'daily' ? 'default' : 'outline'} size="sm"
                            onClick={() => { setInsightsDailyShowMore(false); setInsightsTrendMode('daily'); }}>Daily</Button>
                          <Button type="button" variant={insightsTrendMode === '7d' ? 'default' : 'outline'} size="sm"
                            onClick={() => setInsightsTrendMode('7d')}>7d</Button>
                          <Button type="button" variant={insightsTrendMode === '30d' ? 'default' : 'outline'} size="sm"
                            onClick={() => setInsightsTrendMode('30d')}>30d</Button>
                        </div>
                        <div className="min-w-[220px]">
                          <Select value={insightsTrendMetric} onValueChange={(v: any) => setInsightsTrendMetric(v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Metric" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spend">Spend</SelectItem>
                              <SelectItem value="impressions">Impressions</SelectItem>
                              <SelectItem value="clicks">Clicks</SelectItem>
                              <SelectItem value="conversions">Conversions</SelectItem>
                              <SelectItem value="ctr">CTR</SelectItem>
                              <SelectItem value="cpc">CPC</SelectItem>
                              <SelectItem value="cpm">CPM</SelectItem>
                              <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {metaDailyLoading ? (
                      <div className="text-sm text-muted-foreground/70">Loading daily history...</div>
                    ) : (
                      <>
                        {(() => {
                          const series = insightsTrendMode === 'daily' ? metaDailySeries.daily
                            : insightsTrendMode === '7d' ? metaDailySeries.rolling7 : metaDailySeries.rolling30;
                          const minRequired = insightsTrendMode === 'daily' ? 2 : insightsTrendMode === '7d' ? 14 : 60;
                          const available = metaInsightsRollups.availableDays;

                          if (available <= 0) {
                            return (
                              <div className="text-sm text-muted-foreground/70">
                                No Meta daily history is available yet. Connect your Meta account and wait for daily data to populate.
                              </div>
                            );
                          }
                          if (available < minRequired) {
                            return (
                              <div className="text-sm text-muted-foreground/70">
                                Need at least {minRequired} days of Meta daily history for this view. Available days: {available}.
                              </div>
                            );
                          }

                          const formatChartValue = (v: any) => {
                            const n = Number(v || 0) || 0;
                            if (insightsTrendMetric === 'spend') return `$${n.toFixed(2)}`;
                            if (insightsTrendMetric === 'ctr' || insightsTrendMetric === 'conversionRate') return `${formatPct(n)}`;
                            if (insightsTrendMetric === 'cpc' || insightsTrendMetric === 'cpm') return `$${n.toFixed(2)}`;
                            return n.toLocaleString();
                          };

                          return (
                            <div className="h-[280px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={series}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: any) => formatShortDate(String(v || ''))} />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip formatter={(value: any) => formatChartValue(value)} />
                                  <Legend />
                                  <Line type="monotone" dataKey={insightsTrendMetric} stroke="#7c3aed" strokeWidth={2} dot={false}
                                    name={(() => {
                                      const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate' };
                                      return labels[insightsTrendMetric] || insightsTrendMetric;
                                    })()} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}

                        {/* Table view */}
                        <div className="overflow-hidden border rounded-md">
                          {insightsTrendMode === 'daily' ? (
                            <div>
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-muted border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[38%]">Date</th>
                                    <th className="text-right p-3 w-[31%]">
                                      {(() => {
                                        const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate' };
                                        return labels[insightsTrendMetric] || 'Metric';
                                      })()}
                                    </th>
                                    <th className="text-right p-3 w-[31%]">vs prior</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const daily = metaDailySeries.daily;
                                    const visibleDays = insightsDailyShowMore ? 14 : 7;
                                    const rows = daily.slice(-visibleDays);
                                    if (rows.length === 0) {
                                      return (
                                        <tr><td colSpan={3} className="p-4 text-sm text-muted-foreground/70">No daily records available yet.</td></tr>
                                      );
                                    }
                                    return rows.map((r: any, idx: number, arr: any[]) => {
                                      const prev = idx > 0 ? arr[idx - 1] : null;
                                      const metricKey = insightsTrendMetric;
                                      const curVal = Number(r?.[metricKey] ?? 0) || 0;
                                      const prevVal = Number(prev?.[metricKey] ?? 0) || 0;
                                      const deltaPct = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;
                                      const showDelta = !!prev && prevVal > 0;

                                      const formatValue = (key: string, v: number) => {
                                        if (key === 'spend' || key === 'cpc' || key === 'cpm') return `$${v.toFixed(2)}`;
                                        if (key === 'ctr' || key === 'conversionRate') return `${formatPct(v)}`;
                                        return v.toLocaleString();
                                      };

                                      return (
                                        <tr key={r.date} className="border-b">
                                          <td className="p-3">
                                            <div className="font-medium text-foreground">{formatShortDate(String(r.date || ''))}</div>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className="font-medium text-foreground">{formatValue(metricKey, curVal)}</div>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className={`text-xs ${showDelta ? (deltaPct >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300') : 'text-muted-foreground/70'}`}>
                                              {showDelta ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : '—'}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                              {metaDailySeries.daily.length > 7 && (
                                <div className="flex justify-end px-3 py-2 bg-card">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setInsightsDailyShowMore((v) => !v)} className="h-8 text-xs">
                                    {insightsDailyShowMore ? 'View less' : 'View more'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-muted border-b">
                                <tr>
                                  <th className="text-left p-3 w-[38%]">Period</th>
                                  <th className="text-right p-3 w-[31%]">
                                    {(() => {
                                      const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate' };
                                      return labels[insightsTrendMetric] || 'Metric';
                                    })()}
                                  </th>
                                  <th className="text-right p-3 w-[31%]">vs prior</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const is7 = insightsTrendMode === '7d';
                                  const available = metaInsightsRollups.availableDays;
                                  const minRequired = is7 ? 14 : 60;
                                  if (available < minRequired) {
                                    return (
                                      <tr><td colSpan={3} className="p-4 text-sm text-muted-foreground/70">
                                        {available <= 0 ? 'No records available yet.' : `Need at least ${minRequired} days for this view. Available: ${available}.`}
                                      </td></tr>
                                    );
                                  }
                                  const row = is7
                                    ? { key: '7d', cur: metaInsightsRollups.last7, d: metaInsightsRollups.deltas, label: 'Last 7d vs prior 7d' }
                                    : { key: '30d', cur: metaInsightsRollups.last30, d: metaInsightsRollups.deltas, label: 'Last 30d vs prior 30d' };

                                  const metricKey = insightsTrendMetric;
                                  const valueFor = (obj: any) => {
                                    const v = Number(obj?.[metricKey] ?? 0) || 0;
                                    if (metricKey === 'spend' || metricKey === 'cpc' || metricKey === 'cpm') return `$${v.toFixed(2)}`;
                                    if (metricKey === 'ctr' || metricKey === 'conversionRate') return `${formatPct(v)}`;
                                    return v.toLocaleString();
                                  };
                                  const suffix = is7 ? '7' : '30';
                                  const deltaKey = `${metricKey}${suffix}` as keyof typeof row.d;
                                  const delta = Number(row.d[deltaKey] ?? 0);
                                  const deltaColor = delta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300';

                                  return (
                                    <tr key={row.key} className="border-b">
                                      <td className="p-3">
                                        <div className="font-medium text-foreground">{row.cur.endDate}</div>
                                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                                          {row.cur.startDate} → {row.cur.endDate} ({row.label})
                                        </div>
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className="font-medium text-foreground">{valueFor(row.cur)}</div>
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className={`text-xs ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Insight summary counter cards */}
                {(() => {
                  const allInsights: Array<{ id: string; title: string; description: string; severity: string; recommendation: string; group: string }> = [];

                  // Generate insights from KPI tracker
                  const kpis = Array.isArray(kpisData) ? kpisData : [];
                  kpis.forEach((kpi: any) => {
                    const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                    const target = parseFloat(kpi.targetValue || '0');
                    const p = computeProgress(current, target, kpi.metric || kpi.metricKey || '');
                    const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                    if (p.status === 'behind') {
                      allInsights.push({
                        id: `kpi-behind-${kpi.id}`,
                        title: `KPI Behind: ${kpi.name}`,
                        description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`,
                        severity: 'high',
                        recommendation: `Focus on improving ${def.label} to close the gap to your target.`,
                        group: 'performance',
                      });
                    } else if (p.status === 'needs_attention') {
                      allInsights.push({
                        id: `kpi-attention-${kpi.id}`,
                        title: `KPI Needs Attention: ${kpi.name}`,
                        description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`,
                        severity: 'medium',
                        recommendation: `Monitor ${def.label} closely and consider optimization strategies.`,
                        group: 'performance',
                      });
                    }
                  });

                  // Generate insights from Benchmark tracker
                  const benchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
                  benchmarks.forEach((b: any) => {
                    const current = getLiveMetricValue(b.metric || '');
                    const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                    const p = computeProgress(current, benchVal, b.metric || '');
                    const def = getMetaMetricDef(b.metric || '');
                    if (p.status === 'behind') {
                      allInsights.push({
                        id: `bench-behind-${b.id}`,
                        title: `Below Benchmark: ${b.name}`,
                        description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)} (${Math.min(p.pct, 200).toFixed(0)}% of benchmark).`,
                        severity: 'high',
                        recommendation: `Your ${def.label} is below industry benchmark. Review campaign strategy.`,
                        group: 'performance',
                      });
                    } else if (p.status === 'needs_attention') {
                      allInsights.push({
                        id: `bench-attention-${b.id}`,
                        title: `Near Benchmark: ${b.name}`,
                        description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)}.`,
                        severity: 'medium',
                        recommendation: `${def.label} is close to benchmark but could use improvement.`,
                        group: 'performance',
                      });
                    }
                  });

                  // Generate source-safe campaign-level budget optimization insights
                  const budgetCampaignRows = (Array.isArray(campaigns) ? campaigns : [])
                    .map((campaignData: any) => {
                      const campaign = campaignData?.campaign || {};
                      const totals = campaignData?.totals || {};
                      const campaignId = String(campaign?.id || '');
                      const spend = Number(totals?.spend || 0) || 0;
                      const conversions = Number(totals?.conversions || 0) || 0;
                      const costPerConversion = Number(totals?.costPerConversion || 0) || (conversions > 0 ? spend / conversions : 0);
                      return {
                        id: campaignId,
                        name: String(campaign?.name || campaignId || 'Meta campaign'),
                        spend,
                        conversions,
                        clicks: Number(totals?.clicks || 0) || 0,
                        ctr: Number(totals?.ctr || 0) || 0,
                        cpc: Number(totals?.cpc || 0) || 0,
                        cpm: Number(totals?.cpm || 0) || 0,
                        costPerConversion,
                      };
                    })
                    .filter((row: any) => row.id && row.spend > 0);
                  const campaignsWithConversions = budgetCampaignRows.filter((row: any) => row.conversions > 0 && row.costPerConversion > 0);
                  const efficientCampaign = [...campaignsWithConversions].sort((a: any, b: any) => a.costPerConversion - b.costPerConversion)[0];
                  const inefficientCampaign = [...budgetCampaignRows].sort((a: any, b: any) => {
                    if (a.conversions === 0 && b.conversions > 0) return -1;
                    if (b.conversions === 0 && a.conversions > 0) return 1;
                    return b.costPerConversion - a.costPerConversion;
                  })[0];
                  const budgetSource = 'Source: Meta campaign metrics from selected Meta campaign rows.';

                  if (efficientCampaign) {
                    allInsights.push({
                      id: `budget-efficient-${efficientCampaign.id}`,
                      title: `Budget Efficiency Opportunity: ${efficientCampaign.name}`,
                      description: `${budgetSource} Spend is ${fmtCurrency(efficientCampaign.spend)}, conversions are ${efficientCampaign.conversions.toLocaleString()}, and cost/conversion is ${fmtCurrency(efficientCampaign.costPerConversion)}.`,
                      severity: 'medium',
                      recommendation: 'Review this campaign as a candidate for incremental budget before scaling lower-efficiency campaigns.',
                      group: 'budget',
                    });
                  }
                  if (inefficientCampaign && inefficientCampaign.id !== efficientCampaign?.id) {
                    allInsights.push({
                      id: `budget-review-${inefficientCampaign.id}`,
                      title: `Budget Review Needed: ${inefficientCampaign.name}`,
                      description: `${budgetSource} Spend is ${fmtCurrency(inefficientCampaign.spend)}, conversions are ${inefficientCampaign.conversions.toLocaleString()}, and cost/conversion is ${inefficientCampaign.conversions > 0 ? fmtCurrency(inefficientCampaign.costPerConversion) : 'unavailable because conversions are 0'}.`,
                      severity: inefficientCampaign.conversions === 0 ? 'high' : 'medium',
                      recommendation: 'Review targeting, creative, and spend before increasing this campaign budget.',
                      group: 'budget',
                    });
                  }

                  // Generate source-safe selected-campaign breakdown efficiency insights
                  const addBreakdownEfficiencyInsight = (kind: 'placement' | 'location' | 'demographic', rows: any[], labelFor: (row: any) => string) => {
                    const efficiencyRows = rows
                      .map((row: any) => {
                        const spend = Number(row?.spend || 0) || 0;
                        const conversions = Number(row?.conversions || 0) || 0;
                        const clicks = Number(row?.clicks || 0) || 0;
                        return {
                          label: labelFor(row),
                          spend,
                          clicks,
                          conversions,
                          costPerConversion: conversions > 0 ? spend / conversions : 0,
                        };
                      })
                      .filter((row: any) => row.label && row.spend > 0 && row.conversions > 0);
                    const efficient = [...efficiencyRows].sort((a: any, b: any) => a.costPerConversion - b.costPerConversion)[0];
                    const inefficient = [...efficiencyRows].sort((a: any, b: any) => b.costPerConversion - a.costPerConversion)[0];
                    const titleLabel = kind === 'placement' ? 'Placement' : kind === 'location' ? 'Location' : 'Demographic';
                    const sourceLabel = `Source: Meta ${kind} breakdown for the selected campaign.`;

                    if (efficient) {
                      allInsights.push({
                        id: `breakdown-efficient-${kind}-${efficient.label}`,
                        title: `${titleLabel} Efficiency Opportunity: ${efficient.label}`,
                        description: `${sourceLabel} Spend is ${fmtCurrency(efficient.spend)}, clicks are ${efficient.clicks.toLocaleString()}, conversions are ${efficient.conversions.toLocaleString()}, and cost/conversion is ${fmtCurrency(efficient.costPerConversion)}.`,
                        severity: 'medium',
                        recommendation: `Review this ${kind} as a candidate for focused optimization within the selected campaign.`,
                        group: 'breakdown',
                      });
                    }
                    if (inefficient && inefficient.label !== efficient?.label) {
                      allInsights.push({
                        id: `breakdown-review-${kind}-${inefficient.label}`,
                        title: `${titleLabel} Efficiency Review: ${inefficient.label}`,
                        description: `${sourceLabel} Spend is ${fmtCurrency(inefficient.spend)}, clicks are ${inefficient.clicks.toLocaleString()}, conversions are ${inefficient.conversions.toLocaleString()}, and cost/conversion is ${fmtCurrency(inefficient.costPerConversion)}.`,
                        severity: 'medium',
                        recommendation: `Review spend, targeting, and creative before increasing this ${kind}.`,
                        group: 'breakdown',
                      });
                    }
                  };
                  addBreakdownEfficiencyInsight('placement', selectedCampaignPlacements, (row: any) =>
                    String(row?.placement || [row?.publisherPlatform, row?.platformPosition].filter(Boolean).join(' / ') || '').trim()
                  );
                  addBreakdownEfficiencyInsight('location', selectedCampaignGeographics, (row: any) => String(row?.country || '').trim());
                  addBreakdownEfficiencyInsight('demographic', selectedCampaignDemographics, (row: any) =>
                    [row?.ageRange || row?.age, row?.gender].filter(Boolean).join(' / ')
                  );

                  // Generate insights from campaign performance
                  if (summary.avgFrequency > 3.0) {
                    allInsights.push({
                      id: 'frequency-high',
                      title: 'High Ad Frequency Detected',
                      description: `Average frequency is ${summary.avgFrequency.toFixed(2)}, above the 3.0 fatigue threshold. This may indicate audience saturation.`,
                      severity: 'high',
                      recommendation: 'Consider refreshing creatives, expanding targeting, or pausing campaigns with high frequency.',
                      group: 'integrity',
                    });
                  }
                  if (summary.avgCTR < 0.5) {
                    allInsights.push({
                      id: 'ctr-low',
                      title: 'Low CTR Across Campaigns',
                      description: `Average CTR is ${formatPct(summary.avgCTR)}, which is below the typical 0.5% threshold.`,
                      severity: 'medium',
                      recommendation: 'Review ad creative and targeting. Test new ad formats or audience segments.',
                      group: 'performance',
                    });
                  }
                  if (!hasMetaAttributedRevenue) {
                    allInsights.push({
                      id: 'no-revenue',
                      title: 'Revenue Tracking Not Connected',
                      description: 'Meta imported revenue is not connected.',
                      severity: 'low',
                      recommendation: 'Use the Overview Total Revenue card to connect and review Meta attributed revenue.',
                      group: 'integrity',
                    });
                  }

                  const highPriority = allInsights.filter(i => i.severity === 'high');
                  const medPriority = allInsights.filter(i => i.severity === 'medium');

                  return (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground/70">Total insights</p>
                                <p className="text-2xl font-bold text-foreground">{allInsights.length}</p>
                              </div>
                              <Activity className="w-7 h-7 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground/70">High priority</p>
                                <p className="text-2xl font-bold text-red-600">{highPriority.length}</p>
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
                                <p className="text-2xl font-bold text-amber-600">{medPriority.length}</p>
                              </div>
                              <TrendingDown className="w-7 h-7 text-amber-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* What changed, what to do next */}
                      <Card className="border-border">
                        <CardHeader>
                          <CardTitle>What changed, what to do next</CardTitle>
                          <CardDescription>
                            Insights from KPI/Benchmark evaluations and campaign performance analysis.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Goal impact panel */}
                          {(kpiTracker.behind > 0 || benchmarkTracker.behind > 0) && (
                            <div className="rounded-md border border-border p-3">
                              <div className="text-sm font-semibold text-foreground mb-3">
                                Goal impact (KPIs & Benchmarks)
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {kpiTracker.behind > 0 && (
                                  <div className="rounded-md border border-border p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-foreground">Top KPI gaps</div>
                                      <Badge variant="outline" className="text-xs">{kpiTracker.behind}</Badge>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {kpis.filter((kpi: any) => {
                                        const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                        const target = parseFloat(kpi.targetValue || '0');
                                        return computeProgress(current, target, kpi.metric || kpi.metricKey || '').status === 'behind';
                                      }).slice(0, 5).map((kpi: any) => {
                                        const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                        const target = parseFloat(kpi.targetValue || '0');
                                        const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                                        return (
                                          <div key={kpi.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-foreground truncate">{kpi.name}</div>
                                              <div className="text-xs text-muted-foreground/70 truncate">
                                                {def.label}: {def.format(current)} / {def.format(target)}
                                              </div>
                                            </div>
                                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                              Behind
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {benchmarkTracker.behind > 0 && (
                                  <div className="rounded-md border border-border p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-foreground">Top Benchmark gaps</div>
                                      <Badge variant="outline" className="text-xs">{benchmarkTracker.behind}</Badge>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {benchmarks.filter((b: any) => {
                                        const current = getLiveMetricValue(b.metric || '');
                                        const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                        return computeProgress(current, benchVal, b.metric || '').status === 'behind';
                                      }).slice(0, 5).map((b: any) => {
                                        const current = getLiveMetricValue(b.metric || '');
                                        const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                        const def = getMetaMetricDef(b.metric || '');
                                        return (
                                          <div key={b.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-foreground truncate">{b.name}</div>
                                              <div className="text-xs text-muted-foreground/70 truncate">
                                                {def.label}: {def.format(current)} / {def.format(benchVal)}
                                              </div>
                                            </div>
                                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                              Behind
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Success stories */}
                          {(kpiTracker.onTrack > 0 || benchmarkTracker.onTrack > 0) && (
                            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                              <CardHeader>
                                <div className="text-sm font-semibold text-foreground">Success stories</div>
                                <CardDescription className="text-emerald-700 dark:text-emerald-300 mt-1">
                                  KPIs and Benchmarks currently meeting or exceeding targets
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {kpiTracker.onTrack > 0 && (
                                    <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-card p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-foreground">On-track KPIs</div>
                                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700">
                                          {kpiTracker.onTrack}
                                        </Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {kpis.filter((kpi: any) => {
                                          const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                          const target = parseFloat(kpi.targetValue || '0');
                                          return computeProgress(current, target, kpi.metric || kpi.metricKey || '').status === 'on_track';
                                        }).slice(0, 5).map((kpi: any) => {
                                          const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                                          const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                          return (
                                            <div key={kpi.id} className="flex items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate">{kpi.name}</div>
                                                <div className="text-xs text-muted-foreground/70 truncate">
                                                  {def.label}: {def.format(current)}
                                                </div>
                                              </div>
                                              <Badge className="text-xs border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900">
                                                On Track
                                              </Badge>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {benchmarkTracker.onTrack > 0 && (
                                    <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-card p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-foreground">On-track Benchmarks</div>
                                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700">
                                          {benchmarkTracker.onTrack}
                                        </Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {benchmarks.filter((b: any) => {
                                          const current = getLiveMetricValue(b.metric || '');
                                          const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                          return computeProgress(current, benchVal, b.metric || '').status === 'on_track';
                                        }).slice(0, 5).map((b: any) => {
                                          const def = getMetaMetricDef(b.metric || '');
                                          const current = getLiveMetricValue(b.metric || '');
                                          return (
                                            <div key={b.id} className="flex items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate">{b.name}</div>
                                                <div className="text-xs text-muted-foreground/70 truncate">
                                                  {def.label}: {def.format(current)}
                                                </div>
                                              </div>
                                              <Badge className="text-xs border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900">
                                                On Track
                                              </Badge>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Insight cards */}
                          {allInsights.length === 0 ? (
                            <div className="text-sm text-muted-foreground/70">
                              No insights available yet. Create KPIs and Benchmarks to unlock performance insights.
                            </div>
                          ) : (
                            <>
                              {allInsights.filter(i => i.group === 'integrity').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-foreground/80/60">Data integrity & configuration</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'integrity').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'integrity').map(i => (
                                    <div key={i.id} className="rounded-lg border border-border p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-foreground">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-muted text-foreground border-border dark:text-slate-200'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-muted-foreground/70 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-foreground/80/60 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {allInsights.filter(i => i.group === 'budget').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-foreground/80/60">Budget optimization</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'budget').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'budget').map(i => (
                                    <div key={i.id} className="rounded-lg border border-border p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-foreground">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-muted text-foreground border-border dark:text-slate-200'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-muted-foreground/70 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-foreground/80/60 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {allInsights.filter(i => i.group === 'breakdown').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-foreground/80">Audience and placement efficiency</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'breakdown').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'breakdown').map(i => (
                                    <div key={i.id} className="rounded-lg border border-border p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-foreground">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-muted text-foreground border-border dark:text-slate-200'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-muted-foreground/70 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-foreground/80 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {allInsights.filter(i => i.group === 'performance').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-foreground/80/60">Performance & KPI/Benchmark gaps</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'performance').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'performance').map(i => (
                                    <div key={i.id} className="rounded-lg border border-border p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-foreground">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-muted text-foreground border-border dark:text-slate-200'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-muted-foreground/70 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-foreground/80/60 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6 fade-in">
              {/* Header with Create Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Reports</h2>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Create, schedule, and manage Meta analytics reports
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setEditingReport(null);
                      setReportModalStep('standard');
                      setReportFormErrors({});
                      setCustomReportConfig({
                        coreMetrics: [], derivedMetrics: [], revenueMetrics: [], campaignBreakdown: [],
                        kpis: [], benchmarks: [], insights: [], demographics: [],
                      });
                      setReportForm({
                        name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly',
                        scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false,
                        scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end',
                      });
                      setIsReportModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Report
                  </Button>
                </div>
              </div>

              {/* Reports List */}
              {reportsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-muted rounded"></div>
                  <div className="h-32 bg-muted rounded"></div>
                </div>
              ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {(reportsData as any[]).map((report: any) => (
                    <Card key={report.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">
                              {report.name}
                            </h3>
                            {report.description && (
                              <p className="text-sm text-muted-foreground/70 mb-3">
                                {report.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              <Badge variant="outline">{report.reportType || 'performance_summary'}</Badge>
                              {report.scheduleEnabled && report.scheduleFrequency && (
                                <span className="text-muted-foreground flex items-center gap-1">
                                  {report.scheduleFrequency}{report.scheduleTime ? ` at ${from24HourTo12Hour(report.scheduleTime)}` : ''}
                                </span>
                              )}
                              {report.lastSentAt && (
                                <span className="text-muted-foreground">
                                  Last sent {new Date(report.lastSentAt).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-muted-foreground/70">
                                Created {new Date(report.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const reportType = normalizeMetaReportType(report.reportType);
                                const reportConfiguration = parseMetaReportConfiguration(report.configuration);
                                const emailRecipients = Array.isArray(report.scheduleRecipients)
                                  ? report.scheduleRecipients.join(', ')
                                  : String(report.emailRecipients || '');
                                setEditingReport(report);
                                setReportModalStep(reportType === 'custom' ? 'custom' : 'standard');
                                if (reportType === 'custom') {
                                  setCustomReportConfig({
                                    coreMetrics: [], derivedMetrics: [], revenueMetrics: [], campaignBreakdown: [],
                                    kpis: [], benchmarks: [], insights: [], demographics: [],
                                    ...reportConfiguration,
                                  });
                                }
                                setReportForm({
                                  name: report.name || '',
                                  description: report.description || '',
                                  reportType,
                                  configuration: reportConfiguration,
                                  scheduleFrequency: report.scheduleFrequency || 'weekly',
                                  scheduleTime: from24HourTo12Hour(report.scheduleTime) || '9:00 AM',
                                  emailRecipients,
                                  scheduleEnabled: report.scheduleEnabled || false,
                                  scheduleDayOfWeek: dayOfWeekIntToKey(report.scheduleDayOfWeek),
                                  scheduleDayOfMonth: report.scheduleDayOfMonth === 0 ? 'last' : String(report.scheduleDayOfMonth || 'first'),
                                  quarterTiming: report.quarterTiming || 'end',
                                });
                                setIsReportModalOpen(true);
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
                                    Are you sure you want to delete "{report.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteReportMutation.mutate(report.id)}
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
                <Card>
                  <CardContent>
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-muted-foreground/60/80 mx-auto mb-4" />
                      <p className="text-muted-foreground/70">No reports created yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-2">
                        Create your first report to get started
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* KPI Modal */}
          <MetaKpiModal
            isKPIModalOpen={isKPIModalOpen}
            setIsKPIModalOpen={setIsKPIModalOpen}
            editingKPI={editingKPI}
            setEditingKPI={setEditingKPI}
            kpiForm={kpiForm}
            setKpiForm={setKpiForm}
            summary={{
              ...summary,
              totalRevenue: metaRevenueMetricSummary.totalRevenue,
              profit: metaRevenueMetricSummary.profit,
              roas: metaRevenueMetricSummary.roas,
              roi: metaRevenueMetricSummary.roi,
              profitMargin: metaRevenueMetricSummary.profitMargin,
            }}
            revenueSummary={metaRevenueMetricSummary}
            campaigns={campaigns}
            toast={toast}
            handleCreateKPI={handleCreateKPI}
          />

          {/* Benchmark Modal */}
          <MetaBenchmarkModal
            isBenchmarkModalOpen={isBenchmarkModalOpen}
            setIsBenchmarkModalOpen={setIsBenchmarkModalOpen}
            editingBenchmark={editingBenchmark}
            setEditingBenchmark={setEditingBenchmark}
            benchmarkForm={benchmarkForm}
            setBenchmarkForm={setBenchmarkForm}
            summary={{
              ...summary,
              totalRevenue: metaRevenueMetricSummary.totalRevenue,
              profit: metaRevenueMetricSummary.profit,
              roas: metaRevenueMetricSummary.roas,
              roi: metaRevenueMetricSummary.roi,
              profitMargin: metaRevenueMetricSummary.profitMargin,
            }}
            revenueSummary={metaRevenueMetricSummary}
            campaigns={campaigns}
            toast={toast}
            handleCreateBenchmark={handleCreateBenchmark}
          />

          {/* Report Modal */}
          <MetaReportModal
            isReportModalOpen={isReportModalOpen}
            setIsReportModalOpen={setIsReportModalOpen}
            reportModalStep={reportModalStep}
            setReportModalStep={setReportModalStep}
            editingReportId={editingReport?.id?.toString() || null}
            setEditingReportId={(id: string | null) => { if (!id) setEditingReport(null); }}
            reportForm={reportForm}
            setReportForm={setReportForm}
            reportFormErrors={reportFormErrors}
            setReportFormErrors={setReportFormErrors}
            customReportConfig={customReportConfig}
            setCustomReportConfig={setCustomReportConfig}
            summary={summary}
            kpisData={kpisData}
            benchmarksData={benchmarksData}
            handleReportTypeSelect={handleReportTypeSelect}
            handleCreateReport={handleCreateReport}
            handleUpdateReport={handleUpdateReport}
            handleCustomReport={handleCustomReport}
            createReportMutation={createReportMutation}
            updateReportMutation={updateReportMutation}
            userTimeZone={userTimeZone}
            getTimeZoneDisplay={getTimeZoneDisplay}
          />

          {campaignId && (
            <AddRevenueWizardModal
              open={isRevenueWizardOpen}
              onOpenChange={(open) => {
                setIsRevenueWizardOpen(open);
                if (!open) setRevenueWizardInitialSource(null);
              }}
              campaignId={campaignId}
              currency={(analyticsData as any)?.currency || "USD"}
              dateRange="90days"
              platformContext="meta"
              initialSource={revenueWizardInitialSource || undefined}
              onSuccess={() => {
                void refreshMetaRevenueQueries();
              }}
            />
          )}

          <Dialog open={showRevenueSourcesDialog} onOpenChange={setShowRevenueSourcesDialog}>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Meta Revenue Sources</DialogTitle>
                <DialogDescription className="text-muted-foreground/70">
                  Sources contributing to Meta Total Revenue.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {activeMetaRevenueSources.length > 0 ? activeMetaRevenueSources.map((source: any) => {
                  const cfg = parseRevenueSourceConfig(source);
                  const selectedCount = Array.isArray(cfg?.selectedValues) ? cfg.selectedValues.length : 0;
                  return (
                    <div key={source.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground" title={metaRevenueSourceLabel(source)}>
                          {metaRevenueSourceLabel(source)}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {revenueSourceTypeLabel(source.sourceType)}{selectedCount > 0 ? ` - ${selectedCount} selected attribution value${selectedCount === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-foreground">
                          {fmtCurrency(Number(source.lastTotalRevenue || 0))}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRevenueSourcesDialog(false);
                            openMetaRevenueModal(source);
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
                  <p className="text-sm text-muted-foreground/70">No Meta revenue sources connected.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deletingRevenueSourceId} onOpenChange={(open) => { if (!open) setDeletingRevenueSourceId(null); }}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Remove revenue source?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground/70">
                  This removes only the selected Meta revenue source. Total Revenue will be recalculated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (deletingRevenueSourceId) {
                      deleteMetaRevenueSourceMutation.mutate(deletingRevenueSourceId);
                    }
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
    </div>
  );
}

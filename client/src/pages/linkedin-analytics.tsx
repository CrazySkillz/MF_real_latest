// @ts-nocheck
// NOTE: This page is intentionally being split into smaller components to avoid editor OOM.
// Once the refactor is complete, remove this and restore strict type-checking here.
import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";
import { SalesforceDataViewerModal } from "@/components/SalesforceDataViewerModal";
import { GuidedColumnMapping } from "@/components/GuidedColumnMapping";
import { SalesforceRevenueWizard } from "@/components/SalesforceRevenueWizard";
import { HubSpotRevenueWizard } from "@/components/HubSpotRevenueWizard";
import { ShopifyDataViewerModal } from "@/components/ShopifyDataViewerModal";
import { ShopifyRevenueWizard } from "@/components/ShopifyRevenueWizard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { computeAttainmentFillPct, computeAttainmentPct, computeEffectiveDeltaPct, classifyKpiBand, isLowerIsBetterKpi } from "@shared/kpi-math";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, AlertTriangle, Clock, Plus, Heart, MessageCircle, Share2, Activity, Users, Play, Filter, ArrowUpDown, ChevronRight, Trash2, Pencil, FileText, Settings, Download, Percent, Info, Calculator, Send, RefreshCw, Loader2 } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { LinkedInErrorBoundary, LinkedInTabEmptyState, LinkedInTabErrorState } from "@/components/LinkedInUiStates";
import { LinkedInKpiModal } from "./linkedin-analytics/LinkedInKpiModal";
import { LinkedInBenchmarkModal } from "./linkedin-analytics/LinkedInBenchmarkModal";
import { LinkedInCampaignDetailsModal } from "./linkedin-analytics/LinkedInCampaignDetailsModal";
import { LinkedInReportModal } from "./linkedin-analytics/LinkedInReportModal";

// Helper: Derive category from metric
const getCategoryFromMetric = (metric: string): string => {
  const metricLower = metric.toLowerCase();
  
  // Cost metrics (lower is better)
  if (['cpc', 'cpm', 'cpa', 'cpl'].some(m => metricLower.includes(m))) return 'cost';
  
  // Performance metrics (higher is better)
  if (['ctr', 'cvr', 'er', 'roi', 'roas', 'profitmargin', 'revenueperlead'].some(m => metricLower.includes(m))) return 'performance';
  
  // Revenue metrics (higher is better)
  if (['revenue', 'profit'].some(m => metricLower.includes(m))) return 'revenue';
  
  // Conversion metrics
  if (['conversions', 'leads'].some(m => metricLower.includes(m))) return 'conversion';
  
  // Engagement metrics
  if (['engagements', 'likes', 'comments', 'shares'].some(m => metricLower.includes(m))) return 'engagement';
  
  // Reach metrics
  if (['impressions', 'reach', 'viral'].some(m => metricLower.includes(m))) return 'reach';
  
  return 'performance'; // default
};

// LinkedIn KPI Templates
const LINKEDIN_KPI_TEMPLATES = [
  {
    name: "LinkedIn CTR Target",
    description: "Monitor click-through rate performance",
    targetValue: "2.5",
    unit: "%",
    metric: "CTR"
  },
  {
    name: "LinkedIn CPC Optimization",
    description: "Keep cost per click under target",
    targetValue: "5.00",
    unit: "$",
    metric: "CPC"
  },
  {
    name: "LinkedIn Conversion Rate",
    description: "Track conversion performance",
    targetValue: "3.0",
    unit: "%",
    metric: "Conversion Rate"
  },
  {
    name: "LinkedIn ROAS",
    description: "Return on ad spend target",
    targetValue: "4.0",
    unit: "x",
    metric: "ROAS"
  }
];

function LinkedInAnalyticsCampaign({ campaignId }: { campaignId: string }) {
  const devLog = (...args: any[]) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const validTabs = useMemo(() => new Set(['overview', 'kpis', 'benchmarks', 'ads', 'reports', 'insights']), []);
  const normalizeTab = (t: string | null | undefined) => (t && validTabs.has(t) ? t : 'overview');
  const [activeTab, setActiveTab] = useState<string>(normalizeTab(tabParam));
  const [selectedMetric, setSelectedMetric] = useState<string>('impressions');
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [insightsTrendMode, setInsightsTrendMode] = useState<"daily" | "7d" | "30d">("daily");
  const [insightsTrendMetric, setInsightsTrendMetric] = useState<
    "spend" | "conversions" | "ctr" | "cvr" | "impressions" | "clicks" | "revenue" | "roas"
  >("spend");
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState<Record<string, boolean>>({});
  const [linkedInDailyRefreshedAt, setLinkedInDailyRefreshedAt] = useState<number | null>(null);
  const [linkedInSignalsRefreshedAt, setLinkedInSignalsRefreshedAt] = useState<number | null>(null);
  const [benchmarksRefreshedAt, setBenchmarksRefreshedAt] = useState<number | null>(null);

  // Update active tab when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
      const next = normalizeTab(tab);
      devLog('[Tab Navigation] Setting active tab to:', next);
      setActiveTab(next);
    }
  }, [location]);

  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRevenueWizardOpen, setIsRevenueWizardOpen] = useState(false);
  const [revenueWizardInitialStep, setRevenueWizardInitialStep] = useState<any>("select");
  const [revenueWizardInitialSource, setRevenueWizardInitialSource] = useState<any>(null);
  const [isSalesforceViewerOpen, setIsSalesforceViewerOpen] = useState(false);
  const [salesforceViewerSourceId, setSalesforceViewerSourceId] = useState<string | null>(null);
  const [isHubspotRevenueWizardOpen, setIsHubspotRevenueWizardOpen] = useState(false);
  const [isShopifyViewerOpen, setIsShopifyViewerOpen] = useState(false);
  const [isShopifyRevenueWizardOpen, setIsShopifyRevenueWizardOpen] = useState(false);
  // LinkedIn revenue metrics are unlocked by connecting a revenue/conversion-value source.
  const [revenueModalIntent, setRevenueModalIntent] = useState<'add' | 'edit'>('add');

  // LinkedIn Add revenue uses the standard wizard flow (select source -> Google Sheets -> choose tab -> map columns)
  const openAddRevenueModal = async (intent: 'add' | 'edit' = 'add') => {
    setRevenueModalIntent(intent);
    setRevenueWizardInitialStep("select");
    if (intent === 'edit') {
      // Prefer the already-fetched active source (prevents flashing/mismatches).
      if (activeLinkedInRevenueSource) {
        setRevenueWizardInitialSource(activeLinkedInRevenueSource);
      } else {
        try {
          const resp = await fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=linkedin`);
          const json = await resp.json().catch(() => ({}));
          const sources = Array.isArray(json?.sources) ? json.sources : [];
          const active = sources.find((s: any) => (s as any)?.isActive !== false) || sources[0] || null;
          setRevenueWizardInitialSource(active);
        } catch {
          setRevenueWizardInitialSource(null);
        }
      }
    } else {
      setRevenueWizardInitialSource(null);
    }
    setIsRevenueWizardOpen(true);
  };

  const openRevenueCsvWizard = () => {
    setRevenueWizardInitialSource(null);
    setRevenueWizardInitialStep("csv");
    setIsRevenueWizardOpen(true);
  };

  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'templates' | 'configuration'>('configuration');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const { toast } = useToast();

  const KPI_DESC_MAX = 200;
  const BENCHMARK_DESC_MAX = 200;
  const getDefaultKpiDescription = (metricKey: string) => {
    const k = String(metricKey || '').toLowerCase();
    const labelMap: Record<string, string> = {
      impressions: 'Impressions',
      reach: 'Reach',
      clicks: 'Clicks',
      engagements: 'Engagements',
      spend: 'Spend',
      conversions: 'Conversions',
      leads: 'Leads',
      videoviews: 'Video Views',
      viralimpressions: 'Viral Impressions',
      ctr: 'CTR',
      cpc: 'CPC',
      cpm: 'CPM',
      cvr: 'Conversion Rate',
      cpa: 'CPA',
      cpl: 'CPL',
      er: 'Engagement Rate',
      roi: 'ROI',
      roas: 'ROAS',
      totalrevenue: 'Total Revenue',
      profit: 'Profit',
      profitmargin: 'Profit Margin',
      revenueperlead: 'Revenue Per Lead',
    };
    const label = labelMap[k] || 'this metric';

    if (!k) return 'Track KPI performance against your target over time.';
    if (['cpc', 'cpm', 'cpa', 'cpl'].includes(k)) return `Track ${label} against your target to manage cost efficiency.`;
    if (['ctr', 'cvr', 'er'].includes(k)) return `Track ${label} against your target to monitor engagement and conversion efficiency.`;
    if (['spend'].includes(k)) return `Track ${label} against your target to keep budget efficiency on track.`;
    if (['roi', 'roas', 'profit', 'profitmargin', 'totalrevenue', 'revenueperlead'].includes(k)) return `Track ${label} against your target to validate financial performance.`;
    return `Track ${label} against your target to monitor performance.`;
  };
  const getDefaultBenchmarkDescription = (metricKey: string) => {
    const k = String(metricKey || '').toLowerCase();
    const labelMap: Record<string, string> = {
      impressions: 'Impressions',
      reach: 'Reach',
      clicks: 'Clicks',
      engagements: 'Engagements',
      spend: 'Spend',
      conversions: 'Conversions',
      leads: 'Leads',
      videoviews: 'Video Views',
      viralimpressions: 'Viral Impressions',
      ctr: 'CTR',
      cpc: 'CPC',
      cpm: 'CPM',
      cvr: 'Conversion Rate',
      cpa: 'CPA',
      cpl: 'CPL',
      er: 'Engagement Rate',
      roi: 'ROI',
      roas: 'ROAS',
      totalrevenue: 'Total Revenue',
      profit: 'Profit',
      profitmargin: 'Profit Margin',
      revenueperlead: 'Revenue Per Lead',
    };
    const label = labelMap[k] || 'this metric';

    if (!k) return 'Compare your performance against a benchmark for executive review.';
    if (['cpc', 'cpm', 'cpa', 'cpl'].includes(k)) return `Tracks ${label} against your benchmark to manage cost efficiency.`;
    if (['ctr', 'cvr', 'er'].includes(k)) return `Tracks ${label} against your benchmark to monitor engagement and conversion efficiency.`;
    if (['spend'].includes(k)) return `Tracks ${label} against your benchmark to keep budget efficiency on target.`;
    if (['roi', 'roas', 'profit', 'profitmargin', 'totalrevenue', 'revenueperlead'].includes(k)) return `Tracks ${label} against your benchmark to validate financial performance.`;
    return `Tracks ${label} against your benchmark for executive review.`;
  };

  const DEFAULT_BENCHMARK_DESCRIPTION = getDefaultBenchmarkDescription('');

  // Connected Data Sources tab removed (revenue connections are handled via the "Add revenue" flow).

  // Removed: Connected Data Sources tab + its preview/edit/remove flows.
  
  // KPI Form State
  const [kpiForm, setKpiForm] = useState({
    name: '',
    unit: '',
    description: '',
    metric: '',
    targetValue: '',
    currentValue: '',
    priority: 'high',
    status: 'active',
    category: '',
    timeframe: 'monthly',
    trackingPeriod: '30',
    alertsEnabled: false,
    emailNotifications: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: '',
    applyTo: 'all',
    specificCampaignId: ''
  });

  // Benchmark Form State
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    benchmarkType: 'custom', // 'industry' or 'custom' (default to custom)
    industry: '',
    description: DEFAULT_BENCHMARK_DESCRIPTION,
    applyTo: 'all', // 'all' or 'specific'
    specificCampaignId: '', // ID of specific campaign if applyTo='specific'
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });

  // Fetch industry list for benchmark modal
  const { data: industryData, error: industryError } = useQuery<{ industries: Array<{ value: string; label: string }> }>({
    queryKey: ['/api/industry-benchmarks'],
    staleTime: Infinity,
  });

  // Fallback industry list if API fails
  const fallbackIndustries = [
    { value: 'technology', label: 'Technology' },
    { value: 'saas', label: 'SaaS' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'education', label: 'Education' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'professional-services', label: 'Professional Services' },
    { value: 'retail', label: 'Retail' },
    { value: 'hospitality', label: 'Hospitality & Travel' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'nonprofit', label: 'Non-profit' },
    { value: 'legal', label: 'Legal Services' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'telecommunications', label: 'Telecommunications' },
    { value: 'entertainment', label: 'Entertainment & Media' },
    { value: 'food-beverage', label: 'Food & Beverage' }
  ];

  const industries = industryData?.industries || fallbackIndustries;

  // Log for debugging
  if (industryError) {
    console.error('Failed to fetch industries:', industryError);
  }

  // Hardcoded benchmark values as fallback (matches server/data/industry-benchmarks.ts)
  const getBenchmarkValueFallback = (industry: string, metric: string): { value: number; unit: string } | null => {
    const benchmarks: Record<string, Record<string, { value: number; unit: string }>> = {
      'technology': { impressions: { value: 50000, unit: '' }, clicks: { value: 1000, unit: '' }, spend: { value: 5000, unit: '$' }, conversions: { value: 30, unit: '' }, leads: { value: 50, unit: '' }, engagements: { value: 1500, unit: '' }, ctr: { value: 2.0, unit: '%' }, cpc: { value: 3.5, unit: '$' }, cpm: { value: 30.0, unit: '$' }, cvr: { value: 3.0, unit: '%' }, cpa: { value: 100.0, unit: '$' }, cpl: { value: 80.0, unit: '$' }, er: { value: 2.5, unit: '%' }, roi: { value: 300.0, unit: '%' }, roas: { value: 4.0, unit: 'x' } },
      'saas': { impressions: { value: 55000, unit: '' }, clicks: { value: 1265, unit: '' }, spend: { value: 5200, unit: '$' }, conversions: { value: 44, unit: '' }, leads: { value: 65, unit: '' }, engagements: { value: 1540, unit: '' }, ctr: { value: 2.3, unit: '%' }, cpc: { value: 3.2, unit: '$' }, cpm: { value: 28.0, unit: '$' }, cvr: { value: 3.5, unit: '%' }, cpa: { value: 90.0, unit: '$' }, cpl: { value: 72.0, unit: '$' }, er: { value: 2.8, unit: '%' }, roi: { value: 330.0, unit: '%' }, roas: { value: 4.3, unit: 'x' } },
      'ecommerce': { impressions: { value: 75000, unit: '' }, clicks: { value: 1350, unit: '' }, spend: { value: 4000, unit: '$' }, conversions: { value: 35, unit: '' }, leads: { value: 60, unit: '' }, engagements: { value: 2250, unit: '' }, ctr: { value: 1.8, unit: '%' }, cpc: { value: 2.5, unit: '$' }, cpm: { value: 25.0, unit: '$' }, cvr: { value: 2.5, unit: '%' }, cpa: { value: 80.0, unit: '$' }, cpl: { value: 65.0, unit: '$' }, er: { value: 3.0, unit: '%' }, roi: { value: 350.0, unit: '%' }, roas: { value: 4.5, unit: 'x' } },
      'healthcare': { impressions: { value: 40000, unit: '' }, clicks: { value: 600, unit: '' }, spend: { value: 6000, unit: '$' }, conversions: { value: 12, unit: '' }, leads: { value: 20, unit: '' }, engagements: { value: 800, unit: '' }, ctr: { value: 1.5, unit: '%' }, cpc: { value: 4.0, unit: '$' }, cpm: { value: 35.0, unit: '$' }, cvr: { value: 2.0, unit: '%' }, cpa: { value: 120.0, unit: '$' }, cpl: { value: 100.0, unit: '$' }, er: { value: 2.0, unit: '%' }, roi: { value: 250.0, unit: '%' }, roas: { value: 3.5, unit: 'x' } },
      'finance': { impressions: { value: 35000, unit: '' }, clicks: { value: 420, unit: '' }, spend: { value: 7500, unit: '$' }, conversions: { value: 8, unit: '' }, leads: { value: 15, unit: '' }, engagements: { value: 525, unit: '' }, ctr: { value: 1.2, unit: '%' }, cpc: { value: 5.0, unit: '$' }, cpm: { value: 45.0, unit: '$' }, cvr: { value: 1.8, unit: '%' }, cpa: { value: 150.0, unit: '$' }, cpl: { value: 130.0, unit: '$' }, er: { value: 1.5, unit: '%' }, roi: { value: 200.0, unit: '%' }, roas: { value: 3.0, unit: 'x' } },
      'education': { impressions: { value: 60000, unit: '' }, clicks: { value: 1320, unit: '' }, spend: { value: 4500, unit: '$' }, conversions: { value: 45, unit: '' }, leads: { value: 70, unit: '' }, engagements: { value: 2100, unit: '' }, ctr: { value: 2.2, unit: '%' }, cpc: { value: 3.0, unit: '$' }, cpm: { value: 28.0, unit: '$' }, cvr: { value: 3.5, unit: '%' }, cpa: { value: 85.0, unit: '$' }, cpl: { value: 70.0, unit: '$' }, er: { value: 3.5, unit: '%' }, roi: { value: 320.0, unit: '%' }, roas: { value: 4.2, unit: 'x' } },
      'real-estate': { impressions: { value: 45000, unit: '' }, clicks: { value: 720, unit: '' }, spend: { value: 5500, unit: '$' }, conversions: { value: 16, unit: '' }, leads: { value: 25, unit: '' }, engagements: { value: 990, unit: '' }, ctr: { value: 1.6, unit: '%' }, cpc: { value: 4.5, unit: '$' }, cpm: { value: 38.0, unit: '$' }, cvr: { value: 2.2, unit: '%' }, cpa: { value: 110.0, unit: '$' }, cpl: { value: 95.0, unit: '$' }, er: { value: 2.2, unit: '%' }, roi: { value: 280.0, unit: '%' }, roas: { value: 3.8, unit: 'x' } },
      'professional-services': { impressions: { value: 42000, unit: '' }, clicks: { value: 800, unit: '' }, spend: { value: 4800, unit: '$' }, conversions: { value: 22, unit: '' }, leads: { value: 35, unit: '' }, engagements: { value: 1176, unit: '' }, ctr: { value: 1.9, unit: '%' }, cpc: { value: 3.8, unit: '$' }, cpm: { value: 32.0, unit: '$' }, cvr: { value: 2.8, unit: '%' }, cpa: { value: 95.0, unit: '$' }, cpl: { value: 75.0, unit: '$' }, er: { value: 2.8, unit: '%' }, roi: { value: 310.0, unit: '%' }, roas: { value: 4.1, unit: 'x' } },
      'retail': { impressions: { value: 70000, unit: '' }, clicks: { value: 1470, unit: '' }, spend: { value: 4200, unit: '$' }, conversions: { value: 47, unit: '' }, leads: { value: 75, unit: '' }, engagements: { value: 2240, unit: '' }, ctr: { value: 2.1, unit: '%' }, cpc: { value: 2.8, unit: '$' }, cpm: { value: 26.0, unit: '$' }, cvr: { value: 3.2, unit: '%' }, cpa: { value: 75.0, unit: '$' }, cpl: { value: 60.0, unit: '$' }, er: { value: 3.2, unit: '%' }, roi: { value: 340.0, unit: '%' }, roas: { value: 4.4, unit: 'x' } },
      'hospitality': { impressions: { value: 48000, unit: '' }, clicks: { value: 816, unit: '' }, spend: { value: 4400, unit: '$' }, conversions: { value: 19, unit: '' }, leads: { value: 30, unit: '' }, engagements: { value: 1248, unit: '' }, ctr: { value: 1.7, unit: '%' }, cpc: { value: 3.3, unit: '$' }, cpm: { value: 29.0, unit: '$' }, cvr: { value: 2.3, unit: '%' }, cpa: { value: 88.0, unit: '$' }, cpl: { value: 70.0, unit: '$' }, er: { value: 2.6, unit: '%' }, roi: { value: 290.0, unit: '%' }, roas: { value: 3.9, unit: 'x' } },
      'automotive': { impressions: { value: 38000, unit: '' }, clicks: { value: 532, unit: '' }, spend: { value: 6200, unit: '$' }, conversions: { value: 10, unit: '' }, leads: { value: 18, unit: '' }, engagements: { value: 684, unit: '' }, ctr: { value: 1.4, unit: '%' }, cpc: { value: 4.2, unit: '$' }, cpm: { value: 36.0, unit: '$' }, cvr: { value: 1.9, unit: '%' }, cpa: { value: 125.0, unit: '$' }, cpl: { value: 105.0, unit: '$' }, er: { value: 1.8, unit: '%' }, roi: { value: 240.0, unit: '%' }, roas: { value: 3.4, unit: 'x' } },
      'manufacturing': { impressions: { value: 32000, unit: '' }, clicks: { value: 416, unit: '' }, spend: { value: 6800, unit: '$' }, conversions: { value: 7, unit: '' }, leads: { value: 12, unit: '' }, engagements: { value: 512, unit: '' }, ctr: { value: 1.3, unit: '%' }, cpc: { value: 4.8, unit: '$' }, cpm: { value: 40.0, unit: '$' }, cvr: { value: 1.7, unit: '%' }, cpa: { value: 140.0, unit: '$' }, cpl: { value: 118.0, unit: '$' }, er: { value: 1.6, unit: '%' }, roi: { value: 220.0, unit: '%' }, roas: { value: 3.2, unit: 'x' } },
      'nonprofit': { impressions: { value: 65000, unit: '' }, clicks: { value: 1625, unit: '' }, spend: { value: 3500, unit: '$' }, conversions: { value: 65, unit: '' }, leads: { value: 100, unit: '' }, engagements: { value: 2730, unit: '' }, ctr: { value: 2.5, unit: '%' }, cpc: { value: 2.2, unit: '$' }, cpm: { value: 22.0, unit: '$' }, cvr: { value: 4.0, unit: '%' }, cpa: { value: 55.0, unit: '$' }, cpl: { value: 45.0, unit: '$' }, er: { value: 4.2, unit: '%' }, roi: { value: 380.0, unit: '%' }, roas: { value: 4.8, unit: 'x' } },
      'legal': { impressions: { value: 30000, unit: '' }, clicks: { value: 330, unit: '' }, spend: { value: 8500, unit: '$' }, conversions: { value: 5, unit: '' }, leads: { value: 10, unit: '' }, engagements: { value: 390, unit: '' }, ctr: { value: 1.1, unit: '%' }, cpc: { value: 6.5, unit: '$' }, cpm: { value: 52.0, unit: '$' }, cvr: { value: 1.5, unit: '%' }, cpa: { value: 180.0, unit: '$' }, cpl: { value: 155.0, unit: '$' }, er: { value: 1.3, unit: '%' }, roi: { value: 180.0, unit: '%' }, roas: { value: 2.8, unit: 'x' } },
      'insurance': { impressions: { value: 36000, unit: '' }, clicks: { value: 468, unit: '' }, spend: { value: 7200, unit: '$' }, conversions: { value: 7, unit: '' }, leads: { value: 13, unit: '' }, engagements: { value: 504, unit: '' }, ctr: { value: 1.3, unit: '%' }, cpc: { value: 5.5, unit: '$' }, cpm: { value: 48.0, unit: '$' }, cvr: { value: 1.6, unit: '%' }, cpa: { value: 165.0, unit: '$' }, cpl: { value: 142.0, unit: '$' }, er: { value: 1.4, unit: '%' }, roi: { value: 190.0, unit: '%' }, roas: { value: 2.9, unit: 'x' } },
      'telecommunications': { impressions: { value: 52000, unit: '' }, clicks: { value: 832, unit: '' }, spend: { value: 5400, unit: '$' }, conversions: { value: 17, unit: '' }, leads: { value: 28, unit: '' }, engagements: { value: 1040, unit: '' }, ctr: { value: 1.6, unit: '%' }, cpc: { value: 4.0, unit: '$' }, cpm: { value: 34.0, unit: '$' }, cvr: { value: 2.1, unit: '%' }, cpa: { value: 105.0, unit: '$' }, cpl: { value: 88.0, unit: '$' }, er: { value: 2.0, unit: '%' }, roi: { value: 260.0, unit: '%' }, roas: { value: 3.6, unit: 'x' } },
      'entertainment': { impressions: { value: 80000, unit: '' }, clicks: { value: 1920, unit: '' }, spend: { value: 3800, unit: '$' }, conversions: { value: 73, unit: '' }, leads: { value: 110, unit: '' }, engagements: { value: 3600, unit: '' }, ctr: { value: 2.4, unit: '%' }, cpc: { value: 2.6, unit: '$' }, cpm: { value: 24.0, unit: '$' }, cvr: { value: 3.8, unit: '%' }, cpa: { value: 68.0, unit: '$' }, cpl: { value: 55.0, unit: '$' }, er: { value: 4.5, unit: '%' }, roi: { value: 360.0, unit: '%' }, roas: { value: 4.6, unit: 'x' } },
      'food-beverage': { impressions: { value: 68000, unit: '' }, clicks: { value: 1360, unit: '' }, spend: { value: 4100, unit: '$' }, conversions: { value: 45, unit: '' }, leads: { value: 70, unit: '' }, engagements: { value: 2448, unit: '' }, ctr: { value: 2.0, unit: '%' }, cpc: { value: 2.9, unit: '$' }, cpm: { value: 27.0, unit: '$' }, cvr: { value: 3.3, unit: '%' }, cpa: { value: 78.0, unit: '$' }, cpl: { value: 62.0, unit: '$' }, er: { value: 3.6, unit: '%' }, roi: { value: 350.0, unit: '%' }, roas: { value: 4.5, unit: 'x' } }
    };

    return benchmarks[industry]?.[metric] || null;
  };

  // Report Form State
  const [reportForm, setReportForm] = useState({
    name: '',
    description: '',
    reportType: '',
    configuration: null as any,
    scheduleEnabled: false,
    scheduleFrequency: 'daily',  // Default: Daily (most common for automated reports)
    scheduleDayOfWeek: 'monday',
    scheduleDayOfMonth: 'first',  // Default: 1st (First day of month)
    quarterTiming: 'end',  // Default: End of Quarter (most common for business reports)
    scheduleTime: '9:00 AM',
    emailRecipients: '',
    status: 'draft' as const
  });
  const [reportFormErrors, setReportFormErrors] = useState<{ emailRecipients?: string }>({});

  const validateScheduledReportFields = (): boolean => {
    if (!reportForm.scheduleEnabled) {
      setReportFormErrors({});
      return true;
    }

    const recipients = String(reportForm.emailRecipients || "").trim();
    if (!recipients) {
      setReportFormErrors({ emailRecipients: "Email recipients are required when scheduling is enabled." });
      return false;
    }

    setReportFormErrors({});
    return true;
  };
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  // History + archive features removed for a simpler exec workflow.
  
  // Custom Report Configuration State
  const [customReportConfig, setCustomReportConfig] = useState({
    coreMetrics: [] as string[],
    derivedMetrics: [] as string[],
    kpis: [] as string[],
    benchmarks: [] as string[],
    includeAdComparison: false,
    // If empty, Ad Comparison is excluded from the custom report PDF.
    // Selecting any metrics should auto-enable the section.
    adComparisonMetrics: [] as string[],
    // Controls which Insights sub-sections appear in the PDF.
    // Allowed values: 'executive_financials' | 'trends' | 'what_changed'
    insightsSections: [] as string[],
    includeCampaignBreakdown: false,
    campaignBreakdownCampaigns: [] as string[],
  });

  // Detect user's time zone
  const [userTimeZone, setUserTimeZone] = useState('');
  
  useEffect(() => {
    // Detect time zone from browser
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimeZone(detectedTimeZone);
  }, []);

  // Get formatted time zone display (e.g., "GMT-5" or "PST")
  const getTimeZoneDisplay = () => {
    if (!userTimeZone) return '';
    
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimeZone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(now);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || userTimeZone;
    } catch (e) {
      return userTimeZone;
    }
  };

  // Helper function for ordinal suffixes (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Finance-grade scheduling normalization (server expects canonical values)
  const dayOfWeekKeyToInt = (v: any): number | null => {
    const key = String(v || '').trim().toLowerCase();
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return typeof map[key] === 'number' ? map[key] : null;
  };
  const dayOfWeekIntToKey = (v: any): string => {
    const n = Number(v);
    const map: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return map[n] || 'monday';
  };
  const dayOfMonthToInt = (v: any): number | null => {
    const raw = String(v || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'last') return 0; // 0 = last day of month
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
      // If already HH:MM, keep it
      const m2 = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m2) return `${String(parseInt(m2[1], 10)).padStart(2, '0')}:${m2[2]}`;
      return '09:00';
    }
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = String(m[3] || '').toUpperCase();
    if (ampm === 'AM') {
      if (hh === 12) hh = 0;
    } else {
      if (hh !== 12) hh += 12;
    }
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

  // Fetch connected platforms to determine conversion value source
  const { data: connectedPlatformsData } = useQuery<{ statuses: Array<{ id: string; name: string; connected: boolean; conversionValue?: string | null }> }>({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId,
  });

  // Fetch LinkedIn-scoped revenue sources so the Overview shows the correct provenance (manual vs CSV vs Sheets, etc.)
  const { data: linkedInRevenueSourcesData } = useQuery<{ success: boolean; sources: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "revenue-sources", "linkedin"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=linkedin`);
      if (!resp.ok) return { success: false, sources: [] };
      const json = await resp.json().catch(() => ({}));
      return { success: !!json?.success, sources: Array.isArray(json?.sources) ? json.sources : [] };
    },
  });

  // Optional: HubSpot "pipeline created" proxy (exec daily signal)
  const { data: hubspotPipelineProxyData } = useQuery<any>({
    queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const resp = await fetch(`/api/hubspot/${encodeURIComponent(String(campaignId))}/pipeline-proxy`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!resp.ok) return null;
      return await resp.json().catch(() => null);
    },
  });

  const getLinkedInRevenueSourceLabel = (src: any): string => {
    if (!src) return '';
    const type = String(src?.sourceType || '').toLowerCase();
    const base =
      type === 'manual' ? 'Manual' :
      type === 'csv' ? 'CSV' :
      type === 'google_sheets' ? 'Google Sheets' :
      type === 'hubspot' ? 'HubSpot' :
      type === 'salesforce' ? 'Salesforce' :
      type === 'shopify' ? 'Shopify' :
      type === 'connector_derived' ? 'Imported' :
      'Imported';
    try {
      const cfg = src?.mappingConfig ? (typeof src.mappingConfig === 'string' ? JSON.parse(src.mappingConfig) : src.mappingConfig) : null;
      const vs = String(cfg?.valueSource || '').trim().toLowerCase();
      const mode = String(cfg?.mode || '').trim().toLowerCase();
      const isCv = vs === 'conversion_value' || mode === 'conversion_value';
      const name = String(src?.displayName || '').trim();
      const label = name ? name : base;
      return isCv ? `${label} (Conversion Value)` : label;
    } catch {
      const name = String(src?.displayName || '').trim();
      return name ? name : base;
    }
  };

  const activeLinkedInRevenueSource = (() => {
    const sources = Array.isArray((linkedInRevenueSourcesData as any)?.sources) ? (linkedInRevenueSourcesData as any).sources : [];
    const active = sources.find((s: any) => (s as any)?.isActive !== false) || sources[0];
    return active || null;
  })();
  const linkedInRevenueSourceLabel = getLinkedInRevenueSourceLabel(activeLinkedInRevenueSource);

  // Fetch Google Sheets connections to check if mappings exist
  const { data: googleSheetsConnections, refetch: refetchGoogleSheetsConnections } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"],
    enabled: !!campaignId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    // Refetch every 10 seconds to catch connection deletions from other tabs/pages
    refetchInterval: 10000,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`);
      if (!response.ok) return { connections: [] };
      const data = await response.json();
      return data;
    },
  });

  // Check if any connection has mappings
  const hasMappings = googleSheetsConnections?.connections?.some((conn: any) => {
    if (!conn.columnMappings) return false;
    try {
      const mappings = JSON.parse(conn.columnMappings);
      return Array.isArray(mappings) && mappings.length > 0;
    } catch {
      return false;
    }
  }) || false;

  // Fetch Google Sheets data to check for calculated conversion values
  const { data: sheetsData, refetch: refetchSheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    // Refetch every 10 seconds to catch connection deletions from other tabs/pages
    refetchInterval: 10000,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        // If 404 or other error, return empty structure
        return { calculatedConversionValues: [] };
      }
      const data = await response.json();
      // Ensure calculatedConversionValues exists (even if empty)
      return {
        ...data,
        calculatedConversionValues: data.calculatedConversionValues || []
      };
    },
  });

  // Fetch campaign data
  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch campaign benchmarks
  const { data: benchmarks = [], refetch: refetchBenchmarks } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId],
    enabled: !!campaignId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    cacheTime: 0, // Don't cache at all
    queryFn: async () => {
      const url = `/api/campaigns/${encodeURIComponent(String(campaignId))}/benchmarks/evaluated${
        sessionId ? `?session=${encodeURIComponent(String(sessionId))}` : ""
      }`;
      const resp = await fetch(url);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) return [];
      return Array.isArray(json?.benchmarks) ? json.benchmarks : [];
    },
  });
  // Helper function to get benchmark for a metric
  const getBenchmarkForMetric = (metricName: string) => {
    devLog('[getBenchmarkForMetric] Looking for benchmark:', metricName);
    devLog('[getBenchmarkForMetric] Available benchmarks:', benchmarks);
    devLog('[getBenchmarkForMetric] Type:', typeof benchmarks);
    devLog('[getBenchmarkForMetric] Is array?', Array.isArray(benchmarks));
    devLog('[getBenchmarkForMetric] Length:', benchmarks?.length);
    
    // CRITICAL: Check if benchmarks exists and is an array first to prevent undefined errors
    if (!benchmarks || !Array.isArray(benchmarks) || benchmarks.length === 0) {
      devLog('[getBenchmarkForMetric] Benchmarks is not valid, returning null');
      return null;
    }
    
    // STRICT MATCHING: Only match by metric field, NOT by name
    // This prevents wrong benchmarks from being used
    const found = benchmarks.find((b: any) => {
      const metricMatch = b.metric?.toLowerCase() === metricName.toLowerCase();
      devLog(`Checking benchmark: metric="${b.metric}", name="${b.name}", metricMatch=${metricMatch}`);
      return metricMatch; // Only return if metric field matches exactly
    });
    
    devLog('Found benchmark:', found);
    return found;
  };

  // Helper function to calculate performance level based on benchmark
  const getPerformanceLevel = (currentValue: number, benchmarkValue: number, metricType: 'higher-better' | 'lower-better' = 'higher-better'): 'excellent' | 'good' | 'fair' | 'poor' => {
    devLog(`getPerformanceLevel: current=${currentValue}, benchmark=${benchmarkValue}, type=${metricType}`);
    
    if (!benchmarkValue || benchmarkValue === 0) {
      devLog('No benchmark value, returning fair');
      return 'fair';
    }
    
    const ratio = currentValue / benchmarkValue;
    devLog(`Ratio: ${ratio} (${currentValue} / ${benchmarkValue})`);
    
    let result: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (metricType === 'higher-better') {
      // For metrics where higher is better (CTR, CVR, ER, ROI, ROAS)
      if (ratio >= 1.2) result = 'excellent';
      else if (ratio >= 1.0) result = 'good';
      else if (ratio >= 0.8) result = 'fair';
      else result = 'poor';
      devLog(`Higher-better logic: ratio ${ratio} >= 1.2? ${ratio >= 1.2}, >= 1.0? ${ratio >= 1.0}, >= 0.8? ${ratio >= 0.8} → ${result}`);
    } else {
      // For metrics where lower is better (CPC, CPM, CPA, CPL)
      if (ratio <= 0.8) result = 'excellent';
      else if (ratio <= 1.0) result = 'good';
      else if (ratio <= 1.2) result = 'fair';
      else result = 'poor';
      devLog(`Lower-better logic: ratio ${ratio} <= 0.8? ${ratio <= 0.8}, <= 1.0? ${ratio <= 1.0}, <= 1.2? ${ratio <= 1.2} → ${result}`);
    }
    
    return result;
  };

  // Helper function to render performance badge - DISABLED FOR SIMPLIFICATION
  const renderPerformanceBadge = (metricName: string, currentValue: number | undefined, metricType: 'higher-better' | 'lower-better' = 'higher-better') => {
    // Badges removed for platform simplification
    return null;
  };

  // Fetch import session data
  const { data: sessionData, isLoading: sessionLoading, isError: sessionIsError, error: sessionError, refetch: refetchSessionData } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId],
    enabled: !!sessionId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0, // Always fetch fresh data to pick up conversion value changes
    // Refetch every 5 seconds to catch Google Sheets deletions quickly
    refetchInterval: 5000,
    // Force refetch to ensure we get the latest data after Google Sheets deletions
    gcTime: 0, // Don't cache - always fetch fresh
    // Add cache busting timestamp to force fresh fetch
    queryFn: async () => {
      const response = await fetch(`/api/linkedin/imports/${sessionId}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch session data');
      const data = await response.json();
      devLog('[LinkedIn Analytics] Session data fetched:', {
        hasRevenueTracking: data?.aggregated?.hasRevenueTracking,
        conversionValue: data?.aggregated?.conversionValue
      });
      return data;
    },
  });

  // Enterprise-grade correctness: keep KPI + Benchmarks in lockstep with Overview.
  // When the Overview aggregate changes (e.g., new import session data, revenue source changes),
  // refetch KPIs (server will refresh currentValue) and Benchmarks so all tabs display consistent "current" values.
  const overviewSyncKey = useMemo(() => {
    const a: any = (sessionData as any)?.aggregated || {};
    return [
      String(sessionId || ''),
      String(campaignId || ''),
      String(a?.hasRevenueTracking ?? ''),
      String(a?.conversionValue ?? ''),
      String(a?.totalRevenue ?? a?.revenue ?? ''),
      String(a?.totalSpend ?? ''),
      String(a?.totalConversions ?? ''),
      String(a?.totalClicks ?? ''),
      String(a?.totalImpressions ?? ''),
    ].join('|');
  }, [sessionData, sessionId, campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    // Always refetch KPIs/Benchmarks in the background; this is cheap and avoids exec-facing staleness.
    void queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
    void queryClient.refetchQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId], exact: true });
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId] });
    void queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId], exact: true });
  }, [overviewSyncKey, campaignId]);

  // Extract session payload early (used by helpers/hooks below).
  // Important: this must appear before any useMemo/helpers that reference `aggregated`
  // to avoid temporal-dead-zone runtime crashes ("Cannot access ... before initialization").
  const session = (sessionData as any)?.session;
  const metrics = (sessionData as any)?.metrics;
  const aggregated = (sessionData as any)?.aggregated;

  // Fetch ad performance data
  const { data: adsData, isLoading: adsLoading, isError: adsIsError, error: adsError, refetch: refetchAds } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId, 'ads'],
    enabled: !!sessionId,
  });

  // LinkedIn daily facts (persisted) for Insights anomaly/delta detection
  // UI lookback only affects how many rows we request, not how many exist.
  // Keep it small to match the incremental "days go by" test-mode journey.
  // Request up to 60 complete days so 30d comparisons can unlock after enough simulated runs.
  // This does NOT create data; it only controls how much history we fetch when it exists.
  const LINKEDIN_DAILY_LOOKBACK_DAYS = 60;
  const { data: linkedInCoverageResp, isLoading: linkedInCoverageLoading, isError: linkedInCoverageIsError, error: linkedInCoverageError, refetch: refetchLinkedInCoverage } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "linkedin-coverage", LINKEDIN_DAILY_LOOKBACK_DAYS],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${encodeURIComponent(String(campaignId))}/linkedin/coverage?days=${encodeURIComponent(String(LINKEDIN_DAILY_LOOKBACK_DAYS))}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return { success: false };
      return json;
    },
  });
  const { data: linkedInDailyResp, isLoading: linkedInDailyLoading, refetch: refetchLinkedInDaily } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "linkedin-daily", LINKEDIN_DAILY_LOOKBACK_DAYS],
    enabled: activeTab === "insights" && !!campaignId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    onSuccess: () => setLinkedInDailyRefreshedAt(Date.now()),
    queryFn: async () => {
      const resp = await fetch(
        `/api/campaigns/${encodeURIComponent(String(campaignId))}/linkedin-daily?days=${encodeURIComponent(String(LINKEDIN_DAILY_LOOKBACK_DAYS))}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return { success: false, data: [] };
      return json;
    },
  });

  // Server-side Insights signals (single source of truth for exec-facing guidance)
  const { data: linkedInInsightsResp, isLoading: linkedInInsightsLoading, refetch: refetchLinkedInSignals } = useQuery<any>({
    queryKey: ["/api/linkedin/insights", sessionId, LINKEDIN_DAILY_LOOKBACK_DAYS],
    enabled: activeTab === "insights" && !!sessionId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    onSuccess: () => setLinkedInSignalsRefreshedAt(Date.now()),
    queryFn: async () => {
      const resp = await fetch(
        `/api/linkedin/insights/${encodeURIComponent(String(sessionId))}?days=${encodeURIComponent(String(LINKEDIN_DAILY_LOOKBACK_DAYS))}`
      );
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) return { success: false, signals: [], availableDays: 0 };
      return json;
    },
  });

  // Extract unique campaigns from sessionData.metrics (each metric is separate entry)
  const availableCampaigns = useMemo(() => {
    const { metrics: rawMetrics } = (sessionData as any) || {};
    if (!rawMetrics || !Array.isArray(rawMetrics)) return [];
    
    const campaignMap = new Map();
    rawMetrics.forEach((m: any) => {
      if (m.campaignName && !campaignMap.has(m.campaignName)) {
        campaignMap.set(m.campaignName, {
          name: m.campaignName,
          linkedInCampaignName: m.campaignName,
          id: campaignId
        });
      }
    });
    
    return Array.from(campaignMap.values());
  }, [sessionData, campaignId]);

  // Helper to get campaign name from ID
  const getCampaignName = (campaignId: string): string => {
    const campaign = availableCampaigns.find(c => c.id === campaignId);
    return campaign?.name || campaignId;
  };

  // Helper to get campaign-specific metrics.
  // IMPORTANT: For consistency (exec-grade accuracy), prefer `sessionData.metrics` (the same source used by the Overview
  // campaign breakdown) and only fall back to `adsData` when needed.
  const getCampaignSpecificMetrics = (linkedInCampaignName: string) => {
    // 1) Prefer session campaign metrics (matches Overview tab math exactly)
    if (Array.isArray(metrics) && metrics.length > 0) {
      const campaignRows = (metrics as any[]).filter((m: any) => m?.campaignName === linkedInCampaignName);
      if (campaignRows.length > 0) {
        // Build a totals object from the metricKey/value pairs
        const baseTotals = campaignRows.reduce((acc: any, row: any) => {
          const key = String(row?.metricKey || '').trim();
          const value = Number(parseFloat(String(row?.metricValue ?? '0')));
          if (!key) return acc;
          // Many keys are unique per campaign; sum defensively.
          acc[key] = Number(acc[key] || 0) + (Number.isFinite(value) ? value : 0);
          return acc;
        }, {});

        // Normalize expected keys (case variations)
        const impressions = Number(baseTotals.impressions || 0);
        const clicks = Number(baseTotals.clicks || 0);
        const spend = Number(baseTotals.spend || 0);
        const conversions = Number(baseTotals.conversions || 0);
        const leads = Number(baseTotals.leads || 0);
        const engagements = Number(baseTotals.engagements || 0);
        const reach = Number(baseTotals.reach || 0);
        const videoViews = Number(baseTotals.videoViews || baseTotals.videoviews || 0);
        const viralImpressions = Number(baseTotals.viralImpressions || baseTotals.viralimpressions || 0);

        // Derived metrics
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
        const cpa = conversions > 0 ? spend / conversions : 0;
        const cpl = leads > 0 ? spend / leads : 0;
        const er = impressions > 0 ? (engagements / impressions) * 100 : 0;

        // Revenue-derived metrics (only when revenue tracking is enabled for LinkedIn)
        const hasRevenueTracking = !!aggregated?.hasRevenueTracking;
        const conversionValue = Number(aggregated?.conversionValue || 0);
        const totalRevenue = hasRevenueTracking && conversionValue > 0 ? conversions * conversionValue : 0;
        const profit = totalRevenue - spend;
        const roi = spend > 0 ? (profit / spend) * 100 : 0; // percent
        const roas = spend > 0 ? totalRevenue / spend : 0; // x
        const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0; // percent
        const revenuePerLead = leads > 0 ? totalRevenue / leads : 0;

        return {
          // Keep both the original baseTotals (for any niche keys) and normalized common ones
          ...baseTotals,

          impressions,
          clicks,
          spend,
          conversions,
          leads,
          engagements,
          reach,
          videoViews,
          viralImpressions,

          ctr,
          cpc,
          cpm,
          cvr,
          cpa,
          cpl,
          er,

          totalRevenue,
          profit,
          roi,
          roas,
          profitMargin,
          revenuePerLead,
        };
      }
    }

    // 2) Fallback to ad-level aggregation (used by Ad Comparison)
    if (!adsData || !Array.isArray(adsData)) return null;

    const campaignAds = adsData.filter((ad: any) => ad.campaignName === linkedInCampaignName);
    if (campaignAds.length === 0) return null;

    const totals = campaignAds.reduce((acc: any, ad: any) => ({
      impressions: (acc.impressions || 0) + (ad.impressions || 0),
      clicks: (acc.clicks || 0) + (ad.clicks || 0),
      spend: (acc.spend || 0) + parseFloat(ad.spend || 0),
      conversions: (acc.conversions || 0) + (ad.conversions || 0),
      leads: (acc.leads || 0) + (ad.leads || 0),
      engagements: (acc.engagements || 0) + (ad.engagements || 0),
      reach: (acc.reach || 0) + (ad.reach || 0),
      videoViews: (acc.videoViews || 0) + (ad.videoViews || 0),
      viralImpressions: (acc.viralImpressions || 0) + (ad.viralImpressions || 0),
    }), {});
    
    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const cvr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
    const er = totals.impressions > 0 ? (totals.engagements / totals.impressions) * 100 : 0;

    // Revenue-derived metrics (only when revenue tracking is enabled for LinkedIn)
    const hasRevenueTracking = !!aggregated?.hasRevenueTracking;
    const conversionValue = Number(aggregated?.conversionValue || 0);
    const totalRevenue = hasRevenueTracking && conversionValue > 0 ? totals.conversions * conversionValue : 0;
    const profit = totalRevenue - totals.spend;
    const roi = totals.spend > 0 ? (profit / totals.spend) * 100 : 0; // percent
    const roas = totals.spend > 0 ? totalRevenue / totals.spend : 0; // x
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0; // percent
    const revenuePerLead = totals.leads > 0 ? totalRevenue / totals.leads : 0;

    return {
      ...totals,
      ctr,
      cpc,
      cpm,
      cvr,
      cpa,
      cpl,
      er,

      // keep naming consistent with other UI paths
      totalRevenue,
      profit,
      roi,
      roas,
      profitMargin,
      revenuePerLead,
    };
  };

  // Fetch LinkedIn reports filtered by campaignId
  const { data: reportsData, isLoading: reportsLoading, isError: reportsIsError, error: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ['/api/platforms/linkedin/reports', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/reports?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/linkedin/kpis', kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      toast({
        title: "KPI Created",
        description: "Your LinkedIn KPI has been created successfully.",
      });
      setIsKPIModalOpen(false);
      setModalStep('configuration');
      setKpiForm({
        name: '',
        unit: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        priority: 'high',
        status: 'active',
        category: '',
        timeframe: 'monthly',
        trackingPeriod: '30',
        alertsEnabled: false,
        emailNotifications: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: '',
        applyTo: 'all',
        specificCampaignId: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create KPI",
        variant: "destructive",
      });
    }
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/linkedin/kpis/${kpiId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      // If KPI had generated alerts/reminders, remove them from bell + Notifications center immediately.
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.refetchQueries({ queryKey: ['/api/notifications'], exact: true });
      toast({
        title: "KPI Deleted",
        description: "The KPI has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete KPI",
        variant: "destructive",
      });
    }
  });

  // Update KPI mutation
  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, kpiData }: { id: string, kpiData: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/linkedin/kpis/${id}`, kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      toast({
        title: "KPI Updated",
        description: "Your LinkedIn KPI has been updated successfully.",
      });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      setKpiForm({
        name: '',
        unit: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        priority: 'high',
        status: 'active',
        category: '',
        timeframe: 'monthly',
        trackingPeriod: '30',
        emailNotifications: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: '',
        applyTo: 'all',
        specificCampaignId: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update KPI",
        variant: "destructive",
      });
    }
  });

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setKpiForm({
      name: template.name,
      unit: template.unit,
      description: template.description,
      metric: '',
      targetValue: formatNumberAsYouType(String(template.targetValue || ''), { maxDecimals: getMaxDecimalsForMetric(template.metric || '') }),
      currentValue: '',
      priority: 'high',
      status: 'active',
      category: '',
      timeframe: 'monthly',
      trackingPeriod: '30',
      alertsEnabled: false,
      emailNotifications: false,
      alertFrequency: 'daily',
      alertThreshold: '',
      alertCondition: 'below',
      emailRecipients: ''
    });
    setModalStep('configuration');
  };

  // Handle back to templates
  const handleBackToTemplates = () => {
    setModalStep('templates');
    setSelectedTemplate(null);
  };

  // Handle create KPI
  const handleCreateKPI = () => {
    if (kpiForm.alertsEnabled) {
      const threshold = String(kpiForm.alertThreshold || '').trim();
      if (!threshold) {
        toast({ title: "Alert Threshold required", description: "Enter an alert threshold to enable alerts.", variant: "destructive" });
        return;
      }
      if (kpiForm.emailNotifications) {
        const recipients = String(kpiForm.emailRecipients || '').trim();
        if (!recipients) {
          toast({ title: "Email recipients required", description: "Enter at least one email address to enable email notifications.", variant: "destructive" });
          return;
        }
      }
    }
    const kpiData = {
      // platformType is extracted from URL by backend, don't send it
      campaignId: campaignId, // Include campaignId for data isolation
      name: kpiForm.name,
      metric: kpiForm.metric, // Include metric field
      targetValue: stripNumeric(kpiForm.targetValue || ''),
      currentValue: stripNumeric(kpiForm.currentValue || '0'),
      unit: kpiForm.unit,
      description: kpiForm.description,
      priority: kpiForm.priority,
      timeframe: kpiForm.timeframe,
      trackingPeriod: parseInt(kpiForm.trackingPeriod),
      status: 'active',
      rollingAverage: '7day',
      alertsEnabled: kpiForm.alertsEnabled || false, // Use form value instead of hardcoded true
      emailNotifications: !!kpiForm.emailNotifications,
      slackNotifications: false,
      alertFrequency: kpiForm.alertFrequency || 'daily',
      alertThreshold: (kpiForm.alertsEnabled ? (stripNumeric(kpiForm.alertThreshold || '') || null) : null), // Include alert threshold (clean numeric)
      alertCondition: kpiForm.alertCondition || 'below', // Include alert condition
      emailRecipients: kpiForm.emailNotifications ? (String(kpiForm.emailRecipients || '').trim() || null) : null,
      applyTo: kpiForm.applyTo,
      specificCampaignId: kpiForm.applyTo === 'specific' ? kpiForm.specificCampaignId : null
    };
    
    if (editingKPI) {
      updateKpiMutation.mutate({ id: editingKPI.id, kpiData });
    } else {
      createKpiMutation.mutate(kpiData);
    }
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      devLog('Creating benchmark with data:', benchmarkData);
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/benchmarks`, benchmarkData);
      return res.json();
    },
    onSuccess: async (createdBenchmark) => {
      devLog('Benchmark created successfully:', createdBenchmark);
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId] });
      
      // Force immediate refetch for both Overview and Benchmarks tab
      await refetchBenchmarks();
      await refetchBenchmarksTab();
      
      toast({
        title: "Benchmark Created",
        description: "Your LinkedIn benchmark has been created successfully. The performance badge will now appear in the Overview tab.",
      });
      setIsBenchmarkModalOpen(false);
      setBenchmarkForm({
        metric: '',
        name: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        benchmarkType: 'custom',
        industry: '',
        description: DEFAULT_BENCHMARK_DESCRIPTION,
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
        emailNotifications: false,
        alertFrequency: 'daily',
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create benchmark",
        variant: "destructive",
      });
    }
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      devLog('Updating benchmark:', id, 'with data:', data);
      const res = await apiRequest('PATCH', `/api/campaigns/${campaignId}/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: async (updatedBenchmark) => {
      devLog('Benchmark updated successfully:', updatedBenchmark);
      devLog('Invalidating queries to refresh UI...');
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId] });
      
      // Force immediate refetch for both Overview and Benchmarks tab
      await refetchBenchmarks();
      await refetchBenchmarksTab();
      
      devLog('Queries invalidated, UI should update now');
      
      toast({
        title: "Benchmark Updated",
        description: "Your LinkedIn benchmark has been updated successfully. The performance badge in the Overview tab will reflect the new values.",
      });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        benchmarkType: 'custom',
        industry: '',
        description: DEFAULT_BENCHMARK_DESCRIPTION,
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
        emailNotifications: false,
        alertFrequency: 'daily',
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      console.error('Failed to update benchmark:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update benchmark",
        variant: "destructive",
      });
    }
  });

  // Delete Benchmark mutation
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkId: string) => {
      devLog('Deleting benchmark:', benchmarkId);
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}/benchmarks/${benchmarkId}`);
      return res.json();
    },
    onSuccess: async () => {
      devLog('Benchmark deleted successfully');
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId] });
      
      // Force immediate refetch for both Overview and Benchmarks tab
      await refetchBenchmarks();
      await refetchBenchmarksTab();

      // If Benchmark had generated alerts, remove them from bell + Notifications center immediately.
      await queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      await queryClient.refetchQueries({ queryKey: ['/api/notifications'], exact: true });
      
      // Clear editing state and reset form
      setEditingBenchmark(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        benchmarkType: 'custom',
        industry: '',
        description: DEFAULT_BENCHMARK_DESCRIPTION,
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
      
      devLog('Benchmark queries refetched, badge should disappear now');
      
      toast({
        title: "Benchmark Deleted",
        description: "The benchmark has been deleted successfully. The performance badge has been removed from the Overview tab.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete benchmark",
        variant: "destructive",
      });
    }
  });

  // LinkedIn revenue source removal (clears conversion value mappings so ROI/ROAS/etc recompute immediately)
  const deleteLinkedInRevenueSourceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}/linkedin/revenue-source`);
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Revenue source removed",
        description: "Revenue tracking has been disabled. ROI/ROAS and other revenue metrics will update immediately.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/linkedin/metrics", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'] });
      await queryClient.invalidateQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"] });
      // KPI tab: clear/recompute revenue-dependent KPIs (ROI/ROAS/etc)
      await queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      // Force immediate recompute for the active page (no waiting for intervals)
      await queryClient.refetchQueries({ queryKey: ["/api/linkedin/metrics", campaignId], exact: true });
      await queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId], exact: true });
      await queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'], exact: true });
      await queryClient.refetchQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: true });
      await queryClient.refetchQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId], exact: true });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove revenue source",
        variant: "destructive",
      });
    },
  });

  // Handle create Benchmark
  const handleCreateBenchmark = () => {
    if (benchmarkForm.alertsEnabled) {
      const threshold = String(benchmarkForm.alertThreshold || '').trim();
      if (!threshold) {
        toast({ title: "Alert Threshold required", description: "Enter an alert threshold to enable alerts.", variant: "destructive" });
        return;
      }
      if (benchmarkForm.emailNotifications) {
        const recipients = String(benchmarkForm.emailRecipients || '').trim();
        if (!recipients) {
          toast({ title: "Email recipients required", description: "Enter at least one email address to enable email notifications.", variant: "destructive" });
          return;
        }
      }
    }
    // For campaign-specific benchmarks, convert LinkedIn campaign name to database campaign ID
    let finalSpecificCampaignId = null;
    if (benchmarkForm.applyTo === 'specific') {
      // If a LinkedIn campaign name was selected, use the parent database campaign ID
      finalSpecificCampaignId = campaignId; // Always use the current database campaign ID
      devLog('[Create] Campaign-specific benchmark:', {
        selectedLinkedInCampaign: benchmarkForm.specificCampaignId,
        savingDatabaseCampaignId: finalSpecificCampaignId
      });
    }
    
    // Check for duplicate metric benchmark
    const existingBenchmarks = (benchmarksData as any[]) || [];
    const existingBenchmark = existingBenchmarks.find((b: any) => {
      const metricMatch = b.metric?.toLowerCase() === benchmarkForm.metric?.toLowerCase();
      // IMPORTANT: Uniqueness for "specific campaign" benchmarks must be scoped by LinkedIn campaign name,
      // not the DB campaignId (which is the same for all LinkedIn campaigns under this parent campaign).
      const scopeMatch = benchmarkForm.applyTo === 'specific'
        ? String(b.linkedInCampaignName || '') === String(benchmarkForm.specificCampaignId || '')
        : (!b.linkedInCampaignName && (b.applyTo === 'all' || !b.specificCampaignId));
      
      devLog('Checking duplicate:', {
        benchmark: b,
        metricMatch,
        scopeMatch,
        formMetric: benchmarkForm.metric,
        formApplyTo: benchmarkForm.applyTo,
        formCampaignId: finalSpecificCampaignId
      });
      
      return metricMatch && scopeMatch;
    });
    
    if (existingBenchmark && !editingBenchmark) {
      const scopeText = benchmarkForm.applyTo === 'specific' 
        ? `for this campaign`
        : 'for All Campaigns';
      toast({
        title: "Duplicate Benchmark",
        description: `A benchmark for ${benchmarkForm.metric.toUpperCase()} ${scopeText} already exists. Please edit the existing benchmark or delete it first.`,
        variant: "destructive",
      });
      return;
    }
    
    const derivedCategory = getCategoryFromMetric(benchmarkForm.metric);
    const benchmarkData = {
      campaignId: campaignId,
      name: benchmarkForm.name,
      metric: benchmarkForm.metric, // ← CRITICAL: Include metric field!
      category: derivedCategory,
      // Ensure benchmark currency always matches the campaign currency (no stale "$" values).
      unit: isCurrencyLikeMetric(benchmarkForm.metric) ? campaignCurrencySymbol : benchmarkForm.unit,
      benchmarkValue: stripNumeric(benchmarkForm.benchmarkValue || ''),
      currentValue: stripNumeric(benchmarkForm.currentValue || '0'),
      industry: benchmarkForm.industry,
      description: (String(benchmarkForm.description || '').trim() || DEFAULT_BENCHMARK_DESCRIPTION),
      // Persist benchmarkType so edit mode round-trips correctly (DB default is 'industry')
      benchmarkType: benchmarkForm.benchmarkType === 'industry' ? 'industry' : 'custom',
      applyTo: benchmarkForm.applyTo, // 'all' or 'specific'
      specificCampaignId: finalSpecificCampaignId, // Use the converted campaign ID
      linkedInCampaignName: benchmarkForm.applyTo === 'specific' ? benchmarkForm.specificCampaignId : null, // Store LinkedIn campaign name for display
      alertsEnabled: benchmarkForm.alertsEnabled,
      alertThreshold: benchmarkForm.alertsEnabled ? (stripNumeric(benchmarkForm.alertThreshold || '') || null) : null,
      alertCondition: benchmarkForm.alertCondition,
      emailNotifications: !!benchmarkForm.emailNotifications,
      alertFrequency: benchmarkForm.alertFrequency || 'daily',
      emailRecipients: benchmarkForm.emailNotifications ? (String(benchmarkForm.emailRecipients || '').trim() || null) : null,
      status: 'active',
      platformType: 'linkedin' // Specify platform
    };
    
    devLog('Creating benchmark with data:', benchmarkData);
    
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: benchmarkData });
    } else {
      createBenchmarkMutation.mutate(benchmarkData);
    }
  };

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      // Canonical reports API: platform-scoped routes
      const res = await apiRequest('POST', '/api/platforms/linkedin/reports', reportData);
      return { data: await res.json(), reportData };
    },
    onSuccess: ({ data, reportData }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      
      // Debug logging
      devLog('[Report Creation] scheduleEnabled:', reportData.scheduleEnabled);
      devLog('[Report Creation] scheduleRecipients:', reportData.scheduleRecipients);
      devLog('[Report Creation] scheduleFrequency:', reportData.scheduleFrequency);
      
      // Check if scheduling is enabled
      if (reportData.scheduleEnabled && reportData.scheduleRecipients && reportData.scheduleRecipients.length > 0) {
        const recipientCount = reportData.scheduleRecipients.length;
        const recipientText = recipientCount === 1 
          ? reportData.scheduleRecipients[0] 
          : `${recipientCount} recipients`;
        
        toast({
          title: "Report Created & Scheduled",
          description: `Your report has been created successfully. Automated emails will be sent to ${recipientText} based on your schedule (${reportData.scheduleFrequency}).`,
        });
      } else {
        toast({
          title: "Report Created",
          description: "Your LinkedIn report has been created successfully.",
        });
      }
      
      setIsReportModalOpen(false);
      setReportModalStep('standard');
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'daily',
        scheduleDayOfWeek: 'monday',
        scheduleDayOfMonth: 'first',
        quarterTiming: 'end',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create report",
        variant: "destructive",
      });
    }
  });

  // Delete Report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/linkedin/reports/${reportId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Deleted",
        description: "The report has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    }
  });

  const runLinkedInRefreshMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("Missing campaign id");
      const resp = await apiRequest(
        "POST",
        `/api/campaigns/${encodeURIComponent(String(campaignId))}/linkedin/refresh`,
        {}
      );
      const json = await (resp as any).json?.().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || "Failed to refresh LinkedIn data");
      }
      return json;
    },
    onSuccess: async () => {
      toast({
        title: "Refresh complete",
        description: "LinkedIn metrics have been updated.",
      });

      // Refresh may create new notifications (test-mode) and/or KPI alerts. Ensure the bell updates immediately.
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });
      } catch {
        // ignore
      }

      // Ensure UI refetches freshness + to-date totals immediately (covers Overview + Ad Comparison).
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "linkedin-coverage", LINKEDIN_DAILY_LOOKBACK_DAYS] });
        await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "linkedin-coverage", LINKEDIN_DAILY_LOOKBACK_DAYS], exact: true });
      } catch {
        // ignore
      }

      // Refresh creates a NEW import session; jump to the latest session so Overview updates immediately.
      try {
        const resp = await fetch(`/api/campaigns/${encodeURIComponent(String(campaignId))}/connected-platforms`, {
          headers: { "Cache-Control": "no-cache" },
        });
        const json = await resp.json().catch(() => ({} as any));
        const statuses = Array.isArray(json?.statuses) ? json.statuses : [];
        const linkedin = statuses.find((s: any) => String(s?.id || "") === "linkedin");
        const analyticsPath = String(linkedin?.analyticsPath || "").trim();

        if (analyticsPath) {
          const joiner = analyticsPath.includes("?") ? "&" : "?";
          setLocation(`${analyticsPath}${joiner}tab=overview`);
          return;
        }
      } catch {
        // ignore (fallback below)
      }

      // Fallback: refetch current data (may still be the old session if URL isn't updated).
      try {
        await queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
        await queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'] });
        await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "linkedin-coverage", LINKEDIN_DAILY_LOOKBACK_DAYS] });
        await queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId], exact: true });
        await queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'], exact: true });
      } catch {
        // ignore
      }
    },
    onError: (e: any) => {
      toast({
        title: "Refresh failed",
        description: e?.message || "Could not refresh LinkedIn data.",
        variant: "destructive",
      });
    },
  });

  // Update Report mutation
  // Update Report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, reportData }: { reportId: string, reportData: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/linkedin/reports/${reportId}`, reportData);
      return { data: await res.json(), reportData };
    },
    onSuccess: ({ data, reportData }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      
      // Check if scheduling is enabled
      if (reportData.scheduleEnabled && reportData.scheduleRecipients && reportData.scheduleRecipients.length > 0) {
        const recipientCount = reportData.scheduleRecipients.length;
        const recipientText = recipientCount === 1 
          ? reportData.scheduleRecipients[0] 
          : `${recipientCount} recipients`;
        
        toast({
          title: "Report Updated & Scheduled",
          description: `Your report has been updated successfully. Automated emails will be sent to ${recipientText} based on your schedule (${reportData.scheduleFrequency}).`,
        });
      } else {
        toast({
          title: "Report Updated",
          description: "Your report has been updated successfully.",
        });
      }
      
      setIsReportModalOpen(false);
      setEditingReportId(null);
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'daily',
        scheduleDayOfWeek: 'monday',
        scheduleDayOfMonth: 'first',
        quarterTiming: 'end',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
      setCustomReportConfig({
        coreMetrics: [],
        derivedMetrics: [],
        kpis: [],
        benchmarks: [],
        includeAdComparison: false,
        adComparisonMetrics: [],
        insightsSections: [],
        includeCampaignBreakdown: false,
        campaignBreakdownCampaigns: [],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update report",
        variant: "destructive",
      });
    }
  });

  // Handle report type selection
  const handleReportTypeSelect = (type: string) => {
    const reportNames = {
      'overview': 'Overview Report',
      'kpis': 'KPIs Report',
      'benchmarks': 'Benchmarks Report',
      'ads': 'Ad Comparison Report',
      'insights': 'Insights Report',
      'custom': 'Custom Report'
    };
    
    setReportForm({
      ...reportForm,
      reportType: type,
      name: reportNames[type as keyof typeof reportNames] || 'Report',
      configuration: {}
    });
    // Keep reportModalStep as 'standard' for single-page design
  };

  // Handle edit report
  const handleEditReport = (report: any) => {
    setEditingReportId(report.id);
    
    // Extract email recipients from array to string
    const emailRecipientsString = report.scheduleRecipients && Array.isArray(report.scheduleRecipients)
      ? report.scheduleRecipients.join(', ')
      : '';
    
    // Check if scheduling is enabled (canonical field)
    const scheduleEnabled = !!report.scheduleEnabled;
    
    // Determine the modal step based on report type FIRST
    const modalStep = report.reportType === 'custom' ? 'custom' : 'standard';
    setReportModalStep(modalStep);
    
    // Parse configuration if it's a string
    const config = typeof report.configuration === 'string' 
      ? JSON.parse(report.configuration) 
      : report.configuration || {};
    
    // Set report form with existing values
    const formData = {
      name: report.name || '',
      description: report.description || '',
      reportType: report.reportType || '',
      configuration: config,
      scheduleEnabled: scheduleEnabled,
      scheduleFrequency: report.scheduleFrequency || 'weekly',
      scheduleDayOfWeek: config?.scheduleDayOfWeek || dayOfWeekIntToKey(report.scheduleDayOfWeek) || 'monday',
      scheduleDayOfMonth: config?.scheduleDayOfMonth || (report.scheduleDayOfMonth === 0 ? 'last' : String(report.scheduleDayOfMonth || 'first')),
      quarterTiming: config?.quarterTiming || report.quarterTiming || 'end',
      scheduleTime: config?.scheduleTime || from24HourTo12Hour(report.scheduleTime) || '9:00 AM',
      emailRecipients: emailRecipientsString,
      status: report.status || 'draft'
    };
    setReportForm(formData);
    
    // Set custom report config if it's a custom report
    if (report.reportType === 'custom' && config?.customReportConfig) {
      const cbdCampaigns = config.customReportConfig.campaignBreakdownCampaigns;
      const legacyInclude = !!config.customReportConfig.includeCampaignBreakdown;
      const inferredCampaigns = Array.isArray(cbdCampaigns) ? cbdCampaigns : [];
      setCustomReportConfig({
        coreMetrics: config.customReportConfig.coreMetrics || [],
        derivedMetrics: config.customReportConfig.derivedMetrics || [],
        kpis: config.customReportConfig.kpis || [],
        benchmarks: config.customReportConfig.benchmarks || [],
        includeAdComparison: config.customReportConfig.includeAdComparison || false,
        adComparisonMetrics: config.customReportConfig.adComparisonMetrics || [],
        insightsSections: config.customReportConfig.insightsSections || [],
        includeCampaignBreakdown: legacyInclude,
        campaignBreakdownCampaigns: inferredCampaigns,
      });
    }
    
    // Open the modal after a brief delay to ensure state updates complete
    setTimeout(() => {
      setIsReportModalOpen(true);
    }, 0);
  };

  // Handle create report
  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled) {
      if (!validateScheduledReportFields()) return;

      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Save scheduled report to database
      const reportData = {
        campaignId: campaignId || null,
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: reportForm.reportType,
        configuration: {
          ...reportForm.configuration,
          scheduleEnabled: reportForm.scheduleEnabled,
          scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
          scheduleDayOfMonth: reportForm.scheduleDayOfMonth,
          quarterTiming: reportForm.quarterTiming,
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' ? dayOfWeekKeyToInt(reportForm.scheduleDayOfWeek) : null,
        scheduleDayOfMonth: (reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') ? dayOfMonthToInt(reportForm.scheduleDayOfMonth) : null,
        scheduleTime: to24HourHHMM(reportForm.scheduleTime),
        scheduleTimeZone: userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        quarterTiming: reportForm.scheduleFrequency === 'quarterly' ? (reportForm.quarterTiming || 'end') : null,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        scheduleEnabled: reportForm.scheduleEnabled, // Add at top level for toast logic
        status: 'active'
      };
      
      devLog('[Report Creation - Before Mutation] reportData:', reportData);
      devLog('[Report Creation - Before Mutation] emailRecipientsArray:', emailRecipientsArray);
      devLog('[Report Creation - Before Mutation] scheduleEnabled:', reportForm.scheduleEnabled);
      
      createReportMutation.mutate(reportData);
    } else {
      // Generate and download report immediately
      handleDownloadReport();
    }
  };

  // Handle update report
  const handleUpdateReport = () => {
    if (!editingReportId) return;
    
    if (reportForm.scheduleEnabled) {
      if (!validateScheduledReportFields()) return;

      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Update scheduled report in database
      const reportData = {
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: reportForm.reportType,
        configuration: reportForm.reportType === 'custom' 
          ? {
              customReportConfig,
              scheduleEnabled: reportForm.scheduleEnabled,
              scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
              scheduleDayOfMonth: reportForm.scheduleDayOfMonth,
              quarterTiming: reportForm.quarterTiming,
              scheduleTime: reportForm.scheduleTime
            }
          : {
              ...reportForm.configuration,
              scheduleEnabled: reportForm.scheduleEnabled,
              scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
              scheduleDayOfMonth: reportForm.scheduleDayOfMonth,
              quarterTiming: reportForm.quarterTiming,
              scheduleTime: reportForm.scheduleTime
            },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' ? dayOfWeekKeyToInt(reportForm.scheduleDayOfWeek) : null,
        scheduleDayOfMonth: (reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') ? dayOfMonthToInt(reportForm.scheduleDayOfMonth) : null,
        scheduleTime: to24HourHHMM(reportForm.scheduleTime),
        scheduleTimeZone: userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        quarterTiming: reportForm.scheduleFrequency === 'quarterly' ? (reportForm.quarterTiming || 'end') : null,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        scheduleEnabled: reportForm.scheduleEnabled, // Add at top level for toast logic
        status: reportForm.status || 'active'
      };
      
      devLog('[Report Update - Before Mutation] reportData:', reportData);
      devLog('[Report Update - Before Mutation] emailRecipientsArray:', emailRecipientsArray);
      
      updateReportMutation.mutate({ reportId: editingReportId, reportData });
    } else {
      // If schedule is disabled, just download the report
      handleDownloadReport();
    }
  };

  // Handle download report
  const handleDownloadReport = async () => {
    const reportName = reportForm.name || 'LinkedIn Report';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Generate PDF based on type
    switch (reportForm.reportType) {
      case 'overview':
        generateOverviewPDF(doc, { title: reportForm.name, configuration: reportForm.configuration });
        break;
      case 'kpis':
        generateKPIsPDF(doc, { title: reportForm.name, configuration: reportForm.configuration });
        break;
      case 'benchmarks':
        generateBenchmarksPDF(doc, { title: reportForm.name, configuration: reportForm.configuration });
        break;
      case 'ads':
        generateAdComparisonPDF(doc, { title: reportForm.name, configuration: reportForm.configuration });
        break;
      case 'insights':
        generateInsightsPDF(doc, { title: reportForm.name, configuration: reportForm.configuration });
        break;
    }

    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    // Close modal and reset form
    setIsReportModalOpen(false);
    setReportModalStep('standard');
    setReportForm({
      name: '',
      description: '',
      reportType: '',
      configuration: null,
      scheduleEnabled: false,
      scheduleFrequency: 'daily',
      scheduleDayOfWeek: 'monday',
      scheduleDayOfMonth: 'first',
      quarterTiming: 'end',
      scheduleTime: '9:00 AM',
      emailRecipients: '',
      status: 'draft'
    });

    toast({
      title: "Report Downloaded",
      description: "Your PDF report has been downloaded successfully.",
    });
  };

  // Handle downloading saved report from library
  const handleDownloadSavedReport = async (report: any) => {
    try {
      const reportName = report.name || 'LinkedIn Report';
      
      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      const configuration =
        report.configuration && typeof report.configuration === 'string'
          ? JSON.parse(report.configuration)
          : (report.configuration || {});
      
      // Generate PDF based on type
      switch (report.reportType) {
        case 'overview':
          generateOverviewPDF(doc, { title: report.name, configuration });
          break;
        case 'kpis':
          generateKPIsPDF(doc, { title: report.name, configuration });
          break;
        case 'benchmarks':
          generateBenchmarksPDF(doc, { title: report.name, configuration });
          break;
        case 'ads':
          generateAdComparisonPDF(doc, { title: report.name, configuration });
          break;
        case 'insights':
          generateInsightsPDF(doc, { title: report.name, configuration });
          break;
        case 'custom':
          // For custom reports, use the stored configuration
          if (configuration && typeof configuration === 'object') {
            const cfg = (configuration as any).customReportConfig || configuration;
            generateCustomReportPDF(doc, cfg);
          } else {
            toast({
              title: "Error",
              description: "Custom report configuration not found.",
              variant: "destructive",
            });
            return;
          }
          break;
        default:
          toast({
            title: "Error",
            description: "Unknown report type.",
            variant: "destructive",
          });
          return;
      }

      // Download the PDF
      doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Report Downloaded",
        description: `${reportName} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Error",
        description: "Failed to download report.",
        variant: "destructive",
      });
    }
  };

  // Send a test email for a saved (scheduled) report
  const handleSendTestReportEmail = async (report: any) => {
    try {
      if (!report?.id) {
        toast({ title: "Error", description: "Missing report id.", variant: "destructive" });
        return;
      }

      const res = await apiRequest("POST", `/api/platforms/linkedin/reports/${encodeURIComponent(String(report.id))}/send-test`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.success === false) {
        toast({
          title: "Couldn't send test email",
          description: json?.message || "Check server email configuration and recipients.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Test email sent",
        description: "If you don't see it, check spam/promotions.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't send test email",
        description: e?.message || "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  // Handle custom report creation/download
  const handleCustomReport = () => {
    if (reportForm.scheduleEnabled) {
      if (!validateScheduledReportFields()) return;

      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Save scheduled custom report to database
      const reportData = {
        campaignId: campaignId || null,
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: 'custom',
        configuration: {
          customReportConfig,
          scheduleEnabled: reportForm.scheduleEnabled,
          scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
          scheduleDayOfMonth: reportForm.scheduleDayOfMonth,
          quarterTiming: reportForm.quarterTiming,
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        scheduleEnabled: reportForm.scheduleEnabled, // Add at top level for toast logic
        status: 'active'
      };
      
      devLog('[Custom Report Creation - Before Mutation] reportData:', reportData);
      devLog('[Custom Report Creation - Before Mutation] emailRecipientsArray:', emailRecipientsArray);
      
      createReportMutation.mutate(reportData);
    } else {
      // Generate and download custom report immediately
      handleDownloadCustomReport();
    }
  };

  // Handle download custom report
  const handleDownloadCustomReport = async () => {
    const reportName = reportForm.name || 'Custom LinkedIn Report';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Generate Custom PDF
    generateCustomPDF(doc);

    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    // Close modal and reset form
    setIsReportModalOpen(false);
    setReportModalStep('standard');
    setReportForm({
      name: '',
      description: '',
      reportType: '',
      configuration: null,
      scheduleEnabled: false,
      scheduleFrequency: 'weekly',
      scheduleDayOfWeek: 'monday',
      scheduleDayOfMonth: 'first',
      quarterTiming: 'end',
      scheduleTime: '9:00 AM',
      emailRecipients: '',
      status: 'draft'
    });
    setCustomReportConfig({
      coreMetrics: [],
      derivedMetrics: [],
      kpis: [],
      benchmarks: [],
      includeAdComparison: false,
      adComparisonMetrics: [],
      insightsSections: [],
      includeCampaignBreakdown: false,
      campaignBreakdownCampaigns: [],
    });

    toast({
      title: "Report Downloaded",
      description: "Your custom PDF report has been downloaded successfully.",
    });
  };

  // PDF Helper: Add header
  const addPDFHeader = (doc: any, title: string, subtitle: string) => {
    const { session, metrics } = (sessionData as any) || {};
    
    // Get unique campaign names from metrics
    const campaignNames = metrics 
      ? Array.from(new Set(metrics.map((m: any) => m.campaignName))).join(', ')
      : 'N/A';
    
    // LinkedIn brand color header
    doc.setFillColor(0, 119, 181); // LinkedIn blue
    doc.rect(0, 0, 210, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, 20);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(subtitle, 20, 30);
    
    // Report info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 50);
    doc.text(`Campaign: ${campaignNames}`, 20, 57);
  };

  // PDF Helper: Add section
  const addPDFSection = (doc: any, title: string, y: number, color: number[] = [66, 139, 202]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, y + 7);
    return y + 15;
  };

  // PDF Helper: Append Insights section (used by Standard + Custom reports)
  const appendInsightsPDF = (
    doc: any,
    y: number,
    opts: { executiveFinancials?: boolean; trends?: boolean; whatChanged?: boolean }
  ) => {
    const showExec = !!opts.executiveFinancials;
    const showTrends = !!opts.trends;
    const showWhatChanged = !!opts.whatChanged;

    if (!showExec && !showTrends && !showWhatChanged) return y;

    if (y > 235) {
      doc.addPage();
      y = 20;
    }

    y = addPDFSection(doc, 'Insights', y, [16, 185, 129]);
    doc.setTextColor(50, 50, 50);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const aggregatedAny = (sessionData as any)?.aggregated || (aggregated as any) || {};
    const hasRevenueTracking = Number((aggregatedAny as any)?.hasRevenueTracking || 0) === 1;
    const conversionValue = Number((aggregatedAny as any)?.conversionValue || (aggregatedAny as any)?.conversionvalue || 0) || 0;
    const hasConversionValue = Number.isFinite(conversionValue) && conversionValue > 0;

    const safeAddLine = (text: string) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    };

    if (showExec) {
      doc.setFont(undefined, 'bold');
      safeAddLine('Executive financials');
      doc.setFont(undefined, 'normal');

      const spend = Number((aggregatedAny as any)?.totalSpend ?? (aggregatedAny as any)?.spend ?? 0) || 0;
      const totalRevenue = Number((aggregatedAny as any)?.totalRevenue ?? (aggregatedAny as any)?.revenue ?? 0) || 0;
      const roas = Number((aggregatedAny as any)?.roas ?? 0) || 0;
      const roi = Number((aggregatedAny as any)?.roi ?? 0) || 0;

      safeAddLine(`Spend: ${formatCurrency(spend)}`);
      safeAddLine(`Total Revenue: ${hasRevenueTracking ? formatCurrency(totalRevenue) : 'Not connected'}`);
      safeAddLine(`ROAS: ${hasRevenueTracking ? `${roas.toFixed(2)}x` : 'Not connected'}`);
      safeAddLine(`ROI: ${hasRevenueTracking ? formatPercentage(roi) : 'Not connected'}`);

      if (hasRevenueTracking && !hasConversionValue) {
        safeAddLine('Note: Revenue is connected, but conversion value is missing/0; ad-level revenue attribution may be unavailable.');
      }

      y += 4;
    }

    if (showTrends) {
      doc.setFont(undefined, 'bold');
      safeAddLine('Trends');
      doc.setFont(undefined, 'normal');

      const rows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
      const byDate = rows
        .map((r: any) => {
          const date = String(r?.date || '').trim();
          const impressions = Number(r?.impressions || 0) || 0;
          const clicks = Number(r?.clicks || 0) || 0;
          const conversions = Number(r?.conversions || 0) || 0;
          const spend = Number(r?.spend || 0) || 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
          const revenue = hasRevenueTracking && hasConversionValue ? conversions * conversionValue : 0;
          const roas = spend > 0 ? revenue / spend : 0;
          return { date, impressions, clicks, conversions, spend, ctr, cvr, revenue, roas };
        })
        .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
        .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

      if (byDate.length < 14) {
        safeAddLine('Not enough daily history yet for week-over-week comparisons (need at least 14 days).');
      } else {
        const last7 = byDate.slice(-7);
        const prior7 = byDate.slice(-14, -7);
        const sum = (arr: any[], k: string) => arr.reduce((acc, r) => acc + (Number(r?.[k] || 0) || 0), 0);

        const lastSpend = sum(last7, 'spend');
        const priorSpend = sum(prior7, 'spend');
        const lastConv = sum(last7, 'conversions');
        const priorConv = sum(prior7, 'conversions');

        const deltaPct = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / prev) * 100 : null);
        const fmtDelta = (v: number | null) => (v === null ? 'n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

        safeAddLine(`Spend (last 7d vs prior 7d): ${formatCurrency(lastSpend)} vs ${formatCurrency(priorSpend)} (${fmtDelta(deltaPct(lastSpend, priorSpend))})`);
        safeAddLine(`Conversions (last 7d vs prior 7d): ${formatNumber(lastConv)} vs ${formatNumber(priorConv)} (${fmtDelta(deltaPct(lastConv, priorConv))})`);

        if (hasRevenueTracking && hasConversionValue) {
          const lastRev = sum(last7, 'revenue');
          const priorRev = sum(prior7, 'revenue');
          safeAddLine(`Revenue (last 7d vs prior 7d): ${formatCurrency(lastRev)} vs ${formatCurrency(priorRev)} (${fmtDelta(deltaPct(lastRev, priorRev))})`);
        }
      }

      y += 4;
    }

    if (showWhatChanged) {
      doc.setFont(undefined, 'bold');
      safeAddLine('What changed, what to do next');
      doc.setFont(undefined, 'normal');

      const items = Array.isArray(linkedInInsights) ? linkedInInsights : [];
      if (items.length === 0) {
        safeAddLine('No insights available.');
      } else {
        items.slice(0, 6).forEach((i: any, idx: number) => {
          const title = String(i?.title || `Insight ${idx + 1}`).trim();
          const rec = String(i?.recommendation || '').trim();
          safeAddLine(`- ${title}`);
          if (rec) safeAddLine(`  Next: ${rec}`);
        });
      }
    }

    return y + 2;
  };

  const addCampaignBreakdownPDF = (
    doc: any,
    y: number,
    aggregated: any,
    opts?: { selectedCampaignUrns?: string[] }
  ) => {
    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) return y;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    y = addPDFSection(doc, 'Campaign Breakdown', y, [54, 162, 235]);

    // Build campaign groups similar to the UI breakdown
    const campaigns = Object.values(
      (metrics as any[]).reduce((acc: any, metric: any) => {
        if (!acc[metric.campaignUrn]) {
          acc[metric.campaignUrn] = {
            campaignUrn: metric.campaignUrn,
            name: metric.campaignName,
            status: metric.campaignStatus,
            metrics: {}
          };
        }
        acc[metric.campaignUrn].metrics[metric.metricKey] = parseFloat(metric.metricValue);
        return acc;
      }, {})
    ) as any[];

    const conversionValue = Number((aggregated as any)?.conversionValue || (aggregated as any)?.conversionvalue || 0);
    const hasRevenue = (aggregated as any)?.hasRevenueTracking === 1 && Number.isFinite(conversionValue) && conversionValue > 0;

    const selectedUrns = Array.isArray(opts?.selectedCampaignUrns) ? opts!.selectedCampaignUrns : null;
    const visibleCampaigns = selectedUrns && selectedUrns.length > 0
      ? campaigns.filter((c: any) => selectedUrns.includes(String((c as any)?.campaignUrn || (c as any)?.urn || (c as any)?.id || '')))
      : campaigns;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 6, 170, 8, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('Campaign', 22, y);
    doc.text('Spend', 92, y);
    doc.text('Impr', 112, y);
    doc.text('Clicks', 130, y);
    doc.text('Conv', 147, y);
    doc.text('Leads', 160, y);
    doc.text('CTR', 175, y);

    y += 10;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);

    visibleCampaigns.forEach((c: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const impressions = Number(c?.metrics?.impressions || 0);
      const clicks = Number(c?.metrics?.clicks || 0);
      const spend = Number(c?.metrics?.spend || 0);
      const conversions = Number(c?.metrics?.conversions || 0);
      const leads = Number(c?.metrics?.leads || 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      const revenue = hasRevenue ? conversions * conversionValue : 0;
      const profit = hasRevenue ? (revenue - spend) : 0;
      const roi = hasRevenue && spend > 0 ? (profit / spend) * 100 : 0;
      const roas = hasRevenue && spend > 0 ? (revenue / spend) : 0;

      const name = String(c?.name || 'Campaign');
      const nameShort = name.length > 30 ? `${name.slice(0, 29)}…` : name;

      doc.setFontSize(8);
      doc.text(nameShort, 22, y);
      doc.text(formatCurrency(spend), 92, y);
      doc.text(formatNumber(impressions), 112, y);
      doc.text(formatNumber(clicks), 130, y);
      doc.text(formatNumber(conversions), 147, y);
      doc.text(formatNumber(leads), 160, y);
      doc.text(`${ctr.toFixed(2)}%`, 175, y);

      doc.setTextColor(110, 110, 110);
      doc.setFontSize(7);
      const baseLine = `CPC ${formatCurrency(cpc)}  CPA ${formatCurrency(cpa)}  CVR ${cvr.toFixed(2)}%`;
      const revLine = hasRevenue ? `  Rev ${formatCurrency(revenue)}  ROAS ${roas.toFixed(2)}x  ROI ${roi.toFixed(1)}%` : '';
      doc.text(`${baseLine}${revLine}`, 22, y + 4);
      doc.setTextColor(50, 50, 50);

      y += 12;
    });

    return y + 6;
  };

  // Generate Overview PDF
  const generateOverviewPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const { session, aggregated } = (sessionData as any) || {};
    
    const title = String(opts?.title || reportForm.name || 'LinkedIn Report');
    const configuration = opts?.configuration || reportForm.configuration || {};
    addPDFHeader(doc, title, 'LinkedIn Metrics');
    
    let y = 70;
    
    if (!aggregated || Object.keys(aggregated).length === 0) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text('No metrics data available', 20, y);
      return;
    }
    
    // Separate core, derived, and revenue metrics
    const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er'];
    const revenueMetrics = ['totalrevenue', 'roas', 'roi', 'profit', 'profitmargin', 'revenueperlead'];
    const excludeMetrics = ['hasrevenuetracking', 'conversionvalue', 'revenue', 'performanceindicators'];
    const coreMetricsData: any[] = [];
    const derivedMetricsData: any[] = [];
    const revenueMetricsData: any[] = [];
    
    Object.entries(aggregated).forEach(([key, value]: [string, any]) => {
      // Normalize the key - be careful to preserve revenue metric names
      let metricKey = key.toLowerCase();
      
      // Only strip 'total' prefix if it's not 'totalrevenue' (a revenue metric)
      if (metricKey.startsWith('total') && metricKey !== 'totalrevenue') {
        metricKey = metricKey.substring(5); // Remove 'total' prefix
      }
      
      // Strip 'avg' prefix
      if (metricKey.startsWith('avg')) {
        metricKey = metricKey.substring(3); // Remove 'avg' prefix
      }
      
      // Skip excluded metrics
      if (excludeMetrics.includes(metricKey)) return;
      
      const { label, format } = getMetricDisplay(metricKey, value);
      const formattedValue = format(value);
      
      if (revenueMetrics.includes(metricKey)) {
        revenueMetricsData.push({ label, value: formattedValue });
      } else if (derivedMetrics.includes(metricKey)) {
        derivedMetricsData.push({ label, value: formattedValue });
      } else {
        coreMetricsData.push({ label, value: formattedValue });
      }
    });
    
    // Core Metrics Section
    if (coreMetricsData.length > 0) {
      y = addPDFSection(doc, 'Core Metrics', y, [52, 168, 83]);
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      coreMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
      
      y += 10;
    }
    
    // Derived Metrics Section
    if (derivedMetricsData.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      y = addPDFSection(doc, 'Derived Metrics', y, [255, 159, 64]);
      doc.setTextColor(50, 50, 50);
      
      derivedMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
      
      y += 10;
    }
    
    // Revenue Metrics Section - Only if revenue tracking is enabled
    if (revenueMetricsData.length > 0 && aggregated.hasRevenueTracking === 1) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      y = addPDFSection(doc, 'Revenue Metrics', y, [16, 185, 129]);
      doc.setTextColor(50, 50, 50);
      
      revenueMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
    }

    // Campaign Breakdown (per-campaign metrics)
    y = addCampaignBreakdownPDF(doc, y, aggregated);

    // Optional Insights section (Standard Templates)
    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate KPIs PDF
  const generateKPIsPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm.name || 'LinkedIn Report');
    const configuration = opts?.configuration || reportForm.configuration || {};
    addPDFHeader(doc, title, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Key Performance Indicators', y, [156, 39, 176]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    // Helper function to calculate performance level
    const getKPIPerformanceLevel = (kpi: any): { level: string, color: number[] } => {
      const current = getLiveCurrentForKpi(kpi);
      const target = parseFloat(kpi.targetValue || '0');
      
      if (target === 0) return { level: 'N/A', color: [150, 150, 150] };
      
      const ratio = current / target;
      const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some((m: string) => 
        kpi.metric?.toLowerCase().includes(m) || kpi.name?.toLowerCase().includes(m)
      );
      
      if (lowerIsBetter) {
        if (ratio <= 0.8) return { level: 'Excellent', color: [52, 168, 83] };
        if (ratio <= 1.0) return { level: 'Good', color: [66, 139, 202] };
        if (ratio <= 1.2) return { level: 'Fair', color: [255, 193, 7] };
        return { level: 'Poor', color: [220, 53, 69] };
      } else {
        if (ratio >= 1.2) return { level: 'Excellent', color: [52, 168, 83] };
        if (ratio >= 1.0) return { level: 'Good', color: [66, 139, 202] };
        if (ratio >= 0.8) return { level: 'Fair', color: [255, 193, 7] };
        return { level: 'Poor', color: [220, 53, 69] };
      }
    };
    
    if (kpisData && Array.isArray(kpisData) && kpisData.length > 0) {
      kpisData.forEach((kpi: any) => {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        
        // KPI Box - increased height for performance indicator
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 60, 3, 3, 'S');
        
        // KPI name with metric badge
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(kpi.name, 25, y + 2);
        
        // Metric badge
        if (kpi.metric) {
          doc.setFillColor(66, 139, 202);
          doc.roundedRect(25, y + 6, 30, 6, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.text(kpi.metric.toUpperCase(), 40, y + 10, { align: 'center' });
          doc.setTextColor(50, 50, 50);
        }
        
        // Apply To badge (if campaign-specific)
        if (kpi.applyTo === 'campaign' && kpi.specificCampaignId) {
          doc.setFillColor(139, 92, 246);
          doc.roundedRect(58, y + 6, 35, 6, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.text('CAMPAIGN', 75.5, y + 10, { align: 'center' });
          doc.setTextColor(50, 50, 50);
        }
        
        // Current and Target values
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const liveCurrent = getLiveCurrentForKpi(kpi);
        doc.text(`Current: ${formatNumber(liveCurrent || 0)}${kpi.unit || ''}`, 25, y + 18);
        doc.text(`Target: ${formatNumber(parseFloat(kpi.targetValue) || 0)}${kpi.unit || ''}`, 100, y + 18);
        
        // Timeframe and Priority
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Timeframe: ${kpi.timeframe || 'monthly'}`, 25, y + 25);
        doc.text(`Priority: ${kpi.priority || 'medium'}`, 100, y + 25);
        doc.setTextColor(50, 50, 50);
        
        // Progress bar
        const current = liveCurrent || 0;
        const target = parseFloat(kpi.targetValue) || 100;
        const progress = Math.min((current / target) * 100, 100);
        
        // Progress bar background (gray)
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(25, y + 32, 160, 8, 2, 2, 'F');
        
        // Progress bar fill (green if >= 100%, blue otherwise)
        if (progress > 0) {
          const fillColor = progress >= 100 ? [52, 168, 83] : [66, 139, 202];
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          const barWidth = (160 * progress) / 100;
          doc.roundedRect(25, y + 32, barWidth, 8, 2, 2, 'F');
        }
        
        // Progress percentage text - white and bold for visibility
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`${progress.toFixed(1)}%`, 105, y + 37, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(50, 50, 50);
        
        // Performance Level Badge
        const { level, color } = getKPIPerformanceLevel(kpi);
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(25, y + 45, 40, 7, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text(level, 45, y + 50, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(50, 50, 50);
        
        // Alerts status (no emoji)
        if (kpi.alertsEnabled) {
          doc.setFontSize(8);
          doc.setTextColor(220, 38, 38);
          doc.text('Alerts Enabled', 70, y + 50);
          doc.setTextColor(50, 50, 50);
        }
        
        y += 68;
      });
    } else {
      doc.text('No KPIs configured yet', 20, y);
    }
    
    // Optional Insights section (Standard Templates)
    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Benchmarks PDF
  const generateBenchmarksPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm.name || 'LinkedIn Report');
    const configuration = opts?.configuration || reportForm.configuration || {};
    addPDFHeader(doc, title, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Performance Benchmarks', y, [255, 99, 132]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0) {
      benchmarksData.forEach((benchmark: any) => {
        if (y > 210) {
          doc.addPage();
          y = 20;
        }
        
        // Benchmark Box - increased height for all content
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 75, 3, 3, 'S');
        
        // Benchmark title with metric badge
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(benchmark.name, 25, y + 2);
        
        // Metric badge
        if (benchmark.metric) {
          doc.setFillColor(255, 99, 132);
          doc.roundedRect(25, y + 6, 30, 6, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.text(benchmark.metric.toUpperCase(), 40, y + 10, { align: 'center' });
          doc.setTextColor(50, 50, 50);
        }
        
        // Apply To badge (if campaign-specific)
        if (benchmark.applyTo === 'campaign' && benchmark.linkedInCampaignName) {
          doc.setFillColor(139, 92, 246);
          doc.roundedRect(58, y + 6, 35, 6, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.text('CAMPAIGN', 75.5, y + 10, { align: 'center' });
          doc.setTextColor(50, 50, 50);
          
          // Campaign name
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`Campaign: ${benchmark.linkedInCampaignName}`, 25, y + 16);
          doc.setTextColor(50, 50, 50);
        }
        
        // Description
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const descY = benchmark.applyTo === 'campaign' ? y + 22 : y + 16;
        doc.text((String(benchmark.description || '').trim() || DEFAULT_BENCHMARK_DESCRIPTION), 25, descY);
        
        // Benchmark Type (Industry or Custom)
        const typeY = descY + 6;
        if (benchmark.industry) {
          doc.text(`Type: Industry (${benchmark.industry})`, 25, typeY);
        } else {
          doc.text('Type: Custom Value', 25, typeY);
        }
        doc.setTextColor(50, 50, 50);
        
        // Values section
        const valuesY = typeY + 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Your Performance', 25, valuesY);
        doc.text('Benchmark Value', 85, valuesY);
        doc.text('Status', 145, valuesY);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        const liveCurrent = getLiveCurrentForBenchmark(benchmark);
        doc.text(`${formatNumber(liveCurrent || 0)}${benchmark.unit || ''}`, 25, valuesY + 8);
        doc.text(`${formatNumber(parseFloat(benchmark.benchmarkValue) || 0)}${benchmark.unit || ''}`, 85, valuesY + 8);
        doc.text(benchmark.status === 'active' ? 'Active' : 'Inactive', 145, valuesY + 8);
        
        // Performance vs Benchmark
        if (benchmark.benchmarkValue) {
          const current = liveCurrent || 0;
          const benchmarkVal = parseFloat(benchmark.benchmarkValue);
          const diff = current - benchmarkVal;
          const percentDiff = benchmarkVal > 0 ? Math.abs((diff / benchmarkVal) * 100).toFixed(0) : '0';
          
          // Determine if higher or lower is better
          const lowerBetterMetrics = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'];
          const metricKey = (benchmark.metric || '').toLowerCase();
          const isLowerBetter = lowerBetterMetrics.includes(metricKey);
          
          const isGood = isLowerBetter ? current < benchmarkVal : current > benchmarkVal;
          const status = current > benchmarkVal ? 'Above' : current < benchmarkVal ? 'Below' : 'At';
          const statusColor = isGood ? [52, 168, 83] : [220, 38, 38]; // green or red
          
          const perfY = valuesY + 18;
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.text('Performance vs Benchmark:', 25, perfY);
          
          // Status badge
          doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
          doc.roundedRect(25, perfY + 3, 35, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text(`${percentDiff}% ${status}`, 42.5, perfY + 8, { align: 'center' });
          
          // Status text
          doc.setTextColor(100, 100, 100);
          doc.setFont(undefined, 'normal');
          const statusText = isGood ? 'Exceeds benchmark' : 'Needs improvement';
          doc.text(statusText, 63, perfY + 8);
          doc.setTextColor(50, 50, 50);
        }
        
        y += 83;
      });
    } else {
      doc.text('No benchmarks configured yet', 20, y);
    }
    
    // Optional Insights section (Standard Templates)
    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Ad Comparison PDF
  const generateAdComparisonPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm.name || 'LinkedIn Report');
    const configuration = opts?.configuration || reportForm.configuration || {};
    addPDFHeader(doc, title, 'LinkedIn Metrics');
    
    let y = 70;
    
    // Check if we have ads data
    if (!adsData || !Array.isArray(adsData) || adsData.length === 0) {
      y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text('No ad data available', 20, y);
      return;
    }
    
    // Finance-grade correctness:
    // Treat the backend as the single source of truth for sort order.
    const allAds = Array.isArray(adsData) ? (adsData as any[]) : [];
    const totalAds = allAds.length;
    const isLimited = totalAds > 15;
    const sortedAds = isLimited ? allAds.slice(0, 15) : allAds;

    // Ad-level revenue attribution requires a conversion value
    const hasAdLevelRevenue = aggregated?.hasRevenueTracking === 1 && Number(aggregated?.conversionValue || 0) > 0;
    const anyEstimatedRevenue = hasAdLevelRevenue && sortedAds.some((ad: any) => Boolean(ad?._computed?.revenueIsEstimated));
    
    // Summary section
    y = addPDFSection(doc, 'Ad Performance Summary', y, [54, 162, 235]);
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    
    const totalRevenue = allAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0);
    const avgRevenue = totalAds > 0 ? (totalRevenue / totalAds) : 0;
    const totalSpend = allAds.reduce((sum, ad) => sum + parseFloat(ad.spend || '0'), 0);
    const totalConversions = allAds.reduce((sum, ad) => sum + parseFloat(ad.conversions || '0'), 0);
    
    doc.setFont(undefined, 'bold');
    doc.text('Total Ads:', 25, y);
    doc.setFont(undefined, 'normal');
    doc.text(`${totalAds}${isLimited ? ' (showing top 15)' : ''}`, 100, y);
    y += 8;
    
    if (hasAdLevelRevenue) {
      doc.setFont(undefined, 'bold');
      doc.text('Total Revenue:', 25, y);
      doc.setFont(undefined, 'normal');
      doc.text(formatCurrency(totalRevenue), 100, y);
      y += 8;
      
      doc.setFont(undefined, 'bold');
      doc.text('Avg Revenue/Ad:', 25, y);
      doc.setFont(undefined, 'normal');
      doc.text(formatCurrency(avgRevenue), 100, y);
      y += 8;

      if (anyEstimatedRevenue) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Note: Revenue is estimated (derived conversion value).', 25, y);
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        y += 7;
      } else {
        y += 7;
      }
    } else {
      doc.setFont(undefined, 'bold');
      doc.text('Total Spend:', 25, y);
      doc.setFont(undefined, 'normal');
      doc.text(formatCurrency(totalSpend), 100, y);
      y += 8;

      doc.setFont(undefined, 'bold');
      doc.text('Total Conversions:', 25, y);
      doc.setFont(undefined, 'normal');
      doc.text(formatNumber(totalConversions), 100, y);
      y += 15;
    }
    
    // Individual ads section
    y = addPDFSection(doc, 'Individual Ad Performance', y, [54, 162, 235]);
    doc.setTextColor(50, 50, 50);
    
    sortedAds.forEach((ad: any, index: number) => {
      // Check if we need a new page (account for taller boxes with revenue metrics)
      const showRevenueMetrics = hasAdLevelRevenue;
      const requiredSpace = showRevenueMetrics ? 84 : 68; // Box height + spacing
      
      if (y + requiredSpace > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Ad box with ranking indicator - increased height for all metrics
      const isTop = index === 0;
      const borderColor = isTop ? [52, 168, 83] : [200, 200, 200]; // green for top performer
      const boxHeight = showRevenueMetrics ? 76 : 60; // Taller box when revenue metrics exist
      
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(isTop ? 0.5 : 0.3);
      doc.roundedRect(20, y - 5, 170, boxHeight, 3, 3, 'S');
      doc.setLineWidth(0.3);
      
      // Rank badge
      doc.setFillColor(isTop ? 52 : 66, isTop ? 168 : 139, isTop ? 83 : 202);
      doc.circle(28, y, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.text(`${index + 1}`, 28, y + 1.5, { align: 'center' });
      
      // Ad name
      doc.setTextColor(50, 50, 50);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(ad.adName || ad.name || 'Unnamed Ad', 35, y + 2);

      // Estimated badge (when derived conversion value is used)
      if (showRevenueMetrics && ad?._computed?.revenueIsEstimated) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont(undefined, 'normal');
        doc.text('(Estimated)', 180, y + 2, { align: 'right' });
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11);
      }
      
      // Core Metrics Section
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      
      // Core metrics - Row 1
      doc.text(`Impressions: ${formatNumber(parseFloat(ad.impressions || 0))}`, 25, y + 12);
      doc.text(`Reach: ${formatNumber(parseFloat(ad.reach || 0))}`, 85, y + 12);
      doc.text(`Clicks: ${formatNumber(parseFloat(ad.clicks || 0))}`, 135, y + 12);
      
      // Core metrics - Row 2
      doc.text(`Spend: ${formatCurrency(parseFloat(ad.spend || 0))}`, 25, y + 20);
      doc.text(`Conversions: ${formatNumber(parseFloat(ad.conversions || 0))}`, 85, y + 20);
      doc.text(`Leads: ${formatNumber(parseFloat(ad.leads || 0))}`, 135, y + 20);
      
      // Core metrics - Row 3
      doc.text(`Engagements: ${formatNumber(parseFloat(ad.engagements || 0))}`, 25, y + 28);
      
      // Derived Metrics Section
      // Derived metrics - Row 4
      doc.text(`CTR: ${(parseFloat(ad.ctr || 0)).toFixed(2)}%`, 25, y + 36);
      doc.text(`CPC: ${formatCurrency(parseFloat(ad.cpc || 0))}`, 85, y + 36);
      doc.text(`CPM: ${formatCurrency(parseFloat(ad.cpm || 0))}`, 135, y + 36);
      
      // Derived metrics - Row 5
      doc.text(`CVR: ${(parseFloat(ad.cvr || 0)).toFixed(2)}%`, 25, y + 44);
      doc.text(`CPA: ${formatCurrency(parseFloat(ad.cpa || 0))}`, 85, y + 44);
      doc.text(`CPL: ${formatCurrency(parseFloat(ad.cpl || 0))}`, 135, y + 44);
      
      // Derived metrics - Row 6
      doc.text(`ER: ${(parseFloat(ad.er || 0)).toFixed(2)}%`, 25, y + 52);
      
      // Revenue Metrics Section (if available)
      if (showRevenueMetrics) {
        // Revenue metrics - Row 7
        doc.setFont(undefined, 'bold');
        doc.text(`Revenue: ${formatCurrency(parseFloat(ad.revenue || 0))}`, 25, y + 60);
        doc.setFont(undefined, 'normal');
        doc.text(`ROAS: ${(parseFloat(ad.roas || 0)).toFixed(2)}x`, 85, y + 60);
        doc.text(`ROI: ${(parseFloat(ad.roi || 0)).toFixed(1)}%`, 135, y + 60);
        
        // Revenue metrics - Row 8
        doc.text(`Profit: ${formatCurrency(parseFloat(ad.profit || 0))}`, 25, y + 68);
        doc.text(`Margin: ${(parseFloat(ad.profitMargin || 0)).toFixed(1)}%`, 85, y + 68);
        doc.text(`Rev/Lead: ${formatCurrency(parseFloat(ad.revenuePerLead || 0))}`, 135, y + 68);
      }
      
      y += boxHeight + 8;
    });
    
    // Optional Insights section (Standard Templates)
    if ((configuration as any)?.includeInsights) {
      y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Insights PDF (Standard Template)
  const generateInsightsPDF = (doc: any, opts?: { title?: string; configuration?: any }) => {
    const title = String(opts?.title || reportForm.name || 'Insights Report');
    addPDFHeader(doc, title, 'LinkedIn Metrics');

    let y = 70;
    y = appendInsightsPDF(doc, y, { executiveFinancials: true, trends: true, whatChanged: true });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Back-compat: saved report downloads call this for custom reports.
  const generateCustomReportPDF = (doc: any, cfg: any) => {
    generateCustomPDF(doc, cfg);
  };

  // Generate Custom PDF based on user selections
  const generateCustomPDF = (doc: any, customCfg: any = customReportConfig) => {
    // Shadow to keep existing references in this function working.
    const customReportConfig = customCfg as any;
    const { session, aggregated } = (sessionData as any) || {};
    
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    
    // Helper function to find the correct aggregated key
    const findAggregatedKey = (metricKey: string): any => {
      if (!aggregated) return null;
      
      // Direct mapping for known problematic keys (revenue metrics with camelCase)
      const keyMappings: Record<string, string> = {
        'totalrevenue': 'totalRevenue',
        'profitmargin': 'profitMargin',
        'revenueperlead': 'revenuePerLead',
        'videoviews': 'videoViews'
      };
      
      // Try mapped key first
      const mappedKey = keyMappings[metricKey.toLowerCase()];
      if (mappedKey && aggregated[mappedKey] !== undefined) return aggregated[mappedKey];
      
      // Try exact match
      if (aggregated[metricKey] !== undefined) return aggregated[metricKey];
      
      // Try with 'total' prefix (e.g., impressions → totalImpressions)
      const totalKey = 'total' + metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[totalKey] !== undefined) return aggregated[totalKey];
      
      // Try with 'avg' prefix
      const avgKey = 'avg' + metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[avgKey] !== undefined) return aggregated[avgKey];
      
      // Try lowercase variations
      const lowerKey = metricKey.toLowerCase();
      if (aggregated[lowerKey] !== undefined) return aggregated[lowerKey];
      
      // Try uppercase first letter
      const capitalKey = metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
      if (aggregated[capitalKey] !== undefined) return aggregated[capitalKey];
      
      return null;
    };
    
    // Helper function to get metric label
    const getMetricLabel = (key: string): string => {
      const labels: Record<string, string> = {
        impressions: 'Impressions',
        clicks: 'Clicks',
        spend: 'Spend',
        conversions: 'Conversions',
        reach: 'Reach',
        engagements: 'Engagements',
        videoviews: 'Video Views',
        leads: 'Leads',
        totalrevenue: 'Total Revenue',
        revenue: 'Total Revenue',
        ctr: 'CTR',
        cpc: 'CPC',
        cpm: 'CPM',
        cvr: 'Conversion Rate',
        cpa: 'CPA',
        cpl: 'CPL',
        er: 'Engagement Rate',
        roi: 'ROI',
        roas: 'ROAS',
        profit: 'Profit',
        profitmargin: 'Profit Margin',
        revenueperlead: 'Revenue Per Lead'
      };
      return labels[key.toLowerCase()] || key;
    };

    // Helper function to format metric value
    const formatMetricValue = (key: string, value: any): string => {
      if (!value && value !== 0) return 'N/A';
      
      const percentageMetrics = ['ctr', 'cvr', 'er', 'roi', 'profitmargin'];
      const currencyMetrics = ['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'revenue', 'totalrevenue', 'profit', 'revenueperlead'];
      
      if (percentageMetrics.includes(key.toLowerCase())) {
        return `${parseFloat(value).toFixed(2)}%`;
      } else if (currencyMetrics.includes(key.toLowerCase())) {
        return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (key.toLowerCase() === 'roas') {
        return `${parseFloat(value).toFixed(2)}x`;
      } else {
        return parseFloat(value).toLocaleString();
      }
    };

    // Overview Section - Core and Derived Metrics
    const hasMetrics = customReportConfig.coreMetrics.length > 0 || customReportConfig.derivedMetrics.length > 0;
    
    if (hasMetrics) {
      y = addPDFSection(doc, 'Overview', y, [54, 162, 235]);
      
      // Core Metrics
      if (customReportConfig.coreMetrics.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Core Metrics', 20, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        customReportConfig.coreMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = findAggregatedKey(metric);
          const formattedValue = formatMetricValue(metric, value !== null ? value : 0);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 5;
      }
      
      // Derived Metrics (filter out revenue metrics)
      const revenueMetricKeys = ['totalrevenue', 'revenue', 'roas', 'roi', 'profit', 'profitmargin', 'revenueperlead'];
      const actualDerivedMetrics = customReportConfig.derivedMetrics.filter(
        m => !revenueMetricKeys.includes(m.toLowerCase())
      );
      const actualRevenueMetrics = customReportConfig.derivedMetrics.filter(
        m => revenueMetricKeys.includes(m.toLowerCase())
      );
      
      if (actualDerivedMetrics.length > 0) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Derived Metrics', 20, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        actualDerivedMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = findAggregatedKey(metric);
          const formattedValue = formatMetricValue(metric, value !== null ? value : 0);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 10;
      }
      
      // Revenue Metrics (separated from Derived Metrics)
      if (actualRevenueMetrics.length > 0) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Revenue Metrics', 20, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        actualRevenueMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = findAggregatedKey(metric);
          const formattedValue = formatMetricValue(metric, value !== null ? value : 0);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 10;
      }
    }

    // Campaign Breakdown section (per-campaign)
    const cbdCampaigns = Array.isArray((customReportConfig as any).campaignBreakdownCampaigns)
      ? (customReportConfig as any).campaignBreakdownCampaigns
      : [];
    const showCbd = (cbdCampaigns.length > 0) || !!(customReportConfig as any).includeCampaignBreakdown;
    if (showCbd) {
      y = addCampaignBreakdownPDF(doc, y, aggregated, { selectedCampaignUrns: cbdCampaigns.length > 0 ? cbdCampaigns : undefined });
    }

    // Insights Section (Custom Report - selected sub-sections)
    const insightKeys = Array.isArray((customReportConfig as any).insightsSections)
      ? (customReportConfig as any).insightsSections
      : [];
    if (insightKeys.length > 0) {
      y = appendInsightsPDF(doc, y, {
        executiveFinancials: insightKeys.includes('executive_financials'),
        trends: insightKeys.includes('trends'),
        whatChanged: insightKeys.includes('what_changed'),
      });
    }

    // KPIs Section
    if (customReportConfig.kpis.length > 0 && kpisData && Array.isArray(kpisData)) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Key Performance Indicators', y, [16, 185, 129]);
      
      const selectedKPIs = kpisData.filter((kpi: any) => customReportConfig.kpis.includes(kpi.id));
      
      selectedKPIs.forEach((kpi: any) => {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 43, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(kpi.name, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Metric: ${getMetricLabel(kpi.metric)}`, 25, y + 10);
        
        const currentValue = kpi.currentValue ? parseFloat(kpi.currentValue) : (findAggregatedKey(kpi.metric) || 0);
        const targetValue = parseFloat(kpi.targetValue) || 0;
        const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
        
        doc.text(`Current: ${formatMetricValue(kpi.metric, currentValue)}`, 25, y + 18);
        doc.text(`Target: ${formatMetricValue(kpi.metric, targetValue)}`, 100, y + 18);
        
        const barWidth = 140;
        const barHeight = 6;
        const barX = 25;
        const barY = y + 22;
        
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');
        
        if (progress > 0) {
          const fillColor = progress >= 100 ? [16, 185, 129] : [59, 130, 246];
          doc.setFillColor(...fillColor);
          doc.roundedRect(barX, barY, (barWidth * progress) / 100, barHeight, 2, 2, 'F');
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(255, 255, 255);
          const progressText = `${progress.toFixed(0)}%`;
          const textWidth = doc.getTextWidth(progressText);
          const textX = barX + ((barWidth * progress) / 100) / 2 - textWidth / 2;
          doc.text(progressText, textX, barY + 4.5);
        }
        
        // Performance Level Assessment
        if (targetValue > 0) {
          const ratio = currentValue / targetValue;
          const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some((m: string) => 
            kpi.metric?.toLowerCase().includes(m) || kpi.name?.toLowerCase().includes(m)
          );
          
          let performanceLevel: string;
          let performanceColor: number[];
          
          if (lowerIsBetter) {
            if (ratio <= 0.8) {
              performanceLevel = 'Excellent';
              performanceColor = [52, 168, 83];
            } else if (ratio <= 1.0) {
              performanceLevel = 'Good';
              performanceColor = [66, 139, 202];
            } else if (ratio <= 1.2) {
              performanceLevel = 'Fair';
              performanceColor = [255, 193, 7];
            } else {
              performanceLevel = 'Poor';
              performanceColor = [220, 53, 69];
            }
          } else {
            if (ratio >= 1.2) {
              performanceLevel = 'Excellent';
              performanceColor = [52, 168, 83];
            } else if (ratio >= 1.0) {
              performanceLevel = 'Good';
              performanceColor = [66, 139, 202];
            } else if (ratio >= 0.8) {
              performanceLevel = 'Fair';
              performanceColor = [255, 193, 7];
            } else {
              performanceLevel = 'Poor';
              performanceColor = [220, 53, 69];
            }
          }
          
          // Performance badge
          doc.setFillColor(performanceColor[0], performanceColor[1], performanceColor[2]);
          doc.roundedRect(25, y + 31, 40, 7, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          doc.text(performanceLevel, 45, y + 36, { align: 'center' });
          doc.setFont(undefined, 'normal');
          doc.setTextColor(50, 50, 50);
        }
        
        y += 53;
      });
    }

    // Benchmarks Section
    if (customReportConfig.benchmarks.length > 0 && benchmarksData && Array.isArray(benchmarksData)) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Benchmarks', y, [139, 92, 246]);
      
      const selectedBenchmarks = benchmarksData.filter((benchmark: any) => customReportConfig.benchmarks.includes(benchmark.id));
      
      selectedBenchmarks.forEach((benchmark: any) => {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 45, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(benchmark.name, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(benchmark.description || '', 25, y + 10, { maxWidth: 160 });
        
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text(`Metric: ${getMetricLabel(benchmark.metric)}`, 25, y + 20);
        
        const currentValue = benchmark.currentValue ? parseFloat(benchmark.currentValue) : (findAggregatedKey(benchmark.metric) || 0);
        const benchmarkValue = parseFloat(benchmark.benchmarkValue) || 0;
        
        doc.text(`Performance: ${formatMetricValue(benchmark.metric, currentValue)}`, 25, y + 28);
        doc.text(`Benchmark: ${formatMetricValue(benchmark.metric, benchmarkValue)}`, 100, y + 28);
        
        const diff = currentValue - benchmarkValue;
        const status = diff >= 0 ? 'Above' : 'Below';
        const statusColor = diff >= 0 ? [16, 185, 129] : [239, 68, 68];
        
        doc.setFillColor(...statusColor);
        doc.roundedRect(25, y + 32, 35, 6, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(status, 42.5, y + 36.5, { align: 'center' });
        
        y += 55;
      });
    }

    // Ad Comparison Section (Custom Report - selected metrics)
    const selectedAdMetrics = Array.isArray((customReportConfig as any).adComparisonMetrics)
      ? (customReportConfig as any).adComparisonMetrics
      : [];
    const includeAdComparison = selectedAdMetrics.length > 0 || !!(customReportConfig as any).includeAdComparison;

    if (includeAdComparison && adsData && Array.isArray(adsData) && adsData.length > 0) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
      
      const allAds = Array.isArray(adsData) ? (adsData as any[]) : [];
      const sortedAds = allAds.slice(0, 15); // backend order

      const metricMeta: Record<string, { label: string; kind: 'number' | 'currency' | 'percent' | 'x' }> = {
        impressions: { label: 'Impressions', kind: 'number' },
        reach: { label: 'Reach', kind: 'number' },
        clicks: { label: 'Clicks', kind: 'number' },
        engagements: { label: 'Engagements', kind: 'number' },
        spend: { label: 'Spend', kind: 'currency' },
        conversions: { label: 'Conversions', kind: 'number' },
        leads: { label: 'Leads', kind: 'number' },
        ctr: { label: 'CTR', kind: 'percent' },
        cpc: { label: 'CPC', kind: 'currency' },
        cpm: { label: 'CPM', kind: 'currency' },
        cvr: { label: 'CVR', kind: 'percent' },
        cpa: { label: 'CPA', kind: 'currency' },
        cpl: { label: 'CPL', kind: 'currency' },
        er: { label: 'ER', kind: 'percent' },
        revenue: { label: 'Revenue', kind: 'currency' },
        roas: { label: 'ROAS', kind: 'x' },
        roi: { label: 'ROI', kind: 'percent' },
        profit: { label: 'Profit', kind: 'currency' },
        profitMargin: { label: 'Profit Margin', kind: 'percent' },
        revenuePerLead: { label: 'Rev/Lead', kind: 'currency' },
      };

      const formatAdMetric = (key: string, v: any) => {
        const meta = metricMeta[key] || { label: key, kind: 'number' as const };
        const n = Number(v || 0) || 0;
        if (meta.kind === 'currency') return formatCurrency(n);
        if (meta.kind === 'percent') return `${n.toFixed(2)}%`;
        if (meta.kind === 'x') return `${n.toFixed(2)}x`;
        return formatNumber(n);
      };

      const defaultMetrics = ['impressions', 'clicks', 'spend', 'conversions', 'ctr', 'cvr'];
      const metricsToPrint = (selectedAdMetrics.length > 0 ? selectedAdMetrics : defaultMetrics)
        .filter((k: string) => typeof k === 'string' && k.length > 0);

      sortedAds.forEach((ad: any, index: number) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 52, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Ad #${index + 1}: ${ad.adName || ad.name || 'Unnamed Ad'}`, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);

        // Print selected metrics in 3 columns (cap for layout)
        const cols = [25, 85, 140];
        metricsToPrint.slice(0, 9).forEach((k: string, idx: number) => {
          const meta = metricMeta[k] || { label: k, kind: 'number' as const };
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const yy = y + 12 + row * 8;
          const raw = (ad as any)?.[k];
          doc.text(`${meta.label}: ${formatAdMetric(k, raw)}`, cols[col], yy);
        });

        y += 60;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Dynamic labels based on benchmark type
  const getBenchmarkValueLabel = (type: string) => {
    switch(type) {
      case 'industry_average': return 'Industry Benchmark Value';
      case 'competitor': return 'Competitor Value';
      case 'historical': return 'Historical Value';
      case 'target': return 'Target Value';
      case 'best_practice': return 'Best Practice Value';
      default: return 'Benchmark Value';
    }
  };

  const getContextFieldLabel = (type: string) => {
    switch(type) {
      case 'industry_average': return 'Industry';
      case 'competitor': return 'Competitor Name';
      case 'historical': return 'Time Period';
      case 'target': return 'Goal Context';
      case 'best_practice': return 'Source/Authority';
      default: return 'Context';
    }
  };

  const getContextFieldPlaceholder = (type: string) => {
    switch(type) {
      case 'industry_average': return 'e.g., Technology, Healthcare';
      case 'competitor': return 'e.g., Company XYZ';
      case 'historical': return 'e.g., Q1 2024, Last Year';
      case 'target': return 'e.g., Q4 Goal, Annual Target';
      case 'best_practice': return 'e.g., LinkedIn Marketing Labs';
      default: return 'Enter context';
    }
  };

  // Fetch platform-level LinkedIn KPIs filtered by campaignId
  const { data: kpisData, isLoading: kpisLoading, isError: kpisIsError, error: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['/api/platforms/linkedin/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch latest period for each KPI for period comparison
  const { data: kpiPeriods = {} } = useQuery<Record<string, any>>({
    queryKey: ['/api/kpis/periods', kpisData],
    queryFn: async () => {
      if (!kpisData || !Array.isArray(kpisData) || kpisData.length === 0) return {};
      
      const periods: Record<string, any> = {};
      
      // Fetch latest period for each KPI
      await Promise.all(
        kpisData.map(async (kpi: any) => {
          try {
            const res = await apiRequest('GET', `/api/kpis/${kpi.id}/latest-period`);
            const period = await res.json();
            if (period) {
              periods[kpi.id] = period;
            }
          } catch (error) {
            console.error(`Failed to fetch period for KPI ${kpi.id}:`, error);
          }
        })
      );
      
      return periods;
    },
    enabled: !!kpisData && Array.isArray(kpisData) && kpisData.length > 0
  });

  // Fetch platform-level LinkedIn Benchmarks filtered by campaignId
  const { data: benchmarksData, isLoading: benchmarksLoading, isError: benchmarksIsError, error: benchmarksError, refetch: refetchBenchmarksTab } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/benchmarks/evaluated`, sessionId],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    cacheTime: 0, // Don't cache at all
    onSuccess: () => setBenchmarksRefreshedAt(Date.now()),
    queryFn: async () => {
      const url = `/api/campaigns/${encodeURIComponent(String(campaignId))}/benchmarks/evaluated${
        sessionId ? `?session=${encodeURIComponent(String(sessionId))}` : ""
      }`;
      const resp = await fetch(url);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) return [];
      return Array.isArray(json?.benchmarks) ? json.benchmarks : [];
    },
  });

  // Helper to identify count-based metrics that should always be whole numbers
  const normalizeMetricKey = (metricKey: string): string => {
    // Normalize to a stable "comparison key" so older saved rows like "Reach", "reach ", "Total Revenue"
    // still format correctly.
    return String(metricKey || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "");
  };

  const isCountMetric = (metricKey: string): boolean => {
    const countMetrics = [
      'impressions', 'clicks', 'conversions', 'leads', 'engagements', 
      'reach', 'videoviews', 'viralimpressions', 'shares', 'comments', 
      'likes', 'reactions', 'follows'
    ];
    return countMetrics.includes(normalizeMetricKey(metricKey));
  };
  
  // Smart number formatter that auto-rounds count metrics
  const formatNumber = (num: number | string, metricKey?: string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    const value = isNaN(n) ? 0 : n;
    // Auto-round count-based metrics to whole numbers
    const shouldRound = metricKey ? isCountMetric(metricKey) : false;
    const finalValue = shouldRound ? Math.round(value) : value;
    return finalValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: shouldRound ? 0 : 2
    });
  };
  
  // Currency configurations (used for formatting + consistent unit symbols in KPI/Benchmark modals)
  const currencyConfig: Record<string, { symbol: string; locale: string; decimals: number }> = {
    USD: { symbol: '$', locale: 'en-US', decimals: 2 },
    GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
    EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
    JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
    CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
    AUD: { symbol: 'A$', locale: 'en-AU', decimals: 2 },
    INR: { symbol: '₹', locale: 'en-IN', decimals: 2 },
  };

  const campaignCurrencyCode = campaignData?.currency || 'USD';
  const campaignCurrencySymbol = (currencyConfig[campaignCurrencyCode] || currencyConfig.USD).symbol;

  const stripNumeric = (raw: string) => {
    const s = String(raw ?? '');
    // keep digits, decimal point, and leading minus (for completeness)
    return s.replace(/,/g, '').replace(/[^\d.-]/g, '');
  };

  const formatNumberAsYouType = (raw: string, opts?: { maxDecimals?: number }) => {
    const maxDecimals = typeof opts?.maxDecimals === 'number' ? opts.maxDecimals : 2;
    const cleaned = stripNumeric(raw);
    const negative = cleaned.startsWith('-');
    const body = negative ? cleaned.slice(1) : cleaned;
    const parts = body.split('.');
    const intRaw = parts[0] ?? '';
    const decRaw = parts.slice(1).join(''); // collapse extra dots
    const intDigits = intRaw.replace(/^0+(?=\d)/, '') || (intRaw ? '0' : '');
    const intWithCommas = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const dec = maxDecimals <= 0 ? '' : decRaw.slice(0, maxDecimals);
    const hasDot = body.includes('.');
    const sign = negative ? '-' : '';
    if (maxDecimals <= 0) return `${sign}${intWithCommas}`;
    return hasDot ? `${sign}${intWithCommas}.${dec}` : `${sign}${intWithCommas}`;
  };

  const getMaxDecimalsForMetric = (metricKey: string) => {
    const k = normalizeMetricKey(metricKey);
    if (isCountMetric(k)) return 0;
    if (['ctr', 'cvr', 'er', 'roi', 'profitmargin'].includes(k)) return 2;
    if (['roas'].includes(k)) return 2;
    // currency-like (spend, cpc, cpm, cpa, cpl, revenue/profit)
    if (['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'totalrevenue', 'profit', 'revenueperlead'].includes(k)) return 2;
    return 2;
  };

  const formatCurrency = (num: number | string, currencyCode?: string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    const currency = currencyCode || campaignCurrencyCode;
    const config = currencyConfig[currency] || currencyConfig.USD;
    
    return `${config.symbol}${(isNaN(n) ? 0 : n).toLocaleString(config.locale, { 
      minimumFractionDigits: config.decimals, 
      maximumFractionDigits: config.decimals 
    })}`;
  };
  
  const formatPercentage = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return `${(isNaN(n) ? 0 : n).toFixed(2)}%`;
  };

  // Helper function to get metric icon and formatted value
  const getMetricDisplay = (metricKey: string, value: number | string) => {
    const metricConfig: Record<string, { icon: any; format: (v: number | string) => string; label: string }> = {
      // Core Metrics (count-based - auto-rounded to whole numbers)
      'impressions': { icon: Eye, format: (v) => formatNumber(v, 'impressions'), label: 'Impressions' },
      'reach': { icon: Users, format: (v) => formatNumber(v, 'reach'), label: 'Reach' },
      'clicks': { icon: MousePointerClick, format: (v) => formatNumber(v, 'clicks'), label: 'Clicks' },
      'engagements': { icon: Activity, format: (v) => formatNumber(v, 'engagements'), label: 'Engagements' },
      'spend': { icon: DollarSign, format: formatCurrency, label: 'Spend' },
      'conversions': { icon: Target, format: (v) => formatNumber(v, 'conversions'), label: 'Conversions' },
      'leads': { icon: Users, format: (v) => formatNumber(v, 'leads'), label: 'Leads' },
      'videoviews': { icon: Play, format: (v) => formatNumber(v, 'videoviews'), label: 'Video Views' },
      'viralimpressions': { icon: Activity, format: (v) => formatNumber(v, 'viralimpressions'), label: 'Viral Impressions' },
      // Derived Metrics
      'ctr': { icon: TrendingUp, format: formatPercentage, label: 'Click-Through Rate (CTR)' },
      'cpc': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Click (CPC)' },
      'cpm': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Mille (CPM)' },
      'cvr': { icon: Target, format: formatPercentage, label: 'Conversion Rate (CVR)' },
      'cpa': { icon: DollarSign, format: formatCurrency, label: 'Cost per Acquisition (CPA)' },
      'cpl': { icon: DollarSign, format: formatCurrency, label: 'Cost per Lead (CPL)' },
      'er': { icon: Activity, format: formatPercentage, label: 'Engagement Rate (ER)' },
      // Revenue Metrics
      'totalrevenue': { icon: DollarSign, format: formatCurrency, label: 'Total Revenue' },
      'roas': { icon: TrendingUp, format: (v: number | string) => `${typeof v === 'number' ? v.toFixed(2) : v}x`, label: 'Return on Ad Spend (ROAS)' },
      'roi': { icon: TrendingUp, format: formatPercentage, label: 'Return on Investment (ROI)' },
      'profit': { icon: DollarSign, format: formatCurrency, label: 'Profit' },
      'profitmargin': { icon: Percent, format: (v: number | string) => `${typeof v === 'number' ? v.toFixed(1) : v}%`, label: 'Profit Margin' },
      'revenueperlead': { icon: DollarSign, format: formatCurrency, label: 'Revenue Per Lead' },
    };

    return metricConfig[metricKey] || { icon: BarChart3, format: formatNumber, label: metricKey };
  };

  const isCurrencyLikeMetric = (metricKey: string) => {
    const k = normalizeMetricKey(metricKey);
    return ['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'totalrevenue', 'profit', 'revenueperlead'].includes(k);
  };

  const normalizeBenchmarkTypeForUI = (b: any): 'industry' | 'custom' => {
    const btRaw = String((b as any)?.benchmarkType ?? '').toLowerCase();
    const hasIndustry = !!String((b as any)?.industry || '').trim();
    // If an industry is present, it's definitely "Industry Standard".
    if (hasIndustry) return 'industry';
    // If the DB default "industry" is present but no industry was selected, treat as custom.
    if (btRaw === 'industry') return 'custom';
    // Any other stored type maps to custom for this MVP UI.
    return 'custom';
  };

  const getBenchmarkUnitForMetric = (metricKey: string) => {
    const k = String(metricKey || '').toLowerCase();
    if (!k) return '';
    if (k === 'roas') return '×';
    if (isCurrencyLikeMetric(k)) return campaignCurrencySymbol;
    if (['ctr', 'cvr', 'er', 'roi', 'profitmargin'].includes(k)) return '%';
    return '';
  };

  const getBenchmarkModalCurrentValue = (metricKey: string, applyTo: 'all' | 'specific', linkedInCampaignName?: string) => {
    const k = String(metricKey || '');
    if (!k) return { currentValue: '', unit: '' };
    const unit = getBenchmarkUnitForMetric(k);
    const current = getLiveLinkedInMetricValue(k, applyTo === 'specific' ? linkedInCampaignName : undefined);
    return {
      currentValue: formatMetricValueForInput(k, String(current)),
      unit,
    };
  };

  const formatMetricValueForDisplay = (metricKey: string, raw: number | string) => {
    const k = normalizeMetricKey(metricKey);
    const decimals = getMaxDecimalsForMetric(k);
    const n = typeof raw === 'string' ? parseFloat(stripNumeric(raw)) : raw;
    const safe = Number.isFinite(n) ? Number(n) : 0;

    const formatted =
      decimals <= 0
        ? Math.round(safe).toLocaleString('en-US')
        : safe.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Currency must always match campaign currency and be prefixed (e.g., £1,234.56)
    if (isCurrencyLikeMetric(k)) return `${campaignCurrencySymbol}${formatted}`;
    if (['ctr', 'cvr', 'er', 'roi', 'profitmargin'].includes(k)) return `${formatted}%`;
    // ROAS: use a proper multiplication sign (×), not the letter "x".
    if (['roas'].includes(k)) return `${formatted}×`;
    return formatted;
  };

  const formatMetricValueForInput = (metricKey: string, raw: number | string) => {
    const k = normalizeMetricKey(metricKey);
    const maxDecimals = getMaxDecimalsForMetric(k);
    const n = typeof raw === 'string' ? parseFloat(stripNumeric(raw)) : raw;
    if (!Number.isFinite(n)) return '';
    const rounded = maxDecimals <= 0 ? Math.round(n) : n;
    return formatNumberAsYouType(String(rounded), { maxDecimals });
  };

  const isLowerBetterBenchmarkMetric = (metricKey: string) => {
    const k = String(metricKey || '').toLowerCase();
    return ['spend', 'cpc', 'cpm', 'cpa', 'cpl'].includes(k);
  };

  const isRevenueDependentBenchmarkMetric = (metricKey: string) => {
    const k = String(metricKey || '').toLowerCase();
    return ['roi', 'roas', 'totalrevenue', 'profit', 'profitmargin', 'revenueperlead'].includes(k);
  };

  const getLiveLinkedInMetricValue = (metricKey: string, linkedInCampaignName?: string): number => {
    const k = String(metricKey || '').toLowerCase();
    const hasRevenueTracking = !!aggregated?.hasRevenueTracking;
    const conversionValue = Number(aggregated?.conversionValue || 0);

    // Campaign-scoped metrics
    if (linkedInCampaignName) {
      const campaignMetrics = getCampaignSpecificMetrics(linkedInCampaignName);
      if (!campaignMetrics) return 0;
      // First try the exact key (handles camelCase like "videoViews", "totalRevenue", "profitMargin", etc.)
      const direct = (campaignMetrics as any)[metricKey as any];
      if (typeof direct === 'number') return direct;
      const base = (campaignMetrics as any)[k];
      if (typeof base === 'number') return base;

      // Compute revenue metrics for campaign scope when available
      if (hasRevenueTracking && conversionValue > 0) {
        const spend = Number((campaignMetrics as any).spend || 0);
        const conversions = Number((campaignMetrics as any).conversions || 0);
        const leads = Number((campaignMetrics as any).leads || 0);
        const revenue = conversions * conversionValue;
        const profit = revenue - spend;
        switch (k) {
          case 'totalrevenue': return revenue;
          case 'profit': return profit;
          case 'profitmargin': return revenue > 0 ? (profit / revenue) * 100 : 0;
          case 'roi': return spend > 0 ? (profit / spend) * 100 : 0;
          case 'roas': return spend > 0 ? revenue / spend : 0;
          case 'revenueperlead': return leads > 0 ? revenue / leads : 0;
        }
      }
      return 0;
    }

    // Aggregate metrics (Overview)
    switch (k) {
      case 'impressions': return Number(aggregated?.totalImpressions || 0);
      case 'reach': return Number(aggregated?.totalReach || 0);
      case 'clicks': return Number(aggregated?.totalClicks || 0);
      case 'engagements': return Number(aggregated?.totalEngagements || 0);
      case 'spend': return Number(aggregated?.totalSpend || 0);
      case 'conversions': return Number(aggregated?.totalConversions || 0);
      case 'leads': return Number(aggregated?.totalLeads || 0);
      case 'videoviews': return Number(aggregated?.totalVideoViews || 0);
      case 'viralimpressions': return Number(aggregated?.totalViralImpressions || 0);
      case 'ctr': return Number(aggregated?.ctr || 0);
      case 'cpc': return Number(aggregated?.cpc || 0);
      case 'cpm': return Number(aggregated?.cpm || 0);
      case 'cvr': return Number(aggregated?.cvr || 0);
      case 'cpa': return Number(aggregated?.cpa || 0);
      case 'cpl': return Number(aggregated?.cpl || 0);
      case 'er': return Number(aggregated?.er || 0);
      case 'roi': return Number(aggregated?.roi || 0);
      case 'roas': return Number(aggregated?.roas || 0);
      case 'totalrevenue': return Number(aggregated?.totalRevenue || 0);
      case 'profit': return Number(aggregated?.profit || 0);
      case 'profitmargin': return Number(aggregated?.profitMargin || 0);
      case 'revenueperlead': return Number(aggregated?.revenuePerLead || 0);
      default: return 0;
    }
  };

  const getLiveCurrentForKpi = (kpi: any): number => {
    // Canonical source-of-truth for KPI current values: use server-computed `currentValue` (refreshed on KPI fetch).
    // Fall back to local aggregates only if `currentValue` is missing.
    if (kpi && kpi.currentValue !== undefined && kpi.currentValue !== null) {
      const raw = String(kpi.currentValue);
      const n = parseFloat(stripNumeric(raw));
      if (Number.isFinite(n)) return n;
    }
    const metric = String(kpi?.metric || kpi?.metricKey || '').trim();
    if (!metric) return 0;
    // For KPI "specific", we store the LinkedIn campaign name in specificCampaignId (UI selector uses campaign name).
    const scopeName =
      String(kpi?.applyTo || '').toLowerCase() === 'specific' && kpi?.specificCampaignId
        ? String(kpi.specificCampaignId)
        : undefined;
    return getLiveLinkedInMetricValue(metric, scopeName);
  };

  const getLiveCurrentForBenchmark = (benchmark: any): number => {
    const ev = (benchmark as any)?.evaluation;
    if (ev && typeof ev === "object" && ev.currentValue !== undefined && ev.currentValue !== null) {
      const n = typeof ev.currentValue === "string" ? parseFloat(String(ev.currentValue)) : Number(ev.currentValue);
      return Number.isFinite(n) ? n : 0;
    }
    const metric = String(benchmark?.metric || '').trim();
    if (!metric) return 0;
    const scopeName = benchmark?.linkedInCampaignName ? String(benchmark.linkedInCampaignName) : undefined;
    return getLiveLinkedInMetricValue(metric, scopeName);
  };

  const computeBenchmarkProgress = (benchmark: any) => {
    // Prefer server-evaluated results (canonical source of truth).
    const ev = (benchmark as any)?.evaluation;
    if (ev && typeof ev === "object" && ev.status) {
      const status = String(ev.status);
      const ratio = Number(ev.ratio || 0) || 0;
      const pct = Number(ev.pct || 0) || 0;
      const deltaPct = Number(ev.deltaPct || 0) || 0;
      const color =
        status === "on_track"
          ? "bg-green-500"
          : status === "needs_attention"
            ? "bg-yellow-500"
            : status === "behind"
              ? "bg-red-500"
              : "bg-slate-300";
      return { status, ratio, pct, color, deltaPct };
    }

    const metricRaw = String((benchmark as any)?.metric || '');
    const metricKey = metricRaw.toLowerCase();
    const isBlocked = isRevenueDependentBenchmarkMetric(metricKey) && !aggregated?.hasRevenueTracking;
    if (isBlocked) return { status: 'blocked' as const, ratio: 0, pct: 0, color: 'bg-slate-300', deltaPct: 0 };

    const current = getLiveLinkedInMetricValue(metricRaw, (benchmark as any)?.linkedInCampaignName || undefined);
    const bench = parseFloat(stripNumeric(String((benchmark as any)?.benchmarkValue ?? (benchmark as any)?.targetValue ?? '0'))) || 0;
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeBench = Number.isFinite(bench) ? bench : 0;
    const lowerIsBetter = isLowerBetterBenchmarkMetric(metricKey);

    let ratio = 0;
    if (lowerIsBetter) ratio = safeCurrent > 0 ? (safeBench / safeCurrent) : 0;
    else ratio = safeBench > 0 ? (safeCurrent / safeBench) : 0;

    const pct = Math.max(0, Math.min(ratio * 100, 100));
    const status = ratio >= 0.9 ? 'on_track' : ratio >= 0.7 ? 'needs_attention' : 'behind';
    const color = ratio >= 0.9 ? 'bg-green-500' : ratio >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';
    const deltaPct =
      safeBench > 0
        ? (lowerIsBetter ? ((safeBench - safeCurrent) / safeBench) * 100 : ((safeCurrent - safeBench) / safeBench) * 100)
        : 0;

    return { status, ratio, pct, color, deltaPct };
  };

  const benchmarkTracker = useMemo(() => {
    // Single authoritative source for the Benchmarks tab: use `benchmarksData` only
    // (so the tracker counts can’t disagree with the rendered benchmark cards).
    const items = Array.isArray(benchmarksData) ? (benchmarksData as any[]) : [];
    let scored = 0;
    let onTrack = 0;
    let needsAttention = 0;
    let behind = 0;
    let blocked = 0;
    let sumPct = 0;

    for (const b of items) {
      const benchVal = parseFloat(stripNumeric(String((b as any)?.benchmarkValue ?? (b as any)?.targetValue ?? '0'))) || 0;
      if (!Number.isFinite(benchVal) || benchVal <= 0) continue;

      const p = computeBenchmarkProgress(b);
      if (p.status === 'blocked') {
        blocked += 1;
        continue;
      }
      scored += 1;
      sumPct += Number(p.pct || 0);
      if (p.status === 'on_track') onTrack += 1;
      else if (p.status === 'needs_attention') needsAttention += 1;
      else if (p.status === 'behind') behind += 1;
    }

    const avgPct = scored > 0 ? sumPct / scored : 0;
    return { total: items.length, scored, onTrack, needsAttention, behind, blocked, avgPct };
  }, [benchmarksData, aggregated, adsData]);

  type InsightItem = {
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    recommendation?: string;
    confidence?: "high" | "medium" | "low";
    evidence?: string[];
    group?: "integrity" | "performance";
    reliability?: "high" | "medium" | "low";
    explain?: {
      title?: string;
      lines: string[];
    };
    actions?: Array<{ label: string; kind: "go"; tab: "overview" | "kpis" | "benchmarks" | "ads" | "reports" | "insights" } | { label: string; kind: "openRevenueModal" }>;
  };

  const execWowThresholds = useMemo(() => {
    const t = (linkedInInsightsResp as any)?.thresholds || {};
    return {
      minClicks: Number(t?.minClicks ?? 100) || 100,
      minImpressions: Number(t?.minImpressions ?? 5000) || 5000,
      minConversions: Number(t?.minConversions ?? 20) || 20,
      cvrDropPct: Number(t?.cvrDropPct ?? 20) || 20,
      cpcSpikePct: Number(t?.cpcSpikePct ?? 20) || 20,
      erDecayPct: Number(t?.erDecayPct ?? 20) || 20,
      ctrStableBandPct: Number(t?.ctrStableBandPct ?? 5) || 5,
    };
  }, [linkedInInsightsResp]);

  const computeInsightReliability = (metricKey: string | null | undefined): "high" | "medium" | "low" => {
    const key = String(metricKey || "").toLowerCase();
    // IMPORTANT: This must not reference variables declared later in the component (TDZ risk).
    // Compute sample-size reliability directly from the persisted daily history payload.
    const rows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
    const byDate = rows
      .map((r: any) => ({
        date: String(r?.date || "").trim(),
        impressions: Number(r?.impressions || 0) || 0,
        clicks: Number(r?.clicks || 0) || 0,
        conversions: Number(r?.conversions || 0) || 0,
      }))
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    const availableDays = byDate.length;
    if (availableDays <= 0) return "low";

    // Prefer the prior-7d window for a conservative reliability estimate.
    // If we don't have 14+ days yet, fall back to the most recent 7 days.
    const slice = availableDays >= 14 ? byDate.slice(-14, -7) : byDate.slice(-7);
    const sums = slice.reduce(
      (acc: any, r: any) => {
        acc.impressions += r.impressions;
        acc.clicks += r.clicks;
        acc.conversions += r.conversions;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0 }
    );

    const clicks = Number(sums.clicks || 0) || 0;
    const impressions = Number(sums.impressions || 0) || 0;
    const conversions = Number(sums.conversions || 0) || 0;

    const hasCtrVolume = clicks >= execWowThresholds.minClicks && impressions >= execWowThresholds.minImpressions;
    const hasCvrVolume = clicks >= execWowThresholds.minClicks && conversions >= execWowThresholds.minConversions;

    // Revenue-derived signals hinge on conversion volume (and mapping quality).
    if (["cvr"].includes(key)) return hasCvrVolume ? "high" : clicks >= execWowThresholds.minClicks ? "medium" : "low";
    if (["roi", "roas", "revenue", "totalrevenue", "profit", "profitmargin", "revenueperlead"].includes(key)) {
      return hasCvrVolume ? "medium" : "low";
    }

    if (["ctr", "cpc", "clicks", "impressions", "spend", "cpm"].includes(key)) return hasCtrVolume ? "high" : clicks > 0 || impressions > 0 ? "medium" : "low";
    if (["engagements", "er", "likes", "comments", "shares"].includes(key)) return impressions >= execWowThresholds.minImpressions ? "high" : impressions > 0 ? "medium" : "low";
    if (["conversions", "leads"].includes(key)) return hasCvrVolume ? "high" : conversions > 0 ? "medium" : "low";

    // Default: rely on existence of any daily history.
    return availableDays >= 14 ? "medium" : "low";
  };

  const linkedInInsights = useMemo<InsightItem[]>(() => {
    const out: InsightItem[] = [];
    const a: any = aggregated || {};
    const buildTabUrl = (tab: string) => {
      const sid = sessionId ? `&session=${encodeURIComponent(String(sessionId))}` : "";
      return `/campaigns/${encodeURIComponent(String(campaignId || ""))}/linkedin-analytics?tab=${encodeURIComponent(String(tab))}${sid}`;
    };

    const hasRevenueTracking = a?.hasRevenueTracking === 1 || a?.hasRevenueTracking === true;
    const spend = Number(a?.totalSpend || 0) || 0;
    const conversions = Number(a?.totalConversions || 0) || 0;
    const revenue = Number(a?.totalRevenue || 0) || 0;
    const roas = Number(a?.roas || 0) || 0;
    const roi = Number(a?.roi || 0) || 0;
    const conversionValue = Number(a?.conversionValue || 0) || 0;

    const dailyRows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
    const daily = new Map<string, { impressions: number; clicks: number; conversions: number; spend: number; engagements: number }>();
    for (const r of dailyRows) {
      const d = String((r as any)?.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      daily.set(d, {
        impressions: Number((r as any)?.impressions || 0) || 0,
        clicks: Number((r as any)?.clicks || 0) || 0,
        conversions: Number((r as any)?.conversions || 0) || 0,
        spend: Number((r as any)?.spend || 0) || 0,
        engagements: Number((r as any)?.engagements || 0) || 0,
      });
    }
    const dates = Array.from(daily.keys()).sort();

    // 0) Data integrity checks (enterprise-grade: distinguish "missing config" from true zeros)
    if (spend > 0 && !hasRevenueTracking) {
      out.push({
        id: "financial:revenue_missing",
        severity: "high",
        title: "Revenue is not connected",
        description: "Spend exists, but revenue tracking is not configured for this LinkedIn campaign, so ROI/ROAS and revenue-based KPIs/Benchmarks are blocked.",
        confidence: "high",
        group: "integrity",
        reliability: "high",
        evidence: [`Spend: ${formatCurrency(spend)}`, "Revenue tracking: Not connected"],
        recommendation: "Connect Total Revenue or Conversion Value for this campaign to unlock ROI/ROAS and revenue-based metrics.",
        explain: {
          title: "How this was determined",
          lines: [
            "Spend is imported from LinkedIn and is > $0.",
            "Revenue tracking is not connected for this campaign, so revenue-based metrics would be misleading.",
          ],
        },
        actions: [{ label: "Add revenue", kind: "openRevenueModal" }, { label: "Open KPIs", kind: "go", tab: "kpis" }],
      });
    }

    if (hasRevenueTracking && spend > 0 && revenue <= 0) {
      out.push({
        id: "financial:spend_no_revenue",
        severity: "high",
        title: "Spend recorded, but revenue is $0",
        description: `Spend is ${formatCurrency(spend)}, but Total Revenue is ${formatCurrency(0)}. This can indicate missing/incorrect conversion value mapping or zero conversions.`,
        confidence: conversions > 0 ? "high" : "medium",
        group: "integrity",
        reliability: "medium",
        evidence: [
          `Spend: ${formatCurrency(spend)}`,
          `Conversions: ${formatNumber(conversions, "conversions")}`,
          `Conversion value: ${formatCurrency(conversionValue)}`,
        ],
        recommendation: conversions > 0
          ? "Conversions exist, but revenue is $0. Verify the connected revenue mapping (Conversion Value / Total Revenue) and ensure the source is active."
          : "If conversions are truly 0, revenue will be $0. If conversions exist, verify the connected revenue mapping and ensure the source is active.",
        explain: {
          title: "How this was determined",
          lines: [
            "Revenue is computed from your connected conversion value / revenue source.",
            "If conversions exist but revenue is $0, the mapping is likely missing or incorrect.",
          ],
        },
        actions: [{ label: "Review revenue setup", kind: "openRevenueModal" }, { label: "Open Overview", kind: "go", tab: "overview" }],
      });
    }

    if (hasRevenueTracking && spend <= 0 && revenue > 0) {
      out.push({
        id: "financial:revenue_no_spend",
        severity: "medium",
        title: "Revenue exists, but spend is $0",
        description: `Total Revenue is ${formatCurrency(revenue)}, but Spend is ${formatCurrency(0)}. ROI/ROAS may be misleading until spend exists.`,
        confidence: "medium",
        group: "integrity",
        reliability: "low",
        evidence: [`Revenue: ${formatCurrency(revenue)}`, `Spend: ${formatCurrency(0)}`],
        recommendation: "Verify spend is being imported for the same LinkedIn campaigns and time window. If spend is truly $0, treat ROI/ROAS carefully.",
        explain: {
          title: "How this was determined",
          lines: [
            "ROI/ROAS depend on both revenue and spend being present for the same time window.",
            "With spend at $0, ratio metrics can be misleading.",
          ],
        },
        actions: [{ label: "Open Ad Comparison", kind: "go", tab: "ads" }],
      });
    }

    if (hasRevenueTracking && spend > 0 && revenue > 0) {
      if (Number.isFinite(roi) && roi < 0) {
        out.push({
          id: "financial:negative_roi",
          severity: roi <= -20 ? "high" : "medium",
          title: "ROI is negative",
          description: `ROI is ${formatPercentage(roi)} for the current imported totals.`,
          confidence: "medium",
          group: "performance",
          reliability: computeInsightReliability("roi"),
          evidence: [`ROI: ${formatPercentage(roi)}`, `Spend: ${formatCurrency(spend)}`, `Revenue: ${formatCurrency(revenue)}`],
          recommendation: "Validate conversion value assumptions and attribution, then review ad efficiency (CTR/CVR) and spend allocation.",
          explain: {
            title: "Calculation",
            lines: [
              "ROI = ((Revenue - Spend) ÷ Spend) × 100",
              `Revenue: ${formatCurrency(revenue)}; Spend: ${formatCurrency(spend)}.`,
            ],
          },
          actions: [{ label: "Open Ad Comparison", kind: "go", tab: "ads" }, { label: "Open Trends", kind: "go", tab: "insights" }],
        });
      }
      if (Number.isFinite(roas) && roas > 0 && roas < 1) {
        out.push({
          id: "financial:roas_below_1",
          severity: "medium",
          title: "ROAS is below 1.0x",
          description: `ROAS is ${roas.toFixed(2)}x for the current imported totals.`,
          confidence: "medium",
          group: "performance",
          reliability: computeInsightReliability("roas"),
          evidence: [`ROAS: ${roas.toFixed(2)}x`, `Spend: ${formatCurrency(spend)}`, `Revenue: ${formatCurrency(revenue)}`],
          recommendation: "Audit which ads/campaigns are inefficient, then validate conversion value assumptions and funnel drop-offs.",
          explain: {
            title: "Calculation",
            lines: [
              "ROAS = Revenue ÷ Spend",
              `Revenue: ${formatCurrency(revenue)}; Spend: ${formatCurrency(spend)}.`,
            ],
          },
          actions: [{ label: "Open Ad Comparison", kind: "go", tab: "ads" }],
        });
      }
    }

    // 1) Blocked KPI/Benchmarks (revenue-dependent)
    const blockedKpis = (Array.isArray(kpisData) ? (kpisData as any[]) : [])
      .filter((k: any) => isRevenueDependentBenchmarkMetric(String(k?.metric || k?.metricKey || "")) && !hasRevenueTracking);
    for (const k of blockedKpis) {
      const name = String(k?.name || k?.metric || "KPI");
      out.push({
        id: `integrity:kpi_blocked:${String(k?.id || name)}`,
        severity: "high",
        title: `KPI paused: missing Revenue`,
        description: `"${name}" depends on Revenue, but Revenue is not connected for this campaign. Showing 0 would be misleading, so this KPI is effectively blocked until Revenue is restored.`,
        confidence: "high",
        group: "integrity",
        reliability: "high",
        evidence: [`KPI: ${name}`, "Revenue tracking: Not connected"],
        recommendation: "Connect Revenue, then return to KPIs (values will refresh automatically).",
        explain: {
          title: "Why this is blocked",
          lines: [
            "This KPI uses a revenue-dependent metric.",
            "Revenue tracking is not connected, so the KPI cannot be computed reliably.",
          ],
        },
        actions: [{ label: "Add revenue", kind: "openRevenueModal" }, { label: "Open KPIs", kind: "go", tab: "kpis" }],
      });
    }

    const blockedBenchmarks = (Array.isArray(benchmarksData) ? (benchmarksData as any[]) : [])
      .filter((b: any) => isRevenueDependentBenchmarkMetric(String(b?.metric || "")) && !hasRevenueTracking);
    for (const b of blockedBenchmarks) {
      const name = String(b?.name || b?.metric || "Benchmark");
      out.push({
        id: `integrity:bench_blocked:${String(b?.id || name)}`,
        severity: "high",
        title: `Benchmark paused: missing Revenue`,
        description: `"${name}" depends on Revenue, but Revenue is not connected for this campaign. Restore Revenue to resume accurate benchmark tracking.`,
        confidence: "high",
        group: "integrity",
        reliability: "high",
        evidence: [`Benchmark: ${name}`, "Revenue tracking: Not connected"],
        recommendation: "Connect Revenue, then return to Benchmarks (values will refresh automatically).",
        explain: {
          title: "Why this is blocked",
          lines: [
            "This Benchmark uses a revenue-dependent metric.",
            "Revenue tracking is not connected, so the Benchmark cannot be computed reliably.",
          ],
        },
        actions: [{ label: "Add revenue", kind: "openRevenueModal" }, { label: "Open Benchmarks", kind: "go", tab: "benchmarks" }],
      });
    }

    // 2) Actionable insights from KPI performance (below target / near target)
    const NEAR_TARGET_BAND_PCT = 5;
    for (const k of Array.isArray(kpisData) ? (kpisData as any[]) : []) {
      const metricKey = String(k?.metric || k?.metricKey || "");
      if (isRevenueDependentBenchmarkMetric(metricKey) && !hasRevenueTracking) continue;

      const current = getLiveCurrentForKpi(k);
      const target = parseFloat(String(k?.targetValue || "0"));
      const lowerIsBetter = isLowerIsBetterKpi({ metric: k?.metric || k?.metricKey, name: k?.name });
      const effectiveDeltaPct = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
      if (effectiveDeltaPct === null) continue;

      const band = classifyKpiBand({ effectiveDeltaPct, nearTargetBandPct: NEAR_TARGET_BAND_PCT });
      if (band === "above") continue;

      out.push({
        id: `kpi:${String(k?.id || metricKey)}`,
        severity: band === "below" ? "high" : "medium",
        title: `${String(k?.name || metricKey)} is ${band === "below" ? "Below target" : "Near target"}`,
        description: `Current ${formatMetricValueForInput(metricKey, current)} vs target ${formatMetricValueForInput(metricKey, target)}.`,
        confidence: "high",
        group: "performance",
        reliability: computeInsightReliability(metricKey),
        evidence: [`Current: ${formatMetricValueForInput(metricKey, current)}`, `Target: ${formatMetricValueForInput(metricKey, target)}`],
        recommendation: "Identify the main drivers (creative relevance, audience quality, landing page) and use Ad Comparison to find the biggest contributors.",
        explain: {
          title: "How this was evaluated",
          lines: [
            "This compares the KPI current value to the target value.",
            "Status is based on the percent delta vs target, with special handling for metrics where lower is better.",
          ],
        },
        actions: [{ label: "Open KPIs", kind: "go", tab: "kpis" }, { label: "Open Ad Comparison", kind: "go", tab: "ads" }],
      });
    }

    // 3) Actionable insights from Benchmark performance (behind / needs attention)
    for (const b of Array.isArray(benchmarksData) ? (benchmarksData as any[]) : []) {
      const p = computeBenchmarkProgress(b);
      if (p.status !== "behind" && p.status !== "needs_attention") continue;
      out.push({
        id: `bench:${String((b as any)?.id || (b as any)?.metric || (b as any)?.name || "bench")}`,
        severity: p.status === "behind" ? "high" : "medium",
        title: `${String((b as any)?.name || (b as any)?.metric || "Benchmark")} is ${p.status === "behind" ? "Behind benchmark" : "Below benchmark"}`,
        description: `Current ${formatMetricValueForInput(String((b as any)?.metric || ""), getLiveCurrentForBenchmark(b))} vs benchmark ${String((b as any)?.benchmarkValue || (b as any)?.targetValue || "0")}.`,
        confidence: "high",
        group: "performance",
        reliability: computeInsightReliability(String((b as any)?.metric || "")),
        evidence: [`Metric: ${String((b as any)?.metric || "")}`, `Status: ${String(p.status)}`],
        recommendation: "Use Ad Comparison to identify what’s dragging performance, then iterate targeting/creative/landing page.",
        explain: {
          title: "How this was evaluated",
          lines: [
            "This compares the current metric value to the benchmark value.",
            "Status is based on how far current performance is from the benchmark, using the same rules as the Benchmarks tab.",
          ],
        },
        actions: [{ label: "Open Benchmarks", kind: "go", tab: "benchmarks" }, { label: "Open Ad Comparison", kind: "go", tab: "ads" }],
      });
    }

    // 4) Anomaly detection (server-side; UI renders server-provided signals for consistency)
    const serverSignals = Array.isArray((linkedInInsightsResp as any)?.signals) ? (linkedInInsightsResp as any).signals : [];
    for (const s of serverSignals) {
      if (!s || !s.id) continue;
      const normalized: InsightItem = {
        id: String(s.id),
        severity: (s as any).severity || "low",
        title: String((s as any).title || "Insight"),
        description: String((s as any).description || ""),
        recommendation: (s as any).recommendation,
        confidence: (s as any).confidence,
        evidence: Array.isArray((s as any).evidence) ? (s as any).evidence : [],
        actions: Array.isArray((s as any).actions) ? (s as any).actions : undefined,
        group: "performance",
        reliability: (() => {
          const id = String((s as any)?.id || "");
          if (id.includes("cvr")) return computeInsightReliability("cvr");
          if (id.includes("cpc")) return computeInsightReliability("cpc");
          if (id.includes("engagement")) return computeInsightReliability("er");
          return computeInsightReliability("ctr");
        })(),
        explain: {
          title: "How this was computed",
          lines: [
            "Signals are computed week-over-week from persisted daily history.",
            "Comparison: last 7 complete UTC days vs prior 7 complete UTC days.",
            "Δ% = ((current - prior) ÷ prior) × 100",
          ],
        },
      };
      out.push(normalized);
    }

    // Stable ordering: high -> medium -> low
    const order = { high: 0, medium: 1, low: 2 } as const;
    out.sort((x, y) => order[x.severity] - order[y.severity]);
    return out;
  }, [aggregated, kpisData, benchmarksData, linkedInDailyResp, linkedInInsightsResp]);

  const linkedInInsightsRollups = useMemo(() => {
    const a: any = aggregated || {};
    const hasRevenueTracking = a?.hasRevenueTracking === 1 || a?.hasRevenueTracking === true;
    const conversionValue = Number(a?.conversionValue || 0) || 0;

    const rows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
    const byDate = rows
      .map((r: any) => ({
        date: String(r?.date || "").trim(),
        impressions: Number(r?.impressions || 0) || 0,
        clicks: Number(r?.clicks || 0) || 0,
        conversions: Number(r?.conversions || 0) || 0,
        spend: Number(r?.spend || 0) || 0,
      }))
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((x: any, y: any) => String(x.date).localeCompare(String(y.date)));

    const dates = byDate.map((r: any) => r.date);
    const rollup = (n: number, offsetFromEnd: number = 0) => {
      const endIdxExclusive = Math.max(0, dates.length - offsetFromEnd);
      const startIdx = Math.max(0, endIdxExclusive - n);
      const slice = byDate.slice(startIdx, endIdxExclusive);
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
      const cvr = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
      const revenue = hasRevenueTracking && conversionValue > 0 ? sums.conversions * conversionValue : 0;
      const roas = sums.spend > 0 ? revenue / sums.spend : 0;
      const startDate = slice[0]?.date || null;
      const endDate = slice[slice.length - 1]?.date || null;
      return { ...sums, ctr, cvr, revenue, roas, startDate, endDate, days: slice.length };
    };

    const last7 = rollup(7, 0);
    const prior7 = rollup(7, 7);
    const last30 = rollup(30, 0);
    const prior30 = rollup(30, 30);

    const deltaPct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return {
      availableDays: dates.length,
      hasRevenueTracking,
      last7,
      prior7,
      last30,
      prior30,
      deltas: {
        impressions7: deltaPct(last7.impressions, prior7.impressions),
        clicks7: deltaPct(last7.clicks, prior7.clicks),
        conversions7: deltaPct(last7.conversions, prior7.conversions),
        spend7: deltaPct(last7.spend, prior7.spend),
        ctr7: prior7.ctr > 0 ? ((last7.ctr - prior7.ctr) / prior7.ctr) * 100 : 0,
        cvr7: prior7.cvr > 0 ? ((last7.cvr - prior7.cvr) / prior7.cvr) * 100 : 0,
        revenue7: deltaPct(last7.revenue, prior7.revenue),
        roas7: prior7.roas > 0 ? ((last7.roas - prior7.roas) / prior7.roas) * 100 : 0,
        impressions30: deltaPct(last30.impressions, prior30.impressions),
        clicks30: deltaPct(last30.clicks, prior30.clicks),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        spend30: deltaPct(last30.spend, prior30.spend),
        ctr30: prior30.ctr > 0 ? ((last30.ctr - prior30.ctr) / prior30.ctr) * 100 : 0,
        cvr30: prior30.cvr > 0 ? ((last30.cvr - prior30.cvr) / prior30.cvr) * 100 : 0,
        revenue30: deltaPct(last30.revenue, prior30.revenue),
        roas30: prior30.roas > 0 ? ((last30.roas - prior30.roas) / prior30.roas) * 100 : 0,
      },
    };
  }, [aggregated, linkedInDailyResp]);

  const linkedInDailySeries = useMemo(() => {
    const a: any = aggregated || {};
    const hasRevenueTracking = a?.hasRevenueTracking === 1 || a?.hasRevenueTracking === true;
    const conversionValue = Number(a?.conversionValue || 0) || 0;

    const rows = Array.isArray((linkedInDailyResp as any)?.data) ? (linkedInDailyResp as any).data : [];
    const byDate = rows
      .map((r: any) => {
        const date = String(r?.date || "").trim();
        const impressions = Number(r?.impressions || 0) || 0;
        const clicks = Number(r?.clicks || 0) || 0;
        const conversions = Number(r?.conversions || 0) || 0;
        const spend = Number(r?.spend || 0) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
        const revenue = hasRevenueTracking && conversionValue > 0 ? conversions * conversionValue : 0;
        const roas = spend > 0 ? revenue / spend : 0;
        return { date, impressions, clicks, conversions, spend, ctr, cvr, revenue, roas };
      })
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((x: any, y: any) => String(x.date).localeCompare(String(y.date)));

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
            acc.revenue += r.revenue;
            return acc;
          },
          { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
        );
        const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
        const cvr = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
        const roas = sums.spend > 0 ? sums.revenue / sums.spend : 0;
        out.push({
          date: byDate[i].date,
          impressions: sums.impressions,
          clicks: sums.clicks,
          conversions: sums.conversions,
          spend: sums.spend,
          ctr,
          cvr,
          revenue: sums.revenue,
          roas,
        });
      }
      return out;
    };

    return {
      daily: byDate,
      rolling7: rolling(7),
      rolling30: rolling(30),
      hasRevenueTracking,
    };
  }, [aggregated, linkedInDailyResp]);

  const formatShortYearIsoDate = (yyyyMmDd: string) => {
    const s = String(yyyyMmDd || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    const yy = m[1].slice(-2);
    return `'${yy}-${m[2]}-${m[3]}`;
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Extract campaign and session data
  const campaign = campaignData as any;
  const coverageTotals = ((linkedInCoverageResp as any)?.totals || null) as any;
  const coverageAvailableDays = Number((linkedInCoverageResp as any)?.availableDays || 0) || 0;
  // IMPORTANT: On a brand-new campaign, daily facts may be empty even though the initial import session has totals.
  // Only switch Overview to daily-facts totals once we actually have daily history.
  const useDailyTotalsForOverview = coverageAvailableDays > 0;

  return (
    <LinkedInErrorBoundary>
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        
        <div className="flex">
          <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation(`/campaigns/${encodeURIComponent(String(campaignId || ""))}`)}
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <SiLinkedin className="w-6 h-6 text-blue-600" />
                    LinkedIn Analytics
                  </h1>
                  {session ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {session.adAccountName} • {session.selectedCampaignsCount} campaigns
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Campaign analytics and performance tracking
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!campaignId || runLinkedInRefreshMutation.isPending}
                  onClick={() => runLinkedInRefreshMutation.mutate()}
                  className="border-slate-300 dark:border-slate-700"
                  data-testid="button-run-linkedin-refresh"
                >
                  {runLinkedInRefreshMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Run refresh
                </Button>
              </div>
            </div>

            {/* Data coverage (canonical; shared across tabs) */}
            {campaignId ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                {(() => {
                  const dataThrough = String((linkedInCoverageResp as any)?.dataThroughUtc || "").trim() || "—";
                  const availableDays = Number((linkedInCoverageResp as any)?.availableDays || 0) || 0;
                  const latestImportAtRaw = (linkedInCoverageResp as any)?.latestImportAt;
                  const lastRefreshAtRaw = (linkedInCoverageResp as any)?.lastRefreshAt;
                  const latestImportText = latestImportAtRaw ? new Date(latestImportAtRaw).toLocaleString() : "—";
                  const lastRefreshText = lastRefreshAtRaw ? new Date(lastRefreshAtRaw).toLocaleString() : "—";
                  const coverageErrorText = (linkedInCoverageError as any)?.message || "Failed to load coverage.";

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Data through:</span>{" "}
                            {dataThrough !== "—" ? `${dataThrough} (UTC)` : "—"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Available days:</span>{" "}
                            {linkedInCoverageLoading ? "Loading…" : availableDays}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Latest import:</span>{" "}
                            {linkedInCoverageLoading ? "Loading…" : latestImportText}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Last refresh:</span>{" "}
                            {linkedInCoverageLoading ? "Loading…" : lastRefreshText}
                          </div>
                        </div>

                        {linkedInCoverageIsError ? (
                          <Button
                            variant="outline"
                            onClick={() => void refetchLinkedInCoverage()}
                            className="h-7 px-2 text-xs"
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>

                      {linkedInCoverageIsError ? (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{coverageErrorText}</div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : null}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="ads" data-testid="tab-ads">Ad Comparison</TabsTrigger>
                <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
                {sessionLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    </div>
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : sessionIsError ? (
                  <LinkedInTabErrorState
                    title="Overview"
                    description="LinkedIn campaign overview"
                    message={(sessionError as any)?.message || "Failed to load LinkedIn overview."}
                    onRetry={() => void refetchSessionData()}
                  />
                ) : sessionData && aggregated ? (
                  <>
                    {/* Conversion Value Missing Notification - Show when NO conversion values are available */}
                    {(() => {
                      // SINGLE SOURCE OF TRUTH: Only check the backend's hasRevenueTracking flag
                      // The backend (routes.ts) sets hasRevenueTracking = 0 when no active Google Sheets with mappings exist
                      // This prevents race conditions and flickering caused by checking multiple data sources
                      const hasRevenueTracking = aggregated?.hasRevenueTracking === 1;
                      const shouldShowWarning = !hasRevenueTracking;
                      
                      devLog('[LinkedIn Analytics] 🚨 Notification check:', {
                        hasRevenueTracking,
                        hasRevenueTrackingValue: aggregated?.hasRevenueTracking,
                        shouldShowWarning,
                        conversionValue: aggregated?.conversionValue
                      });
                      
                      return shouldShowWarning;
                    })() && (
                      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                              Revenue metrics are locked
                            </h3>
                            <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                              LinkedIn doesn’t include revenue data. Connect a revenue source (Google Sheets, CRM, custom integration) to calculate conversion value and unlock ROI/ROAS, revenue, and profit — or connect general datasets to view.
                            </p>
                            <button
                              onClick={() => openAddRevenueModal('add')}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-md transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Add revenue/conversion value
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Core Metrics Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Core Metrics</h3>
                      </div>
                      
                      {/* LinkedIn Metrics Grid - 3 columns - Core Metrics Only */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(aggregated)
                        .filter(([key]) => {
                          // Only show core metrics, exclude derived metrics and revenue tracking flag
                          const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas', 'hasrevenuetracking', 'conversionvalue', 'totalrevenue', 'profit', 'profitmargin', 'revenueperlead'];
                          const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                          
                          // Filter out derived metrics and revenue metrics
                          if (derivedMetrics.includes(metricKey)) return false;
                          
                          // Filter based on selected metrics from the session (case-insensitive)
                          const selectedMetricKeys = session?.selectedMetricKeys || [];
                          if (selectedMetricKeys.length > 0) {
                            const selectedMetricKeysLower = selectedMetricKeys.map((k: string) => k.toLowerCase());
                            return selectedMetricKeysLower.includes(metricKey);
                          }
                          
                          return true;
                        })
                        .map(([key, value]: [string, any]) => {
                          const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                          // For "Spend to date" simulation and production consistency, prefer daily-facts totals when available.
                          const displayValue = useDailyTotalsForOverview && coverageTotals && Object.prototype.hasOwnProperty.call(coverageTotals, metricKey)
                            ? (coverageTotals as any)[metricKey]
                            : value;
                          const { icon: Icon, format, label } = getMetricDisplay(metricKey, value);
                          
                          return (
                            <Card key={key} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    {label}
                                  </h3>
                                  <Icon className="w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {format(displayValue)}
                                </p>
                                {/* Show badge for raw metrics if benchmark exists (global only) */}
                                {(() => {
                                  const benchmark = getBenchmarkForMetric(metricKey);
                                  if (benchmark && !benchmark.linkedInCampaignName) {
                                    // Determine if higher or lower is better for this metric
                                    const higherBetterMetrics = ['impressions', 'clicks', 'conversions', 'leads', 'engagements', 'reach'];
                                    const metricType = higherBetterMetrics.includes(metricKey) ? 'higher-better' : 'lower-better';
                                    return renderPerformanceBadge(metricKey, displayValue, metricType);
                                  }
                                  return null;
                                })()}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Derived Metrics with Performance Indicators */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Derived Metrics</h3>
                      </div>
                      {(() => {
                        const d = useDailyTotalsForOverview ? (coverageTotals || {}) : {};
                        const derived = {
                          ctr: d.ctr ?? aggregated.ctr,
                          cpc: d.cpc ?? aggregated.cpc,
                          cpm: d.cpm ?? aggregated.cpm,
                          cvr: d.cvr ?? aggregated.cvr,
                          cpa: d.cpa ?? aggregated.cpa,
                          cpl: d.cpl ?? aggregated.cpl,
                          er: d.er ?? aggregated.er,
                        } as any;
                        return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* CTR */}
                        {derived.ctr !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CTR (Click-Through Rate)
                                </h3>
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(derived.ctr)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const ctrBenchmark = getBenchmarkForMetric('ctr');
                                if (ctrBenchmark && !ctrBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('ctr', derived.ctr, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPC */}
                        {derived.cpc !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPC (Cost Per Click)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(derived.cpc)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cpcBenchmark = getBenchmarkForMetric('cpc');
                                if (cpcBenchmark && !cpcBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpc', derived.cpc, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPM */}
                        {derived.cpm !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPM (Cost Per Mille)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(derived.cpm)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cpmBenchmark = getBenchmarkForMetric('cpm');
                                if (cpmBenchmark && !cpmBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpm', derived.cpm, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CVR */}
                        {derived.cvr !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CVR (Conversion Rate)
                                </h3>
                                <Target className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(derived.cvr)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cvrBenchmark = getBenchmarkForMetric('cvr');
                                if (cvrBenchmark && !cvrBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cvr', derived.cvr, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPA */}
                        {derived.cpa !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPA (Cost Per Acquisition)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(derived.cpa)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns, not campaign-specific */}
                              {(() => {
                                const cpaBenchmark = getBenchmarkForMetric('cpa');
                                if (cpaBenchmark && !cpaBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpa', derived.cpa, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPL */}
                        {derived.cpl !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPL (Cost Per Lead)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(derived.cpl)}
                              </p>
                              {renderPerformanceBadge('cpl', derived.cpl, 'lower-better')}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* ER */}
                        {derived.er !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  ER (Engagement Rate)
                                </h3>
                                <Activity className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(derived.er)}
                              </p>
                              {renderPerformanceBadge('er', derived.er, 'higher-better')}
                            </CardContent>
                          </Card>
                        )}
                    </div>
                        );
                      })()}

                      {/* Pipeline Proxy (optional, exec daily signal) */}
                      {hubspotPipelineProxyData?.success && hubspotPipelineProxyData?.pipelineEnabled === true && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="w-5 h-5 text-amber-600" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pipeline (Proxy)</h3>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Early signal
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <Card className="hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                      Pipeline created (to date)
                                    </h3>
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="inline-flex items-center">
                                          <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm">
                                        <div className="space-y-2 text-sm">
                                          <p className="font-medium">What this means</p>
                                          <p className="text-xs text-slate-400">
                                            Cumulative sum of HubSpot deal Amounts for deals that entered the selected stage (pipeline proxy).
                                            This is a proxy signal (not Closed Won revenue).
                                          </p>
                                          {hubspotPipelineProxyData?.pipelineStageLabel ? (
                                            <p className="text-xs text-slate-400">Stage: {String(hubspotPipelineProxyData.pipelineStageLabel)}</p>
                                          ) : null}
                                        </div>
                                      </TooltipContent>
                                    </UITooltip>
                                  </div>
                                  <Target className="w-4 h-4 text-amber-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                                    {formatCurrency(Number(hubspotPipelineProxyData?.totalToDate || 0))}
                                  </p>
                                  {!!hubspotPipelineProxyData?.pipelineStageLabel && (
                                    <Badge variant="outline" className="text-xs">
                                      {String(hubspotPipelineProxyData.pipelineStageLabel)}
                                    </Badge>
                                  )}
                                </div>
                                {!!hubspotPipelineProxyData?.lastUpdatedAt && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Updated: {String(hubspotPipelineProxyData.lastUpdatedAt)}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      )}

                      {/* Revenue Metrics - Only shown if conversion value is set - Displayed under Derived Metrics */}
                      {(() => {
                        // SINGLE SOURCE OF TRUTH: Only check the backend's hasRevenueTracking flag
                        // The backend sets hasRevenueTracking = 1 only when conversion values are available
                        // This prevents race conditions and flickering caused by checking multiple data sources
                        const hasRevenueTracking = aggregated?.hasRevenueTracking === 1;
                        
                        devLog('[LinkedIn Analytics] 💰 Revenue Metrics check:', {
                          hasRevenueTracking,
                          hasRevenueTrackingValue: aggregated?.hasRevenueTracking,
                          shouldShowRevenueMetrics: hasRevenueTracking,
                          conversionValue: aggregated?.conversionValue
                        });
                        
                        return hasRevenueTracking;
                      })() && (
                        <>
                          {/* Revenue Metrics Header */}
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-3">
                          <DollarSign className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Metrics</h3>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            💰 Revenue Tracking Enabled
                          </Badge>
                        </div>
                          </div>
                          
                          {/* Revenue Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Total Revenue (Revenue source controls live here) */}
                          <Card className="hover:shadow-md transition-shadow border-green-200 dark:border-green-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Total Revenue
                                  </h3>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="inline-flex items-center">
                                        <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <div className="space-y-2 text-sm">
                                        <p className="font-medium">Calculation</p>
                                        {Number(aggregated.conversionValue || 0) > 0 ? (
                                          <>
                                            <p>Revenue = Conversions × Conversion Value</p>
                                            {aggregated.conversions && aggregated.conversionValue && (
                                              <p className="text-xs text-slate-400">
                                                {aggregated.conversions.toLocaleString()} conversions × {formatCurrency(parseFloat(aggregated.conversionValue))} = {formatCurrency(aggregated.totalRevenue || 0)}
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <p>Revenue = imported revenue-to-date</p>
                                            <p className="text-xs text-slate-400">
                                              {formatCurrency(aggregated.totalRevenue || 0)} from the connected revenue source
                                            </p>
                                          </>
                                        )}
                                        {linkedInRevenueSourceLabel && (
                                          <p className="text-xs text-slate-400 mt-2">
                                            Source: {linkedInRevenueSourceLabel}
                                          </p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </UITooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                    onClick={() => openAddRevenueModal('edit')}
                                    data-testid="button-edit-linkedin-revenue-source"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        data-testid="button-delete-linkedin-revenue-source"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove revenue source?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will disable revenue tracking for LinkedIn (Conversion Value, Revenue, ROI, ROAS, Profit, etc.) and immediately recalculate dependent metrics.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteLinkedInRevenueSourceMutation.mutate()}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                  {formatCurrency(aggregated.totalRevenue || 0)}
                                </p>
                                {!!linkedInRevenueSourceLabel && (
                                  <Badge variant="outline" className="text-xs">
                                    {linkedInRevenueSourceLabel}
                                  </Badge>
                                )}
                              </div>
                              {Number(aggregated.conversionValue || 0) > 0 && aggregated.conversions && aggregated.conversionValue && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {aggregated.conversions.toLocaleString()} conversions × {formatCurrency(parseFloat(aggregated.conversionValue))}
                                </p>
                              )}
                            </CardContent>
                          </Card>

                          {/* Conversion Value (derived from the revenue source mappings) */}
                          <Card className="hover:shadow-md transition-shadow border-green-200 dark:border-green-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Conversion Value
                                  </h3>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="inline-flex items-center">
                                        <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <div className="space-y-2 text-sm">
                                        <p className="font-medium">Conversion Value</p>
                                        {Number(aggregated.conversionValue || 0) > 0 ? (
                                          <p className="text-xs text-slate-400">
                                            {formatCurrency(parseFloat(aggregated.conversionValue || 0))} per conversion
                                          </p>
                                        ) : (
                                          <p className="text-xs text-slate-400">
                                            Not provided (only shown when explicitly set)
                                          </p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </UITooltip>
                                </div>
                                <Calculator className="w-4 h-4 text-green-600" />
                              </div>
                              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                {Number(aggregated.conversionValue || 0) > 0 ? formatCurrency(aggregated.conversionValue || 0) : '—'}
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* ROAS */}
                          <Card className="hover:shadow-md transition-shadow border-blue-200 dark:border-blue-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  ROAS
                                </h3>
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                              </div>
                              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {(aggregated.roas || 0).toFixed(2)}x
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* ROI */}
                          <Card className="hover:shadow-md transition-shadow border-purple-200 dark:border-purple-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  ROI
                                </h3>
                                <Percent className="w-4 h-4 text-purple-600" />
                              </div>
                              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                {(aggregated.roi || 0).toFixed(1)}%
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* Profit */}
                          <Card className={`hover:shadow-md transition-shadow ${
                            (aggregated.profit || 0) >= 0 
                              ? 'border-green-200 dark:border-green-800' 
                              : 'border-red-200 dark:border-red-800'
                          }`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  Profit
                                </h3>
                                {(aggregated.profit || 0) >= 0 ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                              <p className={`text-2xl font-bold ${
                                (aggregated.profit || 0) >= 0 
                                  ? 'text-green-700 dark:text-green-400' 
                                  : 'text-red-700 dark:text-red-400'
                              }`}>
                                {formatCurrency(aggregated.profit || 0)}
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* Profit Margin */}
                          <Card className="hover:shadow-md transition-shadow border-indigo-200 dark:border-indigo-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  Profit Margin
                                </h3>
                                <Percent className="w-4 h-4 text-indigo-600" />
                              </div>
                              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                {(aggregated.profitMargin || 0).toFixed(1)}%
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* Revenue Per Lead */}
                          <Card className="hover:shadow-md transition-shadow border-teal-200 dark:border-teal-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  Revenue Per Lead
                                </h3>
                                <DollarSign className="w-4 h-4 text-teal-600" />
                              </div>
                              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                                {formatCurrency(aggregated.revenuePerLead || 0)}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                        </>
                    )}
                    </div>

                    {/* Campaign Breakdown */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Campaign Breakdown</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Comprehensive metrics by individual campaigns
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="font-medium">Note:</span> Overview derived metrics (CPC/CTR/CPA/CVR/CPM/ER) are <span className="font-medium">blended</span> across all imported campaigns
                            (weighted by the underlying denominators), so they will not equal the simple average of per-campaign rates.
                          </p>
                        </div>
                      </div>

                      {/* Sort and Filter Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Sort by:</span>
                            <Select value={sortBy} onValueChange={setSortBy}>
                              <SelectTrigger className="w-[180px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="name">Name (A-Z)</SelectItem>
                                <SelectItem value="spend">Spend (High to Low)</SelectItem>
                                <SelectItem value="conversions">Conversions (High to Low)</SelectItem>
                                <SelectItem value="clicks">Clicks (High to Low)</SelectItem>
                                <SelectItem value="impressions">Impressions (High to Low)</SelectItem>
                                <SelectItem value="ctr">CTR (High to Low)</SelectItem>
                                <SelectItem value="cpa">CPA (Low to High)</SelectItem>
                                <SelectItem value="cvr">CVR (High to Low)</SelectItem>
                                {/* Revenue-based sorting options - only show when per-campaign revenue allocation is possible */}
                                {(aggregated?.hasRevenueTracking === 1 && Number(aggregated?.conversionValue || 0) > 0) && (
                                  <>
                                    <SelectItem value="revenue">Total Revenue (High to Low)</SelectItem>
                                    <SelectItem value="roas">ROAS (High to Low)</SelectItem>
                                    <SelectItem value="roi">ROI (High to Low)</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Filter:</span>
                            <Select value={filterBy} onValueChange={setFilterBy}>
                              <SelectTrigger className="w-[140px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {metrics ? Object.keys(metrics.reduce((acc: any, m: any) => ({ ...acc, [m.campaignUrn]: true }), {})).length : 0} campaigns
                        </span>
                      </div>

                      {metrics && metrics.length > 0 ? (
                        <div className="space-y-4">
                          {Object.values(
                            metrics.reduce((acc: any, metric: any) => {
                              if (!acc[metric.campaignUrn]) {
                                acc[metric.campaignUrn] = {
                                  urn: metric.campaignUrn,
                                  name: metric.campaignName,
                                  status: metric.campaignStatus,
                                  metrics: {}
                                };
                              }
                              acc[metric.campaignUrn].metrics[metric.metricKey] = parseFloat(metric.metricValue);
                              return acc;
                            }, {})
                          )
                          .filter((campaign: any) => {
                            // Filter by status
                            if (filterBy === 'all') return true;
                            return campaign.status === filterBy;
                          })
                          .sort((a: any, b: any) => {
                            // Sort campaigns based on selected option
                            switch (sortBy) {
                              case 'name':
                                return a.name.localeCompare(b.name);
                              case 'spend':
                                return (b.metrics.spend || 0) - (a.metrics.spend || 0);
                              case 'conversions':
                                return (b.metrics.conversions || 0) - (a.metrics.conversions || 0);
                              case 'clicks':
                                return (b.metrics.clicks || 0) - (a.metrics.clicks || 0);
                              case 'impressions':
                                return (b.metrics.impressions || 0) - (a.metrics.impressions || 0);
                              case 'ctr':
                                const ctrA = (a.metrics.impressions || 0) > 0 ? ((a.metrics.clicks || 0) / (a.metrics.impressions || 0)) * 100 : 0;
                                const ctrB = (b.metrics.impressions || 0) > 0 ? ((b.metrics.clicks || 0) / (b.metrics.impressions || 0)) * 100 : 0;
                                return ctrB - ctrA;
                              case 'cpa':
                                const cpaA = (a.metrics.conversions || 0) > 0 ? (a.metrics.spend || 0) / (a.metrics.conversions || 0) : Infinity;
                                const cpaB = (b.metrics.conversions || 0) > 0 ? (b.metrics.spend || 0) / (b.metrics.conversions || 0) : Infinity;
                                return cpaA - cpaB; // Low to High
                              case 'cvr':
                                const cvrA = (a.metrics.clicks || 0) > 0 ? ((a.metrics.conversions || 0) / (a.metrics.clicks || 0)) * 100 : 0;
                                const cvrB = (b.metrics.clicks || 0) > 0 ? ((b.metrics.conversions || 0) / (b.metrics.clicks || 0)) * 100 : 0;
                                return cvrB - cvrA;
                              case 'revenue': {
                                // Total Revenue (per-campaign estimate) = Conversions × Conversion Value (overall)
                                const conversionValue = Number(aggregated?.conversionValue || 0);
                                const revenueA = conversionValue > 0 ? (Number(a.metrics.conversions || 0) * conversionValue) : 0;
                                const revenueB = conversionValue > 0 ? (Number(b.metrics.conversions || 0) * conversionValue) : 0;
                                return revenueB - revenueA;
                              }
                              case 'roas': {
                                // ROAS = Revenue / Spend (per-campaign estimate)
                                const cv = Number(aggregated?.conversionValue || 0);
                                const roasRevenueA = cv > 0 ? (Number(a.metrics.conversions || 0) * cv) : 0;
                                const roasRevenueB = cv > 0 ? (Number(b.metrics.conversions || 0) * cv) : 0;
                                const roasA = (Number(a.metrics.spend || 0)) > 0 ? roasRevenueA / Number(a.metrics.spend || 0) : 0;
                                const roasB = (Number(b.metrics.spend || 0)) > 0 ? roasRevenueB / Number(b.metrics.spend || 0) : 0;
                                return roasB - roasA;
                              }
                              case 'roi': {
                                // ROI = ((Revenue - Spend) / Spend) × 100 (per-campaign estimate)
                                const cv = Number(aggregated?.conversionValue || 0);
                                const roiRevenueA = cv > 0 ? (Number(a.metrics.conversions || 0) * cv) : 0;
                                const roiRevenueB = cv > 0 ? (Number(b.metrics.conversions || 0) * cv) : 0;
                                const spendA = Number(a.metrics.spend || 0);
                                const spendB = Number(b.metrics.spend || 0);
                                const roiProfitA = roiRevenueA - spendA;
                                const roiProfitB = roiRevenueB - spendB;
                                const roiA = spendA > 0 ? (roiProfitA / spendA) * 100 : 0;
                                const roiB = spendB > 0 ? (roiProfitB / spendB) * 100 : 0;
                                return roiB - roiA;
                              }
                              default:
                                return 0;
                            }
                          })
                          .map((linkedInCampaign: any, index: number) => {
                            // Capture campaign name in a const to avoid scope issues
                            const campaignName = linkedInCampaign.name;
                            
                            // Calculate derived metrics
                            const impressions = linkedInCampaign.metrics.impressions || 0;
                            const clicks = linkedInCampaign.metrics.clicks || 0;
                            const spend = linkedInCampaign.metrics.spend || 0;
                            const conversions = linkedInCampaign.metrics.conversions || 0;
                            const engagements = linkedInCampaign.metrics.engagements || 0;
                            
                            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                            const cpc = clicks > 0 ? spend / clicks : 0;
                            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                            const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                            const costPerConv = conversions > 0 ? spend / conversions : 0;
                            const cpa = costPerConv;
                            const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
                            const roas = aggregated?.roas || 0;
                            
                            return (
                              <Card key={index} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                  {/* Campaign Header */}
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3">
                                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                                      <div>
                                        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                                          {linkedInCampaign.name}
                                        </h4>
                                      </div>
                                    </div>
                                    <Badge 
                                      variant={linkedInCampaign.status === 'active' ? 'default' : 'secondary'}
                                      className={linkedInCampaign.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                    >
                                      {linkedInCampaign.status}
                                    </Badge>
                                  </div>

                                  {/* Primary Metrics */}
                                  <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Impressions</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(impressions)}
                                      </p>
                                      {/* Badge for campaign-specific impressions benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const impressionsBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'impressions' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (impressionsBenchmark) {
                                          return renderPerformanceBadge('impressions', impressions, 'higher-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(clicks)}
                                      </p>
                                      {/* Badge for campaign-specific clicks benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const clicksBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'clicks' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (clicksBenchmark) {
                                          return renderPerformanceBadge('clicks', clicks, 'higher-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(spend)}
                                      </p>
                                      {/* Badge for campaign-specific spend benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const spendBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'spend' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (spendBenchmark) {
                                          return renderPerformanceBadge('spend', spend, 'lower-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(conversions)}
                                      </p>
                                      {/* Badge for campaign-specific conversions benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const conversionsBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'conversions' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (conversionsBenchmark) {
                                          return renderPerformanceBadge('conversions', conversions, 'higher-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Secondary Metrics */}
                                  <div className="grid grid-cols-5 gap-3 mb-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(ctr)}
                                      </p>
                                      {/* Badge for campaign-specific CTR benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const ctrBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'ctr' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (ctrBenchmark) {
                                          return renderPerformanceBadge('ctr', ctr, 'higher-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpc)}
                                      </p>
                                      {/* Badge for campaign-specific CPC benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const cpcBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'cpc' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (cpcBenchmark) {
                                          return renderPerformanceBadge('cpc', cpc, 'lower-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpm)}
                                      </p>
                                      {/* Badge for campaign-specific CPM benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const cpmBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'cpm' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (cpmBenchmark) {
                                          return renderPerformanceBadge('cpm', cpm, 'lower-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Conv. Rate (CVR)</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(convRate)}
                                      </p>
                                      {/* Badge for campaign-specific CVR benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const cvrBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'cvr' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (cvrBenchmark) {
                                          return renderPerformanceBadge('cvr', convRate, 'higher-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Cost/Conv. (CPA)</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(costPerConv)}
                                      </p>
                                      {/* Render badge for campaign-specific CPA benchmark */}
                                      {Array.isArray(benchmarks) && (() => {
                                        const cpaBenchmark = benchmarks.find((b: any) => 
                                          b.metric?.toLowerCase() === 'cpa' && 
                                          b.linkedInCampaignName === campaignName
                                        );
                                        if (cpaBenchmark) {
                                          return renderPerformanceBadge('cpa', cpa, 'lower-better');
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Revenue Metrics - Only shown when per-campaign revenue allocation is possible */}
                                  {(aggregated?.hasRevenueTracking === 1 && Number(aggregated?.conversionValue || 0) > 0) && (() => {
                                    const conversionValue = Number(aggregated.conversionValue || 0);
                                    const campaignRevenue = conversions * conversionValue;
                                    const campaignProfit = campaignRevenue - spend;
                                    const campaignROAS = spend > 0 ? campaignRevenue / spend : 0;
                                    const campaignROI = spend > 0 ? ((campaignRevenue - spend) / spend) * 100 : 0;
                                    
                                    return (
                                      <div className="pt-4 border-t border-green-200 dark:border-green-800">
                                        <div className="flex items-center gap-2 mb-3">
                                          <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Revenue Metrics</h5>
                                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            💰
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                          <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg">
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Revenue</p>
                                            <p className="text-sm font-bold text-green-700 dark:text-green-400">
                                              {formatCurrency(campaignRevenue)}
                                            </p>
                                          </div>
                                          <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                                            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                              {campaignROAS.toFixed(2)}×
                                            </p>
                                          </div>
                                          <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg">
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI</p>
                                            <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                                              {campaignROI.toFixed(1)}%
                                            </p>
                                          </div>
                                          <div className={`p-3 rounded-lg ${
                                            campaignProfit >= 0 
                                              ? 'bg-green-50 dark:bg-green-900/10' 
                                              : 'bg-red-50 dark:bg-red-900/10'
                                          }`}>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit</p>
                                            <p className={`text-sm font-bold ${
                                              campaignProfit >= 0 
                                                ? 'text-green-700 dark:text-green-400' 
                                                : 'text-red-700 dark:text-red-400'
                                            }`}>
                                              {formatCurrency(campaignProfit)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Performance Indicators - Only shown when industry is selected */}
                                  {campaignData?.industry && (
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {/* Performance Indicators - Using Benchmark System */}
                                        {/* ER (Engagement Rate) Badge */}
                                        {Array.isArray(benchmarks) && (() => {
                                          const erBenchmark = benchmarks.find((b: any) => 
                                            b.metric?.toLowerCase() === 'er' && 
                                            b.linkedInCampaignName === campaignName
                                          );
                                          if (erBenchmark) {
                                            return renderPerformanceBadge('er', engagementRate, 'higher-better');
                                          }
                                          return null;
                                        })()}
                                        
                                        {/* ROI Badge */}
                                        {Array.isArray(benchmarks) && aggregated?.hasRevenueTracking === 1 && (() => {
                                          const roiBenchmark = benchmarks.find((b: any) => 
                                            b.metric?.toLowerCase() === 'roi' && 
                                            b.linkedInCampaignName === campaignName
                                          );
                                          if (roiBenchmark) {
                                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                                            const campaignROI = spend > 0 ? ((campaignRevenue - spend) / spend) * 100 : 0;
                                            return renderPerformanceBadge('roi', campaignROI, 'higher-better');
                                          }
                                          return null;
                                        })()}
                                        
                                        {/* ROAS Badge */}
                                        {Array.isArray(benchmarks) && aggregated?.hasRevenueTracking === 1 && (() => {
                                          const roasBenchmark = benchmarks.find((b: any) => 
                                            b.metric?.toLowerCase() === 'roas' && 
                                            b.linkedInCampaignName === campaignName
                                          );
                                          if (roasBenchmark) {
                                            const campaignRevenue = conversions * (aggregated.conversionValue || 0);
                                            const campaignROAS = spend > 0 ? campaignRevenue / spend : 0;
                                            return renderPerformanceBadge('roas', campaignROAS, 'higher-better');
                                          }
                                          return null;
                                        })()}
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => {
                                          setSelectedCampaignDetails(linkedInCampaign);
                                          setIsCampaignDetailsModalOpen(true);
                                      }}
                                      data-testid={`button-view-details-${index}`}
                                    >
                                      View Details →
                                    </Button>
                                    </div>
                                  )}
                                  
                                  {/* View Details Button - Always visible */}
                                  {!campaignData?.industry && (
                                    <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => {
                                          setSelectedCampaignDetails(linkedInCampaign);
                                          setIsCampaignDetailsModalOpen(true);
                                        }}
                                        data-testid={`button-view-details-${index}`}
                                      >
                                        View Details →
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <p className="text-slate-500">No campaign data available</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No LinkedIn Data Available</CardTitle>
                      <CardDescription>
                        No LinkedIn import session data found for this campaign
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          To view LinkedIn campaign metrics, you need to import data from your LinkedIn Ads account.
                        </p>
                        <Button 
                          onClick={() => setLocation(`/campaigns/${campaignId}`)}
                          data-testid="button-import-linkedin"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Go to Campaign to Import LinkedIn Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="space-y-6" data-testid="content-insights">
                {sessionLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : sessionIsError ? (
                  <LinkedInTabErrorState
                    title="Insights"
                    description="Exec-safe insights from your LinkedIn data"
                    message={(sessionError as any)?.message || "Failed to load LinkedIn insights."}
                    onRetry={() => void refetchSessionData()}
                  />
                ) : linkedInDailyLoading || linkedInInsightsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : linkedInDailyResp?.success === false || linkedInInsightsResp?.success === false ? (
                  <LinkedInTabErrorState
                    title="Insights"
                    description="Exec-safe insights from your LinkedIn data"
                    message="We couldn’t load LinkedIn insights yet. Please try again."
                    onRetry={() => {
                      void refetchLinkedInDaily();
                      void refetchLinkedInSignals();
                    }}
                  />
                ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Insights</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Actionable insights from financial integrity checks plus KPI + Benchmark performance.
                    </p>
                  </div>

                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle>Executive financials</CardTitle>
                      <CardDescription>
                        Spend comes from LinkedIn imports. Revenue metrics appear only when a LinkedIn revenue source is connected.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                          <CardContent className="p-5">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatCurrency(Number((aggregated as any)?.totalSpend || 0))}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: LinkedIn Ads</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatCurrency(Number((aggregated as any)?.totalRevenue || 0))}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {(aggregated as any)?.hasRevenueTracking === 1 ? "From connected revenue source" : "Not connected"}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                              {Number((aggregated as any)?.roas || 0).toFixed(2)}x
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revenue ÷ Spend</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatPercentage(Number((aggregated as any)?.roi || 0))}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">(\(Revenue - Spend\)) ÷ Spend</div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                        <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">Sources used</div>
                        <div className="grid gap-1">
                          <div>
                            <span className="font-medium">Spend</span>: LinkedIn import session
                          </div>
                          <div>
                            <span className="font-medium">Revenue</span>: {(aggregated as any)?.hasRevenueTracking === 1 ? "Connected revenue source" : "Not connected"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <CardTitle>Trends</CardTitle>
                          <CardDescription>
                            Daily shows day-by-day values. 7d/30d smooth the chart with rolling windows; the table summarizes the latest window vs the prior window using the same math.
                          </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant={insightsTrendMode === "daily" ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setInsightsDailyShowMore(false);
                                setInsightsTrendMode("daily");
                              }}
                            >
                              Daily
                            </Button>
                            <Button
                              type="button"
                              variant={insightsTrendMode === "7d" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setInsightsTrendMode("7d")}
                            >
                              7d
                            </Button>
                            <Button
                              type="button"
                              variant={insightsTrendMode === "30d" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setInsightsTrendMode("30d")}
                            >
                              30d
                            </Button>
                          </div>
                          {/* Daily mode always shows day-over-day deltas in the table */}
                          <div className="min-w-[220px]">
                            <Select value={insightsTrendMetric} onValueChange={(v: any) => setInsightsTrendMetric(v)}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Metric" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="spend">Spend</SelectItem>
                                <SelectItem value="conversions">Conversions</SelectItem>
                                <SelectItem value="cvr">CVR</SelectItem>
                                <SelectItem value="ctr">CTR</SelectItem>
                                <SelectItem value="clicks">Clicks</SelectItem>
                                <SelectItem value="impressions">Impressions</SelectItem>
                                {linkedInDailySeries?.hasRevenueTracking ? <SelectItem value="revenue">Revenue</SelectItem> : null}
                                {linkedInDailySeries?.hasRevenueTracking ? <SelectItem value="roas">ROAS</SelectItem> : null}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {linkedInDailyLoading ? (
                        <div className="text-sm text-slate-600 dark:text-slate-400">Loading daily history…</div>
                      ) : (
                        <>
                          {(() => {
                            const series =
                              insightsTrendMode === "daily"
                                ? linkedInDailySeries.daily
                                : insightsTrendMode === "7d"
                                  ? linkedInDailySeries.rolling7
                                  : linkedInDailySeries.rolling30;

                            const minRequired = insightsTrendMode === "daily" ? 2 : insightsTrendMode === "7d" ? 14 : 60;
                            const available = Number(linkedInInsightsRollups?.availableDays || 0);
                            if (available <= 0) {
                              return (
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  No LinkedIn daily history is available yet. Import LinkedIn data and wait for daily history to populate.
                                </div>
                              );
                            }
                            if (available < minRequired) {
                              return (
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Need at least {minRequired} days of LinkedIn daily history for this view. Available days: {available}.
                                </div>
                              );
                            }

                            const formatChartValue = (v: any) => {
                              const n = Number(v || 0) || 0;
                              if (insightsTrendMetric === "spend" || insightsTrendMetric === "revenue") return formatCurrency(n);
                              if (insightsTrendMetric === "ctr" || insightsTrendMetric === "cvr") return `${n.toFixed(2)}%`;
                              if (insightsTrendMetric === "roas") return `${n.toFixed(2)}x`;
                              return formatNumber(n, insightsTrendMetric);
                            };

                            return (
                              <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={series}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                      dataKey="date"
                                      tick={{ fontSize: 12 }}
                                      tickFormatter={(v: any) => formatShortYearIsoDate(String(v || ""))}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value: any) => formatChartValue(value)} />
                                    <Legend />
                                    <Line
                                      type="monotone"
                                      dataKey={insightsTrendMetric}
                                      stroke="#7c3aed"
                                      strokeWidth={2}
                                      dot={false}
                                      name={insightsTrendMetric.toUpperCase()}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}

                          {/* Table view */}
                          <div className="overflow-hidden border rounded-md">
                            {insightsTrendMode === "daily" ? (
                              <div>
                                <table className="w-full text-sm table-fixed">
                                  <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                    <tr>
                                      <th className="text-left p-3 w-[38%]">Date</th>
                                      <th className="text-right p-3 w-[31%]">
                                        {(() => {
                                          const k = String(insightsTrendMetric || "");
                                          const labels: Record<string, string> = {
                                            spend: "Spend",
                                            conversions: "Conversions",
                                            cvr: "CVR",
                                            ctr: "CTR",
                                            clicks: "Clicks",
                                            impressions: "Impressions",
                                            revenue: "Revenue",
                                            roas: "ROAS",
                                          };
                                          return labels[k] || "Metric";
                                        })()}
                                      </th>
                                      <th className="text-right p-3 w-[31%]">Δ vs prior</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const daily = Array.isArray(linkedInDailySeries?.daily) ? (linkedInDailySeries as any).daily : [];
                                      const visibleDays = insightsDailyShowMore ? 14 : 7;
                                      const rows = daily.slice(-visibleDays);

                                      if (rows.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                              No daily records are available yet.
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return rows.map((r: any, idx: number, arr: any[]) => {
                                        const prev = idx > 0 ? arr[idx - 1] : null;
                                        const metricKey = String(insightsTrendMetric || "");
                                        const curVal = Number((r as any)?.[metricKey] ?? 0) || 0;
                                        const prevVal = Number((prev as any)?.[metricKey] ?? 0) || 0;
                                        const deltaPct = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;

                                        const polarity: "neutral" | "directional" =
                                          metricKey === "spend" || metricKey === "impressions" || metricKey === "clicks" ? "neutral" : "directional";
                                        const deltaClass =
                                          polarity === "neutral"
                                            ? "text-slate-600 dark:text-slate-400"
                                            : deltaPct >= 0
                                              ? "text-emerald-700 dark:text-emerald-300"
                                              : "text-red-700 dark:text-red-300";
                                        const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                                        const showDelta = !!prev && prevVal > 0;

                                        const formatValue = (key: string, v: number) => {
                                          if (key === "spend" || key === "revenue") return formatCurrency(v);
                                          if (key === "ctr" || key === "cvr") return `${v.toFixed(2)}%`;
                                          if (key === "roas") return `${v.toFixed(2)}x`;
                                          return formatNumber(v, key);
                                        };

                                        return (
                                          <tr key={r.date} className="border-b">
                                            <td className="p-3">
                                              <div className="font-medium text-slate-900 dark:text-white">
                                                {formatShortYearIsoDate(String(r.date || ""))}
                                              </div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className="font-medium text-slate-900 dark:text-white">
                                                {formatValue(metricKey, curVal)}
                                              </div>
                                            </td>
                                            <td className="p-3 text-right">
                                              <div className={`text-xs ${showDelta ? deltaClass : "text-slate-400"}`}>
                                                {showDelta ? fmtDelta(deltaPct) : "—"}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>

                                {(linkedInDailySeries?.daily || []).length > 7 ? (
                                  <div className="flex justify-end px-3 py-2 bg-white dark:bg-slate-950">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setInsightsDailyShowMore((v) => !v)}
                                      className="h-8 text-xs"
                                    >
                                      {insightsDailyShowMore ? "View less" : "View more"}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[38%]">Date</th>
                                    <th className="text-right p-3 w-[31%]">
                                      {(() => {
                                        const k = String(insightsTrendMetric || "");
                                        const labels: Record<string, string> = {
                                          spend: "Spend",
                                          conversions: "Conversions",
                                          cvr: "CVR",
                                          ctr: "CTR",
                                          clicks: "Clicks",
                                          impressions: "Impressions",
                                          revenue: "Revenue",
                                          roas: "ROAS",
                                        };
                                        return labels[k] || "Metric";
                                      })()}
                                    </th>
                                    <th className="text-right p-3 w-[31%]">Δ vs prior</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const is7 = insightsTrendMode === "7d";
                                    const available = Number(linkedInInsightsRollups?.availableDays || 0);
                                    const ok = is7 ? available >= 14 : available >= 60;
                                    if (!ok) {
                                      const minRequired = is7 ? 14 : 60;
                                      return (
                                        <tr>
                                          <td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                            {available <= 0
                                              ? "No records are available yet for this view."
                                              : `Need at least ${minRequired} days of daily history for this view. Available days: ${available}.`}
                                          </td>
                                        </tr>
                                      );
                                    }
                                    const row = is7
                                      ? { key: "7d", cur: linkedInInsightsRollups.last7, prev: linkedInInsightsRollups.prior7, d: linkedInInsightsRollups.deltas, label: "Last 7d vs prior 7d" }
                                      : { key: "30d", cur: linkedInInsightsRollups.last30, prev: linkedInInsightsRollups.prior30, d: linkedInInsightsRollups.deltas, label: "Last 30d vs prior 30d" };
                                    const deltaColor = (n: number) => (n >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300");
                                    const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

                                    const metricKey = String(insightsTrendMetric || "");
                                    const valueFor = (obj: any) => {
                                      const v = Number(obj?.[metricKey] ?? 0) || 0;
                                      if (metricKey === "spend" || metricKey === "revenue") return formatCurrency(v);
                                      if (metricKey === "ctr" || metricKey === "cvr") return `${v.toFixed(2)}%`;
                                      if (metricKey === "roas") return `${v.toFixed(2)}x`;
                                      return formatNumber(v, metricKey);
                                    };
                                    const deltaFor = () => {
                                      const map7: Record<string, number> = {
                                        impressions: row.d.impressions7,
                                        clicks: row.d.clicks7,
                                        ctr: row.d.ctr7,
                                        conversions: row.d.conversions7,
                                        cvr: row.d.cvr7,
                                        spend: row.d.spend7,
                                        revenue: row.d.revenue7,
                                        roas: row.d.roas7,
                                      };
                                      const map30: Record<string, number> = {
                                        impressions: row.d.impressions30,
                                        clicks: row.d.clicks30,
                                        ctr: row.d.ctr30,
                                        conversions: row.d.conversions30,
                                        cvr: row.d.cvr30,
                                        spend: row.d.spend30,
                                        revenue: row.d.revenue30,
                                        roas: row.d.roas30,
                                      };
                                      const v = (is7 ? map7 : map30)[metricKey];
                                      return Number.isFinite(v) ? v : 0;
                                    };
                                    const delta = deltaFor();
                                    return (
                                      <tr key={row.key} className="border-b">
                                        <td className="p-3">
                                          <div className="font-medium text-slate-900 dark:text-white">{row.cur.endDate}</div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {row.cur.startDate} → {row.cur.endDate} ({row.label})
                                          </div>
                                        </td>
                                        <td className="p-3 text-right">
                                          <div className="font-medium text-slate-900 dark:text-white">{valueFor(row.cur)}</div>
                                        </td>
                                        <td className="p-3 text-right">
                                          <div className={`text-xs ${deltaColor(delta)}`}>{fmtDelta(delta)}</div>
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

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total insights</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{linkedInInsights.length}</p>
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
                              {linkedInInsights.filter((i) => i.severity === "high").length}
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
                              {linkedInInsights.filter((i) => i.severity === "medium").length}
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
                        Exec-safe summary of integrity checks, KPI/Benchmark evaluations, and anomaly signals from daily history.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const availableDays = Number((linkedInInsightsRollups as any)?.availableDays || 0);
                        const hasRevenueTracking = (aggregated as any)?.hasRevenueTracking === 1 || (aggregated as any)?.hasRevenueTracking === true;
                        const dataThrough = String((linkedInCoverageResp as any)?.dataThroughUtc || "").trim() || null;
                        const goalHealth = (linkedInInsightsResp as any)?.goalHealth || null;
                        const wowWindow =
                          (linkedInInsightsRollups as any)?.last7?.startDate && (linkedInInsightsRollups as any)?.last7?.endDate
                            ? `${(linkedInInsightsRollups as any).last7.startDate} → ${(linkedInInsightsRollups as any).last7.endDate} (last 7d)`
                            : null;
                        const coverageLastRefreshAtRaw = (linkedInCoverageResp as any)?.lastRefreshAt;
                        const fallbackLastRefreshAt = Math.max(Number(linkedInDailyRefreshedAt || 0), Number(linkedInSignalsRefreshedAt || 0)) || 0;
                        const lastRefreshAt = coverageLastRefreshAtRaw ? new Date(coverageLastRefreshAtRaw).getTime() : fallbackLastRefreshAt;
                        const lastRefreshText = lastRefreshAt > 0 ? new Date(lastRefreshAt).toLocaleString() : "—";

                        const all = Array.isArray(linkedInInsights) ? linkedInInsights : [];
                        const integrity = all.filter((x) => (x as any)?.group === "integrity");
                        const performance = all.filter((x) => (x as any)?.group !== "integrity");

                        const renderInsightCard = (i: any) => {
                          const badgeClass =
                            i.severity === "high"
                              ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900"
                              : i.severity === "medium"
                                ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900"
                                : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                          const badgeText = i.severity === "high" ? "High" : i.severity === "medium" ? "Medium" : "Low";
                          const reliability = String(i.reliability || "").toLowerCase();
                          const reliabilityClass =
                            reliability === "high"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900"
                              : reliability === "medium"
                                ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900"
                                : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                          const reliabilityText = reliability ? `Reliability: ${reliability.charAt(0).toUpperCase()}${reliability.slice(1)}` : null;

                          const isExpanded = !!insightsExpanded?.[i.id];
                          const canExplain = Array.isArray(i?.explain?.lines) && i.explain.lines.length > 0;

                          return (
                            <div key={i.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-semibold text-slate-900 dark:text-white">{i.title}</div>
                                    <Badge className={`text-xs border ${badgeClass}`}>{badgeText}</Badge>
                                    {reliabilityText ? (
                                      <Badge className={`text-xs border ${reliabilityClass}`}>{reliabilityText}</Badge>
                                    ) : null}
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{i.description}</div>
                                  {Array.isArray(i.evidence) && i.evidence.length > 0 ? (
                                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">Evidence:</span>{" "}
                                      {i.evidence.join(" • ")}
                                    </div>
                                  ) : null}
                                  {i.recommendation ? (
                                    <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                                      <span className="font-medium">Next step:</span> {i.recommendation}
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {canExplain ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setInsightsExpanded((prev) => ({
                                            ...(prev || {}),
                                            [String(i.id)]: !prev?.[String(i.id)],
                                          }))
                                        }
                                      >
                                        {isExpanded ? "Hide explanation" : "Explain"}
                                      </Button>
                                    ) : null}
                                  </div>

                                  {isExpanded && canExplain ? (
                                    <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                                      {i?.explain?.title ? (
                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                          {i.explain.title}
                                        </div>
                                      ) : null}
                                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4">
                                        {i.explain.lines.map((line: string, idx: number) => (
                                          <li key={`${i.id}:ex:${idx}`}>{line}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        };

                        const thresholdsPopover = (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2">
                                <Info className="w-4 h-4 mr-1" />
                                Thresholds
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="text-sm font-medium mb-1">Signal thresholds</div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                <div><span className="font-medium">Min clicks</span>: {execWowThresholds.minClicks}</div>
                                <div><span className="font-medium">Min impressions</span>: {execWowThresholds.minImpressions}</div>
                                <div><span className="font-medium">Min conversions</span>: {execWowThresholds.minConversions}</div>
                                <div><span className="font-medium">CVR drop</span>: ≥ {execWowThresholds.cvrDropPct}% WoW</div>
                                <div><span className="font-medium">CPC spike</span>: ≥ {execWowThresholds.cpcSpikePct}% WoW</div>
                                <div><span className="font-medium">Engagement decay</span>: ≥ {execWowThresholds.erDecayPct}% WoW</div>
                                <div><span className="font-medium">CTR stable band</span>: ± {execWowThresholds.ctrStableBandPct}%</div>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                                Signals compare the last 7 complete UTC days vs the prior 7 complete UTC days.
                              </div>
                            </PopoverContent>
                          </Popover>
                        );

                        return (
                          <>
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <div><span className="font-medium text-slate-700 dark:text-slate-300">Data through:</span> {dataThrough ? `${dataThrough} (UTC)` : "—"}</div>
                                <div><span className="font-medium text-slate-700 dark:text-slate-300">Available days:</span> {availableDays}</div>
                                <div><span className="font-medium text-slate-700 dark:text-slate-300">WoW window:</span> {wowWindow || "Needs 14+ days"}</div>
                                <div><span className="font-medium text-slate-700 dark:text-slate-300">Revenue:</span> {hasRevenueTracking ? "Connected" : "Not connected"}</div>
                                <div><span className="font-medium text-slate-700 dark:text-slate-300">Last refresh:</span> {lastRefreshText}</div>
                              </div>
                            </div>

                            {goalHealth ? (
                              <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Goal impact (KPIs & Benchmarks)
                                  </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2 mt-3">
                                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Top KPI gaps</div>
                                      <Badge variant="outline" className="text-xs">
                                        {Number((goalHealth as any)?.kpis?.behind || 0)}
                                      </Badge>
                                    </div>

                                    {(() => {
                                      const raw = (goalHealth as any)?.kpis?.sample;
                                      const list = Array.isArray(raw) ? raw : [];
                                      const behind = list.filter((x: any) => String(x?.status || "") === "behind");

                                      const gapPct = (x: any) => {
                                        const current = Number(x?.currentValue ?? 0) || 0;
                                        const target = Number(x?.targetValue ?? 0) || 0;
                                        if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return null;
                                        const lower = !!x?.lowerIsBetter;
                                        const ratio = lower ? (current > 0 ? target / current : 0) : current / target;
                                        const deltaPct = (ratio - 1) * 100;
                                        return deltaPct;
                                      };

                                      const rows = behind
                                        .map((x: any) => ({ x, d: gapPct(x) }))
                                        .filter((o: any) => o.d !== null && Number.isFinite(o.d))
                                        .sort((a: any, b: any) => Math.abs(Number(b.d)) - Math.abs(Number(a.d)))
                                        .slice(0, 3);

                                      if (rows.length === 0) return null;

                                      return (
                                        <div className="mt-3 space-y-2">
                                          {rows.map((o: any) => {
                                            const k = o.x;
                                            const d = Number(o.d || 0);
                                            const gapText = `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
                                            return (
                                              <div key={String(k?.id || k?.name || Math.random())} className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{String(k?.name || "KPI")}</div>
                                                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                    Metric: {String(k?.metric || "—")} • Gap: {gapText}
                                                  </div>
                                                </div>
                                                <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                                  Behind
                                                </Badge>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Top Benchmark gaps</div>
                                      <Badge variant="outline" className="text-xs">
                                        {Number((goalHealth as any)?.benchmarks?.behind || 0)}
                                      </Badge>
                                    </div>

                                    {(() => {
                                      const raw = (goalHealth as any)?.benchmarks?.sample;
                                      const list = Array.isArray(raw) ? raw : [];
                                      const behind = list.filter((x: any) => String(x?.status || "") === "behind");

                                      const gapPct = (x: any) => {
                                        const current = Number(x?.currentValue ?? 0) || 0;
                                        const bench = Number(x?.benchmarkValue ?? 0) || 0;
                                        if (!Number.isFinite(current) || !Number.isFinite(bench) || bench <= 0) return null;
                                        const lower = !!x?.lowerIsBetter;
                                        const ratio = lower ? (current > 0 ? bench / current : 0) : current / bench;
                                        const deltaPct = (ratio - 1) * 100;
                                        return deltaPct;
                                      };

                                      const rows = behind
                                        .map((x: any) => ({ x, d: gapPct(x) }))
                                        .filter((o: any) => o.d !== null && Number.isFinite(o.d))
                                        .sort((a: any, b: any) => Math.abs(Number(b.d)) - Math.abs(Number(a.d)))
                                        .slice(0, 3);

                                      if (rows.length === 0) return null;

                                      return (
                                        <div className="mt-3 space-y-2">
                                          {rows.map((o: any) => {
                                            const b = o.x;
                                            const d = Number(o.d || 0);
                                            const gapText = `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
                                            return (
                                              <div key={String(b?.id || b?.name || Math.random())} className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{String(b?.name || "Benchmark")}</div>
                                                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                    Metric: {String(b?.metric || "—")} • Gap: {gapText}
                                                  </div>
                                                </div>
                                                <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                                  Behind
                                                </Badge>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {!hasRevenueTracking && (
                                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                                    Note: any revenue-based KPIs/benchmarks may appear as <span className="font-medium">Blocked</span> until a LinkedIn revenue source (conversion value or total revenue) is connected.
                                  </div>
                                )}
                              </div>
                            ) : null}

                            {availableDays > 0 && availableDays < 14 ? (
                              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">
                                Need at least 14 days of daily history to compute week-over-week anomaly signals. Available days: {availableDays}.
                              </div>
                            ) : null}

                            {all.length === 0 ? (
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                No insights available yet. Import LinkedIn data, then create KPIs/Benchmarks to unlock more insights.
                              </div>
                            ) : (
                              <>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Performance & anomalies</div>
                                      {thresholdsPopover}
                                    </div>
                                    <Badge variant="outline" className="text-xs">{performance.length}</Badge>
                                  </div>
                                  {performance.length === 0 ? (
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                      No performance issues detected. Add KPIs/Benchmarks to unlock more evaluations.
                                    </div>
                                  ) : (
                                    performance.slice(0, 12).map(renderInsightCard)
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
                )}
              </TabsContent>

              {/* Connected Data Sources tab removed */}

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6" data-testid="content-kpis">
                {kpisLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : kpisIsError ? (
                  <LinkedInTabErrorState
                    title="KPIs"
                    description="Key Performance Indicators for this campaign"
                    message={(kpisError as any)?.message || "Failed to load KPIs."}
                    onRetry={() => void refetchKpis()}
                  />
                ) : kpisData && (kpisData as any[]).length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track your KPI targets against the latest imported LinkedIn data
                        </p>
                      </div>
                      <Button
                        onClick={() => setIsKPIModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="border-slate-300 dark:border-slate-700"
                        data-testid="button-add-kpi"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add KPI
                      </Button>
                    </div>

                    {(() => {
                      const dataThrough = String((linkedInCoverageResp as any)?.dataThroughUtc || "").trim() || null;
                      const lastRefreshAtRaw = (linkedInCoverageResp as any)?.lastRefreshAt;
                      const lastRefreshText = lastRefreshAtRaw ? new Date(lastRefreshAtRaw).toLocaleString() : "—";
                      const total = Array.isArray(kpisData) ? (kpisData as any[]).length : 0;
                      return (
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">KPIs:</span> {total}
                            </div>
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">LinkedIn data through:</span>{" "}
                              {dataThrough ? `${dataThrough} (UTC)` : "—"}
                            </div>
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">Last refresh:</span> {lastRefreshText}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* KPI Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(kpisData as any[]).map((kpi: any) => {
                        const isRevenueBlocked =
                          isRevenueDependentBenchmarkMetric(String(kpi.metric || kpi.metricKey || '')) &&
                          aggregated?.hasRevenueTracking !== 1;
                        const currentVal = getLiveCurrentForKpi(kpi);
                        const targetVal = parseFloat(kpi.targetValue || '0');
                        const lowerIsBetter = isLowerIsBetterKpi({ metric: kpi.metric || kpi.metricKey, name: kpi.name });
                        const effectiveDeltaPct = computeEffectiveDeltaPct({ current: currentVal, target: targetVal, lowerIsBetter });
                        return (
                        <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                    {/* Warning Triangle Icon for Alerts Enabled */}
                                    {kpi.alertsEnabled && (
                                      <UITooltip>
                                        <TooltipTrigger asChild>
                                          <div className="cursor-help">
                                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-slate-700">
                                          <p className="text-sm">Alerts enabled</p>
                                        </TooltipContent>
                                      </UITooltip>
                                    )}
                                    {/* Red Dot Indicator for Active Alerts */}
                                    {kpi.alertsEnabled && (() => {
                                      if (isRevenueBlocked) return null;
                                      const currentValue = getLiveCurrentForKpi(kpi);
                                      const alertThreshold = kpi.alertThreshold ? parseFloat(kpi.alertThreshold.toString()) : null;
                                      const alertCondition = kpi.alertCondition || 'below';
                                      
                                      let hasActiveAlert = false;
                                      if (alertThreshold !== null) {
                                        switch (alertCondition) {
                                          case 'below':
                                            hasActiveAlert = currentValue < alertThreshold;
                                            break;
                                          case 'above':
                                            hasActiveAlert = currentValue > alertThreshold;
                                            break;
                                          case 'equals':
                                            hasActiveAlert = Math.abs(currentValue - alertThreshold) < 0.01;
                                            break;
                                        }
                                      }
                                      
                                      return hasActiveAlert ? (
                                        <UITooltip>
                                          <TooltipTrigger asChild>
                                            <div className="relative flex items-center justify-center cursor-help">
                                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                              <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                                            <div className="space-y-2">
                                              <p className="font-semibold text-red-400">⚠️ Alert Threshold Breached</p>
                                              <div className="text-xs space-y-1">
                                                <p><span className="text-slate-400">Current:</span> {formatMetricValueForDisplay(String(kpi.metric || kpi.metricKey || ''), currentValue)}</p>
                                                <p><span className="text-slate-400">Alert Threshold:</span> {alertThreshold}{kpi.unit}</p>
                                                <p><span className="text-slate-400">Condition:</span> {alertCondition}</p>
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </UITooltip>
                                      ) : null;
                                    })()}
                                  </div>
                                  {/* Metric Badge */}
                                  {kpi.metric && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                      {kpi.metric.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm">
                                  {(String(kpi.description || '').trim() || getDefaultKpiDescription(kpi.metric || kpi.metricKey))}
                                </CardDescription>
                                {/* Campaign Scope Badge */}
                                {kpi.applyTo === 'specific' && kpi.specificCampaignId && (
                                  <div className="mt-2">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                      Campaign: {kpi.specificCampaignId}
                                    </Badge>
                                  </div>
                                )}
                                {kpi.applyTo !== 'specific' && (
                                  <div className="mt-2">
                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                                      All Campaigns
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {kpi.priority && (
                                  <Badge variant="outline" className={
                                    kpi.priority === 'high' ? 'text-red-600 border-red-300' :
                                    kpi.priority === 'medium' ? 'text-yellow-600 border-yellow-300' :
                                    'text-green-600 border-green-300'
                                  }>
                                    {kpi.priority}
                                  </Badge>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                  onClick={() => {
                                    setEditingKPI(kpi);
                                    const liveForEdit = getLiveCurrentForKpi(kpi);
                                    const metricKeyForEdit = String(kpi.metric || kpi.metricKey || '');
                                    const defaultDescForEdit = getDefaultKpiDescription(metricKeyForEdit);
                                    setKpiForm({
                                      name: kpi.name,
                                      description: (String(kpi.description || '').trim() || defaultDescForEdit),
                                      metric: metricKeyForEdit,
                                      targetValue: kpi.targetValue
                                        ? formatNumberAsYouType(String(kpi.targetValue), { maxDecimals: getMaxDecimalsForMetric(metricKeyForEdit) })
                                        : '',
                                      currentValue: formatMetricValueForInput(metricKeyForEdit, String(liveForEdit)),
                                      unit: kpi.unit || '',
                                      priority: kpi.priority || 'medium',
                                      status: kpi.status || 'active',
                                      category: kpi.category || '',
                                      timeframe: kpi.timeframe || 'monthly',
                                      trackingPeriod: kpi.trackingPeriod?.toString() || '30',
                                      alertsEnabled: kpi.alertsEnabled || false,
                                      emailNotifications: kpi.emailNotifications || false,
                                      alertThreshold: kpi.alertThreshold ? formatNumberAsYouType(String(kpi.alertThreshold), { maxDecimals: getMaxDecimalsForMetric(kpi.metric || '') }) : '',
                                      alertCondition: kpi.alertCondition || 'below',
                                      emailRecipients: kpi.emailRecipients || '',
                                      applyTo: kpi.applyTo || 'all',
                                      specificCampaignId: kpi.specificCampaignId || ''
                                    });
                                    setIsKPIModalOpen(true);
                                  }}
                                  data-testid={`button-edit-kpi-${kpi.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                      data-testid={`button-delete-kpi-${kpi.id}`}
                                    >
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
                                      <AlertDialogAction
                                        onClick={() => deleteKpiMutation.mutate(kpi.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {isRevenueBlocked && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                                This metric is unavailable because revenue tracking is disabled (no revenue source / conversion value).
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Current
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    if (isRevenueBlocked) return '—';
                                    const value = Number.isFinite(currentVal) ? currentVal : 0;
                                    const metricKey = String(kpi.metric || kpi.metricKey || '');
                                    return formatMetricValueForDisplay(metricKey, value);
                                  })()}
                                </div>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    const value = parseFloat(stripNumeric(String(kpi.targetValue || '0'))) || 0;
                                    const metricKey = String(kpi.metric || kpi.metricKey || '');
                                    return formatMetricValueForDisplay(metricKey, value);
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar (per-KPI) */}
                            {!isRevenueBlocked && (
                              <div className="space-y-2">
                                {(() => {
                                  if (!Number.isFinite(currentVal) || !Number.isFinite(targetVal) || targetVal <= 0) return null;
                                  const lowerIsBetter = isLowerIsBetterKpi({ metric: kpi.metric || kpi.metricKey, name: kpi.name });
                                  const progressPct = computeAttainmentPct({ current: currentVal, target: targetVal, lowerIsBetter });
                                  if (progressPct === null) return null;
                                  const progressFill = computeAttainmentFillPct(progressPct);
                                  const progressColor =
                                    progressPct >= 100 ? "bg-green-500" : progressPct >= 90 ? "bg-amber-500" : "bg-red-500";

                                  return (
                                    <>
                                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                        <span>Progress</span>
                                        <span>{Math.round(progressPct)}%</span>
                                      </div>
                                      <Progress value={progressFill} className="h-2" indicatorClassName={progressColor} />
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            
                            {/* Delta vs target (keeps the concrete signal; removes heuristic bucket labels) */}
                            {!isRevenueBlocked && (
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {(() => {
                                  if (!Number.isFinite(currentVal) || !Number.isFinite(targetVal) || targetVal <= 0) return null;
                                  if (effectiveDeltaPct === null) return null;
                                  if (Math.abs(effectiveDeltaPct) < 0.0001) return 'At target';
                                  const signed = `${effectiveDeltaPct >= 0 ? '+' : ''}${effectiveDeltaPct.toFixed(1)}%`;
                                  const absRounded = `${Math.round(Math.abs(effectiveDeltaPct))}%`;
                                  return effectiveDeltaPct > 0 ? `${absRounded} above target (${signed})` : `${absRounded} below target (${signed})`;
                                })()}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )})}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track your KPI targets against the latest imported LinkedIn data
                        </p>
                      </div>
                      <Button
                        onClick={() => setIsKPIModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="border-slate-300 dark:border-slate-700"
                        data-testid="button-add-kpi-empty"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add KPI
                      </Button>
                    </div>

                    {(() => {
                      const dataThrough = String((linkedInCoverageResp as any)?.dataThroughUtc || "").trim() || null;
                      const lastRefreshAtRaw = (linkedInCoverageResp as any)?.lastRefreshAt;
                      const lastRefreshText = lastRefreshAtRaw ? new Date(lastRefreshAtRaw).toLocaleString() : "—";
                      return (
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">KPIs:</span> 0
                            </div>
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">LinkedIn data through:</span>{" "}
                              {dataThrough ? `${dataThrough} (UTC)` : "—"}
                            </div>
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">Last refresh:</span> {lastRefreshText}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">0</p>
                            </div>
                            <Target className="w-8 h-8 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Above Target</p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">more than +5% above target</p>
                              <p className="text-2xl font-bold text-green-600">0</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">within ±5% of target</p>
                              <p className="text-2xl font-bold text-blue-600">0</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Below Track</p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">more than −5% below target</p>
                              <p className="text-2xl font-bold text-amber-600">0</p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">0.0%</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-violet-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No KPIs have been created yet.
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Benchmarks Tab */}
              <TabsContent value="benchmarks" className="space-y-6" data-testid="content-benchmarks">
                {benchmarksIsError ? (
                  <LinkedInTabErrorState
                    title="Benchmarks"
                    description="Compare your performance against benchmarks"
                    message={(benchmarksError as any)?.message || "Failed to load benchmarks."}
                    onRetry={() => void refetchBenchmarksTab()}
                  />
                ) : null}
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Benchmarks</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Compare your performance against industry benchmarks
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingBenchmark(null);
                      setBenchmarkForm({
                        metric: '',
                        name: '',
                        unit: '',
                        benchmarkValue: '',
                        currentValue: '',
                        benchmarkType: 'custom',
                        industry: '',
                        description: DEFAULT_BENCHMARK_DESCRIPTION,
                        applyTo: 'all',
                        specificCampaignId: '',
                        alertsEnabled: false,
                        alertThreshold: '',
                        alertCondition: 'below',
                        emailRecipients: ''
                      });
                      setIsBenchmarkModalOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="border-slate-300 dark:border-slate-700"
                    data-testid="button-add-benchmark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Benchmark
                  </Button>
                </div>

                {(() => {
                  const dataThrough = String((linkedInCoverageResp as any)?.dataThroughUtc || "").trim() || null;
                  const lastRefreshAtRaw = (linkedInCoverageResp as any)?.lastRefreshAt;
                  const lastRefreshText = lastRefreshAtRaw ? new Date(lastRefreshAtRaw).toLocaleString() : "—";
                  const total = Array.isArray(benchmarksData) ? (benchmarksData as any[]).length : 0;
                  return (
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">Benchmarks:</span> {total}
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">LinkedIn data through:</span>{" "}
                          {dataThrough ? `${dataThrough} (UTC)` : "—"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">Last refresh:</span> {lastRefreshText}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {benchmarksLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : benchmarksData && Array.isArray(benchmarksData) && (benchmarksData as any[]).length > 0 ? (
                  <>
                    {/* Benchmark Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(benchmarksData as any[]).map((benchmark: any, index: number) => {
                        try {
                          const p = computeBenchmarkProgress(benchmark);
                          const progressPct = Math.max(0, (p.ratio || 0) * 100);
                          const progressFill = Math.min(progressPct, 100);
                          const progressColor =
                            p.status === 'on_track' ? 'bg-green-500' : p.status === 'needs_attention' ? 'bg-amber-500' : p.status === 'behind' ? 'bg-red-500' : 'bg-slate-300';
                          return (
                        <Card key={benchmark.id} data-testid={`benchmark-card-${benchmark.id}`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                    {benchmark.name}
                                  </h3>
                                  {/* Metric Type Badge */}
                                  {benchmark.metric && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                      {benchmark.metric.toUpperCase()}
                                    </Badge>
                                  )}
                                  {/* Scope Badge */}
                                  {benchmark.specificCampaignId ? (
                                    <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      Campaign: {benchmark.linkedInCampaignName || getCampaignName(benchmark.specificCampaignId)}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                      All Campaigns
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {(String(benchmark.description || '').trim() || DEFAULT_BENCHMARK_DESCRIPTION)}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  {benchmark.industry && <span>{benchmark.industry}</span>}
                                  {benchmark.category && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const inferUnitForBenchmarkMetric = (metricKey: string) => {
                                      const k = String(metricKey || '').toLowerCase();
                                      if (['ctr', 'cvr', 'er', 'roi', 'profitmargin'].includes(k)) return '%';
                                      if (['roas'].includes(k)) return '×';
                                      if (['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'totalrevenue', 'profit', 'revenueperlead'].includes(k)) return campaignCurrencySymbol;
                                      return '';
                                    };
                                    setEditingBenchmark(benchmark);
                                    const liveCurrent = getLiveCurrentForBenchmark(benchmark);
                                    setBenchmarkForm({
                                      metric: benchmark.metric || '',
                                      name: benchmark.name || '',
                                      unit: benchmark.unit || inferUnitForBenchmarkMetric(benchmark.metric),
                                      benchmarkValue: formatMetricValueForInput(benchmark.metric, benchmark.benchmarkValue || ''),
                                      currentValue: formatMetricValueForInput(benchmark.metric, String(liveCurrent)),
                                      benchmarkType: normalizeBenchmarkTypeForUI(benchmark),
                                      industry: benchmark.industry || '',
                                      description: (String(benchmark.description || '').trim() || getDefaultBenchmarkDescription(benchmark.metric)),
                                      // Some older rows may not have applyTo persisted correctly; infer from linkedInCampaignName.
                                      applyTo: benchmark.linkedInCampaignName ? 'specific' : (benchmark.applyTo || 'all'),
                                      // For "specific", the selector expects LinkedIn campaign NAME, not the DB campaignId.
                                      specificCampaignId: benchmark.linkedInCampaignName ? String(benchmark.linkedInCampaignName) : '',
                                      alertsEnabled: benchmark.alertsEnabled || false,
                                      alertThreshold: benchmark.alertThreshold ? formatNumberAsYouType(String(benchmark.alertThreshold), { maxDecimals: getMaxDecimalsForMetric(benchmark.metric || '') }) : '',
                                      alertCondition: benchmark.alertCondition || 'below',
                                      emailRecipients: benchmark.emailRecipients || ''
                                    });
                                    setIsBenchmarkModalOpen(true);
                                  }}
                                  data-testid={`button-edit-benchmark-${benchmark.id}`}
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
                                      data-testid={`button-delete-benchmark-${benchmark.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{benchmark.name}"? This will also remove the performance badge from the Overview tab. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Current Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    // Enterprise-grade: Current Value must always reflect the live Overview aggregates.
                                    const currentVal = getLiveCurrentForBenchmark(benchmark);
                                    return formatMetricValueForDisplay(benchmark.metric, currentVal);
                                  })()}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Benchmark Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    const benchVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue || '0');
                                    return formatMetricValueForDisplay(benchmark.metric, benchVal);
                                  })()}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Benchmark Source
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.industry ? `Industry Standard (${benchmark.industry})` : benchmark.source || 'Custom'}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar (accurate ratio vs benchmark; label is uncapped, bar fill capped) */}
                            {(() => {
                              if (p.status === 'blocked') {
                                return (
                                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                                    <div className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                                      <span>Progress</span>
                                      <span>Blocked</span>
                                    </div>
                                    <Progress value={0} className="mt-2 h-2" />
                                  </div>
                                );
                              }
                              return (
                                <div className="mt-4">
                                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                    <span>Progress</span>
                                    <span>{Math.round(progressPct)}%</span>
                                  </div>
                                <Progress value={progressFill} className="mt-2 h-2" indicatorClassName={progressColor} />
                                </div>
                              );
                            })()}
                            
                          </CardContent>
                        </Card>
                        );
                        } catch (error) {
                          console.error(`[MAPPING ERROR] Failed to render benchmark ${index + 1}:`, error);
                          console.error('[MAPPING ERROR] Benchmark data:', benchmark);
                          return <div key={benchmark.id} className="text-red-500 p-4 border border-red-500">Error rendering benchmark: {benchmark.name}</div>;
                        }
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No Benchmarks have been created yet.
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Ad Comparison Tab */}
              <TabsContent value="ads" className="space-y-6" data-testid="content-ads">
                {adsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : adsIsError ? (
                  <LinkedInTabErrorState
                    title="Ad comparison"
                    description="Compare creatives and ad performance"
                    message={(adsError as any)?.message || "Failed to load ad performance."}
                    onRetry={() => void refetchAds()}
                  />
                ) : adsData && (adsData as any[]).length > 0 ? (
                  (() => {
                    // Finance-grade correctness:
                    // Treat the backend as the single source of truth for sort order.
                    // The backend sorts by revenue when attributable (conversion value exists),
                    // otherwise by spend (fallback: impressions).
                    const allAds = Array.isArray(adsData) ? (adsData as any[]) : [];
                    const totalAds = allAds.length;
                    const sortedAds = allAds.slice(0, 15); // Limit to top 15 ads (backend order)
                    const isLimited = totalAds > 15;
                    const topAd = sortedAds[0];

                    // Ad-level revenue attribution requires a conversion value.
                    // Note: campaign-level revenue can exist without ad-level attribution (e.g., revenue imported but 0 conversions).
                    const hasAdLevelRevenue = aggregated?.hasRevenueTracking === 1 && Number(aggregated?.conversionValue || 0) > 0;
                    const anyEstimatedRevenue = hasAdLevelRevenue && sortedAds.some((ad: any) => Boolean(ad?._computed?.revenueIsEstimated));
                    
                    // Get selected metrics from session to ensure consistency with Overview tab
                    const selectedMetricKeys = session?.selectedMetricKeys || [];
                    
                    // Map of all possible metrics with their display properties
                    // Matches Overview tab structure: Core Metrics, Derived Metrics, Revenue Metrics
                    const allMetricsMap: Record<string, { key: string, label: string, format: (v: any) => string, category: 'core' | 'derived' | 'revenue' }> = {
                      // Core Metrics
                      impressions: { key: 'impressions', label: 'Impressions', format: formatNumber, category: 'core' },
                      clicks: { key: 'clicks', label: 'Clicks', format: formatNumber, category: 'core' },
                      spend: { key: 'spend', label: 'Spend', format: formatCurrency, category: 'core' },
                      conversions: { key: 'conversions', label: 'Conversions', format: formatNumber, category: 'core' },
                      leads: { key: 'leads', label: 'Leads', format: formatNumber, category: 'core' },
                      engagements: { key: 'engagements', label: 'Engagements', format: formatNumber, category: 'core' },
                      reach: { key: 'reach', label: 'Reach', format: formatNumber, category: 'core' },
                      videoViews: { key: 'videoViews', label: 'Video Views', format: formatNumber, category: 'core' },
                      viralImpressions: { key: 'viralImpressions', label: 'Viral Impressions', format: formatNumber, category: 'core' },
                      // Derived Metrics
                      ctr: { key: 'ctr', label: 'CTR (Click-Through Rate)', format: formatPercentage, category: 'derived' },
                      cpc: { key: 'cpc', label: 'CPC (Cost Per Click)', format: formatCurrency, category: 'derived' },
                      cpm: { key: 'cpm', label: 'CPM (Cost Per Mille)', format: formatCurrency, category: 'derived' },
                      cvr: { key: 'cvr', label: 'CVR (Conversion Rate)', format: formatPercentage, category: 'derived' },
                      cpa: { key: 'cpa', label: 'CPA (Cost Per Acquisition)', format: formatCurrency, category: 'derived' },
                      cpl: { key: 'cpl', label: 'CPL (Cost Per Lead)', format: formatCurrency, category: 'derived' },
                      er: { key: 'er', label: 'ER (Engagement Rate)', format: formatPercentage, category: 'derived' },
                      // Revenue Metrics (only if conversion value is set)
                      totalRevenue: { key: 'totalRevenue', label: 'Total Revenue', format: formatCurrency, category: 'revenue' },
                      roas: { key: 'roas', label: 'ROAS', format: (v: any) => `${parseFloat(v || 0).toFixed(2)}x`, category: 'revenue' },
                      roi: { key: 'roi', label: 'ROI', format: (v: any) => `${parseFloat(v || 0).toFixed(1)}%`, category: 'revenue' },
                      profit: { key: 'profit', label: 'Profit', format: formatCurrency, category: 'revenue' },
                      profitMargin: { key: 'profitMargin', label: 'Profit Margin', format: (v: any) => `${parseFloat(v || 0).toFixed(1)}%`, category: 'revenue' },
                      revenuePerLead: { key: 'revenuePerLead', label: 'Revenue Per Lead', format: formatCurrency, category: 'revenue' }
                    };
                    
                    // Filter available metrics based on what was actually selected during import
                    // Include core metrics, derived metrics, and revenue metrics (if available)
                    type MetricInfo = { key: string, label: string, format: (v: any) => string, category: 'core' | 'derived' | 'revenue' };
                    const availableMetrics: MetricInfo[] = [];
                    
                    // 1. Add selected core metrics
                    selectedMetricKeys.forEach((key: string) => {
                      if (allMetricsMap[key] && allMetricsMap[key].category === 'core') {
                        availableMetrics.push(allMetricsMap[key]);
                      }
                    });
                    
                    // 2. Add derived metrics based on available core metrics
                    if (selectedMetricKeys.includes('clicks') && selectedMetricKeys.includes('impressions')) {
                      availableMetrics.push(allMetricsMap.ctr);
                    }
                    if (selectedMetricKeys.includes('clicks') && selectedMetricKeys.includes('spend')) {
                      availableMetrics.push(allMetricsMap.cpc);
                    }
                    if (selectedMetricKeys.includes('impressions') && selectedMetricKeys.includes('spend')) {
                      availableMetrics.push(allMetricsMap.cpm);
                    }
                    if (selectedMetricKeys.includes('conversions') && selectedMetricKeys.includes('clicks')) {
                      availableMetrics.push(allMetricsMap.cvr);
                    }
                    if (selectedMetricKeys.includes('conversions') && selectedMetricKeys.includes('spend')) {
                      availableMetrics.push(allMetricsMap.cpa);
                    }
                    if (selectedMetricKeys.includes('leads') && selectedMetricKeys.includes('spend')) {
                      availableMetrics.push(allMetricsMap.cpl);
                    }
                    if (selectedMetricKeys.includes('engagements') && selectedMetricKeys.includes('impressions')) {
                      availableMetrics.push(allMetricsMap.er);
                    }
                    
                    // 3. Add revenue metrics if conversion value is set (required for ad-level revenue attribution)
                    if (hasAdLevelRevenue) {
                      availableMetrics.push(
                        allMetricsMap.totalRevenue,
                        allMetricsMap.roas,
                        allMetricsMap.roi,
                        allMetricsMap.profit,
                        allMetricsMap.profitMargin
                      );
                      
                      // Only add Revenue Per Lead if leads are tracked
                      if (selectedMetricKeys.includes('leads')) {
                        availableMetrics.push(allMetricsMap.revenuePerLead);
                      }
                    }
                    
                    // Remove any undefined metrics and duplicates
                    const filteredMetrics = availableMetrics
                      .filter(m => m !== undefined)
                      .filter((metric, index, self) => 
                        index === self.findIndex((m) => m.key === metric.key)
                      );

                    // Colors for each ad line
                    const adColors = [
                      '#3b82f6', // blue
                      '#10b981', // green
                      '#ef4444', // red
                      '#a855f7', // purple
                      '#f97316', // orange
                      '#6366f1', // indigo
                      '#ec4899', // pink
                      '#14b8a6', // teal
                      '#f59e0b', // amber
                      '#8b5cf6', // violet
                    ];

                    // Get the current selected metric or default to first available metric
                    const currentMetric = filteredMetrics.find((m: MetricInfo) => m.key === selectedMetric) || filteredMetrics[0];
                    
                    // If no metrics are available, show a message
                    if (!currentMetric || filteredMetrics.length === 0) {
                      return (
                        <Card data-testid="no-metrics-message">
                          <CardContent className="py-12">
                            <div className="text-center">
                              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                No Metrics Available
                              </h3>
                              <p className="text-slate-600 dark:text-slate-400">
                                The selected campaigns don't have metrics data for ad-level comparison.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Transform data: Create chart data for the selected metric only
                    // X-axis will be ad names, Y-axis will be the metric value
                    const chartData = sortedAds.map((ad, index) => {
                      const value = currentMetric.key === 'spend' || currentMetric.key === 'ctr' || currentMetric.key === 'cpc' || currentMetric.key === 'revenue' || currentMetric.key === 'cpm'
                        ? parseFloat((ad as any)[currentMetric.key] || '0')
                        : (ad as any)[currentMetric.key] || 0;
                      
                      return {
                        name: ad.adName,
                        value: value,
                        color: adColors[index % adColors.length],
                      };
                    });

                    const topMetricValue = hasAdLevelRevenue 
                      ? formatCurrency(parseFloat(topAd.revenue || '0'))
                      : formatCurrency(parseFloat(topAd.spend || '0')) || formatNumber(parseInt(topAd.impressions || '0'));
                    const topMetricLabel = hasAdLevelRevenue ? 'in revenue' : (topAd.spend ? 'in spend' : 'impressions');

                    return (
                      <div className="space-y-6">
                        {/* Revenue Tracking Notice */}
                        {!hasAdLevelRevenue && (
                          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                            <CardContent className="py-4">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="text-amber-800 dark:text-amber-300">
                                  <p className="font-semibold mb-1">Ad-level revenue requires a conversion value.</p>
                                  <p className="text-sm">
                                    Add a conversion value to attribute revenue, ROAS, ROI, and profit to individual ads. (Campaign-level revenue may still be visible in Overview.)
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {anyEstimatedRevenue && (
                          <Card className="border-slate-200 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-700">
                            <CardContent className="py-4">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                                <div className="text-slate-700 dark:text-slate-300">
                                  <p className="font-semibold mb-1">Revenue is marked as Estimated.</p>
                                  <p className="text-sm">
                                    Ad-level revenue is derived using an estimated conversion value (total imported revenue ÷ conversions for this window). Use for directional insights, not finance audit.
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Top Performer Banner */}
                        <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white" data-testid="top-performer-banner">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Trophy className="w-8 h-8" />
                                <div>
                                  <p className="text-sm opacity-90">{hasAdLevelRevenue ? 'Top Revenue Driver' : 'Top Performer'}</p>
                                  <p className="text-xl font-bold">{topAd.adName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold">{topMetricValue}</p>
                                <p className="text-sm opacity-90">{topMetricLabel}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Ad Limit Indicator */}
                        {isLimited && (
                          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                            <CardContent className="py-4">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="text-blue-800 dark:text-blue-300">
                                  <p className="font-semibold">Showing top 15 of {totalAds} ads {hasAdLevelRevenue ? 'by revenue' : 'by spend'}.</p>
                                  <p className="text-sm mt-1">Focus on optimizing your best performers for maximum ROI!</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Visual Performance Comparison */}
                        <Card data-testid="comparison-chart">
                          <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <CardTitle>Ad Performance Comparison</CardTitle>
                                <CardDescription>
                                  Select a metric to compare across all ads
                                </CardDescription>
                              </div>
                              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                <SelectTrigger className="w-[200px]" data-testid="select-metric">
                                  <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredMetrics.map((metric: MetricInfo) => (
                                    <SelectItem key={metric.key} value={metric.key}>
                                      {metric.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={450}>
                              <BarChart 
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="name" 
                                  tick={{ fontSize: 12 }} 
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={(value) => currentMetric.format(value)}
                                />
                                <Tooltip 
                                  formatter={(value: any) => currentMetric.format(value)}
                                  labelStyle={{ color: '#000' }}
                                />
                                <Bar 
                                  dataKey="value" 
                                  name={currentMetric.label}
                                  radius={[8, 8, 0, 0]}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            
                            {/* Ad Details Cards */}
                            <div className="mt-6 space-y-3">
                              {sortedAds.map((ad, index) => {
                                const isTop = index === 0;
                                const isBottom = index === sortedAds.length - 1 && sortedAds.length > 2;
                                // Show revenue if available, otherwise show spend or impressions
                                const displayValue = hasAdLevelRevenue 
                                  ? parseFloat(ad.revenue || '0')
                                  : (parseFloat(ad.spend || '0') || parseInt(ad.impressions || '0'));
                                const displayLabel = hasAdLevelRevenue ? 'Revenue' : (ad.spend ? 'Spend' : 'Impressions');
                                const displayFormat = hasAdLevelRevenue || ad.spend ? formatCurrency : formatNumber;
                                const showEstimated = hasAdLevelRevenue && Boolean((ad as any)?._computed?.revenueIsEstimated);

                                return (
                                  <div 
                                    key={ad.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      isTop ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                                      isBottom ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 
                                      'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                                    }`}
                                    data-testid={`ad-detail-${index}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                                        style={{ backgroundColor: adColors[index % adColors.length] }}
                                      >
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-semibold text-slate-900 dark:text-white">{ad.adName}</h4>
                                          {isTop && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">TOP</span>}
                                          {showEstimated && (
                                            <span
                                              className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5 rounded"
                                              title="Estimated: revenue derived using an estimated conversion value"
                                            >
                                              Estimated
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm text-slate-500">{ad.campaignName}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-slate-500">{displayLabel}</p>
                                      <p className={`text-xl font-bold ${hasAdLevelRevenue ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                        {displayFormat(displayValue)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Quick Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {hasAdLevelRevenue ? (
                            <>
                              <Card data-testid="total-revenue-stat">
                                <CardContent className="pt-6">
                                  <p className="text-sm text-slate-500 mb-1">Total Revenue {isLimited && '(All Ads)'}</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(allAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0))}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card data-testid="avg-revenue-stat">
                                <CardContent className="pt-6">
                                  <p className="text-sm text-slate-500 mb-1">Average Revenue/Ad {isLimited && '(All Ads)'}</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(allAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0) / Math.max(1, allAds.length))}
                                  </p>
                                </CardContent>
                              </Card>
                            </>
                          ) : (
                            <>
                              <Card data-testid="total-spend-stat">
                                <CardContent className="pt-6">
                                  <p className="text-sm text-slate-500 mb-1">Total Spend {isLimited && '(All Ads)'}</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {(() => {
                                      // Keep Ad Comparison "Total Spend" consistent with Overview when daily facts exist.
                                      // This represents spend-to-date across imported days (same source as Insights/Overview).
                                      if (useDailyTotalsForOverview && coverageTotals && Number.isFinite(Number(coverageTotals?.spend))) {
                                        return formatCurrency(Number(coverageTotals.spend || 0));
                                      }
                                      // Fallback (brand-new campaigns before daily facts exist): sum the ad spends for this session.
                                      return formatCurrency(allAds.reduce((sum, ad) => sum + parseFloat(ad.spend || '0'), 0));
                                    })()}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card data-testid="total-conversions-stat">
                                <CardContent className="pt-6">
                                  <p className="text-sm text-slate-500 mb-1">Total Conversions {isLimited && '(All Ads)'}</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatNumber(allAds.reduce((sum, ad) => sum + parseInt(ad.conversions || '0'), 0))}
                                  </p>
                                </CardContent>
                              </Card>
                            </>
                          )}
                          <Card data-testid="total-ads-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Total Ads {isLimited ? 'Available' : 'Compared'}</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalAds}</p>
                              {isLimited && (
                                <p className="text-xs text-slate-500 mt-1">Showing top 15</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-500">No ad performance data available</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6" data-testid="content-reports">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Create, schedule, and manage analytics reports
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                  <Button 
                    data-testid="button-create-report" 
                    className="gap-2"
                    onClick={() => {
                      setEditingReportId(null);
                      setReportModalStep('standard');
                      setReportForm({
                        name: '',
                        description: '',
                        reportType: '',
                        configuration: null,
                        scheduleEnabled: false,
                        scheduleFrequency: 'daily',
                        scheduleDayOfWeek: 'monday',
                        scheduleDayOfMonth: 'first',
                        quarterTiming: 'end',
                        scheduleTime: '9:00 AM',
                        emailRecipients: '',
                        status: 'draft'
                      });
                      setCustomReportConfig({
                        coreMetrics: [],
                        derivedMetrics: [],
                        kpis: [],
                        benchmarks: [],
                        includeAdComparison: false,
                        adComparisonMetrics: [],
                        insightsSections: [],
                        includeCampaignBreakdown: false,
                        campaignBreakdownCampaigns: [],
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
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : reportsIsError ? (
                  <LinkedInTabErrorState
                    title="Reports"
                    description="Create, schedule, and manage analytics reports"
                    message={(reportsError as any)?.message || "Failed to load reports."}
                    onRetry={() => void refetchReports()}
                  />
                ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {(reportsData as any[]).map((report: any) => (
                      <Card key={report.id} data-testid={`report-${report.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                                {report.name}
                              </h3>
                              {report.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                  {report.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <Badge variant="outline">{report.reportType}</Badge>
                                {report.scheduleEnabled && report.scheduleFrequency && (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {(() => {
                                      const time = report.scheduleTime ? from24HourTo12Hour(report.scheduleTime) : '';
                                      const tz = String(report.scheduleTimeZone || '').trim();
                                      const timeLabel = time ? ` at ${time}${tz ? ` ${tz}` : ''}` : '';
                                      return `${report.scheduleFrequency}${timeLabel}`;
                                    })()}
                                  </span>
                                )}
                                {report.lastSentAt && (
                                  <span className="text-slate-500">
                                    Last sent {new Date(report.lastSentAt).toLocaleDateString()}
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  Created {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                data-testid={`button-download-${report.id}`}
                                onClick={() => handleDownloadSavedReport(report)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                data-testid={`button-edit-${report.id}`}
                                onClick={() => handleEditReport(report)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    data-testid={`button-delete-${report.id}`}
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
                                      data-testid={`confirm-delete-${report.id}`}
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
                        <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No reports created yet</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                          Create your first report to get started
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <LinkedInKpiModal
        isKPIModalOpen={isKPIModalOpen}
        setIsKPIModalOpen={setIsKPIModalOpen}
        setModalStep={setModalStep}
        setSelectedTemplate={setSelectedTemplate}
        editingKPI={editingKPI}
        setEditingKPI={setEditingKPI}
        kpiForm={kpiForm}
        setKpiForm={setKpiForm}
        aggregated={aggregated}
        openAddRevenueModal={openAddRevenueModal}
        toast={toast}
        sessionData={sessionData}
        campaignCurrencySymbol={campaignCurrencySymbol}
        availableCampaigns={availableCampaigns}
        KPI_DESC_MAX={KPI_DESC_MAX}
        getDefaultKpiDescription={getDefaultKpiDescription}
        formatNumberAsYouType={formatNumberAsYouType}
        getMaxDecimalsForMetric={getMaxDecimalsForMetric}
        handleCreateKPI={handleCreateKPI}
      />

      {/* Benchmark Modal */}
      <LinkedInBenchmarkModal
        isBenchmarkModalOpen={isBenchmarkModalOpen}
        setIsBenchmarkModalOpen={setIsBenchmarkModalOpen}
        editingBenchmark={editingBenchmark}
        setEditingBenchmark={setEditingBenchmark}
        benchmarkForm={benchmarkForm}
        setBenchmarkForm={setBenchmarkForm}
        aggregated={aggregated}
        openAddRevenueModal={openAddRevenueModal}
        toast={toast}
        devLog={devLog}
        campaignCurrencySymbol={campaignCurrencySymbol}
        getCampaignSpecificMetrics={getCampaignSpecificMetrics}
        getBenchmarkModalCurrentValue={getBenchmarkModalCurrentValue}
        getBenchmarkUnitForMetric={getBenchmarkUnitForMetric}
        getDefaultBenchmarkDescription={getDefaultBenchmarkDescription}
        BENCHMARK_DESC_MAX={BENCHMARK_DESC_MAX}
        industries={industries}
        isCurrencyLikeMetric={isCurrencyLikeMetric}
        getBenchmarkValueFallback={getBenchmarkValueFallback}
        formatMetricValueForInput={formatMetricValueForInput}
        formatNumberAsYouType={formatNumberAsYouType}
        getMaxDecimalsForMetric={getMaxDecimalsForMetric}
        DEFAULT_BENCHMARK_DESCRIPTION={DEFAULT_BENCHMARK_DESCRIPTION}
        handleCreateBenchmark={handleCreateBenchmark}
        availableCampaigns={availableCampaigns}
        selectedCampaignDetails={selectedCampaignDetails}
        campaignData={campaignData}
        benchmarks={benchmarks}
        renderPerformanceBadge={renderPerformanceBadge}
        formatCurrency={formatCurrency}
        formatPercentage={formatPercentage}
        formatNumber={formatNumber}
      />

      <LinkedInCampaignDetailsModal
        isCampaignDetailsModalOpen={isCampaignDetailsModalOpen}
        setIsCampaignDetailsModalOpen={setIsCampaignDetailsModalOpen}
        selectedCampaignDetails={selectedCampaignDetails}
        aggregated={aggregated}
        campaignData={campaignData}
        benchmarks={benchmarks}
        renderPerformanceBadge={renderPerformanceBadge}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
        formatPercentage={formatPercentage}
      />

      {/* Create Report Modal */}
      <LinkedInReportModal
        isReportModalOpen={isReportModalOpen}
        setIsReportModalOpen={setIsReportModalOpen}
        reportModalStep={reportModalStep}
        setReportModalStep={setReportModalStep}
        editingReportId={editingReportId}
        setEditingReportId={setEditingReportId}
        reportForm={reportForm}
        setReportForm={setReportForm}
        reportFormErrors={reportFormErrors}
        setReportFormErrors={setReportFormErrors}
        customReportConfig={customReportConfig}
        setCustomReportConfig={setCustomReportConfig}
        aggregated={aggregated}
        metrics={metrics}
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

      {/* Campaign Details Modal (disabled - duplicate; canonical modal is `LinkedInCampaignDetailsModal`) */}
      {false && null}
      {/* Duplicate Campaign Details modal removed (canonical modal is `LinkedInCampaignDetailsModal`). */}

      {/* LinkedIn revenue CSV wizard (standard flow) */}
      {campaignId && (
        <AddRevenueWizardModal
          open={isRevenueWizardOpen}
          onOpenChange={setIsRevenueWizardOpen}
          campaignId={campaignId}
          currency={(campaign as any)?.currency || "USD"}
          dateRange={"to_date"}
          platformContext="linkedin"
          initialStep={revenueWizardInitialStep as any}
          initialSource={revenueWizardInitialSource || undefined}
          onSuccess={() => {
            // Recompute LinkedIn metrics after revenue import
            queryClient.invalidateQueries({ queryKey: ["/api/linkedin/metrics", campaignId] });
            queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'] });
            // Force immediate recompute (no waiting)
            queryClient.refetchQueries({ queryKey: ["/api/linkedin/metrics", campaignId], exact: true });
            queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId], exact: true });
            queryClient.refetchQueries({ queryKey: ['/api/linkedin/imports', sessionId, 'ads'], exact: true });
          }}
        />
      )}

      {campaignId && (
        <SalesforceDataViewerModal
          open={isSalesforceViewerOpen}
          onOpenChange={setIsSalesforceViewerOpen}
          campaignId={campaignId}
          sourceId={salesforceViewerSourceId}
        />
      )}

      {/* HubSpot Revenue Wizard (OAuth happens first; wizard starts at campaign field) */}
      {campaignId && (
        <Dialog open={isHubspotRevenueWizardOpen} onOpenChange={setIsHubspotRevenueWizardOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>HubSpot Revenue Metrics</DialogTitle>
              <DialogDescription>
                Choose Deal fields and process revenue metrics for this campaign.
              </DialogDescription>
            </DialogHeader>
            <HubSpotRevenueWizard
              campaignId={campaignId}
              platformContext="linkedin"
              onBack={() => setIsHubspotRevenueWizardOpen(false)}
              onClose={() => {
                setIsHubspotRevenueWizardOpen(false);
                void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
                void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
              }}
              onSuccess={() => {
                setIsHubspotRevenueWizardOpen(false);
                void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
                void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Shopify Viewer */}
      {campaignId && (
        <ShopifyDataViewerModal
          open={isShopifyViewerOpen}
          onOpenChange={setIsShopifyViewerOpen}
          campaignId={campaignId}
        />
      )}

      {/* Shopify Revenue Wizard */}
      {campaignId && (
        <Dialog open={isShopifyRevenueWizardOpen} onOpenChange={setIsShopifyRevenueWizardOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Shopify Revenue Metrics</DialogTitle>
              <DialogDescription>
                Choose order attribution fields and process revenue metrics for this campaign.
              </DialogDescription>
            </DialogHeader>
            <ShopifyRevenueWizard
              campaignId={campaignId}
              platformContext="linkedin"
              onBack={() => setIsShopifyRevenueWizardOpen(false)}
              onClose={() => {
                setIsShopifyRevenueWizardOpen(false);
                void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
                void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
              }}
              onSuccess={() => {
                setIsShopifyRevenueWizardOpen(false);
                void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
                void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports', sessionId] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      </div>
    </TooltipProvider>
    </LinkedInErrorBoundary>
  );
}

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [, setLocation] = useLocation();
  const campaignId = String(params?.id || "").trim();

  // The app historically had a global `/linkedin-analytics` route used as a fallback.
  // LinkedIn analytics is campaign-scoped; without a campaignId we show a safe landing state.
  if (!campaignId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto">
              <LinkedInTabEmptyState
                title="Select a campaign"
                description="LinkedIn analytics is campaign-scoped."
                message="Open LinkedIn analytics from a Campaign to see Overview metrics, KPIs, Benchmarks, and Ads."
                primaryAction={{ label: "Go to Campaigns", onClick: () => setLocation("/campaigns") }}
              />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return <LinkedInAnalyticsCampaign campaignId={campaignId} />;
}

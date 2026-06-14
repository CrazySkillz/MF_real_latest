import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MousePointerClick, DollarSign, Target, Plus, FileText, TrendingUp, Users, Activity, FileSpreadsheet, Clock, BarChart3, Mail, TrendingDown, Zap, Link2, CheckCircle2, AlertCircle, AlertTriangle, Pencil, Trash2, Trophy, Download, Settings, Copy, Upload } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatTimeAgo } from "@/lib/utils";
import { formatPct } from "@shared/metric-math";
import { computeAttainmentFillPct, computeAttainmentPct, computeEffectiveDeltaPct, classifyKpiBand, isLowerIsBetterKpi } from "@shared/kpi-math";

interface CustomIntegrationConnection {
  id?: string;
  campaignId?: string;
  email?: string;
}

type CustomIntegrationMetricType = 'count' | 'currency' | 'percent' | 'duration' | 'ratio';

type CustomIntegrationSourceScope = {
  platform: 'custom_integration';
  scopeType: 'latest_validated_import';
  integrationId: string | null;
  campaignId: string;
  selectedImportId: string | null;
  sourceLabel: string;
};

interface CustomIntegrationMetricOption {
  key: string;
  label: string;
  unit: string;
  type: CustomIntegrationMetricType;
  fields?: string[];
}

const CUSTOM_INTEGRATION_METRIC_OPTIONS: CustomIntegrationMetricOption[] = [
  { key: 'users', label: 'Users', unit: '', type: 'count' },
  { key: 'sessions', label: 'Sessions', unit: '', type: 'count' },
  { key: 'pageviews', label: 'Pageviews', unit: '', type: 'count' },
  { key: 'pagesPerSession', label: 'Pages / Session', unit: '', type: 'count' },
  { key: 'bounceRate', label: 'Bounce Rate', unit: '%', type: 'percent' },
  { key: 'organicSearchShare', label: 'Organic Search', unit: '%', type: 'percent' },
  { key: 'directBrandedShare', label: 'Direct / Branded', unit: '%', type: 'percent' },
  { key: 'emailShare', label: 'Email Traffic', unit: '%', type: 'percent' },
  { key: 'referralShare', label: 'Referral / Partners', unit: '%', type: 'percent' },
  { key: 'paidShare', label: 'Paid Traffic', unit: '%', type: 'percent' },
  { key: 'socialShare', label: 'Social Traffic', unit: '%', type: 'percent' },
  { key: 'emailsDelivered', label: 'Emails Delivered', unit: '', type: 'count' },
  { key: 'openRate', label: 'Email Open Rate', unit: '%', type: 'percent' },
  { key: 'clickThroughRate', label: 'Email CTR', unit: '%', type: 'percent' },
  { key: 'clickToOpen', label: 'Email CTOR', unit: '%', type: 'percent', fields: ['clickToOpenRate', 'clickToOpen'] },
  { key: 'listGrowth', label: 'List Growth', unit: '', type: 'count' },
  { key: 'impressions', label: 'Impressions', unit: '', type: 'count' },
  { key: 'clicks', label: 'Clicks', unit: '', type: 'count' },
  { key: 'conversions', label: 'Conversions', unit: '', type: 'count' },
  { key: 'leads', label: 'Leads', unit: '', type: 'count' },
  { key: 'spend', label: 'Spend', unit: '$', type: 'currency' },
  { key: 'revenue', label: 'Revenue', unit: '$', type: 'currency' },
  { key: 'roi', label: 'ROI', unit: '%', type: 'percent' },
  { key: 'roas', label: 'ROAS', unit: 'x', type: 'ratio' },
];

const CUSTOM_INTEGRATION_OVERVIEW_GROUPS = [
  { title: 'Financial Metrics', icon: DollarSign, metricKeys: ['revenue', 'spend', 'roas', 'roi'], showUnavailable: true },
  { title: 'Campaign Metrics', icon: Activity, metricKeys: ['impressions', 'clicks', 'conversions', 'leads'] },
  { title: 'Audience & Traffic', icon: Users, metricKeys: ['users', 'sessions', 'pageviews', 'pagesPerSession', 'bounceRate'] },
  { title: 'Traffic Sources', icon: BarChart3, metricKeys: ['organicSearchShare', 'directBrandedShare', 'emailShare', 'referralShare', 'paidShare', 'socialShare'] },
  { title: 'Email & Newsletter Performance', icon: Mail, metricKeys: ['emailsDelivered', 'openRate', 'clickThroughRate', 'clickToOpen', 'listGrowth'] },
];

const CUSTOM_INTEGRATION_KPI_NEAR_TARGET_BAND_PCT = 5;

function createEmptyCustomIntegrationKpiForm() {
  return {
    name: '',
    description: '',
    category: 'performance',
    metric: '',
    targetValue: '',
    currentValue: '',
    unit: '',
    priority: 'medium',
    status: 'active',
    timeframe: 'monthly',
    alertsEnabled: false,
    emailNotifications: false,
    alertFrequency: 'immediate',
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  };
}

function parseCustomIntegrationSavedConfig(value: any) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? value : null;
}

function getSavedCustomIntegrationSourceScope(row: any): CustomIntegrationSourceScope | null {
  const config = parseCustomIntegrationSavedConfig(row?.calculationConfig);
  const scope = config?.sourceScope;
  return scope?.platform === 'custom_integration' ? scope : null;
}

function cleanCustomIntegrationNumberInput(value: any): string {
  return String(value || '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
}

function getCustomIntegrationUnitLabel(unit?: string, type?: CustomIntegrationMetricType): string {
  if (unit) return unit;
  if (type === 'count') return 'count';
  return '';
}

function formatCustomIntegrationNumberInput(value: any, unit?: string): string {
  const cleaned = cleanCustomIntegrationNumberInput(value);
  if (!cleaned || cleaned === '-') return cleaned;
  const negative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const [integerPart, ...decimalParts] = unsigned.split('.');
  const normalizedInteger = (integerPart || '0').replace(/^0+(?=\d)/, '');
  const groupedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalValue = decimalParts.join('');
  const decimal = decimalParts.length > 0 && !(unit === 'count' && /^0*$/.test(decimalValue)) ? `.${decimalValue}` : '';
  return `${negative ? '-' : ''}${groupedInteger}${decimal}`;
}

function normalizeCustomIntegrationKpiFormValue(key: string, value: any): string {
  if (['targetValue', 'benchmarkValue', 'currentValue', 'alertThreshold'].includes(key)) {
    const parsed = parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(value));
    return parsed === null ? '' : String(parsed);
  }
  return String(value ?? '').trim();
}

function parseCustomIntegrationMetricNumber(value: any): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/,/g, '').replace(/[$%x]/gi, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getCustomIntegrationMetricOption(metricKey: any): CustomIntegrationMetricOption | undefined {
  const key = String(metricKey || '').trim();
  return CUSTOM_INTEGRATION_METRIC_OPTIONS.find((option) =>
    option.key === key || (option.fields || []).includes(key)
  );
}

function getCustomIntegrationRawMetric(metrics: any, option: CustomIntegrationMetricOption): any {
  const fields = option.fields || [option.key];
  for (const field of fields) {
    const value = metrics?.[field];
    if (value !== null && typeof value !== 'undefined' && value !== '') return value;
  }
  return null;
}

function getCustomIntegrationSourceLabel(metrics: any): string {
  if (metrics?.pdfFileName) return `Import: ${metrics.pdfFileName}`;
  if (metrics?.emailSubject) return `Import: ${metrics.emailSubject}`;
  if (metrics?.uploadedAt) return `Import: ${new Date(metrics.uploadedAt).toLocaleString()}`;
  return 'Custom Integration source';
}

function getCustomIntegrationParserMetadata(metrics: any) {
  const raw = metrics?.parserMetadata;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function resolveCustomIntegrationMetric(metrics: any, metricKey: any) {
  const option = getCustomIntegrationMetricOption(metricKey);
  const sourceLabel = getCustomIntegrationSourceLabel(metrics);
  if (!option) {
    return { available: false, currentValue: null as number | null, unit: '', option: undefined, sourceLabel, reason: 'Metric is not supported by Custom Integration.' };
  }

  if (option.key === 'roi' || option.key === 'roas') {
    const revenue = parseCustomIntegrationMetricNumber(metrics?.revenue);
    const spend = parseCustomIntegrationMetricNumber(metrics?.spend);
    if (revenue === null) {
      return { available: false, currentValue: null as number | null, unit: option.unit, option, sourceLabel, reason: 'Revenue is not available in the selected Custom Integration import.' };
    }
    if (spend === null || spend <= 0) {
      return { available: false, currentValue: null as number | null, unit: option.unit, option, sourceLabel, reason: 'Spend is not available in the selected Custom Integration import.' };
    }
    const currentValue = option.key === 'roi' ? ((revenue - spend) / spend) * 100 : revenue / spend;
    return { available: true, currentValue, unit: option.unit, option, sourceLabel, reason: '' };
  }

  const currentValue = parseCustomIntegrationMetricNumber(getCustomIntegrationRawMetric(metrics, option));
  if (currentValue === null) {
    return { available: false, currentValue: null as number | null, unit: option.unit, option, sourceLabel, reason: `${option.label} is not available in the selected Custom Integration import.` };
  }

  return { available: true, currentValue, unit: option.unit, option, sourceLabel, reason: '' };
}

function formatCustomIntegrationMetricValue(value: number | null, unit: string, type?: CustomIntegrationMetricType): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  if (type === 'currency' || unit === '$') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  if (type === 'percent' || unit === '%') return `${value.toFixed(1)}%`;
  if (type === 'ratio' || unit === 'x') return `${value.toFixed(2)}x`;
  return new Intl.NumberFormat('en-US').format(value);
}

// Helper function to calculate expected progress based on timeframe
function calculateExpectedProgress(timeframe: string): number {
  const now = new Date();
  
  switch(timeframe) {
    case 'daily': {
      // Calculate progress through the current day (0-100%)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return ((hours * 60 + minutes) / (24 * 60)) * 100;
    }
    case 'weekly': {
      // Calculate progress through the current week (0-100%)
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const hours = now.getHours();
      return ((dayOfWeek * 24 + hours) / (7 * 24)) * 100;
    }
    case 'monthly': {
      // Calculate progress through the current month (0-100%)
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return (dayOfMonth / daysInMonth) * 100;
    }
    case 'quarterly': {
      // Calculate progress through the current quarter (0-100%)
      const month = now.getMonth(); // 0-11
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const daysSinceQuarterStart = Math.floor((now.getTime() - new Date(now.getFullYear(), quarterStartMonth, 1).getTime()) / (1000 * 60 * 60 * 24));
      return (daysSinceQuarterStart / 90) * 100;
    }
    case 'yearly': {
      // Calculate progress through the current year (0-100%)
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const daysSinceYearStart = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const isLeapYear = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || (now.getFullYear() % 400 === 0);
      const daysInYear = isLeapYear ? 366 : 365;
      return (daysSinceYearStart / daysInYear) * 100;
    }
    default:
      return 100; // Default to 100% if timeframe is unknown
  }
}

export default function CustomIntegrationAnalytics() {
  const [matchCampaignRoute, campaignParams] = useRoute("/campaigns/:id/custom-integration-analytics");
  const [matchIntegrationRoute, integrationParams] = useRoute("/integrations/:id/analytics");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Determine if we're on the campaign route or integration route
  const integrationId = integrationParams?.id;
  
  // Fetch integration data to get the campaign_id when accessed via integration route
  const { data: integrationData, isLoading: integrationLoading } = useQuery({
    queryKey: ["/api/custom-integration-by-id", integrationId],
    queryFn: async () => {
      console.log('[Integration Query] Fetching integration ID:', integrationId);
      const res = await fetch(`/api/custom-integration-by-id/${integrationId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('[Integration Query] Failed:', res.status, res.statusText);
        throw new Error('Failed to fetch integration');
      }
      const data = await res.json();
      console.log('[Integration Query] Fetched integration data:', data);
      return data;
    },
    enabled: !!integrationId,
    staleTime: 0,
  });
  
  // Get campaign ID from either route
  // For campaign route, use ID directly. For integration route, use campaign_id from integration data
  const campaignId = matchCampaignRoute ? campaignParams?.id : integrationData?.campaign_id;
  
  console.log('[Route Debug] matchCampaignRoute:', matchCampaignRoute);
  console.log('[Route Debug] matchIntegrationRoute:', matchIntegrationRoute);
  console.log('[Route Debug] campaignParams:', campaignParams);
  console.log('[Route Debug] integrationParams:', integrationParams);
  console.log('[Route Debug] integrationId:', integrationId);
  console.log('[Route Debug] integrationData:', integrationData);
  console.log('[Route Debug] integrationLoading:', integrationLoading);
  console.log('[Route Debug] campaignId:', campaignId);

  // KPI state management
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState(createEmptyCustomIntegrationKpiForm);
  const [initialKpiForm, setInitialKpiForm] = useState<any>(null);

  // Benchmark state management
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    category: 'performance',
    benchmarkType: '',
    competitorName: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    industry: '',
    description: '',
    source: '',
    geographicLocation: '',
    period: 'monthly',
    confidenceLevel: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });
  const [initialBenchmarkForm, setInitialBenchmarkForm] = useState<any>(null);

  // Report state management
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom'>('standard');
  const [reportForm, setReportForm] = useState({
    name: '',
    description: '',
    reportType: '',
    configuration: null as any,
    scheduleEnabled: false,
    scheduleFrequency: 'weekly',
    scheduleDayOfWeek: 'monday',
    scheduleTime: '9:00 AM',
    emailRecipients: '',
    status: 'draft'
  });
  const [customReportConfig, setCustomReportConfig] = useState({
    coreMetrics: [] as string[],
    derivedMetrics: [] as string[],
    kpis: [] as string[],
    benchmarks: [] as string[]
  });
  
  // Detect user's time zone
  const [userTimeZone, setUserTimeZone] = useState('');
  
  useEffect(() => {
    // Detect time zone from browser
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimeZone(detectedTimeZone);
  }, []);

  // Sync kpiForm when editingKPI changes
  useEffect(() => {
    if (editingKPI) {
      const metricKey = String(editingKPI.metric || editingKPI.metricKey || '').trim();
      const resolvedCurrent = metricKey && metricKey !== 'custom'
        ? resolveCustomIntegrationCurrentValue({ ...editingKPI, metric: metricKey })
        : null;
      const formData = {
        name: editingKPI.name,
        description: editingKPI.description || '',
        category: editingKPI.category || 'performance',
        metric: metricKey,
        targetValue: editingKPI.targetValue || '',
        currentValue: resolvedCurrent
          ? (resolvedCurrent.available && resolvedCurrent.currentValue !== null ? String(resolvedCurrent.currentValue) : '')
          : editingKPI.currentValue || '',
        unit: resolvedCurrent
          ? getCustomIntegrationUnitLabel(resolvedCurrent.unit, resolvedCurrent.option?.type)
          : editingKPI.unit || '',
        priority: editingKPI.priority || 'medium',
        status: editingKPI.status || 'active',
        timeframe: editingKPI.timeframe || 'monthly',
        alertsEnabled: editingKPI.alertsEnabled || false,
        emailNotifications: editingKPI.emailNotifications || Boolean(editingKPI.emailRecipients),
        alertFrequency: editingKPI.alertFrequency || 'immediate',
        alertThreshold: editingKPI.alertThreshold || '',
        alertCondition: editingKPI.alertCondition || 'below',
        emailRecipients: editingKPI.emailRecipients || ''
      };
      
      setKpiForm(formData);
      setInitialKpiForm(formData);
      
      // Open modal if not already open
      if (!isKPIModalOpen) {
        setTimeout(() => setIsKPIModalOpen(true), 0);
      }
    }
  }, [editingKPI]);

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
  
  // Fetch campaign details
  const { data: campaign } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch custom integration connection
  const { data: customIntegration } = useQuery<CustomIntegrationConnection>({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch latest metrics from database
  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics, error: metricsError } = useQuery({
    queryKey: ["/api/custom-integration", campaignId, "metrics"],
    queryFn: async () => {
      console.log('[Metrics Query] Fetching metrics for campaign:', campaignId);
      const res = await fetch(`/api/custom-integration/${campaignId}/metrics`, {
        credentials: 'include',
      });
      
      // If 404, return null (no metrics yet)
      if (res.status === 404) {
        console.log('[Metrics Query] No metrics found (404) - showing Awaiting Data state');
        return null;
      }
      
      if (!res.ok) {
        console.error('[Metrics Query] Failed:', res.status, res.statusText);
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await res.json();
      console.log('[Metrics Query] Fetched metrics:', data);
      return data;
    },
    enabled: !!campaignId,
    retry: false, // Don't retry on 404
  });

  // Auto-refresh when awaiting data (poll every 10 seconds)
  useEffect(() => {
    const hasAnyMetrics = metricsData && (
      metricsData.users != null ||
      metricsData.sessions != null ||
      metricsData.pageviews != null ||
      metricsData.impressions != null ||
      metricsData.clicks != null ||
      metricsData.conversions != null
    );

    if (!hasAnyMetrics && !metricsLoading && campaignId) {
      console.log('[Auto-Refresh] No metrics yet, starting polling...');
      const interval = setInterval(() => {
        console.log('[Auto-Refresh] Polling for new metrics...');
        refetchMetrics();
      }, 10000); // 10 seconds

      return () => {
        console.log('[Auto-Refresh] Stopping polling');
        clearInterval(interval);
      };
    }
  }, [metricsData, metricsLoading, campaignId, refetchMetrics]);

  // Fetch platform-level KPIs for custom integration filtered by campaignId
  const kpiQueryKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: [kpiQueryKey],
    enabled: !!kpiQueryKey,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Fetch platform-level Benchmarks for custom integration filtered by campaignId
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId],
    queryFn: async () => {
      const url = `/api/platforms/custom-integration/benchmarks?campaignId=${campaignId}`;
      console.log('[Benchmarks Query] Fetching with URL:', url);
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch benchmarks');
      const data = await res.json();
      console.log('[Benchmarks Query] Response data:', data);
      return data;
    },
    enabled: !!campaignId,
  });

  // Use real metrics if available, otherwise show placeholder
  const metrics = metricsData || {};

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/kpis', kpiData);
      return res.json();
    },
    onSuccess: (data: any) => {
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      }
      
      // DEBUGGING: Show debug info
      if (data.__debug) {
        console.log('[KPI Created] Debug Info:', data.__debug);
        toast({
          title: "KPI Created - DEBUG",
          description: `Received: ${data.__debug.receivedCampaignId} (${data.__debug.receivedCampaignIdType}), Saved: ${data.__debug.savedCampaignId}`,
        });
      } else {
        toast({
          title: "KPI Created",
          description: "Your KPI has been successfully created.",
        });
      }
      
      setIsKPIModalOpen(false);
      setKpiForm(createEmptyCustomIntegrationKpiForm());
      setInitialKpiForm(null);
    },
  });

  // Update KPI mutation
  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log('=== UPDATE KPI MUTATION ===');
      console.log('KPI ID:', id);
      console.log('Data to send:', data);
      const res = await apiRequest('PATCH', `/api/platforms/custom-integration/kpis/${id}`, data);
      console.log('Response status:', res.status);
      const result = await res.json();
      console.log('Response data:', result);
      return result;
    },
    onSuccess: async () => {
      console.log('KPI update successful! Invalidating cache and refetching...');
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        // Remove from cache and force refetch
        await queryClient.invalidateQueries({ 
          queryKey: [invalidateKey],
          refetchType: 'all' 
        });
        await queryClient.refetchQueries({ 
          queryKey: [invalidateKey]
        });
      }
      console.log('Cache invalidated and refetch complete');
      toast({
        title: "KPI Updated",
        description: "Your KPI has been successfully updated.",
      });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      setKpiForm(createEmptyCustomIntegrationKpiForm());
      setInitialKpiForm(null);
    },
    onError: (error: any) => {
      console.error('=== KPI UPDATE ERROR ===');
      console.error('Error:', error);
      toast({
        title: "Error Updating KPI",
        description: error?.message || "Failed to update KPI. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/kpis/${id}`);
      return res.json();
    },
    onSuccess: () => {
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      }
      toast({
        title: "KPI Deleted",
        description: "The KPI has been successfully deleted.",
      });
    },
  });

  const isKpiFormDirty = editingKPI && initialKpiForm
    ? Object.keys(initialKpiForm).some((key) =>
      normalizeCustomIntegrationKpiFormValue(key, (kpiForm as any)[key]) !==
        normalizeCustomIntegrationKpiFormValue(key, initialKpiForm[key])
    )
    : true;

  // Handle KPI form submission
  const handleKPISubmit = () => {
    if (editingKPI && !isKpiFormDirty) {
      return;
    }

    if (!campaignId) {
      toast({
        title: "Error",
        description: "Campaign ID not available. Please wait for the page to fully load.",
        variant: "destructive",
      });
      return;
    }

    if (!kpiForm.name || !kpiForm.metric || !kpiForm.targetValue) {
      toast({
        title: "Required Fields",
        description: "Please select a KPI template, enter a KPI name, and set a target value.",
        variant: "destructive",
      });
      return;
    }

    const targetValue = parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(kpiForm.targetValue));
    if (targetValue === null) {
      toast({
        title: "Invalid Target",
        description: "Please enter a valid numeric target value.",
        variant: "destructive",
      });
      return;
    }

    if (kpiForm.alertsEnabled && !kpiForm.alertThreshold) {
      toast({
        title: "Alert Threshold Required",
        description: "Please set an alert threshold value.",
        variant: "destructive",
      });
      return;
    }
    if (kpiForm.alertsEnabled && kpiForm.emailNotifications && !String(kpiForm.emailRecipients || '').trim()) {
      toast({
        title: "Email Recipients Required",
        description: "Please enter at least one email address for KPI alert notifications.",
        variant: "destructive",
      });
      return;
    }

    const isCustomKpi = kpiForm.metric === 'custom';
    const metricOption = isCustomKpi ? null : resolveCustomIntegrationMetric(metricsData, kpiForm.metric);
    if (!isCustomKpi && (!metricOption?.available || metricOption.currentValue === null)) {
      toast({
        title: "Metric Unavailable",
        description: metricOption?.reason || "Select a Custom Integration metric with a current source-backed value.",
        variant: "destructive",
      });
      return;
    }
    if (!isCustomKpi && !activeCustomIntegrationSourceScope) {
      toast({
        title: "Source Unavailable",
        description: "The active Custom Integration source is not loaded yet. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const manualCurrentValue = parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(kpiForm.currentValue));
    const alertThreshold = kpiForm.alertThreshold
      ? parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(kpiForm.alertThreshold))
      : null;
    const payload = {
      ...kpiForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
      targetValue,
      currentValue: isCustomKpi ? (manualCurrentValue ?? '') : metricOption?.currentValue,
      alertThreshold,
      emailRecipients: kpiForm.emailRecipients ? kpiForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean).join(', ') : null,
      metricKey: isCustomKpi ? null : kpiForm.metric,
      sourceType: isCustomKpi ? 'manual' : 'platform',
      calculationConfig: isCustomKpi
        ? {
          source: 'manual',
          valueSource: 'manual_current_value',
          metric: 'custom',
        }
        : {
          source: 'custom_integration',
          valueSource: 'latest_validated_import',
          metric: kpiForm.metric,
          sourceScope: activeCustomIntegrationSourceScope,
          sourceLabel: metricOption?.sourceLabel || latestImportLabel,
        },
    };
    
    if (editingKPI) {
      const updateData = {
        id: editingKPI.id,
        data: payload,
      };
      updateKpiMutation.mutate(updateData);
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/benchmarks', benchmarkData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
      toast({
        title: "Benchmark Created",
        description: "Your benchmark has been successfully created.",
      });
      setIsBenchmarkModalOpen(false);
      setInitialBenchmarkForm(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        category: 'performance',
        benchmarkType: '',
        competitorName: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      console.error('Benchmark creation error:', error);
      toast({
        title: "Error Creating Benchmark",
        description: error?.message || "Failed to create benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/platforms/custom-integration/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
      toast({
        title: "Benchmark Updated",
        description: "Your benchmark has been successfully updated.",
      });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      setInitialBenchmarkForm(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        category: 'performance',
        benchmarkType: '',
        competitorName: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      console.error('Benchmark update error:', error);
      toast({
        title: "Error Updating Benchmark",
        description: error?.message || "Failed to update benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Benchmark mutation
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/benchmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
      toast({
        title: "Benchmark Deleted",
        description: "The benchmark has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Benchmark deletion error:', error);
      toast({
        title: "Error Deleting Benchmark",
        description: error?.message || "Failed to delete benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isBenchmarkFormDirty = editingBenchmark && initialBenchmarkForm
    ? Object.keys(initialBenchmarkForm).some((key) =>
      normalizeCustomIntegrationKpiFormValue(key, (benchmarkForm as any)[key]) !==
        normalizeCustomIntegrationKpiFormValue(key, initialBenchmarkForm[key])
    )
    : true;

  // Handle Benchmark form submission
  const handleBenchmarkSubmit = () => {
    if (editingBenchmark && !isBenchmarkFormDirty) {
      return;
    }

    if (!campaignId) {
      toast({
        title: "Error",
        description: "Campaign ID not available. Please wait for the page to fully load.",
        variant: "destructive",
      });
      return;
    }

    if (!benchmarkForm.name || !benchmarkForm.metric || !benchmarkForm.benchmarkValue) {
      toast({
        title: "Required Fields",
        description: "Please select a Benchmark template, enter a Benchmark name, and set a benchmark value.",
        variant: "destructive",
      });
      return;
    }

    const benchmarkValue = parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(benchmarkForm.benchmarkValue));
    if (benchmarkValue === null) {
      toast({
        title: "Invalid Benchmark",
        description: "Please enter a valid numeric benchmark value.",
        variant: "destructive",
      });
      return;
    }

    if (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold) {
      toast({
        title: "Alert Threshold Required",
        description: "Please set an alert threshold value.",
        variant: "destructive",
      });
      return;
    }

    const isCustomBenchmark = benchmarkForm.metric === 'custom';
    const metricOption = isCustomBenchmark ? null : resolveCustomIntegrationMetric(metricsData, benchmarkForm.metric);
    if (!isCustomBenchmark && (!metricOption?.available || metricOption.currentValue === null)) {
      toast({
        title: "Metric Unavailable",
        description: metricOption?.reason || "Select a Custom Integration metric with a current source-backed value.",
        variant: "destructive",
      });
      return;
    }
    if (!isCustomBenchmark && !activeCustomIntegrationSourceScope) {
      toast({
        title: "Source Unavailable",
        description: "The active Custom Integration source is not loaded yet. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const manualCurrentValue = parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(benchmarkForm.currentValue));
    const alertThreshold = benchmarkForm.alertThreshold
      ? parseCustomIntegrationMetricNumber(cleanCustomIntegrationNumberInput(benchmarkForm.alertThreshold))
      : null;
    const payload = {
      ...benchmarkForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
      benchmarkType: benchmarkForm.benchmarkType || 'goal',
      benchmarkValue,
      currentValue: isCustomBenchmark ? (manualCurrentValue ?? '') : metricOption?.currentValue,
      alertThreshold,
      calculationConfig: isCustomBenchmark
        ? {
          source: 'manual',
          valueSource: 'manual_current_value',
          metric: 'custom',
        }
        : {
          source: 'custom_integration',
          valueSource: 'latest_validated_import',
          metric: benchmarkForm.metric,
          sourceScope: activeCustomIntegrationSourceScope,
          sourceLabel: metricOption?.sourceLabel || latestImportLabel,
        },
    };

    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({
        id: editingBenchmark.id,
        data: payload
      });
    } else {
      createBenchmarkMutation.mutate(payload);
    }
  };

  // Fetch platform-level Reports for custom integration filtered by campaignId
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/reports', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/platforms/custom-integration/reports?campaignId=${campaignId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/reports', reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
      toast({
        title: "Report Created",
        description: "Your report has been successfully created.",
      });
      setIsReportModalOpen(false);
      setEditingReportId(null);
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'weekly',
        scheduleDayOfWeek: 'monday',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
    },
    onError: (error: any) => {
      console.error('Report creation error:', error);
      toast({
        title: "Error Creating Report",
        description: error?.message || "Failed to create report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update Report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/custom-integration/reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
      toast({
        title: "Report Updated",
        description: "Your report has been successfully updated.",
      });
      setIsReportModalOpen(false);
      setEditingReportId(null);
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'weekly',
        scheduleDayOfWeek: 'monday',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
    },
    onError: (error: any) => {
      console.error('Report update error:', error);
      toast({
        title: "Error Updating Report",
        description: error?.message || "Failed to update report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/reports/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
      toast({
        title: "Report Deleted",
        description: "The report has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Report deletion error:', error);
      toast({
        title: "Error Deleting Report",
        description: error?.message || "Failed to delete report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper to convert day of week string to number (0-6)
  const dayOfWeekToNumber = (day: string): number | null => {
    const mapping: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
    };
    return mapping[day.toLowerCase()] ?? null;
  };

  // Helper to convert day of week number to string
  const numberToDayOfWeek = (num: number | null): string => {
    const mapping: { [key: number]: string } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return num !== null ? (mapping[num] || 'monday') : 'monday';
  };

  // PDF Helper Functions
  const addPDFHeader = (doc: any, title: string, subtitle: string) => {
    // Custom Integration brand color header (purple/blue gradient)
    doc.setFillColor(99, 102, 241); // Indigo-500
    doc.rect(0, 0, 210, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", 'bold');
    doc.text(title, 20, 20);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont("helvetica", 'normal');
    doc.text(subtitle, 20, 30);
    
    // Date
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Generated: ${dateStr}`, 20, 50);
  };

  const addPDFSection = (doc: any, title: string, y: number, color: number[] = [99, 102, 241]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", 'bold');
    doc.text(title, 20, y + 7);
    // Reset text color to black for content
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", 'normal');
    return y + 15;
  };

  // Handle Report form submission
  const handleGenerateReport = async (overrideReport?: any) => {
    const reportName = overrideReport?.name || reportForm.name || 'Custom Integration Report';
    const reportType = overrideReport?.reportType || reportForm.reportType || 'overview';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Add header
    addPDFHeader(doc, reportName, 'Custom Integration Analytics');
    
    let y = 70;
    
    // Handle different report types
    if (reportType === 'benchmarks') {
      // Benchmarks Report
      const benchmarks = benchmarksData as any[] || [];
      
      if (benchmarks.length === 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No benchmarks data available', 20, y);
      } else {
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11);
        doc.setFont("helvetica", 'normal');
        
        y = addPDFSection(doc, 'Industry Benchmarks', y, [168, 85, 247]);
        
        benchmarks.forEach((benchmark: any, index: number) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFont("helvetica", 'bold');
          doc.setFontSize(12);
          doc.text(benchmark.name || benchmark.metric, 20, y);
          y += 6;
          
          doc.setFont("helvetica", 'normal');
          doc.setFontSize(10);
          
          // Description
          if (benchmark.description) {
            const lines = doc.splitTextToSize(benchmark.description, 160);
            doc.setTextColor(100, 100, 100);
            lines.forEach((line: string) => {
              doc.text(line, 25, y);
              y += 5;
            });
            doc.setTextColor(50, 50, 50);
            y += 2;
          }
          
          // Metadata (industry, period, category)
          const metadata: string[] = [];
          if (benchmark.industry) metadata.push(benchmark.industry);
          if (benchmark.period) metadata.push(benchmark.period);
          if (benchmark.category) metadata.push(benchmark.category);
          if (metadata.length > 0) {
            doc.setTextColor(120, 120, 120);
            doc.text(metadata.join(' • '), 25, y);
            doc.setTextColor(50, 50, 50);
            y += 6;
          }
          
          // Performance Values
          if (benchmark.currentValue) {
            doc.setFont("helvetica", 'bold');
            doc.text('Your Performance:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(`${benchmark.currentValue}${benchmark.unit || ''}`, 80, y);
            y += 5;
          }
          
          if (benchmark.benchmarkValue) {
            doc.setFont("helvetica", 'bold');
            doc.text('Benchmark Value:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(`${benchmark.benchmarkValue}${benchmark.unit || ''}`, 80, y);
            y += 5;
          }
          
          // Source - always show with fallback
          doc.setFont("helvetica", 'bold');
          doc.text('Source:', 25, y);
          doc.setFont("helvetica", 'normal');
          doc.text(benchmark.source || 'Custom Integration', 80, y);
          y += 5;
          
          // Performance vs Benchmark comparison
          if (benchmark.currentValue && benchmark.benchmarkValue) {
            const current = parseFloat(benchmark.currentValue);
            const benchmarkVal = parseFloat(benchmark.benchmarkValue);
            const diff = current - benchmarkVal;
            const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
            const isAbove = current >= benchmarkVal;
            
            doc.setFont("helvetica", 'bold');
            doc.text('Performance vs Benchmark:', 25, y);
            doc.setFont("helvetica", 'normal');
            
            if (isAbove) {
              doc.setTextColor(22, 163, 74); // Green
              doc.text(`${formatPct(percentDiff)} Above - Outperforming!`, 80, y);
            } else {
              doc.setTextColor(220, 38, 38); // Red
              doc.text(`${formatPct(Math.abs(percentDiff))} Below - Needs improvement`, 80, y);
            }
            doc.setTextColor(50, 50, 50); // Reset to dark
            y += 5;
          }
          
          if (benchmark.benchmarkType) {
            doc.setFont("helvetica", 'bold');
            doc.text('Type:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(benchmark.benchmarkType, 80, y);
            y += 5;
          }
          
          if (benchmark.geoLocation || benchmark.geographicLocation) {
            doc.setFont("helvetica", 'bold');
            doc.text('Location:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(benchmark.geoLocation || benchmark.geographicLocation, 80, y);
            y += 5;
          }
          
          if (benchmark.confidenceLevel) {
            doc.setFont("helvetica", 'bold');
            doc.text('Confidence:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(benchmark.confidenceLevel, 80, y);
            y += 5;
          }
          
          doc.setFontSize(11);
          y += 10;
        });
      }
    } else if (reportType === 'custom') {
      // Custom Report - filter based on customReportConfig or override configuration
      const config = overrideReport?.configuration || customReportConfig;
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont("helvetica", 'normal');
      
      // Core Metrics (Audience & Traffic)
      const hasSelectedCoreMetrics = config.coreMetrics && config.coreMetrics.length > 0;
      if (hasSelectedCoreMetrics && metrics) {
        y = addPDFSection(doc, 'Selected Metrics', y, [59, 130, 246]);
        
        config.coreMetrics.forEach((metric: string) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          const metricLabels: Record<string, string> = {
            users: 'Users (unique)',
            sessions: 'Sessions',
            pageviews: 'Pageviews',
            avgSessionDuration: 'Avg. Session Duration',
            pagesPerSession: 'Pages / Session',
            bounceRate: 'Bounce Rate'
          };
          
          if (metrics[metric]) {
            doc.setFont("helvetica", 'bold');
            doc.text(metricLabels[metric] + ':', 20, y);
            doc.setFont("helvetica", 'normal');
            if (metric === 'avgSessionDuration') {
              doc.text(String(metrics[metric]), 120, y);
            } else if (metric === 'pagesPerSession') {
              const value = typeof metrics[metric] === 'string' ? parseFloat(metrics[metric]).toFixed(2) : metrics[metric].toFixed(2);
              doc.text(value, 120, y);
            } else if (metric === 'bounceRate') {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else {
              doc.text(formatNumber(metrics[metric]), 120, y);
            }
            y += 8;
          }
        });
        y += 5;
      }
      
      // Derived Metrics (Traffic Sources, Email, Social)
      const hasSelectedDerivedMetrics = config.derivedMetrics && config.derivedMetrics.length > 0;
      if (hasSelectedDerivedMetrics && metrics) {
        config.derivedMetrics.forEach((metric: string) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          const metricLabels: Record<string, string> = {
            organicSearchShare: 'Organic Search',
            directBrandedShare: 'Direct/Branded',
            emailShare: 'Email (Newsletters)',
            referralShare: 'Referral/Partners',
            paidShare: 'Paid (Display/Search)',
            socialShare: 'Social',
            emailsDelivered: 'Emails Delivered',
            openRate: 'Open Rate',
            clickThroughRate: 'Click-Through Rate',
            clickToOpen: 'Click-to-Open',
            hardBounces: 'Hard Bounces',
            spamComplaints: 'Spam Complaints',
            listGrowth: 'List Growth',
            impressions: 'Impressions',
            reach: 'Reach',
            clicks: 'Clicks',
            engagements: 'Engagements',
            spend: 'Spend',
            conversions: 'Conversions',
            leads: 'Leads',
            videoViews: 'Video Views',
            viralImpressions: 'Viral Impressions'
          };
          
          if (metrics[metric] !== undefined && metrics[metric] !== null) {
            doc.setFont("helvetica", 'bold');
            doc.text(metricLabels[metric] + ':', 20, y);
            doc.setFont("helvetica", 'normal');
            
            // Format based on metric type
            if (metric.includes('Share')) {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else if (metric.includes('Rate') || metric.includes('Open') || metric.includes('clickToOpen')) {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else if (metric === 'spend') {
              const spendValue = typeof metrics[metric] === 'string' ? parseFloat(metrics[metric]) : metrics[metric];
              doc.text('$' + formatNumber(spendValue), 120, y);
            } else {
              doc.text(formatNumber(metrics[metric]), 120, y);
            }
            y += 8;
          }
        });
        y += 5;
      }
      
      // Selected KPIs
      if (config.kpis && config.kpis.length > 0 && kpisData) {
        const selectedKPIs = (kpisData as any[]).filter(kpi => config.kpis.includes(kpi.id));
        
        if (selectedKPIs.length > 0) {
          y = addPDFSection(doc, 'Selected KPIs', y, [59, 130, 246]);
          doc.setTextColor(50, 50, 50);
          
          selectedKPIs.forEach((kpi: any) => {
            if (y > 230) {
              doc.addPage();
              y = 20;
            }
            
            // KPI Name
            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            doc.text(kpi.name, 20, y);
            y += 6;
            
            // Description
            if (kpi.description) {
              doc.setFont("helvetica", 'normal');
              doc.setFontSize(9);
              doc.setTextColor(100, 100, 100);
              const lines = doc.splitTextToSize(kpi.description, 170);
              lines.forEach((line: string) => {
                doc.text(line, 20, y);
                y += 4;
              });
              doc.setTextColor(50, 50, 50);
              y += 2;
            }
            
            // Priority and Timeframe badges
            if (kpi.priority || kpi.timeframe) {
              doc.setFontSize(9);
              let badgeText = '';
              if (kpi.priority) {
                badgeText += `Priority: ${kpi.priority}`;
              }
              if (kpi.timeframe) {
                badgeText += (badgeText ? ' | ' : '') + `Timeframe: ${kpi.timeframe}`;
              }
              doc.setTextColor(100, 100, 100);
              doc.text(badgeText, 20, y);
              doc.setTextColor(50, 50, 50);
              y += 6;
            }
            
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(10);
            
            // Current and Target values with formatting
            if (kpi.currentValue) {
              doc.setFont("helvetica", 'bold');
              doc.text('Current:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(`${formatNumber(kpi.currentValue)}${kpi.unit || ''}`, 50, y);
              y += 5;
            }
            
            if (kpi.targetValue) {
              doc.setFont("helvetica", 'bold');
              doc.text('Target:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(`${formatNumber(kpi.targetValue)}${kpi.unit || ''}`, 50, y);
              y += 5;
            }
            
            // Progress percentage
            if (kpi.currentValue && kpi.targetValue) {
              const progress = Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100);
              doc.setFont("helvetica", 'bold');
              doc.text('Progress:', 25, y);
              doc.setFont("helvetica", 'normal');
              
              // Color-code the progress
              if (progress >= 100) {
                doc.setTextColor(22, 163, 74); // Green
              } else if (progress >= 70) {
                doc.setTextColor(59, 130, 246); // Blue
              } else {
                doc.setTextColor(234, 179, 8); // Yellow
              }
              doc.text(`${progress}%`, 50, y);
              doc.setTextColor(50, 50, 50); // Reset to dark
              y += 5;
            }
            
            if (kpi.targetDate) {
              const dateStr = new Date(kpi.targetDate).toLocaleDateString();
              doc.setFont("helvetica", 'bold');
              doc.text('Target Date:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(dateStr, 60, y);
              y += 5;
            }
            
            doc.setFontSize(11);
            y += 8;
          });
        }
      }
      
      // Selected Benchmarks
      if (config.benchmarks && config.benchmarks.length > 0 && benchmarksData) {
        const selectedBenchmarks = (benchmarksData as any[]).filter(b => config.benchmarks.includes(b.id));
        
        if (selectedBenchmarks.length > 0) {
          y = addPDFSection(doc, 'Selected Benchmarks', y, [168, 85, 247]);
          doc.setTextColor(50, 50, 50);
          
          selectedBenchmarks.forEach((benchmark: any) => {
            if (y > 250) {
              doc.addPage();
              y = 20;
            }
            
            doc.setFont("helvetica", 'bold');
            doc.setFontSize(12);
            doc.text(benchmark.name || benchmark.metric, 20, y);
            y += 6;
            
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(10);
            
            // Description
            if (benchmark.description) {
              const lines = doc.splitTextToSize(benchmark.description, 160);
              doc.setTextColor(100, 100, 100);
              lines.forEach((line: string) => {
                doc.text(line, 25, y);
                y += 5;
              });
              doc.setTextColor(50, 50, 50);
              y += 2;
            }
            
            // Metadata (industry, period, category)
            const metadata: string[] = [];
            if (benchmark.industry) metadata.push(benchmark.industry);
            if (benchmark.period) metadata.push(benchmark.period);
            if (benchmark.category) metadata.push(benchmark.category);
            if (metadata.length > 0) {
              doc.setTextColor(120, 120, 120);
              doc.text(metadata.join(' • '), 25, y);
              doc.setTextColor(50, 50, 50);
              y += 6;
            }
            
            // Performance Values
            if (benchmark.currentValue) {
              doc.setFont("helvetica", 'bold');
              doc.text('Your Performance:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(`${formatNumber(benchmark.currentValue)}${benchmark.unit || ''}`, 80, y);
              y += 5;
            }
            
            if (benchmark.benchmarkValue) {
              doc.setFont("helvetica", 'bold');
              doc.text('Benchmark Value:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(`${formatNumber(benchmark.benchmarkValue)}${benchmark.unit || ''}`, 80, y);
              y += 5;
            }
            
            // Source - always show with fallback
            doc.setFont("helvetica", 'bold');
            doc.text('Source:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(benchmark.source || 'Custom Integration', 80, y);
            y += 5;
            
            // Performance vs Benchmark comparison
            if (benchmark.currentValue && benchmark.benchmarkValue) {
              const current = parseFloat(benchmark.currentValue);
              const benchmarkVal = parseFloat(benchmark.benchmarkValue);
              const diff = current - benchmarkVal;
              const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
              const isAbove = current >= benchmarkVal;
              
              doc.setFont("helvetica", 'bold');
              doc.text('Performance vs Benchmark:', 25, y);
              doc.setFont("helvetica", 'normal');
              
              if (isAbove) {
                doc.setTextColor(22, 163, 74); // Green
                doc.text(`${formatPct(percentDiff)} Above - Outperforming!`, 80, y);
              } else {
                doc.setTextColor(220, 38, 38); // Red
                doc.text(`${formatPct(Math.abs(percentDiff))} Below - Needs improvement`, 80, y);
              }
              doc.setTextColor(50, 50, 50); // Reset to dark
              y += 5;
            }
            
            if (benchmark.benchmarkType) {
              doc.setFont("helvetica", 'bold');
              doc.text('Type:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(benchmark.benchmarkType, 80, y);
              y += 5;
            }
            
            if (benchmark.geoLocation || benchmark.geographicLocation) {
              doc.setFont("helvetica", 'bold');
              doc.text('Location:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(benchmark.geoLocation || benchmark.geographicLocation, 80, y);
              y += 5;
            }
            
            if (benchmark.confidenceLevel) {
              doc.setFont("helvetica", 'bold');
              doc.text('Confidence:', 25, y);
              doc.setFont("helvetica", 'normal');
              doc.text(benchmark.confidenceLevel, 80, y);
              y += 5;
            }
            
            doc.setFontSize(11);
            y += 10;
          });
        }
      }
    } else if (reportType === 'kpis') {
      // KPIs Report
      const kpis = kpisData as any[] || [];
      
      if (kpis.length === 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No KPIs data available', 20, y);
      } else {
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11);
        doc.setFont("helvetica", 'normal');
        
        y = addPDFSection(doc, 'Key Performance Indicators', y, [59, 130, 246]);
        doc.setTextColor(50, 50, 50); // Reset to dark after section header
        
        kpis.forEach((kpi: any, index: number) => {
          if (y > 230) {
            doc.addPage();
            y = 20;
          }
          
          // KPI Name
          doc.setFont("helvetica", 'bold');
          doc.setFontSize(12);
          doc.text(kpi.name, 20, y);
          y += 6;
          
          // Description
          if (kpi.description) {
            doc.setFont("helvetica", 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const lines = doc.splitTextToSize(kpi.description, 170);
            lines.forEach((line: string) => {
              doc.text(line, 20, y);
              y += 4;
            });
            doc.setTextColor(50, 50, 50);
            y += 2;
          }
          
          // Priority and Timeframe badges
          if (kpi.priority || kpi.timeframe) {
            doc.setFontSize(9);
            let badgeText = '';
            if (kpi.priority) {
              badgeText += `Priority: ${kpi.priority}`;
            }
            if (kpi.timeframe) {
              badgeText += (badgeText ? ' | ' : '') + `Timeframe: ${kpi.timeframe}`;
            }
            doc.setTextColor(100, 100, 100);
            doc.text(badgeText, 20, y);
            doc.setTextColor(50, 50, 50);
            y += 6;
          }
          
          doc.setFont("helvetica", 'normal');
          doc.setFontSize(10);
          
          // Current and Target values with formatting
          if (kpi.currentValue) {
            doc.setFont("helvetica", 'bold');
            doc.text('Current:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(`${formatNumber(kpi.currentValue)}${kpi.unit || ''}`, 50, y);
            y += 5;
          }
          
          if (kpi.targetValue) {
            doc.setFont("helvetica", 'bold');
            doc.text('Target:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(`${formatNumber(kpi.targetValue)}${kpi.unit || ''}`, 50, y);
            y += 5;
          }
          
          // Progress percentage
          if (kpi.currentValue && kpi.targetValue) {
            const progress = Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100);
            doc.setFont("helvetica", 'bold');
            doc.text('Progress:', 25, y);
            doc.setFont("helvetica", 'normal');
            
            // Color-code the progress
            if (progress >= 100) {
              doc.setTextColor(22, 163, 74); // Green
            } else if (progress >= 70) {
              doc.setTextColor(59, 130, 246); // Blue
            } else {
              doc.setTextColor(234, 179, 8); // Yellow
            }
            doc.text(`${progress}%`, 50, y);
            doc.setTextColor(50, 50, 50); // Reset to dark
            y += 5;
          }
          
          if (kpi.targetDate) {
            const dateStr = new Date(kpi.targetDate).toLocaleDateString();
            doc.setFont("helvetica", 'bold');
            doc.text('Target Date:', 25, y);
            doc.setFont("helvetica", 'normal');
            doc.text(dateStr, 60, y);
            y += 5;
          }
          
          doc.setFontSize(11);
          y += 8;
        });
      }
    } else {
      // Overview Report (default)
      const hasAnyData = metrics && (
        metrics.users ||
        metrics.sessions ||
        metrics.pageviews ||
        metrics.impressions ||
        metrics.reach ||
        metrics.clicks ||
        metrics.emailsDelivered ||
        metrics.openRate
      );
      
      if (!hasAnyData) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No metrics data available', 20, y);
      } else {
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont("helvetica", 'normal');
      
      // Audience & Traffic Section
      if (metrics.users || metrics.sessions || metrics.pageviews || metrics.avgSessionDuration || metrics.pagesPerSession || metrics.bounceRate) {
        y = addPDFSection(doc, 'Audience & Traffic', y, [59, 130, 246]);
        
        if (metrics.users) {
          doc.setFont("helvetica", 'bold');
          doc.text('Users (unique):', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.users), 120, y);
          y += 8;
        }
        if (metrics.sessions) {
          doc.setFont("helvetica", 'bold');
          doc.text('Sessions:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.sessions), 120, y);
          y += 8;
        }
        if (metrics.pageviews) {
          doc.setFont("helvetica", 'bold');
          doc.text('Pageviews:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.pageviews), 120, y);
          y += 8;
        }
        if (metrics.avgSessionDuration) {
          doc.setFont("helvetica", 'bold');
          doc.text('Avg. Session Duration:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(String(metrics.avgSessionDuration), 120, y);
          y += 8;
        }
        if (metrics.pagesPerSession) {
          doc.setFont("helvetica", 'bold');
          doc.text('Pages / Session:', 20, y);
          doc.setFont("helvetica", 'normal');
          const pagesValue = typeof metrics.pagesPerSession === 'string' ? parseFloat(metrics.pagesPerSession).toFixed(2) : metrics.pagesPerSession.toFixed(2);
          doc.text(pagesValue, 120, y);
          y += 8;
        }
        if (metrics.bounceRate) {
          doc.setFont("helvetica", 'bold');
          doc.text('Bounce Rate:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.bounceRate + '%', 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Traffic Sources Section
      if (metrics.organicSearchShare || metrics.directBrandedShare || metrics.emailShare || 
          metrics.referralShare || metrics.paidShare || metrics.socialShare) {
        y = addPDFSection(doc, 'Traffic Sources', y, [234, 179, 8]);
        
        if (metrics.organicSearchShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Organic Search:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.organicSearchShare + '%', 120, y);
          y += 8;
        }
        if (metrics.directBrandedShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Direct/Branded:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.directBrandedShare + '%', 120, y);
          y += 8;
        }
        if (metrics.emailShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Email (Newsletters):', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.emailShare + '%', 120, y);
          y += 8;
        }
        if (metrics.referralShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Referral/Partners:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.referralShare + '%', 120, y);
          y += 8;
        }
        if (metrics.paidShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Paid (Display/Search):', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.paidShare + '%', 120, y);
          y += 8;
        }
        if (metrics.socialShare) {
          doc.setFont("helvetica", 'bold');
          doc.text('Social:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.socialShare + '%', 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Email Performance Section
      if (metrics.emailsDelivered || metrics.openRate || metrics.clickThroughRate || metrics.clickToOpenRate || metrics.hardBounces || metrics.spamComplaints || metrics.listGrowth) {
        y = addPDFSection(doc, 'Email Performance', y, [16, 185, 129]);
        
        if (metrics.emailsDelivered) {
          doc.setFont("helvetica", 'bold');
          doc.text('Emails Delivered:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.emailsDelivered), 120, y);
          y += 8;
        }
        if (metrics.openRate) {
          doc.setFont("helvetica", 'bold');
          doc.text('Open Rate:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.openRate + '%', 120, y);
          y += 8;
        }
        if (metrics.clickThroughRate) {
          doc.setFont("helvetica", 'bold');
          doc.text('Click-Through Rate:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.clickThroughRate + '%', 120, y);
          y += 8;
        }
        if (metrics.clickToOpenRate) {
          doc.setFont("helvetica", 'bold');
          doc.text('Click-to-Open Rate:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.clickToOpenRate + '%', 120, y);
          y += 8;
        }
        if (metrics.hardBounces) {
          doc.setFont("helvetica", 'bold');
          doc.text('Hard Bounces:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.hardBounces + '%', 120, y);
          y += 8;
        }
        if (metrics.spamComplaints) {
          doc.setFont("helvetica", 'bold');
          doc.text('Spam Complaints:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(metrics.spamComplaints + '%', 120, y);
          y += 8;
        }
        if (metrics.listGrowth) {
          doc.setFont("helvetica", 'bold');
          doc.text('List Growth:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.listGrowth), 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Social Media Section
      if (metrics.impressions || metrics.reach || metrics.clicks || metrics.engagements || metrics.spend || metrics.conversions || metrics.leads || metrics.videoViews || metrics.viralImpressions) {
        y = addPDFSection(doc, 'Social Media Metrics', y, [168, 85, 247]);
        
        if (metrics.impressions) {
          doc.setFont("helvetica", 'bold');
          doc.text('Impressions:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.impressions), 120, y);
          y += 8;
        }
        if (metrics.reach) {
          doc.setFont("helvetica", 'bold');
          doc.text('Reach:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.reach), 120, y);
          y += 8;
        }
        if (metrics.clicks) {
          doc.setFont("helvetica", 'bold');
          doc.text('Clicks:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.clicks), 120, y);
          y += 8;
        }
        if (metrics.engagements) {
          doc.setFont("helvetica", 'bold');
          doc.text('Engagements:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.engagements), 120, y);
          y += 8;
        }
        if (metrics.spend) {
          doc.setFont("helvetica", 'bold');
          doc.text('Spend:', 20, y);
          doc.setFont("helvetica", 'normal');
          const spendValue = typeof metrics.spend === 'string' ? parseFloat(metrics.spend) : metrics.spend;
          doc.text('$' + formatNumber(spendValue), 120, y);
          y += 8;
        }
        if (metrics.conversions) {
          doc.setFont("helvetica", 'bold');
          doc.text('Conversions:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.conversions), 120, y);
          y += 8;
        }
        if (metrics.leads) {
          doc.setFont("helvetica", 'bold');
          doc.text('Leads:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.leads), 120, y);
          y += 8;
        }
        if (metrics.videoViews) {
          doc.setFont("helvetica", 'bold');
          doc.text('Video Views:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.videoViews), 120, y);
          y += 8;
        }
        if (metrics.viralImpressions) {
          doc.setFont("helvetica", 'bold');
          doc.text('Viral Impressions:', 20, y);
          doc.setFont("helvetica", 'normal');
          doc.text(formatNumber(metrics.viralImpressions), 120, y);
          y += 8;
        }
        y += 10;
      }
      }
    }
    
    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Report Downloaded",
      description: "Your PDF report has been generated and downloaded successfully.",
    });
    setIsReportModalOpen(false);
  };

  const handleCreateReport = () => {
    // Validate custom reports have configuration
    if (reportForm.reportType === 'custom') {
      const hasConfig = customReportConfig.coreMetrics.length > 0 || 
                       customReportConfig.derivedMetrics.length > 0 || 
                       customReportConfig.kpis.length > 0 || 
                       customReportConfig.benchmarks.length > 0;
      
      if (!hasConfig) {
        toast({
          title: "Configuration Required",
          description: "Please select at least one metric, KPI, or benchmark for your custom report.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
      scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' 
        ? dayOfWeekToNumber(reportForm.scheduleDayOfWeek) 
        : null,
      scheduleRecipients: reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };
    
    if (reportModalStep === 'custom') {
      reportData.configuration = customReportConfig;
    }
    
    createReportMutation.mutate(reportData);
  };

  const handleUpdateReport = () => {
    if (!editingReportId) return;
    
    // Validate custom reports have configuration
    if (reportForm.reportType === 'custom') {
      const hasConfig = customReportConfig.coreMetrics.length > 0 || 
                       customReportConfig.derivedMetrics.length > 0 || 
                       customReportConfig.kpis.length > 0 || 
                       customReportConfig.benchmarks.length > 0;
      
      if (!hasConfig) {
        toast({
          title: "Configuration Required",
          description: "Please select at least one metric, KPI, or benchmark for your custom report.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
      scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' 
        ? dayOfWeekToNumber(reportForm.scheduleDayOfWeek) 
        : null,
      scheduleRecipients: reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };
    
    if (reportModalStep === 'custom') {
      reportData.configuration = customReportConfig;
    }
    
    updateReportMutation.mutate({ id: editingReportId, data: reportData });
  };

  const handleDownloadReport = async (report: any) => {
    // For custom reports, ensure configuration exists
    if (report.reportType === 'custom' && !report.configuration) {
      toast({
        title: "Cannot Download Report",
        description: "This custom report has no configuration. Please edit and save it with metrics selected.",
        variant: "destructive",
      });
      return;
    }
    
    // Parse configuration if it's a JSON string
    let reportWithParsedConfig = { ...report };
    if (report.configuration && typeof report.configuration === 'string') {
      try {
        reportWithParsedConfig.configuration = JSON.parse(report.configuration);
      } catch (e) {
        console.error('Failed to parse report configuration for download:', e);
        toast({
          title: "Cannot Download Report",
          description: "Report configuration is invalid. Please edit and save the report again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Generate and download the PDF directly with the parsed report data
    await handleGenerateReport(reportWithParsedConfig);
  };

  const handleEditReport = (report: any) => {
    setEditingReportId(report.id);
    setReportForm({
      name: report.name,
      description: report.description || '',
      reportType: report.reportType,
      configuration: report.configuration,
      scheduleEnabled: !!report.scheduleFrequency,
      scheduleFrequency: report.scheduleFrequency || 'weekly',
      scheduleDayOfWeek: numberToDayOfWeek(report.scheduleDayOfWeek),
      scheduleTime: report.scheduleTime || '9:00 AM',
      emailRecipients: Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.join(', ') : '',
      status: report.status || 'draft'
    });
    
    if (report.reportType === 'custom') {
      // Parse configuration if it's a JSON string
      let config = report.configuration;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.error('Failed to parse report configuration:', e);
          config = null;
        }
      }
      
      // Ensure customReportConfig has default structure
      setCustomReportConfig({
        coreMetrics: config?.coreMetrics || [],
        derivedMetrics: config?.derivedMetrics || [],
        kpis: config?.kpis || [],
        benchmarks: config?.benchmarks || []
      });
      setReportModalStep('custom');
    } else {
      setReportModalStep('standard');
    }
    
    setIsReportModalOpen(true);
  };

  const formatNumber = (num?: number | string | null) => {
    if (!num && num !== 0) return 'N/A';
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatCurrency = (value?: string | number | null) => {
    if (!value) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatPercent = (value?: string | number | null) => {
    if (!value && value !== 0) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${num.toFixed(1)}%`;
  };

  const resolveCustomIntegrationCurrentValue = (item: any) => {
    const metricKey = String(item?.metric || item?.metricKey || '').trim();
    if (metricKey && metricKey !== 'custom') {
      const savedScope = getSavedCustomIntegrationSourceScope(item);
      const activeIntegrationId = String(customIntegration?.id || '').trim();
      if (savedScope?.scopeType && savedScope.scopeType !== 'latest_validated_import') {
        return { available: false, currentValue: null as number | null, unit: String(item?.unit || ''), option: undefined, sourceLabel: '', reason: 'Saved Custom Integration source scope is unsupported.' };
      }
      if (savedScope?.integrationId && activeIntegrationId && savedScope.integrationId !== activeIntegrationId) {
        return { available: false, currentValue: null as number | null, unit: String(item?.unit || ''), option: undefined, sourceLabel: '', reason: 'Saved Custom Integration source is no longer connected.' };
      }
      return resolveCustomIntegrationMetric(metricsData, metricKey);
    }

    const currentValue = parseCustomIntegrationMetricNumber(item?.currentValue);
    const unit = String(item?.unit || '');
    return currentValue === null
      ? { available: false, currentValue: null as number | null, unit, option: undefined, sourceLabel: 'Manual value', reason: 'Current value is not available.' }
      : { available: true, currentValue, unit, option: undefined, sourceLabel: 'Manual value', reason: '' };
  };

  const computeCustomIntegrationKpiProgress = (kpi: any, current: number, target: number) => {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeTarget = Number.isFinite(target) ? target : 0;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: kpi?.metric || kpi?.metricKey, name: kpi?.name });
    const effectiveDeltaPct = computeEffectiveDeltaPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const band = effectiveDeltaPct !== null
      ? classifyKpiBand({ effectiveDeltaPct, nearTargetBandPct: CUSTOM_INTEGRATION_KPI_NEAR_TARGET_BAND_PCT })
      : "below";
    const attainmentPct = computeAttainmentPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const fillPct = attainmentPct !== null ? computeAttainmentFillPct(attainmentPct) : 0;
    const progressColor = band === "above" ? "bg-green-500" : band === "near" ? "bg-blue-500" : "bg-red-500";
    return { band, effectiveDeltaPct, attainmentPct: attainmentPct ?? 0, fillPct, progressColor };
  };

  const computeCustomIntegrationBenchmarkProgress = (benchmark: any, current: number, benchmarkValue: number) => {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeBenchmark = Number.isFinite(benchmarkValue) ? benchmarkValue : 0;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: benchmark?.metric || benchmark?.metricKey, name: benchmark?.name });
    const attainmentPct = computeAttainmentPct({ current: safeCurrent, target: safeBenchmark, lowerIsBetter });
    const fillPct = attainmentPct !== null ? computeAttainmentFillPct(attainmentPct) : 0;
    const ratio = (attainmentPct ?? 0) / 100;
    const status = ratio >= 0.9 ? "on_track" : ratio >= 0.7 ? "needs_attention" : "behind";
    const color = status === "on_track" ? "bg-green-500" : status === "needs_attention" ? "bg-yellow-500" : "bg-red-500";
    const deltaPct = computeEffectiveDeltaPct({ current: safeCurrent, target: safeBenchmark, lowerIsBetter });
    return {
      ratio,
      pct: fillPct,
      labelPct: (attainmentPct ?? 0).toFixed(1),
      status,
      color,
      deltaPct: deltaPct ?? 0,
      attainmentPct: attainmentPct ?? 0,
      fillPct,
    };
  };

  const getCustomIntegrationKpiIcon = (metricName: string) => {
    const n = String(metricName || "").toLowerCase();
    if (n.includes("revenue") || n.includes("spend") || n.includes("cost") || n.includes("budget")) return { Icon: DollarSign, color: "text-emerald-600" };
    if (n.includes("roas") || n.includes("roi") || n.includes("rate") || n.includes("%")) return { Icon: TrendingUp, color: "text-violet-600" };
    if (n.includes("conversion") || n.includes("lead") || n.includes("customer")) return { Icon: Target, color: "text-indigo-600" };
    if (n.includes("click")) return { Icon: MousePointerClick, color: "text-orange-600" };
    if (n.includes("session") || n.includes("time")) return { Icon: Clock, color: "text-muted-foreground" };
    return { Icon: BarChart3, color: "text-muted-foreground" };
  };

  const customIntegrationEmail = customIntegration?.email;
  const parserMetadata = getCustomIntegrationParserMetadata(metricsData);
  const parserWarnings = Array.isArray(parserMetadata?.warnings) ? parserMetadata.warnings : [];
  const parserRequiresReview = Boolean(parserMetadata?.requiresReview || parserWarnings.length > 0);
  const latestImportLabel = metricsData ? getCustomIntegrationSourceLabel(metricsData) : 'No import yet';
  const latestImportStatus = parserRequiresReview ? 'Needs review' : metricsData ? 'Validated' : 'Waiting for data';
  const activeCustomIntegrationSourceScope: CustomIntegrationSourceScope | null = customIntegration?.id && campaignId
    ? {
      platform: 'custom_integration',
      scopeType: 'latest_validated_import',
      integrationId: String(customIntegration.id),
      campaignId: String(campaignId),
      selectedImportId: metricsData?.id ? String(metricsData.id) : null,
      sourceLabel: latestImportLabel,
    }
    : null;
  const customIntegrationKpiMetricOptions = CUSTOM_INTEGRATION_METRIC_OPTIONS.map((option) => ({
    ...option,
    resolved: resolveCustomIntegrationMetric(metricsData, option.key),
  }));
  const customIntegrationKpis = Array.isArray(kpisData) ? kpisData : [];
  const customIntegrationKpiTracker = customIntegrationKpis.reduce((tracker: any, kpi: any) => {
    const resolved = resolveCustomIntegrationCurrentValue(kpi);
    const current = resolved.currentValue;
    const target = parseCustomIntegrationMetricNumber(kpi.targetValue);
    tracker.total += 1;
    if (!resolved.available || current === null || target === null || target <= 0) {
      tracker.blocked += 1;
      return tracker;
    }
    const progress = computeCustomIntegrationKpiProgress(kpi, current, target);
    tracker.progressTotal += progress.fillPct;
    tracker.progressCount += 1;
    if (progress.band === "above") tracker.above += 1;
    else if (progress.band === "below") tracker.below += 1;
    else tracker.onTrack += 1;
    return tracker;
  }, { total: 0, above: 0, onTrack: 0, below: 0, blocked: 0, progressTotal: 0, progressCount: 0 });
  customIntegrationKpiTracker.avgProgress = customIntegrationKpiTracker.progressCount > 0
    ? customIntegrationKpiTracker.progressTotal / customIntegrationKpiTracker.progressCount
    : 0;
  const kpiFormUsesSourceBackedMetric = Boolean(kpiForm.metric && kpiForm.metric !== 'custom');
  const customIntegrationBenchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
  const customIntegrationBenchmarkTracker = customIntegrationBenchmarks.reduce((tracker: any, benchmark: any) => {
    const resolved = resolveCustomIntegrationCurrentValue(benchmark);
    const current = resolved.currentValue;
    const benchmarkValue = parseCustomIntegrationMetricNumber(benchmark.benchmarkValue);
    tracker.total += 1;
    if (!resolved.available || current === null || benchmarkValue === null || benchmarkValue <= 0) {
      tracker.blocked += 1;
      return tracker;
    }
    const progress = computeCustomIntegrationBenchmarkProgress(benchmark, current, benchmarkValue);
    tracker.progressTotal += progress.fillPct;
    tracker.progressCount += 1;
    if (progress.status === "on_track") tracker.onTrack += 1;
    else if (progress.status === "needs_attention") tracker.needsAttention += 1;
    else tracker.behind += 1;
    return tracker;
  }, { total: 0, onTrack: 0, needsAttention: 0, behind: 0, blocked: 0, progressTotal: 0, progressCount: 0 });
  customIntegrationBenchmarkTracker.avgPct = customIntegrationBenchmarkTracker.progressCount > 0
    ? customIntegrationBenchmarkTracker.progressTotal / customIntegrationBenchmarkTracker.progressCount
    : 0;
  const benchmarkFormUsesSourceBackedMetric = Boolean(benchmarkForm.metric && benchmarkForm.metric !== 'custom');
  const resolvedOverviewGroups = CUSTOM_INTEGRATION_OVERVIEW_GROUPS.map((group) => {
    const metrics = group.metricKeys
      .map((metricKey) => ({ metricKey, resolved: resolveCustomIntegrationMetric(metricsData, metricKey) }))
      .filter(({ resolved }) => resolved.available || group.showUnavailable);
    return { ...group, metrics };
  });
  const sourceBackedMetricCount = resolvedOverviewGroups.reduce(
    (count, group) => count + group.metrics.filter(({ resolved }) => resolved.available).length,
    0
  );
  const hasMetrics = Boolean(metricsData);
  const parserConfidenceRaw = parseCustomIntegrationMetricNumber(parserMetadata?.confidence);
  const parserConfidencePct = parserConfidenceRaw === null
    ? null
    : parserConfidenceRaw <= 1 ? parserConfidenceRaw * 100 : parserConfidenceRaw;
  const insightConfidence = parserRequiresReview
    ? 'low'
    : parserConfidencePct === null ? 'medium' : parserConfidencePct >= 95 ? 'high' : parserConfidencePct >= 80 ? 'medium' : 'low';
  const getInsightMetric = (metricKey: string) => customIntegrationKpiMetricOptions.find((metric) => metric.key === metricKey);
  const getInsightValue = (metricKey: string) => {
    const metric = getInsightMetric(metricKey);
    return metric?.resolved.available && metric.resolved.currentValue !== null ? metric.resolved.currentValue : null;
  };
  const formatInsightMetric = (metricKey: string, value: number) => {
    const metric = getInsightMetric(metricKey);
    return formatCustomIntegrationMetricValue(value, metric?.resolved.unit || metric?.unit || '', metric?.resolved.option?.type || metric?.type);
  };
  const customIntegrationInsights = (() => {
    const performance: any[] = [];
    const recommendations: any[] = [];
    const quality: any[] = [];
    const sourceEvidence = latestImportLabel ? [`Source: ${latestImportLabel}`] : [];

    const addRecommendation = (insight: any) => {
      if (!insight.action) return;
      recommendations.push({
        priority: insight.severity === 'high' ? 'high' : insight.severity === 'medium' ? 'medium' : 'low',
        message: insight.recommendation || insight.message,
        action: insight.action,
        evidence: insight.evidence,
      });
    };
    const addPerformance = (insight: any) => {
      performance.push({ confidence: insightConfidence, ...insight });
      if (insight.severity === 'high' || insight.severity === 'medium') addRecommendation(insight);
    };
    const addQuality = (insight: any) => {
      quality.push({ confidence: insightConfidence, ...insight });
      addRecommendation(insight);
    };
    const addThresholdInsight = (
      metricKey: string,
      value: number | null,
      checks: Array<{ test: (value: number) => boolean; severity: 'high' | 'medium' | 'low'; message: (value: number) => string; action?: string; recommendation?: (value: number) => string }>
    ) => {
      if (value === null) return;
      const metric = getInsightMetric(metricKey);
      const matched = checks.find((check) => check.test(value));
      if (!matched) return;
      const formatted = formatInsightMetric(metricKey, value);
      addPerformance({
        metricKey,
        severity: matched.severity,
        direction: matched.severity === 'low' ? 'positive' : 'needs_attention',
        message: matched.message(value),
        recommendation: matched.recommendation ? matched.recommendation(value) : matched.message(value),
        action: matched.action,
        evidence: [`${metric?.label || metricKey}: ${formatted}`, ...sourceEvidence],
      });
    };

    if (!metricsData) {
      return { summary: { total: 0, high: 0, medium: 0 }, performance, recommendations, quality };
    }

    if (parserRequiresReview) {
      addQuality({
        severity: 'high',
        message: 'Import requires review before these Insights are used for decisions.',
        recommendation: 'Review the imported report before acting on the generated Insights.',
        action: 'Open the source PDF/report and verify the extracted metrics with parser warnings.',
        evidence: [parserWarnings[0] || 'Parser review is required.', ...sourceEvidence],
      });
    }

    const revenue = getInsightValue('revenue');
    const spend = getInsightValue('spend');
    if (spend !== null && revenue === null) {
      addQuality({
        severity: 'high',
        message: 'Spend is imported but Revenue is unavailable, so ROI and ROAS cannot be evaluated.',
        recommendation: 'Add source-backed Revenue to evaluate financial return.',
        action: 'Include a Revenue field in the next Custom Integration import or upload a report with revenue.',
        evidence: [`Spend: ${formatInsightMetric('spend', spend)}`, getInsightMetric('revenue')?.resolved.reason || 'Revenue unavailable.', ...sourceEvidence],
      });
    }
    if (revenue !== null && spend === null) {
      addQuality({
        severity: 'medium',
        message: 'Revenue is imported but Spend is unavailable, so ROI and ROAS cannot be evaluated.',
        recommendation: 'Add source-backed Spend to evaluate financial return.',
        action: 'Include a Spend field in the next Custom Integration import or upload a report with spend.',
        evidence: [`Revenue: ${formatInsightMetric('revenue', revenue)}`, getInsightMetric('spend')?.resolved.reason || 'Spend unavailable.', ...sourceEvidence],
      });
    }

    addThresholdInsight('roas', getInsightValue('roas'), [
      { test: (v) => v < 1, severity: 'high', message: (v) => `ROAS is below breakeven at ${formatInsightMetric('roas', v)}.`, action: 'Review spend and revenue attribution before scaling this source.' },
      { test: (v) => v >= 1 && v < 2, severity: 'medium', message: (v) => `ROAS is positive but below 2.00x at ${formatInsightMetric('roas', v)}.`, action: 'Identify which campaigns or offers are limiting return before increasing investment.' },
      { test: (v) => v >= 3, severity: 'low', message: (v) => `ROAS is strong at ${formatInsightMetric('roas', v)}.`, action: 'Use this import as a comparison point for future reports.' },
    ]);
    addThresholdInsight('roi', getInsightValue('roi'), [
      { test: (v) => v < 0, severity: 'high', message: (v) => `ROI is negative at ${formatInsightMetric('roi', v)}.`, action: 'Review cost and revenue inputs before making budget decisions.' },
      { test: (v) => v >= 0 && v < 20, severity: 'medium', message: (v) => `ROI is low at ${formatInsightMetric('roi', v)}.`, action: 'Check whether spend is concentrated in low-return activity.' },
      { test: (v) => v >= 100, severity: 'low', message: (v) => `ROI is strong at ${formatInsightMetric('roi', v)}.`, action: 'Use this return level as a benchmark for future imports.' },
    ]);

    const clicks = getInsightValue('clicks');
    const impressions = getInsightValue('impressions');
    if (clicks !== null && impressions !== null && impressions > 0) {
      const ctr = (clicks / impressions) * 100;
      addPerformance({
        metricKey: 'clicks',
        severity: ctr < 0.5 ? 'high' : ctr < 1 ? 'medium' : ctr >= 2 ? 'low' : 'medium',
        direction: ctr >= 2 ? 'positive' : 'needs_attention',
        message: `Click-through rate from imported clicks and impressions is ${ctr.toFixed(1)}%.`,
        recommendation: ctr >= 2 ? 'Click engagement is strong for this import.' : 'Click engagement needs attention for this import.',
        action: ctr >= 2 ? 'Compare future imports against this engagement level.' : 'Review creative, offer, and audience quality for the imported activity.',
        evidence: [`Clicks: ${formatInsightMetric('clicks', clicks)}`, `Impressions: ${formatInsightMetric('impressions', impressions)}`, ...sourceEvidence],
      });
    }

    const conversions = getInsightValue('conversions');
    if (conversions !== null && clicks !== null && clicks > 0) {
      const conversionRate = (conversions / clicks) * 100;
      addPerformance({
        metricKey: 'conversions',
        severity: conversionRate < 1 ? 'high' : conversionRate < 3 ? 'medium' : conversionRate >= 5 ? 'low' : 'medium',
        direction: conversionRate >= 5 ? 'positive' : 'needs_attention',
        message: `Conversion rate from imported conversions and clicks is ${conversionRate.toFixed(1)}%.`,
        recommendation: conversionRate >= 5 ? 'Post-click conversion is strong for this import.' : 'Post-click conversion needs attention for this import.',
        action: conversionRate >= 5 ? 'Use this conversion level as a reference for future reports.' : 'Audit landing page, form, and offer alignment for the imported traffic.',
        evidence: [`Conversions: ${formatInsightMetric('conversions', conversions)}`, `Clicks: ${formatInsightMetric('clicks', clicks)}`, ...sourceEvidence],
      });
    }

    addThresholdInsight('bounceRate', getInsightValue('bounceRate'), [
      { test: (v) => v > 70, severity: 'high', message: (v) => `Bounce Rate is high at ${formatInsightMetric('bounceRate', v)}.`, action: 'Review landing page relevance, load speed, and traffic quality.' },
      { test: (v) => v > 55 && v <= 70, severity: 'medium', message: (v) => `Bounce Rate needs attention at ${formatInsightMetric('bounceRate', v)}.`, action: 'Check whether the imported traffic aligns with the landing page offer.' },
      { test: (v) => v <= 40, severity: 'low', message: (v) => `Bounce Rate is healthy at ${formatInsightMetric('bounceRate', v)}.`, action: 'Use this landing-page engagement as a comparison point.' },
    ]);
    addThresholdInsight('pagesPerSession', getInsightValue('pagesPerSession'), [
      { test: (v) => v < 1.5, severity: 'medium', message: (v) => `Pages per session is low at ${formatInsightMetric('pagesPerSession', v)}.`, action: 'Review content paths and next-step calls to action.' },
      { test: (v) => v >= 3, severity: 'low', message: (v) => `Pages per session is strong at ${formatInsightMetric('pagesPerSession', v)}.`, action: 'Use this engagement level as a reference for future imports.' },
    ]);
    addThresholdInsight('openRate', getInsightValue('openRate'), [
      { test: (v) => v < 15, severity: 'high', message: (v) => `Email Open Rate is low at ${formatInsightMetric('openRate', v)}.`, action: 'Review subject line, sender reputation, and audience quality.' },
      { test: (v) => v >= 15 && v < 25, severity: 'medium', message: (v) => `Email Open Rate needs attention at ${formatInsightMetric('openRate', v)}.`, action: 'Test subject line and audience segmentation before the next send.' },
      { test: (v) => v >= 35, severity: 'low', message: (v) => `Email Open Rate is strong at ${formatInsightMetric('openRate', v)}.`, action: 'Use this audience and subject-line pattern as a comparison point.' },
    ]);
    addThresholdInsight('clickThroughRate', getInsightValue('clickThroughRate'), [
      { test: (v) => v < 1, severity: 'high', message: (v) => `Email CTR is low at ${formatInsightMetric('clickThroughRate', v)}.`, action: 'Review offer strength, email layout, and call-to-action clarity.' },
      { test: (v) => v >= 1 && v < 2, severity: 'medium', message: (v) => `Email CTR needs attention at ${formatInsightMetric('clickThroughRate', v)}.`, action: 'Test call-to-action placement and message relevance.' },
      { test: (v) => v >= 5, severity: 'low', message: (v) => `Email CTR is strong at ${formatInsightMetric('clickThroughRate', v)}.`, action: 'Use this message and offer as a comparison point.' },
    ]);
    addThresholdInsight('clickToOpen', getInsightValue('clickToOpen'), [
      { test: (v) => v < 5, severity: 'high', message: (v) => `Email CTOR is low at ${formatInsightMetric('clickToOpen', v)}.`, action: 'Review whether email content matches the subject-line promise.' },
      { test: (v) => v >= 5 && v < 10, severity: 'medium', message: (v) => `Email CTOR needs attention at ${formatInsightMetric('clickToOpen', v)}.`, action: 'Test offer clarity and call-to-action prominence.' },
      { test: (v) => v >= 20, severity: 'low', message: (v) => `Email CTOR is strong at ${formatInsightMetric('clickToOpen', v)}.`, action: 'Use this content pattern as a comparison point.' },
    ]);
    addThresholdInsight('listGrowth', getInsightValue('listGrowth'), [
      { test: (v) => v < 0, severity: 'high', message: (v) => `List Growth is negative at ${formatInsightMetric('listGrowth', v)}.`, action: 'Review unsubscribe, bounce, and acquisition quality in the source report.' },
      { test: (v) => v > 0, severity: 'low', message: (v) => `List Growth is positive at ${formatInsightMetric('listGrowth', v)}.`, action: 'Compare future imports against this growth level.' },
    ]);

    const allInsights = [...quality, ...performance];
    const high = allInsights.filter((insight) => insight.severity === 'high').length;
    const medium = allInsights.filter((insight) => insight.severity === 'medium').length;
    return { summary: { total: allInsights.length, high, medium }, performance, recommendations, quality };
  })();

  const handleCustomIntegrationPdfUpload = async (file?: File | null) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch(`/api/custom-integration/${campaignId}/upload-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Upload failed');

      toast({
        title: "Success!",
        description: "PDF uploaded and metrics extracted",
      });

      refetchMetrics();
      queryClient.invalidateQueries({ queryKey: ["/api/custom-integration", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/linkedin/metrics", campaignId] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=yesterday`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=last_week`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=last_month`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots?period=daily`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots?period=weekly`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots?period=monthly`] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "snapshots", "historical"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta", campaignId, "analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ga4-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "outcome-totals"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-muted">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navigation />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => setLocation(`/campaigns/${campaignId}`)}
                className="mb-4"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-8 w-8 shrink-0 text-purple-600" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Custom Integration Analytics
                  </h1>
                  <p className="min-h-6 text-muted-foreground/70">
                    {(campaign as any)?.name ? `Marketing data for ${(campaign as any).name}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-border bg-card p-4" data-testid="custom-integration-data-status">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Custom Data</p>
                    <p className="text-sm text-muted-foreground">
                      {latestImportLabel}
                      {metricsData?.uploadedAt ? ` - Last updated ${new Date(metricsData.uploadedAt).toLocaleString()}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">Validation: {latestImportStatus}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf"
                    id="custom-integration-pdf-upload"
                    className="hidden"
                    onChange={(e) => handleCustomIntegrationPdfUpload(e.target.files?.[0])}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('custom-integration-pdf-upload')?.click()}
                    className="gap-2"
                    data-testid="button-upload-custom-integration-pdf"
                  >
                    <Upload className="h-4 w-4" />
                    Upload PDF
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Show loading state while fetching metrics */}
                {metricsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                )}

                {!metricsLoading && metricsData && parserRequiresReview && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" data-testid="custom-integration-parser-review">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold">Import needs review</p>
                        <p className="text-sm">
                          Confidence: {parserMetadata?.confidence ?? 'Unavailable'}%
                          {parserMetadata?.extractedFields != null ? ` - Extracted fields: ${parserMetadata.extractedFields}` : ''}
                        </p>
                        {parserWarnings[0] && (
                          <p className="text-sm">{parserWarnings[0]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show "Awaiting Data" state when there are NO metrics AND data has finished loading */}
                {!metricsLoading && !hasMetrics && customIntegrationEmail && (
                  <Card className="border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950">
                    <CardContent className="pt-8 pb-8">
                      <div className="text-center space-y-6">
                        {/* Icon */}
                        <div className="flex justify-center">
                          <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Mail className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>

                        {/* Heading */}
                        <div>
                          <h3 className="text-xl font-semibold text-foreground mb-2">
                            Awaiting First Data Import
                          </h3>
                          <p className="text-muted-foreground/70">
                            Your campaign is ready to receive data!
                          </p>
                        </div>

                        {/* Email Address */}
                        <div className="bg-card rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                          <p className="text-sm font-medium text-foreground/80/60 mb-3">
                            📧 Forward PDF reports to:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-4 py-3 rounded border border-border text-blue-900 dark:text-blue-100 font-mono text-sm break-all">
                              {customIntegrationEmail}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(customIntegrationEmail);
                                toast({ 
                                  title: "Copied!", 
                                  description: "Email address copied to clipboard" 
                                });
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="text-left bg-card rounded-lg p-4 border border-border">
                          <h4 className="font-semibold text-foreground mb-3">
                            How to import your first report:
                          </h4>
                          <ol className="space-y-2 text-sm text-muted-foreground/70">
                            <li className="flex items-start gap-2">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 mt-0.5">1.</span>
                              <span>Receive a PDF report via email from your data provider</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 mt-0.5">2.</span>
                              <span>Forward the email (with PDF attached) to the address above</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 mt-0.5">3.</span>
                              <span>Metrics will appear on this page within 60 seconds</span>
                            </li>
                          </ol>
                        </div>

                        {/* Tip */}
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            <span className="text-lg">💡</span>
                            <span><strong>Tip:</strong> Add this email to your contacts for quick access</span>
                          </p>
                        </div>

                        {/* Status Footer */}
                        <div className="pt-4 border-t border-border flex items-center justify-center gap-2 text-sm text-muted-foreground/70">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                          <span>Status: Waiting for data</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}


                {hasMetrics && (
                  <>
                    <Card data-testid="custom-integration-imported-data-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          Imported Data
                        </CardTitle>
                        <CardDescription>
                          {latestImportLabel}
                          {metricsData?.uploadedAt ? ` - Last updated ${new Date(metricsData.uploadedAt).toLocaleString()}` : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Validation</p>
                          <p className="font-medium text-foreground">{latestImportStatus}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <p className="font-medium text-foreground">{parserMetadata?.confidence ?? 'Unavailable'}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Extracted fields</p>
                          <p className="font-medium text-foreground">{parserMetadata?.extractedFields ?? 'Unavailable'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Source-backed metrics</p>
                          <p className="font-medium text-foreground">{sourceBackedMetricCount}</p>
                        </div>
                      </CardContent>
                    </Card>

                    {resolvedOverviewGroups.map((group) => {
                      if (!group.metrics.length) return null;
                      const Icon = group.icon;
                      return (
                        <div key={group.title} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-purple-600" />
                            <h3 className="text-lg font-semibold text-foreground">{group.title}</h3>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {group.metrics.map(({ metricKey, resolved }) => (
                              <Card key={metricKey} data-testid={`card-metric-${metricKey}`}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground/70">
                                      {resolved.option?.label || metricKey}
                                    </CardTitle>
                                    {!resolved.available && (
                                      <AlertCircle className="h-4 w-4 text-amber-600" />
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-foreground" data-testid={`value-${metricKey}`}>
                                    {resolved.available
                                      ? formatCustomIntegrationMetricValue(resolved.currentValue, resolved.unit, resolved.option?.type)
                                      : 'Unavailable'}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {resolved.available ? resolved.sourceLabel : resolved.reason}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                  </>
                )}
              </TabsContent>

              <TabsContent value="summary" className="space-y-6" data-testid="content-summary">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                    <CardDescription>{latestImportLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {resolvedOverviewGroups.map((group) => {
                      const availableMetrics = group.metrics.filter(({ resolved }) => resolved.available);
                      return (
                        <div key={group.title} className="rounded-lg border border-border p-4">
                          <p className="text-sm text-muted-foreground">{group.title}</p>
                          <p className="mt-1 text-2xl font-bold text-foreground">{availableMetrics.length}</p>
                          <p className="text-xs text-muted-foreground">
                            {availableMetrics.length > 0
                              ? availableMetrics.map(({ resolved }) => resolved.option?.label).filter(Boolean).join(', ')
                              : group.showUnavailable ? 'Required imported fields are unavailable' : 'No source-backed metrics in latest import'}
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6" data-testid="content-kpis">
                {kpisLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-muted rounded"></div>
                    <div className="h-64 bg-muted rounded"></div>
                  </div>
                ) : customIntegrationKpis.length > 0 ? (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Key Performance Indicators</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Track and monitor your Custom Integration KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: '',
                              description: '',
                              reportType: 'kpis',
                              configuration: null,
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-border"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => {
                            setEditingKPI(null);
                            setKpiForm(createEmptyCustomIntegrationKpiForm());
                            setIsKPIModalOpen(true);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    {/* KPI Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground/70">Total KPIs</p>
                              <p className="text-2xl font-bold text-foreground">
                                {customIntegrationKpiTracker.total}
                              </p>
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
                              <p className="text-2xl font-bold text-green-600">
                                {customIntegrationKpiTracker.above}
                              </p>
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
                              <p className="text-2xl font-bold text-blue-600">
                                {customIntegrationKpiTracker.onTrack}
                              </p>
                              <p className="text-xs text-muted-foreground">within +/-5% of target</p>
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
                              <p className="text-2xl font-bold text-red-600">
                                {customIntegrationKpiTracker.below}
                              </p>
                              <p className="text-xs text-muted-foreground">more than -5% below target</p>
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
                                {formatPct(customIntegrationKpiTracker.avgProgress)}
                              </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-violet-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {customIntegrationKpiTracker.blocked > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {customIntegrationKpiTracker.blocked} KPI{customIntegrationKpiTracker.blocked === 1 ? '' : 's'} cannot be evaluated from the active Custom Integration source. Blocked KPIs are excluded from scoring.
                      </div>
                    )}

                    {/* KPI Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {customIntegrationKpis.map((kpi: any) => {
                        const resolvedCurrent = resolveCustomIntegrationCurrentValue(kpi);
                        const currentVal = resolvedCurrent.currentValue;
                        const targetVal = parseCustomIntegrationMetricNumber(kpi.targetValue);
                        const displayUnit = String(kpi.unit || resolvedCurrent.unit || '');
                        const progress = resolvedCurrent.available && currentVal !== null && targetVal !== null && targetVal > 0
                          ? computeCustomIntegrationKpiProgress(kpi, currentVal, targetVal)
                          : null;
                        const metricLabel = String(kpi.metric || kpi.metricKey || kpi.name || '');
                        const { Icon, color } = getCustomIntegrationKpiIcon(metricLabel);

                        return (
                        <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Icon className={`w-5 h-5 ${color}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <CardTitle className="text-lg truncate">{kpi.name}</CardTitle>
                                    {(kpi.metric || kpi.metricKey) && (
                                      <Badge variant="outline" className="bg-muted text-foreground/80 font-mono text-xs shrink-0">
                                        {kpi.metric || kpi.metricKey}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground/70 mt-1">
                                    Source: {resolvedCurrent.sourceLabel || "Saved Custom Integration source unavailable"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                  onClick={() => setEditingKPI({
                                    ...kpi,
                                    currentValue: resolvedCurrent.available && currentVal !== null ? String(currentVal) : '',
                                    unit: kpi.unit || resolvedCurrent.unit || '',
                                  })}
                                  data-testid={`button-edit-kpi-${kpi.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
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

                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div className="bg-muted rounded-lg p-3">
                                <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current</div>
                                <div className="text-xl font-bold text-foreground">
                                  {resolvedCurrent.available && currentVal !== null ? formatCustomIntegrationMetricValue(currentVal, displayUnit, resolvedCurrent.option?.type) : 'Unavailable'}
                                </div>
                              </div>
                              <div className="bg-muted rounded-lg p-3">
                                <div className="text-sm font-medium text-muted-foreground/70 mb-1">Target</div>
                                <div className="text-xl font-bold text-foreground">
                                  {targetVal !== null ? formatCustomIntegrationMetricValue(targetVal, displayUnit, resolvedCurrent.option?.type) : 'Unavailable'}
                                </div>
                              </div>
                            </div>

                            {progress ? (
                              <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                  <span>Progress</span>
                                  <span>{formatPct(progress.attainmentPct)}</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div className={`h-2 rounded-full ${progress.progressColor}`} style={{ width: `${progress.fillPct}%` }} />
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground/70 mt-4">{resolvedCurrent.reason}</p>
                            )}

                            {progress && progress.effectiveDeltaPct !== null && (
                              <div className="mt-2 text-xs text-muted-foreground/70">
                                {(() => {
                                  if (Math.abs(progress.effectiveDeltaPct) < 0.0001) return "At target";
                                  const absStr = formatPct(Math.abs(progress.effectiveDeltaPct)).replace("%", "");
                                  return progress.effectiveDeltaPct > 0
                                    ? `${absStr}% above target`
                                    : `${absStr}% below target`;
                                })()}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Key Performance Indicators</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Track and monitor your Custom Integration KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: '',
                              description: '',
                              reportType: 'kpis',
                              configuration: null,
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-border"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => {
                            setEditingKPI(null);
                            setKpiForm(createEmptyCustomIntegrationKpiForm());
                            setIsKPIModalOpen(true);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    <Card>
                      <CardContent>
                        <div className="text-center py-12">
                          <p className="text-muted-foreground/70 mb-4">
                            No KPIs have been created yet.
                          </p>
                          <Button 
                            onClick={() => {
                              setEditingKPI(null);
                              setKpiForm(createEmptyCustomIntegrationKpiForm());
                              setIsKPIModalOpen(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            data-testid="button-create-kpi"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create KPI
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Benchmarks Tab */}
              <TabsContent value="benchmarks" className="space-y-6" data-testid="content-benchmarks">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Performance Benchmarks</h2>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Compare Custom Integration metrics against source-backed benchmark values.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditingReportId(null);
                        setReportForm({
                          name: '',
                          description: '',
                          reportType: 'benchmarks',
                          configuration: null,
                          scheduleEnabled: false,
                          scheduleFrequency: 'weekly',
                          scheduleDayOfWeek: 'monday',
                          scheduleTime: '9:00 AM',
                          emailRecipients: '',
                          status: 'draft'
                        });
                        setIsReportModalOpen(true);
                      }}
                      className="border-border"
                      data-testid="button-export-benchmarks-report"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Export Benchmarks Report
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingBenchmark(null);
                        setInitialBenchmarkForm(null);
                        setBenchmarkForm({
                          metric: '',
                          name: '',
                          category: 'performance',
                          benchmarkType: '',
                          competitorName: '',
                          unit: '',
                          benchmarkValue: '',
                          currentValue: '',
                          industry: '',
                          description: '',
                          source: '',
                          geographicLocation: '',
                          period: 'monthly',
                          confidenceLevel: '',
                          alertsEnabled: false,
                          alertThreshold: '',
                          alertCondition: 'below',
                          emailRecipients: ''
                        });
                        setIsBenchmarkModalOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      data-testid="button-create-benchmark"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Benchmark
                    </Button>
                  </div>
                </div>

                {benchmarksLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-muted rounded"></div>
                    <div className="h-64 bg-muted rounded"></div>
                  </div>
                ) : benchmarksData && (benchmarksData as any[]).length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Total Benchmarks</p><p className="text-2xl font-bold text-foreground">{customIntegrationBenchmarkTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">On Track</p><p className="text-2xl font-bold text-green-600">{customIntegrationBenchmarkTracker.onTrack}</p><p className="text-xs text-muted-foreground">90% or more of benchmark</p></div><CheckCircle2 className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Needs Attention</p><p className="text-2xl font-bold text-amber-600">{customIntegrationBenchmarkTracker.needsAttention}</p><p className="text-xs text-muted-foreground">70% to under 90% of benchmark</p></div><AlertCircle className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
                      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Behind</p><p className="text-2xl font-bold text-red-600">{customIntegrationBenchmarkTracker.behind}</p><p className="text-xs text-muted-foreground">below 70% of benchmark</p></div><AlertTriangle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Avg. Progress</p><p className="text-2xl font-bold text-foreground">{customIntegrationBenchmarkTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
                    </div>

                    {customIntegrationBenchmarkTracker.blocked > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {customIntegrationBenchmarkTracker.blocked} Benchmark{customIntegrationBenchmarkTracker.blocked === 1 ? '' : 's'} cannot be evaluated from the active Custom Integration source. Blocked Benchmarks are excluded from scoring.
                      </div>
                    )}

                    {/* Benchmark Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {customIntegrationBenchmarks.map((benchmark: any) => {
                        const resolvedCurrent = resolveCustomIntegrationCurrentValue(benchmark);
                        const currentVal = resolvedCurrent.currentValue;
                        const benchmarkVal = parseCustomIntegrationMetricNumber(benchmark.benchmarkValue);
                        const displayUnit = String(benchmark.unit || resolvedCurrent.unit || '');
                        const progress = resolvedCurrent.available && currentVal !== null && benchmarkVal !== null && benchmarkVal > 0
                          ? computeCustomIntegrationBenchmarkProgress(benchmark, currentVal, benchmarkVal)
                          : null;
                        const metricLabel = String(benchmark.metric || benchmark.metricKey || benchmark.name || '');
                        const { Icon, color } = getCustomIntegrationKpiIcon(metricLabel);
                        const statusLabel = progress?.status === 'on_track' ? 'On Track' : progress?.status === 'needs_attention' ? 'Needs Attention' : 'Behind';
                        const statusColor = progress?.status === 'on_track' ? 'text-green-600' : progress?.status === 'needs_attention' ? 'text-yellow-600' : 'text-red-600';
                        const delta = Number.isFinite(progress?.deltaPct) ? progress?.deltaPct || 0 : 0;
                        const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
                        return (
                        <Card key={benchmark.id} data-testid={`benchmark-card-${benchmark.id}`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start gap-4 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Icon className={`w-5 h-5 ${color}`} />
                                </div>
                                <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground text-lg">
                                    {benchmark.name}
                                  </h3>
                                </div>
                                <p className="text-sm text-muted-foreground/70 mt-1">
                                  {benchmark.description || 'No description provided'}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                  Source: {resolvedCurrent.sourceLabel || 'Saved Custom Integration source unavailable'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                  {benchmark.benchmarkType && <span>Type: {benchmark.benchmarkType}</span>}
                                  {benchmark.industry && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.industry}</span>
                                    </>
                                  )}
                                  {benchmark.period && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.period}</span>
                                    </>
                                  )}
                                  {benchmark.category && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingBenchmark(benchmark);
                                    const editUnit = getCustomIntegrationUnitLabel(displayUnit, resolvedCurrent.option?.type);
                                    const formData = {
                                      metric: benchmark.metric || benchmark.metricKey || '',
                                      name: benchmark.name || '',
                                      category: benchmark.category || 'performance',
                                      benchmarkType: benchmark.benchmarkType || '',
                                      competitorName: benchmark.competitorName || '',
                                      unit: editUnit,
                                      benchmarkValue: formatCustomIntegrationNumberInput(benchmark.benchmarkValue || '', editUnit),
                                      currentValue: resolvedCurrent.available && currentVal !== null ? String(currentVal) : '',
                                      industry: benchmark.industry || '',
                                      description: benchmark.description || '',
                                      source: benchmark.source || '',
                                      geographicLocation: benchmark.geoLocation || '',
                                      period: benchmark.period || 'monthly',
                                      confidenceLevel: benchmark.confidenceLevel || '',
                                      alertsEnabled: benchmark.alertsEnabled || false,
                                      alertThreshold: benchmark.alertThreshold ? formatCustomIntegrationNumberInput(benchmark.alertThreshold, editUnit) : '',
                                      alertCondition: benchmark.alertCondition || 'below',
                                      emailRecipients: Array.isArray(benchmark.emailRecipients) ? benchmark.emailRecipients.join(', ') : (benchmark.emailRecipients || '')
                                    };
                                    setBenchmarkForm(formData);
                                    setInitialBenchmarkForm(formData);
                                    setIsBenchmarkModalOpen(true);
                                  }}
                                  data-testid={`button-edit-benchmark-${benchmark.id}`}
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
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
                                        Are you sure you want to delete "{benchmark.name}"? This action cannot be undone.
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

                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div className="p-3 bg-muted rounded-lg">
                                <div className="text-sm font-medium text-muted-foreground/70 mb-1">
                                  Current
                                </div>
                                <div className="text-xl font-bold text-foreground">
                                  {currentVal !== null ? formatCustomIntegrationMetricValue(currentVal, displayUnit, resolvedCurrent.option?.type) : 'Unavailable'}
                                </div>
                              </div>

                              <div className="p-3 bg-muted rounded-lg">
                                <div className="text-sm font-medium text-muted-foreground/70 mb-1">
                                  Benchmark
                                </div>
                                <div className="text-xl font-bold text-foreground">
                                  {benchmarkVal !== null ? formatCustomIntegrationMetricValue(benchmarkVal, displayUnit, resolvedCurrent.option?.type) : 'Unavailable'}
                                </div>
                              </div>
                            </div>
                            
                            {progress ? (
                              <div className="mt-4 space-y-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                    <span>Progress</span>
                                    <span>{progress.labelPct}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div className={`h-2 rounded-full ${progress.color}`} style={{ width: `${progress.pct}%` }} />
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground/70">Performance</span>
                                  <div className="flex items-center space-x-2">
                                    <span className={`font-medium ${statusColor}`}>{deltaLabel}</span>
                                    {delta >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                                    <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground/70 mt-4">{resolvedCurrent.reason}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Custom Integration Benchmarks
                      </CardTitle>
                      <CardDescription>
                        Compare your performance against industry benchmarks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-muted-foreground/70 mb-4">
                          No benchmarks have been created yet.
                        </p>
                        <Button 
                          onClick={() => setIsBenchmarkModalOpen(true)}
                          data-testid="button-create-benchmark"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="insights" className="space-y-6" data-testid="content-insights">
                <div data-custom-integration-insights-source-adapter="source-backed">
                  <h2 className="text-2xl font-bold text-foreground">Insights</h2>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Actionable insights from source-backed Custom Integration metrics.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground/70">Total insights</p>
                          <p className="text-2xl font-bold text-foreground">{customIntegrationInsights.summary.total}</p>
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
                          <p className="text-2xl font-bold text-red-600">{customIntegrationInsights.summary.high}</p>
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
                          <p className="text-2xl font-bold text-amber-600">{customIntegrationInsights.summary.medium}</p>
                        </div>
                        <TrendingDown className="w-7 h-7 text-amber-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-md border border-border p-3 text-xs text-muted-foreground/70">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div><span className="font-medium text-foreground">Source:</span> {latestImportLabel}</div>
                    <div><span className="font-medium text-foreground">Import status:</span> {latestImportStatus}</div>
                    <div><span className="font-medium text-foreground">Metrics analyzed:</span> {sourceBackedMetricCount}</div>
                    {parserConfidencePct !== null && (
                      <div><span className="font-medium text-foreground">Parser confidence:</span> {parserConfidencePct.toFixed(0)}%</div>
                    )}
                  </div>
                </div>

                {customIntegrationInsights.quality.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" data-testid="custom-integration-insights-quality">
                    <CardHeader>
                      <CardTitle>Import quality</CardTitle>
                      <CardDescription className="text-amber-900/80 dark:text-amber-100/80">Source confidence and completeness checks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customIntegrationInsights.quality.map((insight: any, i: number) => (
                        <div key={`quality-${i}`} className="rounded-lg border border-amber-200 bg-background/60 p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{insight.message}</p>
                              {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Evidence:</span> {insight.evidence.join(' | ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {customIntegrationInsights.performance.length > 0 && (
                  <Card className="border-border" data-testid="custom-integration-insights-performance">
                    <CardHeader>
                      <CardTitle>Performance</CardTitle>
                      <CardDescription>Threshold-backed findings from imported source metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customIntegrationInsights.performance.map((insight: any, i: number) => {
                        const severityClass = insight.severity === 'high'
                          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                          : insight.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900';
                        return (
                          <div key={`performance-${i}`} className="rounded-lg border border-border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {insight.direction === 'positive' ? (
                                    <TrendingUp className="h-4 w-4 shrink-0 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 shrink-0 text-amber-600" />
                                  )}
                                  <span className="font-semibold text-foreground">{insight.message}</span>
                                  <Badge className={`text-xs border ${severityClass}`}>
                                    {insight.severity === 'high' ? 'High' : insight.severity === 'medium' ? 'Medium' : 'Low'}
                                  </Badge>
                                  <Badge className="border bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900 text-xs">
                                    Confidence: {String(insight.confidence || 'medium').charAt(0).toUpperCase() + String(insight.confidence || 'medium').slice(1)}
                                  </Badge>
                                </div>
                                {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Evidence:</span> {insight.evidence.join(' | ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {customIntegrationInsights.recommendations.length > 0 && (
                  <Card className="border-border" data-testid="custom-integration-insights-recommendations">
                    <CardHeader>
                      <CardTitle>What to do next</CardTitle>
                      <CardDescription>Actionable recommendations based on the analysis above</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customIntegrationInsights.recommendations.map((recommendation: any, i: number) => {
                        const priorityClass = recommendation.priority === 'high'
                          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                          : recommendation.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                            : 'bg-muted text-foreground border-border';
                        return (
                          <div key={`recommendation-${i}`} className="rounded-lg border border-border p-4">
                            <div className="flex items-start gap-3">
                              <Badge className={`shrink-0 text-xs border ${priorityClass}`}>
                                {recommendation.priority === 'high' ? 'High' : recommendation.priority === 'medium' ? 'Medium' : 'Low'}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">{recommendation.message}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">Next step:</span> {recommendation.action}
                                </p>
                                {Array.isArray(recommendation.evidence) && recommendation.evidence.length > 0 && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Evidence:</span> {recommendation.evidence.join(' | ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {customIntegrationInsights.summary.total === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/70" />
                      <h3 className="mb-2 text-lg font-medium text-foreground">No Insights Available</h3>
                      <p className="text-muted-foreground/70">
                        Import validated Custom Integration metrics to generate Performance and What to do next insights.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Reports</h2>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Create, schedule, and manage analytics reports for Custom Integration
                    </p>
                  </div>
                  <Button 
                    data-testid="button-create-report" 
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      setEditingReportId(null);
                      setReportModalStep('standard');
                      setReportForm({
                        name: '',
                        description: '',
                        reportType: '',
                        configuration: null,
                        scheduleEnabled: false,
                        scheduleFrequency: 'weekly',
                        scheduleDayOfWeek: 'monday',
                        scheduleTime: '9:00 AM',
                        emailRecipients: '',
                        status: 'draft'
                      });
                      setCustomReportConfig({
                        coreMetrics: [],
                        derivedMetrics: [],
                        kpis: [],
                        benchmarks: []
                      });
                      setIsReportModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Report
                  </Button>
                </div>

                {/* Reports List */}
                {reportsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-muted rounded"></div>
                    <div className="h-32 bg-muted rounded"></div>
                  </div>
                ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {reportsData.map((report: any) => (
                      <Card key={report.id} data-testid={`report-${report.id}`} className="border-purple-200 dark:border-purple-900">
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
                                <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                                  {report.reportType}
                                </Badge>
                                {report.scheduleFrequency && (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {report.scheduleFrequency}
                                  </span>
                                )}
                                <span className="text-muted-foreground/70">
                                  Created {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownloadReport(report)}
                                data-testid={`button-download-${report.id}`}
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                data-testid={`button-edit-${report.id}`}
                                onClick={() => handleEditReport(report)}
                                className="hover:bg-purple-50 dark:hover:bg-purple-950/30"
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
                  <Card className="border-purple-200 dark:border-purple-900">
                    <CardContent className="py-12 text-center">
                      <Target className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No Reports Created
                      </h3>
                      <p className="text-muted-foreground/70 mb-4">
                        Create automated reports to track your custom integration performance
                      </p>
                      <Button 
                        onClick={() => {
                          setEditingReportId(null);
                          setReportModalStep('standard');
                          setReportForm({
                            name: '',
                            description: '',
                            reportType: '',
                            configuration: null,
                            scheduleEnabled: false,
                            scheduleFrequency: 'weekly',
                            scheduleDayOfWeek: 'monday',
                            scheduleTime: '9:00 AM',
                            emailRecipients: '',
                            status: 'draft'
                          });
                          setCustomReportConfig({
                            coreMetrics: [],
                            derivedMetrics: [],
                            kpis: [],
                            benchmarks: []
                          });
                          setIsReportModalOpen(true);
                        }}
                        data-testid="button-create-first-report"
                        className="gap-2 bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                        Create Your First Report
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* KPI Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          // Reset editing state when modal closes
          setEditingKPI(null);
          setKpiForm(createEmptyCustomIntegrationKpiForm());
          setInitialKpiForm(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
            <DialogDescription>
              Set up a key performance indicator for Custom Integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-4 rounded-lg bg-muted p-4" data-custom-integration-kpi-source-adapter="source-backed">
              <div>
                <h4 className="font-medium text-foreground">Select KPI Template</h4>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Choose an imported Custom Integration metric with a current source-backed value.
                </p>
              </div>
              {CUSTOM_INTEGRATION_OVERVIEW_GROUPS.map((group) => {
                const groupMetrics = group.metricKeys
                  .map((metricKey) => customIntegrationKpiMetricOptions.find((metric) => metric.key === metricKey))
                  .filter(Boolean) as any[];
                if (!groupMetrics.length) return null;
                return (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground/70">{group.title}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {groupMetrics.map((metric) => {
                        const selected = kpiForm.metric === metric.key;
                        const disabled = metric.resolved.available !== true;
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            disabled={disabled}
                            className={`rounded-lg border-2 p-3 text-left transition-all ${
                              disabled
                                ? 'cursor-not-allowed border-border opacity-50'
                                : selected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-border hover:border-purple-300'
                            }`}
                            onClick={() => {
                              if (disabled) return;
                              setKpiForm({
                                ...kpiForm,
                                name: editingKPI ? kpiForm.name || metric.label : metric.label,
                                metric: metric.key,
                                currentValue: metric.resolved.currentValue !== null ? String(metric.resolved.currentValue) : '',
                                unit: getCustomIntegrationUnitLabel(metric.resolved.unit, metric.resolved.option?.type),
                                description: kpiForm.description || `Track ${metric.label} from the active Custom Integration import.`,
                              });
                            }}
                            data-testid={`button-kpi-template-${metric.key}`}
                          >
                            <div className="text-sm font-medium text-foreground">{metric.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  kpiForm.metric === 'custom'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-border hover:border-purple-300'
                }`}
                onClick={() => setKpiForm({ ...kpiForm, metric: 'custom', currentValue: '', unit: '' })}
                data-testid="button-kpi-template-custom"
              >
                <div className="text-sm font-medium text-foreground">Create Custom KPI</div>
                <div className="mt-1 text-xs text-muted-foreground/70">Manual current value and unit</div>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-name">KPI Name *</Label>
              <Input
                id="kpi-name"
                placeholder="e.g., Email Open Rate"
                value={kpiForm.name}
                onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                data-testid="input-kpi-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-description">Description</Label>
              <Textarea
                id="kpi-description"
                placeholder="Describe what this KPI measures and why it's important"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                rows={3}
                data-testid="input-kpi-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-current">Current Value</Label>
                <Input
                  id="kpi-current"
                  type="text"
                  placeholder="0"
                  value={formatCustomIntegrationNumberInput(kpiForm.currentValue, kpiForm.unit)}
                  readOnly={kpiFormUsesSourceBackedMetric}
                  className={kpiFormUsesSourceBackedMetric ? 'bg-muted cursor-not-allowed' : undefined}
                  onChange={(e) => {
                    if (kpiFormUsesSourceBackedMetric) return;
                    const value = cleanCustomIntegrationNumberInput(e.target.value);
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setKpiForm({ ...kpiForm, currentValue: value });
                    }
                  }}
                  data-source-backed-current-value={kpiFormUsesSourceBackedMetric ? 'custom_integration' : undefined}
                  data-testid="input-kpi-current"
                />
                <p className="text-xs text-muted-foreground/70">
                  {kpiFormUsesSourceBackedMetric ? 'Read from the active Custom Integration import.' : 'Enter a manual value for custom KPIs.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target Value *</Label>
                <Input
                  id="kpi-target"
                  type="text"
                  placeholder="0"
                  value={formatCustomIntegrationNumberInput(kpiForm.targetValue, kpiForm.unit)}
                  onChange={(e) => {
                    const value = cleanCustomIntegrationNumberInput(e.target.value);
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setKpiForm({ ...kpiForm, targetValue: value });
                    }
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

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-priority">Priority</Label>
                <Select
                  value={kpiForm.priority}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, priority: value })}
                >
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
                <p className="pl-6 text-sm text-muted-foreground/70">
                  Receive notifications when this KPI crosses your alert threshold.
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
                        value={formatCustomIntegrationNumberInput(kpiForm.alertThreshold, kpiForm.unit)}
                        onChange={(e) => {
                          const value = cleanCustomIntegrationNumberInput(e.target.value);
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setKpiForm({ ...kpiForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-kpi-alert-threshold"
                      />
                      <p className="text-xs text-muted-foreground/70">
                        Value at which to trigger the alert
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kpi-alert-condition">Alert When</Label>
                      <Select
                        value={kpiForm.alertCondition}
                        onValueChange={(value) => setKpiForm({ ...kpiForm, alertCondition: value })}
                      >
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
                        value={kpiForm.alertFrequency || 'immediate'}
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
                          <p className="text-xs text-muted-foreground/70">
                            Comma-separated email addresses
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsKPIModalOpen(false);
                  setEditingKPI(null);
                  setKpiForm(createEmptyCustomIntegrationKpiForm());
                  setInitialKpiForm(null);
                }}
                data-testid="button-kpi-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleKPISubmit}
                disabled={!kpiForm.name || !kpiForm.metric || !kpiForm.targetValue || !campaignId || (Boolean(editingKPI) && !isKpiFormDirty)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-kpi-submit"
              >
                {editingKPI ? 'Update KPI' : 'Create KPI'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Benchmark Modal */}
      <Dialog open={isBenchmarkModalOpen} onOpenChange={setIsBenchmarkModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBenchmark ? 'Edit Benchmark' : 'Create New Benchmark'}</DialogTitle>
            <DialogDescription>
              {editingBenchmark 
                ? 'Update the benchmark details below. The current value can be auto-populated from your metrics data.'
                : 'Define a new benchmark for your custom integration. You can select metrics from the Overview tab as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name *</Label>
              <Input
                id="benchmark-name"
                placeholder="e.g., Email Open Rate Benchmark"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                data-testid="input-benchmark-name"
              />
            </div>

            <div className="space-y-4 rounded-lg bg-muted p-4" data-custom-integration-benchmark-source-adapter="source-backed">
              <div>
                <h4 className="font-medium text-foreground">Select Benchmark Template</h4>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Choose an imported Custom Integration metric with a current source-backed value.
                </p>
              </div>
              {CUSTOM_INTEGRATION_OVERVIEW_GROUPS.map((group) => {
                const groupMetrics = group.metricKeys
                  .map((metricKey) => customIntegrationKpiMetricOptions.find((metric) => metric.key === metricKey))
                  .filter(Boolean) as any[];
                if (!groupMetrics.length) return null;
                return (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground/70">{group.title}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {groupMetrics.map((metric) => {
                        const selected = benchmarkForm.metric === metric.key;
                        const disabled = metric.resolved.available !== true;
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            disabled={disabled}
                            className={`rounded-lg border-2 p-3 text-left transition-all ${
                              disabled
                                ? 'cursor-not-allowed border-border opacity-50'
                                : selected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-border hover:border-purple-300'
                            }`}
                            onClick={() => {
                              if (disabled) return;
                              setBenchmarkForm({
                                ...benchmarkForm,
                                name: editingBenchmark ? benchmarkForm.name || metric.label : metric.label,
                                metric: metric.key,
                                currentValue: metric.resolved.currentValue !== null ? String(metric.resolved.currentValue) : '',
                                unit: getCustomIntegrationUnitLabel(metric.resolved.unit, metric.resolved.option?.type),
                                description: benchmarkForm.description || `Benchmark ${metric.label} from the active Custom Integration import.`,
                              });
                            }}
                            data-testid={`button-benchmark-template-${metric.key}`}
                          >
                            <div className="text-sm font-medium text-foreground">{metric.label}</div>
                            {disabled && (
                              <div className="mt-1 text-xs text-muted-foreground/70">{metric.resolved.reason}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  benchmarkForm.metric === 'custom'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-border hover:border-purple-300'
                }`}
                onClick={() => setBenchmarkForm({ ...benchmarkForm, metric: 'custom', currentValue: '', unit: '' })}
                data-testid="button-benchmark-template-custom"
              >
                <div className="text-sm font-medium text-foreground">Create Custom Benchmark</div>
                <div className="mt-1 text-xs text-muted-foreground/70">Manual current value and unit</div>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="benchmark-description">Description</Label>
              <Textarea
                id="benchmark-description"
                placeholder="Describe this benchmark and why it's important"
                value={benchmarkForm.description}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, description: e.target.value })}
                rows={3}
                data-testid="input-benchmark-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-current">Current Value</Label>
                <Input
                  id="benchmark-current"
                  type="text"
                  placeholder="0"
                  value={formatCustomIntegrationNumberInput(benchmarkForm.currentValue, benchmarkForm.unit)}
                  readOnly={benchmarkFormUsesSourceBackedMetric}
                  className={benchmarkFormUsesSourceBackedMetric ? 'bg-muted cursor-not-allowed' : undefined}
                  onChange={(e) => {
                    if (benchmarkFormUsesSourceBackedMetric) return;
                    const value = cleanCustomIntegrationNumberInput(e.target.value);
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setBenchmarkForm({ ...benchmarkForm, currentValue: value });
                    }
                  }}
                  data-source-backed-current-value={benchmarkFormUsesSourceBackedMetric ? 'custom_integration_benchmark' : undefined}
                  data-testid="input-benchmark-current"
                />
                <p className="text-xs text-muted-foreground/70">
                  {benchmarkFormUsesSourceBackedMetric ? 'Read from the active Custom Integration import.' : 'Enter a manual value for custom Benchmarks.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  type="text"
                  placeholder="0"
                  value={formatCustomIntegrationNumberInput(benchmarkForm.benchmarkValue, benchmarkForm.unit)}
                  onChange={(e) => {
                    const value = cleanCustomIntegrationNumberInput(e.target.value);
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setBenchmarkForm({ ...benchmarkForm, benchmarkValue: value });
                    }
                  }}
                  data-testid="input-benchmark-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-unit">Unit</Label>
                <Input
                  id="benchmark-unit"
                  placeholder="%, $, etc."
                  value={benchmarkForm.unit}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, unit: e.target.value })}
                  data-testid="input-benchmark-unit"
                />
              </div>
            </div>

            {/* Alert Settings Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="benchmark-alerts-enabled"
                  checked={benchmarkForm.alertsEnabled}
                  onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-benchmark-alerts"
                />
                <Label htmlFor="benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable Email Alerts
                </Label>
              </div>

              {benchmarkForm.alertsEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="benchmark-alert-threshold"
                        type="text"
                        placeholder="e.g., 80"
                        value={formatCustomIntegrationNumberInput(benchmarkForm.alertThreshold, benchmarkForm.unit)}
                        onChange={(e) => {
                          const value = cleanCustomIntegrationNumberInput(e.target.value);
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setBenchmarkForm({ ...benchmarkForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-benchmark-alert-threshold"
                      />
                      <p className="text-xs text-muted-foreground/70">
                        Value at which to trigger the alert
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-alert-condition">Alert When</Label>
                      <Select
                        value={benchmarkForm.alertCondition}
                        onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, alertCondition: value })}
                      >
                        <SelectTrigger id="benchmark-alert-condition" data-testid="select-benchmark-alert-condition">
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

                  <div className="space-y-2">
                    <Label htmlFor="benchmark-email-recipients">Email Recipients *</Label>
                    <Input
                      id="benchmark-email-recipients"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={benchmarkForm.emailRecipients}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, emailRecipients: e.target.value })}
                      data-testid="input-benchmark-email-recipients"
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Comma-separated email addresses for alert notifications
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBenchmarkModalOpen(false);
                  setEditingBenchmark(null);
                  setInitialBenchmarkForm(null);
                  setBenchmarkForm({
                    metric: '',
                    name: '',
                    category: 'performance',
                    benchmarkType: '',
                    competitorName: '',
                    unit: '',
                    benchmarkValue: '',
                    currentValue: '',
                    industry: '',
                    description: '',
                    source: '',
                    geographicLocation: '',
                    period: 'monthly',
                    confidenceLevel: '',
                    alertsEnabled: false,
                    alertThreshold: '',
                    alertCondition: 'below',
                    emailRecipients: ''
                  });
                }}
                data-testid="button-benchmark-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBenchmarkSubmit}
                disabled={!benchmarkForm.name || !benchmarkForm.metric || !benchmarkForm.benchmarkValue || !campaignId || createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending || (Boolean(editingBenchmark) && !isBenchmarkFormDirty)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-benchmark-submit"
              >
                {createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending ? (
                  <>
                    <span className="mr-2">Processing...</span>
                  </>
                ) : (
                  editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              {editingReportId ? 'Edit Report' : 'Create New Report'}
            </DialogTitle>
            <DialogDescription>
              {reportModalStep === 'standard' 
                ? 'Choose a report type and configure scheduling options for Custom Integration analytics'
                : 'Select the metrics, KPIs, and benchmarks to include in your custom report'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {reportModalStep === 'standard' && (
              <div className="space-y-6">
                {/* Report Type Selection */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground/80/60">Report Type</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'overview' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'overview' })}
                      data-testid="card-overview-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Overview Report</h4>
                        <p className="text-sm text-muted-foreground/70">
                          Comprehensive snapshot of all Custom Integration metrics
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'kpis' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'kpis' })}
                      data-testid="card-kpis-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">KPIs Report</h4>
                        <p className="text-sm text-muted-foreground/70">
                          Focus on key performance indicators and targets
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'benchmarks' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'benchmarks' })}
                      data-testid="card-benchmarks-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Benchmarks Report</h4>
                        <p className="text-sm text-muted-foreground/70">
                          Compare performance against industry standards
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'custom' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => {
                        setReportModalStep('custom');
                        setReportForm({ ...reportForm, reportType: 'custom' });
                      }}
                      data-testid="card-custom-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Custom Report</h4>
                        <p className="text-sm text-muted-foreground/70">
                          Build your own report with selected metrics
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Report Configuration */}
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="report-name">Report Name *</Label>
                      <Input
                        id="report-name"
                        value={reportForm.name}
                        onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                        placeholder="Enter report name"
                        data-testid="input-report-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="report-description">Description (Optional)</Label>
                      <Textarea
                        id="report-description"
                        value={reportForm.description}
                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                        placeholder="Add a description for this report"
                        rows={3}
                        data-testid="input-report-description"
                      />
                    </div>

                    {/* Schedule Section */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="schedule-reports"
                          checked={reportForm.scheduleEnabled}
                          onCheckedChange={(checked) => {
                            setReportForm({
                              ...reportForm,
                              scheduleEnabled: checked as boolean
                            });
                          }}
                          data-testid="checkbox-schedule-reports"
                        />
                        <Label htmlFor="schedule-reports" className="text-base cursor-pointer font-semibold">
                          Schedule Automatic Reports
                        </Label>
                      </div>

                      {reportForm.scheduleEnabled && (
                        <div className="space-y-4 pl-6">
                          {/* Frequency */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-frequency">Frequency</Label>
                            <Select
                              value={reportForm.scheduleFrequency}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                            >
                              <SelectTrigger id="schedule-frequency" data-testid="select-frequency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Day of Week - Only for Weekly */}
                          {reportForm.scheduleFrequency === 'weekly' && (
                            <div className="space-y-2">
                              <Label htmlFor="schedule-day">Day of Week</Label>
                              <Select
                                value={reportForm.scheduleDayOfWeek}
                                onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                              >
                                <SelectTrigger id="schedule-day" data-testid="select-day">
                                  <SelectValue />
                                </SelectTrigger>
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

                          {/* Time */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-time">Time</Label>
                            <Select
                              value={reportForm.scheduleTime}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                            >
                              <SelectTrigger id="schedule-time" data-testid="select-time">
                                <SelectValue />
                              </SelectTrigger>
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
                              <p className="text-sm text-muted-foreground/70">
                                All times are in your time zone: {getTimeZoneDisplay()}
                              </p>
                            )}
                          </div>

                          {/* Email Recipients */}
                          <div className="space-y-2">
                            <Label htmlFor="email-recipients">Email Recipients</Label>
                            <Input
                              id="email-recipients"
                              value={reportForm.emailRecipients}
                              onChange={(e) => setReportForm({ ...reportForm, emailRecipients: e.target.value })}
                              placeholder="Enter email addresses (comma-separated)"
                              data-testid="input-email-recipients"
                            />
                            <p className="text-sm text-muted-foreground/70">
                              Reports will be automatically generated and sent to these email addresses
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Report Configuration */}
            {reportModalStep === 'custom' && (
              <div className="space-y-6">
                {/* Report Name and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-report-name">Report Name *</Label>
                    <Input
                      id="custom-report-name"
                      value={reportForm.name}
                      onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                      placeholder="Enter report name"
                      data-testid="input-custom-report-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-report-description">Description (Optional)</Label>
                    <Textarea
                      id="custom-report-description"
                      value={reportForm.description}
                      onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                      placeholder="Add a description for this report"
                      rows={2}
                      data-testid="input-custom-report-description"
                    />
                  </div>
                </div>

                {/* Metrics Selection */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold text-foreground">Select Metrics</h3>
                  
                  <Accordion type="multiple" className="w-full">
                    {/* Audience & Traffic Metrics */}
                    <AccordionItem value="audience-traffic">
                      <AccordionTrigger className="text-sm font-semibold text-foreground/80/60">
                        Audience & Traffic Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['users', 'sessions', 'pageviews', 'avgSessionDuration', 'pagesPerSession', 'bounceRate'].map((metric) => {
                            const labels: Record<string, string> = {
                              users: 'Users',
                              sessions: 'Sessions',
                              pageviews: 'Pageviews',
                              avgSessionDuration: 'Avg. Session Duration',
                              pagesPerSession: 'Pages/Session',
                              bounceRate: 'Bounce Rate'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`core-${metric}`}
                                  checked={customReportConfig.coreMetrics.includes(metric)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        coreMetrics: [...customReportConfig.coreMetrics, metric]
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        coreMetrics: customReportConfig.coreMetrics.filter(m => m !== metric)
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-core-${metric}`}
                                />
                                <Label htmlFor={`core-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Traffic Sources */}
                    <AccordionItem value="traffic-sources">
                      <AccordionTrigger className="text-sm font-semibold text-foreground/80/60">
                        Traffic Sources
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['organicSearchShare', 'directBrandedShare', 'emailShare', 'referralShare', 'paidShare', 'socialShare'].map((metric) => {
                            const labels: Record<string, string> = {
                              organicSearchShare: 'Organic Search',
                              directBrandedShare: 'Direct/Branded',
                              emailShare: 'Email',
                              referralShare: 'Referral/Partners',
                              paidShare: 'Paid',
                              socialShare: 'Social'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`traffic-${metric}`}
                                  checked={customReportConfig.derivedMetrics.includes(metric)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: [...customReportConfig.derivedMetrics, metric]
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: customReportConfig.derivedMetrics.filter(m => m !== metric)
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-traffic-${metric}`}
                                />
                                <Label htmlFor={`traffic-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Email Performance Metrics */}
                    <AccordionItem value="email-performance">
                      <AccordionTrigger className="text-sm font-semibold text-foreground/80/60">
                        Email Performance Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['emailsDelivered', 'openRate', 'clickThroughRate', 'clickToOpen', 'hardBounces', 'spamComplaints', 'listGrowth'].map((metric) => {
                            const labels: Record<string, string> = {
                              emailsDelivered: 'Emails Delivered',
                              openRate: 'Open Rate',
                              clickThroughRate: 'Click-Through Rate',
                              clickToOpen: 'Click-to-Open',
                              hardBounces: 'Hard Bounces',
                              spamComplaints: 'Spam Complaints',
                              listGrowth: 'List Growth'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`email-${metric}`}
                                  checked={customReportConfig.derivedMetrics.includes(metric)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: [...customReportConfig.derivedMetrics, metric]
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: customReportConfig.derivedMetrics.filter(m => m !== metric)
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-email-${metric}`}
                                />
                                <Label htmlFor={`email-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* KPIs and Benchmarks Section */}
                <div className="space-y-3 pt-4 border-t">
                  <Accordion type="multiple" className="w-full">
                    {/* KPIs */}
                    <AccordionItem value="kpis">
                      <AccordionTrigger className="text-sm font-semibold text-foreground/80/60">
                        KPIs
                      </AccordionTrigger>
                      <AccordionContent>
                        {kpisData && Array.isArray(kpisData) && kpisData.length > 0 ? (
                          <div className="space-y-2 pt-2">
                            {kpisData.map((kpi: any) => (
                              <div key={kpi.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`kpi-${kpi.id}`}
                                  checked={customReportConfig.kpis.includes(kpi.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        kpis: [...customReportConfig.kpis, kpi.id]
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        kpis: customReportConfig.kpis.filter(id => id !== kpi.id)
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-kpi-${kpi.id}`}
                                />
                                <Label htmlFor={`kpi-${kpi.id}`} className="text-sm cursor-pointer">
                                  {kpi.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground pt-2">No KPIs created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Benchmarks */}
                    <AccordionItem value="benchmarks">
                      <AccordionTrigger className="text-sm font-semibold text-foreground/80/60">
                        Benchmarks
                      </AccordionTrigger>
                      <AccordionContent>
                        {benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                          <div className="space-y-2 pt-2">
                            {benchmarksData.map((benchmark: any) => (
                              <div key={benchmark.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`benchmark-${benchmark.id}`}
                                  checked={customReportConfig.benchmarks.includes(benchmark.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        benchmarks: [...customReportConfig.benchmarks, benchmark.id]
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        benchmarks: customReportConfig.benchmarks.filter(id => id !== benchmark.id)
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-benchmark-${benchmark.id}`}
                                />
                                <Label htmlFor={`benchmark-${benchmark.id}`} className="text-sm cursor-pointer">
                                  {benchmark.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground pt-2">No benchmarks created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Schedule Section for Custom Reports */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-schedule-reports"
                      checked={reportForm.scheduleEnabled}
                      onCheckedChange={(checked) => {
                        setReportForm({
                          ...reportForm,
                          scheduleEnabled: checked as boolean
                        });
                      }}
                      data-testid="checkbox-custom-schedule-reports"
                    />
                    <Label htmlFor="custom-schedule-reports" className="text-base cursor-pointer font-semibold">
                      Schedule Automatic Reports
                    </Label>
                  </div>

                  {reportForm.scheduleEnabled && (
                    <div className="space-y-4 pl-6">
                      {/* Frequency */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-schedule-frequency">Frequency</Label>
                        <Select
                          value={reportForm.scheduleFrequency}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                        >
                          <SelectTrigger id="custom-schedule-frequency" data-testid="select-custom-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Time */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-schedule-time">Time</Label>
                        <Select
                          value={reportForm.scheduleTime}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                        >
                          <SelectTrigger id="custom-schedule-time" data-testid="select-custom-time">
                            <SelectValue />
                          </SelectTrigger>
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
                          <p className="text-sm text-muted-foreground/70">
                            All times are in your time zone: {getTimeZoneDisplay()}
                          </p>
                        )}
                      </div>

                      {/* Email Recipients */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-email-recipients">Email Recipients</Label>
                        <Input
                          id="custom-email-recipients"
                          value={reportForm.emailRecipients}
                          onChange={(e) => setReportForm({ ...reportForm, emailRecipients: e.target.value })}
                          placeholder="Enter email addresses (comma-separated)"
                          data-testid="input-custom-email-recipients"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportModalStep('standard');
                  setEditingReportId(null);
                  setReportForm({
                    name: '',
                    description: '',
                    reportType: '',
                    configuration: null,
                    scheduleEnabled: false,
                    scheduleFrequency: 'weekly',
                    scheduleDayOfWeek: 'monday',
                    scheduleTime: '9:00 AM',
                    emailRecipients: '',
                    status: 'draft'
                  });
                }}
                data-testid="button-cancel-report"
              >
                Cancel
              </Button>
              
              <div className="flex items-center gap-2">
                {reportModalStep === 'custom' && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setReportModalStep('standard');
                      setReportForm({ ...reportForm, reportType: '' });
                    }}
                    data-testid="button-back-to-standard"
                  >
                    Back to Standard Reports
                  </Button>
                )}
                
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-report" : "button-create-report-submit"}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {(createReportMutation.isPending || updateReportMutation.isPending) ? (
                      editingReportId ? 'Updating...' : 'Creating...'
                    ) : editingReportId ? (
                      'Update Report'
                    ) : reportForm.scheduleEnabled ? (
                      'Schedule Report'
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate & Download Report
                      </>
                    )}
                  </Button>
                )}
                
                {reportModalStep === 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-custom-report" : "button-create-custom-report"}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {(createReportMutation.isPending || updateReportMutation.isPending) ? (
                      editingReportId ? 'Updating...' : 'Creating...'
                    ) : editingReportId ? (
                      'Update Report'
                    ) : reportForm.scheduleEnabled ? (
                      'Schedule Report'
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate & Download Report
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

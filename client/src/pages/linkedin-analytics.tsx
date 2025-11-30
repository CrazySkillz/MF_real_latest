import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, Clock, Plus, Heart, MessageCircle, Share2, Activity, Users, Play, Filter, ArrowUpDown, ChevronRight, Trash2, Pencil, FileText, Settings, Download, Percent } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

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

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');
  const [selectedMetric, setSelectedMetric] = useState<string>('impressions');
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'templates' | 'configuration'>('configuration');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const { toast } = useToast();
  const campaignId = params?.id;
  
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
    emailNotifications: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });

  // Benchmark Form State
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    benchmarkType: 'industry', // 'industry' or 'custom'
    industry: '',
    description: '',
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
    scheduleFrequency: 'weekly',
    scheduleDayOfWeek: 'monday',
    scheduleTime: '9:00 AM',
    emailRecipients: '',
    status: 'draft' as const
  });
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  
  // Custom Report Configuration State
  const [customReportConfig, setCustomReportConfig] = useState({
    coreMetrics: [] as string[],
    derivedMetrics: [] as string[],
    kpis: [] as string[],
    benchmarks: [] as string[],
    includeAdComparison: false
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
    queryKey: [`/api/campaigns/${campaignId}/benchmarks`],
    enabled: !!campaignId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    cacheTime: 0, // Don't cache at all
  });
  // Helper function to get benchmark for a metric
  const getBenchmarkForMetric = (metricName: string) => {
    console.log('[getBenchmarkForMetric] Looking for benchmark:', metricName);
    console.log('[getBenchmarkForMetric] Available benchmarks:', benchmarks);
    console.log('[getBenchmarkForMetric] Type:', typeof benchmarks);
    console.log('[getBenchmarkForMetric] Is array?', Array.isArray(benchmarks));
    console.log('[getBenchmarkForMetric] Length:', benchmarks?.length);
    
    // CRITICAL: Check if benchmarks exists and is an array first to prevent undefined errors
    if (!benchmarks || !Array.isArray(benchmarks) || benchmarks.length === 0) {
      console.log('[getBenchmarkForMetric] Benchmarks is not valid, returning null');
      return null;
    }
    
    // STRICT MATCHING: Only match by metric field, NOT by name
    // This prevents wrong benchmarks from being used
    const found = benchmarks.find((b: any) => {
      const metricMatch = b.metric?.toLowerCase() === metricName.toLowerCase();
      console.log(`Checking benchmark: metric="${b.metric}", name="${b.name}", metricMatch=${metricMatch}`);
      return metricMatch; // Only return if metric field matches exactly
    });
    
    console.log('Found benchmark:', found);
    return found;
  };

  // Helper function to calculate performance level based on benchmark
  const getPerformanceLevel = (currentValue: number, benchmarkValue: number, metricType: 'higher-better' | 'lower-better' = 'higher-better'): 'excellent' | 'good' | 'fair' | 'poor' => {
    console.log(`getPerformanceLevel: current=${currentValue}, benchmark=${benchmarkValue}, type=${metricType}`);
    
    if (!benchmarkValue || benchmarkValue === 0) {
      console.log('No benchmark value, returning fair');
      return 'fair';
    }
    
    const ratio = currentValue / benchmarkValue;
    console.log(`Ratio: ${ratio} (${currentValue} / ${benchmarkValue})`);
    
    let result: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (metricType === 'higher-better') {
      // For metrics where higher is better (CTR, CVR, ER, ROI, ROAS)
      if (ratio >= 1.2) result = 'excellent';
      else if (ratio >= 1.0) result = 'good';
      else if (ratio >= 0.8) result = 'fair';
      else result = 'poor';
      console.log(`Higher-better logic: ratio ${ratio} >= 1.2? ${ratio >= 1.2}, >= 1.0? ${ratio >= 1.0}, >= 0.8? ${ratio >= 0.8} → ${result}`);
    } else {
      // For metrics where lower is better (CPC, CPM, CPA, CPL)
      if (ratio <= 0.8) result = 'excellent';
      else if (ratio <= 1.0) result = 'good';
      else if (ratio <= 1.2) result = 'fair';
      else result = 'poor';
      console.log(`Lower-better logic: ratio ${ratio} <= 0.8? ${ratio <= 0.8}, <= 1.0? ${ratio <= 1.0}, <= 1.2? ${ratio <= 1.2} → ${result}`);
    }
    
    return result;
  };

  // Helper function to render performance badge - DISABLED FOR SIMPLIFICATION
  const renderPerformanceBadge = (metricName: string, currentValue: number | undefined, metricType: 'higher-better' | 'lower-better' = 'higher-better') => {
    // Badges removed for platform simplification
    return null;
  };

  // Fetch import session data
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId],
    enabled: !!sessionId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0, // Always fetch fresh data to pick up conversion value changes
  });

  // Fetch ad performance data
  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId, 'ads'],
    enabled: !!sessionId,
  });

  // Extract unique campaigns from ads data
  const availableCampaigns = useMemo(() => {
    if (!adsData || !Array.isArray(adsData)) return [];
    
    const campaignMap = new Map();
    adsData.forEach((ad: any) => {
      if (ad.campaignName) {
        campaignMap.set(ad.campaignName, {
          name: ad.campaignName,
          linkedInCampaignName: ad.campaignName, // Store the LinkedIn campaign name
          id: campaignId  // Parent database campaign ID
        });
      }
    });
    
    return Array.from(campaignMap.values());
  }, [adsData, campaignId]);

  // Helper to get campaign name from ID
  const getCampaignName = (campaignId: string): string => {
    const campaign = availableCampaigns.find(c => c.id === campaignId);
    return campaign?.name || campaignId;
  };

  // Helper to get campaign-specific metrics from adsData
  const getCampaignSpecificMetrics = (linkedInCampaignName: string) => {
    if (!adsData || !Array.isArray(adsData)) return null;
    
    // Filter ads for this specific LinkedIn campaign
    const campaignAds = adsData.filter((ad: any) => ad.campaignName === linkedInCampaignName);
    if (campaignAds.length === 0) return null;
    
    // Aggregate metrics for this campaign
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
    
    return {
      ...totals,
      ctr,
      cpc,
      cpm,
      cvr,
      cpa,
      cpl,
      er
    };
  };

  // Fetch LinkedIn reports filtered by campaignId
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
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
        emailNotifications: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
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
        emailRecipients: ''
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
      targetValue: template.targetValue,
      currentValue: '',
      priority: 'high',
      status: 'active',
      category: '',
      timeframe: 'monthly',
      trackingPeriod: '30',
      emailNotifications: false,
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
    const kpiData = {
      // platformType is extracted from URL by backend, don't send it
      campaignId: campaignId, // Include campaignId for data isolation
      name: kpiForm.name,
      targetValue: kpiForm.targetValue,
      currentValue: kpiForm.currentValue || '0',
      unit: kpiForm.unit,
      description: kpiForm.description,
      priority: kpiForm.priority,
      timeframe: kpiForm.timeframe,
      trackingPeriod: parseInt(kpiForm.trackingPeriod),
      status: 'active',
      rollingAverage: '7day',
      alertsEnabled: true,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: 'daily'
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
      console.log('Creating benchmark with data:', benchmarkData);
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/benchmarks`, benchmarkData);
      return res.json();
    },
    onSuccess: async (createdBenchmark) => {
      console.log('Benchmark created successfully:', createdBenchmark);
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks`] });
      
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
        benchmarkType: 'industry',
        industry: '',
        description: '',
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
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
      console.log('Updating benchmark:', id, 'with data:', data);
      const res = await apiRequest('PATCH', `/api/campaigns/${campaignId}/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: async (updatedBenchmark) => {
      console.log('Benchmark updated successfully:', updatedBenchmark);
      console.log('Invalidating queries to refresh UI...');
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks`] });
      
      // Force immediate refetch for both Overview and Benchmarks tab
      await refetchBenchmarks();
      await refetchBenchmarksTab();
      
      console.log('Queries invalidated, UI should update now');
      
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
        description: '',
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
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
      console.log('Deleting benchmark:', benchmarkId);
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}/benchmarks/${benchmarkId}`);
      return res.json();
    },
    onSuccess: async () => {
      console.log('Benchmark deleted successfully');
      
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks`] });
      
      // Force immediate refetch for both Overview and Benchmarks tab
      await refetchBenchmarks();
      await refetchBenchmarksTab();
      
      // Clear editing state and reset form
      setEditingBenchmark(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        applyTo: 'all',
        specificCampaignId: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
      
      console.log('Benchmark queries refetched, badge should disappear now');
      
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

  // Handle create Benchmark
  const handleCreateBenchmark = () => {
    // For campaign-specific benchmarks, convert LinkedIn campaign name to database campaign ID
    let finalSpecificCampaignId = null;
    if (benchmarkForm.applyTo === 'specific') {
      // If a LinkedIn campaign name was selected, use the parent database campaign ID
      finalSpecificCampaignId = campaignId; // Always use the current database campaign ID
      console.log('[Create] Campaign-specific benchmark:', {
        selectedLinkedInCampaign: benchmarkForm.specificCampaignId,
        savingDatabaseCampaignId: finalSpecificCampaignId
      });
    }
    
    // Check for duplicate metric benchmark
    const existingBenchmarks = (benchmarksData as any[]) || [];
    const existingBenchmark = existingBenchmarks.find((b: any) => {
      const metricMatch = b.metric?.toLowerCase() === benchmarkForm.metric?.toLowerCase();
      const scopeMatch = benchmarkForm.applyTo === 'specific' 
        ? b.specificCampaignId === finalSpecificCampaignId
        : b.applyTo === 'all' || !b.specificCampaignId;
      
      console.log('Checking duplicate:', {
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
      unit: benchmarkForm.unit,
      benchmarkValue: benchmarkForm.benchmarkValue,
      currentValue: benchmarkForm.currentValue || '0',
      industry: benchmarkForm.industry,
      description: benchmarkForm.description,
      applyTo: benchmarkForm.applyTo, // 'all' or 'specific'
      specificCampaignId: finalSpecificCampaignId, // Use the converted campaign ID
      linkedInCampaignName: benchmarkForm.applyTo === 'specific' ? benchmarkForm.specificCampaignId : null, // Store LinkedIn campaign name for display
      alertsEnabled: benchmarkForm.alertsEnabled,
      alertThreshold: benchmarkForm.alertThreshold,
      alertCondition: benchmarkForm.alertCondition,
      emailRecipients: benchmarkForm.emailRecipients,
      status: 'active',
      platformType: 'linkedin' // Specify platform
    };
    
    console.log('Creating benchmark with data:', benchmarkData);
    
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: benchmarkData });
    } else {
      createBenchmarkMutation.mutate(benchmarkData);
    }
  };

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest('POST', '/api/linkedin/reports', reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Created",
        description: "Your LinkedIn report has been created successfully.",
      });
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
      const res = await apiRequest('DELETE', `/api/linkedin/reports/${reportId}`);
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

  // Update Report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, reportData }: { reportId: string, reportData: any }) => {
      const res = await apiRequest('PUT', `/api/linkedin/reports/${reportId}`, reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Updated",
        description: "Your report has been updated successfully.",
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
      setCustomReportConfig({
        coreMetrics: [],
        derivedMetrics: [],
        kpis: [],
        benchmarks: [],
        includeAdComparison: false
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
    
    // Check if scheduling is enabled
    const scheduleEnabled = report.scheduleFrequency !== null && report.scheduleFrequency !== undefined;
    
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
      scheduleDayOfWeek: config?.scheduleDayOfWeek || report.scheduleDayOfWeek || 'monday',
      scheduleTime: config?.scheduleTime || report.scheduleTime || '9:00 AM',
      emailRecipients: emailRecipientsString,
      status: report.status || 'draft'
    };
    setReportForm(formData);
    
    // Set custom report config if it's a custom report
    if (report.reportType === 'custom' && config?.customReportConfig) {
      setCustomReportConfig({
        coreMetrics: config.customReportConfig.coreMetrics || [],
        derivedMetrics: config.customReportConfig.derivedMetrics || [],
        kpis: config.customReportConfig.kpis || [],
        benchmarks: config.customReportConfig.benchmarks || [],
        includeAdComparison: config.customReportConfig.includeAdComparison || false
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
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: 'active'
      };
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
              scheduleTime: reportForm.scheduleTime
            }
          : {
              ...reportForm.configuration,
              scheduleEnabled: reportForm.scheduleEnabled,
              scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
              scheduleTime: reportForm.scheduleTime
            },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: reportForm.status || 'active'
      };
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
        generateOverviewPDF(doc);
        break;
      case 'kpis':
        generateKPIsPDF(doc);
        break;
      case 'benchmarks':
        generateBenchmarksPDF(doc);
        break;
      case 'ads':
        generateAdComparisonPDF(doc);
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
      scheduleFrequency: 'weekly',
      scheduleDayOfWeek: 'monday',
      scheduleTime: '9:00 AM',
      emailRecipients: '',
      status: 'draft'
    });

    toast({
      title: "Report Downloaded",
      description: "Your PDF report has been downloaded successfully.",
    });
  };

  // Handle custom report creation/download
  const handleCustomReport = () => {
    if (reportForm.scheduleEnabled) {
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
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: 'active'
      };
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
      scheduleTime: '9:00 AM',
      emailRecipients: '',
      status: 'draft'
    });
    setCustomReportConfig({
      coreMetrics: [],
      derivedMetrics: [],
      kpis: [],
      benchmarks: [],
      includeAdComparison: false
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

  // Generate Overview PDF
  const generateOverviewPDF = (doc: any) => {
    const { session, aggregated } = (sessionData as any) || {};
    
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    
    if (!aggregated || Object.keys(aggregated).length === 0) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text('No metrics data available', 20, y);
      return;
    }
    
    // Separate core and derived metrics
    const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'];
    const coreMetricsData: any[] = [];
    const derivedMetricsData: any[] = [];
    
    Object.entries(aggregated).forEach(([key, value]: [string, any]) => {
      const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
      const { label, format } = getMetricDisplay(metricKey, value);
      const formattedValue = format(value);
      
      if (derivedMetrics.includes(metricKey)) {
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
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate KPIs PDF
  const generateKPIsPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Key Performance Indicators', y, [156, 39, 176]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (kpisData && Array.isArray(kpisData) && kpisData.length > 0) {
      kpisData.forEach((kpi: any) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // KPI Box - increased height for progress bar
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 38, 3, 3, 'S');
        
        // Metric name
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(`Metric: ${kpi.metricName || kpi.name}`, 25, y + 2);
        
        // Current and Target values
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Current: ${kpi.currentValue || 'N/A'}`, 25, y + 10);
        doc.text(`Target: ${kpi.targetValue}`, 100, y + 10);
        
        // Progress bar
        const current = parseFloat(kpi.currentValue) || 0;
        const target = parseFloat(kpi.targetValue) || 100;
        const progress = Math.min((current / target) * 100, 100);
        
        // Progress bar background (gray)
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(25, y + 18, 160, 8, 2, 2, 'F');
        
        // Progress bar fill (green if >= 100%, blue otherwise)
        if (progress > 0) {
          const fillColor = progress >= 100 ? [52, 168, 83] : [66, 139, 202];
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          const barWidth = (160 * progress) / 100;
          doc.roundedRect(25, y + 18, barWidth, 8, 2, 2, 'F');
        }
        
        // Progress percentage text - white and bold for visibility
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`${progress.toFixed(1)}%`, 105, y + 23, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(50, 50, 50);
        
        y += 46;
      });
    } else {
      doc.text('No KPIs configured yet', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Benchmarks PDF
  const generateBenchmarksPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Performance Benchmarks', y, [255, 99, 132]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0) {
      benchmarksData.forEach((benchmark: any) => {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }
        
        // Benchmark Box - increased height for all content
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 60, 3, 3, 'S');
        
        // Benchmark title
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(benchmark.name, 25, y + 2);
        
        // Description
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(benchmark.description || 'No description provided', 25, y + 9);
        
        // Context line (industry • period • type)
        const contextParts = [
          benchmark.industry || benchmark.source || '',
          benchmark.period || '',
          benchmark.benchmarkType || ''
        ].filter(p => p).join(' • ');
        doc.text(contextParts, 25, y + 15);
        doc.setTextColor(50, 50, 50);
        
        // Values section
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Your Performance', 25, y + 23);
        doc.text('Benchmark Value', 85, y + 23);
        doc.text('Source', 145, y + 23);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        doc.text(`${benchmark.currentValue || '0'}${benchmark.unit || ''}`, 25, y + 31);
        doc.text(`${benchmark.benchmarkValue || '0'}${benchmark.unit || ''}`, 85, y + 31);
        doc.text(benchmark.source || 'LinkedIn', 145, y + 31);
        
        // Performance vs Benchmark
        if (benchmark.currentValue && benchmark.benchmarkValue) {
          const current = parseFloat(benchmark.currentValue);
          const benchmarkVal = parseFloat(benchmark.benchmarkValue);
          const diff = current - benchmarkVal;
          const percentDiff = benchmarkVal > 0 ? Math.abs((diff / benchmarkVal) * 100).toFixed(0) : '0';
          const status = current > benchmarkVal ? 'Above' : current < benchmarkVal ? 'Below' : 'At';
          const statusColor = current >= benchmarkVal ? [52, 168, 83] : [220, 38, 38]; // green or red
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.text('Performance vs Benchmark:', 25, y + 41);
          
          // Status badge
          doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
          doc.roundedRect(25, y + 44, 35, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text(`${percentDiff}% ${status}`, 42.5, y + 49, { align: 'center' });
          
          // Status text
          doc.setTextColor(100, 100, 100);
          doc.setFont(undefined, 'normal');
          const statusText = current >= benchmarkVal ? 'Exceeds benchmark' : 'Needs improvement';
          doc.text(statusText, 63, y + 49);
          doc.setTextColor(50, 50, 50);
        }
        
        y += 68;
      });
    } else {
      doc.text('No benchmarks configured yet', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Ad Comparison PDF
  const generateAdComparisonPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (adsData && Array.isArray(adsData) && adsData.length > 0) {
      adsData.forEach((ad: any, index: number) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 42, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(`Ad #${index + 1}: ${ad.adName || ad.name || 'Unnamed Ad'}`, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Impressions: ${ad.impressions || 0}`, 25, y + 12);
        doc.text(`Clicks: ${ad.clicks || 0}`, 100, y + 12);
        doc.text(`CTR: ${ad.ctr || 0}%`, 25, y + 20);
        doc.text(`Spend: $${ad.spend || 0}`, 100, y + 20);
        doc.text(`Conversions: ${ad.conversions || 0}`, 25, y + 28);
        
        y += 50;
      });
    } else {
      doc.text('No ad data available', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Custom PDF based on user selections
  const generateCustomPDF = (doc: any) => {
    const { session, aggregated } = (sessionData as any) || {};
    
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    
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
        revenue: 'Revenue',
        ctr: 'CTR',
        cpc: 'CPC',
        cpm: 'CPM',
        cvr: 'Conversion Rate',
        cpa: 'CPA',
        cpl: 'CPL',
        er: 'Engagement Rate',
        roi: 'ROI',
        roas: 'ROAS'
      };
      return labels[key] || key;
    };

    // Helper function to format metric value
    const formatMetricValue = (key: string, value: any): string => {
      if (!value && value !== 0) return 'N/A';
      
      const percentageMetrics = ['ctr', 'cvr', 'er', 'roi'];
      const currencyMetrics = ['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'revenue'];
      
      if (percentageMetrics.includes(key)) {
        return `${parseFloat(value).toFixed(2)}%`;
      } else if (currencyMetrics.includes(key)) {
        return `$${parseFloat(value).toFixed(2)}`;
      } else if (key === 'roas') {
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
          const value = aggregated?.[metric] || 0;
          const formattedValue = formatMetricValue(metric, value);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 5;
      }
      
      // Derived Metrics
      if (customReportConfig.derivedMetrics.length > 0) {
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
        
        customReportConfig.derivedMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = aggregated?.[metric] || 0;
          const formattedValue = formatMetricValue(metric, value);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 10;
      }
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
        doc.roundedRect(20, y - 5, 170, 35, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(kpi.name, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Metric: ${getMetricLabel(kpi.metric)}`, 25, y + 10);
        
        const currentValue = aggregated?.[kpi.metric] || 0;
        const targetValue = kpi.targetValue || 0;
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
        
        y += 45;
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
        
        const currentValue = aggregated?.[benchmark.metric] || 0;
        const benchmarkValue = benchmark.benchmarkValue || 0;
        
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

    // Ad Comparison Section
    if (customReportConfig.includeAdComparison && adsData && Array.isArray(adsData) && adsData.length > 0) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
      
      adsData.forEach((ad: any, index: number) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 42, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(`Ad #${index + 1}: ${ad.adName || ad.name || 'Unnamed Ad'}`, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Impressions: ${ad.impressions || 0}`, 25, y + 12);
        doc.text(`Clicks: ${ad.clicks || 0}`, 100, y + 12);
        doc.text(`CTR: ${ad.ctr || 0}%`, 25, y + 20);
        doc.text(`Spend: $${ad.spend || 0}`, 100, y + 20);
        doc.text(`Conversions: ${ad.conversions || 0}`, 25, y + 28);
        
        y += 50;
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
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch platform-level LinkedIn Benchmarks filtered by campaignId
  const { data: benchmarksData, isLoading: benchmarksLoading, refetch: refetchBenchmarksTab } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/benchmarks`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    cacheTime: 0, // Don't cache at all
  });

  // Debug logging for benchmarks - VERSION 2025-11-28-20:00
  console.log('[Benchmarks Tab V2] Campaign ID:', campaignId);
  console.log('[Benchmarks Tab V2] Benchmarks loading:', benchmarksLoading);
  console.log('[Benchmarks Tab V2] Benchmarks data:', benchmarksData);
  console.log('[Benchmarks Tab V2] Number of benchmarks:', Array.isArray(benchmarksData) ? benchmarksData.length : 'not an array');
  
  if (Array.isArray(benchmarksData) && benchmarksData.length > 0) {
    console.log('[Benchmarks Tab] Benchmark details:');
    benchmarksData.forEach((b: any, index: number) => {
      console.log(`  ${index + 1}. ${b.name}`);
      console.log(`     - ID: ${b.id}`);
      console.log(`     - Metric: ${b.metric}`);
      console.log(`     - Apply To: ${b.applyTo}`);
      console.log(`     - Specific Campaign ID: ${b.specificCampaignId}`);
    });
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return (isNaN(n) ? 0 : n).toLocaleString();
  };
  
  const formatCurrency = (num: number | string, currencyCode?: string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    const currency = currencyCode || campaignData?.currency || 'USD';
    
    // Currency configurations
    const currencyConfig: Record<string, { symbol: string; locale: string; decimals: number }> = {
      USD: { symbol: '$', locale: 'en-US', decimals: 2 },
      GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
      EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
      JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
      CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
      AUD: { symbol: 'A$', locale: 'en-AU', decimals: 2 },
      INR: { symbol: '₹', locale: 'en-IN', decimals: 2 },
    };
    
    const config = currencyConfig[currency] || currencyConfig['USD'];
    
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
      'impressions': { icon: Eye, format: formatNumber, label: 'Impressions' },
      'reach': { icon: Users, format: formatNumber, label: 'Reach' },
      'clicks': { icon: MousePointerClick, format: formatNumber, label: 'Clicks' },
      'ctr': { icon: TrendingUp, format: formatPercentage, label: 'Click-Through Rate (CTR)' },
      'engagements': { icon: Activity, format: formatNumber, label: 'Engagements' },
      'spend': { icon: DollarSign, format: formatCurrency, label: 'Spend' },
      'cpc': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Click (CPC)' },
      'cpm': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Mille (CPM)' },
      'conversions': { icon: Target, format: formatNumber, label: 'Conversions' },
      'leads': { icon: Users, format: formatNumber, label: 'Leads' },
      'videoviews': { icon: Play, format: formatNumber, label: 'Video Views' },
      'viralimpressions': { icon: Activity, format: formatNumber, label: 'Viral Impressions' },
      'cvr': { icon: Target, format: formatPercentage, label: 'Conversion Rate (CVR)' },
      'cpa': { icon: DollarSign, format: formatCurrency, label: 'Cost per Acquisition (CPA)' },
      'cpl': { icon: DollarSign, format: formatCurrency, label: 'Cost per Lead (CPL)' },
      'er': { icon: Activity, format: formatPercentage, label: 'Engagement Rate (ER)' },
      'roi': { icon: TrendingUp, format: formatPercentage, label: 'Return on Investment (ROI)' },
      'roas': { icon: TrendingUp, format: (v: number | string) => `${typeof v === 'number' ? v.toFixed(2) : v}x`, label: 'Return on Ad Spend (ROAS)' },
    };

    return metricConfig[metricKey] || { icon: BarChart3, format: formatNumber, label: metricKey };
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
  const { session, metrics, aggregated } = (sessionData as any) || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation(`/campaigns/${params?.id}`)}
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
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="ads" data-testid="tab-ads">Ad Comparison</TabsTrigger>
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
                ) : sessionData && aggregated ? (
                  <>
                    {/* Conversion Value Missing Notification */}
                    {!aggregated.hasRevenueTracking && (
                      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                              Revenue Tracking Not Enabled
                            </h3>
                            <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                              Add a conversion value to unlock revenue metrics including ROI, ROAS, Revenue, and Profit calculations for this campaign.
                            </p>
                            <button
                              onClick={() => setLocation('/campaigns')}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-md transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Campaign & Add Conversion Value
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

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
                                  {format(value)}
                                </p>
                                {/* Show badge for raw metrics if benchmark exists (global only) */}
                                {(() => {
                                  const benchmark = getBenchmarkForMetric(metricKey);
                                  if (benchmark && !benchmark.linkedInCampaignName) {
                                    // Determine if higher or lower is better for this metric
                                    const higherBetterMetrics = ['impressions', 'clicks', 'conversions', 'leads', 'engagements', 'reach'];
                                    const metricType = higherBetterMetrics.includes(metricKey) ? 'higher-better' : 'lower-better';
                                    return renderPerformanceBadge(metricKey, value, metricType);
                                  }
                                  return null;
                                })()}
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>

                    {/* Derived Metrics with Performance Indicators */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance Metrics</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* CTR */}
                        {aggregated.ctr !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CTR (Click-Through Rate)
                                </h3>
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(aggregated.ctr)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const ctrBenchmark = getBenchmarkForMetric('ctr');
                                if (ctrBenchmark && !ctrBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('ctr', aggregated.ctr, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPC */}
                        {aggregated.cpc !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPC (Cost Per Click)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(aggregated.cpc)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cpcBenchmark = getBenchmarkForMetric('cpc');
                                if (cpcBenchmark && !cpcBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpc', aggregated.cpc, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPM */}
                        {aggregated.cpm !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPM (Cost Per Mille)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(aggregated.cpm)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cpmBenchmark = getBenchmarkForMetric('cpm');
                                if (cpmBenchmark && !cpmBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpm', aggregated.cpm, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CVR */}
                        {aggregated.cvr !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CVR (Conversion Rate)
                                </h3>
                                <Target className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(aggregated.cvr)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns */}
                              {(() => {
                                const cvrBenchmark = getBenchmarkForMetric('cvr');
                                if (cvrBenchmark && !cvrBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cvr', aggregated.cvr, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPA */}
                        {aggregated.cpa !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPA (Cost Per Acquisition)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(aggregated.cpa)}
                              </p>
                              {/* Only show badge if benchmark is for ALL campaigns, not campaign-specific */}
                              {(() => {
                                const cpaBenchmark = getBenchmarkForMetric('cpa');
                                if (cpaBenchmark && !cpaBenchmark.linkedInCampaignName) {
                                  return renderPerformanceBadge('cpa', aggregated.cpa, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* CPL */}
                        {aggregated.cpl !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  CPL (Cost Per Lead)
                                </h3>
                                <DollarSign className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(aggregated.cpl)}
                              </p>
                              {renderPerformanceBadge('cpl', aggregated.cpl, 'lower-better')}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* ER */}
                        {aggregated.er !== undefined && (
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  ER (Engagement Rate)
                                </h3>
                                <Activity className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPercentage(aggregated.er)}
                              </p>
                              {renderPerformanceBadge('er', aggregated.er, 'higher-better')}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>

                    {/* Revenue Metrics - Only shown if conversion value is set */}
                    {aggregated.hasRevenueTracking === 1 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Analytics</h3>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            💰 Revenue Tracking Enabled
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Total Revenue */}
                          <Card className="hover:shadow-md transition-shadow border-green-200 dark:border-green-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  Total Revenue
                                </h3>
                                <DollarSign className="w-4 h-4 text-green-600" />
                              </div>
                              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                {formatCurrency(aggregated.totalRevenue || 0)}
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
                      </div>
                    )}

                    {/* Campaign Breakdown */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Campaign Breakdown</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Comprehensive metrics by individual campaigns
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
                              <SelectTrigger className="w-[140px] h-9">
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
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                          Campaign ID: {index + 1}
                                        </p>
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

                                  {/* Revenue Metrics - Only shown if conversion value is set */}
                                  {aggregated?.hasRevenueTracking === 1 && (() => {
                                    const campaignRevenue = conversions * (aggregated.conversionValue || 0);
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
                                              {campaignROAS.toFixed(2)}x
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

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6" data-testid="content-kpis">
                {kpisLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : kpisData && (kpisData as any[]).length > 0 ? (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and monitor your LinkedIn campaign KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: 'KPIs Report',
                              description: '',
                              reportType: 'kpis',
                              configuration: {},
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-slate-300 dark:border-slate-700"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    {/* KPI Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {(kpisData as any[]).length}
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
                              <p className="text-sm text-slate-600 dark:text-slate-400">Excellent</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  if (target === 0) return false;
                                  const ratio = current / target;
                                  const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(m => 
                                    k.metric?.toLowerCase().includes(m) || k.name?.toLowerCase().includes(m)
                                  );
                                  return lowerIsBetter ? ratio <= 0.8 : ratio >= 1.2;
                                }).length}
                              </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Good</p>
                              <p className="text-2xl font-bold text-blue-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  if (target === 0) return false;
                                  const ratio = current / target;
                                  const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(m => 
                                    k.metric?.toLowerCase().includes(m) || k.name?.toLowerCase().includes(m)
                                  );
                                  return lowerIsBetter 
                                    ? (ratio > 0.8 && ratio <= 1.0)
                                    : (ratio >= 1.0 && ratio < 1.2);
                                }).length}
                              </p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p>
                              <p className="text-2xl font-bold text-amber-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  if (target === 0) return false;
                                  const ratio = current / target;
                                  const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(m => 
                                    k.metric?.toLowerCase().includes(m) || k.name?.toLowerCase().includes(m)
                                  );
                                  // Fair or Poor combined
                                  return lowerIsBetter 
                                    ? ratio > 1.0
                                    : ratio < 1.0;
                                }).length}
                              </p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(kpisData as any[]).map((kpi: any) => (
                        <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                  {/* Metric Badge */}
                                  {kpi.metric && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                      {kpi.metric.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm">
                                  {kpi.description || 'No description provided'}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={kpi.status === 'active' ? 'default' : 'secondary'}>
                                  {kpi.status || 'active'}
                                </Badge>
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
                                    setKpiForm({
                                      name: kpi.name,
                                      description: kpi.description || '',
                                      metric: kpi.metric || '',
                                      targetValue: kpi.targetValue || '',
                                      currentValue: kpi.currentValue || '',
                                      unit: kpi.unit || '',
                                      priority: kpi.priority || 'medium',
                                      status: kpi.status || 'active',
                                      category: kpi.category || '',
                                      timeframe: kpi.timeframe || 'monthly',
                                      trackingPeriod: kpi.trackingPeriod?.toString() || '30',
                                      emailNotifications: kpi.emailNotifications || false,
                                      alertThreshold: kpi.alertThreshold || '',
                                      alertCondition: kpi.alertCondition || 'below',
                                      emailRecipients: kpi.emailRecipients || ''
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
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Current
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    const value = parseFloat(kpi.currentValue || '0');
                                    const formatted = value.toLocaleString('en-US', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    });
                                    return kpi.unit === '$' ? `$${formatted}` : `${formatted}${kpi.unit || ''}`;
                                  })()}
                                </div>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    const value = parseFloat(kpi.targetValue || '0');
                                    const formatted = value.toLocaleString('en-US', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    });
                                    return kpi.unit === '$' ? `$${formatted}` : `${formatted}${kpi.unit || ''}`;
                                  })()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Performance Assessment */}
                            {kpi.targetValue && kpi.currentValue && (() => {
                              const currentVal = parseFloat(kpi.currentValue);
                              const targetVal = parseFloat(kpi.targetValue);
                              const ratio = currentVal / targetVal;
                              
                              // Determine if this is a "lower is better" metric (cost metrics)
                              const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(m => 
                                kpi.metric?.toLowerCase().includes(m) || kpi.name?.toLowerCase().includes(m)
                              );
                              
                              // Calculate performance level using same logic as Benchmarks
                              let performanceLevel: 'excellent' | 'good' | 'fair' | 'poor';
                              let gapText = '';
                              
                              if (lowerIsBetter) {
                                // For cost metrics, lower is better
                                if (ratio <= 0.8) {
                                  performanceLevel = 'excellent';
                                  gapText = `${Math.round((1 - ratio) * 100)}% below target`;
                                } else if (ratio <= 1.0) {
                                  performanceLevel = 'good';
                                  gapText = `${Math.round((1 - ratio) * 100)}% below target`;
                                } else if (ratio <= 1.2) {
                                  performanceLevel = 'fair';
                                  gapText = `${Math.round((ratio - 1) * 100)}% above target`;
                                } else {
                                  performanceLevel = 'poor';
                                  gapText = `${Math.round((ratio - 1) * 100)}% above target`;
                                }
                              } else {
                                // For performance metrics, higher is better
                                if (ratio >= 1.2) {
                                  performanceLevel = 'excellent';
                                  gapText = `${Math.round((ratio - 1) * 100)}% above target`;
                                } else if (ratio >= 1.0) {
                                  performanceLevel = 'good';
                                  gapText = `${Math.round((ratio - 1) * 100)}% above target`;
                                } else if (ratio >= 0.8) {
                                  performanceLevel = 'fair';
                                  gapText = `${Math.round((1 - ratio) * 100)}% below target`;
                                } else {
                                  performanceLevel = 'poor';
                                  gapText = `${Math.round((1 - ratio) * 100)}% below target`;
                                }
                              }
                              
                              return (
                                <div className="space-y-3">
                                  {/* Performance Badge */}
                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant={
                                        performanceLevel === 'excellent' ? 'default' :
                                        performanceLevel === 'good' ? 'secondary' :
                                        performanceLevel === 'fair' ? 'outline' : 'destructive'
                                      }
                                      className={
                                        performanceLevel === 'excellent' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        performanceLevel === 'good' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        performanceLevel === 'fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      }
                                    >
                                      {performanceLevel === 'excellent' && '🟢 Excellent'}
                                      {performanceLevel === 'good' && '🔵 Good'}
                                      {performanceLevel === 'fair' && '🟡 Fair'}
                                      {performanceLevel === 'poor' && '🔴 Poor'}
                                    </Badge>
                                    <span className="text-xs text-slate-500 dark:text-slate-500">
                                      {gapText}
                                    </span>
                                  </div>

                                  {/* Timeframe Indicator */}
                                  <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="capitalize">
                                      {kpi.timeframe || 'Monthly'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and monitor your LinkedIn campaign KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: 'KPIs Report',
                              description: '',
                              reportType: 'kpis',
                              configuration: {},
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-slate-300 dark:border-slate-700"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-purple-600" />
                          LinkedIn Campaign KPIs
                        </CardTitle>
                        <CardDescription>
                          Track key performance indicators for your LinkedIn campaigns
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-12">
                          <p className="text-slate-600 dark:text-slate-400 mb-4">
                            No KPIs have been created yet.
                          </p>
                          <Button 
                            onClick={() => setIsKPIModalOpen(true)}
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
                        industry: '',
                        description: '',
                        applyTo: 'all',
                        specificCampaignId: '',
                        alertsEnabled: false,
                        alertThreshold: '',
                        alertCondition: 'below',
                        emailRecipients: ''
                      });
                      setIsBenchmarkModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-create-benchmark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Benchmark
                  </Button>
                </div>

                {/* DEBUG: Force show condition check */}
                {console.log('[RENDER CHECK] benchmarksLoading:', benchmarksLoading)}
                {console.log('[RENDER CHECK] benchmarksData:', benchmarksData)}
                {console.log('[RENDER CHECK] Is Array:', Array.isArray(benchmarksData))}
                {console.log('[RENDER CHECK] Length:', Array.isArray(benchmarksData) ? benchmarksData.length : 'N/A')}
                {console.log('[RENDER CHECK] Condition result:', benchmarksData && Array.isArray(benchmarksData) && (benchmarksData as any[]).length > 0)}
                
                {benchmarksLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : benchmarksData && Array.isArray(benchmarksData) && (benchmarksData as any[]).length > 0 ? (
                  <>
                    {/* Benchmark Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {(benchmarksData as any[]).length}
                              </p>
                            </div>
                            <Award className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Active</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(benchmarksData as any[]).filter((b: any) => b.status === 'active').length}
                              </p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Industries</p>
                              <p className="text-2xl font-bold text-blue-600">
                                {new Set((benchmarksData as any[]).map((b: any) => b.industry)).size}
                              </p>
                            </div>
                            <Trophy className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Benchmark Cards */}
                    <div className="space-y-4">
                      {console.log('[MAPPING] About to map benchmarks:', benchmarksData.length)}
                      {(benchmarksData as any[]).map((benchmark: any, index: number) => {
                        console.log(`[MAPPING] Rendering benchmark ${index + 1}:`, benchmark.name);
                        try {
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
                                  {benchmark.description || 'No description provided'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  {benchmark.industry && <span>{benchmark.industry}</span>}
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
                              <div className="flex items-center gap-2">
                                <Badge variant={benchmark.status === 'active' ? 'default' : 'secondary'}>
                                  {benchmark.status === 'active' ? 'Active' : 'Inactive'}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingBenchmark(benchmark);
                                    setBenchmarkForm({
                                      metric: benchmark.metric || '',
                                      name: benchmark.name || '',
                                      unit: benchmark.unit || '',
                                      benchmarkValue: benchmark.benchmarkValue || '',
                                      currentValue: benchmark.currentValue || '',
                                      industry: benchmark.industry || '',
                                      description: benchmark.description || '',
                                      applyTo: benchmark.applyTo || 'all',
                                      specificCampaignId: benchmark.specificCampaignId || '',
                                      alertsEnabled: benchmark.alertsEnabled || false,
                                      alertThreshold: benchmark.alertThreshold || '',
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
                                  Your Performance
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {(() => {
                                    // If campaign-specific, show the campaign-specific metric value
                                    if (benchmark.linkedInCampaignName && benchmark.specificCampaignId) {
                                      const campaignMetrics = getCampaignSpecificMetrics(benchmark.linkedInCampaignName);
                                      if (campaignMetrics && campaignMetrics[benchmark.metric] !== undefined) {
                                        const value = campaignMetrics[benchmark.metric];
                                        return `${typeof value === 'number' ? value.toFixed(2) : value}${benchmark.unit || ''}`;
                                      }
                                    }
                                    // Otherwise use stored currentValue
                                    return `${benchmark.currentValue || '0'}${benchmark.unit || ''}`;
                                  })()}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Benchmark Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.benchmarkValue || benchmark.targetValue || '0'}{benchmark.unit || ''}
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
                            
                            {/* Performance Comparison */}
                            {benchmark.currentValue && benchmark.benchmarkValue && (
                              <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Performance vs Benchmark:
                                  </span>
                                  {(() => {
                                    // Use campaign-specific value if applicable
                                    let currentVal = parseFloat(benchmark.currentValue);
                                    if (benchmark.linkedInCampaignName && benchmark.specificCampaignId) {
                                      const campaignMetrics = getCampaignSpecificMetrics(benchmark.linkedInCampaignName);
                                      if (campaignMetrics && campaignMetrics[benchmark.metric] !== undefined) {
                                        currentVal = campaignMetrics[benchmark.metric];
                                        console.log(`[Performance Comparison] Using campaign-specific ${benchmark.metric}: ${currentVal}`);
                                      }
                                    }
                                    
                                    const current = currentVal;
                                    const benchmarkVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue);
                                    const diff = current - benchmarkVal;
                                    const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100).toFixed(1) : '0';
                                    const isAbove = current > benchmarkVal;
                                    
                                    // Determine if metric is "lower is better" (cost metrics)
                                    const metricLower = benchmark.metric?.toLowerCase() || '';
                                    const isLowerBetter = ['cpc', 'cpm', 'cpa', 'cpl'].includes(metricLower) || 
                                                         benchmark.category === 'cost' ||
                                                         benchmark.unit === '$';
                                    
                                    // For lower-better metrics, flip the logic
                                    const isGoodPerformance = isLowerBetter ? !isAbove : isAbove;
                                    
                                    return (
                                      <>
                                        <Badge 
                                          variant={isGoodPerformance ? "default" : "secondary"}
                                          className={isGoodPerformance ? "bg-green-600" : "bg-red-600"}
                                        >
                                          {isAbove ? (
                                            <>
                                              <TrendingUp className="w-3 h-3 mr-1" />
                                              {percentDiff}% Above
                                            </>
                                          ) : (
                                            <>
                                              <TrendingDown className="w-3 h-3 mr-1" />
                                              {Math.abs(parseFloat(percentDiff))}% Below
                                            </>
                                          )}
                                        </Badge>
                                        <span className="text-xs text-slate-500">
                                          {isGoodPerformance ? '🎉 Outperforming!' : '⚠️ Needs improvement'}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
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
                    {console.log('[ELSE BLOCK] Showing empty state')}
                    {console.log('[ELSE BLOCK] benchmarksData:', benchmarksData)}
                    {console.log('[ELSE BLOCK] benchmarksLoading:', benchmarksLoading)}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="w-5 h-5" />
                          LinkedIn Benchmarks
                        </CardTitle>
                        <CardDescription>
                          Compare your performance against industry benchmarks
                        </CardDescription>
                      </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          No benchmarks have been created for this campaign yet.
                        </p>
                        <Button 
                          onClick={() => {
                            setEditingBenchmark(null);
                            setBenchmarkForm({
                              metric: '',
                              name: '',
                              unit: '',
                              benchmarkValue: '',
                              currentValue: '',
                              industry: '',
                              description: '',
                              applyTo: 'all',
                              specificCampaignId: '',
                              alertsEnabled: false,
                              alertThreshold: '',
                              alertCondition: 'below',
                              emailRecipients: ''
                            });
                            setIsBenchmarkModalOpen(true);
                          }}
                          data-testid="button-create-benchmark"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                ) : adsData && (adsData as any[]).length > 0 ? (
                  (() => {
                    const sortedAds = [...(adsData as any[])].sort((a, b) => parseFloat(b.revenue || '0') - parseFloat(a.revenue || '0'));
                    const topAd = sortedAds[0];
                    
                    // Get selected metrics from session to ensure consistency with Overview tab
                    const selectedMetricKeys = session?.selectedMetricKeys || [];
                    
                    // Map of all possible metrics with their display properties
                    const allMetricsMap: Record<string, { key: string, label: string, format: (v: any) => string }> = {
                      impressions: { key: 'impressions', label: 'Impressions', format: formatNumber },
                      clicks: { key: 'clicks', label: 'Clicks', format: formatNumber },
                      spend: { key: 'spend', label: 'Spend', format: formatCurrency },
                      ctr: { key: 'ctr', label: 'CTR', format: formatPercentage },
                      cpc: { key: 'cpc', label: 'CPC', format: formatCurrency },
                      cpm: { key: 'cpm', label: 'CPM', format: formatCurrency },
                      conversions: { key: 'conversions', label: 'Conversions', format: formatNumber },
                      revenue: { key: 'revenue', label: 'Revenue', format: formatCurrency },
                      leads: { key: 'leads', label: 'Leads', format: formatNumber },
                      engagements: { key: 'engagements', label: 'Engagements', format: formatNumber },
                      reach: { key: 'reach', label: 'Reach', format: formatNumber },
                      videoViews: { key: 'videoViews', label: 'Video Views', format: formatNumber },
                      viralImpressions: { key: 'viralImpressions', label: 'Viral Impressions', format: formatNumber }
                    };
                    
                    // Filter available metrics based on what was actually selected during import
                    // Include both core metrics and their derived versions (e.g., if 'clicks' is selected, also show 'ctr', 'cpc')
                    type MetricInfo = { key: string, label: string, format: (v: any) => string };
                    const availableMetrics = selectedMetricKeys
                      .map((key: string) => {
                        // Add the core metric if it exists in the map
                        const metrics: MetricInfo[] = [];
                        if (allMetricsMap[key]) {
                          metrics.push(allMetricsMap[key]);
                        }
                        
                        // Add derived metrics based on selected core metrics
                        if (key === 'impressions' && allMetricsMap.cpm && selectedMetricKeys.includes('spend')) {
                          metrics.push(allMetricsMap.cpm);
                        }
                        if (key === 'clicks' && selectedMetricKeys.includes('impressions') && allMetricsMap.ctr) {
                          metrics.push(allMetricsMap.ctr);
                        }
                        if (key === 'clicks' && selectedMetricKeys.includes('spend') && allMetricsMap.cpc) {
                          metrics.push(allMetricsMap.cpc);
                        }
                        
                        return metrics;
                      })
                      .flat()
                      .filter((metric: MetricInfo, index: number, self: MetricInfo[]) => 
                        // Remove duplicates
                        index === self.findIndex((m: MetricInfo) => m.key === metric.key)
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
                    const currentMetric = availableMetrics.find((m: MetricInfo) => m.key === selectedMetric) || availableMetrics[0];
                    
                    // If no metrics are available, show a message
                    if (!currentMetric || availableMetrics.length === 0) {
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

                    return (
                      <div className="space-y-6">
                        {/* Top Performer Banner */}
                        <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white" data-testid="top-performer-banner">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Trophy className="w-8 h-8" />
                                <div>
                                  <p className="text-sm opacity-90">Top Revenue Driver</p>
                                  <p className="text-xl font-bold">{topAd.adName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold">{formatCurrency(parseFloat(topAd.revenue || '0'))}</p>
                                <p className="text-sm opacity-90">in revenue</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

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
                                  {availableMetrics.map((metric: MetricInfo) => (
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
                                const revenue = parseFloat(ad.revenue || '0');
                                const isTop = index === 0;
                                const isBottom = index === sortedAds.length - 1 && sortedAds.length > 2;

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
                                        </div>
                                        <p className="text-sm text-slate-500">{ad.campaignName}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-slate-500">Revenue</p>
                                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(revenue)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Quick Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card data-testid="total-revenue-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(sortedAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0))}
                              </p>
                            </CardContent>
                          </Card>
                          <Card data-testid="avg-revenue-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Average Revenue/Ad</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(sortedAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0) / sortedAds.length)}
                              </p>
                            </CardContent>
                          </Card>
                          <Card data-testid="total-ads-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Total Ads Compared</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">{sortedAds.length}</p>
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
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reports</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Create, schedule, and manage analytics reports
                    </p>
                  </div>
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
                        benchmarks: [],
                        includeAdComparison: false
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
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {reportsData.map((report: any) => (
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
                                {report.scheduleFrequency && (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {report.scheduleFrequency}
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  Created {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
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
                    <CardHeader>
                      <CardTitle>Report Library</CardTitle>
                      <CardDescription>
                        View and manage your saved reports
                      </CardDescription>
                    </CardHeader>
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

      {/* Create LinkedIn KPI Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          setModalStep('configuration');
          setSelectedTemplate(null);
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
            emailRecipients: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
            <DialogDescription>
              {editingKPI 
                ? 'Update the KPI details below. The current value can be auto-populated from your LinkedIn metrics data.'
                : 'Define a new KPI for your LinkedIn campaign. You can select metrics from the selected campaign as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Conversion Value Required Alert */}
            {!aggregated?.hasRevenueTracking && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Revenue Metrics Unavailable
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                      To create KPIs for ROI, ROAS, Total Revenue, Profit, Profit Margin, or Revenue Per Lead, you need to add a conversion value to your campaign first.
                    </p>
                    <button
                      onClick={() => {
                        setIsKPIModalOpen(false);
                        setLocation('/campaigns');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Campaign & Add Conversion Value
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
                  value={kpiForm.metric || ''}
                  onValueChange={(value) => {
                    // Check if revenue metric is selected but conversion value is not set
                    const revenueMetrics = ['roi', 'roas', 'totalRevenue', 'profit', 'profitMargin', 'revenuePerLead'];
                    if (revenueMetrics.includes(value) && !aggregated?.hasRevenueTracking) {
                      toast({
                        title: "Conversion Value Required",
                        description: "Revenue metrics require a conversion value. Please edit your campaign and add a conversion value to track ROI, ROAS, Revenue, and Profit.",
                        variant: "destructive",
                      });
                      return; // Don't select this metric
                    }
                    
                    // Auto-populate current value from LinkedIn aggregated metrics
                    let currentValue = '';
                    let unit = '';
                    if (aggregated) {
                      switch(value) {
                        case 'impressions':
                          currentValue = String(aggregated.totalImpressions || 0);
                          break;
                        case 'reach':
                          currentValue = String(aggregated.totalReach || 0);
                          break;
                        case 'clicks':
                          currentValue = String(aggregated.totalClicks || 0);
                          break;
                        case 'engagements':
                          currentValue = String(aggregated.totalEngagements || 0);
                          break;
                        case 'spend':
                          currentValue = String(aggregated.totalSpend || 0);
                          unit = '$';
                          break;
                        case 'conversions':
                          currentValue = String(aggregated.totalConversions || 0);
                          break;
                        case 'leads':
                          currentValue = String(aggregated.totalLeads || 0);
                          break;
                        case 'videoViews':
                          currentValue = String(aggregated.totalVideoViews || 0);
                          break;
                        case 'viralImpressions':
                          currentValue = String(aggregated.totalViralImpressions || 0);
                          break;
                        case 'ctr':
                          currentValue = String(aggregated.ctr || 0);
                          unit = '%';
                          break;
                        case 'cpc':
                          currentValue = String(aggregated.cpc || 0);
                          unit = '$';
                          break;
                        case 'cpm':
                          currentValue = String(aggregated.cpm || 0);
                          unit = '$';
                          break;
                        case 'cvr':
                          currentValue = String(aggregated.cvr || 0);
                          unit = '%';
                          break;
                        case 'cpa':
                          currentValue = String(aggregated.cpa || 0);
                          unit = '$';
                          break;
                        case 'cpl':
                          currentValue = String(aggregated.cpl || 0);
                          unit = '$';
                          break;
                        case 'er':
                          currentValue = String(aggregated.er || 0);
                          unit = '%';
                          break;
                        case 'roi':
                          currentValue = String(aggregated.roi || 0);
                          unit = '%';
                          break;
                        case 'roas':
                          currentValue = String(aggregated.roas || 0);
                          unit = 'x';
                          break;
                        case 'totalRevenue':
                          currentValue = String(aggregated.totalRevenue || 0);
                          unit = '$';
                          break;
                        case 'profit':
                          currentValue = String(aggregated.profit || 0);
                          unit = '$';
                          break;
                        case 'profitMargin':
                          currentValue = String(aggregated.profitMargin || 0);
                          unit = '%';
                          break;
                        case 'revenuePerLead':
                          currentValue = String(aggregated.revenuePerLead || 0);
                          unit = '$';
                          break;
                      }
                    }
                    setKpiForm({ ...kpiForm, metric: value, currentValue, unit });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                    <SelectValue placeholder="Select metric to track" />
                  </SelectTrigger>
                  <SelectContent>
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
                      Return on Investment (ROI) {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="roas" disabled={!aggregated?.hasRevenueTracking}>
                      Return on Ad Spend (ROAS) {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="totalRevenue" disabled={!aggregated?.hasRevenueTracking}>
                      Total Revenue {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="profit" disabled={!aggregated?.hasRevenueTracking}>
                      Profit {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="profitMargin" disabled={!aggregated?.hasRevenueTracking}>
                      Profit Margin {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="revenuePerLead" disabled={!aggregated?.hasRevenueTracking}>
                      Revenue Per Lead {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
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
                  value={kpiForm.currentValue ? parseFloat(kpiForm.currentValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
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
                  value={kpiForm.targetValue ? parseFloat(kpiForm.targetValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
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

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="kpi-timeframe">Timeframe</Label>
                <Select
                  value={kpiForm.timeframe}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, timeframe: value })}
                >
                  <SelectTrigger id="kpi-timeframe" data-testid="select-kpi-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (24 hours)</SelectItem>
                    <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                    <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                    <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  How often to measure progress toward your target
                </p>
              </div>
            </div>

            {/* Alert Settings Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpi-alerts-enabled"
                  checked={kpiForm.emailNotifications}
                  onCheckedChange={(checked) => setKpiForm({ ...kpiForm, emailNotifications: checked as boolean })}
                  data-testid="checkbox-kpi-alerts"
                />
                <Label htmlFor="kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.emailNotifications && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="kpi-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="kpi-alert-threshold"
                        type="text"
                        placeholder="e.g., 80"
                        value={kpiForm.alertThreshold}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setKpiForm({ ...kpiForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-kpi-alert-threshold"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
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

                  <div className="space-y-2">
                    <Label htmlFor="kpi-email-recipients">Email Recipients *</Label>
                    <Input
                      id="kpi-email-recipients"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={kpiForm.emailRecipients}
                      onChange={(e) => setKpiForm({ ...kpiForm, emailRecipients: e.target.value })}
                      data-testid="input-kpi-email-recipients"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comma-separated email addresses for alert notifications
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsKPIModalOpen(false)}
                data-testid="button-cancel-kpi"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateKPI}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-create-kpi"
              >
                {editingKPI ? 'Update KPI' : 'Create KPI'}
              </Button>
            </DialogFooter>
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
                ? 'Update the benchmark details below. The current value can be auto-populated from your LinkedIn metrics data.'
                : 'Define a new benchmark for your LinkedIn campaigns. You can select metrics from the Overview tab as current values.'}
            </DialogDescription>
          </DialogHeader>
          {!sessionData ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">Loading...</p>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name *</Label>
              <Input
                id="benchmark-name"
                placeholder="e.g., LinkedIn CTR Benchmark"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                data-testid="input-benchmark-name"
              />
            </div>

            {/* Conversion Value Required Alert */}
            {!aggregated?.hasRevenueTracking && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Revenue Metrics Unavailable
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                      To create benchmarks for ROI, ROAS, Total Revenue, Profit, Profit Margin, or Revenue Per Lead, you need to add a conversion value to your campaign first.
                    </p>
                    <button
                      onClick={() => {
                        setIsBenchmarkModalOpen(false);
                        setLocation('/campaigns');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Campaign & Add Conversion Value
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Metric Source</Label>
                <Select
                  value={benchmarkForm.metric || undefined}
                  onValueChange={(value) => {
                    // Check if revenue metric is selected but conversion value is not set
                    const revenueMetrics = ['roi', 'roas', 'totalRevenue', 'profit', 'profitMargin', 'revenuePerLead'];
                    if (revenueMetrics.includes(value) && !aggregated?.hasRevenueTracking) {
                      toast({
                        title: "Conversion Value Required",
                        description: "Revenue metrics require a conversion value. Please edit your campaign and add a conversion value to track ROI, ROAS, Revenue, and Profit.",
                        variant: "destructive",
                      });
                      return; // Don't select this metric
                    }
                    
                    // Determine which metrics to use based on scope
                    let metricsSource = aggregated;
                    
                    // If campaign-specific is selected and a LinkedIn campaign is chosen, use campaign-specific metrics
                    if (benchmarkForm.applyTo === 'specific' && benchmarkForm.specificCampaignId) {
                      const campaignMetrics = getCampaignSpecificMetrics(benchmarkForm.specificCampaignId);
                      if (campaignMetrics) {
                        metricsSource = campaignMetrics;
                        console.log('[Metric Selection] Using campaign-specific metrics for:', benchmarkForm.specificCampaignId);
                      }
                    }
                    
                    // Auto-populate current value from metrics
                    let currentValue = '';
                    let unit = '';
                    if (metricsSource) {
                      switch(value) {
                        case 'impressions':
                          currentValue = String(metricsSource.impressions || metricsSource.totalImpressions || 0);
                          break;
                        case 'reach':
                          currentValue = String(metricsSource.reach || metricsSource.totalReach || 0);
                          break;
                        case 'clicks':
                          currentValue = String(metricsSource.clicks || metricsSource.totalClicks || 0);
                          break;
                        case 'engagements':
                          currentValue = String(metricsSource.engagements || metricsSource.totalEngagements || 0);
                          break;
                        case 'spend':
                          currentValue = String(metricsSource.spend || metricsSource.totalSpend || 0);
                          unit = '$';
                          break;
                        case 'conversions':
                          currentValue = String(metricsSource.conversions || metricsSource.totalConversions || 0);
                          break;
                        case 'leads':
                          currentValue = String(metricsSource.leads || metricsSource.totalLeads || 0);
                          break;
                        case 'videoViews':
                          currentValue = String(metricsSource.videoViews || metricsSource.totalVideoViews || 0);
                          break;
                        case 'viralImpressions':
                          currentValue = String(metricsSource.viralImpressions || metricsSource.totalViralImpressions || 0);
                          break;
                        case 'ctr':
                          currentValue = String(metricsSource.ctr || 0);
                          unit = '%';
                          break;
                        case 'cpc':
                          currentValue = String(metricsSource.cpc || 0);
                          unit = '$';
                          break;
                        case 'cpm':
                          currentValue = String(metricsSource.cpm || 0);
                          unit = '$';
                          break;
                        case 'cvr':
                          currentValue = String(metricsSource.cvr || 0);
                          unit = '%';
                          break;
                        case 'cpa':
                          currentValue = String(metricsSource.cpa || 0);
                          unit = '$';
                          break;
                        case 'cpl':
                          currentValue = String(metricsSource.cpl || 0);
                          unit = '$';
                          break;
                        case 'er':
                          currentValue = String(metricsSource.er || 0);
                          unit = '%';
                          break;
                        case 'roi':
                          currentValue = String(metricsSource.roi || 0);
                          unit = '%';
                          break;
                        case 'roas':
                          currentValue = String(metricsSource.roas || 0);
                          unit = 'x';
                          break;
                        case 'totalRevenue':
                          currentValue = String(metricsSource.totalRevenue || 0);
                          unit = '$';
                          break;
                        case 'profit':
                          currentValue = String(metricsSource.profit || 0);
                          unit = '$';
                          break;
                        case 'profitMargin':
                          currentValue = String(metricsSource.profitMargin || 0);
                          unit = '%';
                          break;
                        case 'revenuePerLead':
                          currentValue = String(metricsSource.revenuePerLead || 0);
                          unit = '$';
                          break;
                      }
                    }
                    console.log('[Metric Selection] Auto-filled currentValue:', currentValue, unit);
                    
                    // Update form with metric, currentValue, and unit
                    const updatedForm = { ...benchmarkForm, metric: value, currentValue, unit };
                    setBenchmarkForm(updatedForm);
                    
                    // If industry is already selected, also auto-fill benchmark value
                    if (benchmarkForm.industry && benchmarkForm.industry !== 'none' && benchmarkForm.industry !== 'other') {
                      console.log('[Metric Selection] Industry already selected, fetching benchmark value...');
                      (async () => {
                        try {
                          const response = await fetch(`/api/industry-benchmarks/${benchmarkForm.industry}/${value}`);
                          if (response.ok) {
                            const data = await response.json();
                            console.log('[Metric Selection] Benchmark data from API:', data);
                            setBenchmarkForm(prev => ({
                              ...prev,
                              benchmarkValue: String(data.value),
                              unit: data.unit || prev.unit
                            }));
                          } else {
                            // Fallback to hardcoded values
                            const fallbackData = getBenchmarkValueFallback(benchmarkForm.industry, value);
                            if (fallbackData) {
                              console.log('[Metric Selection] Using fallback benchmark data:', fallbackData);
                              setBenchmarkForm(prev => ({
                                ...prev,
                                benchmarkValue: String(fallbackData.value),
                                unit: fallbackData.unit || prev.unit
                              }));
                            }
                          }
                        } catch (error) {
                          console.error('[Metric Selection] Failed to fetch benchmark value:', error);
                          const fallbackData = getBenchmarkValueFallback(benchmarkForm.industry, value);
                          if (fallbackData) {
                            console.log('[Metric Selection] Using fallback benchmark data after error:', fallbackData);
                            setBenchmarkForm(prev => ({
                              ...prev,
                              benchmarkValue: String(fallbackData.value),
                              unit: fallbackData.unit || prev.unit
                            }));
                          }
                        }
                      })();
                    }
                  }}
                >
                  <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                    <SelectValue placeholder="Select metric to benchmark" />
                  </SelectTrigger>
                  <SelectContent>
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
                      Return on Investment (ROI) {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="roas" disabled={!aggregated?.hasRevenueTracking}>
                      Return on Ad Spend (ROAS) {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="totalRevenue" disabled={!aggregated?.hasRevenueTracking}>
                      Total Revenue {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="profit" disabled={!aggregated?.hasRevenueTracking}>
                      Profit {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="profitMargin" disabled={!aggregated?.hasRevenueTracking}>
                      Profit Margin {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                    <SelectItem value="revenuePerLead" disabled={!aggregated?.hasRevenueTracking}>
                      Revenue Per Lead {!aggregated?.hasRevenueTracking && '(Requires Conversion Value)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            {/* Apply To Section */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-2">
                <Label htmlFor="benchmark-apply-to" className="text-base font-semibold">
                  Apply Benchmark To
                </Label>
                <Select
                  value={benchmarkForm.applyTo}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, applyTo: value, specificCampaignId: value === 'all' ? '' : benchmarkForm.specificCampaignId })}
                >
                  <SelectTrigger id="benchmark-apply-to" data-testid="select-benchmark-apply-to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns (Aggregate)</SelectItem>
                    <SelectItem value="specific">Specific Campaign</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Choose whether this benchmark applies to all campaigns combined or a specific individual campaign
                </p>
              </div>

              {/* Campaign Selector - Only show if 'specific' is selected */}
              {benchmarkForm.applyTo === 'specific' && (
                <div className="space-y-2">
                  <Label htmlFor="benchmark-campaign">Select Campaign *</Label>
                  <Select
                    value={benchmarkForm.specificCampaignId}
                    onValueChange={(value) => {
                      console.log('[Dropdown] Selected campaign:', value);
                      
                      // Update the form with the selected campaign
                      const updatedForm = { ...benchmarkForm, specificCampaignId: value };
                      
                      // If a metric is already selected, recalculate currentValue for this campaign
                      if (benchmarkForm.metric && value) {
                        const campaignMetrics = getCampaignSpecificMetrics(value);
                        if (campaignMetrics) {
                          let currentValue = '';
                          const metric = benchmarkForm.metric;
                          
                          switch(metric) {
                            case 'impressions': currentValue = String(campaignMetrics.impressions || 0); break;
                            case 'reach': currentValue = String(campaignMetrics.reach || 0); break;
                            case 'clicks': currentValue = String(campaignMetrics.clicks || 0); break;
                            case 'engagements': currentValue = String(campaignMetrics.engagements || 0); break;
                            case 'spend': currentValue = String(campaignMetrics.spend || 0); break;
                            case 'conversions': currentValue = String(campaignMetrics.conversions || 0); break;
                            case 'leads': currentValue = String(campaignMetrics.leads || 0); break;
                            case 'videoViews': currentValue = String(campaignMetrics.videoViews || 0); break;
                            case 'viralImpressions': currentValue = String(campaignMetrics.viralImpressions || 0); break;
                            case 'ctr': currentValue = String(campaignMetrics.ctr || 0); break;
                            case 'cpc': currentValue = String(campaignMetrics.cpc || 0); break;
                            case 'cpm': currentValue = String(campaignMetrics.cpm || 0); break;
                            case 'cvr': currentValue = String(campaignMetrics.cvr || 0); break;
                            case 'cpa': currentValue = String(campaignMetrics.cpa || 0); break;
                            case 'cpl': currentValue = String(campaignMetrics.cpl || 0); break;
                            case 'er': currentValue = String(campaignMetrics.er || 0); break;
                          }
                          
                          if (currentValue) {
                            updatedForm.currentValue = currentValue;
                            console.log('[Campaign Selection] Updated currentValue to:', currentValue);
                          }
                        }
                      }
                      
                      setBenchmarkForm(updatedForm);
                    }}
                  >
                    <SelectTrigger id="benchmark-campaign" data-testid="select-benchmark-campaign">
                      <SelectValue placeholder="Choose a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCampaigns.length > 0 ? (
                        availableCampaigns.map((campaign) => (
                          <SelectItem key={campaign.name} value={campaign.linkedInCampaignName || campaign.name}>
                            {campaign.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-campaigns" disabled>
                          No campaigns available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Select the specific LinkedIn campaign this benchmark applies to
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-current">Current Value</Label>
                <Input
                  id="benchmark-current"
                  type="text"
                  placeholder="0"
                  value={benchmarkForm.currentValue ? parseFloat(benchmarkForm.currentValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setBenchmarkForm({ ...benchmarkForm, currentValue: value });
                    }
                  }}
                  data-testid="input-benchmark-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  type="text"
                  placeholder="0"
                  value={benchmarkForm.benchmarkValue ? parseFloat(benchmarkForm.benchmarkValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
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

            <div className="space-y-2">
              <Label htmlFor="benchmark-type">Benchmark Type</Label>
              <Select
                value={benchmarkForm.benchmarkType || 'industry'}
                onValueChange={(value) => {
                  setBenchmarkForm({ 
                    ...benchmarkForm, 
                    benchmarkType: value,
                    // Clear industry and benchmark value when switching types
                    industry: value === 'custom' ? '' : benchmarkForm.industry,
                    benchmarkValue: value === 'custom' ? '' : benchmarkForm.benchmarkValue
                  });
                }}
              >
                <SelectTrigger id="benchmark-type" data-testid="select-benchmark-type">
                  <SelectValue placeholder="Select benchmark type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="industry">Industry Standard</SelectItem>
                  <SelectItem value="custom">Custom Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Industry Selection - Only shown when "Industry Standard" is selected */}
            {benchmarkForm.benchmarkType === 'industry' && (
              <div className="space-y-2">
                <Label htmlFor="benchmark-industry">Select Industry</Label>
                <Select
                  value={benchmarkForm.industry}
                  onValueChange={async (value) => {
                    // Update industry
                    setBenchmarkForm({ ...benchmarkForm, industry: value });
                    
                    // Auto-fill benchmark value if metric is selected
                    if (value && benchmarkForm.metric) {
                      try {
                        // Try API first
                        const response = await fetch(`/api/industry-benchmarks/${value}/${benchmarkForm.metric}`);
                        if (response.ok) {
                          const data = await response.json();
                          setBenchmarkForm(prev => ({
                            ...prev,
                            benchmarkValue: String(data.value),
                            unit: data.unit
                          }));
                        } else {
                          // Fallback to hardcoded values
                          const fallbackData = getBenchmarkValueFallback(value, benchmarkForm.metric);
                          if (fallbackData) {
                            setBenchmarkForm(prev => ({
                              ...prev,
                              benchmarkValue: String(fallbackData.value),
                              unit: fallbackData.unit
                            }));
                          }
                        }
                      } catch (error) {
                        console.error('Failed to fetch benchmark value, using fallback:', error);
                        // Use fallback on error
                        const fallbackData = getBenchmarkValueFallback(value, benchmarkForm.metric);
                        if (fallbackData) {
                          setBenchmarkForm(prev => ({
                            ...prev,
                            benchmarkValue: String(fallbackData.value),
                            unit: fallbackData.unit
                          }));
                        }
                      }
                    }
                  }}
                >
                  <SelectTrigger id="benchmark-industry" data-testid="select-benchmark-industry">
                    <SelectValue placeholder="Choose an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry.value} value={industry.value}>
                        {industry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  💡 Benchmark value will be auto-filled based on industry standards
                </p>
              </div>
            )}

            {/* Email Alerts Section */}
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
                        value={benchmarkForm.alertThreshold}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setBenchmarkForm({ ...benchmarkForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-benchmark-alert-threshold"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
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
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
                  setBenchmarkForm({
                    metric: '',
                    name: '',
                    unit: '',
                    benchmarkValue: '',
                    currentValue: '',
                    benchmarkType: 'custom',
                    industry: '',
                    description: '',
                    applyTo: 'all',
                    specificCampaignId: '',
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
                onClick={handleCreateBenchmark}
                disabled={!benchmarkForm.name || !benchmarkForm.benchmarkValue}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-benchmark-submit"
              >
                {editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <Dialog open={isCampaignDetailsModalOpen} onOpenChange={setIsCampaignDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              {selectedCampaignDetails?.name}
            </DialogTitle>
            <DialogDescription>
              <Badge 
                variant={selectedCampaignDetails?.status === 'active' ? 'default' : 'secondary'}
                className={selectedCampaignDetails?.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
              >
                {selectedCampaignDetails?.status}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Core Metrics Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Core Metrics</h4>
              <div className="grid grid-cols-3 gap-4">
                {/* Impressions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Impressions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.impressions || 0)}
                  </p>
                </div>
                {/* Reach */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Reach</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.reach || 0)}
                  </p>
                </div>
                {/* Clicks */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.clicks || 0)}
                  </p>
                </div>
                {/* Engagements */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Engagements</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.engagements || 0)}
                  </p>
                </div>
                {/* Spend */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selectedCampaignDetails?.metrics.spend || 0)}
                  </p>
                </div>
                {/* Conversions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.conversions || 0)}
                  </p>
                </div>
                {/* Leads */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Leads</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.leads || 0)}
                  </p>
                </div>
                {/* Video Views */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Video Views</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.videoviews || selectedCampaignDetails?.metrics.videoViews || 0)}
                  </p>
                </div>
                {/* Viral Impressions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Viral Impressions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.viralimpressions || selectedCampaignDetails?.metrics.viralImpressions || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Derived Metrics Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Derived Metrics</h4>
              <div className="grid grid-cols-3 gap-4">
                {/* CTR */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR (Click-Through Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.clicks / selectedCampaignDetails?.metrics.impressions) * 100
                        : 0
                    )}
                  </p>
                </div>
                {/* CPC */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC (Cost Per Click)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.clicks > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.clicks
                        : 0
                    )}
                  </p>
                </div>
                {/* CPM */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM (Cost Per Mille)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.impressions) * 1000
                        : 0
                    )}
                  </p>
                </div>
                {/* CVR */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CVR (Conversion Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.clicks > 0
                        ? (selectedCampaignDetails?.metrics.conversions / selectedCampaignDetails?.metrics.clicks) * 100
                        : 0
                    )}
                  </p>
                </div>
                {/* CPA */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPA (Cost Per Acquisition)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.conversions > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.conversions
                        : 0
                    )}
                  </p>
                </div>
                {/* CPL */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPL (Cost Per Lead)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.leads > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.leads
                        : 0
                    )}
                  </p>
                </div>
                {/* ER */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ER (Engagement Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.engagements / selectedCampaignDetails?.metrics.impressions) * 100
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue Analytics Section - Only shown if conversion value is set */}
            {aggregated?.hasRevenueTracking === 1 && selectedCampaignDetails && (() => {
              const campaignConversions = selectedCampaignDetails.metrics.conversions || 0;
              const campaignSpend = selectedCampaignDetails.metrics.spend || 0;
              const campaignLeads = selectedCampaignDetails.metrics.leads || 0;
              const conversionValue = aggregated.conversionValue || 0;
              
              const campaignRevenue = campaignConversions * conversionValue;
              const campaignProfit = campaignRevenue - campaignSpend;
              const campaignROAS = campaignSpend > 0 ? campaignRevenue / campaignSpend : 0;
              const campaignROI = campaignSpend > 0 ? ((campaignRevenue - campaignSpend) / campaignSpend) * 100 : 0;
              const campaignProfitMargin = campaignRevenue > 0 ? (campaignProfit / campaignRevenue) * 100 : 0;
              const campaignRevenuePerLead = campaignLeads > 0 ? campaignRevenue / campaignLeads : 0;
              
              return (
                <div className="space-y-3 pt-4 border-t border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue Analytics</h4>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      💰 {formatCurrency(conversionValue)}/conversion
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(campaignRevenue)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {campaignConversions.toLocaleString()} conversions × {formatCurrency(conversionValue)}
                      </p>
                    </div>
                    
                    {/* ROAS */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS (Return on Ad Spend)</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                        {campaignROAS.toFixed(2)}x
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {formatCurrency(campaignRevenue)} / {formatCurrency(campaignSpend)}
                      </p>
                    </div>
                    
                    {/* ROI */}
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI (Return on Investment)</p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
                        {campaignROI.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {campaignROI >= 0 ? 'Profitable' : 'Loss'}
                      </p>
                    </div>
                    
                    {/* Profit */}
                    <div className={`p-4 rounded-lg border ${
                      campaignProfit >= 0 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit</p>
                      <p className={`text-lg font-bold ${
                        campaignProfit >= 0 
                          ? 'text-green-700 dark:text-green-400' 
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        {formatCurrency(campaignProfit)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        Revenue - Spend
                      </p>
                    </div>
                    
                    {/* Profit Margin */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit Margin</p>
                      <p className={`text-lg font-bold ${
                        campaignProfitMargin >= 0 
                          ? 'text-slate-900 dark:text-white' 
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        {campaignProfitMargin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        Profit / Revenue
                      </p>
                    </div>
                    
                    {/* Revenue Per Lead */}
                    {campaignLeads > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Revenue Per Lead</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatCurrency(campaignRevenuePerLead)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {campaignLeads.toLocaleString()} leads
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Performance Indicators - Only shown when industry is selected */}
            {campaignData?.industry && selectedCampaignDetails && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Performance Analysis</h4>
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    // This section uses selectedCampaignDetails, not linkedInCampaign
                    const campaignName = selectedCampaignDetails.name;
                    
                    const impressions = selectedCampaignDetails.metrics.impressions || 0;
                    const clicks = selectedCampaignDetails.metrics.clicks || 0;
                    const spend = selectedCampaignDetails.metrics.spend || 0;
                    const conversions = selectedCampaignDetails.metrics.conversions || 0;
                    const engagements = selectedCampaignDetails.metrics.engagements || 0;
                    
                    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                    const cpa = conversions > 0 ? spend / conversions : 0;
                    const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
                    const roas = aggregated?.roas || 0;
                    
                    return (
                      <>
                        {/* Performance Indicators - Using Benchmark System */}
                        {/* Note: This is a summary view - individual metric badges are shown above in the Secondary Metrics section */}
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
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={(open) => {
        setIsReportModalOpen(open);
        if (!open) {
          setEditingReportId(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Two Main Sections */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Standard Templates Section */}
              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  reportModalStep === 'standard'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => setReportModalStep('standard')}
                data-testid="section-standard-templates"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Templates</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Pre-built professional report templates
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Report Section */}
              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  reportModalStep === 'custom'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => setReportModalStep('custom')}
                data-testid="section-custom-report"
              >
                <div className="flex items-start gap-3">
                  <Settings className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Report</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Build your own customized report
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Templates Content */}
            {reportModalStep === 'standard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose Template</h3>

                  <div className="space-y-4">
                    {/* Overview Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'overview'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('overview')}
                      data-testid="template-overview"
                    >
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Overview</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Comprehensive overview of campaign performance metrics
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Overview</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Platforms</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Trends</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPIs Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'kpis'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('kpis')}
                      data-testid="template-kpis"
                    >
                      <div className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">KPIs</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Key performance indicators and progress tracking
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Metrics</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Targets</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Progress</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Benchmarks Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'benchmarks'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('benchmarks')}
                      data-testid="template-benchmarks"
                    >
                      <div className="flex items-start gap-3">
                        <Trophy className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Benchmarks</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Performance benchmarks and comparisons
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Industry</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Historical</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Goals</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ad Comparison Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'ads'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('ads')}
                      data-testid="template-ad-comparison"
                    >
                      <div className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Ad Comparison</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Detailed ad-level performance analysis
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Performance</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Ranking</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Automatic Reports */}
                    <div className="pt-4 border-t mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Checkbox
                          id="schedule-reports"
                          checked={reportForm.scheduleEnabled}
                          onCheckedChange={(checked) => 
                            setReportForm({ ...reportForm, scheduleEnabled: checked as boolean })
                          }
                          data-testid="checkbox-schedule-reports"
                        />
                        <Label 
                          htmlFor="schedule-reports" 
                          className="text-base font-semibold cursor-pointer"
                        >
                          Schedule Automatic Reports
                        </Label>
                      </div>

                      {reportForm.scheduleEnabled && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-4">
                          {/* Frequency */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-frequency">Frequency</Label>
                            <Select
                              value={reportForm.scheduleFrequency}
                              onValueChange={(value) => 
                                setReportForm({ ...reportForm, scheduleFrequency: value })
                              }
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
                                onValueChange={(value) => 
                                  setReportForm({ ...reportForm, scheduleDayOfWeek: value })
                                }
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

                          {/* Day of Month - Only for Monthly and Quarterly */}
                          {(reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') && (
                            <div className="space-y-2">
                              <Label htmlFor="schedule-day-month">Day of Month</Label>
                              <Select
                                value={reportForm.scheduleDayOfWeek}
                                onValueChange={(value) => 
                                  setReportForm({ ...reportForm, scheduleDayOfWeek: value })
                                }
                              >
                                <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Time */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-time">Time</Label>
                            <Select
                              value={reportForm.scheduleTime}
                              onValueChange={(value) => 
                                setReportForm({ ...reportForm, scheduleTime: value })
                              }
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
                              <p className="text-sm text-slate-500 dark:text-slate-400">
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
                              onChange={(e) => 
                                setReportForm({ ...reportForm, emailRecipients: e.target.value })
                              }
                              placeholder="Enter email addresses (comma-separated)"
                              data-testid="input-email-recipients"
                            />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Reports will be automatically generated and sent to these email addresses
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Report Configuration */}
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="report-name">Report Name</Label>
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
                  </div>
                )}
              </div>
            )}

            {/* Custom Report Content */}
            {reportModalStep === 'custom' && (
              <div className="space-y-6">
                {/* Report Name and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-report-name">Report Name</Label>
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Metrics</h3>
                  
                  <Accordion type="multiple" className="w-full">
                    {/* LinkedIn Ad Metrics */}
                    <AccordionItem value="linkedin-ad-metrics">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn Ad Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['impressions', 'reach', 'clicks', 'engagements', 'spend', 'conversions', 'leads', 'videoviews', 'viralimpressions'].map((metric) => {
                            const labels: Record<string, string> = {
                              impressions: 'Impressions',
                              reach: 'Reach',
                              clicks: 'Clicks',
                              engagements: 'Engagements',
                              spend: 'Spend',
                              conversions: 'Conversions',
                              leads: 'Leads',
                              videoviews: 'Video Views',
                              viralimpressions: 'Viral Impressions'
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

                    {/* LinkedIn Calculated Metrics */}
                    <AccordionItem value="linkedin-calculated-metrics">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn Calculated Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'].map((metric) => {
                            const labels: Record<string, string> = {
                              ctr: 'CTR (Click-Through Rate)',
                              cpc: 'CPC (Cost Per Click)',
                              cpm: 'CPM (Cost Per Mille)',
                              cvr: 'CVR (Conversion Rate)',
                              cpa: 'CPA (Cost Per Acquisition)',
                              cpl: 'CPL (Cost Per Lead)',
                              er: 'ER (Engagement Rate)',
                              roi: 'ROI (Return on Investment)',
                              roas: 'ROAS (Return on Ad Spend)'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`derived-${metric}`}
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
                                  data-testid={`checkbox-derived-${metric}`}
                                />
                                <Label htmlFor={`derived-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* KPIs */}
                    <AccordionItem value="kpis">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                          <p className="text-sm text-slate-500 pt-2">No KPIs created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Benchmarks */}
                    <AccordionItem value="benchmarks">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                          <p className="text-sm text-slate-500 pt-2">No benchmarks created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Ad Comparison */}
                    <AccordionItem value="ad-comparison">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Ad Comparison
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="include-ad-comparison"
                              checked={customReportConfig.includeAdComparison}
                              onCheckedChange={(checked) => {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  includeAdComparison: checked as boolean
                                });
                              }}
                              data-testid="checkbox-ad-comparison"
                            />
                            <Label htmlFor="include-ad-comparison" className="text-sm cursor-pointer">
                              Include side-by-side ad performance comparison
                            </Label>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                            Compare performance metrics across all ads in your LinkedIn campaigns
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Schedule Automatic Reports Section */}
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

                      {/* Day of Month - Only for Monthly and Quarterly */}
                      {(reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') && (
                        <div className="space-y-2">
                          <Label htmlFor="schedule-day-month">Day of Month</Label>
                          <Select
                            value={reportForm.scheduleDayOfWeek}
                            onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                          >
                            <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
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
                          <p className="text-sm text-slate-500 dark:text-slate-400">
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
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Reports will be automatically generated and sent to these email addresses
                        </p>
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
                <Button
                  variant="link"
                  onClick={() => {
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
                  data-testid="button-reset-report"
                >
                  Reset
                </Button>
                
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-report" : "button-create-report-submit"}
                    className="gap-2"
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
                    onClick={editingReportId ? handleUpdateReport : handleCustomReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-custom-report" : "button-create-custom-report"}
                    className="gap-2"
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

      {/* Campaign Details Modal */}
      <Dialog open={isCampaignDetailsModalOpen} onOpenChange={setIsCampaignDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Campaign Details: {selectedCampaignDetails?.name}</DialogTitle>
            <DialogDescription>
              Detailed metrics and performance indicators for this LinkedIn campaign
            </DialogDescription>
          </DialogHeader>

          {!selectedCampaignDetails ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-lg text-slate-500">No campaign selected</p>
            </div>
          ) : !selectedCampaignDetails.metrics ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-lg text-slate-500">No metrics available for this campaign</p>
            </div>
          ) : (
            // Render campaign metrics
            <div className="space-y-6">
              {(() => {
                try {
                  // Calculate metrics for this campaign
                  const impressions = selectedCampaignDetails.metrics?.impressions || 0;
                  const clicks = selectedCampaignDetails.metrics?.clicks || 0;
                  const spend = selectedCampaignDetails.metrics?.spend || 0;
                  const conversions = selectedCampaignDetails.metrics?.conversions || 0;
                  const engagements = selectedCampaignDetails.metrics?.engagements || 0;
                  const leads = selectedCampaignDetails.metrics?.leads || 0;
                  
                  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                  const cpc = clicks > 0 ? spend / clicks : 0;
                  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
                  const cpa = conversions > 0 ? spend / conversions : 0;
                  const cpl = leads > 0 ? spend / leads : 0;
                  const er = impressions > 0 ? (engagements / impressions) * 100 : 0;
                  
                  // Calculate additional metrics
                  const reach = selectedCampaignDetails.metrics?.reach || 0;
                  const videoViews = selectedCampaignDetails.metrics?.videoViews || 0;
                  const viralImpressions = selectedCampaignDetails.metrics?.viralImpressions || 0;
                  
                  return (
                    <>
                      {/* Core Metrics Section */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Core Metrics</h3>
                        <div className="grid grid-cols-3 gap-4">
                          {/* Impressions */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Impressions</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(impressions)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const impressionsBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'impressions' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (impressionsBenchmark) {
                                  return renderPerformanceBadge('impressions', impressions, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Clicks */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Clicks</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(clicks)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const clicksBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'clicks' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (clicksBenchmark) {
                                  return renderPerformanceBadge('clicks', clicks, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Spend */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Spend</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(spend)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const spendBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'spend' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (spendBenchmark) {
                                  return renderPerformanceBadge('spend', spend, 'lower-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Conversions */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Conversions</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(conversions)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const conversionsBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'conversions' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (conversionsBenchmark) {
                                  return renderPerformanceBadge('conversions', conversions, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Leads */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Leads</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(leads)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const leadsBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'leads' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (leadsBenchmark) {
                                  return renderPerformanceBadge('leads', leads, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Engagements */}
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Engagements</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(engagements)}
                              </p>
                              {Array.isArray(benchmarks) && (() => {
                                const engagementsBenchmark = benchmarks.find((b: any) => 
                                  b.metric?.toLowerCase() === 'engagements' && 
                                  b.linkedInCampaignName === selectedCampaignDetails.name
                                );
                                if (engagementsBenchmark) {
                                  return renderPerformanceBadge('engagements', engagements, 'higher-better');
                                }
                                return null;
                              })()}
                            </CardContent>
                          </Card>
                          
                          {/* Reach */}
                          {reach > 0 && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Reach</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(reach)}
                                </p>
                                {Array.isArray(benchmarks) && (() => {
                                  const reachBenchmark = benchmarks.find((b: any) => 
                                    b.metric?.toLowerCase() === 'reach' && 
                                    b.linkedInCampaignName === selectedCampaignDetails.name
                                  );
                                  if (reachBenchmark) {
                                    return renderPerformanceBadge('reach', reach, 'higher-better');
                                  }
                                  return null;
                                })()}
                              </CardContent>
                            </Card>
                          )}
                          
                          {/* Video Views */}
                          {videoViews > 0 && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Video Views</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(videoViews)}
                                </p>
                                {Array.isArray(benchmarks) && (() => {
                                  const videoViewsBenchmark = benchmarks.find((b: any) => 
                                    b.metric?.toLowerCase() === 'videoviews' && 
                                    b.linkedInCampaignName === selectedCampaignDetails.name
                                  );
                                  if (videoViewsBenchmark) {
                                    return renderPerformanceBadge('videoviews', videoViews, 'higher-better');
                                  }
                                  return null;
                                })()}
                              </CardContent>
                            </Card>
                          )}
                          
                          {/* Viral Impressions */}
                          {viralImpressions > 0 && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Viral Impressions</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(viralImpressions)}
                                </p>
                                {Array.isArray(benchmarks) && (() => {
                                  const viralBenchmark = benchmarks.find((b: any) => 
                                    b.metric?.toLowerCase() === 'viralimpressions' && 
                                    b.linkedInCampaignName === selectedCampaignDetails.name
                                  );
                                  if (viralBenchmark) {
                                    return renderPerformanceBadge('viralimpressions', viralImpressions, 'higher-better');
                                  }
                                  return null;
                                })()}
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>

                      {/* Derived Metrics Section */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Derived Metrics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* CTR */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(ctr)}
                        </p>
                        {/* Campaign-specific CTR badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const ctrBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'ctr' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (ctrBenchmark) {
                            return renderPerformanceBadge('ctr', ctr, 'higher-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* CPC */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpc)}
                        </p>
                        {/* Campaign-specific CPC badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const cpcBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'cpc' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (cpcBenchmark) {
                            return renderPerformanceBadge('cpc', cpc, 'lower-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* CPM */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpm)}
                        </p>
                        {/* Campaign-specific CPM badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const cpmBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'cpm' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (cpmBenchmark) {
                            return renderPerformanceBadge('cpm', cpm, 'lower-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* CVR */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CVR</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(cvr)}
                        </p>
                        {/* Campaign-specific CVR badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const cvrBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'cvr' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (cvrBenchmark) {
                            return renderPerformanceBadge('cvr', cvr, 'higher-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* CPA */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPA</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpa)}
                        </p>
                        {/* Campaign-specific CPA badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const cpaBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'cpa' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (cpaBenchmark) {
                            return renderPerformanceBadge('cpa', cpa, 'lower-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* CPL */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPL</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpl)}
                        </p>
                        {/* Campaign-specific CPL badge */}
                        {Array.isArray(benchmarks) && (() => {
                          const cplBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'cpl' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (cplBenchmark) {
                            return renderPerformanceBadge('cpl', cpl, 'lower-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>

                    {/* ER (Engagement Rate) */}
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ER (Engagement Rate)</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(er)}
                        </p>
                        {Array.isArray(benchmarks) && (() => {
                          const erBenchmark = benchmarks.find((b: any) => 
                            b.metric?.toLowerCase() === 'er' && 
                            b.linkedInCampaignName === selectedCampaignDetails.name
                          );
                          if (erBenchmark) {
                            return renderPerformanceBadge('er', er, 'higher-better');
                          }
                          return null;
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Revenue Metrics Section - Only if conversion value is set */}
                {aggregated?.hasRevenueTracking === 1 && (() => {
                  const conversionValue = aggregated.conversionValue || 0;
                  const revenue = conversions * conversionValue;
                  const profit = revenue - spend;
                  const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
                  const roas = spend > 0 ? revenue / spend : 0;
                  
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Revenue Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Revenue */}
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Revenue</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                              {formatCurrency(revenue)}
                            </p>
                          </CardContent>
                        </Card>
                        
                        {/* ROI */}
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatPercentage(roi)}
                            </p>
                            {Array.isArray(benchmarks) && (() => {
                              const roiBenchmark = benchmarks.find((b: any) => 
                                b.metric?.toLowerCase() === 'roi' && 
                                b.linkedInCampaignName === selectedCampaignDetails.name
                              );
                              if (roiBenchmark) {
                                return renderPerformanceBadge('roi', roi, 'higher-better');
                              }
                              return null;
                            })()}
                          </CardContent>
                        </Card>
                        
                        {/* ROAS */}
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {roas.toFixed(2)}x
                            </p>
                            {Array.isArray(benchmarks) && (() => {
                              const roasBenchmark = benchmarks.find((b: any) => 
                                b.metric?.toLowerCase() === 'roas' && 
                                b.linkedInCampaignName === selectedCampaignDetails.name
                              );
                              if (roasBenchmark) {
                                return renderPerformanceBadge('roas', roas, 'higher-better');
                              }
                              return null;
                            })()}
                          </CardContent>
                        </Card>
                        
                        {/* Profit */}
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Profit</p>
                            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                              {formatCurrency(profit)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
                    </>
                  );
                } catch (error) {
                  console.error('[Campaign Details Modal] Error rendering:', error);
                  return (
                    <div className="p-8 text-center">
                      <p className="text-red-600 font-bold">Error loading campaign details</p>
                      <p className="text-sm text-slate-500 mt-2">{String(error)}</p>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

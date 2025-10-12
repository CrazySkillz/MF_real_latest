import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, Clock, Plus, Heart, MessageCircle, Share2, Activity, Users, Play, Filter, ArrowUpDown, ChevronRight, Trash2 } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

// Helper: Derive category from metric
const getCategoryFromMetric = (metric: string): string => {
  const metricLower = metric.toLowerCase();
  
  if (['ctr', 'cpc', 'cpm', 'cpa', 'cpl'].some(m => metricLower.includes(m))) return 'cost';
  if (['cvr', 'conversions', 'leads'].some(m => metricLower.includes(m))) return 'conversion';
  if (['er', 'engagements', 'likes', 'comments', 'shares'].some(m => metricLower.includes(m))) return 'engagement';
  if (['impressions', 'reach', 'viral'].some(m => metricLower.includes(m))) return 'reach';
  if (['roi', 'roas', 'video'].some(m => metricLower.includes(m))) return 'performance';
  
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
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'templates' | 'configuration'>('configuration');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const { toast } = useToast();
  const campaignId = params?.id;
  
  // KPI Form State
  const [kpiForm, setKpiForm] = useState({
    name: '',
    unit: '',
    description: '',
    targetValue: '',
    currentValue: '',
    priority: 'high',
    timeframe: 'monthly',
    trackingPeriod: '30'
  });

  // Benchmark Form State
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    benchmarkType: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    industry: '',
    description: '',
    source: '',
    geographicLocation: '',
    period: 'monthly',
    confidenceLevel: ''
  });

  // Fetch campaign data
  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
  });

  // Fetch import session data
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId],
    enabled: !!sessionId,
  });

  // Fetch ad performance data
  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId, 'ads'],
    enabled: !!sessionId,
  });

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/linkedin/kpis', kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis'] });
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
        targetValue: '',
        currentValue: '',
        priority: 'high',
        timeframe: 'monthly',
        trackingPeriod: '30'
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis'] });
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

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setKpiForm({
      name: template.name,
      unit: template.unit,
      description: template.description,
      targetValue: template.targetValue,
      currentValue: '',
      priority: 'high',
      timeframe: 'monthly',
      trackingPeriod: '30'
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
      // campaignId is null for platform-level KPIs
      name: kpiForm.name,
      targetValue: kpiForm.targetValue,
      currentValue: kpiForm.currentValue || '0',
      unit: kpiForm.unit,
      description: kpiForm.description,
      priority: kpiForm.priority,
      timeframe: kpiForm.timeframe,
      trackingPeriod: parseInt(kpiForm.trackingPeriod),
      status: 'tracking',
      rollingAverage: '7day',
      alertsEnabled: true,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: 'daily'
    };
    createKpiMutation.mutate(kpiData);
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const res = await apiRequest('POST', '/api/platforms/linkedin/benchmarks', benchmarkData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/benchmarks'] });
      toast({
        title: "Benchmark Created",
        description: "Your LinkedIn benchmark has been created successfully.",
      });
      setIsBenchmarkModalOpen(false);
      setBenchmarkForm({
        metric: '',
        name: '',
        benchmarkType: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: ''
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

  // Handle create Benchmark
  const handleCreateBenchmark = () => {
    const derivedCategory = getCategoryFromMetric(benchmarkForm.metric);
    const benchmarkData = {
      name: benchmarkForm.name,
      category: derivedCategory,
      benchmarkType: benchmarkForm.benchmarkType,
      unit: benchmarkForm.unit,
      benchmarkValue: benchmarkForm.benchmarkValue,
      currentValue: benchmarkForm.currentValue || '0',
      industry: benchmarkForm.industry,
      description: benchmarkForm.description,
      source: benchmarkForm.source,
      geoLocation: benchmarkForm.geographicLocation,
      period: benchmarkForm.period,
      confidenceLevel: benchmarkForm.confidenceLevel,
      status: 'active'
    };
    createBenchmarkMutation.mutate(benchmarkData);
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

  // Fetch platform-level LinkedIn KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/kpis'],
  });

  // Fetch platform-level LinkedIn Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/benchmarks'],
  });

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return (isNaN(n) ? 0 : n).toLocaleString();
  };
  
  const formatCurrency = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return `$${(isNaN(n) ? 0 : n).toFixed(2)}`;
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
                      {session.adAccountName} • {session.selectedCampaignsCount} campaigns • {session.selectedMetricsCount} metrics
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
              <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="ads" data-testid="tab-ads">Ad Comparison</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
                {sessionData && aggregated ? (
                  <>
                    {/* LinkedIn Metrics Grid - 4 columns - Core Metrics Only */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(aggregated)
                        .filter(([key]) => {
                          // Only show core metrics, exclude derived metrics
                          const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'];
                          const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                          return !derivedMetrics.includes(metricKey);
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
                              </CardContent>
                            </Card>
                          );
                        })}
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
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="spend">Spend</SelectItem>
                                <SelectItem value="conversions">Conversions</SelectItem>
                                <SelectItem value="roas">ROAS</SelectItem>
                                <SelectItem value="ctr">CTR</SelectItem>
                                <SelectItem value="cpa">CPA</SelectItem>
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
                          ).map((linkedInCampaign: any, index: number) => {
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
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(clicks)}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(spend)}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(conversions)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Secondary Metrics */}
                                  <div className="grid grid-cols-5 gap-3 mb-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(ctr)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpc)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpm)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Conv. Rate</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(convRate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Cost/Conv.</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(costPerConv)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Performance Indicators */}
                                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {/* CTR Indicators */}
                                      {ctr > 5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CTR Excellent</span>
                                        </div>
                                      )}
                                      {ctr < 1 && ctr > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CTR Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* Conversion Rate Indicators */}
                                      {convRate > 10 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Conversion High</span>
                                        </div>
                                      )}
                                      {convRate < 2 && convRate > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Conversion Low</span>
                                        </div>
                                      )}
                                      
                                      {/* CPA Indicators */}
                                      {cpa > 0 && cpa < 150 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CPA Strong</span>
                                        </div>
                                      )}
                                      {cpa > 300 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CPA Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* ROAS Indicators */}
                                      {roas > 4 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Strong</span>
                                        </div>
                                      )}
                                      {roas > 0 && roas < 1.5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* Engagement Rate Indicators */}
                                      {engagementRate > 2 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Good</span>
                                        </div>
                                      )}
                                      {engagementRate > 0 && engagementRate < 0.5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Low</span>
                                        </div>
                                      )}
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
                      <Button 
                        onClick={() => setIsKPIModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-create-kpi-header"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create KPI
                      </Button>
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
                            <Target className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Active KPIs</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(kpisData as any[]).filter((k: any) => k.status === 'active').length}
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
                              <p className="text-sm text-slate-600 dark:text-slate-400">High Priority</p>
                              <p className="text-2xl font-bold text-red-600">
                                {(kpisData as any[]).filter((k: any) => k.priority === 'high').length}
                              </p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-red-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">In Progress</p>
                              <p className="text-2xl font-bold text-blue-600">
                                {(kpisData as any[]).filter((k: any) => k.status === 'active').length}
                              </p>
                            </div>
                            <Clock className="w-8 h-8 text-blue-500" />
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
                                <CardTitle className="text-lg">{kpi.name}</CardTitle>
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
                                  {kpi.currentValue || '0'}{kpi.unit || ''}
                                </div>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {kpi.targetValue || '0'}{kpi.unit || ''}
                                </div>
                              </div>
                            </div>
                            
                            {/* Progress Tracker */}
                            {kpi.targetValue && kpi.currentValue && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100)}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                  <div 
                                    className={`h-2.5 rounded-full transition-all ${
                                      (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 1 
                                        ? 'bg-green-500' 
                                        : (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 0.7
                                        ? 'bg-blue-500'
                                        : (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 0.4
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100, 100)}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  {(parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 1 ? (
                                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Target achieved!
                                    </span>
                                  ) : (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 0.7 ? (
                                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" /> On track
                                    </span>
                                  ) : (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 0.4 ? (
                                    <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> Needs attention
                                    </span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> Off track
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {kpi.category && (
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Category: <span className="font-medium">{kpi.category}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        LinkedIn Campaign KPIs
                      </CardTitle>
                      <CardDescription>
                        Track key performance indicators for your LinkedIn campaigns
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          No KPIs have been created for this campaign yet.
                        </p>
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          data-testid="button-create-kpi"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPIs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                    onClick={() => setIsBenchmarkModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-create-benchmark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Benchmark
                  </Button>
                </div>

                {benchmarksLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : benchmarksData && (benchmarksData as any[]).length > 0 ? (
                  <>
                    {/* Benchmark Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                                {(benchmarksData as any[]).filter((b: any) => b.isActive).length}
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
                              <p className="text-sm text-slate-600 dark:text-slate-400">Categories</p>
                              <p className="text-2xl font-bold text-purple-600">
                                {new Set((benchmarksData as any[]).map((b: any) => b.category)).size}
                              </p>
                            </div>
                            <BarChart3 className="w-8 h-8 text-purple-500" />
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
                      {(benchmarksData as any[]).map((benchmark: any) => (
                        <Card key={benchmark.id} data-testid={`benchmark-card-${benchmark.id}`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                  {benchmark.name}
                                </h3>
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
                              <Badge variant={benchmark.isActive ? 'default' : 'secondary'}>
                                {benchmark.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Your Performance
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.currentValue || '0'}{benchmark.unit || ''}
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
                                  Source
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.source || 'LinkedIn'}
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
                                    const current = parseFloat(benchmark.currentValue);
                                    const benchmarkVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue);
                                    const diff = current - benchmarkVal;
                                    const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100).toFixed(1) : '0';
                                    const isAbove = current > benchmarkVal;
                                    
                                    return (
                                      <>
                                        <Badge 
                                          variant={isAbove ? "default" : "secondary"}
                                          className={isAbove ? "bg-green-600" : "bg-red-600"}
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
                                          {isAbove ? '🎉 Outperforming!' : '⚠️ Needs improvement'}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
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
                          onClick={() => setIsBenchmarkModalOpen(true)}
                          data-testid="button-create-benchmark"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                    
                    // Available metrics for comparison
                    const availableMetrics = [
                      { key: 'impressions', label: 'Impressions', format: formatNumber },
                      { key: 'clicks', label: 'Clicks', format: formatNumber },
                      { key: 'spend', label: 'Spend', format: formatCurrency },
                      { key: 'ctr', label: 'CTR', format: formatPercentage },
                      { key: 'cpc', label: 'CPC', format: formatCurrency },
                      { key: 'conversions', label: 'Conversions', format: formatNumber },
                      { key: 'revenue', label: 'Revenue', format: formatCurrency },
                    ];

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

                    // Get the current selected metric or default to impressions
                    const currentMetric = availableMetrics.find(m => m.key === selectedMetric) || availableMetrics[0];

                    // Transform data: Create chart data for the selected metric only
                    // X-axis will be ad names, Y-axis will be the metric value
                    const chartData = sortedAds.map((ad, index) => {
                      const value = currentMetric.key === 'spend' || currentMetric.key === 'ctr' || currentMetric.key === 'cpc' || currentMetric.key === 'revenue'
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
                                  {availableMetrics.map(metric => (
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
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create LinkedIn KPI</DialogTitle>
            <DialogDescription className="mt-1">
              Set up a key performance indicator to track your LinkedIn campaign success
            </DialogDescription>
          </DialogHeader>

          {modalStep === 'templates' ? (
            <div className="space-y-4 py-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Choose a template or create custom KPI:
              </h3>

              {/* Template Options */}
              <div className="space-y-3">
                {LINKEDIN_KPI_TEMPLATES.map((template, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-all"
                    data-testid={`kpi-template-${index}`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {template.name}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {template.description}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      Target: <span className="font-medium text-blue-600 dark:text-blue-400">{template.targetValue}{template.unit}</span>
                    </p>
                  </div>
                ))}

                {/* Create Custom KPI Option */}
                <div
                  className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-all"
                  data-testid="kpi-template-custom"
                  onClick={() => {
                    setKpiForm({
                      name: '',
                      unit: '',
                      description: '',
                      targetValue: '',
                      currentValue: '',
                      priority: 'high',
                      timeframe: 'monthly',
                      trackingPeriod: '30'
                    });
                    setModalStep('configuration');
                  }}
                >
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                    Create Custom KPI
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Build your own KPI from scratch
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Header with back button */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  KPI Configuration
                </h3>
                <Button
                  variant="ghost"
                  onClick={handleBackToTemplates}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  data-testid="button-back-to-templates"
                >
                  <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
                  Back to Templates
                </Button>
              </div>

              {/* KPI Form */}
              <div className="space-y-2">
                <Label htmlFor="kpi-metric">Select Metric</Label>
                <Select
                  value={kpiForm.name}
                  onValueChange={(value) => {
                    // Get metric details
                    const metricDetails = (() => {
                      const key = value.toLowerCase();
                      if (!aggregated) return { value: '', unit: '' };
                      
                      // Core metrics
                      if (key === 'impressions') return { value: aggregated.totalImpressions?.toString() || '0', unit: '' };
                      if (key === 'reach') return { value: aggregated.totalReach?.toString() || '0', unit: '' };
                      if (key === 'clicks') return { value: aggregated.totalClicks?.toString() || '0', unit: '' };
                      if (key === 'engagements') return { value: aggregated.totalEngagements?.toString() || '0', unit: '' };
                      if (key === 'spend') return { value: aggregated.totalSpend?.toString() || '0', unit: '$' };
                      if (key === 'conversions') return { value: aggregated.totalConversions?.toString() || '0', unit: '' };
                      if (key === 'leads') return { value: aggregated.totalLeads?.toString() || '0', unit: '' };
                      if (key === 'video views') return { value: aggregated.totalVideoViews?.toString() || '0', unit: '' };
                      if (key === 'viral impressions') return { value: aggregated.totalViralImpressions?.toString() || '0', unit: '' };
                      
                      // Derived metrics
                      if (key === 'ctr') return { value: aggregated.ctr?.toString() || '0', unit: '%' };
                      if (key === 'cpc') return { value: aggregated.cpc?.toString() || '0', unit: '$' };
                      if (key === 'cpm') return { value: aggregated.cpm?.toString() || '0', unit: '$' };
                      if (key === 'cvr') return { value: aggregated.cvr?.toString() || '0', unit: '%' };
                      if (key === 'cpa') return { value: aggregated.cpa?.toString() || '0', unit: '$' };
                      if (key === 'cpl') return { value: aggregated.cpl?.toString() || '0', unit: '$' };
                      if (key === 'er') return { value: aggregated.er?.toString() || '0', unit: '%' };
                      if (key === 'roi') return { value: aggregated.roi?.toString() || '0', unit: '%' };
                      if (key === 'roas') return { value: aggregated.roas?.toString() || '0', unit: 'x' };
                      
                      return { value: '0', unit: '' };
                    })();
                    
                    setKpiForm({ 
                      ...kpiForm, 
                      name: value,
                      currentValue: metricDetails.value,
                      unit: metricDetails.unit
                    });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                    <SelectValue placeholder="Choose a metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Impressions">Impressions</SelectItem>
                    <SelectItem value="Reach">Reach</SelectItem>
                    <SelectItem value="Clicks">Clicks</SelectItem>
                    <SelectItem value="Engagements">Engagements</SelectItem>
                    <SelectItem value="Spend">Spend</SelectItem>
                    <SelectItem value="Conversions">Conversions</SelectItem>
                    <SelectItem value="Leads">Leads</SelectItem>
                    <SelectItem value="Video Views">Video Views</SelectItem>
                    <SelectItem value="Viral Impressions">Viral Impressions</SelectItem>
                    <SelectItem value="CTR">CTR (Click-Through Rate)</SelectItem>
                    <SelectItem value="CPC">CPC (Cost Per Click)</SelectItem>
                    <SelectItem value="CPM">CPM (Cost Per Mille)</SelectItem>
                    <SelectItem value="CVR">CVR (Conversion Rate)</SelectItem>
                    <SelectItem value="CPA">CPA (Cost Per Acquisition)</SelectItem>
                    <SelectItem value="CPL">CPL (Cost Per Lead)</SelectItem>
                    <SelectItem value="ER">ER (Engagement Rate)</SelectItem>
                    <SelectItem value="ROI">ROI (Return on Investment)</SelectItem>
                    <SelectItem value="ROAS">ROAS (Return on Ad Spend)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kpi-description">Description</Label>
                <Textarea
                  id="kpi-description"
                  value={kpiForm.description}
                  onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                  data-testid="input-kpi-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi-target">Target Value</Label>
                  <Input
                    id="kpi-target"
                    type="number"
                    step="0.01"
                    value={kpiForm.targetValue}
                    onChange={(e) => setKpiForm({ ...kpiForm, targetValue: e.target.value })}
                    placeholder="2.5"
                    data-testid="input-kpi-target"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kpi-current">Current Value (Auto-populated)</Label>
                  <Input
                    id="kpi-current"
                    type="text"
                    value={kpiForm.currentValue ? `${kpiForm.currentValue}${kpiForm.unit}` : 'Select a metric first'}
                    readOnly
                    className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                    data-testid="input-kpi-current"
                  />
                </div>

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
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kpi-timeframe">Timeframe</Label>
                <Select
                  value={kpiForm.timeframe}
                  onValueChange={(value) => {
                    const trackingPeriodMap: Record<string, string> = {
                      'daily': '1',
                      'weekly': '7',
                      'monthly': '30',
                      'quarterly': '90'
                    };
                    setKpiForm({ 
                      ...kpiForm, 
                      timeframe: value,
                      trackingPeriod: trackingPeriodMap[value] || '30'
                    });
                  }}
                >
                  <SelectTrigger id="kpi-timeframe" data-testid="select-kpi-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (1 day)</SelectItem>
                    <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                    <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  How often to measure progress toward your target
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsKPIModalOpen(false)}
                  data-testid="button-cancel-kpi"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKPI}
                  disabled={createKpiMutation.isPending || !kpiForm.name || !kpiForm.targetValue}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-create-kpi"
                >
                  {createKpiMutation.isPending ? 'Creating...' : 'Create KPI'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create LinkedIn Benchmark Modal */}
      <Dialog open={isBenchmarkModalOpen} onOpenChange={setIsBenchmarkModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create LinkedIn Benchmark</DialogTitle>
            <DialogDescription className="mt-1">
              Set up a benchmark to compare your LinkedIn performance against industry standards
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Benchmark Form */}
            <div className="space-y-2">
              <Label htmlFor="benchmark-metric">Select Metric</Label>
              <Select
                value={benchmarkForm.metric}
                onValueChange={(value) => {
                  // Get metric details
                  const metricDetails = (() => {
                    const key = value.toLowerCase();
                    if (!aggregated) return { value: '', unit: '', name: value };
                    
                    // Core metrics
                    if (key === 'impressions') return { value: aggregated.totalImpressions?.toString() || '0', unit: '', name: 'Impressions' };
                    if (key === 'reach') return { value: aggregated.totalReach?.toString() || '0', unit: '', name: 'Reach' };
                    if (key === 'clicks') return { value: aggregated.totalClicks?.toString() || '0', unit: '', name: 'Clicks' };
                    if (key === 'engagements') return { value: aggregated.totalEngagements?.toString() || '0', unit: '', name: 'Engagements' };
                    if (key === 'spend') return { value: aggregated.totalSpend?.toString() || '0', unit: '$', name: 'Spend' };
                    if (key === 'conversions') return { value: aggregated.totalConversions?.toString() || '0', unit: '', name: 'Conversions' };
                    if (key === 'leads') return { value: aggregated.totalLeads?.toString() || '0', unit: '', name: 'Leads' };
                    if (key === 'video views') return { value: aggregated.totalVideoViews?.toString() || '0', unit: '', name: 'Video Views' };
                    if (key === 'viral impressions') return { value: aggregated.totalViralImpressions?.toString() || '0', unit: '', name: 'Viral Impressions' };
                    
                    // Derived metrics
                    if (key === 'ctr') return { value: aggregated.ctr?.toFixed(2) || '0', unit: '%', name: 'CTR' };
                    if (key === 'cpc') return { value: aggregated.cpc?.toFixed(2) || '0', unit: '$', name: 'CPC' };
                    if (key === 'cpm') return { value: aggregated.cpm?.toFixed(2) || '0', unit: '$', name: 'CPM' };
                    if (key === 'cvr') return { value: aggregated.conversionRate?.toFixed(2) || '0', unit: '%', name: 'CVR' };
                    if (key === 'cpa') return { value: aggregated.cpa?.toFixed(2) || '0', unit: '$', name: 'CPA' };
                    if (key === 'cpl') return { value: aggregated.cpl?.toFixed(2) || '0', unit: '$', name: 'CPL' };
                    if (key === 'er') return { value: aggregated.engagementRate?.toFixed(2) || '0', unit: '%', name: 'ER' };
                    if (key === 'roi') return { value: aggregated.roi?.toFixed(2) || '0', unit: '%', name: 'ROI' };
                    if (key === 'roas') return { value: aggregated.roas?.toFixed(2) || '0', unit: 'x', name: 'ROAS' };
                    
                    return { value: '', unit: '', name: value };
                  })();
                  
                  setBenchmarkForm({ 
                    ...benchmarkForm, 
                    metric: value,
                    name: `${metricDetails.name} Benchmark`,
                    unit: metricDetails.unit,
                    currentValue: metricDetails.value
                  });
                }}
              >
                <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                  <SelectValue placeholder="Choose a metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Impressions">Impressions</SelectItem>
                  <SelectItem value="Reach">Reach</SelectItem>
                  <SelectItem value="Clicks">Clicks</SelectItem>
                  <SelectItem value="Engagements">Engagements</SelectItem>
                  <SelectItem value="Spend">Spend</SelectItem>
                  <SelectItem value="Conversions">Conversions</SelectItem>
                  <SelectItem value="Leads">Leads</SelectItem>
                  <SelectItem value="Video Views">Video Views</SelectItem>
                  <SelectItem value="Viral Impressions">Viral Impressions</SelectItem>
                  <SelectItem value="CTR">CTR (Click-Through Rate)</SelectItem>
                  <SelectItem value="CPC">CPC (Cost Per Click)</SelectItem>
                  <SelectItem value="CPM">CPM (Cost Per Mille)</SelectItem>
                  <SelectItem value="CVR">CVR (Conversion Rate)</SelectItem>
                  <SelectItem value="CPA">CPA (Cost Per Acquisition)</SelectItem>
                  <SelectItem value="CPL">CPL (Cost Per Lead)</SelectItem>
                  <SelectItem value="ER">ER (Engagement Rate)</SelectItem>
                  <SelectItem value="ROI">ROI (Return on Investment)</SelectItem>
                  <SelectItem value="ROAS">ROAS (Return on Ad Spend)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name</Label>
              <Input
                id="benchmark-name"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                placeholder="e.g., LinkedIn CTR Benchmark"
                data-testid="input-benchmark-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-type">Benchmark Type</Label>
                <Select
                  value={benchmarkForm.benchmarkType}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, benchmarkType: value })}
                >
                  <SelectTrigger id="benchmark-type" data-testid="select-benchmark-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="industry_average">Industry Average</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="historical">Historical</SelectItem>
                    <SelectItem value="target">Target</SelectItem>
                    <SelectItem value="best_practice">Best Practice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-unit">Unit (Auto-populated)</Label>
                <Input
                  id="benchmark-unit"
                  type="text"
                  value={benchmarkForm.unit}
                  readOnly
                  className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                  placeholder="Select a metric first"
                  data-testid="input-benchmark-unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-current">Current Value</Label>
                <Input
                  id="benchmark-current"
                  type="text"
                  value={benchmarkForm.currentValue ? `${benchmarkForm.currentValue}${benchmarkForm.unit}` : 'Select a metric first'}
                  readOnly
                  className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                  data-testid="input-benchmark-current"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-value">
                  {getBenchmarkValueLabel(benchmarkForm.benchmarkType)}
                </Label>
                <Input
                  id="benchmark-value"
                  type="number"
                  step="0.01"
                  value={benchmarkForm.benchmarkValue}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, benchmarkValue: e.target.value })}
                  placeholder="e.g., 2.5"
                  data-testid="input-benchmark-value"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-industry">
                  {getContextFieldLabel(benchmarkForm.benchmarkType)}
                </Label>
                <Input
                  id="benchmark-industry"
                  value={benchmarkForm.industry}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, industry: e.target.value })}
                  placeholder={getContextFieldPlaceholder(benchmarkForm.benchmarkType)}
                  data-testid="input-benchmark-industry"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="benchmark-description">Description</Label>
              <Textarea
                id="benchmark-description"
                value={benchmarkForm.description}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, description: e.target.value })}
                placeholder="Describe this benchmark and its source"
                rows={3}
                data-testid="input-benchmark-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-source">Source</Label>
                <Input
                  id="benchmark-source"
                  value={benchmarkForm.source}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, source: e.target.value })}
                  placeholder="e.g., LinkedIn Marketing Solutions"
                  data-testid="input-benchmark-source"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-location">Geographic Location</Label>
                <Input
                  id="benchmark-location"
                  value={benchmarkForm.geographicLocation}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, geographicLocation: e.target.value })}
                  placeholder="e.g., Global, US, Europe"
                  data-testid="input-benchmark-location"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-period">Period</Label>
                <Select
                  value={benchmarkForm.period}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, period: value })}
                >
                  <SelectTrigger id="benchmark-period" data-testid="select-benchmark-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-confidence">Confidence Level</Label>
                <Input
                  id="benchmark-confidence"
                  value={benchmarkForm.confidenceLevel}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, confidenceLevel: e.target.value })}
                  placeholder="e.g., 95%, High, Medium"
                  data-testid="input-benchmark-confidence"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsBenchmarkModalOpen(false)}
                data-testid="button-cancel-benchmark"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBenchmark}
                disabled={createBenchmarkMutation.isPending || !benchmarkForm.name || !benchmarkForm.benchmarkValue}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-create-benchmark-submit"
              >
                {createBenchmarkMutation.isPending ? 'Creating...' : 'Create Benchmark'}
              </Button>
            </div>
          </div>
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
              Campaign ID: {selectedCampaignDetails ? Object.keys(metrics?.reduce((acc: any, m: any) => ({ ...acc, [m.campaignUrn]: true }), {}) || {}).indexOf(selectedCampaignDetails.urn) + 1 : ''} • 
              <Badge 
                variant={selectedCampaignDetails?.status === 'active' ? 'default' : 'secondary'}
                className={selectedCampaignDetails?.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-2' : 'ml-2'}
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
                {/* ROI */}
                {aggregated?.roi !== undefined && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI (Return on Investment)</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatPercentage(aggregated.roi || 0)}
                    </p>
                  </div>
                )}
                {/* ROAS */}
                {aggregated?.roas !== undefined && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS (Return on Ad Spend)</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {(aggregated.roas || 0).toFixed(2)}x
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Indicators */}
            {selectedCampaignDetails && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Performance Analysis</h4>
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
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
                        {/* CTR Indicators */}
                        {ctr > 5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CTR Excellent</span>
                          </div>
                        )}
                        {ctr < 1 && ctr > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CTR Weak</span>
                          </div>
                        )}
                        
                        {/* Conversion Rate Indicators */}
                        {convRate > 10 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Conversion High</span>
                          </div>
                        )}
                        {convRate < 2 && convRate > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Conversion Low</span>
                          </div>
                        )}
                        
                        {/* CPA Indicators */}
                        {cpa > 0 && cpa < 150 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CPA Strong</span>
                          </div>
                        )}
                        {cpa > 300 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CPA Weak</span>
                          </div>
                        )}
                        
                        {/* ROAS Indicators */}
                        {roas > 4 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Strong</span>
                          </div>
                        )}
                        {roas > 0 && roas < 1.5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Weak</span>
                          </div>
                        )}
                        
                        {/* Engagement Rate Indicators */}
                        {engagementRate > 2 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Good</span>
                          </div>
                        )}
                        {engagementRate > 0 && engagementRate < 0.5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Low</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

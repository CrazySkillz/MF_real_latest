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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, Clock, Plus, Heart, MessageCircle, Share2, Activity, Users, Play, Filter, ArrowUpDown, ChevronRight } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

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
  const [viewMode, setViewMode] = useState<string>('performance');
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'templates' | 'configuration'>('templates');
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
      setModalStep('templates');
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

  // Fetch platform-level LinkedIn KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/kpis'],
  });

  // Fetch campaign Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'benchmarks'],
    enabled: !!campaignId,
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
      'impressions': { icon: Eye, format: formatNumber, label: 'Total Impressions' },
      'clicks': { icon: MousePointerClick, format: formatNumber, label: 'Total Clicks' },
      'spend': { icon: DollarSign, format: formatCurrency, label: 'Total Spend' },
      'conversions': { icon: Target, format: formatNumber, label: 'Total Conversions' },
      'leads': { icon: Users, format: formatNumber, label: 'Total Leads' },
      'likes': { icon: Heart, format: formatNumber, label: 'Total Likes' },
      'comments': { icon: MessageCircle, format: formatNumber, label: 'Total Comments' },
      'shares': { icon: Share2, format: formatNumber, label: 'Total Shares' },
      'totalengagements': { icon: Activity, format: formatNumber, label: 'Total Engagements' },
      'reach': { icon: Users, format: formatNumber, label: 'Total Reach' },
      'videoviews': { icon: Play, format: formatNumber, label: 'Total Video Views' },
      'viralimpressions': { icon: Activity, format: formatNumber, label: 'Total Viral Impressions' },
      'ctr': { icon: Activity, format: formatPercentage, label: 'Click-Through Rate' },
      'cpc': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Click' },
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
                    {/* LinkedIn Metrics Grid - 4 columns like the screenshot */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(aggregated).map(([key, value]: [string, any]) => {
                        const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                        const { icon: Icon, format, label } = getMetricDisplay(metricKey, value);
                        
                        return (
                          <Card key={key} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  {label}
                                </h3>
                                <Icon className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                {format(value)}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Campaign Breakdown */}
                    <Card>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-slate-600" />
                            <div>
                              <CardTitle>Campaign Breakdown</CardTitle>
                              <CardDescription>Comprehensive metrics by individual campaigns</CardDescription>
                            </div>
                          </div>
                          <Select value={viewMode} onValueChange={setViewMode}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="View" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="performance">Performance</SelectItem>
                              <SelectItem value="engagement">Engagement</SelectItem>
                              <SelectItem value="conversions">Conversions</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Sort and Filter Controls */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
                                  <SelectItem value="impressions">Impressions</SelectItem>
                                  <SelectItem value="clicks">Clicks</SelectItem>
                                  <SelectItem value="spend">Spend</SelectItem>
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
                      </CardHeader>
                      
                      <CardContent className="p-0">
                        {metrics && metrics.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                    Campaign
                                  </th>
                                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                  </th>
                                  {/* Dynamically render metric columns based on selected metrics */}
                                  {(Array.from(new Set(metrics.map((m: any) => m.metricKey))) as string[]).map((metricKey: string) => {
                                    const { label } = getMetricDisplay(metricKey, 0);
                                    return (
                                      <th key={metricKey} className="text-right px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                        {label.replace('Total ', '').replace('Average ', '')}
                                      </th>
                                    );
                                  })}
                                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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
                                  // Calculate performance indicators
                                  const ctr = linkedInCampaign.metrics.ctr || 0;
                                  const conversionRate = linkedInCampaign.metrics.conversions && linkedInCampaign.metrics.clicks
                                    ? (linkedInCampaign.metrics.conversions / linkedInCampaign.metrics.clicks) * 100
                                    : 0;
                                  
                                  return (
                                    <tr 
                                      key={index} 
                                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                                          <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                              {linkedInCampaign.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                              ID: {index + 1}
                                            </p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <Badge 
                                          variant={linkedInCampaign.status === 'active' ? 'default' : 'secondary'}
                                          className={linkedInCampaign.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                        >
                                          {linkedInCampaign.status}
                                        </Badge>
                                      </td>
                                      {/* Dynamically render metric values */}
                                      {(Array.from(new Set(metrics.map((m: any) => m.metricKey))) as string[]).map((metricKey: string) => {
                                        const value = linkedInCampaign.metrics[metricKey] || 0;
                                        const { format } = getMetricDisplay(metricKey, value);
                                        return (
                                          <td key={metricKey} className="px-6 py-4 text-right">
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                              {format(value)}
                                            </span>
                                          </td>
                                        );
                                      })}
                                      <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                          {ctr > 5 && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                              <span className="text-xs font-medium text-green-700 dark:text-green-400">High CTR</span>
                                            </div>
                                          )}
                                          <Button variant="ghost" size="sm" className="h-8">
                                            <ChevronRight className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-8">No campaign data available</p>
                        )}
                      </CardContent>
                    </Card>
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
                              <div>
                                <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                <CardDescription className="text-sm">
                                  {kpi.description || 'No description provided'}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
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
                                  Current Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.currentValue || '0'}{benchmark.unit || ''}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.targetValue || '0'}{benchmark.unit || ''}
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
                          onClick={() => setLocation(`/campaigns/${campaignId}`)}
                          data-testid="button-create-benchmark"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Go to Campaign to Create Benchmark
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
          setModalStep('templates');
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi-name">KPI Name</Label>
                  <Input
                    id="kpi-name"
                    value={kpiForm.name}
                    onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                    placeholder="Enter KPI name"
                    data-testid="input-kpi-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kpi-unit">Unit</Label>
                  <Input
                    id="kpi-unit"
                    value={kpiForm.unit}
                    onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                    placeholder="%"
                    data-testid="input-kpi-unit"
                  />
                </div>
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
                  <Label htmlFor="kpi-current">Current Value</Label>
                  <Input
                    id="kpi-current"
                    type="number"
                    step="0.01"
                    value={kpiForm.currentValue}
                    onChange={(e) => setKpiForm({ ...kpiForm, currentValue: e.target.value })}
                    placeholder="Enter current value"
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

              <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kpi-tracking">Tracking Period (days)</Label>
                  <Input
                    id="kpi-tracking"
                    type="number"
                    value={kpiForm.trackingPeriod}
                    onChange={(e) => setKpiForm({ ...kpiForm, trackingPeriod: e.target.value })}
                    placeholder="30"
                    data-testid="input-kpi-tracking"
                  />
                </div>
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
    </div>
  );
}

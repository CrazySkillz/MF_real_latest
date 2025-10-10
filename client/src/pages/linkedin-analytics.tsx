import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, Clock, Plus } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');
  const [selectedMetric, setSelectedMetric] = useState<string>('impressions');
  const campaignId = params?.id;

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

  // Fetch campaign KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'kpis'],
    enabled: !!campaignId,
  });

  // Fetch campaign Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'benchmarks'],
    enabled: !!campaignId,
  });

  const formatNumber = (num: number) => num?.toLocaleString() || '0';
  const formatCurrency = (num: number) => `$${num?.toFixed(2) || '0.00'}`;
  const formatPercentage = (num: number) => `${num?.toFixed(2) || '0.00'}%`;

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
                {/* Aggregated Metrics Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                      <Eye className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(sessionData ? aggregated?.totalImpressions : campaign?.impressions || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                      <MousePointerClick className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(sessionData ? aggregated?.totalClicks : campaign?.clicks || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                      <DollarSign className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(sessionData ? aggregated?.totalSpend : campaign?.spend || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatPercentage(sessionData ? aggregated?.avgCTR : campaign?.ctr || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average CPC</CardTitle>
                      <DollarSign className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(sessionData ? aggregated?.avgCPC : campaign?.cpc || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                      <Target className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(sessionData ? aggregated?.totalConversions : campaign?.conversions || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Campaign Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Breakdown</CardTitle>
                    <CardDescription>
                      {sessionData ? 'Metrics by imported campaign' : 'Campaign performance metrics'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sessionData && metrics && metrics.length > 0 ? (
                        // Show LinkedIn imported campaigns
                        Object.values(
                          metrics.reduce((acc: any, metric: any) => {
                            if (!acc[metric.campaignUrn]) {
                              acc[metric.campaignUrn] = {
                                name: metric.campaignName,
                                status: metric.campaignStatus,
                                metrics: {}
                              };
                            }
                            acc[metric.campaignUrn].metrics[metric.metricKey] = parseFloat(metric.metricValue);
                            return acc;
                          }, {})
                        ).map((linkedInCampaign: any, index: number) => (
                          <div key={index} className="border-b pb-4 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-slate-900 dark:text-white">{linkedInCampaign.name}</h4>
                              <span className={`text-xs px-2 py-1 rounded ${
                                linkedInCampaign.status === 'active' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {linkedInCampaign.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              {linkedInCampaign.metrics.impressions && (
                                <div>
                                  <span className="text-slate-500">Impressions:</span>
                                  <span className="ml-2 font-medium">{formatNumber(linkedInCampaign.metrics.impressions)}</span>
                                </div>
                              )}
                              {linkedInCampaign.metrics.clicks && (
                                <div>
                                  <span className="text-slate-500">Clicks:</span>
                                  <span className="ml-2 font-medium">{formatNumber(linkedInCampaign.metrics.clicks)}</span>
                                </div>
                              )}
                              {linkedInCampaign.metrics.spend && (
                                <div>
                                  <span className="text-slate-500">Spend:</span>
                                  <span className="ml-2 font-medium">{formatCurrency(linkedInCampaign.metrics.spend)}</span>
                                </div>
                              )}
                              {linkedInCampaign.metrics.ctr && (
                                <div>
                                  <span className="text-slate-500">CTR:</span>
                                  <span className="ml-2 font-medium">{formatPercentage(linkedInCampaign.metrics.ctr)}</span>
                                </div>
                              )}
                              {linkedInCampaign.metrics.conversions && (
                                <div>
                                  <span className="text-slate-500">Conversions:</span>
                                  <span className="ml-2 font-medium">{formatNumber(linkedInCampaign.metrics.conversions)}</span>
                                </div>
                              )}
                              {linkedInCampaign.metrics.cpc && (
                                <div>
                                  <span className="text-slate-500">CPC:</span>
                                  <span className="ml-2 font-medium">{formatCurrency(linkedInCampaign.metrics.cpc)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : campaign ? (
                        // Show this campaign's data
                        <div className="border-b pb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-slate-900 dark:text-white">{campaign.name}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${
                              campaign.status === 'active' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {campaign.status || 'active'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {campaign.impressions !== undefined && (
                              <div>
                                <span className="text-slate-500">Impressions:</span>
                                <span className="ml-2 font-medium">{formatNumber(campaign.impressions)}</span>
                              </div>
                            )}
                            {campaign.clicks !== undefined && (
                              <div>
                                <span className="text-slate-500">Clicks:</span>
                                <span className="ml-2 font-medium">{formatNumber(campaign.clicks)}</span>
                              </div>
                            )}
                            {campaign.spend !== undefined && (
                              <div>
                                <span className="text-slate-500">Spend:</span>
                                <span className="ml-2 font-medium">{formatCurrency(campaign.spend)}</span>
                              </div>
                            )}
                            {campaign.ctr !== undefined && (
                              <div>
                                <span className="text-slate-500">CTR:</span>
                                <span className="ml-2 font-medium">{formatPercentage(campaign.ctr)}</span>
                              </div>
                            )}
                            {campaign.conversions !== undefined && (
                              <div>
                                <span className="text-slate-500">Conversions:</span>
                                <span className="ml-2 font-medium">{formatNumber(campaign.conversions)}</span>
                              </div>
                            )}
                            {campaign.cpc !== undefined && (
                              <div>
                                <span className="text-slate-500">CPC:</span>
                                <span className="ml-2 font-medium">{formatCurrency(campaign.cpc)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-4">No metrics data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                          onClick={() => setLocation(`/campaigns/${campaignId}`)}
                          data-testid="button-create-kpi"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Go to Campaign to Create KPI
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
    </div>
  );
}

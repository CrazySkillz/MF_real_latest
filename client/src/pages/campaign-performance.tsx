import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, Users, Target, DollarSign, Clock, FlaskConical } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiLinkedin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
}

export default function CampaignPerformanceSummary() {
  const [, params] = useRoute("/campaigns/:id/performance");
  const campaignId = params?.id;
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch KPIs
  const { data: kpis = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpis`],
    enabled: !!campaignId,
  });

  // Fetch Benchmarks
  const { data: benchmarks = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/benchmarks`],
    enabled: !!campaignId,
  });

  // Fetch LinkedIn metrics
  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Fetch Custom Integration data
  const { data: customIntegration } = useQuery<any>({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Fetch real-time metric changes
  const { data: metricChanges } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaignId}/changes`],
    enabled: !!campaignId,
  });

  // Derive API params from unified time range
  const comparisonType = timeRange === '24h' ? 'yesterday' : timeRange === '7d' ? 'last_week' : 'last_month';
  const trendPeriod = timeRange === '24h' ? 'daily' : timeRange === '7d' ? 'weekly' : 'monthly';

  // Fetch comparison data — keepPreviousData prevents UI flash when switching filters
  const { data: comparisonData } = useQuery<{
    current: any | null;
    previous: any | null;
  }>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=${comparisonType}`],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
  });

  // Fetch trend snapshots for time-series analysis
  const { data: trendSnapshots = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots?period=${trendPeriod}`],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
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

  // Demo mode mock data
  const demoLinkedin = demoMode ? {
    impressions: 12500, clicks: 890, engagement: 1240, spend: 4250,
    conversions: 45, leads: 18, reach: 8200, engagements: 1240,
  } : null;
  const demoCI = demoMode ? {
    metrics: {
      impressions: 8500, clicks: 420, engagements: 580, spend: '1800',
      conversions: 28, leads: 12, pageviews: 15200, sessions: 3400,
      reach: 0,
    }
  } : null;
  const demoKpis = demoMode ? [
    { name: 'Monthly Conversions', metric: 'conversions', currentValue: 73, targetValue: 100, unit: '', alertsEnabled: false, priority: 'high' },
    { name: 'Cost Per Acquisition', metric: 'cpa', currentValue: 82.88, targetValue: 60, unit: '$', alertsEnabled: true, priority: 'high' },
    { name: 'Click-Through Rate', metric: 'ctr', currentValue: 4.2, targetValue: 3.5, unit: '%', alertsEnabled: false, priority: 'medium' },
  ] : null;
  const demoBenchmarks = demoMode ? [
    { metricName: 'CTR', currentValue: 4.2, industryAverage: 2.8, benchmarkValue: 2.8, category: 'Engagement' },
    { metricName: 'CPC', currentValue: 6.85, industryAverage: 8.50, benchmarkValue: 8.50, category: 'Cost' },
  ] : null;

  const effectiveLinkedin = demoLinkedin || linkedinMetrics;
  const effectiveCI = demoCI || customIntegration;
  const effectiveKpis = demoKpis || kpis;
  const effectiveBenchmarks = demoBenchmarks || benchmarks;

  // Helper function to safely parse numbers
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  // Calculate aggregated metrics
  const linkedinImpressions = parseNum(effectiveLinkedin?.impressions);
  const linkedinClicks = parseNum(effectiveLinkedin?.clicks);
  const linkedinEngagements = parseNum(effectiveLinkedin?.engagement);
  const linkedinSpend = parseNum(effectiveLinkedin?.spend);
  const linkedinConversions = parseNum(effectiveLinkedin?.conversions);
  const linkedinLeads = parseNum(effectiveLinkedin?.leads);

  // Custom Integration advertising metrics
  const ciImpressions = parseNum(effectiveCI?.metrics?.impressions);
  const ciClicks = parseNum(effectiveCI?.metrics?.clicks);
  const ciEngagements = parseNum(effectiveCI?.metrics?.engagements);
  const ciSpend = parseNum(effectiveCI?.metrics?.spend);
  const ciConversions = parseNum(effectiveCI?.metrics?.conversions);
  const ciLeads = parseNum(effectiveCI?.metrics?.leads);

  // Custom Integration website analytics (for funnel visualization)
  const ciPageviews = parseNum(effectiveCI?.metrics?.pageviews);
  const ciSessions = parseNum(effectiveCI?.metrics?.sessions);

  // Aggregate metrics - matching Executive Summary calculation
  // Total Impressions = Advertising Impressions + Website Pageviews (full funnel view)
  const advertisingImpressions = linkedinImpressions + ciImpressions;
  const totalImpressions = advertisingImpressions + ciPageviews;
  // Total Engagements = LinkedIn Clicks + LinkedIn Engagements + CI Clicks + CI Engagements + Website Sessions
  const advertisingEngagements = linkedinClicks + linkedinEngagements + ciClicks + ciEngagements;
  const totalEngagements = advertisingEngagements + ciSessions;
  const totalClicks = linkedinClicks + ciClicks;
  const totalConversions = linkedinConversions + ciConversions;
  const totalLeads = linkedinLeads + ciLeads;
  const totalSpend = linkedinSpend + ciSpend;

  // Calculate campaign health score (including both KPIs and Benchmarks)
  const kpisAboveTarget = effectiveKpis.filter((kpi: any) => {
    const current = parseNum(kpi.currentValue);
    const target = parseNum(kpi.targetValue);
    return current >= target;
  }).length;

  const benchmarksAboveTarget = effectiveBenchmarks.filter((benchmark: any) => {
    const current = parseNum(benchmark.currentValue);
    const industry = parseNum(benchmark.industryAverage || benchmark.benchmarkValue);
    return current >= industry;
  }).length;

  const totalMetrics = effectiveKpis.length + effectiveBenchmarks.length;
  const totalAboveTarget = kpisAboveTarget + benchmarksAboveTarget;
  const healthScore = totalMetrics > 0 ? Math.round((totalAboveTarget / totalMetrics) * 100) : 0;

  const getHealthStatus = () => {
    if (healthScore >= 80) return { label: "Excellent", color: "bg-green-500", icon: CheckCircle2 };
    if (healthScore >= 60) return { label: "Good", color: "bg-blue-500", icon: Activity };
    if (healthScore >= 40) return { label: "Needs Attention", color: "bg-yellow-500", icon: AlertTriangle };
    return { label: "Critical", color: "bg-red-500", icon: AlertTriangle };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  // Get top priority action
  const getPriorityAction = () => {
    const underperformingKPIs = effectiveKpis.filter((kpi: any) => {
      const current = parseNum(kpi.currentValue);
      const target = parseNum(kpi.targetValue);
      return current < target;
    }).sort((a, b) => {
      const gapA = parseNum(b.targetValue) - parseNum(b.currentValue);
      const gapB = parseNum(a.targetValue) - parseNum(a.currentValue);
      return gapB - gapA;
    });

    if (underperformingKPIs.length > 0) {
      const topKPI = underperformingKPIs[0];
      const formatValue = (value: any, unit: string) => {
        if (unit === '$') return `$${parseNum(value).toFixed(2)}`;
        if (unit === '%') return `${parseNum(value).toFixed(2)}%`;
        return `${value}${unit}`;
      };
      
      return {
        type: 'kpi',
        name: topKPI.name,
        metric: topKPI.metric || topKPI.name,
        currentValue: formatValue(topKPI.currentValue, topKPI.unit),
        targetValue: formatValue(topKPI.targetValue, topKPI.unit),
        action: 'Improve'
      };
    }

    const underperformingBenchmarks = effectiveBenchmarks.filter((b: any) => {
      const current = parseNum(b.currentValue);
      const industry = parseNum(b.industryAverage);
      return current < industry;
    });

    if (underperformingBenchmarks.length > 0) {
      return {
        type: 'benchmark',
        name: underperformingBenchmarks[0].metricName,
        action: 'Address',
        message: 'below industry average'
      };
    }

    return {
      type: 'success',
      message: 'Maintain current performance - all metrics on track'
    };
  };

  // Calculate what's changed: current connected-source metrics vs historical data
  // "Current" = real-time aggregated data from connected sources (updates when LinkedIn/CI data changes)
  // "Previous" = recorded data from the selected comparison period (yesterday/last week/last month)
  const getChanges = () => {
    const baseline = comparisonData?.previous || comparisonData?.current;
    if (!baseline) {
      return { changes: [], baselineTimestamp: null };
    }

    const changes: { metric: string; current: number; previous: number; change: number; pctChange: number; direction: string; isCurrency?: boolean }[] = [];

    const addChange = (metric: string, currVal: number, prevVal: number, isCurrency = false) => {
      const change = currVal - prevVal;
      const pctChange = prevVal > 0 ? ((change / prevVal) * 100) : (currVal > 0 ? 100 : 0);
      if (Math.abs(change) > 0 || currVal > 0 || prevVal > 0) {
        changes.push({
          metric,
          current: currVal,
          previous: prevVal,
          change,
          pctChange,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          isCurrency,
        });
      }
    };

    // Compare live aggregated metrics against the historical snapshot
    addChange("Impressions", totalImpressions, parseNum(baseline.totalImpressions));
    addChange("Clicks", totalClicks, parseNum(baseline.totalClicks));
    addChange("Engagements", totalEngagements, parseNum(baseline.totalEngagements));
    addChange("Conversions", totalConversions, parseNum(baseline.totalConversions));
    addChange("Leads", totalLeads, parseNum(baseline.totalLeads));
    addChange("Spend", totalSpend, parseNum(baseline.totalSpend), true);

    return {
      changes,
      baselineTimestamp: baseline.recordedAt,
    };
  };

  const changeData = getChanges();

  // Data source status
  const dataSources = [
    { name: "LinkedIn Ads", connected: !!(effectiveLinkedin), icon: SiLinkedin },
    { name: "Custom Integration", connected: !!(effectiveCI), icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Performance Summary
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {campaign.name} - Comprehensive overview & insights
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant={demoMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoMode(!demoMode)}
                  className="shrink-0"
                >
                  <FlaskConical className="w-4 h-4 mr-1" />
                  {demoMode ? "Demo On" : "Demo Data"}
                </Button>

              </div>
            </div>
          </div>

          {demoMode && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
              Showing demo data for testing. Toggle off to see real platform data.
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="health">Campaign Health</TabsTrigger>
              <TabsTrigger value="changes">What's Changed</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Campaign Health Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <HealthIcon className="w-5 h-5" />
                    <span>Campaign Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {totalMetrics === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-slate-600 dark:text-slate-400">Set up KPIs and Benchmarks to see your campaign health score.</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full ${healthStatus.color} flex items-center justify-center text-white text-2xl font-bold`}>
                        {healthScore}%
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{healthStatus.label}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {totalAboveTarget} of {totalMetrics} metrics above target
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {kpisAboveTarget}/{effectiveKpis.length} KPIs • {benchmarksAboveTarget}/{effectiveBenchmarks.length} Benchmarks
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Priority Action */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Top Priority Action</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const priority = getPriorityAction();
                    
                    if (priority.type === 'kpi') {
                      return (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                KPI Below Target
                              </Badge>
                            </div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                              {priority.name}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              KPI: {priority.metric}
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Current</div>
                              <div className="text-xl font-bold text-red-600 dark:text-red-400">{priority.currentValue}</div>
                            </div>
                            <div className="text-2xl text-slate-300 dark:text-slate-600">→</div>
                            <div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Target</div>
                              <div className="text-xl font-bold text-green-600 dark:text-green-400">{priority.targetValue}</div>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (priority.type === 'benchmark') {
                      return (
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                            Benchmark
                          </Badge>
                          <p className="text-slate-900 dark:text-white font-medium">
                            {priority.action} "{priority.name}" - {priority.message}
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-green-700 dark:text-green-400 font-medium">{priority.message}</p>
                      );
                    }
                  })()}
                </CardContent>
              </Card>

              {/* Aggregated Metrics Snapshot */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Ad: {advertisingImpressions.toLocaleString()} | Web: {ciPageviews.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Engagements</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalEngagements.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Ad: {advertisingEngagements.toLocaleString()} | Web: {ciSessions.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalConversions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      LinkedIn: {linkedinConversions.toLocaleString()} | CI: {ciConversions.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      LinkedIn: ${linkedinSpend.toLocaleString()} | CI: ${ciSpend.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Campaign Health Tab */}
            <TabsContent value="health" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Health Summary</CardTitle>
                  <CardDescription>Campaign health overview</CardDescription>
                </CardHeader>
                <CardContent>
                  {totalMetrics === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">No KPIs or Benchmarks configured</p>
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                        Set up KPIs and Benchmarks on the campaign page to see health tracking here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-l-4 pl-4 py-2" style={{ borderColor: healthScore >= 70 ? '#22c55e' : healthScore >= 50 ? '#eab308' : '#ef4444' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-slate-900 dark:text-white">Overall Health Score</span>
                            <Badge variant={healthScore >= 70 ? "default" : "destructive"}>
                              {healthStatus.label}
                            </Badge>
                          </div>
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">{healthScore}%</span>
                        </div>
                      </div>

                      {effectiveKpis.length > 0 && (
                        <div className="border-l-4 pl-4 py-2" style={{ borderColor: kpisAboveTarget >= effectiveKpis.length / 2 ? '#22c55e' : '#ef4444' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-slate-900 dark:text-white">KPIs Above Target</span>
                              <Badge variant={kpisAboveTarget >= effectiveKpis.length / 2 ? "default" : "destructive"}>
                                {kpisAboveTarget >= effectiveKpis.length / 2 ? "Majority On Track" : "Needs Attention"}
                              </Badge>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{kpisAboveTarget} of {effectiveKpis.length}</span>
                          </div>
                        </div>
                      )}

                      {effectiveBenchmarks.length > 0 && (
                        <div className="border-l-4 pl-4 py-2" style={{ borderColor: benchmarksAboveTarget >= effectiveBenchmarks.length / 2 ? '#22c55e' : '#ef4444' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-slate-900 dark:text-white">Benchmarks Above Industry Average</span>
                              <Badge variant={benchmarksAboveTarget >= effectiveBenchmarks.length / 2 ? "default" : "destructive"}>
                                {benchmarksAboveTarget >= effectiveBenchmarks.length / 2 ? "Above Average" : "Below Average"}
                              </Badge>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{benchmarksAboveTarget} of {effectiveBenchmarks.length}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* All KPIs */}
              {effectiveKpis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Performance Indicators (KPIs)</CardTitle>
                    <CardDescription>All campaign KPIs and their targets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {effectiveKpis.map((kpi: any, idx: number) => {
                        const current = parseNum(kpi.currentValue);
                        const target = parseNum(kpi.targetValue);
                        const isAboveTarget = current >= target;
                        const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
                        
                        return (
                          <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: isAboveTarget ? '#22c55e' : '#ef4444' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-slate-900 dark:text-white">{kpi.name}</span>
                                <Badge variant={isAboveTarget ? "default" : "destructive"}>
                                  {isAboveTarget ? "On Track" : "Below Target"}
                                </Badge>
                              </div>
                              <span className="text-sm text-slate-500 dark:text-slate-400">{percentage}% of target</span>
                            </div>
                            <div className="flex items-center space-x-6 text-sm">
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Current: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {kpi.unit === '$' ? `$${current.toFixed(2)}` : kpi.unit === '%' ? `${current.toFixed(2)}%` : `${kpi.currentValue}${kpi.unit}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Target: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {kpi.unit === '$' ? `$${target.toFixed(2)}` : kpi.unit === '%' ? `${target.toFixed(2)}%` : `${kpi.targetValue}${kpi.unit}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All Benchmarks */}
              {effectiveBenchmarks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Industry Benchmarks</CardTitle>
                    <CardDescription>Performance vs industry averages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {effectiveBenchmarks.map((benchmark: any, idx: number) => {
                        const current = parseNum(benchmark.currentValue);
                        const target = parseNum(benchmark.benchmarkValue);
                        const isAboveTarget = current >= target;
                        const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
                        
                        return (
                          <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: isAboveTarget ? '#22c55e' : '#ef4444' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-slate-900 dark:text-white">{benchmark.name}</span>
                                <Badge variant={isAboveTarget ? "default" : "destructive"}>
                                  {isAboveTarget ? "Above Benchmark" : "Below Benchmark"}
                                </Badge>
                              </div>
                              <span className="text-sm text-slate-500 dark:text-slate-400">{percentage}% of target</span>
                            </div>
                            <div className="flex items-center space-x-6 text-sm">
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Current: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {benchmark.unit === '$' ? `$${current.toFixed(2)}` : benchmark.unit === '%' ? `${current.toFixed(2)}%` : `${benchmark.currentValue}${benchmark.unit}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Target: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {benchmark.unit === '$' ? `$${target.toFixed(2)}` : benchmark.unit === '%' ? `${target.toFixed(2)}%` : `${benchmark.benchmarkValue}${benchmark.unit}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Source Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Sources</CardTitle>
                  <CardDescription>Connected platforms feeding this summary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {dataSources.map((source) => {
                      const Icon = source.icon;
                      return (
                        <div key={source.name} className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{source.name}</span>
                          <Badge variant={source.connected ? "default" : "secondary"}>
                            {source.connected ? "Connected" : "Not Connected"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* What's Changed Tab */}
            <TabsContent value="changes" className="space-y-6">
              {/* Delta Cards */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <div>
                        <CardTitle>What's Changed</CardTitle>
                        <CardDescription className="mt-1.5">
                          How your connected platform metrics have changed
                        </CardDescription>
                      </div>
                    </div>
                    <Select value={timeRange} onValueChange={(value: '24h' | '7d' | '30d') => setTimeRange(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {changeData.changes.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">No historical data available yet</p>
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                        Data is recorded automatically as your connected platforms sync.
                        Changes will appear here once enough data has been collected to compare.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {changeData.baselineTimestamp && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Current values compared to {new Date(changeData.baselineTimestamp).toLocaleDateString()}
                        </p>
                      )}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {changeData.changes.map((item, idx) => {
                          const isUp = item.direction === "up";
                          const isDown = item.direction === "down";
                          const isFlat = item.direction === "flat";
                          // For spend, down is good (green). For everything else, up is good.
                          const isPositive = item.isCurrency ? isDown : isUp;
                          const isNegative = item.isCurrency ? isUp : isDown;

                          return (
                            <div key={idx} className={`p-4 rounded-lg border transition-all duration-300 ease-in-out ${
                              isPositive ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                              isNegative ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                              'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                            }`}>
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{item.metric}</div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {item.isCurrency ? `$${item.current.toLocaleString()}` : item.current.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center mt-2 space-x-2">
                                {isUp && <TrendingUp className={`w-4 h-4 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />}
                                {isDown && <TrendingDown className={`w-4 h-4 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />}
                                <span className={`text-sm font-semibold ${
                                  isPositive ? 'text-green-700 dark:text-green-400' :
                                  isNegative ? 'text-red-700 dark:text-red-400' :
                                  'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {isFlat ? 'No change' :
                                    `${isUp ? '+' : ''}${item.isCurrency ? '$' + item.change.toLocaleString() : item.change.toLocaleString()} (${isUp ? '+' : ''}${item.pctChange.toFixed(1)}%)`
                                  }
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                Previous: {item.isCurrency ? `$${item.previous.toLocaleString()}` : item.previous.toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trend Charts — only show when metrics actually changed between data points */}
              {(() => {
                const allPoints = trendSnapshots.map((snapshot: any) => {
                  const d = new Date(snapshot.recordedAt);
                  return {
                    date: d.toLocaleString('en-US', { month: 'short', day: 'numeric', ...(trendPeriod === 'daily' ? { hour: 'numeric', minute: '2-digit' } : {}) }),
                    totalImpressions: parseNum(snapshot.totalImpressions),
                    totalClicks: parseNum(snapshot.totalClicks),
                    totalConversions: parseNum(snapshot.totalConversions),
                    totalSpend: parseNum(snapshot.totalSpend),
                  };
                });
                const chartData = allPoints.filter((pt, i) => {
                  if (i === 0) return true;
                  const prev = allPoints[i - 1];
                  return pt.totalImpressions !== prev.totalImpressions
                    || pt.totalClicks !== prev.totalClicks
                    || pt.totalConversions !== prev.totalConversions
                    || pt.totalSpend !== prev.totalSpend;
                });
                if (chartData.length < 2) return null;
                const xAxisInterval = chartData.length <= 8 ? 0 : Math.ceil(chartData.length / 8) - 1;
                return (
              <Card>
                  <CardHeader>
                    <CardTitle>Metric Trends</CardTitle>
                    <CardDescription className="mt-1.5">How your metrics have changed over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {

                      return (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Impressions</h4>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                  <XAxis dataKey="date" className="text-xs" interval={xAxisInterval} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs" tickFormatter={(v) => v.toLocaleString()} />
                                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0' }} formatter={(v: any) => v.toLocaleString()} />
                                  <Line type="monotone" dataKey="totalImpressions" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Clicks</h4>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                  <XAxis dataKey="date" className="text-xs" interval={xAxisInterval} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs" />
                                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0' }} formatter={(v: any) => v.toLocaleString()} />
                                  <Line type="monotone" dataKey="totalClicks" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Conversions</h4>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                  <XAxis dataKey="date" className="text-xs" interval={xAxisInterval} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs" />
                                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0' }} formatter={(v: any) => v.toLocaleString()} />
                                  <Line type="monotone" dataKey="totalConversions" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Spend</h4>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                  <XAxis dataKey="date" className="text-xs" interval={xAxisInterval} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0' }} formatter={(v: any) => `$${parseFloat(v).toLocaleString()}`} />
                                  <Line type="monotone" dataKey="totalSpend" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
                );
              })()}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data-Driven Insights & Recommendations</CardTitle>
                  <CardDescription>Performance analysis based on {campaign.name} actual metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Priority Action */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Top Priority Action
                      </h4>
                      {(() => {
                        const priority = getPriorityAction();
                        
                        if (priority.type === 'kpi') {
                          return (
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              {priority.action} {priority.name} (Metric: {priority.metric}) - currently {priority.currentValue}, target {priority.targetValue}
                            </p>
                          );
                        } else if (priority.type === 'benchmark') {
                          return (
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              {priority.action} "{priority.name}" - {priority.message}
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-sm text-blue-800 dark:text-blue-200">{priority.message}</p>
                          );
                        }
                      })()}
                    </div>
                    
                    {/* Performance Analysis */}
                    {(() => {
                      const insights = [];
                      
                      // Calculate actual metrics for insights
                      const ctr = totalClicks > 0 && advertisingImpressions > 0 
                        ? (totalClicks / advertisingImpressions * 100) 
                        : 0;
                      const cvr = totalConversions > 0 && totalClicks > 0 
                        ? (totalConversions / totalClicks * 100) 
                        : 0;
                      const cpc = totalSpend > 0 && totalClicks > 0 
                        ? totalSpend / totalClicks 
                        : 0;
                      const cpa = totalSpend > 0 && totalConversions > 0 
                        ? totalSpend / totalConversions 
                        : 0;
                      
                      // Platform comparison insights - always analyze all connected sources
                      const linkedinCVR = linkedinConversions > 0 && linkedinClicks > 0 
                        ? (linkedinConversions / linkedinClicks * 100) 
                        : 0;
                      const ciCVR = ciConversions > 0 && ciClicks > 0 
                        ? (ciConversions / ciClicks * 100) 
                        : 0;
                      const linkedinCPA = linkedinSpend > 0 && linkedinConversions > 0
                        ? linkedinSpend / linkedinConversions
                        : 0;
                      const ciCPA = ciSpend > 0 && ciConversions > 0
                        ? ciSpend / ciConversions
                        : 0;
                      
                      // Both platforms active - compare performance
                      if (linkedinSpend > 0 && ciSpend > 0) {
                        if (linkedinCVR > ciCVR * 1.5 && linkedinCVR > 0) {
                          insights.push({
                            type: 'success',
                            title: 'LinkedIn Outperforming',
                            message: `LinkedIn: ${linkedinCVR.toFixed(2)}% CVR, $${linkedinCPA.toFixed(2)} CPA vs Custom Integration: ${ciCVR.toFixed(2)}% CVR, $${ciCPA > 0 ? ciCPA.toFixed(2) : '0.00'} CPA. LinkedIn showing superior efficiency.`
                          });
                        } else if (ciCVR > linkedinCVR * 1.5 && ciCVR > 0) {
                          insights.push({
                            type: 'success',
                            title: 'Custom Integration Outperforming',
                            message: `Custom Integration: ${ciCVR.toFixed(2)}% CVR, $${ciCPA.toFixed(2)} CPA vs LinkedIn: ${linkedinCVR.toFixed(2)}% CVR, $${linkedinCPA > 0 ? linkedinCPA.toFixed(2) : '0.00'} CPA. Custom channels driving superior results.`
                          });
                        } else {
                          // Similar performance
                          insights.push({
                            type: 'info',
                            title: 'Balanced Platform Performance',
                            message: `LinkedIn: ${linkedinCVR.toFixed(2)}% CVR from ${linkedinClicks.toLocaleString()} clicks. Custom Integration: ${ciCVR.toFixed(2)}% CVR from ${ciClicks.toLocaleString()} clicks. Both platforms contributing effectively.`
                          });
                        }
                      } 
                      // Only LinkedIn active
                      else if (linkedinSpend > 0) {
                        insights.push({
                          type: 'info',
                          title: 'LinkedIn Performance',
                          message: `LinkedIn driving ${linkedinConversions.toLocaleString()} conversions from ${linkedinClicks.toLocaleString()} clicks (${linkedinCVR.toFixed(2)}% CVR). $${linkedinSpend.toLocaleString()} spent${linkedinCPA > 0 ? ` at $${linkedinCPA.toFixed(2)} CPA` : ''}.`
                        });
                      }
                      // Only Custom Integration active
                      else if (ciSpend > 0) {
                        insights.push({
                          type: 'info',
                          title: 'Custom Integration Performance',
                          message: `Custom Integration driving ${ciConversions.toLocaleString()} conversions from ${ciClicks.toLocaleString()} clicks (${ciCVR.toFixed(2)}% CVR). $${ciSpend.toLocaleString()} spent${ciCPA > 0 ? ` at $${ciCPA.toFixed(2)} CPA` : ''}.`
                        });
                      }
                      
                      // CTR analysis
                      if (ctr > 0) {
                        if (ctr < 1) {
                          insights.push({
                            type: 'warning',
                            title: 'Low Click-Through Rate',
                            message: `Current CTR is ${ctr.toFixed(2)}%. Consider testing new ad creative, headlines, or targeting to improve engagement. Industry benchmarks typically range from 1-3%.`
                          });
                        } else if (ctr >= 2) {
                          insights.push({
                            type: 'success',
                            title: 'Strong Click-Through Rate',
                            message: `Achieving ${ctr.toFixed(2)}% CTR from ${advertisingImpressions.toLocaleString()} impressions. Your ads are resonating well with the target audience.`
                          });
                        }
                      }
                      
                      // Conversion efficiency
                      if (cvr > 0) {
                        if (cvr >= 5) {
                          insights.push({
                            type: 'success',
                            title: 'Excellent Conversion Rate',
                            message: `${cvr.toFixed(2)}% of clicks convert. This indicates strong ad-to-landing page alignment and quality traffic from ${totalClicks.toLocaleString()} total clicks.`
                          });
                        } else if (cvr < 2) {
                          insights.push({
                            type: 'warning',
                            title: 'Conversion Rate Opportunity',
                            message: `${cvr.toFixed(2)}% conversion rate suggests landing page optimization needed. Review user journey from ${totalClicks.toLocaleString()} clicks to improve ${totalConversions.toLocaleString()} conversions.`
                          });
                        }
                      }
                      
                      // Cost efficiency
                      if (cpa > 0 && totalConversions > 0) {
                        insights.push({
                          type: 'info',
                          title: 'Cost Per Acquisition',
                          message: `Spending $${cpa.toFixed(2)} per conversion from $${totalSpend.toLocaleString()} total spend. ${totalConversions.toLocaleString()} conversions achieved across all platforms.`
                        });
                      }
                      
                      // Budget utilization - always show breakdown of all sources
                      if (totalSpend > 0) {
                        const linkedinPct = totalSpend > 0 ? (linkedinSpend / totalSpend * 100) : 0;
                        const ciPct = totalSpend > 0 ? (ciSpend / totalSpend * 100) : 0;
                        
                        const sources = [];
                        if (linkedinSpend > 0) sources.push(`LinkedIn: $${linkedinSpend.toLocaleString()} (${linkedinPct.toFixed(1)}%)`);
                        if (ciSpend > 0) sources.push(`Custom Integration: $${ciSpend.toLocaleString()} (${ciPct.toFixed(1)}%)`);
                        
                        if (sources.length > 0) {
                          insights.push({
                            type: 'info',
                            title: 'Budget Allocation',
                            message: `${sources.join(', ')}. Total spend across all platforms: $${totalSpend.toLocaleString()}.`
                          });
                        }
                      }
                      
                      // Engagement analysis - account for all sources
                      if (totalEngagements > 0) {
                        if (ciSessions > 0 && advertisingEngagements > 0) {
                          // Both ad and web engagement
                          const webContribution = totalEngagements > 0 ? (ciSessions / totalEngagements * 100) : 0;
                          insights.push({
                            type: 'info',
                            title: 'Multi-Channel Engagement',
                            message: `Total engagements: ${totalEngagements.toLocaleString()} from ${advertisingEngagements.toLocaleString()} ad engagements (LinkedIn + CI) and ${ciSessions.toLocaleString()} website sessions (${webContribution.toFixed(1)}% from website traffic).`
                          });
                        } else if (advertisingEngagements > 0 && ciSessions === 0) {
                          // Only ad engagement
                          insights.push({
                            type: 'info',
                            title: 'Advertising Engagement',
                            message: `${advertisingEngagements.toLocaleString()} total ad engagements from LinkedIn and Custom Integration advertising campaigns.`
                          });
                        } else if (ciSessions > 0 && advertisingEngagements === 0) {
                          // Only web sessions
                          insights.push({
                            type: 'info',
                            title: 'Website Traffic',
                            message: `${ciSessions.toLocaleString()} website sessions tracked through Custom Integration analytics (no advertising engagement data available).`
                          });
                        }
                      }
                      
                      // Health score context
                      if (healthScore >= 80) {
                        insights.push({
                          type: 'success',
                          title: 'Campaign Health Excellent',
                          message: `${healthScore}% health score with ${totalAboveTarget} of ${totalMetrics} metrics meeting targets. Campaign performing above expectations.`
                        });
                      } else if (healthScore < 60) {
                        insights.push({
                          type: 'warning',
                          title: 'Campaign Requires Attention',
                          message: `${healthScore}% health score - only ${totalAboveTarget} of ${totalMetrics} metrics meeting targets. Focus on underperforming KPIs to improve results.`
                        });
                      }
                      
                      // If no insights generated, show data summary
                      if (insights.length === 0) {
                        insights.push({
                          type: 'info',
                          title: 'Campaign Summary',
                          message: `Tracking ${totalImpressions.toLocaleString()} total impressions, ${totalEngagements.toLocaleString()} engagements, and ${totalConversions.toLocaleString()} conversions from $${totalSpend.toLocaleString()} spend across connected platforms.`
                        });
                      }
                      
                      return insights.map((insight, idx) => {
                        const bgColors: Record<string, string> = {
                          success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                          warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
                          info: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        };
                        const textColors: Record<string, string> = {
                          success: 'text-green-900 dark:text-green-100',
                          warning: 'text-yellow-900 dark:text-yellow-100',
                          info: 'text-slate-900 dark:text-slate-100'
                        };
                        const bodyColors: Record<string, string> = {
                          success: 'text-green-800 dark:text-green-200',
                          warning: 'text-yellow-800 dark:text-yellow-200',
                          info: 'text-slate-700 dark:text-slate-300'
                        };
                        
                        return (
                          <div key={idx} className={`p-4 rounded-lg border ${bgColors[insight.type]}`}>
                            <h4 className={`font-semibold mb-2 ${textColors[insight.type]}`}>{insight.title}</h4>
                            <p className={`text-sm ${bodyColors[insight.type]}`}>{insight.message}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

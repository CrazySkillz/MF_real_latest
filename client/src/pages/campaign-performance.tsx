import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, Users, Target, DollarSign, Clock } from "lucide-react";
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

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
}

export default function CampaignPerformanceSummary() {
  const [, params] = useRoute("/campaigns/:id/performance");
  const campaignId = params?.id;
  const [comparisonType, setComparisonType] = useState<'yesterday' | 'last_week' | 'last_month'>('yesterday');
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
    queryKey: [`/api/linkedin/metrics/${campaignId}`],
    enabled: !!campaignId,
  });

  // Fetch Custom Integration data
  const { data: customIntegration } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaignId}`],
    enabled: !!campaignId,
  });

  // Fetch comparison data
  const { data: comparisonData } = useQuery<{
    current: any | null;
    previous: any | null;
  }>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison`, comparisonType],
    enabled: !!campaignId,
  });

  // Fetch scheduler status to show automatic snapshot information
  const { data: schedulerStatus } = useQuery<{
    running: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    nextRun: string | null;
  }>({
    queryKey: ['/api/snapshots/scheduler'],
    refetchInterval: 60000, // Refresh every minute
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

  // Helper function to safely parse numbers
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  // Calculate aggregated metrics
  const linkedinImpressions = parseNum(linkedinMetrics?.impressions);
  const linkedinClicks = parseNum(linkedinMetrics?.clicks);
  const linkedinEngagements = parseNum(linkedinMetrics?.engagement);
  const linkedinSpend = parseNum(linkedinMetrics?.spend);
  const linkedinConversions = parseNum(linkedinMetrics?.conversions);
  const linkedinLeads = parseNum(linkedinMetrics?.leads);

  // Custom Integration advertising metrics
  const ciImpressions = parseNum(customIntegration?.metrics?.impressions);
  const ciClicks = parseNum(customIntegration?.metrics?.clicks);
  const ciEngagements = parseNum(customIntegration?.metrics?.engagements);
  const ciSpend = parseNum(customIntegration?.metrics?.spend);
  const ciConversions = parseNum(customIntegration?.metrics?.conversions);
  const ciLeads = parseNum(customIntegration?.metrics?.leads);
  
  // Custom Integration website analytics (for funnel visualization)
  const ciPageviews = parseNum(customIntegration?.metrics?.pageviews);
  const ciSessions = parseNum(customIntegration?.metrics?.sessions);

  // Aggregate metrics - matching Executive Summary calculation
  // Total Impressions = Advertising Impressions + Website Pageviews (full funnel view)
  const advertisingImpressions = linkedinImpressions + ciImpressions;
  const totalImpressions = advertisingImpressions + ciPageviews;
  const advertisingEngagements = linkedinEngagements + ciEngagements;
  const totalEngagements = advertisingEngagements + ciSessions;
  const totalClicks = linkedinClicks + ciClicks;
  const totalConversions = linkedinConversions + ciConversions;
  const totalLeads = linkedinLeads + ciLeads;
  const totalSpend = linkedinSpend + ciSpend;

  // Calculate campaign health score (including both KPIs and Benchmarks)
  const kpisAboveTarget = kpis.filter(kpi => {
    const current = parseNum(kpi.currentValue);
    const target = parseNum(kpi.targetValue);
    return current >= target;
  }).length;
  
  const benchmarksAboveTarget = benchmarks.filter(benchmark => {
    const current = parseNum(benchmark.currentValue);
    const industry = parseNum(benchmark.industryAverage);
    return current >= industry;
  }).length;
  
  const totalMetrics = kpis.length + benchmarks.length;
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
    const underperformingKPIs = kpis.filter(kpi => {
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
        currentValue: formatValue(topKPI.currentValue, topKPI.unit),
        targetValue: formatValue(topKPI.targetValue, topKPI.unit),
        action: 'Improve'
      };
    }

    const underperformingBenchmarks = benchmarks.filter(b => {
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

  // Calculate what's changed based on API comparison data
  const getChanges = () => {
    if (!comparisonData?.previous || !comparisonData?.current) {
      return { changes: [], timestamp: null };
    }

    const prev = comparisonData.previous;
    const curr = comparisonData.current;
    const changes = [];

    const impChange = parseNum(curr.totalImpressions) - parseNum(prev.totalImpressions);
    const engChange = parseNum(curr.totalEngagements) - parseNum(prev.totalEngagements);
    const clickChange = parseNum(curr.totalClicks) - parseNum(prev.totalClicks);
    const convChange = parseNum(curr.totalConversions) - parseNum(prev.totalConversions);

    if (Math.abs(impChange) > 0) {
      changes.push({
        metric: "Total Impressions",
        change: impChange,
        direction: impChange > 0 ? "up" : "down"
      });
    }
    if (Math.abs(engChange) > 0) {
      changes.push({
        metric: "Total Engagements",
        change: engChange,
        direction: engChange > 0 ? "up" : "down"
      });
    }
    if (Math.abs(clickChange) > 0) {
      changes.push({
        metric: "Total Clicks",
        change: clickChange,
        direction: clickChange > 0 ? "up" : "down"
      });
    }
    if (Math.abs(convChange) > 0) {
      changes.push({
        metric: "Total Conversions",
        change: convChange,
        direction: convChange > 0 ? "up" : "down"
      });
    }

    return { changes: changes.slice(0, 4), timestamp: prev.recordedAt };
  };

  const changeData = getChanges();
  const changes = changeData.changes;
  const snapshotTimestamp = changeData.timestamp;

  // Data source status
  const dataSources = [
    { name: "LinkedIn Ads", connected: !!linkedinMetrics, icon: SiLinkedin },
    { name: "Custom Integration", connected: !!customIntegration, icon: Activity },
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
              
              {/* Automatic Snapshot Status */}
              {schedulerStatus && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="snapshot-scheduler-status">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      Automatic Snapshots: {schedulerStatus.frequency.charAt(0).toUpperCase() + schedulerStatus.frequency.slice(1)}
                    </div>
                    {schedulerStatus.nextRun && (
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Next: {new Date(schedulerStatus.nextRun).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                        {kpisAboveTarget}/{kpis.length} KPIs • {benchmarksAboveTarget}/{benchmarks.length} Benchmarks
                      </div>
                    </div>
                  </div>
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
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                              KPI
                            </Badge>
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">
                              {priority.action} "{priority.name}"
                            </span>
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
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overall Health Score</span>
                    <span className="text-2xl font-bold">{healthScore}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">KPIs Above Target</span>
                    <Badge variant="default">{kpisAboveTarget} of {kpis.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Benchmarks Above Target</span>
                    <Badge variant="default">{benchmarksAboveTarget} of {benchmarks.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Metrics Above Target</span>
                    <Badge variant="default">{totalAboveTarget} of {totalMetrics}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={healthStatus.color}>{healthStatus.label}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* All KPIs */}
              {kpis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Performance Indicators (KPIs)</CardTitle>
                    <CardDescription>All campaign KPIs and their targets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {kpis.map((kpi, idx) => {
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
              {benchmarks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Industry Benchmarks</CardTitle>
                    <CardDescription>Performance vs industry averages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {benchmarks.map((benchmark, idx) => {
                        const current = parseNum(benchmark.currentValue);
                        const industry = parseNum(benchmark.industryAverage);
                        const isAboveIndustry = current >= industry;
                        const percentage = industry > 0 ? Math.round((current / industry) * 100) : 0;
                        
                        return (
                          <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: isAboveIndustry ? '#22c55e' : '#ef4444' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-slate-900 dark:text-white">{benchmark.metricName}</span>
                                <Badge variant={isAboveIndustry ? "default" : "destructive"}>
                                  {isAboveIndustry ? "Above Industry" : "Below Industry"}
                                </Badge>
                              </div>
                              <span className="text-sm text-slate-500 dark:text-slate-400">{percentage}% of industry avg</span>
                            </div>
                            <div className="flex items-center space-x-6 text-sm">
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Your Performance: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {benchmark.unit === '$' ? `$${current.toFixed(2)}` : benchmark.unit === '%' ? `${current.toFixed(2)}%` : `${benchmark.currentValue}${benchmark.unit}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Industry Avg: </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {benchmark.unit === '$' ? `$${industry.toFixed(2)}` : benchmark.unit === '%' ? `${industry.toFixed(2)}%` : `${benchmark.industryAverage}${benchmark.unit}`}
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
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5" />
                        <span>What's Changed</span>
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        {snapshotTimestamp ? (
                          <>Compare to: {new Date(snapshotTimestamp).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric', 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}</>
                        ) : (
                          <>No historical data available yet</>
                        )}
                      </CardDescription>
                    </div>
                    <Select 
                      value={comparisonType} 
                      onValueChange={(value) => setComparisonType(value as 'yesterday' | 'last_week' | 'last_month')}
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-comparison">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yesterday" data-testid="option-yesterday">vs. Yesterday</SelectItem>
                        <SelectItem value="last_week" data-testid="option-last-week">vs. Last Week</SelectItem>
                        <SelectItem value="last_month" data-testid="option-last-month">vs. Last Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {changes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">No changes detected yet</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Initial snapshot captured. Changes will appear here when metrics update.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {changes.map((change, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{change.metric}</span>
                          <div className="flex items-center space-x-2">
                            {change.direction === "up" ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                            <span className={`text-base font-bold ${change.direction === "up" ? "text-green-600" : "text-red-600"}`}>
                              {change.direction === "up" ? "+" : ""}{change.change.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
                              {priority.action} "{priority.name}" - currently {priority.currentValue}, target {priority.targetValue}
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

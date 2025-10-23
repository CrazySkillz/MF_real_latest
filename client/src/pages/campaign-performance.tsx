import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, Users, Target, DollarSign, Camera } from "lucide-react";
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

  // Mutation to create a metric snapshot (metrics are automatically calculated by backend)
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("Campaign ID is required");
      return apiRequest(`/api/campaigns/${campaignId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison`] });
      toast({
        title: "Snapshot Created",
        description: "Metric snapshot has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create snapshot. Please try again.",
        variant: "destructive",
      });
    },
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

  const ciPageviews = parseNum(customIntegration?.metrics?.pageviews);
  const ciSessions = parseNum(customIntegration?.metrics?.sessions);
  const ciUsers = parseNum(customIntegration?.metrics?.users);

  const totalImpressions = linkedinImpressions + ciPageviews;
  const totalEngagements = linkedinEngagements + ciSessions;
  const totalClicks = linkedinClicks;
  const totalConversions = linkedinConversions;
  const totalLeads = linkedinLeads;
  const totalSpend = linkedinSpend;

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
      return `Improve "${topKPI.name}" - currently ${topKPI.currentValue}${topKPI.unit}, target ${topKPI.targetValue}${topKPI.unit}`;
    }

    const underperformingBenchmarks = benchmarks.filter(b => {
      const current = parseNum(b.currentValue);
      const industry = parseNum(b.industryAverage);
      return current < industry;
    });

    if (underperformingBenchmarks.length > 0) {
      return `Address "${underperformingBenchmarks[0].metricName}" - below industry average`;
    }

    return "Maintain current performance - all metrics on track";
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
              <Button 
                onClick={() => createSnapshotMutation.mutate()}
                disabled={createSnapshotMutation.isPending}
                data-testid="button-create-snapshot"
                size="sm"
              >
                <Camera className="w-4 h-4 mr-2" />
                {createSnapshotMutation.isPending ? "Creating..." : "Create Snapshot"}
              </Button>
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
                  <p className="text-slate-900 dark:text-white font-medium">{getPriorityAction()}</p>
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
                    <p className="text-xs text-muted-foreground">Cross-platform reach</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Engagements</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalEngagements.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">All interactions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalConversions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Goal completions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Campaign investment</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Campaign Health Tab */}
            <TabsContent value="health" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Health Analysis</CardTitle>
                  <CardDescription>In-depth breakdown of campaign health metrics</CardDescription>
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
                  <CardTitle>Key Insights & Recommendations</CardTitle>
                  <CardDescription>AI-powered insights based on your campaign performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Priority Action</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">{getPriorityAction()}</p>
                    </div>
                    
                    {kpisAboveTarget === kpis.length && kpis.length > 0 && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Excellent Performance</h4>
                        <p className="text-sm text-green-800 dark:text-green-200">All KPIs are meeting or exceeding targets. Consider scaling your investment.</p>
                      </div>
                    )}
                    
                    {healthScore < 60 && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Attention Needed</h4>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">Campaign performance is below expectations. Review underperforming KPIs and adjust strategy.</p>
                      </div>
                    )}
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

import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, Users, MousePointerClick, Target, DollarSign } from "lucide-react";
import { SiLinkedin } from "react-icons/si";

type Campaign = {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
};

export default function CampaignPerformanceSummary() {
  const params = useParams();
  const campaignId = params.id as string;

  // Fetch campaign data
  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${campaignId}`],
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

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign not found</h2>
          <Link href="/campaigns">
            <Button variant="link" className="mt-4">Back to Campaigns</Button>
          </Link>
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

  // Calculate campaign health score
  const kpisAboveTarget = kpis.filter(kpi => {
    const current = parseNum(kpi.currentValue);
    const target = parseNum(kpi.targetValue);
    return current >= target;
  }).length;
  const healthScore = kpis.length > 0 ? Math.round((kpisAboveTarget / kpis.length) * 100) : 0;

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

  // Calculate what's changed (using localStorage for demo)
  const getChanges = () => {
    try {
      const snapshotKey = `campaign_snapshot_${campaignId}`;
      const snapshot = localStorage.getItem(snapshotKey);
      
      if (!snapshot) {
        // Store initial snapshot
        localStorage.setItem(snapshotKey, JSON.stringify({
          timestamp: new Date().toISOString(),
          impressions: totalImpressions,
          engagements: totalEngagements,
          clicks: totalClicks,
          conversions: totalConversions
        }));
        return [];
      }

      const prev = JSON.parse(snapshot);
      const changes = [];

      const impChange = totalImpressions - parseNum(prev.impressions);
      const engChange = totalEngagements - parseNum(prev.engagements);
      const clickChange = totalClicks - parseNum(prev.clicks);
      const convChange = totalConversions - parseNum(prev.conversions);

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

      return changes.slice(0, 3);
    } catch {
      return [];
    }
  };

  const changes = getChanges();

  // Data source status
  const dataSources = [
    { name: "LinkedIn Ads", connected: !!linkedinMetrics, icon: SiLinkedin },
    { name: "Custom Integration", connected: !!customIntegration, icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Performance Summary</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">{campaign.name}</p>
            </div>
          </div>
        </div>

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
                  {kpisAboveTarget} of {kpis.length} KPIs above target
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's Changed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>What's Changed</span>
            </CardTitle>
            <CardDescription>Since last snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            {changes.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No changes detected yet</p>
            ) : (
              <div className="space-y-3">
                {changes.map((change, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{change.metric}</span>
                    <div className="flex items-center space-x-2">
                      {change.direction === "up" ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-semibold ${change.direction === "up" ? "text-green-600" : "text-red-600"}`}>
                        {change.direction === "up" ? "+" : ""}{change.change.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
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
            <p className="text-slate-900 dark:text-white font-medium">{getPriorityAction()}</p>
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
      </div>
    </div>
  );
}

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
import { formatPct } from "@shared/metric-math";

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
}

type PerformanceInsight = {
  type: string;
  priority: number;
  category: string;
  title: string;
  message: string;
};

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

  // Fetch Meta analytics
  const { data: metaAnalytics } = useQuery<any>({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch GA4 metrics
  const { data: ga4Metrics } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignId,
  });

  const { data: outcomeTotals, isLoading: outcomeTotalsLoading } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "outcome-totals", "90days", demoMode ? "demo" : "live"],
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=90days${demoMode ? "&demo=1" : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Campaign not found</h2>
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
  const demoMeta = demoMode ? {
    summary: { totalImpressions: 28000, totalClicks: 1450, totalSpend: 3100, totalConversions: 62 }
  } : null;
  const demoGA4 = demoMode ? {
    metrics: { sessions: 4200, users: 2800, pageviews: 18500, conversions: 95, revenue: 12400 }
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
  const effectiveMeta = demoMeta || metaAnalytics;
  const effectiveGA4 = demoGA4 || ga4Metrics;
  const effectiveKpis = demoKpis || kpis;
  const effectiveBenchmarks = demoBenchmarks || benchmarks;
  const performanceSummary = outcomeTotals?.performanceSummary;
  const performanceSummaryPending = !!campaignId && !performanceSummary && outcomeTotalsLoading;
  const performanceSources = Array.isArray(performanceSummary?.sources) ? performanceSummary.sources : [];

  // Helper function to safely parse numbers
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };
  const formatMetricValue = (value: any, unit: string) => {
    const normalizedUnit = String(unit || '').toLowerCase();
    if (unit === '$') return `$${parseNum(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (unit === '%') {
      const rounded = Math.round(parseNum(value) * 10) / 10;
      return `${rounded.toLocaleString('en-US', {
        minimumFractionDigits: rounded === Math.floor(rounded) ? 0 : 1,
        maximumFractionDigits: 1,
      })}%`;
    }
    if (!unit || normalizedUnit === 'count') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (normalizedUnit === 'ratio') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `${parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit}`;
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

  // Meta advertising metrics
  const metaImpressions = parseNum(effectiveMeta?.summary?.totalImpressions);
  const metaClicks = parseNum(effectiveMeta?.summary?.totalClicks);
  const metaSpend = parseNum(effectiveMeta?.summary?.totalSpend);
  const metaConversions = parseNum(effectiveMeta?.summary?.totalConversions);

  // GA4 website analytics
  const ga4Sessions = parseNum(effectiveGA4?.metrics?.sessions);
  const ga4Pageviews = parseNum(effectiveGA4?.metrics?.pageviews);
  const ga4Connected = !!(effectiveGA4?.metrics);

  // Double-counting prevention: GA4 and CI both track website analytics.
  // When GA4 is connected, prefer GA4 for web metrics; otherwise use CI.
  const webPageviews = ga4Connected ? ga4Pageviews : ciPageviews;
  const webSessions = ga4Connected ? ga4Sessions : ciSessions;

  // Advertising metrics: LinkedIn + CI(ads) + Meta — no overlap
  const advertisingImpressions = linkedinImpressions + ciImpressions + metaImpressions;
  const totalImpressions = advertisingImpressions + webPageviews;
  const advertisingEngagements = linkedinClicks + linkedinEngagements + ciClicks + ciEngagements + metaClicks;
  const totalEngagements = advertisingEngagements + webSessions;
  const totalClicks = linkedinClicks + ciClicks + metaClicks;
  const totalConversions = linkedinConversions + ciConversions + metaConversions;
  const totalLeads = linkedinLeads + ciLeads;
  const totalSpend = linkedinSpend + ciSpend + metaSpend;

  const isLowerBetterMetric = (metricKey: string) => {
    const m = String(metricKey || '').toLowerCase();
    return m === 'cpa' || m === 'cpl';
  };

  const getKpiDeltaPct = (kpi: any) => {
    const current = getKpiCurrentValue(kpi);
    const target = parseNum(kpi.targetValue);
    if (!(target > 0)) return -Infinity;
    const lowerBetter = isLowerBetterMetric(String(kpi?.metric || ''));
    return lowerBetter ? ((target - current) / target) * 100 : ((current - target) / target) * 100;
  };
  const getKpiCurrentValue = (kpi: any) => {
    const metricKey = String(kpi?.metric || '').toLowerCase();
    const aggregateMetric = performanceSummary?.totals?.[metricKey];
    return aggregateMetric?.available && aggregateMetric?.value !== null
      ? parseNum(aggregateMetric.value)
      : parseNum(kpi.currentValue);
  };

  const getBenchmarkProgressPct = (benchmark: any) => {
    const current = getBenchmarkCurrentValue(benchmark);
    const industry = parseNum(benchmark.benchmarkValue ?? benchmark.industryAverage);
    if (!(industry > 0)) return 0;
    const lowerBetter = isLowerBetterMetric(getBenchmarkMetricKey(benchmark));
    if (lowerBetter) return current > 0 ? (industry / current) * 100 : 100;
    return (current / industry) * 100;
  };
  const getBenchmarkMetricKey = (benchmark: any) => {
    const metric = String(benchmark?.metric || benchmark?.metricName || benchmark?.name || '').toLowerCase();
    if (metric.includes('session')) return 'sessions';
    if (metric.includes('conversion')) return 'conversions';
    if (metric.includes('revenue')) return 'revenue';
    if (metric.includes('user')) return 'users';
    if (metric.includes('roas')) return 'roas';
    if (metric.includes('roi')) return 'roi';
    if (metric.includes('cpa')) return 'cpa';
    if (metric.includes('cpl')) return 'cpl';
    return metric;
  };
  const getBenchmarkCurrentValue = (benchmark: any) => {
    const metricKey = getBenchmarkMetricKey(benchmark);
    const aggregateMetric = performanceSummary?.totals?.[metricKey];
    return aggregateMetric?.available && aggregateMetric?.value !== null
      ? parseNum(aggregateMetric.value)
      : parseNum(benchmark.currentValue);
  };

  // Calculate campaign health score using the same campaign-level status bands as the KPI/Benchmark tabs.
  const kpisOnTrackOrAbove = effectiveKpis.filter((kpi: any) => getKpiDeltaPct(kpi) >= -5).length;
  const benchmarksOnTrack = effectiveBenchmarks.filter((benchmark: any) => getBenchmarkProgressPct(benchmark) >= 90).length;

  const totalMetrics = effectiveKpis.length + effectiveBenchmarks.length;
  const totalOnTrackMetrics = kpisOnTrackOrAbove + benchmarksOnTrack;
  const healthScore = totalMetrics > 0 ? Math.round((totalOnTrackMetrics / totalMetrics) * 100) : 0;

  const getHealthStatus = () => {
    if (healthScore >= 80) return { label: "Excellent", color: "bg-green-500", icon: CheckCircle2 };
    if (healthScore >= 60) return { label: "Good", color: "bg-blue-500", icon: Activity };
    if (healthScore >= 40) return { label: "Needs Attention", color: "bg-yellow-500", icon: AlertTriangle };
    return { label: "Critical", color: "bg-red-500", icon: AlertTriangle };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;
  const getTrackSummaryStatus = (onTrack: number, total: number) => {
    if (onTrack * 2 > total) return { label: "Majority On Track", color: "#22c55e", badgeClass: "bg-green-500 text-white hover:bg-green-500" };
    if (onTrack * 2 === total) return { label: "Half On Track", color: "#f97316", badgeClass: "bg-orange-500 text-white hover:bg-orange-500" };
    return { label: "Needs Attention", color: "#ef4444", badgeClass: "bg-red-500 text-white hover:bg-red-500" };
  };
  const kpiTrackStatus = getTrackSummaryStatus(kpisOnTrackOrAbove, effectiveKpis.length);
  const benchmarkTrackStatus = getTrackSummaryStatus(benchmarksOnTrack, effectiveBenchmarks.length);
  const aggregateMetric = (metricName: string) => performanceSummary?.totals?.[metricName];
  const aggregateMetricAvailable = (metricName: string) => {
    const metric = aggregateMetric(metricName);
    return metric?.available && metric?.value !== null;
  };
  const aggregateMetricValue = (metricName: string) => {
    const metric = aggregateMetric(metricName);
    return metric?.available && metric?.value !== null ? parseNum(metric.value) : 0;
  };
  const sourceHasMetric = (source: any, metricName: string) =>
    Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
  const sourceMetricValue = (source: any, metricName: string) => parseNum(source?.metrics?.[metricName]);
  const formatCurrencyValue = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumberValue = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const buildPerformanceInsights = () => {
    const insights: PerformanceInsight[] = [];
    const pushInsight = (insight: PerformanceInsight) => insights.push(insight);
    const finalizeInsights = () => {
      const byCategory = new Map<string, PerformanceInsight>();
      for (const insight of insights) {
        const existing = byCategory.get(insight.category);
        if (!existing || insight.priority < existing.priority) {
          byCategory.set(insight.category, insight);
        }
      }
      return Array.from(byCategory.values())
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5);
    };

    if (!performanceSummary) {
      pushInsight({
        type: 'info',
        priority: 5,
        category: 'summary',
        title: 'Campaign Summary',
        message: `Tracking ${totalImpressions.toLocaleString()} total impressions, ${totalEngagements.toLocaleString()} engagements, and ${totalConversions.toLocaleString()} conversions from $${totalSpend.toLocaleString()} spend across connected platforms.`
      });
      return finalizeInsights();
    }

    const paidSources = performanceSources
      .filter((source: any) => source?.category === 'paid_media' || source?.category === 'custom')
      .filter((source: any) => ['impressions', 'clicks', 'spend', 'conversions', 'leads'].some((metric) => sourceHasMetric(source, metric)))
      .map((source: any) => {
        const spend = sourceMetricValue(source, 'spend');
        const clicks = sourceMetricValue(source, 'clicks');
        const impressions = sourceMetricValue(source, 'impressions');
        const conversions = sourceMetricValue(source, 'conversions');
        return {
          id: source.id,
          label: source.label || source.id || 'Paid source',
          spend,
          clicks,
          impressions,
          conversions,
          cpa: spend > 0 && conversions > 0 ? spend / conversions : null,
          cvr: clicks > 0 && conversions > 0 ? (conversions / clicks) * 100 : null,
          ctr: impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null,
        };
      });

    const webSources = performanceSources.filter((source: any) =>
      source?.category === 'web_analytics' || sourceHasMetric(source, 'sessions') || sourceHasMetric(source, 'users')
    );

    const efficiencySources = paidSources.filter((source: any) => source.cpa !== null);
    if (efficiencySources.length >= 2) {
      const ranked = [...efficiencySources].sort((a: any, b: any) => (a.cpa || 0) - (b.cpa || 0));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      pushInsight({
        type: best.cpa! < worst.cpa! * 0.85 ? 'success' : 'info',
        priority: best.cpa! < worst.cpa! * 0.85 ? 2 : 4,
        category: 'paid-efficiency',
        title: best.cpa! < worst.cpa! * 0.85 ? 'Paid Source Efficiency Gap' : 'Paid Sources Performing Similarly',
        message: `${best.label} has the lowest CPA at ${formatCurrencyValue(best.cpa!)}. Compare spend efficiency before shifting budget: ${ranked.map((source: any) => `${source.label} ${formatCurrencyValue(source.cpa!)}`).join(', ')}.`
      });
    } else if (efficiencySources.length === 1) {
      const source = efficiencySources[0];
      pushInsight({
        type: 'info',
        priority: 4,
        category: 'paid-efficiency',
        title: `${source.label} Paid Performance`,
        message: `${source.label} generated ${formatNumberValue(source.conversions)} conversions from ${formatCurrencyValue(source.spend)} spend at ${formatCurrencyValue(source.cpa!)} CPA. Use this as the current paid-source efficiency baseline.`
      });
    }

    if (aggregateMetricAvailable('ctr')) {
      const ctr = aggregateMetricValue('ctr');
      pushInsight({
        type: ctr >= 2 ? 'success' : ctr < 1 ? 'warning' : 'info',
        priority: ctr < 1 ? 1 : ctr >= 2 ? 4 : 3,
        category: 'paid-engagement',
        title: ctr >= 2 ? 'Strong Click-Through Rate' : ctr < 1 ? 'Low Click-Through Rate' : 'Click-Through Rate',
        message: `Aggregate CTR is ${formatPct(ctr)} from ${formatNumberValue(aggregateMetricValue('clicks'))} clicks and ${formatNumberValue(aggregateMetricValue('impressions'))} impressions across eligible paid sources. ${ctr < 1 ? 'Review creative, targeting, and offer clarity first.' : 'Use this as paid engagement context.'}`
      });
    }

    if (aggregateMetricAvailable('cvr')) {
      const cvr = aggregateMetricValue('cvr');
      pushInsight({
        type: cvr >= 5 ? 'success' : cvr < 2 ? 'warning' : 'info',
        priority: cvr < 2 ? 1 : cvr >= 5 ? 3 : 2,
        category: 'conversion-efficiency',
        title: cvr >= 5 ? 'Excellent Conversion Rate' : cvr < 2 ? 'Conversion Rate Opportunity' : 'Conversion Rate',
        message: `Aggregate CVR is ${formatPct(cvr)} from ${formatNumberValue(aggregateMetricValue('clicks'))} clicks and ${formatNumberValue(aggregateMetricValue('conversions'))} conversions. ${cvr < 2 ? 'Prioritize landing-page and funnel review before increasing spend.' : 'Use this to judge traffic quality from connected sources.'}`
      });
    }

    if (aggregateMetricAvailable('cpa')) {
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'conversion-efficiency',
        title: 'Cost Per Acquisition',
        message: `Aggregate CPA is ${formatCurrencyValue(aggregateMetricValue('cpa'))} from ${formatCurrencyValue(aggregateMetricValue('spend'))} spend and ${formatNumberValue(aggregateMetricValue('conversions'))} conversions. Track this against your campaign KPI or benchmark before scaling spend.`
      });
    }

    if (aggregateMetricAvailable('roas') || aggregateMetricAvailable('roi')) {
      const parts = [];
      if (aggregateMetricAvailable('roas')) parts.push(`ROAS ${aggregateMetricValue('roas').toLocaleString('en-US', { maximumFractionDigits: 2 })}x`);
      if (aggregateMetricAvailable('roi')) parts.push(`ROI ${formatPct(aggregateMetricValue('roi'))}`);
      pushInsight({
        type: 'info',
        priority: 2,
        category: 'revenue-efficiency',
        title: 'Revenue Efficiency',
        message: `${parts.join(' and ')} based on available revenue and spend inputs. Use this to evaluate whether current spend is producing enough revenue return.`
      });
    } else if (aggregateMetricAvailable('revenue')) {
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'revenue-efficiency',
        title: 'Revenue Tracked',
        message: `${formatCurrencyValue(aggregateMetricValue('revenue'))} revenue is available. ROAS and ROI are not shown unless both revenue and spend are available, so connect spend before judging revenue efficiency.`
      });
    }

    const paidSpendSources = paidSources.filter((source: any) => source.spend > 0);
    if (paidSpendSources.length > 0 && aggregateMetricAvailable('spend')) {
      const spend = aggregateMetricValue('spend');
      pushInsight({
        type: 'info',
        priority: 4,
        category: 'budget-allocation',
        title: 'Budget Allocation',
        message: `${paidSpendSources.map((source: any) => `${source.label}: ${formatCurrencyValue(source.spend)} (${spend > 0 ? ((source.spend / spend) * 100).toFixed(1) : '0.0'}%)`).join(', ')}. Total spend: ${formatCurrencyValue(spend)}. Use this to confirm budget concentration across connected paid sources.`
      });
    }

    if (webSources.length > 0 && aggregateMetricAvailable('sessions')) {
      const sourceLabels = webSources.map((source: any) => source?.label || source?.id).filter(Boolean).join(', ');
      const sessionText = `${formatNumberValue(aggregateMetricValue('sessions'))} sessions`;
      const userText = aggregateMetricAvailable('users') ? ` and ${formatNumberValue(aggregateMetricValue('users'))} users` : '';
      const conversionText = aggregateMetricAvailable('conversions') ? ` with ${formatNumberValue(aggregateMetricValue('conversions'))} conversions` : '';
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'web-outcomes',
        title: 'Web Analytics Outcomes',
        message: `${sourceLabels} contributed ${sessionText}${userText}${conversionText}. Use this as the campaign outcome context from connected web analytics.`
      });
    }

    if (healthScore >= 80) {
      pushInsight({
        type: 'success',
        priority: 4,
        category: 'campaign-health',
        title: 'Campaign Health Excellent',
        message: `${healthScore}% health score with ${totalOnTrackMetrics} of ${totalMetrics} metrics on track. Campaign performing above expectations.`
      });
    } else if (healthScore < 60) {
      pushInsight({
        type: 'warning',
        priority: 1,
        category: 'campaign-health',
        title: 'Campaign Requires Attention',
        message: `${healthScore}% health score - only ${totalOnTrackMetrics} of ${totalMetrics} metrics on track. Focus on underperforming KPIs to improve results.`
      });
    }

    if (insights.length === 0) {
      const availableMetrics = ['impressions', 'sessions', 'conversions', 'spend', 'revenue']
        .filter(aggregateMetricAvailable)
        .map((metricName) => `${metricName}: ${formatNumberValue(aggregateMetricValue(metricName))}`);
      pushInsight({
        type: 'info',
        priority: 5,
        category: 'summary',
        title: 'Campaign Summary',
        message: availableMetrics.length > 0
          ? `Available aggregate metrics: ${availableMetrics.join(', ')}.`
          : 'No eligible connected-source metrics are available for insight generation yet.'
      });
    }

    return finalizeInsights();
  };

  // Get top priority action
  const getPriorityAction = () => {
    const laggingKPIs = effectiveKpis.map((kpi: any) => {
      const deltaPct = getKpiDeltaPct(kpi);
      return { type: 'kpi', item: kpi, severity: Math.abs(deltaPct), deltaPct };
    }).filter((entry: any) => entry.deltaPct < -5);

    const laggingBenchmarks = effectiveBenchmarks.map((benchmark: any) => {
      const progressPct = getBenchmarkProgressPct(benchmark);
      return { type: 'benchmark', item: benchmark, severity: 90 - progressPct, progressPct };
    }).filter((entry: any) => entry.progressPct < 90);

    const topLaggingKPI = laggingKPIs.sort((a: any, b: any) => b.severity - a.severity)[0];

    if (topLaggingKPI) {
      const topKPI = topLaggingKPI.item;
      
      return {
        type: 'kpi',
        name: topKPI.name,
        metric: topKPI.metric || topKPI.name,
        currentValue: formatMetricValue(getKpiCurrentValue(topKPI), topKPI.unit),
        targetValue: formatMetricValue(topKPI.targetValue, topKPI.unit),
        action: 'Improve'
      };
    }

    const topCandidate: any = laggingBenchmarks.sort((a: any, b: any) => b.severity - a.severity)[0];
    if (topCandidate) {
      const topBenchmark = topCandidate.item;
      return {
        type: 'benchmark',
        name: topBenchmark.metricName || topBenchmark.name,
        action: 'Address',
        message: topCandidate.progressPct < 70 ? 'behind benchmark' : 'needs attention'
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
    const baselineAggregate = baseline?.metrics?.performanceSummary;
    if (performanceSummary?.version && baselineAggregate?.version !== performanceSummary.version) {
      return { changes: [], baselineTimestamp: baseline.recordedAt };
    }

    const currentMetricValue = (metricName: string, fallbackValue: number) => {
      const metric = performanceSummary?.totals?.[metricName];
      return metric?.available && metric?.value !== null ? parseNum(metric.value) : fallbackValue;
    };
    const baselineMetricValue = (metricName: string, fallbackValue: number) => {
      const metric = baselineAggregate?.totals?.[metricName];
      return metric?.available && metric?.value !== null ? parseNum(metric.value) : fallbackValue;
    };

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

    // Compare aggregate-contract metrics against compatible historical snapshots.
    addChange("Impressions", currentMetricValue("impressions", totalImpressions), baselineMetricValue("impressions", parseNum(baseline.totalImpressions)));
    addChange("Clicks", currentMetricValue("clicks", totalClicks), baselineMetricValue("clicks", parseNum(baseline.totalClicks)));
    addChange("Sessions", currentMetricValue("sessions", webSessions), baselineMetricValue("sessions", 0));
    addChange("Conversions", currentMetricValue("conversions", totalConversions), baselineMetricValue("conversions", parseNum(baseline.totalConversions)));
    addChange("Leads", currentMetricValue("leads", totalLeads), baselineMetricValue("leads", parseNum(baseline.totalLeads)));
    addChange("Spend", currentMetricValue("spend", totalSpend), baselineMetricValue("spend", parseNum(baseline.totalSpend)), true);

    return {
      changes,
      baselineTimestamp: baseline.recordedAt,
    };
  };

  const changeData = getChanges();

  const connectedPlatformSources = performanceSources.filter((source: any) => source?.category !== "financial");
  const dataSources = connectedPlatformSources.length > 0
    ? connectedPlatformSources.map((source: any) => ({
        name: source?.label || source?.id || "Connected source",
        connected: source?.connected === true,
        icon: source?.id === "linkedin" ? SiLinkedin : Activity,
      }))
    : [
        { name: "LinkedIn Ads", connected: !!(effectiveLinkedin), icon: SiLinkedin },
        { name: "Custom Integration", connected: !!(effectiveCI), icon: Activity },
      ];
  const sourceLabelForId = (sourceId: string) => {
    if (sourceId === "canonical_spend_sources") return "Campaign spend sources";
    if (sourceId === "paid_platform_spend") return "Paid platform spend";
    const match = performanceSources.find((source: any) => source?.id === sourceId);
    return match?.label || sourceId;
  };
  const getOverviewMetric = (metricName: string, fallbackValue: number) => {
    const metric = performanceSummary?.totals?.[metricName];
    if (performanceSummaryPending) {
      return { available: true, value: null, sources: [], unavailableReasons: [], pending: true };
    }
    if (!performanceSummary || !metric) {
      return { available: true, value: fallbackValue, sources: [], unavailableReasons: [] };
    }
    return metric;
  };
  const formatOverviewValue = (metric: any, formatter: (value: number) => string) => {
    if (metric?.pending) return "...";
    if (!metric?.available) return "Unavailable";
    return formatter(parseNum(metric?.value));
  };
  const overviewSourceLabel = (metric: any, fallbackLabel: string) => {
    if (metric?.pending) return "Preparing aggregate metrics";
    if (!performanceSummary) return fallbackLabel;
    if (!metric?.available) {
      const reason = metric?.unavailableReasons?.[0] || "No connected source provides this metric";
      const sourceLabels = performanceSources
        .filter((source: any) => source?.category !== "financial")
        .map((source: any) => source?.label)
        .filter(Boolean);
      return sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")} - Impressions not available` : reason;
    }
    const labels = (metric.sources || []).map((sourceId: string) => sourceLabelForId(sourceId));
    return labels.length > 0 ? `Sources: ${labels.join(", ")}` : "Sources unavailable";
  };
  const overviewImpressions = getOverviewMetric("impressions", totalImpressions);
  const overviewSessions = getOverviewMetric("sessions", webSessions);
  const overviewConversions = getOverviewMetric("conversions", totalConversions);
  const overviewSpend = getOverviewMetric("spend", totalSpend);

  return (
    <div className="min-h-screen bg-background">
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
                  <h1 className="text-3xl font-bold text-foreground">
                    Performance Summary
                  </h1>
                  <p className="text-muted-foreground/70 mt-1">
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
              {performanceSummaryPending ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Preparing Overview</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Preparing aggregate metrics
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {["Total Impressions", "Total Sessions", "Total Conversions", "Total Spend"].map((label) => (
                      <Card key={label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">{label}</CardTitle>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">...</div>
                          <p className="text-xs text-muted-foreground">Preparing aggregate metrics</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <>
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
                      <p className="text-muted-foreground/70">Set up KPIs and Benchmarks to see your campaign health score.</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full ${healthStatus.color} flex items-center justify-center text-white text-2xl font-bold`}>
                        {healthScore}%
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{healthStatus.label}</div>
                        <div className="text-sm text-muted-foreground/70">
                          {totalOnTrackMetrics} of {totalMetrics} metrics on track
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {kpisOnTrackOrAbove}/{effectiveKpis.length} KPIs • {benchmarksOnTrack}/{effectiveBenchmarks.length} Benchmarks
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
                            <div className="text-xl font-bold text-foreground">
                              {priority.name}
                            </div>
                            <div className="text-sm text-muted-foreground/70 mt-1">
                              KPI: {priority.metric}
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div>
                              <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Current</div>
                              <div className="text-xl font-bold text-red-600 dark:text-red-400">{priority.currentValue}</div>
                            </div>
                            <div className="text-2xl text-muted-foreground/60">→</div>
                            <div>
                              <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Target</div>
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
                          <p className="text-foreground font-medium">
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
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewImpressions, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewImpressions, `Ad: ${advertisingImpressions.toLocaleString()} | Web: ${webPageviews.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewSessions, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewSessions, `Web: ${webSessions.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewConversions, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewConversions, `LinkedIn: ${linkedinConversions.toLocaleString()} | CI: ${ciConversions.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewSpend, (value) => `$${value.toLocaleString()}`)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewSpend, `LinkedIn: $${linkedinSpend.toLocaleString()} | CI: $${ciSpend.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>
              </div>
                </>
              )}
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
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/70 mx-auto mb-3" />
                      <p className="text-muted-foreground/70 font-medium">No KPIs or Benchmarks configured</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set up KPIs and Benchmarks on the campaign page to see health tracking here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-l-4 pl-4 py-2" style={{ borderColor: healthScore >= 70 ? '#22c55e' : healthScore >= 50 ? '#eab308' : '#ef4444' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-foreground">Overall Health Score</span>
                            <Badge variant={healthScore >= 70 ? "default" : "destructive"}>
                              {healthStatus.label}
                            </Badge>
                          </div>
                          <span className="text-2xl font-bold text-foreground">{healthScore}%</span>
                        </div>
                      </div>

                      {effectiveKpis.length > 0 && (
                        <div className="border-l-4 pl-4 py-2" style={{ borderColor: kpiTrackStatus.color }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-foreground">KPIs On Track or Above</span>
                              <Badge variant="default" className={kpiTrackStatus.badgeClass}>
                                {kpiTrackStatus.label}
                              </Badge>
                            </div>
                            <span className="text-sm text-muted-foreground/70">{kpisOnTrackOrAbove} of {effectiveKpis.length}</span>
                          </div>
                        </div>
                      )}

                      {effectiveBenchmarks.length > 0 && (
                        <div className="border-l-4 pl-4 py-2" style={{ borderColor: benchmarkTrackStatus.color }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-foreground">Benchmarks On Track</span>
                              <Badge variant="default" className={benchmarkTrackStatus.badgeClass}>
                                {benchmarkTrackStatus.label}
                              </Badge>
                            </div>
                            <span className="text-sm text-muted-foreground/70">{benchmarksOnTrack} of {effectiveBenchmarks.length}</span>
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
                        const current = getKpiCurrentValue(kpi);
                        const target = parseNum(kpi.targetValue);
                        const deltaPct = getKpiDeltaPct(kpi);
                        const lowerBetter = isLowerBetterMetric(String(kpi?.metric || ''));
                        const percentage = target > 0 ? Math.round((lowerBetter ? (current > 0 ? target / current : 0) : current / target) * 100) : 0;
                        const status = deltaPct > 5
                          ? { label: "Above Target", color: "#22c55e", badgeClass: "bg-green-500 text-white hover:bg-green-500" }
                          : deltaPct >= -5
                            ? { label: "On Track", color: "#2563eb", badgeClass: "bg-blue-500 text-white hover:bg-blue-500" }
                            : { label: "Below Target", color: "#ef4444", badgeClass: "bg-red-500 text-white hover:bg-red-500" };
                        
                        return (
                          <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: status.color }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-foreground">{kpi.name}</span>
                                <Badge variant="default" className={status.badgeClass}>
                                  {status.label}
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground/70">{percentage}% of target</span>
                            </div>
                            <div className="flex items-center space-x-6 text-sm">
                              <div>
                                <span className="text-muted-foreground/70">Current: </span>
                                <span className="font-semibold text-foreground">
                                  {formatMetricValue(current, kpi.unit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground/70">Target: </span>
                                <span className="font-semibold text-foreground">
                                  {formatMetricValue(target, kpi.unit)}
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
                    <CardTitle>Benchmarks</CardTitle>
                    <CardDescription>Performance vs industry averages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {effectiveBenchmarks.map((benchmark: any, idx: number) => {
                        const current = getBenchmarkCurrentValue(benchmark);
                        const target = parseNum(benchmark.benchmarkValue);
                        const progressPct = getBenchmarkProgressPct(benchmark);
                        const status = progressPct >= 90
                          ? { label: "On Track", color: "#22c55e", badgeClass: "bg-green-500 text-white hover:bg-green-500" }
                          : progressPct >= 70
                            ? { label: "Needs Attention", color: "#f97316", badgeClass: "bg-orange-500 text-white hover:bg-orange-500" }
                            : { label: "Below Target", color: "#ef4444", badgeClass: "bg-red-500 text-white hover:bg-red-500" };
                        
                        return (
                          <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: status.color }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold text-foreground">{benchmark.name}</span>
                                <Badge variant="default" className={status.badgeClass}>
                                  {status.label}
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground/70">{Math.round(progressPct)}% of benchmark</span>
                            </div>
                            <div className="flex items-center space-x-6 text-sm">
                              <div>
                                <span className="text-muted-foreground/70">Current: </span>
                                <span className="font-semibold text-foreground">
                                  {formatMetricValue(current, benchmark.unit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground/70">Target: </span>
                                <span className="font-semibold text-foreground">
                                  {formatMetricValue(target, benchmark.unit)}
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
                    {dataSources.map((source: any) => {
                      const Icon = source.icon;
                      return (
                        <div key={source.name} className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-muted-foreground/70" />
                          <span className="text-sm text-foreground/80/60">{source.name}</span>
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
                      <Clock className="w-8 h-8 text-muted-foreground/70 mx-auto mb-3" />
                      <p className="text-muted-foreground/70 font-medium">No historical data available yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Data is recorded automatically as your connected platforms sync.
                        Changes will appear here once enough data has been collected to compare.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {changeData.baselineTimestamp && (
                        <p className="text-xs text-muted-foreground/70">
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
                              'border-border bg-muted'
                            }`}>
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">{item.metric}</div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-2xl font-bold text-foreground">
                                  {item.isCurrency ? `$${item.current.toLocaleString()}` : item.current.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center mt-2 space-x-2">
                                {isUp && <TrendingUp className={`w-4 h-4 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />}
                                {isDown && <TrendingDown className={`w-4 h-4 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />}
                                <span className={`text-sm font-semibold ${
                                  isPositive ? 'text-green-700 dark:text-green-400' :
                                  isNegative ? 'text-red-700 dark:text-red-400' :
                                  'text-muted-foreground/70'
                                }`}>
                                  {isFlat ? 'No change' :
                                    `${isUp ? '+' : ''}${item.isCurrency ? '$' + item.change.toLocaleString() : item.change.toLocaleString()} (${isUp ? '+' : ''}${item.pctChange.toFixed(1)}%)`
                                  }
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
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
                              <h4 className="text-sm font-semibold text-foreground/80/60 mb-3">Impressions</h4>
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
                              <h4 className="text-sm font-semibold text-foreground/80/60 mb-3">Clicks</h4>
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
                              <h4 className="text-sm font-semibold text-foreground/80/60 mb-3">Conversions</h4>
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
                              <h4 className="text-sm font-semibold text-foreground/80/60 mb-3">Spend</h4>
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
                      const insights = buildPerformanceInsights();
                      
                      return insights.map((insight, idx) => {
                        const bgColors: Record<string, string> = {
                          success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                          warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
                          info: 'bg-muted border-border'
                        };
                        const textColors: Record<string, string> = {
                          success: 'text-green-900 dark:text-green-100',
                          warning: 'text-yellow-900 dark:text-yellow-100',
                          info: 'text-foreground dark:text-slate-100'
                        };
                        const bodyColors: Record<string, string> = {
                          success: 'text-green-800 dark:text-green-200',
                          warning: 'text-yellow-800 dark:text-yellow-200',
                          info: 'text-foreground/80/60'
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

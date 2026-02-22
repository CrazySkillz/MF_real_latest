import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Calculator, PieChart, BarChart3, AlertTriangle, Target, Zap, Activity, Eye, Info, FlaskConical } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
}

export default function FinancialAnalysis() {
  const [, params] = useRoute("/campaigns/:id/financial-analysis");
  const campaignId = params?.id;
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("7d");
  const [demoMode, setDemoMode] = useState(false);

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Get historical snapshot for comparison
  const { data: historicalSnapshot } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "snapshots", "historical", comparisonPeriod],
    enabled: !!campaignId,
    queryFn: async () => {
      const daysAgo = comparisonPeriod === "1d" ? 1 : comparisonPeriod === "7d" ? 7 : 30;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      
      const response = await fetch(`/api/campaigns/${campaignId}/snapshots?date=${targetDate.toISOString()}`);
      if (!response.ok) return null;
      const snapshots = await response.json();
      
      return snapshots.length > 0 ? snapshots[0] : null;
    },
  });

  // Get LinkedIn metrics
  const { data: linkedInData, isLoading: linkedInLoading } = useQuery({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Get Custom Integration data
  const { data: customIntegrationData, isLoading: ciLoading } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Get Google Sheets financial data
  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Get GA4 data for additional metrics
  const { data: ga4Data, isLoading: ga4Loading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Get Meta analytics data
  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Demo mode mock data
  const demoLinkedIn = demoMode ? {
    spend: 4250, impressions: 12500, engagements: 1240, clicks: 890,
    conversions: 45, leads: 18, conversionValue: 182,
    revenue: 8190, roas: 1.93, roi: 92.7,
  } : null;
  const demoCI = demoMode ? {
    metrics: { spend: '1800', pageviews: 15200, sessions: 3400, clicks: 420,
      conversions: 28, leads: 12, impressions: 8500, engagements: 580 }
  } : null;
  const demoSheets = demoMode ? {
    summary: { totalSpend: 950, totalImpressions: 6200, totalEngagements: 310,
      totalClicks: 280, totalConversions: 14 }
  } : null;
  const demoGA4 = demoMode ? { averageOrderValue: 145 } : null;
  const demoMeta = demoMode ? {
    summary: { totalImpressions: 28000, totalClicks: 1450, totalSpend: 3100, totalConversions: 62 }
  } : null;
  const demoSnapshot = demoMode ? {
    totalSpend: 5800, totalConversions: 68,
  } : null;

  const effectiveLinkedIn: any = demoLinkedIn || linkedInData;
  const effectiveCI: any = demoCI || customIntegrationData;
  const effectiveSheets: any = demoSheets || sheetsData;
  const effectiveGA4: any = demoGA4 || ga4Data;
  const effectiveMeta: any = demoMeta || metaData;
  const effectiveSnapshot: any = demoMode ? demoSnapshot : historicalSnapshot;

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

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

  // Data loading state — prevent flash of stale/zero metrics on refresh
  const dataLoading = !demoMode && (linkedInLoading || ciLoading || metaLoading || ga4Loading);

  // Aggregate metrics from all platforms
  // Custom Integration: Map pageviews→impressions, sessions→engagements (consistent with Performance Summary)
  const platformMetrics = {
    linkedIn: {
      spend: effectiveLinkedIn?.spend || 0,
      impressions: effectiveLinkedIn?.impressions || 0,
      engagements: effectiveLinkedIn?.engagements || 0,
      clicks: effectiveLinkedIn?.clicks || 0,
      conversions: effectiveLinkedIn?.conversions || 0,
    },
    customIntegration: {
      spend: parseFloat(effectiveCI?.metrics?.spend || '0'),
      impressions: effectiveCI?.metrics?.pageviews || 0,
      engagements: effectiveCI?.metrics?.sessions || 0,
      clicks: effectiveCI?.metrics?.clicks || 0,
      conversions: effectiveCI?.metrics?.conversions || 0,
    },
    sheets: {
      spend: effectiveSheets?.summary?.totalSpend || 0,
      impressions: effectiveSheets?.summary?.totalImpressions || 0,
      engagements: effectiveSheets?.summary?.totalEngagements || 0,
      clicks: effectiveSheets?.summary?.totalClicks || 0,
      conversions: effectiveSheets?.summary?.totalConversions || 0,
    },
    meta: {
      spend: effectiveMeta?.summary?.totalSpend || 0,
      impressions: effectiveMeta?.summary?.totalImpressions || 0,
      engagements: 0,
      clicks: effectiveMeta?.summary?.totalClicks || 0,
      conversions: effectiveMeta?.summary?.totalConversions || 0,
    },
  };

  // Calculate totals across all platforms
  const totalSpend = platformMetrics.linkedIn.spend + platformMetrics.customIntegration.spend + platformMetrics.sheets.spend + platformMetrics.meta.spend;
  const totalImpressions = platformMetrics.linkedIn.impressions + platformMetrics.customIntegration.impressions + platformMetrics.sheets.impressions + platformMetrics.meta.impressions;
  const totalEngagements = platformMetrics.linkedIn.engagements + platformMetrics.customIntegration.engagements + platformMetrics.sheets.engagements + platformMetrics.meta.engagements;
  const totalClicks = platformMetrics.linkedIn.clicks + platformMetrics.customIntegration.clicks + platformMetrics.sheets.clicks + platformMetrics.meta.clicks;
  const totalConversions = platformMetrics.linkedIn.conversions + platformMetrics.customIntegration.conversions + platformMetrics.sheets.conversions + platformMetrics.meta.conversions;
  
  // Get campaign budget and currency
  const campaignBudget = campaign.budget ? (parseFloat(campaign.budget) || 0) : 0;
  const campaignCurrency = (campaign as any).currency || 'USD';
  
  // Format currency with campaign's currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: campaignCurrency,
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Get conversion value from LinkedIn (configured during connection setup)
  // This is the primary source for revenue calculations per system design
  const linkedInConversionValue = effectiveLinkedIn?.conversionValue || 0;
  const linkedInRevenueFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.revenue))
    ? Number((effectiveLinkedIn as any).revenue)
    : null;
  const linkedInROASFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.roas))
    ? Number((effectiveLinkedIn as any).roas)
    : null;
  const linkedInROIFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.roi))
    ? Number((effectiveLinkedIn as any).roi)
    : null;

  // Get AOV from GA4 or Custom Integration as fallback
  const fallbackAOV = effectiveGA4?.averageOrderValue ||
                      effectiveCI?.averageOrderValue ||
                      0;
  
  // Use LinkedIn conversion value if available, otherwise fallback to GA4/Custom Integration AOV
  const estimatedAOV = linkedInConversionValue > 0 ? linkedInConversionValue : fallbackAOV;
  
  // Financial calculations
  const budgetUtilization = campaignBudget > 0 ? (totalSpend / campaignBudget) * 100 : 0;
  const remainingBudget = campaignBudget - totalSpend;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  
  // Calculate platform-specific ROAS
  const calculatePlatformROAS = (spend: number, conversions: number, platformConversionValue?: number) => {
    const aov = platformConversionValue || estimatedAOV;
    const revenue = conversions * aov;
    return spend > 0 ? revenue / spend : 0;
  };
  
  const linkedInROAS =
    linkedInROASFromBackend !== null
      ? linkedInROASFromBackend
      : calculatePlatformROAS(platformMetrics.linkedIn.spend, platformMetrics.linkedIn.conversions, linkedInConversionValue);
  const customIntegrationROAS = calculatePlatformROAS(platformMetrics.customIntegration.spend, platformMetrics.customIntegration.conversions);
  const metaROAS = calculatePlatformROAS(platformMetrics.meta.spend, platformMetrics.meta.conversions);

  // Calculate revenue/ROI using LinkedIn conversion value for LinkedIn conversions
  // and fallback AOV for other platforms (CI, Sheets, Meta)
  // IMPORTANT: Prefer backend-computed LinkedIn revenue. This remains correct even when revenue-to-date is imported
  // (e.g. conversions=0, conversionValue=0, but revenue still exists).
  const linkedInRevenue =
    linkedInRevenueFromBackend !== null
      ? linkedInRevenueFromBackend
      : (platformMetrics.linkedIn.conversions * linkedInConversionValue);
  const metaRevenue = platformMetrics.meta.conversions * estimatedAOV;
  const otherRevenue = (platformMetrics.customIntegration.conversions + platformMetrics.sheets.conversions) * fallbackAOV;
  const estimatedRevenue = linkedInRevenue + otherRevenue + metaRevenue;
  const roas = totalSpend > 0 ? estimatedRevenue / totalSpend : 0;
  const roi =
    // If this campaign is effectively LinkedIn-only, prefer backend ROI (it accounts for revenue-to-date vs derived revenue).
    (linkedInROIFromBackend !== null && otherRevenue === 0 && metaRevenue === 0 && totalSpend === platformMetrics.linkedIn.spend)
      ? linkedInROIFromBackend
      : (totalSpend > 0 ? ((estimatedRevenue - totalSpend) / totalSpend) * 100 : 0);

  // Calculate comparison metrics
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const renderTrendIndicator = (change: number) => {
    if (Math.abs(change) < 0.01) return null;
    const isPositive = change > 0;
    return (
      <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  const historicalMetrics = effectiveSnapshot ? {
    spend: effectiveSnapshot.totalSpend || 0,
    revenue: (effectiveSnapshot.totalConversions || 0) * estimatedAOV,
    roas: effectiveSnapshot.totalSpend > 0 ? ((effectiveSnapshot.totalConversions || 0) * estimatedAOV) / effectiveSnapshot.totalSpend : 0,
    roi: effectiveSnapshot.totalSpend > 0 ? (((effectiveSnapshot.totalConversions || 0) * estimatedAOV - effectiveSnapshot.totalSpend) / effectiveSnapshot.totalSpend) * 100 : 0,
  } : null;

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
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Budget & Financial Analysis
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {campaign.name} - Comprehensive financial performance overview
                  </p>
                </div>
              </div>
              <Button
                variant={demoMode ? "default" : "outline"}
                size="sm"
                onClick={() => setDemoMode(!demoMode)}
              >
                <FlaskConical className="w-4 h-4 mr-1" />
                {demoMode ? "Demo On" : "Demo Data"}
              </Button>
            </div>
          </div>

          {demoMode && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <FlaskConical className="w-4 h-4 inline mr-1" />
                Showing demo data for testing. Toggle off to see real campaign data.
              </p>
            </div>
          )}

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="roi-roas">ROI & ROAS</TabsTrigger>
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
              <TabsTrigger value="budget">Budget Allocation</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                    <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              ) : <>
              {/* AOV Warning (only when we have no usable revenue source AND data has loaded) */}
              {estimatedAOV === 0 && !(linkedInRevenueFromBackend !== null && linkedInRevenueFromBackend > 0) && (
                <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-200">
                          Conversion Value Not Configured
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Revenue, ROI, and ROAS calculations require conversion value configuration. Set this during LinkedIn connection setup, or configure AOV in GA4 or Custom Integration.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Budget Health Score Dashboard */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Campaign Health Score</span>
                  </CardTitle>
                  <CardDescription>
                    Real-time health assessment across key financial metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const calculateHealthScore = () => {
                      let score = 0;
                      
                      const budgetScore = budgetUtilization <= 80 ? 25 : budgetUtilization <= 95 ? 15 : budgetUtilization <= 100 ? 10 : 0;
                      
                      const campaignStartDate = campaign.startDate ? new Date(campaign.startDate) : new Date();
                      const today = new Date();
                      const daysElapsed = Math.max(1, Math.ceil((today.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24)));
                      const dailyBurnRate = totalSpend / daysElapsed;
                      const campaignEndDate = campaign.endDate ? new Date(campaign.endDate) : null;
                      const targetDaysTotal = campaignEndDate ? Math.max(1, Math.ceil((campaignEndDate.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24))) : daysElapsed + (dailyBurnRate > 0 ? remainingBudget / dailyBurnRate : 0);
                      const targetDailySpend = campaignBudget / targetDaysTotal;
                      const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                      const pacingDeviation = Math.abs(pacingPercentage - 100);
                      const pacingScore = pacingDeviation <= 15 ? 25 : pacingDeviation <= 30 ? 15 : pacingDeviation <= 50 ? 10 : 0;

                      const roiScore = roi >= 100 ? 25 : roi >= 50 ? 15 : roi >= 0 ? 10 : 0;

                      const roasScore = roas >= 3 ? 25 : roas >= 1.5 ? 15 : roas >= 1 ? 10 : 0;
                      
                      score = budgetScore + pacingScore + roiScore + roasScore;
                      
                      return {
                        total: score,
                        budget: { score: budgetScore, status: budgetUtilization <= 80 ? 'excellent' : budgetUtilization <= 95 ? 'good' : budgetUtilization <= 100 ? 'warning' : 'critical' },
                        pacing: { score: pacingScore, status: pacingDeviation <= 15 ? 'excellent' : pacingDeviation <= 30 ? 'good' : pacingDeviation <= 50 ? 'warning' : 'critical' },
                        roi: { score: roiScore, status: roi >= 100 ? 'excellent' : roi >= 50 ? 'good' : roi >= 0 ? 'warning' : 'critical' },
                        roas: { score: roasScore, status: roas >= 3 ? 'excellent' : roas >= 1.5 ? 'good' : roas >= 1 ? 'warning' : 'critical' }
                      };
                    };
                    
                    const healthData = calculateHealthScore();
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'excellent': return 'bg-green-500';
                        case 'good': return 'bg-green-400';
                        case 'warning': return 'bg-yellow-500';
                        case 'critical': return 'bg-red-500';
                        default: return 'bg-gray-400';
                      }
                    };
                    
                    const getStatusBadgeColor = (status: string) => {
                      switch (status) {
                        case 'excellent': return 'bg-green-100 text-green-700';
                        case 'good': return 'bg-green-100 text-green-600';
                        case 'warning': return 'bg-yellow-100 text-yellow-700';
                        case 'critical': return 'bg-red-100 text-red-700';
                        default: return 'bg-gray-100 text-gray-700';
                      }
                    };
                    
                    return (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-3">
                              <div className={`text-5xl font-bold ${healthData.total >= 80 ? 'text-green-600' : healthData.total >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {healthData.total}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div>out of 100</div>
                                <div className="font-semibold">
                                  {healthData.total >= 80 ? 'Excellent' : healthData.total >= 60 ? 'Good' : healthData.total >= 40 ? 'Fair' : 'Needs Attention'}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${healthData.total >= 80 ? 'bg-green-100' : healthData.total >= 60 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                            <Zap className={`w-12 h-12 ${healthData.total >= 80 ? 'text-green-600' : healthData.total >= 60 ? 'text-yellow-600' : 'text-red-600'}`} />
                          </div>
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div className="p-4 border rounded-lg" data-testid="health-budget-utilization">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Budget Utilization</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.budget.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{formatPercentage(budgetUtilization)}</div>
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.budget.status)}`}>
                              {healthData.budget.status}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-pacing">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Pacing Status</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.pacing.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{(() => {
                              const campaignStartDate = campaign.startDate ? new Date(campaign.startDate) : new Date();
                              const today = new Date();
                              const daysElapsed = Math.max(1, Math.ceil((today.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24)));
                              const dailyBurnRate = totalSpend / daysElapsed;
                              const campaignEndDate = campaign.endDate ? new Date(campaign.endDate) : null;
                              const targetDaysTotal = campaignEndDate ? Math.max(1, Math.ceil((campaignEndDate.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24))) : daysElapsed + (dailyBurnRate > 0 ? remainingBudget / dailyBurnRate : 0);
                              const targetDailySpend = campaignBudget / targetDaysTotal;
                              const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                              return formatPercentage(pacingPercentage);
                            })()}</div>
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.pacing.status)}`}>
                              {healthData.pacing.status}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-roi">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">ROI Performance</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.roi.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{formatPercentage(roi)}</div>
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.roi.status)}`}>
                              {healthData.roi.status}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-roas">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">ROAS Performance</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.roas.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{roas.toFixed(2)}x</div>
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.roas.status)}`}>
                              {healthData.roas.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Key Financial Metrics */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(totalSpend)}
                          </p>
                          {historicalMetrics && renderTrendIndicator(calculateChange(totalSpend, historicalMetrics.spend))}
                        </div>
                      </div>
                      <DollarSign className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatNumber(totalConversions)}
                          </p>
                          {historicalMetrics && effectiveSnapshot && renderTrendIndicator(calculateChange(totalConversions, effectiveSnapshot.totalConversions || 0))}
                        </div>
                      </div>
                      <Activity className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Utilization & Pacing */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Budget Utilization</span>
                    </CardTitle>
                    <CardDescription>
                      Campaign budget usage and remaining allocation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Budget Used</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(totalSpend)} of {formatCurrency(campaignBudget)}
                        </span>
                      </div>
                      <Progress value={Math.min(budgetUtilization, 100)} className="h-2" />
                      <div className="flex items-center justify-between text-sm">
                        <span className={budgetUtilization > 90 ? "text-red-600" : "text-green-600"}>
                          {formatPercentage(budgetUtilization)} utilized
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(remainingBudget)} remaining
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Budget Pacing & Burn Rate</span>
                    </CardTitle>
                    <CardDescription>
                      Daily spend rate and budget projection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(() => {
                        const campaignStartDate = campaign.startDate ? new Date(campaign.startDate) : new Date();
                        const today = new Date();
                        const daysElapsed = Math.max(1, Math.ceil((today.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24)));
                        const dailyBurnRate = totalSpend / daysElapsed;
                        const isOverBudget = remainingBudget < 0;
                        const daysRemaining = (!isOverBudget && dailyBurnRate > 0) ? remainingBudget / dailyBurnRate : 0;
                        const projectedEndDate = (!isOverBudget && dailyBurnRate > 0) ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null;
                        
                        const campaignEndDate = campaign.endDate ? new Date(campaign.endDate) : null;
                        const targetDaysTotal = campaignEndDate ? Math.max(1, Math.ceil((campaignEndDate.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24))) : daysElapsed + daysRemaining;
                        const targetDailySpend = campaignBudget / targetDaysTotal;
                        
                        const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                        const pacingStatus = pacingPercentage > 115 ? 'ahead' : pacingPercentage < 85 ? 'behind' : 'on-track';
                        
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Daily Burn Rate</span>
                              <span className="text-sm font-bold">{formatCurrency(dailyBurnRate)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Target Daily Spend</span>
                              <span className="text-sm text-muted-foreground">{formatCurrency(targetDailySpend)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Pacing Status</span>
                              <Badge className={
                                pacingStatus === 'ahead' ? 'bg-red-100 text-red-700' : 
                                pacingStatus === 'behind' ? 'bg-yellow-100 text-yellow-700' : 
                                'bg-green-100 text-green-700'
                              }>
                                {pacingStatus === 'ahead' ? `${formatPercentage(pacingPercentage - 100)} Over` : 
                                 pacingStatus === 'behind' ? `${formatPercentage(100 - pacingPercentage)} Under` : 
                                 'On Track'}
                              </Badge>
                            </div>
                            {isOverBudget && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  Budget exceeded by {formatCurrency(Math.abs(remainingBudget))}
                                </p>
                              </div>
                            )}
                            {!isOverBudget && projectedEndDate && daysRemaining > 0 && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-muted-foreground">
                                  At current rate, budget will be exhausted in <strong>{Math.ceil(daysRemaining)} days</strong>
                                  {campaignEndDate && (
                                    <span> ({projectedEndDate > campaignEndDate ? 'after' : 'before'} campaign end date)</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cost Efficiency Metrics */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost Per Click</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpc)}
                        </p>
                      </div>
                      <BarChart3 className="w-6 h-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost Per Acquisition</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpa)}
                        </p>
                      </div>
                      <Target className="w-6 h-6 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(conversionRate)}
                        </p>
                        {conversionRate > 100 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            * Exceeds 100% due to view-through conversions from ad impressions
                          </p>
                        )}
                      </div>
                      <PieChart className="w-6 h-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              </>}
            </TabsContent>

            <TabsContent value="roi-roas" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                  <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>ROI & ROAS Analysis</CardTitle>
                  <CardDescription>
                    Return on investment and return on ad spend detailed breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Ad Spend (ROAS)</h4>
                      <div className="text-3xl font-bold text-blue-600">{roas.toFixed(2)}x</div>
                      <p className="text-sm text-muted-foreground">
                        For every $1 spent on advertising, you generated ${roas.toFixed(2)} in revenue.
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Ad Spend:</span>
                          <span className="font-medium">{formatCurrency(totalSpend)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimated Revenue:</span>
                          <span className="font-medium">{formatCurrency(estimatedRevenue)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Investment (ROI)</h4>
                      <div className={`text-3xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(roi)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {roi >= 0 ? 'Positive' : 'Negative'} return on your advertising investment.
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Net Profit:</span>
                          <span className={`font-medium ${estimatedRevenue - totalSpend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(estimatedRevenue - totalSpend)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Investment:</span>
                          <span className="font-medium">{formatCurrency(totalSpend)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Platform-Specific ROAS Breakdown */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-4">Platform ROAS Performance</h4>
                    <div className="space-y-3">
                      {/* LinkedIn Ads */}
                      {platformMetrics.linkedIn.spend > 0 && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">LinkedIn Ads</span>
                            <Badge className={linkedInROAS >= 3 ? "bg-green-100 text-green-700" : linkedInROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {linkedInROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.linkedIn.spend)} • Conversions: {formatNumber(platformMetrics.linkedIn.conversions)} • Revenue: {formatCurrency(linkedInRevenue)}
                          </div>
                        </div>
                      )}

                      {/* Custom Integration */}
                      {(platformMetrics.customIntegration.spend > 0 || platformMetrics.customIntegration.conversions > 0) && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Custom Integration</span>
                            <Badge className={customIntegrationROAS >= 3 ? "bg-green-100 text-green-700" : customIntegrationROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {customIntegrationROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.customIntegration.spend)} • Conversions: {formatNumber(platformMetrics.customIntegration.conversions)} • Revenue: {formatCurrency(platformMetrics.customIntegration.conversions * fallbackAOV)}
                          </div>
                        </div>
                      )}

                      {/* Meta Ads */}
                      {platformMetrics.meta.spend > 0 && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Meta Ads</span>
                            <Badge className={metaROAS >= 3 ? "bg-green-100 text-green-700" : metaROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {metaROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.meta.spend)} • Conversions: {formatNumber(platformMetrics.meta.conversions)} • Revenue: {formatCurrency(metaRevenue)}
                          </div>
                        </div>
                      )}

                      {/* No data message */}
                      {totalSpend === 0 && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            No platform data available yet. Connect platforms or upload data to see performance breakdown.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Platform-Specific ROI Breakdown */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-4">Platform ROI Performance</h4>
                    <div className="space-y-3">
                      {/* LinkedIn Ads */}
                      {platformMetrics.linkedIn.spend > 0 && (() => {
                        const linkedInROI = platformMetrics.linkedIn.spend > 0 
                          ? ((linkedInRevenue - platformMetrics.linkedIn.spend) / platformMetrics.linkedIn.spend) * 100 
                          : 0;
                        const linkedInNetProfit = linkedInRevenue - platformMetrics.linkedIn.spend;
                        
                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">LinkedIn Ads</span>
                              <Badge className={linkedInROI >= 100 ? "bg-green-100 text-green-700" : linkedInROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(linkedInROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.linkedIn.spend)} • Net Profit: <span className={linkedInNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(linkedInNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Custom Integration */}
                      {(platformMetrics.customIntegration.spend > 0 || platformMetrics.customIntegration.conversions > 0) && (() => {
                        const customIntegrationRevenue = platformMetrics.customIntegration.conversions * fallbackAOV;
                        const customIntegrationROI = platformMetrics.customIntegration.spend > 0
                          ? ((customIntegrationRevenue - platformMetrics.customIntegration.spend) / platformMetrics.customIntegration.spend) * 100
                          : 0;
                        const customIntegrationNetProfit = customIntegrationRevenue - platformMetrics.customIntegration.spend;

                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Custom Integration</span>
                              <Badge className={customIntegrationROI >= 100 ? "bg-green-100 text-green-700" : customIntegrationROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(customIntegrationROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.customIntegration.spend)} • Net Profit: <span className={customIntegrationNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(customIntegrationNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Meta Ads */}
                      {platformMetrics.meta.spend > 0 && (() => {
                        const metaROI = platformMetrics.meta.spend > 0
                          ? ((metaRevenue - platformMetrics.meta.spend) / platformMetrics.meta.spend) * 100
                          : 0;
                        const metaNetProfit = metaRevenue - platformMetrics.meta.spend;

                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Meta Ads</span>
                              <Badge className={metaROI >= 100 ? "bg-green-100 text-green-700" : metaROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(metaROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.meta.spend)} • Net Profit: <span className={metaNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(metaNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* No data message */}
                      {totalSpend === 0 && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            No platform data available yet. Connect platforms or upload data to see performance breakdown.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="costs" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>Cost Analysis Breakdown</CardTitle>
                  <CardDescription>
                    Detailed cost efficiency and optimization opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Cost Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Click (CPC)</span>
                          <span className="font-medium">{formatCurrency(cpc)}</span>
                        </div>
                        
                        {/* CPA - Handle view-through conversions */}
                        {(() => {
                          const clickThroughConversions = Math.min(totalConversions, totalClicks);
                          const clickThroughCPA = clickThroughConversions > 0 ? totalSpend / clickThroughConversions : 0;
                          const totalCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
                          const hasViewThroughConversions = totalConversions > totalClicks;
                          
                          return (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between">
                                <span>Cost Per Acquisition (CPA)</span>
                                <span className="font-medium">{formatCurrency(clickThroughCPA)}</span>
                              </div>
                              {hasViewThroughConversions && (
                                <>
                                  <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                                    <span>Total CPA (incl. view-through):</span>
                                    <span>{formatCurrency(totalCPA)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Includes conversions from users who viewed ads without clicking
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Thousand Impressions (CPM)</span>
                          <span className="font-medium">
                            {totalImpressions > 0 ? formatCurrency((totalSpend / totalImpressions) * 1000) : '$0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Efficiency Indicators</h4>
                      <div className="space-y-3">
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span>Click-through Rate (CTR)</span>
                            <span className="font-medium">{formatPercentage(ctr)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(ctr / 15 * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* CVR - Handle view-through conversions */}
                        {(() => {
                          const clickThroughConversions = Math.min(totalConversions, totalClicks);
                          const clickThroughCVR = totalClicks > 0 ? (clickThroughConversions / totalClicks) * 100 : 0;
                          const totalCVR = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
                          const hasViewThroughConversions = totalConversions > totalClicks;
                          
                          return (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <span>Conversion Rate (CVR)</span>
                                <span className="font-medium">{formatPercentage(clickThroughCVR)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${Math.min(clickThroughCVR / 20 * 100, 100)}%` }}
                                ></div>
                              </div>
                              {hasViewThroughConversions && (
                                <>
                                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Total CVR (incl. view-through):</span>
                                    <span>{formatPercentage(totalCVR)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Total includes view-through conversions from ad impressions
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  
                  {/* Cost Optimization Opportunities - Dynamic Data-Driven */}
                  {(() => {
                    const recommendations: string[] = [];
                    
                    // Platform ROAS Performance
                    if (platformMetrics.linkedIn.spend > 0 && linkedInROAS >= 10) {
                      recommendations.push(`LinkedIn generating exceptional ${linkedInROAS.toFixed(2)}x ROAS - consider increasing budget allocation`);
                    } else if (platformMetrics.linkedIn.spend > 0 && linkedInROAS >= 3) {
                      recommendations.push(`LinkedIn showing strong ${linkedInROAS.toFixed(2)}x ROAS - maintain or scale current strategy`);
                    } else if (platformMetrics.linkedIn.spend > 0 && linkedInROAS < 1.5) {
                      recommendations.push(`LinkedIn ROAS below target at ${linkedInROAS.toFixed(2)}x - review targeting and creative performance`);
                    }
                    
                    // Custom Integration Status
                    if (platformMetrics.customIntegration.spend === 0 && platformMetrics.customIntegration.conversions === 0) {
                      recommendations.push('Custom Integration has no financial data - upload campaign data to enable cross-platform comparison');
                    } else if (platformMetrics.customIntegration.spend > 0) {
                      const customROAS = platformMetrics.customIntegration.spend > 0 
                        ? (platformMetrics.customIntegration.conversions * fallbackAOV) / platformMetrics.customIntegration.spend 
                        : 0;
                      if (customROAS < linkedInROAS && platformMetrics.linkedIn.spend > 0) {
                        recommendations.push(`LinkedIn outperforming Custom Integration by ${((linkedInROAS - customROAS) / customROAS * 100).toFixed(0)}% - consider reallocating budget`);
                      }
                    }
                    
                    // CTR Performance
                    if (ctr < 1) {
                      recommendations.push(`Click-through rate below 1% - test new ad creative and messaging to improve engagement`);
                    } else if (ctr >= 3) {
                      recommendations.push(`Strong click-through rate of ${formatPercentage(ctr)} - ads resonating well with target audience`);
                    }
                    
                    // CVR Performance
                    if (conversionRate < 2) {
                      recommendations.push(`Conversion rate below 2% - review landing page experience and offer relevance`);
                    } else if (conversionRate >= 10) {
                      recommendations.push(`Excellent conversion rate of ${formatPercentage(conversionRate)} - landing page highly effective`);
                    }
                    
                    // ROI Performance
                    if (roi > 1000) {
                      recommendations.push(`Outstanding ROI of ${formatPercentage(roi)} - scale winning campaigns to maximize returns`);
                    } else if (roi < 0) {
                      recommendations.push(`Negative ROI - immediate optimization required to achieve profitability`);
                    }
                    
                    // CPC Efficiency
                    if (cpc > 10) {
                      recommendations.push(`CPC of ${formatCurrency(cpc)} above average - refine audience targeting to reduce costs`);
                    } else if (cpc < 2) {
                      recommendations.push(`Low CPC of ${formatCurrency(cpc)} indicates efficient targeting - maintain current approach`);
                    }
                    
                    // CPA with High ROAS indicates high-value conversions
                    if (cpa > 50 && roas > 10) {
                      recommendations.push(`High CPA of ${formatCurrency(cpa)} justified by exceptional ${roas.toFixed(2)}x ROAS - focus on quality over quantity`);
                    }
                    
                    return recommendations.length > 0 ? (
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">💡 Data-Driven Insights</h5>
                        <ul className="space-y-2 text-sm">
                          {recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-blue-600">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="budget" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Performance-Based Budget Allocation</span>
                  </CardTitle>
                  <CardDescription>
                    Data-driven budget analysis and optimization insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calculate performance tiers based on real ROAS
                    const platforms = [
                      {
                        name: 'LinkedIn Ads',
                        spend: platformMetrics.linkedIn.spend,
                        roas: linkedInROAS,
                        conversions: platformMetrics.linkedIn.conversions,
                        revenue: linkedInRevenue
                      },
                      {
                        name: 'Meta Ads',
                        spend: platformMetrics.meta.spend,
                        roas: metaROAS,
                        conversions: platformMetrics.meta.conversions,
                        revenue: metaRevenue
                      },
                      {
                        name: 'Custom Integration',
                        spend: platformMetrics.customIntegration.spend,
                        roas: customIntegrationROAS,
                        conversions: platformMetrics.customIntegration.conversions,
                        revenue: platformMetrics.customIntegration.conversions * fallbackAOV
                      }
                    ].filter(p => p.spend > 0 || p.conversions > 0);
                    
                    const highPerformance = platforms.filter(p => p.roas >= 3 && p.spend > 0);
                    const mediumPerformance = platforms.filter(p => p.roas >= 1 && p.roas < 3 && p.spend > 0);
                    const lowPerformance = platforms.filter(p => p.roas < 1 && p.spend > 0);
                    
                    const highSpend = highPerformance.reduce((sum, p) => sum + p.spend, 0);
                    const mediumSpend = mediumPerformance.reduce((sum, p) => sum + p.spend, 0);
                    const lowSpend = lowPerformance.reduce((sum, p) => sum + p.spend, 0);
                    
                    const platformsWithSpend = platforms.filter(p => p.spend > 0);
                    const hasMultiplePlatforms = platformsWithSpend.length > 1;
                    
                    return (
                      <div className="space-y-6">
                        {/* Performance Tiers */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-green-600 mb-2">High Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(highSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {totalSpend > 0 ? ((highSpend / totalSpend) * 100).toFixed(0) : 0}% of current spend
                            </p>
                            <p className="text-xs mt-2">Platforms with ROAS ≥ 3.0x</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-yellow-600 mb-2">Medium Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(mediumSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {totalSpend > 0 ? ((mediumSpend / totalSpend) * 100).toFixed(0) : 0}% of current spend
                            </p>
                            <p className="text-xs mt-2">Platforms with ROAS 1.0-3.0x</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-red-600 mb-2">Low Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(lowSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {totalSpend > 0 ? ((lowSpend / totalSpend) * 100).toFixed(0) : 0}% of current spend
                            </p>
                            <p className="text-xs mt-2">Platforms with ROAS &lt; 1.0x</p>
                          </div>
                        </div>
                        
                        {/* Platform Budget Breakdown */}
                        <div className="mt-6">
                          <h4 className="font-semibold mb-4">Platform Budget Analysis</h4>
                          <div className="space-y-4">
                            {platforms.map((platform, index) => {
                              const hasNoData = platform.spend === 0 && platform.conversions === 0;
                              const currentPercent = totalSpend > 0 ? (platform.spend / totalSpend) * 100 : 0;
                              const performanceColor = platform.roas >= 3 ? 'green' : platform.roas >= 1 ? 'yellow' : 'red';
                              
                              return (
                                <div key={index} className="p-4 border rounded-lg">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="font-medium">{platform.name}</span>
                                    <div className="flex items-center space-x-2">
                                      {hasNoData ? (
                                        <Badge className="bg-slate-100 text-slate-700">No Data Available</Badge>
                                      ) : (
                                        <Badge className={
                                          performanceColor === 'green' ? "bg-green-100 text-green-700" : 
                                          performanceColor === 'yellow' ? "bg-yellow-100 text-yellow-700" : 
                                          "bg-red-100 text-red-700"
                                        }>
                                          {platform.roas.toFixed(2)}x ROAS
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {hasNoData ? (
                                    <p className="text-sm text-muted-foreground">No financial metrics available</p>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                        <div>
                                          <span className="text-muted-foreground">Spend:</span>
                                          <p className="font-medium">{formatCurrency(platform.spend)}</p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Conversions:</span>
                                          <p className="font-medium">{formatNumber(platform.conversions)}</p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Revenue:</span>
                                          <p className="font-medium">{formatCurrency(platform.revenue)}</p>
                                        </div>
                                      </div>
                                      <div className="flex justify-between text-sm mb-2">
                                        <span>Budget Share:</span>
                                        <span>{currentPercent.toFixed(1)}%</span>
                                      </div>
                                      <Progress value={currentPercent} className="h-2" />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Recommendations */}
                        {hasMultiplePlatforms ? (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Budget Optimization Recommendations</h4>
                            <div className="space-y-3">
                              {highPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                                  <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Scale High-Performing Platforms</p>
                                    <p className="text-sm text-muted-foreground">
                                      {highPerformance.map(p => p.name).join(', ')} {highPerformance.length === 1 ? 'is' : 'are'} generating exceptional ROAS ≥ 3.0x - consider increasing budget allocation
                                    </p>
                                  </div>
                                </div>
                              )}
                              {lowPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Optimize Underperforming Platforms</p>
                                    <p className="text-sm text-muted-foreground">
                                      {lowPerformance.map(p => p.name).join(', ')} showing ROAS below 1.0x - review targeting and creative or pause campaigns
                                    </p>
                                  </div>
                                </div>
                              )}
                              {highPerformance.length > 0 && lowPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                  <Calculator className="w-5 h-5 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Budget Reallocation Opportunity</p>
                                    <p className="text-sm text-muted-foreground">
                                      Reallocating budget from low to high-performing platforms could significantly improve overall campaign ROAS
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="border-t pt-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                              <p className="text-sm text-muted-foreground">
                                Budget reallocation recommendations will appear when multiple platforms have active spend
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>Financial Performance Insights</CardTitle>
                  <CardDescription>
                    Key insights and recommendations for financial optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const platforms = [
                      { 
                        name: 'LinkedIn Ads', 
                        spend: platformMetrics.linkedIn.spend, 
                        roas: linkedInROAS,
                        conversions: platformMetrics.linkedIn.conversions,
                        revenue: linkedInRevenue,
                        cpc: platformMetrics.linkedIn.clicks > 0 ? platformMetrics.linkedIn.spend / platformMetrics.linkedIn.clicks : 0,
                        cvr: platformMetrics.linkedIn.clicks > 0 ? (platformMetrics.linkedIn.conversions / platformMetrics.linkedIn.clicks) * 100 : 0
                      },
                      {
                        name: 'Meta Ads',
                        spend: platformMetrics.meta.spend,
                        roas: metaROAS,
                        conversions: platformMetrics.meta.conversions,
                        revenue: metaRevenue,
                        cpc: platformMetrics.meta.clicks > 0 ? platformMetrics.meta.spend / platformMetrics.meta.clicks : 0,
                        cvr: platformMetrics.meta.clicks > 0 ? (platformMetrics.meta.conversions / platformMetrics.meta.clicks) * 100 : 0
                      },
                      {
                        name: 'Custom Integration',
                        spend: platformMetrics.customIntegration.spend,
                        roas: customIntegrationROAS,
                        conversions: platformMetrics.customIntegration.conversions,
                        revenue: platformMetrics.customIntegration.conversions * fallbackAOV,
                        cpc: platformMetrics.customIntegration.clicks > 0 ? platformMetrics.customIntegration.spend / platformMetrics.customIntegration.clicks : 0,
                        cvr: platformMetrics.customIntegration.clicks > 0 ? (platformMetrics.customIntegration.conversions / platformMetrics.customIntegration.clicks) * 100 : 0
                      }
                    ];

                    const platformsWithSpend = platforms.filter(p => p.spend > 0);
                    const topPerformer = platformsWithSpend.length > 0 ? platformsWithSpend.reduce((a, b) => a.roas > b.roas ? a : b) : null;
                    const bottomPerformer = platformsWithSpend.length > 1 ? platformsWithSpend.reduce((a, b) => a.roas < b.roas ? a : b) : null;
                    
                    return (
                      <div className="space-y-6">
                        {/* Quick Summary Cards */}
                        <div className="space-y-4">
                          <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-300">Performance Summary</h4>
                            <p className="text-sm mt-1">
                              Your campaign is generating a {roas.toFixed(2)}x ROAS with {formatPercentage(roi)} ROI. 
                              {roi >= 20 ? " Excellent performance!" : roi >= 0 ? " Positive returns achieved." : " Consider optimization to improve profitability."}
                            </p>
                          </div>
                          
                          <div className="p-4 border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
                            <h4 className="font-semibold text-green-700 dark:text-green-300">Cost Efficiency</h4>
                            <p className="text-sm mt-1">
                              Your CPA of {formatCurrency(cpa)} is {cpa < 25 ? "excellent" : cpa < 50 ? "competitive" : "above average"}. 
                              {cpa < 25 ? " Continue current targeting strategy." : " Consider optimizing targeting to reduce acquisition costs."}
                            </p>
                          </div>
                          
                          <div className="p-4 border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20">
                            <h4 className="font-semibold text-orange-700 dark:text-orange-300">Budget Management</h4>
                            <p className="text-sm mt-1">
                              You've utilized {formatPercentage(budgetUtilization)} of your budget. 
                              {budgetUtilization > 80 ? " Consider increasing budget for high-performing campaigns." : " Pace is healthy with room for optimization."}
                            </p>
                          </div>
                        </div>
                        
                        {/* Platform Performance Insights */}
                        {platformsWithSpend.length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-4">Platform Performance Insights</h4>
                            <div className="space-y-3">
                              {topPerformer && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                    <h5 className="font-medium text-green-800 dark:text-green-300">Top Performer: {topPerformer.name}</h5>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <p>Generating {topPerformer.roas.toFixed(2)}x ROAS with {formatCurrency(topPerformer.spend)} spend</p>
                                    {topPerformer.roas >= 3 && (
                                      <p className="text-green-700 dark:text-green-200 font-medium">
                                        ✓ Exceptional performance - consider scaling budget allocation
                                      </p>
                                    )}
                                    {topPerformer.cvr > 0 && (
                                      <p>Conversion rate: {topPerformer.cvr.toFixed(2)}% | CPC: {formatCurrency(topPerformer.cpc)}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {bottomPerformer && bottomPerformer !== topPerformer && (
                                <div className={`p-4 rounded-lg ${bottomPerformer.roas < 1 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                  <div className="flex items-center space-x-2 mb-2">
                                    <AlertTriangle className={`w-5 h-5 ${bottomPerformer.roas < 1 ? 'text-red-600' : 'text-yellow-600'}`} />
                                    <h5 className={`font-medium ${bottomPerformer.roas < 1 ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                      Needs Attention: {bottomPerformer.name}
                                    </h5>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <p>Generating {bottomPerformer.roas.toFixed(2)}x ROAS with {formatCurrency(bottomPerformer.spend)} spend</p>
                                    {bottomPerformer.roas < 1 && (
                                      <p className="text-red-700 dark:text-red-200 font-medium">
                                        ⚠ Below break-even - review targeting and creative or pause campaigns
                                      </p>
                                    )}
                                    {bottomPerformer.roas >= 1 && bottomPerformer.roas < 3 && (
                                      <p className="text-yellow-700 dark:text-yellow-200 font-medium">
                                        → Moderate performance - test optimizations to improve efficiency
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {platformsWithSpend.length === 1 && platforms.length > 1 && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    <h5 className="font-medium text-blue-800 dark:text-blue-300">Platform Data Status</h5>
                                  </div>
                                  <p className="text-sm">
                                    {platformsWithSpend[0].name} generating financial metrics. {platforms.find(p => p.spend === 0 && p.conversions === 0)?.name} connected but no financial data available yet.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Key Opportunities */}
                        <div className="mt-6">
                          <h4 className="font-semibold mb-4">Key Opportunities</h4>
                          <div className="space-y-3">
                            {roas > 5 && (
                              <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                                <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Scale High-Performing Campaigns</p>
                                  <p className="text-sm text-muted-foreground">
                                    With {roas.toFixed(2)}x ROAS, consider increasing budget to maximize returns while maintaining performance
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {conversionRate < 5 && totalConversions > 10 && (
                              <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Conversion Rate Optimization</p>
                                  <p className="text-sm text-muted-foreground">
                                    Current CVR of {formatPercentage(conversionRate)} has room for improvement - test landing page variations and CTAs
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {ctr < 2 && totalClicks > 100 && (
                              <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Improve Ad Engagement</p>
                                  <p className="text-sm text-muted-foreground">
                                    CTR of {formatPercentage(ctr)} below industry average - test new ad creative and messaging
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {budgetUtilization > 85 && roas > 2 && (
                              <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                                <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Budget Capacity</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatPercentage(budgetUtilization)} budget utilized with positive ROAS - consider increasing budget allocation
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {platformsWithSpend.length === 0 && (
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground">
                                  No platform spending data available. Insights will appear when campaign data is collected.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
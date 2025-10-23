import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, TrendingUp, Target, Users, MousePointer, DollarSign, Eye, Clock, AlertCircle, Zap, Brain, GitCompare, Activity, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { format } from "date-fns";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];


export default function PlatformComparison() {
  const { id: campaignId } = useParams();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
  });

  // Get LinkedIn metrics
  const { data: linkedInData } = useQuery({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Get Custom Integration data
  const { data: customIntegrationData } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Campaign Not Found</h1>
              <p className="text-slate-600 dark:text-slate-400">Unable to load campaign data for platform comparison.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPerformanceBadge = (value: number, metric: string) => {
    let threshold = 0;
    if (metric === 'ctr') threshold = 1.5;
    if (metric === 'roas') threshold = 3.0;
    if (metric === 'conversionRate') threshold = 3.5;
    
    if (value >= threshold) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Excellent</Badge>;
    } else if (value >= threshold * 0.7) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Good</Badge>;
    } else {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Needs Improvement</Badge>;
    }
  };

  // Build platform metrics from real connected data
  const buildPlatformMetrics = () => {
    const platforms = [];
    const estimatedAOV = ga4Data?.averageOrderValue || linkedInData?.averageOrderValue || customIntegrationData?.metrics?.averageOrderValue || 50;

    // LinkedIn Platform
    if (linkedInData) {
      const linkedInSpend = linkedInData.spend || 0;
      const linkedInImpressions = linkedInData.impressions || 0;
      const linkedInClicks = linkedInData.clicks || 0;
      const linkedInConversions = linkedInData.conversions || 0;
      const linkedInCTR = linkedInImpressions > 0 ? (linkedInClicks / linkedInImpressions) * 100 : 0;
      const linkedInCPC = linkedInClicks > 0 ? linkedInSpend / linkedInClicks : 0;
      const linkedInConvRate = linkedInClicks > 0 ? (linkedInConversions / linkedInClicks) * 100 : 0;
      const linkedInRevenue = linkedInConversions * estimatedAOV;
      const linkedInROAS = linkedInSpend > 0 ? linkedInRevenue / linkedInSpend : 0;
      const linkedInROI = linkedInSpend > 0 ? ((linkedInRevenue - linkedInSpend) / linkedInSpend) * 100 : 0;

      platforms.push({
        platform: 'LinkedIn Ads',
        impressions: linkedInImpressions,
        clicks: linkedInClicks,
        conversions: linkedInConversions,
        spend: linkedInSpend,
        ctr: linkedInCTR,
        cpc: linkedInCPC,
        conversionRate: linkedInConvRate,
        roas: linkedInROAS,
        roi: linkedInROI,
        qualityScore: 0,
        reach: linkedInData.reach || 0,
        engagement: linkedInData.engagements || 0,
        color: '#0077b5'
      });
    }

    // Custom Integration Platform
    if (customIntegrationData?.metrics) {
      const customSpend = parseFloat(customIntegrationData.metrics.spend || '0');
      const customImpressions = customIntegrationData.metrics.impressions || 0;
      const customClicks = customIntegrationData.metrics.clicks || 0;
      const customConversions = customIntegrationData.metrics.conversions || 0;
      const customCTR = customImpressions > 0 ? (customClicks / customImpressions) * 100 : 0;
      const customCPC = customClicks > 0 ? customSpend / customClicks : 0;
      const customConvRate = customClicks > 0 ? (customConversions / customClicks) * 100 : 0;
      const customRevenue = customConversions * estimatedAOV;
      const customROAS = customSpend > 0 ? customRevenue / customSpend : 0;
      const customROI = customSpend > 0 ? ((customRevenue - customSpend) / customSpend) * 100 : 0;

      platforms.push({
        platform: 'Custom Integration',
        impressions: customImpressions,
        clicks: customClicks,
        conversions: customConversions,
        spend: customSpend,
        ctr: customCTR,
        cpc: customCPC,
        conversionRate: customConvRate,
        roas: customROAS,
        roi: customROI,
        qualityScore: 0,
        reach: customIntegrationData.metrics.reach || 0,
        engagement: customIntegrationData.metrics.engagements || 0,
        color: '#8b5cf6'
      });
    }

    return platforms;
  };

  const realPlatformMetrics = buildPlatformMetrics();

  // Generate cost analysis data
  const costAnalysisData = realPlatformMetrics.map(platform => ({
    name: platform.platform,
    costPerConversion: platform.conversions > 0 ? platform.spend / platform.conversions : 0,
    totalSpend: platform.spend,
    conversions: platform.conversions,
    efficiency: platform.spend > 0 ? ((platform.conversions / platform.spend) * 100).toFixed(2) : '0'
  }));

  // Generate performance rankings
  const getBestPerformer = (metric: 'roas' | 'roi' | 'conversions' | 'ctr' | 'cpc' | 'conversionRate') => {
    if (realPlatformMetrics.length === 0) return null;
    return realPlatformMetrics.reduce((best, current) => {
      if (metric === 'cpc') {
        // Find lowest CPC - zero is the absolute minimum
        if (current.cpc === 0 && best.cpc === 0) return best; // Both zero, keep first
        if (current.cpc === 0) return current; // Current is zero, it wins
        if (best.cpc === 0) return best; // Best is zero, it wins
        return current.cpc < best.cpc ? current : best; // Both non-zero, pick smaller
      }
      return current[metric] > best[metric] ? current : best;
    });
  };

  const bestROAS = getBestPerformer('roas');
  const bestROI = getBestPerformer('roi');
  const bestConversions = getBestPerformer('conversions');
  const bestCTR = getBestPerformer('ctr');
  const bestCPC = getBestPerformer('cpc');

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
                <Link href={`/campaigns/${(campaign as any)?.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Platform Comparison</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Comparison Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
              <TabsTrigger value="cost-analysis">Cost Analysis</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Platform Performance Summary Cards */}
              {realPlatformMetrics.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {realPlatformMetrics.map((platform, index) => (
                    <Card key={index} className="border-l-4" style={{ borderLeftColor: platform.color }} data-testid={`platform-card-${index}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {platform.platform}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Conversions</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(platform.conversions)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Spend</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(platform.spend)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">ROAS</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{platform.roas.toFixed(2)}x</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">ROI</span>
                          <div className="flex items-center space-x-1">
                            <span className={`font-semibold ${platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {platform.roi >= 0 ? '+' : ''}{platform.roi.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect LinkedIn or Custom Integration to see platform comparison.</p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Comparison Metrics */}
              {realPlatformMetrics.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {bestCTR && (
                    <Card data-testid="overview-best-ctr">
                      <CardHeader>
                        <CardTitle className="text-sm">Best CTR Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestCTR.platform}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestCTR.ctr.toFixed(2)}% average CTR</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Best
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {bestCPC && (
                    <Card data-testid="overview-lowest-cpc">
                      <CardHeader>
                        <CardTitle className="text-sm">Lowest CPC</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestCPC.platform}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{formatCurrency(bestCPC.cpc)} average CPC</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <ArrowDown className="w-3 h-3 mr-1" />
                            Efficient
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {bestROAS && (
                    <Card data-testid="overview-highest-roas">
                      <CardHeader>
                        <CardTitle className="text-sm">Highest ROAS</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestROAS.platform}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestROAS.roas.toFixed(1)}x return on ad spend</p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Top ROAS
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {bestROI && (
                    <Card data-testid="overview-highest-roi">
                      <CardHeader>
                        <CardTitle className="text-sm">Highest ROI</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestROI.platform}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestROI.roi >= 0 ? '+' : ''}{bestROI.roi.toFixed(1)}% profit margin</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Best Profit
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Performance Metrics Tab */}
            <TabsContent value="performance" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <>
                  {/* Key Performance Indicators Grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-600 dark:text-slate-400">Best CTR</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestCTR?.ctr.toFixed(2)}%</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestCTR?.platform}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Best
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-600 dark:text-slate-400">Lowest CPC</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(bestCPC?.cpc || 0)}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestCPC?.platform}</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Efficient
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-600 dark:text-slate-400">Best Conv. Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {realPlatformMetrics.reduce((best, p) => p.conversionRate > best.conversionRate ? p : best).conversionRate.toFixed(2)}%
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {realPlatformMetrics.reduce((best, p) => p.conversionRate > best.conversionRate ? p : best).platform}
                            </p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            <Target className="w-3 h-3 mr-1" />
                            Top CVR
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-600 dark:text-slate-400">Best ROI</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {bestROI?.roi >= 0 ? '+' : ''}{bestROI?.roi.toFixed(1)}%
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{bestROI?.platform}</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Best Profit
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Detailed Metrics Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BarChart3 className="w-5 h-5" />
                          <span>Detailed Performance Metrics</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {realPlatformMetrics.map((platform, index) => (
                            <div key={index} className="p-3 border rounded-lg dark:border-slate-700" data-testid={`metrics-detail-${index}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-slate-900 dark:text-white">{platform.platform}</span>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="block text-slate-500 font-medium">CTR</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{platform.ctr.toFixed(2)}%</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">CPC</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(platform.cpc)}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">Conv. Rate</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{platform.conversionRate.toFixed(2)}%</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 font-medium">ROI</span>
                                  <span className={`font-semibold ${platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {platform.roi >= 0 ? '+' : ''}{platform.roi.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Efficiency Comparison */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Activity className="w-5 h-5" />
                          <span>Efficiency Comparison</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {realPlatformMetrics.map((platform, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-900 dark:text-white">{platform.platform}</span>
                                <div className="flex items-center space-x-3">
                                  <span className="text-slate-600 dark:text-slate-400">{platform.roas.toFixed(2)}x ROAS</span>
                                  <span className={`font-medium ${platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {platform.roi >= 0 ? '+' : ''}{platform.roi.toFixed(1)}% ROI
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full transition-all" 
                                  style={{ 
                                    width: `${Math.min((platform.roas / 5) * 100, 100)}%`,
                                    backgroundColor: platform.color 
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>CPA: {formatCurrency(platform.conversions > 0 ? platform.spend / platform.conversions : 0)}</span>
                                <span>{formatNumber(platform.conversions)} Conv.</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Platform Volume Comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="w-5 h-5" />
                        <span>Volume & Reach Comparison</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={realPlatformMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="platform" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'var(--background)', 
                                border: '1px solid var(--border)',
                                borderRadius: '6px' 
                              }} 
                              formatter={(value, name) => [formatNumber(value as number), name]}
                            />
                            <Bar dataKey="impressions" fill="#3b82f6" name="Impressions" />
                            <Bar dataKey="clicks" fill="#10b981" name="Clicks" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect LinkedIn or Custom Integration to see performance metrics.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Cost Analysis Tab */}
            <TabsContent value="cost-analysis" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Cost Efficiency Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <DollarSign className="w-5 h-5" />
                          <span>Cost per Conversion</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={costAnalysisData}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="name" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'var(--background)', 
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px' 
                                }} 
                                formatter={(value) => [formatCurrency(value as number), "Cost per Conversion"]}
                              />
                              <Bar dataKey="costPerConversion" fill="#f59e0b" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Budget Allocation */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Target className="w-5 h-5" />
                          <span>Budget Allocation Efficiency</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {costAnalysisData.map((platform, index) => (
                            <div key={index} className="space-y-2" data-testid={`cost-allocation-${index}`}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900 dark:text-white">{platform.name}</span>
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {platform.efficiency} conversions per $100
                                </span>
                              </div>
                              <Progress value={parseFloat(platform.efficiency) * 2} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Total Spend: {formatCurrency(platform.totalSpend)}</span>
                                <span>{formatNumber(platform.conversions)} conversions</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ROI Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5" />
                        <span>Return on Investment Analysis</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {realPlatformMetrics.map((platform, index) => (
                          <div key={index} className="text-center p-4 border rounded-lg dark:border-slate-700" data-testid={`roi-card-${index}`}>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                              {platform.roas.toFixed(2)}x
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">{platform.platform}</div>
                            <Badge variant={platform.roas >= 4 ? "default" : platform.roas >= 3 ? "secondary" : "outline"}>
                              {platform.roas >= 4 ? "Excellent" : platform.roas >= 3 ? "Good" : "Fair"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect LinkedIn or Custom Integration to see cost analysis.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {realPlatformMetrics.length > 0 ? (
                <div className="grid gap-6">
                  {/* AI-Powered Platform Insights */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="w-5 h-5" />
                        <span>Platform Performance Insights</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Top Performer Insight */}
                        {bestROAS && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="insight-top-performer">
                            <div className="flex items-start space-x-3">
                              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Top Performer: {bestROAS.platform}</h4>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                  {bestROAS.platform} delivers the highest ROAS at {bestROAS.roas.toFixed(2)}x with {formatNumber(bestROAS.conversions)} conversions. 
                                  {bestROAS.roas >= 3 
                                    ? ` This excellent performance suggests allocating 20-30% more budget to scale results.`
                                    : ` Consider optimizing this channel further to improve returns.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Volume Leader Insight */}
                        {bestConversions && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="insight-volume-leader">
                            <div className="flex items-start space-x-3">
                              <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Volume Leader: {bestConversions.platform}</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  {bestConversions.platform} generates the most conversions with {formatNumber(bestConversions.conversions)} total. 
                                  {bestConversions.impressions > 0 && ` With ${formatNumber(bestConversions.impressions)} impressions, this platform provides strong reach.`}
                                  {bestConversions.conversions === bestROAS?.conversions 
                                    ? ` Combining high volume with top ROAS makes this your strongest channel.`
                                    : ` Focus on improving efficiency to match top ROAS performance.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Engagement Quality Insight */}
                        {bestCTR && (
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg" data-testid="insight-engagement">
                            <div className="flex items-start space-x-3">
                              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Highest Engagement: {bestCTR.platform}</h4>
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                  {bestCTR.platform} has the best CTR at {bestCTR.ctr.toFixed(2)}%, indicating strong ad relevance and audience targeting. 
                                  {bestCTR.conversionRate >= 2 
                                    ? ` Combined with ${bestCTR.conversionRate.toFixed(2)}% conversion rate, this channel shows excellent quality traffic.`
                                    : ` Optimize landing pages to convert this engaged traffic more effectively.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Opportunity/Warning Insight */}
                        {realPlatformMetrics.length > 1 && (() => {
                          const weakest = realPlatformMetrics.reduce((min, p) => p.roas < min.roas ? p : min);
                          const roasGap = bestROAS && bestROAS.roas > 0 ? ((bestROAS.roas - weakest.roas) / bestROAS.roas * 100) : 0;
                          
                          return roasGap > 30 ? (
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg" data-testid="insight-optimization">
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                                <div>
                                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Optimization Opportunity: {weakest.platform}</h4>
                                  <p className="text-sm text-orange-700 dark:text-orange-300">
                                    {weakest.platform} ROAS of {weakest.roas.toFixed(2)}x is {roasGap.toFixed(0)}% below top performer. 
                                    {weakest.ctr < 1 
                                      ? ` Low CTR (${weakest.ctr.toFixed(2)}%) suggests creative refresh or audience refinement needed.`
                                      : weakest.conversionRate < 2
                                        ? ` Decent engagement but poor conversion suggests landing page optimization required.`
                                        : ` Review targeting and bidding strategy to improve efficiency.`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategic Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Strategic Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Budget Reallocation */}
                        {realPlatformMetrics.length > 1 && bestROAS && (
                          <div className="border-l-4 border-green-500 pl-4">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Budget Reallocation Strategy</h4>
                            <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                              {realPlatformMetrics.map((platform, idx) => {
                                const isTop = platform.platform === bestROAS.platform;
                                const isWeakest = platform.roas === Math.min(...realPlatformMetrics.map(p => p.roas));
                                
                                if (isTop && platform.roas >= 3) {
                                  return (
                                    <li key={idx} data-testid={`rec-budget-${idx}`}>
                                      • Increase {platform.platform} budget by 20-30% (highest ROAS at {platform.roas.toFixed(2)}x)
                                    </li>
                                  );
                                } else if (isWeakest && platform.roas < 2) {
                                  return (
                                    <li key={idx} data-testid={`rec-budget-${idx}`}>
                                      • Reduce {platform.platform} budget by 15-20% until performance improves (ROAS: {platform.roas.toFixed(2)}x)
                                    </li>
                                  );
                                } else {
                                  return (
                                    <li key={idx} data-testid={`rec-budget-${idx}`}>
                                      • Maintain {platform.platform} current budget (ROAS: {platform.roas.toFixed(2)}x)
                                    </li>
                                  );
                                }
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Platform-Specific Optimizations */}
                        <div className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Platform-Specific Optimizations</h4>
                          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                            {realPlatformMetrics.map((platform, idx) => {
                              let recommendation = '';
                              
                              if (platform.ctr < 1) {
                                recommendation = `${platform.platform}: Improve CTR (${platform.ctr.toFixed(2)}%) through creative refresh and A/B testing`;
                              } else if (platform.conversionRate < 2) {
                                recommendation = `${platform.platform}: Optimize landing pages to improve ${platform.conversionRate.toFixed(2)}% conversion rate`;
                              } else if (platform.cpc > 5) {
                                recommendation = `${platform.platform}: Reduce CPC (${formatCurrency(platform.cpc)}) through bid optimization and quality score improvements`;
                              } else if (platform.roas >= 4) {
                                recommendation = `${platform.platform}: Expand successful campaigns to similar audiences and regions`;
                              } else {
                                recommendation = `${platform.platform}: Test new ad formats and audience segments to scale performance`;
                              }
                              
                              return <li key={idx} data-testid={`rec-optimization-${idx}`}>• {recommendation}</li>;
                            })}
                          </ul>
                        </div>

                        {/* Performance Monitoring */}
                        <div className="border-l-4 border-purple-500 pl-4">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Performance Monitoring</h4>
                          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                            <li>• Set up automated alerts for ROAS drops below 3.0x</li>
                            <li>• Monitor CPC trends weekly for early optimization signals</li>
                            <li>• Track cross-platform attribution for holistic view</li>
                            <li>• Implement A/B testing schedule for continuous improvement</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-slate-600 dark:text-slate-400">
                    <p>No platform data available. Connect LinkedIn or Custom Integration to see insights and recommendations.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
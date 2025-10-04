import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');

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

  const formatNumber = (num: number) => num?.toLocaleString() || '0';
  const formatCurrency = (num: number) => `$${num?.toFixed(2) || '0.00'}`;
  const formatPercentage = (num: number) => `${num?.toFixed(2) || '0.00'}%`;

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (sessionLoading) {
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

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-slate-600 dark:text-slate-400">No session data found</p>
                  <Button 
                    onClick={() => setLocation(`/campaigns/${params?.id}`)} 
                    className="mt-4"
                  >
                    Return to Campaign
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { session, metrics, aggregated } = sessionData;

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
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {session.adAccountName} • {session.selectedCampaignsCount} campaigns • {session.selectedMetricsCount} metrics
                  </p>
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                      <Eye className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(aggregated?.totalImpressions || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                      <MousePointerClick className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(aggregated?.totalClicks || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                      <DollarSign className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(aggregated?.totalSpend || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatPercentage(aggregated?.avgCTR || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average CPC</CardTitle>
                      <DollarSign className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(aggregated?.avgCPC || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                      <Target className="w-4 h-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(aggregated?.totalConversions || 0)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Campaign Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Breakdown</CardTitle>
                    <CardDescription>Metrics by imported campaign</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {metrics && metrics.length > 0 ? (
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
                        ).map((campaign: any, index: number) => (
                          <div key={index} className="border-b pb-4 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-slate-900 dark:text-white">{campaign.name}</h4>
                              <span className={`text-xs px-2 py-1 rounded ${
                                campaign.status === 'active' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {campaign.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              {campaign.metrics.impressions && (
                                <div>
                                  <span className="text-slate-500">Impressions:</span>
                                  <span className="ml-2 font-medium">{formatNumber(campaign.metrics.impressions)}</span>
                                </div>
                              )}
                              {campaign.metrics.clicks && (
                                <div>
                                  <span className="text-slate-500">Clicks:</span>
                                  <span className="ml-2 font-medium">{formatNumber(campaign.metrics.clicks)}</span>
                                </div>
                              )}
                              {campaign.metrics.spend && (
                                <div>
                                  <span className="text-slate-500">Spend:</span>
                                  <span className="ml-2 font-medium">{formatCurrency(campaign.metrics.spend)}</span>
                                </div>
                              )}
                              {campaign.metrics.ctr && (
                                <div>
                                  <span className="text-slate-500">CTR:</span>
                                  <span className="ml-2 font-medium">{formatPercentage(campaign.metrics.ctr)}</span>
                                </div>
                              )}
                              {campaign.metrics.conversions && (
                                <div>
                                  <span className="text-slate-500">Conversions:</span>
                                  <span className="ml-2 font-medium">{formatNumber(campaign.metrics.conversions)}</span>
                                </div>
                              )}
                              {campaign.metrics.cpc && (
                                <div>
                                  <span className="text-slate-500">CPC:</span>
                                  <span className="ml-2 font-medium">{formatCurrency(campaign.metrics.cpc)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 text-center py-4">No metrics data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6" data-testid="content-kpis">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      LinkedIn Campaign KPIs
                    </CardTitle>
                    <CardDescription>
                      Create and monitor key performance indicators for your LinkedIn campaigns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        KPI tracking coming soon. You'll be able to set targets and monitor performance against your LinkedIn campaign metrics.
                      </p>
                      <Button disabled>Create KPI</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Benchmarks Tab */}
              <TabsContent value="benchmarks" className="space-y-6" data-testid="content-benchmarks">
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
                        Benchmark tracking coming soon. You'll be able to compare your LinkedIn campaign performance against industry standards.
                      </p>
                      <Button disabled>Create Benchmark</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ad Comparison Tab */}
              <TabsContent value="ads" className="space-y-6" data-testid="content-ads">
                {adsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : adsData && adsData.length > 0 ? (
                  (() => {
                    const selectedMetrics = sessionData?.session?.selectedMetricKeys || [];
                    const sortedAds = [...adsData].sort((a, b) => parseFloat(b.revenue || '0') - parseFloat(a.revenue || '0'));
                    const topAd = sortedAds[0];
                    const totalRevenue = sortedAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0);
                    const topAdRevenuePct = totalRevenue > 0 ? (parseFloat(topAd.revenue || '0') / totalRevenue * 100).toFixed(1) : 0;

                    // Prepare chart data with only selected metrics
                    const chartData = sortedAds.map(ad => {
                      const data: any = { name: ad.adName.substring(0, 20) };
                      if (selectedMetrics.includes('impressions') || selectedMetrics.length === 0) {
                        data.impressions = ad.impressions;
                      }
                      if (selectedMetrics.includes('clicks') || selectedMetrics.length === 0) {
                        data.clicks = ad.clicks;
                      }
                      if (selectedMetrics.includes('spend') || selectedMetrics.length === 0) {
                        data.spend = parseFloat(ad.spend);
                      }
                      if (selectedMetrics.includes('conversions') || selectedMetrics.length === 0) {
                        data.conversions = ad.conversions;
                      }
                      data.revenue = parseFloat(ad.revenue || '0');
                      if (selectedMetrics.includes('ctr') || selectedMetrics.length === 0) {
                        data.ctr = parseFloat(ad.ctr);
                      }
                      if (selectedMetrics.includes('cpc') || selectedMetrics.length === 0) {
                        data.cpc = parseFloat(ad.cpc);
                      }
                      return data;
                    });

                    return (
                      <div className="space-y-6">
                        {/* Top Performer Highlight */}
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800" data-testid="top-performer-card">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                  <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Top Revenue Driver</h3>
                                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{topAd.adName}</p>
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{topAd.campaignName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Revenue Generated</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(parseFloat(topAd.revenue || '0'))}</p>
                                <p className="text-xs text-slate-500 mt-1">{topAdRevenuePct}% of total revenue</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Performance Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Volume Metrics Chart */}
                          {(selectedMetrics.includes('impressions') || selectedMetrics.includes('clicks') || selectedMetrics.length === 0) && (
                            <Card data-testid="volume-metrics-chart">
                              <CardHeader>
                                <CardTitle className="text-base">Volume Metrics Comparison</CardTitle>
                                <CardDescription>Compare reach and engagement across ads</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                  <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Legend />
                                    {(selectedMetrics.includes('impressions') || selectedMetrics.length === 0) && (
                                      <Bar dataKey="impressions" fill="#3b82f6" name="Impressions" />
                                    )}
                                    {(selectedMetrics.includes('clicks') || selectedMetrics.length === 0) && (
                                      <Bar dataKey="clicks" fill="#10b981" name="Clicks" />
                                    )}
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          )}

                          {/* Revenue & Spend Chart */}
                          <Card data-testid="revenue-spend-chart">
                            <CardHeader>
                              <CardTitle className="text-base">Revenue vs Spend Analysis</CardTitle>
                              <CardDescription>Identify profitable ad campaigns</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                                  {(selectedMetrics.includes('spend') || selectedMetrics.length === 0) && (
                                    <Bar dataKey="spend" fill="#ef4444" name="Spend ($)" />
                                  )}
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Efficiency Metrics */}
                        {(selectedMetrics.includes('ctr') || selectedMetrics.includes('cpc') || selectedMetrics.length === 0) && (
                          <Card data-testid="efficiency-metrics-chart">
                            <CardHeader>
                              <CardTitle className="text-base">Efficiency Metrics</CardTitle>
                              <CardDescription>CTR and CPC performance trends</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  {(selectedMetrics.includes('ctr') || selectedMetrics.length === 0) && (
                                    <Line yAxisId="left" type="monotone" dataKey="ctr" stroke="#3b82f6" name="CTR (%)" />
                                  )}
                                  {(selectedMetrics.includes('cpc') || selectedMetrics.length === 0) && (
                                    <Line yAxisId="right" type="monotone" dataKey="cpc" stroke="#8b5cf6" name="CPC ($)" />
                                  )}
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {/* Revenue Leaderboard */}
                        <Card data-testid="revenue-leaderboard">
                          <CardHeader>
                            <CardTitle className="text-base">Revenue Leaderboard</CardTitle>
                            <CardDescription>Ads ranked by revenue performance</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {sortedAds.map((ad, index) => {
                                const revenue = parseFloat(ad.revenue || '0');
                                const revenuePct = totalRevenue > 0 ? (revenue / totalRevenue * 100).toFixed(1) : 0;
                                const isTop = index === 0;
                                const isBottom = index === sortedAds.length - 1;

                                return (
                                  <div 
                                    key={ad.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      isTop ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' :
                                      isBottom && sortedAds.length > 2 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                                      'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                    }`}
                                    data-testid={`leaderboard-ad-${index}`}
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                        isTop ? 'bg-green-500 text-white' :
                                        isBottom && sortedAds.length > 2 ? 'bg-red-500 text-white' :
                                        'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                                      }`}>
                                        {index + 1}
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium text-slate-900 dark:text-white">{ad.adName}</p>
                                        <p className="text-xs text-slate-500">{ad.campaignName}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(revenue)}</p>
                                      <p className="text-xs text-slate-500">{revenuePct}% of total</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Insights Panel */}
                        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" data-testid="insights-panel">
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              Key Insights
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  <span className="font-semibold">{topAd.adName}</span> is your top performer, generating {topAdRevenuePct}% of total revenue ({formatCurrency(parseFloat(topAd.revenue || '0'))}).
                                </p>
                              </div>
                              {sortedAds.length > 1 && (
                                <div className="flex items-start gap-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">
                                    Average revenue per ad: <span className="font-semibold">{formatCurrency(totalRevenue / sortedAds.length)}</span>
                                  </p>
                                </div>
                              )}
                              {sortedAds.length > 2 && (
                                <div className="flex items-start gap-3">
                                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5"></div>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">
                                    Bottom performer <span className="font-semibold">{sortedAds[sortedAds.length - 1].adName}</span> could benefit from optimization or budget reallocation.
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
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

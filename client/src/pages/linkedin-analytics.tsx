import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');
  const [selectedMetric, setSelectedMetric] = useState<string>('impressions');

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

  const { session, metrics, aggregated } = sessionData as any;

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

                    // Transform data: Create data points for each metric value
                    // Each point will have the metric name and values for each ad
                    const chartData = availableMetrics.map(metric => {
                      const point: any = { metric: metric.label };
                      sortedAds.forEach((ad, index) => {
                        const value = metric.key === 'spend' || metric.key === 'ctr' || metric.key === 'cpc' || metric.key === 'revenue'
                          ? parseFloat((ad as any)[metric.key] || '0')
                          : (ad as any)[metric.key] || 0;
                        point[ad.adName] = value;
                      });
                      return point;
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
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle>Ad Performance Comparison</CardTitle>
                                <CardDescription>
                                  Compare multiple ads across all metrics
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={450}>
                              <LineChart 
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="metric" 
                                  tick={{ fontSize: 12 }} 
                                  angle={-45}
                                  textAnchor="end"
                                  height={80}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip 
                                  formatter={(value: any, name: string) => {
                                    const metric = availableMetrics.find(m => m.label === chartData.find(d => Object.keys(d).includes(name))?.metric);
                                    return metric ? metric.format(value) : value;
                                  }}
                                />
                                <Legend />
                                {sortedAds.map((ad, index) => (
                                  <Line 
                                    key={ad.id}
                                    type="monotone"
                                    dataKey={ad.adName} 
                                    stroke={adColors[index % adColors.length]} 
                                    strokeWidth={2}
                                    dot={{ r: 5 }}
                                    name={ad.adName}
                                  />
                                ))}
                              </LineChart>
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

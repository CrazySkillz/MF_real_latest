import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";

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
                <Card>
                  <CardHeader>
                    <CardTitle>Ad Performance Comparison</CardTitle>
                    <CardDescription>
                      Compare individual ad performance and identify top revenue drivers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {adsLoading ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      </div>
                    ) : adsData && adsData.length > 0 ? (
                      <div className="space-y-3">
                        {adsData.map((ad: any, index: number) => {
                          const selectedMetrics = sessionData?.session?.selectedMetricKeys || [];
                          const metricConfig = [
                            { key: 'impressions', label: 'Impressions', value: ad.impressions, formatter: formatNumber },
                            { key: 'clicks', label: 'Clicks', value: ad.clicks, formatter: formatNumber },
                            { key: 'spend', label: 'Spend', value: parseFloat(ad.spend), formatter: formatCurrency },
                            { key: 'ctr', label: 'CTR', value: parseFloat(ad.ctr), formatter: formatPercentage },
                            { key: 'cpc', label: 'CPC', value: parseFloat(ad.cpc), formatter: formatCurrency },
                            { key: 'conversions', label: 'Conversions', value: ad.conversions, formatter: formatNumber },
                            { key: 'revenue', label: 'Revenue', value: parseFloat(ad.revenue || '0'), formatter: formatCurrency },
                          ].filter(metric => selectedMetrics.length === 0 || selectedMetrics.includes(metric.key));

                          const gridCols = metricConfig.length <= 3 ? 'md:grid-cols-3' : 
                                         metricConfig.length <= 4 ? 'md:grid-cols-4' : 
                                         metricConfig.length <= 5 ? 'md:grid-cols-5' : 'md:grid-cols-6';

                          return (
                            <div 
                              key={ad.id}
                              className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
                              data-testid={`ad-card-${index}`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-medium text-slate-900 dark:text-white">{ad.adName}</h4>
                                  <p className="text-sm text-slate-500">{ad.campaignName}</p>
                                </div>
                                {ad.revenue && parseFloat(ad.revenue) > 0 && (
                                  <div className="text-right">
                                    <p className="text-sm text-slate-500">Revenue</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(parseFloat(ad.revenue))}</p>
                                  </div>
                                )}
                              </div>
                              <div className={`grid grid-cols-2 ${gridCols} gap-3 text-sm`}>
                                {metricConfig.map(metric => (
                                  <div key={metric.key}>
                                    <p className="text-slate-500 mb-1">{metric.label}</p>
                                    <p className="font-medium">{metric.formatter(metric.value)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No ad performance data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

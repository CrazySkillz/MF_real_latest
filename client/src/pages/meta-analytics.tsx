import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Users, Video, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MetaAnalytics() {
  const [, params] = useRoute("/campaigns/:id/meta-analytics");
  const campaignId = params?.id;

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch Meta analytics");
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch revenue summary
  const { data: revenueSummary } = useQuery({
    queryKey: ["/api/meta", campaignId, "revenue", "summary"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/revenue/summary`);
      if (!response.ok) throw new Error("Failed to fetch revenue summary");
      return response.json();
    },
    enabled: !!campaignId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading Meta analytics...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No Meta analytics data available</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { summary, campaigns } = analyticsData;
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  // Prepare data for charts
  const campaignPerformanceData = campaigns.slice(0, 5).map((c: any) => ({
    name: c.campaign.name.length > 20 ? c.campaign.name.substring(0, 20) + '...' : c.campaign.name,
    spend: c.totals.spend,
    conversions: c.totals.conversions,
    clicks: c.totals.clicks,
  }));

  const objectiveDistribution = campaigns.reduce((acc: any, c: any) => {
    const objective = c.campaign.objective;
    if (!acc[objective]) {
      acc[objective] = { name: objective, value: 0, campaigns: 0 };
    }
    acc[objective].value += c.totals.spend;
    acc[objective].campaigns += 1;
    return acc;
  }, {});

  const objectiveData = Object.values(objectiveDistribution);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meta/Facebook Ads Analytics</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Ad Account: {analyticsData.adAccountName}
                </p>
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                Test Mode - Realistic Demo Data
              </Badge>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="ad-comparison">Ad Comparison</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.totalCampaigns} campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalImpressions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgCPM.toFixed(2)} CPM
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reach</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReach.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((summary.totalReach / summary.totalImpressions) * 100).toFixed(1)}% of impressions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgCTR.toFixed(2)}% CTR
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalConversions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${summary.costPerConversion.toFixed(2)} cost/conv
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Video Views</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalVideoViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Video engagement
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Section */}
          {revenueSummary && revenueSummary.hasRevenueTracking ? (
            <Card className="mb-8 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-green-800 dark:text-green-200">Revenue Tracking Active</CardTitle>
                    <CardDescription>
                      {revenueSummary.windowStartDate} to {revenueSummary.windowEndDate}
                      {revenueSummary.webhookRevenueUsed && " • Webhook Events (Highest Accuracy)"}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {revenueSummary.conversionValueSource === 'webhook_events' ? 'Webhook' :
                     revenueSummary.conversionValueSource === 'manual' ? 'Manual' :
                     revenueSummary.conversionValueSource === 'csv' ? 'CSV Import' : 'Derived'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                      ${revenueSummary.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Conversion Value</p>
                    <p className="text-3xl font-bold">${revenueSummary.conversionValue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                    <p className="text-3xl font-bold">
                      {summary.totalSpend > 0 ? (revenueSummary.totalRevenue / summary.totalSpend).toFixed(2) : '0.00'}x
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROI</p>
                    <p className="text-3xl font-bold">
                      {summary.totalSpend > 0 ? (((revenueSummary.totalRevenue - summary.totalSpend) / summary.totalSpend) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
                {revenueSummary.webhookEventCount && revenueSummary.webhookEventCount > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-4">
                    Using {revenueSummary.webhookEventCount} webhook conversion event(s) for highest accuracy
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-8 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Tracking Not Configured</CardTitle>
                <CardDescription>
                  Set up revenue tracking to unlock ROAS, ROI, and revenue-dependent metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  To enable revenue tracking for Meta campaigns, you can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <li>Manually enter revenue data for each campaign</li>
                  <li>Upload a CSV file with campaign revenue data (crosswalk matching)</li>
                  <li>Set up webhook integration for real-time conversion tracking</li>
                </ul>
                <Button variant="outline" size="sm">
                  Configure Revenue Tracking
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics - Derived Metrics */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key derived metrics across all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CTR</p>
                  <p className="text-xl font-bold">{summary.avgCTR.toFixed(2)}%</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <DollarSign className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPC</p>
                  <p className="text-xl font-bold">${summary.avgCPC.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Eye className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPM</p>
                  <p className="text-xl font-bold">${summary.avgCPM.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Users className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPP</p>
                  <p className="text-xl font-bold">${summary.avgCPP.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Frequency</p>
                  <p className="text-xl font-bold">{summary.avgFrequency.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Target className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Cost/Conv</p>
                  <p className="text-xl font-bold">${summary.costPerConversion.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Conv Rate</p>
                  <p className="text-xl font-bold">{summary.conversionRate.toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Campaigns - Card Layout */}
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns</CardTitle>
              <CardDescription>Detailed performance metrics for all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaignData: any) => {
                  const { campaign, totals } = campaignData;
                  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const formatNum = (v: number) => v.toLocaleString();
                  const formatPct = (v: number) => `${v.toFixed(2)}%`;

                  return (
                    <div key={campaign.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                      {/* Campaign header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">{campaign.name}</h4>
                          <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                            {campaign.status}
                          </Badge>
                          <span className="text-xs text-slate-500">{campaign.objective}</span>
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totals.spend || 0)}</span>
                      </div>

                      {/* Core metrics — prominent */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Impressions</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Reach</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.reach)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Clicks</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.clicks)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">CTR</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatPct(totals.ctr)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Conversions</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.conversions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Video Views</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.videoViews)}</p>
                        </div>
                      </div>

                      {/* Secondary metrics — smaller */}
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPC</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpc)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPM</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpm)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPP</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpp)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Frequency</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{totals.frequency.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Cost/Conv</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.costPerConversion)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Conv Rate</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatPct(totals.conversionRate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Total Spend</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.spend)}</p>
                        </div>
                      </div>

                      {/* Revenue metrics — only when tracking */}
                      {revenueSummary?.hasRevenueTracking && (
                        <div className="grid grid-cols-3 gap-4 pt-3 mt-3 border-t border-green-100 dark:border-green-900/30">
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Revenue</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(revenueSummary.totalRevenue / campaigns.length)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">ROAS</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">
                              {totals.spend > 0 ? ((revenueSummary.totalRevenue / campaigns.length) / totals.spend).toFixed(2) + 'x' : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">ROI</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">
                              {totals.spend > 0 ? (((revenueSummary.totalRevenue / campaigns.length) - totals.spend) / totals.spend * 100).toFixed(1) + '%' : 'N/A'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Demographics & Geographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Top Demographics</CardTitle>
                <CardDescription>Performance by age and gender (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.demographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Range</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].demographics.slice(0, 6).map((demo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{demo.ageRange}</TableCell>
                          <TableCell className="capitalize">{demo.gender}</TableCell>
                          <TableCell className="text-right">{demo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{demo.clicks.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
                <CardDescription>Performance by country (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.geographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].geographics.map((geo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{geo.country}</TableCell>
                          <TableCell className="text-right">{geo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{geo.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${geo.spend.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Placements */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Ad Placements</CardTitle>
              <CardDescription>Performance by placement (first campaign)</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns[0]?.placements && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placement</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns[0].placements.map((placement: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{placement.placement}</TableCell>
                        <TableCell className="text-right">{placement.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${placement.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.conversions.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="kpis" className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Track your Meta campaign KPIs and targets
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Target className="w-4 h-4 mr-2" />
                  Add KPI
                </Button>
              </div>

              {/* Executive Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total KPIs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">8</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-green-600">On Track</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">5</div>
                    <p className="text-xs text-slate-500 mt-1">62.5%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-orange-600">Needs Attention</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">2</div>
                    <p className="text-xs text-slate-500 mt-1">25%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-red-600">Behind</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">1</div>
                    <p className="text-xs text-slate-500 mt-1">12.5%</p>
                  </CardContent>
                </Card>
              </div>

              {/* Meta-specific KPI Templates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ROAS KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">ROAS (Return on Ad Spend)</CardTitle>
                      <Badge variant="default" className="bg-green-500">On Track</Badge>
                    </div>
                    <CardDescription>Target: 4.0x | Current: 4.5x</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">112.5%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Revenue</p>
                          <p className="font-semibold">$203,556</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Spend</p>
                          <p className="font-semibold">$45,234</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CTR KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CTR (Click-through Rate)</CardTitle>
                      <Badge variant="default" className="bg-green-500">On Track</Badge>
                    </div>
                    <CardDescription>Target: 1.2% | Current: 1.5%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">125%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Clicks</p>
                          <p className="font-semibold">42,847</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Impressions</p>
                          <p className="font-semibold">2,847,392</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CPM KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CPM (Cost per 1000 Impressions)</CardTitle>
                      <Badge variant="secondary" className="bg-orange-500 text-white">Needs Attention</Badge>
                    </div>
                    <CardDescription>Target: $12.00 | Current: $15.89</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">75.5%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Spend</p>
                          <p className="font-semibold">$45,234</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Impressions</p>
                          <p className="font-semibold">2,847,392</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Frequency KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Frequency</CardTitle>
                      <Badge variant="default" className="bg-green-500">On Track</Badge>
                    </div>
                    <CardDescription>Target: 1.5-2.5 | Current: 1.87</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">Optimal</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Impressions</p>
                          <p className="font-semibold">2,847,392</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Reach</p>
                          <p className="font-semibold">1,523,847</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CPA KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CPA (Cost per Acquisition)</CardTitle>
                      <Badge variant="destructive">Behind</Badge>
                    </div>
                    <CardDescription>Target: $25.00 | Current: $35.23</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">70.9%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: '71%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Spend</p>
                          <p className="font-semibold">$45,234</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Conversions</p>
                          <p className="font-semibold">1,284</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Conversion Rate KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Conversion Rate</CardTitle>
                      <Badge variant="default" className="bg-green-500">On Track</Badge>
                    </div>
                    <CardDescription>Target: 2.5% | Current: 3.0%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">120%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Conversions</p>
                          <p className="font-semibold">1,284</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Clicks</p>
                          <p className="font-semibold">42,847</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reach KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Reach</CardTitle>
                      <Badge variant="default" className="bg-green-500">On Track</Badge>
                    </div>
                    <CardDescription>Target: 1,200,000 | Current: 1,523,847</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">127%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Unique Users</p>
                          <p className="font-semibold">1,523,847</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Campaigns</p>
                          <p className="font-semibold">{summary.totalCampaigns}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Video View Rate KPI */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Video View Rate</CardTitle>
                      <Badge variant="secondary" className="bg-orange-500 text-white">Needs Attention</Badge>
                    </div>
                    <CardDescription>Target: 20% | Current: 14.9%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-medium">74.5%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Video Views</p>
                          <p className="font-semibold">{summary.totalVideoViews.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Impressions</p>
                          <p className="font-semibold">{summary.totalImpressions.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Industry Benchmarks</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Compare your Meta campaign performance against industry standards
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Add Benchmark
                </Button>
              </div>

              {/* Industry Selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Industry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default" className="cursor-pointer">E-commerce</Badge>
                    <Badge variant="outline" className="cursor-pointer">Lead Generation</Badge>
                    <Badge variant="outline" className="cursor-pointer">Brand Awareness</Badge>
                    <Badge variant="outline" className="cursor-pointer">Traffic</Badge>
                    <Badge variant="outline" className="cursor-pointer">Engagement</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* E-commerce Benchmarks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CTR Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CTR (Click-through Rate)</CardTitle>
                      <Badge variant="default" className="bg-green-500">Above Average</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-green-600">{summary.avgCTR.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Industry Avg</p>
                          <p className="text-2xl font-bold">1.1%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Top 25%</p>
                          <p className="text-2xl font-bold">1.8%</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '83%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your CTR is 36% above industry average. Excellent ad relevance and targeting.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* CPC Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CPC (Cost per Click)</CardTitle>
                      <Badge variant="default" className="bg-green-500">Above Average</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-green-600">${summary.avgCPC.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Industry Avg</p>
                          <p className="text-2xl font-bold">$1.45</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Top 25%</p>
                          <p className="text-2xl font-bold">$0.85</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your CPC is 27% below industry average. Strong cost efficiency.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* CPM Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">CPM (Cost per 1000 Impressions)</CardTitle>
                      <Badge variant="secondary" className="bg-orange-500 text-white">Below Average</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-orange-600">${summary.avgCPM.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Industry Avg</p>
                          <p className="text-2xl font-bold">$12.50</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Top 25%</p>
                          <p className="text-2xl font-bold">$9.25</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '58%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your CPM is 27% above industry average. Consider refining targeting or creative.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Conversion Rate Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Conversion Rate</CardTitle>
                      <Badge variant="default" className="bg-green-500">Above Average</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-green-600">{summary.conversionRate.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Industry Avg</p>
                          <p className="text-2xl font-bold">2.35%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Top 25%</p>
                          <p className="text-2xl font-bold">3.8%</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '79%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your conversion rate is 28% above industry average. Strong landing page and offer.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ROAS Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">ROAS (Return on Ad Spend)</CardTitle>
                      <Badge variant="default" className="bg-green-500">Above Average</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-green-600">4.5x</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Industry Avg</p>
                          <p className="text-2xl font-bold">3.2x</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Top 25%</p>
                          <p className="text-2xl font-bold">5.5x</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '82%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your ROAS is 41% above industry average. Excellent campaign ROI.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Frequency Benchmark */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Frequency</CardTitle>
                      <Badge variant="default" className="bg-green-500">Optimal</Badge>
                    </div>
                    <CardDescription>E-commerce Industry Standard</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Your Performance</p>
                          <p className="text-2xl font-bold text-green-600">{summary.avgFrequency.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Optimal Range</p>
                          <p className="text-2xl font-bold">1.5-2.5</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Ad Fatigue</p>
                          <p className="text-2xl font-bold">&gt;3.0</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Your frequency is in the optimal range. No ad fatigue detected.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Benchmark Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Performance Summary</CardTitle>
                  <CardDescription>How your campaigns compare to E-commerce industry standards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600">5</div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Above Average</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-orange-600">1</div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Below Average</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600">83%</div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Benchmarks Met</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ad-comparison" className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Comparison</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Compare performance across all Meta campaigns
                </p>
              </div>

              {/* Performance Rankings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Best Performing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-green-600">Product Launch - Holiday Sale</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">ROAS: 6.2x • CTR: 2.8%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Most Efficient
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-blue-600">Retargeting Campaign</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">CPC: $0.72 • CPM: $11.20</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      Needs Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-orange-600">Video Views Campaign</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">CTR: 0.8% • Conv Rate: 1.2%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign Performance & Spend by Objective Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Top 5 campaigns by spend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaignPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="spend" fill="#3b82f6" name="Spend ($)" />
                        <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Spend by Objective</CardTitle>
                    <CardDescription>Budget allocation across campaign types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={objectiveData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name}: $${entry.value.toFixed(0)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {objectiveData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Campaign Comparison - Card Layout */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Campaign Comparison</CardTitle>
                  <CardDescription>Side-by-side metrics for all campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaigns.map((campaignData: any) => {
                      const { campaign, totals } = campaignData;
                      const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      const formatNum = (v: number) => v.toLocaleString();
                      const formatPct = (v: number) => `${v.toFixed(2)}%`;
                      const performanceScore = (totals.ctr * 10 + totals.conversionRate * 5) / 2;
                      const performance = performanceScore > 20 ? 'excellent' : performanceScore > 15 ? 'good' : performanceScore > 10 ? 'average' : 'poor';

                      return (
                        <div key={campaign.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                          {/* Campaign header with performance badge */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-900 dark:text-white">{campaign.name}</h4>
                              <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                {campaign.status}
                              </Badge>
                              {performance === 'excellent' && <Badge variant="default" className="bg-green-500 text-xs">Excellent</Badge>}
                              {performance === 'good' && <Badge variant="default" className="bg-blue-500 text-xs">Good</Badge>}
                              {performance === 'average' && <Badge variant="secondary" className="text-xs">Average</Badge>}
                              {performance === 'poor' && <Badge variant="destructive" className="text-xs">Poor</Badge>}
                            </div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totals.spend || 0)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-3">{campaign.objective}</p>

                          {/* Core metrics — prominent */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Impressions</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.impressions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Reach</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.reach)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Clicks</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.clicks)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">CTR</p>
                              <p className={`text-base font-bold ${totals.ctr > 1.5 ? 'text-green-600' : totals.ctr < 1.0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                {formatPct(totals.ctr)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Conversions</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.conversions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Conv Rate</p>
                              <p className={`text-base font-bold ${totals.conversionRate > 3.0 ? 'text-green-600' : totals.conversionRate < 2.0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                {formatPct(totals.conversionRate)}
                              </p>
                            </div>
                          </div>

                          {/* Secondary metrics — smaller */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPC</p>
                              <p className={`text-sm font-semibold ${totals.cpc < 1.0 ? 'text-green-600' : totals.cpc > 1.5 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {formatCurrency(totals.cpc)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPM</p>
                              <p className={`text-sm font-semibold ${totals.cpm < 12 ? 'text-green-600' : totals.cpm > 18 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {formatCurrency(totals.cpm)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPP</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpp)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Frequency</p>
                              <p className={`text-sm font-semibold ${totals.frequency > 3.0 ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {totals.frequency.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Cost/Conv</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.costPerConversion)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Video Views</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatNum(totals.videoViews)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Comparison Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>CTR Comparison</CardTitle>
                    <CardDescription>Click-through rate across campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), ctr: c.totals.ctr }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="ctr" fill="#3b82f6" name="CTR (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Rate Comparison</CardTitle>
                    <CardDescription>Conversion rate across campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), convRate: c.totals.conversionRate }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="convRate" fill="#10b981" name="Conv Rate (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Insights</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  What changed, what to do next - AI-powered recommendations
                </p>
              </div>

              {/* Executive Financials */}
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Executive Financials</CardTitle>
                    <Badge variant="outline" className="text-blue-600 border-blue-600">Last 30 Days</Badge>
                  </div>
                  <CardDescription>Campaign performance summary and key metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`grid grid-cols-2 md:grid-cols-${revenueSummary?.hasRevenueTracking ? '5' : '4'} gap-6`}>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Spend</p>
                      <p className="text-3xl font-bold">${summary.totalSpend.toLocaleString()}</p>
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Across {summary.totalCampaigns} campaigns
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Conversions</p>
                      <p className="text-3xl font-bold">{summary.totalConversions.toLocaleString()}</p>
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {summary.avgConversionRate?.toFixed(2) || '0.00'}% conversion rate
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Cost per Conversion</p>
                      <p className="text-3xl font-bold">${summary.costPerConversion.toFixed(2)}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Average across campaigns
                      </p>
                    </div>
                    {revenueSummary?.hasRevenueTracking ? (
                      <>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
                          <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                            ${revenueSummary.totalRevenue.toLocaleString()}
                          </p>
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {revenueSummary.conversionValueSource === 'webhook_events' ? 'Webhook' :
                             revenueSummary.conversionValueSource === 'manual' ? 'Manual' :
                             revenueSummary.conversionValueSource === 'csv' ? 'CSV Import' : 'Derived'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                          <p className="text-3xl font-bold">
                            {summary.totalSpend > 0 ? (revenueSummary.totalRevenue / summary.totalSpend).toFixed(2) : '0.00'}x
                          </p>
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Return on ad spend
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                        <p className="text-xl font-bold text-slate-400">—</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Revenue tracking required
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong>Sources used:</strong> Meta Graph API (primary)
                      {revenueSummary?.hasRevenueTracking && ` • ${
                        revenueSummary.conversionValueSource === 'webhook_events' ? 'Webhook Events (Highest Accuracy)' :
                        revenueSummary.conversionValueSource === 'manual' ? 'Manual Revenue Entry' :
                        revenueSummary.conversionValueSource === 'csv' ? 'CSV Revenue Import' :
                        'Derived Revenue Calculations'
                      }`}
                      {revenueSummary?.webhookEventCount && revenueSummary.webhookEventCount > 0 &&
                        ` • ${revenueSummary.webhookEventCount} webhook event(s)`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Insights - 7-day vs 30-day Rollups */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trends</CardTitle>
                  <CardDescription>Comparing 7-day vs 30-day performance rollups</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">CTR</span>
                        <Badge variant="default" className="bg-green-500">+12%</Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">7-day avg</p>
                          <p className="font-semibold">1.68%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">30-day avg</p>
                          <p className="font-semibold">{summary.avgCTR.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">CPC</span>
                        <Badge variant="default" className="bg-green-500">-8%</Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">7-day avg</p>
                          <p className="font-semibold">$0.98</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">30-day avg</p>
                          <p className="font-semibold">${summary.avgCPC.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Conversion Rate</span>
                        <Badge variant="default" className="bg-green-500">+5%</Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">7-day avg</p>
                          <p className="font-semibold">3.15%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">30-day avg</p>
                          <p className="font-semibold">{summary.conversionRate.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* "What Changed, What to Do Next" Insights */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">What Changed, What to Do Next</h3>

                {/* Critical Insights */}
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <CardTitle className="text-lg text-red-700 dark:text-red-400">Critical: Ad Fatigue Detected</CardTitle>
                      <Badge variant="destructive" className="ml-auto">Action Required</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What Changed:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        "Brand Awareness Campaign" CTR declined from 1.2% to 0.7% over the past 14 days.
                        Frequency increased to 3.4 (above the 3.0 fatigue threshold).
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What to Do Next:</p>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                        <li>Refresh creative immediately - audience has seen ads too many times</li>
                        <li>Expand targeting to reach new users and reduce frequency</li>
                        <li>Consider pausing campaign for 3-5 days to reset audience fatigue</li>
                        <li>A/B test new ad copy and visuals to re-engage audience</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-red-200 dark:border-red-800">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-slate-500">Current Frequency</p>
                          <p className="font-semibold text-red-600">3.4</p>
                        </div>
                        <div>
                          <p className="text-slate-500">CTR Decline</p>
                          <p className="font-semibold text-red-600">-42%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Estimated Impact</p>
                          <p className="font-semibold">-$1,200/week</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Warning Insights */}
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <CardTitle className="text-lg text-orange-700 dark:text-orange-400">Warning: CPM Increasing</CardTitle>
                      <Badge variant="secondary" className="ml-auto bg-orange-500 text-white">Monitor Closely</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What Changed:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Average CPM increased by 18% in the last 7 days (from $13.45 to $15.89).
                        This suggests increased competition in your target audience or broader market saturation.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What to Do Next:</p>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                        <li>Review targeting to ensure you're not competing with yourself across campaigns</li>
                        <li>Test lower competition audience segments (lookalike 3-5% vs 1-2%)</li>
                        <li>Consider shifting budget to lower CPM placements (Stories, Reels)</li>
                        <li>Monitor for seasonal trends - CPM often increases during holidays/Q4</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-orange-200 dark:border-orange-800">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-slate-500">7-day CPM</p>
                          <p className="font-semibold text-orange-600">$15.89</p>
                        </div>
                        <div>
                          <p className="text-slate-500">30-day CPM</p>
                          <p className="font-semibold">$13.45</p>
                        </div>
                        <div>
                          <p className="text-slate-500">CPM Change</p>
                          <p className="font-semibold text-orange-600">+18%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Info/Positive Insights */}
                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <CardTitle className="text-lg text-green-700 dark:text-green-400">Success: Conversion Rate Improving</CardTitle>
                      <Badge variant="default" className="ml-auto bg-green-500">Keep Optimizing</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What Changed:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        "Lead Generation" and "Product Launch - Holiday Sale" campaigns saw conversion rate improvements of
                        15% and 22% respectively over the past 7 days. Meta's algorithm is optimizing well.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What to Do Next:</p>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                        <li>Increase budget for these high-performing campaigns by 15-20%</li>
                        <li>Duplicate winning ad sets with slight targeting variations</li>
                        <li>Analyze top-performing creatives and replicate successful elements</li>
                        <li>Scale gradually to maintain efficiency (max 20% budget increase per day)</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-green-200 dark:border-green-800">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-slate-500">7-day Conv Rate</p>
                          <p className="font-semibold text-green-600">3.15%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">30-day Conv Rate</p>
                          <p className="font-semibold">{summary.conversionRate.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Improvement</p>
                          <p className="font-semibold text-green-600">+5%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Audience Saturation Warning */}
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <CardTitle className="text-lg text-orange-700 dark:text-orange-400">Warning: Audience Saturation Risk</CardTitle>
                      <Badge variant="secondary" className="ml-auto bg-orange-500 text-white">Expand Targeting</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What Changed:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        "Retargeting Campaign" reach growth has plateaued - only 2% new reach in the past 7 days despite
                        active status. Potential audience size exhausted.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What to Do Next:</p>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                        <li>Expand retargeting window (30 days → 60-90 days)</li>
                        <li>Create lookalike audiences from your retargeting pool (1-3%)</li>
                        <li>Add engagement-based audiences (video viewers, page visitors)</li>
                        <li>Consider broadening interests or excluding recent converters</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-orange-200 dark:border-orange-800">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-slate-500">7-day Reach Growth</p>
                          <p className="font-semibold text-orange-600">+2%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">30-day Reach Growth</p>
                          <p className="font-semibold">+18%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Saturation Risk</p>
                          <p className="font-semibold text-orange-600">High</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Budget Pacing Info */}
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <CardTitle className="text-lg text-blue-700 dark:text-blue-400">Info: Budget Pacing On Track</CardTitle>
                      <Badge variant="outline" className="ml-auto text-blue-600 border-blue-600">On Schedule</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What Changed:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        All campaigns are pacing appropriately against their budgets. Average spend is 96% of daily budget,
                        indicating healthy delivery without under-spending or overspending.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">What to Do Next:</p>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                        <li>Continue monitoring - no action needed at this time</li>
                        <li>If under-spending persists (&lt;80%), consider expanding targeting or raising bids</li>
                        <li>If over-spending occurs (&gt;110%), review campaign settings and budget caps</li>
                        <li>Reallocate budgets from low-performing to high-performing campaigns quarterly</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-slate-500">Budget Used</p>
                          <p className="font-semibold text-blue-600">96%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Days Remaining</p>
                          <p className="font-semibold">7 days</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Pacing</p>
                          <p className="font-semibold text-green-600">Healthy</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations Summary */}
              <Card className="border-slate-300 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg">Top 3 Recommended Actions</CardTitle>
                  <CardDescription>Prioritized by potential impact on ROAS</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-700 dark:text-red-400 font-bold">
                        1
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Refresh Creative on Brand Awareness Campaign</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Ad fatigue is causing 42% CTR decline and wasting ~$1,200/week. Immediate creative refresh could
                          recover 30-40% of lost performance.
                        </p>
                        <Badge variant="destructive" className="mt-2">High Impact • Urgent</Badge>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 font-bold">
                        2
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Scale Lead Gen & Product Launch Budgets</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          These campaigns show 15-22% conversion rate improvements. Increasing budgets by 20% could generate
                          50-80 additional conversions per week.
                        </p>
                        <Badge variant="default" className="mt-2 bg-green-500">High Impact • Opportunity</Badge>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-700 dark:text-orange-400 font-bold">
                        3
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Optimize Targeting to Reduce CPM</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          18% CPM increase indicates auction competition. Testing lower-competition segments or alternative
                          placements could reduce costs by $800-1,200/month.
                        </p>
                        <Badge variant="secondary" className="mt-2 bg-orange-500 text-white">Medium Impact • Cost Savings</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduled Reports</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Automated Meta campaign reports delivered to your inbox
                  </p>
                </div>
                <Button variant="default">
                  <Target className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
              </div>

              {/* Active Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Report Schedules</CardTitle>
                  <CardDescription>Currently scheduled automated reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Weekly Executive Summary */}
                    <div className="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Weekly Executive Summary</h4>
                          <Badge variant="default" className="bg-blue-500">Weekly</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          High-level overview of all Meta campaigns, key metrics, and weekly insights
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Schedule:</span> Every Monday at 8:00 AM
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Recipients:</span> executive@company.com, marketing@company.com
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Format:</span> PDF + CSV
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Next Run:</span> Feb 24, 2026
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Send Now</Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Delete</Button>
                      </div>
                    </div>

                    {/* Monthly ROI Report */}
                    <div className="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Monthly ROI Report</h4>
                          <Badge variant="secondary">Monthly</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          Complete month-over-month performance analysis with ROAS, spend, and revenue tracking
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Schedule:</span> 1st of every month at 9:00 AM
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Recipients:</span> cfo@company.com, cmo@company.com
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Format:</span> PDF
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Next Run:</span> Mar 1, 2026
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Send Now</Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Delete</Button>
                      </div>
                    </div>

                    {/* Daily Performance Alert */}
                    <div className="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Daily Performance Alert</h4>
                          <Badge variant="outline">Daily</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          Quick snapshot of yesterday's performance - spend, conversions, and anomaly alerts
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Schedule:</span> Every day at 7:00 AM
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Recipients:</span> marketing-team@company.com
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Format:</span> Email only
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Next Run:</span> Tomorrow, 7:00 AM
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Send Now</Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Delete</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Report Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Report Templates</CardTitle>
                  <CardDescription>Pre-configured templates to get started quickly</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Campaign Performance Summary */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Campaign Performance Summary</h4>
                          <Badge variant="outline" className="text-xs">Most Popular</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Overview of all campaigns with key metrics: spend, impressions, clicks, conversions, CTR, CPC, ROAS
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>

                    {/* Creative Performance Report */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="mb-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Creative Performance Report</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Ad-level breakdown with creative details, engagement metrics, and performance rankings
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>

                    {/* Audience Insights Report */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="mb-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Audience Insights Report</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Demographics, geographics, device, and placement breakdowns with performance comparisons
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>

                    {/* Budget Utilization Report */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="mb-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Budget Utilization Report</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Budget pacing analysis, spend vs allocation, and optimization recommendations
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>

                    {/* Conversion Funnel Analysis */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="mb-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Conversion Funnel Analysis</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Complete funnel from impressions → clicks → conversions with drop-off analysis
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>

                    {/* Competitive Analysis Report */}
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="mb-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Competitive Analysis Report</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Your metrics vs industry benchmarks, CPM trends, and competitive positioning
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Use Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Report History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Reports</CardTitle>
                  <CardDescription>Previously generated and sent reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Weekly Executive Summary</TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-blue-500">Weekly</Badge>
                        </TableCell>
                        <TableCell>Feb 17, 2026 at 8:00 AM</TableCell>
                        <TableCell className="text-sm text-slate-600">2 recipients</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">View</Button>
                            <Button variant="ghost" size="sm">Download PDF</Button>
                            <Button variant="ghost" size="sm">Download CSV</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Daily Performance Alert</TableCell>
                        <TableCell>
                          <Badge variant="outline">Daily</Badge>
                        </TableCell>
                        <TableCell>Feb 18, 2026 at 7:00 AM</TableCell>
                        <TableCell className="text-sm text-slate-600">5 recipients</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">View</Button>
                            <Button variant="ghost" size="sm">Download PDF</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Monthly ROI Report</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Monthly</Badge>
                        </TableCell>
                        <TableCell>Feb 1, 2026 at 9:00 AM</TableCell>
                        <TableCell className="text-sm text-slate-600">2 recipients</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">View</Button>
                            <Button variant="ghost" size="sm">Download PDF</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Creative Performance Report</TableCell>
                        <TableCell>
                          <Badge variant="outline">Ad-hoc</Badge>
                        </TableCell>
                        <TableCell>Jan 28, 2026 at 2:15 PM</TableCell>
                        <TableCell className="text-sm text-slate-600">1 recipient</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">View</Button>
                            <Button variant="ghost" size="sm">Download PDF</Button>
                            <Button variant="ghost" size="sm">Download CSV</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Export Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Export Current Data</CardTitle>
                  <CardDescription>Download Meta campaign data in your preferred format</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Export to CSV
                    </Button>
                    <Button variant="outline">
                      <Target className="w-4 h-4 mr-2" />
                      Export to PDF
                    </Button>
                    <Button variant="outline">
                      <Activity className="w-4 h-4 mr-2" />
                      Export to Excel
                    </Button>
                    <Button variant="outline">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Export to Google Sheets
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">
                    Exports include all campaigns, metrics, demographics, geographics, and placements for the selected date range (last 30 days)
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}


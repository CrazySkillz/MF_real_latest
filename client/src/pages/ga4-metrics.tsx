import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { SiGoogle } from "react-icons/si";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";

interface Campaign {
  id: string;
  name: string;
  platform?: string;
  status: string;
}

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
}

export default function GA4Metrics() {
  const [, params] = useRoute("/campaigns/:id/ga4-metrics");
  const campaignId = params?.id;
  const [dateRange, setDateRange] = useState("30days");

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Check GA4 connection status
  const { data: ga4Connection } = useQuery({
    queryKey: ["/api/ga4/check-connection", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/ga4/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  const { data: ga4Metrics, isLoading: ga4Loading, error: ga4Error } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch GA4 metrics');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'GA4 metrics request failed');
      }
      
      return {
        impressions: data.metrics.impressions || 0,
        clicks: data.metrics.clicks || 0,
        sessions: data.metrics.sessions || 0,
        pageviews: data.metrics.pageviews || 0,
        bounceRate: data.metrics.bounceRate || 0,
        averageSessionDuration: data.metrics.averageSessionDuration || 0,
        conversions: data.metrics.conversions || 0,
        propertyId: data.propertyId,
        lastUpdated: data.lastUpdated
      };
    },
  });

  // Sample time series data (in real implementation, this would come from API)
  const timeSeriesData = [
    { date: "Jan", sessions: 1250, pageviews: 3400, conversions: 45 },
    { date: "Feb", sessions: 1680, pageviews: 4200, conversions: 62 },
    { date: "Mar", sessions: 1420, pageviews: 3800, conversions: 51 },
    { date: "Apr", sessions: 1890, pageviews: 4800, conversions: 78 },
    { date: "May", sessions: 2100, pageviews: 5200, conversions: 89 },
    { date: "Jun", sessions: 1950, pageviews: 4900, conversions: 82 },
  ];

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  // If GA4 is not connected, show connection flow
  if (!ga4Connection?.connected) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-6">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics Metrics</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">for {campaign.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                  <SiGoogle className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Connect Google Analytics</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
                  Connect your Google Analytics account to view detailed metrics and insights for this campaign.
                </p>
                <GA4ConnectionFlow 
                  campaignId={campaign.id}
                  onConnectionSuccess={() => {
                    window.location.reload();
                  }}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <SiGoogle className="w-8 h-8 text-orange-500" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics</h1>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Detailed metrics for {campaign.name}</p>
                  {ga4Connection?.propertyId && (
                    <Badge variant="outline" className="mt-2">
                      Property ID: {ga4Connection.propertyId}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {ga4Loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : ga4Error ? (
            <Card className="mb-8">
              <CardContent className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Failed to Load Metrics</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{ga4Error.message}</p>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.sessions || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Page Views</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.pageviews || 0)}
                        </p>
                      </div>
                      <Globe className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Bounce Rate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(ga4Metrics?.bounceRate || 0)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg. Session Duration</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatDuration(ga4Metrics?.averageSessionDuration || 0)}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.conversions || 0)}
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-emerald-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Users</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.impressions || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Detailed Analytics */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="audience">Audience</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="conversions">Conversions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Sessions Over Time</CardTitle>
                        <CardDescription>Daily session trends for the selected period</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                              <YAxis stroke="#64748b" fontSize={12} />
                              <Line
                                type="monotone"
                                dataKey="sessions"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Page Views vs Sessions</CardTitle>
                        <CardDescription>Comparison of page views and sessions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                              <YAxis stroke="#64748b" fontSize={12} />
                              <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="pageviews" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="audience">
                  <Card>
                    <CardHeader>
                      <CardTitle>Audience Insights</CardTitle>
                      <CardDescription>Real-time audience data from your Google Analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                            {formatNumber(ga4Metrics?.impressions || 0)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Total Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                            {formatNumber(ga4Metrics?.sessions || 0)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Sessions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                            {ga4Metrics?.sessions && ga4Metrics?.impressions
                              ? (ga4Metrics.sessions / ga4Metrics.impressions).toFixed(2)
                              : "0.00"}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Sessions per User</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="behavior">
                  <Card>
                    <CardHeader>
                      <CardTitle>User Behavior</CardTitle>
                      <CardDescription>How users interact with your website</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Engagement Metrics</div>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Bounce Rate:</span>
                              <span className="font-medium">{formatPercentage(ga4Metrics?.bounceRate || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Avg. Session Duration:</span>
                              <span className="font-medium">{formatDuration(ga4Metrics?.averageSessionDuration || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Pages per Session:</span>
                              <span className="font-medium">
                                {ga4Metrics?.pageviews && ga4Metrics?.sessions
                                  ? (ga4Metrics.pageviews / ga4Metrics.sessions).toFixed(2)
                                  : "0.00"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Traffic Quality</div>
                          <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 mb-2">
                              {ga4Metrics?.bounceRate && ga4Metrics.bounceRate < 40 ? "Excellent" : 
                               ga4Metrics?.bounceRate && ga4Metrics.bounceRate < 60 ? "Good" : "Needs Improvement"}
                            </div>
                            <div className="text-sm text-green-800 dark:text-green-200">
                              Traffic Quality Score
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conversions">
                  <Card>
                    <CardHeader>
                      <CardTitle>Conversion Tracking</CardTitle>
                      <CardDescription>Goals and conversion metrics from Google Analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            {formatNumber(ga4Metrics?.conversions || 0)}
                          </div>
                          <div className="text-sm text-purple-800 dark:text-purple-200">Total Conversions</div>
                        </div>
                        <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {ga4Metrics?.conversions && ga4Metrics?.sessions
                              ? formatPercentage((ga4Metrics.conversions / ga4Metrics.sessions) * 100)
                              : "0.0%"}
                          </div>
                          <div className="text-sm text-blue-800 dark:text-blue-200">Conversion Rate</div>
                        </div>
                        <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-emerald-600 mb-2">
                            {ga4Metrics?.conversions && ga4Metrics?.impressions
                              ? formatPercentage((ga4Metrics.conversions / ga4Metrics.impressions) * 100)
                              : "0.0%"}
                          </div>
                          <div className="text-sm text-emerald-800 dark:text-emerald-200">User Conversion Rate</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Data freshness indicator */}
              {ga4Metrics?.lastUpdated && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span>Last updated: {new Date(ga4Metrics.lastUpdated).toLocaleString()}</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Live Data
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
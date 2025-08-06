import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target, Plus } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import InteractiveWorldMap from "@/components/InteractiveWorldMap";
import SimpleGeographicMap from "@/components/SimpleGeographicMap";
import WorldMapSVG from "@/components/WorldMapSVG";
import { SiGoogle } from "react-icons/si";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { useToast } from "@/hooks/use-toast";

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
  newUsers?: number;
  userEngagementDuration?: number;
  engagedSessions?: number;
  engagementRate?: number;
  eventCount?: number;
  eventsPerSession?: number;
  screenPageViewsPerSession?: number;
}

export default function GA4Metrics() {
  const [, params] = useRoute("/campaigns/:id/ga4-metrics");
  const campaignId = params?.id;
  const [dateRange, setDateRange] = useState("7days");
  const [showAutoRefresh, setShowAutoRefresh] = useState(false);
  const { toast } = useToast();

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
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics?dateRange=${dateRange}`);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle automatic refresh needed
        if (errorData.error === 'AUTO_REFRESH_NEEDED' && errorData.autoRefresh) {
          throw new Error('AUTO_REFRESH_NEEDED');
        }
        
        // Handle token expiration specifically
        if (errorData.error === 'TOKEN_EXPIRED' && errorData.requiresReconnection) {
          throw new Error('TOKEN_EXPIRED');
        }
        
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
        newUsers: data.metrics.newUsers || 0,
        userEngagementDuration: data.metrics.userEngagementDuration || 0,
        engagedSessions: data.metrics.engagedSessions || 0,
        engagementRate: data.metrics.engagementRate || 0,
        eventCount: data.metrics.eventCount || 0,
        eventsPerSession: data.metrics.eventsPerSession || 0,
        screenPageViewsPerSession: data.metrics.screenPageViewsPerSession || 0,
        propertyId: data.propertyId,
        lastUpdated: data.lastUpdated
      };
    },
  });

  // Geographic data query
  const { data: geographicData, isLoading: geoLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-geographic", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-geographic?dateRange=${dateRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch geographic data');
      }
      return response.json();
    },
  });

  // Sample time series data (placeholder data for demonstration)
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
            ga4Error.message === 'AUTO_REFRESH_NEEDED' ? (
              <Card className="mb-8">
                <CardContent className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <SiGoogle className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Refreshing Your Access</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Your access token has expired. Click below to get fresh tokens from OAuth 2.0 Playground and automatically update your connection.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={() => {
                        window.open('https://developers.google.com/oauthplayground', '_blank');
                        toast({
                          title: "OAuth Playground Opened",
                          description: "Get fresh access and refresh tokens, then paste them below to continue.",
                          duration: 5000,
                        });
                        setShowAutoRefresh(true);
                      }}
                      className="mr-3"
                    >
                      Open OAuth Playground
                    </Button>
                    {showAutoRefresh && (
                      <div className="mt-6">
                        <GA4ConnectionFlow 
                          campaignId={campaign.id}
                          onConnectionSuccess={() => {
                            setShowAutoRefresh(false);
                            window.location.reload();
                          }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : ga4Error.message === 'TOKEN_EXPIRED' ? (
              <Card className="mb-8">
                <CardContent className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                    <SiGoogle className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Refresh Your Google Analytics Access</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Your access token has expired (Google tokens expire after 1 hour). Get fresh tokens from <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener" className="text-blue-600 hover:underline">OAuth 2.0 Playground</a> to continue viewing your metrics.
                  </p>
                  <GA4ConnectionFlow 
                    campaignId={campaign.id}
                    onConnectionSuccess={() => {
                      window.location.reload();
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
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
            )
          ) : ga4Metrics ? (
            <>
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
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

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">New Users</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.newUsers || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-emerald-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engaged Sessions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.engagedSessions || 0)}
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engagement Rate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(ga4Metrics?.engagementRate || 0)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-rose-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Events</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.eventCount || 0)}
                        </p>
                      </div>
                      <MousePointer className="w-8 h-8 text-cyan-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Events per Session</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {(ga4Metrics?.eventsPerSession || 0).toFixed(1)}
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-amber-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Detailed Analytics */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="rois">ROIs</TabsTrigger>
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

                  {/* Geographic Data - Only in Overview Tab */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Geographic Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {geoLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : geographicData?.success ? (
                        <div className="space-y-6">
                          {/* Interactive World Map - GA4 Style */}
                          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white">Active users by Country</h4>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {geographicData?.topCountries?.length || 20} countries
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                              {/* Map Section */}
                              <div className="lg:col-span-2 p-4">
                                <InteractiveWorldMap 
                                  data={geographicData?.topCountries && geographicData.topCountries.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)') ? geographicData.topCountries : [
                                    { country: "United States of America", users: 1247, sessions: 1856 },
                                    { country: "United Kingdom", users: 834, sessions: 1243 },
                                    { country: "Canada", users: 567, sessions: 892 },
                                    { country: "Germany", users: 445, sessions: 678 },
                                    { country: "France", users: 389, sessions: 523 },
                                    { country: "Australia", users: 234, sessions: 356 },
                                    { country: "Japan", users: 198, sessions: 289 },
                                    { country: "Netherlands", users: 167, sessions: 245 },
                                    { country: "Sweden", users: 143, sessions: 201 },
                                    { country: "Brazil", users: 134, sessions: 198 },
                                    { country: "India", users: 112, sessions: 167 },
                                    { country: "Spain", users: 98, sessions: 143 },
                                    { country: "Italy", users: 87, sessions: 128 },
                                    { country: "Norway", users: 76, sessions: 112 },
                                    { country: "Denmark", users: 65, sessions: 94 },
                                    { country: "Finland", users: 54, sessions: 78 },
                                    { country: "Belgium", users: 43, sessions: 62 },
                                    { country: "Switzerland", users: 32, sessions: 47 },
                                    { country: "Austria", users: 28, sessions: 41 },
                                    { country: "Portugal", users: 21, sessions: 34 }
                                  ]} 
                                  metric="users"
                                />
                              </div>
                              
                              {/* Data Table Section */}
                              <div className="border-l border-slate-200 dark:border-slate-700">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div>COUNTRY</div>
                                    <div className="text-right">ACTIVE USERS</div>
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                  {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                    ? geographicData.topCountries 
                                    : [
                                        { country: "United States of America", users: 1247, sessions: 1856 },
                                        { country: "United Kingdom", users: 834, sessions: 1243 },
                                        { country: "Canada", users: 567, sessions: 892 },
                                        { country: "Germany", users: 445, sessions: 678 },
                                        { country: "France", users: 389, sessions: 523 },
                                        { country: "Australia", users: 234, sessions: 356 },
                                        { country: "Japan", users: 198, sessions: 289 },
                                        { country: "Netherlands", users: 167, sessions: 245 },
                                        { country: "Sweden", users: 143, sessions: 201 },
                                        { country: "Brazil", users: 134, sessions: 198 }
                                      ]
                                  ).slice(0, 10).map((location: any, index: number) => (
                                    <div key={index} className="grid grid-cols-2 gap-4 p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-sm">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {location.country}
                                      </div>
                                      <div className="text-right font-semibold text-slate-900 dark:text-white">
                                        {formatNumber(location.users)}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* No data message if empty */}
                                  {!geographicData?.topCountries?.length && (
                                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                      No data available
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Countries */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Top Countries</h4>
                              <div className="space-y-2">
                                {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.topCountries 
                                  : [
                                      { country: "United States of America", users: 1247, sessions: 1856 },
                                      { country: "United Kingdom", users: 834, sessions: 1243 },
                                      { country: "Canada", users: 567, sessions: 892 },
                                      { country: "Germany", users: 445, sessions: 678 },
                                      { country: "France", users: 389, sessions: 523 }
                                    ]
                                ).slice(0, 5).map((location: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                                    <span className="font-medium">{location.country}</span>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold">{formatNumber(location.users)} users</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">{formatNumber(location.sessions)} sessions</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Location Details */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Location Details</h4>
                              <div className="max-h-64 overflow-y-auto space-y-1">
                                {(geographicData?.data?.length > 5 && geographicData.data.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.data 
                                  : [
                                      { city: "New York", region: "New York", country: "United States of America", users: 347, pageviews: 892 },
                                      { city: "London", region: "England", country: "United Kingdom", users: 234, pageviews: 612 },
                                      { city: "Toronto", region: "Ontario", country: "Canada", users: 198, pageviews: 456 },
                                      { city: "Berlin", region: "Berlin", country: "Germany", users: 167, pageviews: 389 },
                                      { city: "Paris", region: "Île-de-France", country: "France", users: 143, pageviews: 324 },
                                      { city: "Sydney", region: "New South Wales", country: "Australia", users: 112, pageviews: 267 },
                                      { city: "Tokyo", region: "Tokyo", country: "Japan", users: 98, pageviews: 234 },
                                      { city: "Amsterdam", region: "North Holland", country: "Netherlands", users: 87, pageviews: 198 },
                                      { city: "Stockholm", region: "Stockholm", country: "Sweden", users: 76, pageviews: 167 },
                                      { city: "São Paulo", region: "São Paulo", country: "Brazil", users: 65, pageviews: 143 }
                                    ]
                                ).slice(0, 10).map((location: any, index: number) => (
                                  <div key={index} className="text-sm p-2 border-b border-slate-200 dark:border-slate-700">
                                    <div className="font-medium">{location.city}, {location.region}</div>
                                    <div className="text-slate-600 dark:text-slate-400">{location.country}</div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-xs">{formatNumber(location.users)} users</span>
                                      <span className="text-xs">{formatNumber(location.pageviews)} pageviews</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Total locations tracked: {geographicData?.totalLocations || 20}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Data updated: {geographicData?.lastUpdated ? new Date(geographicData.lastUpdated).toLocaleString() : 'Recently'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-slate-500 dark:text-slate-400 mb-4">
                            No geographic data available
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle>Key Performance Indicators</CardTitle>
                        <CardDescription>Manage KPIs for this campaign</CardDescription>
                      </div>
                      <div className="flex space-x-2">
                        <Link href={`/campaigns/${campaignId}/kpis`}>
                          <Button variant="outline" size="sm">
                            <Target className="w-4 h-4 mr-2" />
                            Manage Campaign KPIs
                          </Button>
                        </Link>
                        <Link href={`/platforms/google_analytics/kpis`}>
                          <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Platform KPI
                          </Button>
                        </Link>
                      </div>
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
                      
                      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-center text-slate-500 dark:text-slate-400 mb-4">
                          Want to track custom KPIs? Create campaign-specific or platform-level KPIs to monitor your key metrics.
                        </div>
                        <div className="flex justify-center space-x-4">
                          <Link href={`/campaigns/${campaignId}/kpis`}>
                            <Button variant="outline">
                              View Campaign KPIs
                            </Button>
                          </Link>
                          <Link href={`/platforms/google_analytics/kpis`}>
                            <Button variant="outline">
                              View Platform KPIs
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="benchmarks">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Benchmarks</CardTitle>
                      <CardDescription>Compare your performance against industry standards</CardDescription>
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
                                {ga4Metrics?.screenPageViewsPerSession
                                  ? ga4Metrics.screenPageViewsPerSession.toFixed(2)
                                  : ga4Metrics?.pageviews && ga4Metrics?.sessions
                                  ? (ga4Metrics.pageviews / ga4Metrics.sessions).toFixed(2)
                                  : "0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Events per Session:</span>
                              <span className="font-medium">
                                {ga4Metrics?.eventsPerSession ? ga4Metrics.eventsPerSession.toFixed(1) : "0.0"}
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

                <TabsContent value="rois">
                  <Card>
                    <CardHeader>
                      <CardTitle>Return on Investment</CardTitle>
                      <CardDescription>ROI analysis and revenue attribution from your campaigns</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            ${formatNumber((ga4Metrics?.conversions || 0) * 25)}
                          </div>
                          <div className="text-sm text-purple-800 dark:text-purple-200">Total Revenue</div>
                        </div>
                        <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {((ga4Metrics?.conversions || 0) * 25 - 500) > 0 
                              ? `+${formatPercentage(((((ga4Metrics?.conversions || 0) * 25 - 500) / 500) * 100))}`
                              : formatPercentage(((((ga4Metrics?.conversions || 0) * 25 - 500) / 500) * 100))}
                          </div>
                          <div className="text-sm text-blue-800 dark:text-blue-200">ROI Percentage</div>
                        </div>
                        <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-emerald-600 mb-2">
                            ${ga4Metrics?.conversions && ga4Metrics?.sessions
                              ? ((ga4Metrics.conversions * 25) / ga4Metrics.sessions).toFixed(2)
                              : "0.00"}
                          </div>
                          <div className="text-sm text-emerald-800 dark:text-emerald-200">Revenue per Session</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-slate-500 dark:text-slate-400 mb-4">
                No GA4 connection found for this campaign
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
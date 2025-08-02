import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Target } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiGoogle } from "react-icons/si";

interface Campaign {
  id: string;
  name: string;
  clientWebsite?: string;
  label?: string;
  budget?: string;
  type?: string;
  platform?: string;
  status: string;
  createdAt: string;
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

export default function CampaignAnalytics() {
  const [, params] = useRoute("/campaigns/:id/analytics");
  const campaignId = params?.id;

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

  const { data: ga4Metrics, isLoading: ga4Loading, error: ga4Error } = useQuery<GA4Metrics>({
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
        impressions: data.metrics.impressions,
        clicks: data.metrics.clicks,
        sessions: data.metrics.sessions,
        pageviews: data.metrics.pageviews,
        bounceRate: data.metrics.bounceRate,
        averageSessionDuration: data.metrics.averageSessionDuration,
        conversions: data.metrics.conversions,
      };
    },
  });

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const calculateCTR = () => {
    if (!ga4Metrics?.impressions || ga4Metrics.impressions === 0) return "0.00%";
    return `${((ga4Metrics.clicks / ga4Metrics.impressions) * 100).toFixed(2)}%`;
  };

  const calculateSessionsPerUser = () => {
    if (!ga4Metrics?.sessions || !ga4Metrics?.impressions || ga4Metrics.impressions === 0) return "0.00";
    return (ga4Metrics.sessions / ga4Metrics.impressions).toFixed(2);
  };

  if (campaignLoading || ga4Loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{campaign.name} - Analytics</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Google Analytics 4 Metrics</p>
                </div>
              </div>
            </div>
            
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-6">
                <SiGoogle className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Google Analytics Not Connected</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Connect your Google Analytics 4 property to view detailed metrics for this campaign.
              </p>
              <Link href={`/campaigns/${campaignId}`}>
                <Button>
                  Connect Google Analytics
                </Button>
              </Link>
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
            <div className="flex items-center space-x-4 mb-6">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{campaign.name} - Analytics</h1>
                <div className="flex items-center space-x-3 mt-2">
                  <div className="flex items-center space-x-2">
                    <SiGoogle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Google Analytics 4</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
                  {ga4Connection?.propertyName && (
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Property: {ga4Connection.propertyName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {ga4Error && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 mb-8">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100">Unable to fetch analytics data</h3>
                    <p className="text-sm text-red-700 dark:text-red-300">{(ga4Error as Error).message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Core Metrics */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Sessions</CardTitle>
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {ga4Metrics ? formatNumber(ga4Metrics.sessions) : '0'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total user sessions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Page Views</CardTitle>
                  <MousePointer className="w-6 h-6 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {ga4Metrics ? formatNumber(ga4Metrics.pageviews) : '0'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total page views
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Conversions</CardTitle>
                  <Target className="w-6 h-6 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {ga4Metrics ? formatNumber(ga4Metrics.conversions) : '0'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Goal completions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Metrics */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Bounce Rate</CardTitle>
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {ga4Metrics ? formatPercent(ga4Metrics.bounceRate) : '0.00%'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Single-page sessions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Session Duration</CardTitle>
                  <Clock className="w-6 h-6 text-indigo-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {ga4Metrics ? formatDuration(ga4Metrics.averageSessionDuration) : '0m 0s'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Average time on site
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Click-Through Rate</CardTitle>
                  <BarChart3 className="w-6 h-6 text-pink-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {calculateCTR()}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Clicks per impression
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Traffic Summary</CardTitle>
                <CardDescription>Key traffic and engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Users</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics ? formatNumber(ga4Metrics.impressions) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Sessions</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics ? formatNumber(ga4Metrics.sessions) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions per User</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {calculateSessionsPerUser()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Pages per Session</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics && ga4Metrics.sessions > 0 ? (ga4Metrics.pageviews / ga4Metrics.sessions).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
                <CardDescription>Conversion and engagement analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics && ga4Metrics.sessions > 0 ? formatPercent((ga4Metrics.conversions / ga4Metrics.sessions) * 100) : '0.00%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Click Rate</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics && ga4Metrics.impressions > 0 ? formatPercent((ga4Metrics.clicks / ga4Metrics.impressions) * 100) : '0.00%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Engagement Rate</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Metrics ? formatPercent(100 - ga4Metrics.bounceRate) : '0.00%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Property ID</span>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ga4Connection?.propertyId || 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Refresh Info */}
          <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Real-time Google Analytics Data</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Data is pulled directly from your Google Analytics 4 property. Metrics may take 24-48 hours to appear in GA4.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
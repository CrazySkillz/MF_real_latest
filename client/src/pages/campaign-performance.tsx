import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, TrendingUp, Target, Users, MousePointer, DollarSign, Eye, Clock, AlertCircle, Calendar, Activity, Zap, Brain } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { format } from "date-fns";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

// Mock performance data for comprehensive metrics
const generatePerformanceData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: format(date, 'MMM dd'),
      fullDate: format(date, 'yyyy-MM-dd'),
      impressions: Math.floor(Math.random() * 50000) + 10000,
      clicks: Math.floor(Math.random() * 2000) + 500,
      conversions: Math.floor(Math.random() * 100) + 20,
      spend: Math.floor(Math.random() * 1000) + 200,
      ctr: (Math.random() * 3 + 1).toFixed(2),
      cpc: (Math.random() * 2 + 0.5).toFixed(2),
      cpm: (Math.random() * 15 + 5).toFixed(2),
      roas: (Math.random() * 3 + 2).toFixed(2),
    });
  }
  return data;
};

const performanceData = generatePerformanceData();

const deviceBreakdown = [
  { name: 'Desktop', value: 45, color: '#3b82f6' },
  { name: 'Mobile', value: 40, color: '#10b981' },
  { name: 'Tablet', value: 15, color: '#f59e0b' },
];

const audienceSegments = [
  { name: '25-34 Years', performance: 85, spend: 45 },
  { name: '35-44 Years', performance: 92, spend: 35 },
  { name: '18-24 Years', performance: 78, spend: 20 },
];

const topKeywords = [
  { keyword: 'marketing analytics', impressions: 125000, clicks: 8500, ctr: 6.8, position: 2.3 },
  { keyword: 'digital advertising', impressions: 98000, clicks: 5200, ctr: 5.3, position: 3.1 },
  { keyword: 'campaign management', impressions: 87000, clicks: 4800, ctr: 5.5, position: 2.8 },
  { keyword: 'performance metrics', impressions: 76000, clicks: 4100, ctr: 5.4, position: 3.2 },
];

export default function CampaignPerformance() {
  const { id: campaignId } = useParams();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Debug logging
  console.log("Campaign Performance Debug:", { 
    campaignId, 
    campaign, 
    isLoading: campaignLoading, 
    error: campaignError 
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
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

  if (campaignError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-red-600 mb-2">Error Loading Campaign</h1>
              <p className="text-slate-600 dark:text-slate-400">{(campaignError as Error).message}</p>
              <p className="text-sm text-slate-500 mt-2">Campaign ID: {campaignId}</p>
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
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Campaign Not Found</h1>
              <p className="text-slate-600 dark:text-slate-400">The requested campaign could not be found.</p>
              <p className="text-sm text-slate-500 mt-2">Campaign ID: {campaignId}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Calculate key metrics from connected data sources
  // Prioritize Google Sheets data for advertising metrics, GA4 for web analytics
  const sheetsMetrics = (sheetsData as any)?.summary;
  const ga4Metrics = (ga4Data as any)?.metrics;
  
  // Use Google Sheets for advertising metrics (impressions, clicks, spend)
  const totalImpressions = sheetsMetrics?.impressions || 0;
  const totalClicks = sheetsMetrics?.clicks || ga4Metrics?.clicks || 0;
  const totalConversions = sheetsMetrics?.conversions || ga4Metrics?.conversions || 0;
  const totalSpend = sheetsMetrics?.budget || 0;
  
  // Calculate derived metrics
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0.00";
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : "0.00";
  const costPerConversion = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";
  
  // Additional GA4 metrics for web analytics
  const sessions = ga4Metrics?.sessions || 0;
  const pageviews = ga4Metrics?.pageviews || 0;
  const bounceRate = ga4Metrics?.bounceRate || 0;

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
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Performance Analysis</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
              <TabsTrigger value="audience">Audience Analysis</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Performance Indicators */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Impressions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalImpressions)}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">↗ +12.5% vs last period</p>
                      </div>
                      <Eye className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clicks</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalClicks)}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">↗ +8.3% vs last period</p>
                      </div>
                      <MousePointer className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalConversions)}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">↗ +15.7% vs last period</p>
                      </div>
                      <Target className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSpend)}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">↗ +5.2% vs last period</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Web Analytics Metrics from GA4 (when available) */}
              {ga4Metrics && (sessions > 0 || pageviews > 0) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Web Analytics</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(sessions)}</p>
                            <p className="text-xs text-slate-500 mt-1">From Google Analytics</p>
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
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(pageviews)}</p>
                            <p className="text-xs text-slate-500 mt-1">From Google Analytics</p>
                          </div>
                          <Eye className="w-8 h-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Bounce Rate</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bounceRate}%</p>
                            <p className="text-xs text-slate-500 mt-1">From Google Analytics</p>
                          </div>
                          <Activity className="w-8 h-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Performance Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Performance Trends (Last 30 Days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--background)', 
                            border: '1px solid var(--border)',
                            borderRadius: '6px' 
                          }} 
                        />
                        <Area type="monotone" dataKey="impressions" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="clicks" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Metrics Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">CTR</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{ctr}%</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Good
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">CPC</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">${cpc}</p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Average
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Conv. Rate</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{conversionRate}%</p>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        Excellent
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Cost/Conv.</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">${costPerConversion}</p>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        Good
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Detailed Metrics Tab */}
            <TabsContent value="metrics" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Device Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Device Performance</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deviceBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                            className="outline-none"
                          >
                            {deviceBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {deviceBreakdown.map((device, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: device.color }}></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{device.name}</span>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{device.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Keywords Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="w-5 h-5" />
                      <span>Top Performing Keywords</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topKeywords.map((keyword, index) => (
                        <div key={index} className="p-3 border rounded-lg dark:border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900 dark:text-white">{keyword.keyword}</span>
                            <Badge variant="outline">#{keyword.position}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="block font-medium">Impressions</span>
                              <span>{formatNumber(keyword.impressions)}</span>
                            </div>
                            <div>
                              <span className="block font-medium">Clicks</span>
                              <span>{formatNumber(keyword.clicks)}</span>
                            </div>
                            <div>
                              <span className="block font-medium">CTR</span>
                              <span>{keyword.ctr}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Conversion Funnel Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="font-medium text-slate-900 dark:text-white">Impressions</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatNumber(totalImpressions)}</span>
                      <Progress value={100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="font-medium text-slate-900 dark:text-white">Clicks</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatNumber(totalClicks)}</span>
                      <Progress value={totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <span className="font-medium text-slate-900 dark:text-white">Conversions</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatNumber(totalConversions)}</span>
                      <Progress value={totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0} className="w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audience Analysis Tab */}
            <TabsContent value="audience" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Audience Segments Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Audience Segments</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {audienceSegments.map((segment, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900 dark:text-white">{segment.name}</span>
                            <Badge variant={segment.performance > 90 ? "default" : segment.performance > 80 ? "secondary" : "outline"}>
                              {segment.performance}/100
                            </Badge>
                          </div>
                          <Progress value={segment.performance} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Performance Score</span>
                            <span>{segment.spend}% of total spend</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Geographic Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Time-based Performance</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData.slice(-7)}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--background)', 
                              border: '1px solid var(--border)',
                              borderRadius: '6px' 
                            }} 
                          />
                          <Bar dataKey="conversions" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Journey Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>User Journey Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">2.3</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Avg. Sessions to Convert</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">4.2 days</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Avg. Time to Convert</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">68%</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">First-Touch Attribution</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="grid gap-6">
                {/* AI-Powered Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="w-5 h-5" />
                      <span>AI-Powered Campaign Insights</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">High-Performing Keywords</h4>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Your "marketing analytics" keyword shows 68% higher CTR than industry average. Consider increasing bid to capture more volume.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Audience Optimization</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              The 35-44 age group shows 20% higher conversion rate. Consider reallocating 15% more budget to this segment for improved ROI.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Budget Efficiency</h4>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Mobile traffic shows higher engagement but lower conversion. Consider optimizing mobile landing pages to improve conversion rate.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Timing Optimization</h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              Peak performance occurs between 2-4 PM on weekdays. Consider dayparting to concentrate budget during high-converting hours.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Actionable Recommendations</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Immediate Actions</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Increase bid on "marketing analytics" keyword by 25%</li>
                          <li>• Pause underperforming ad variations with CTR below 2%</li>
                          <li>• A/B test mobile-optimized landing page variants</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Strategic Optimizations</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Develop remarketing campaigns for users who visited but didn't convert</li>
                          <li>• Create lookalike audiences based on high-value converters</li>
                          <li>• Implement dynamic product ads for e-commerce conversions</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Long-term Strategy</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Invest in video ad formats for better engagement rates</li>
                          <li>• Expand to additional high-performing geographic markets</li>
                          <li>• Develop omnichannel attribution model for better insights</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitive Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Competitive Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">Above Average</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">CTR Performance</div>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">+32% vs Industry</Badge>
                      </div>
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">Competitive</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">CPC Efficiency</div>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Market Average</Badge>
                      </div>
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">Excellent</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Conversion Rate</div>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">+18% vs Industry</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
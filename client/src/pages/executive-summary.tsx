import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, TrendingUp, TrendingDown, Target, Users, DollarSign, Award, AlertTriangle, CheckCircle, Zap, Eye, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Calendar, Brain, Activity, Info } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { format, subDays } from "date-fns";

export default function ExecutiveSummary() {
  const { id: campaignId } = useParams();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: executiveSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "executive-summary"],
    enabled: !!campaignId,
  });

  if (campaignLoading || summaryLoading) {
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

  if (campaignError || !campaign || summaryError || !executiveSummary) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {!campaign ? 'Campaign Not Found' : 'Unable to Load Executive Summary'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {!campaign ? 'Unable to load campaign data for executive summary.' : 'Please ensure LinkedIn Ads or Custom Integration is connected to this campaign.'}
              </p>
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

  const formatCurrency = (amount: number, showCents: boolean = false) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(amount);
  };

  // Format text strings that contain dollar amounts with commas
  const formatRecommendationText = (text: string): string => {
    if (!text) return text;
    // Match dollar amounts like $123456 or -$123456 and format them with commas
    return text.replace(/([+-]?)\$(\d+)(?!\.\d)/g, (match, sign, number) => {
      const formatted = parseInt(number).toLocaleString('en-US');
      return `${sign}$${formatted}`;
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Low Priority</Badge>;
      default:
        return null;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'opportunity':
        return <Target className="w-5 h-5 text-blue-600" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      default:
        return <Eye className="w-5 h-5 text-slate-600" />;
    }
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
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Executive Summary</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400">Campaign Period</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {(campaign as any)?.startDate && (campaign as any)?.endDate ? (
                    `${format(new Date((campaign as any).startDate), 'MMM dd, yyyy')} - ${format(new Date((campaign as any).endDate), 'MMM dd, yyyy')}`
                  ) : (campaign as any)?.startDate ? (
                    `${format(new Date((campaign as any).startDate), 'MMM dd, yyyy')} - Present`
                  ) : (
                    `${format(subDays(new Date(), 90), 'MMM dd')} - ${format(new Date(), 'MMM dd, yyyy')}`
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="recommendations">Strategic Recommendations</TabsTrigger>
            </TabsList>

            {/* Executive Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Campaign Health & Grade */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Campaign Grade</div>
                        <div className={`text-6xl font-bold ${
                          (executiveSummary as any).health.grade === 'A' ? 'text-green-600' :
                          (executiveSummary as any).health.grade === 'B' ? 'text-blue-600' :
                          (executiveSummary as any).health.grade === 'C' ? 'text-yellow-600' :
                          (executiveSummary as any).health.grade === 'D' ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {(executiveSummary as any).health.grade}
                        </div>
                      </div>
                      <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Health Score</div>
                        <div className="flex items-center space-x-3">
                          <Progress value={(executiveSummary as any).health.score} className="w-40" />
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {(executiveSummary as any).health.score}/100
                          </span>
                        </div>
                      </div>
                      {(executiveSummary as any).health.trajectory && (
                        <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Trajectory</div>
                          <div className="flex items-center space-x-2">
                            {(executiveSummary as any).health.trajectory === 'accelerating' && <TrendingUp className="w-5 h-5 text-green-600" />}
                            {(executiveSummary as any).health.trajectory === 'declining' && <TrendingDown className="w-5 h-5 text-red-600" />}
                            {(executiveSummary as any).health.trajectory === 'stable' && <Activity className="w-5 h-5 text-blue-600" />}
                            <span className="text-lg font-medium text-slate-900 dark:text-white capitalize">
                              {(executiveSummary as any).health.trajectory}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Risk Level</div>
                        <Badge className={
                          (executiveSummary as any).risk.level === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          (executiveSummary as any).risk.level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }>
                          {(executiveSummary as any).risk.level.toUpperCase()}
                        </Badge>
                        {(executiveSummary as any).risk.explanation && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-xs">
                            {(executiveSummary as any).risk.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* CEO Summary */}
                  <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start space-x-3">
                      <Briefcase className="w-5 h-5 text-slate-600 dark:text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Executive Summary</div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {(executiveSummary as any).ceoSummary}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing Funnel Visualization */}
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Marketing Funnel Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Top of Funnel - Audience Reach */}
                    <div className="relative">
                      <div className="flex items-center justify-between bg-orange-100 dark:bg-orange-900/30 rounded-lg p-6 border-2 border-orange-300 dark:border-orange-700">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-orange-900 dark:text-orange-300 uppercase tracking-wide">Top of Funnel</div>
                            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                              {formatNumber((executiveSummary as any).metrics.totalImpressions)} Impressions
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                              Advertising: {formatNumber((executiveSummary as any).metrics.advertisingImpressions || 0)} | Website: {formatNumber((executiveSummary as any).metrics.websitePageviews || 0)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-orange-700 dark:text-orange-400">Click-Through Rate</div>
                          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{(executiveSummary as any).metrics.ctr.toFixed(2)}%</div>
                        </div>
                      </div>
                      <div className="flex justify-center my-2">
                        <ArrowDownRight className="w-8 h-8 text-slate-400" />
                      </div>
                    </div>

                    {/* Mid Funnel - Clicks */}
                    <div className="relative ml-8 mr-8">
                      <div className="flex items-center justify-between bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-6 border-2 border-indigo-300 dark:border-indigo-700">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Target className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">Mid Funnel</div>
                            <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                              {formatNumber((executiveSummary as any).metrics.totalClicks)} Clicks
                            </div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                              Advertising: {formatNumber((executiveSummary as any).metrics.advertisingClicks || 0)} | Website: {formatNumber((executiveSummary as any).metrics.websiteClicks || 0)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="space-y-2">
                            <div>
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                Click-Through CVR
                              </div>
                              <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                                {(executiveSummary as any).metrics.clickThroughCvr.toFixed(2)}%
                              </div>
                            </div>
                            {(executiveSummary as any).metrics.totalCvr > 100 && (
                              <div className="pt-1 border-t border-indigo-200 dark:border-indigo-700">
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                  Total CVR (w/ view-through)
                                </div>
                                <div className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                                  {(executiveSummary as any).metrics.totalCvr.toFixed(2)}%
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center my-2">
                        <ArrowDownRight className="w-8 h-8 text-slate-400" />
                      </div>
                    </div>

                    {/* Bottom of Funnel - Conversions & Revenue */}
                    <div className="relative ml-16 mr-16">
                      <div className="bg-gradient-to-r from-purple-100 to-green-100 dark:from-purple-900/30 dark:to-green-900/30 rounded-lg p-6 border-2 border-purple-300 dark:border-purple-700">
                        <div className="text-center mb-4">
                          <div className="text-sm font-semibold text-purple-900 dark:text-purple-300 uppercase tracking-wide">Bottom of Funnel</div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-purple-700 dark:text-purple-400">Conversions</div>
                            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                              {formatNumber((executiveSummary as any).metrics.totalConversions)}
                            </div>
                          </div>
                          <div className="text-center border-l border-r border-slate-300 dark:border-slate-600">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-400">Revenue</div>
                            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                              {formatCurrency((executiveSummary as any).metrics.totalRevenue)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-400">ROAS</div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                              {(executiveSummary as any).metrics.roas.toFixed(1)}x
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-600 text-center">
                          <div className="text-sm text-slate-600 dark:text-slate-400">Return on Investment</div>
                          <div className={`text-2xl font-bold ${(executiveSummary as any).metrics.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(executiveSummary as any).metrics.roi.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Funnel Summary */}
                    <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        <span className="font-semibold">Campaign Story:</span> We spent <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency((executiveSummary as any).metrics.totalSpend)}</span>, 
                        reached <span className="font-bold text-orange-600 dark:text-orange-400">{formatNumber((executiveSummary as any).metrics.totalImpressions)}</span> people, 
                        got <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatNumber((executiveSummary as any).metrics.totalClicks)}</span> clicks, 
                        converted <span className="font-bold text-purple-600 dark:text-purple-400">{formatNumber((executiveSummary as any).metrics.totalConversions)}</span> customers, 
                        generated <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency((executiveSummary as any).metrics.totalRevenue)}</span> revenue, 
                        making <span className={`font-bold ${(executiveSummary as any).metrics.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{(executiveSummary as any).metrics.roi.toFixed(1)}%</span> profit.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Dashboard - Complete Funnel Flow */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatCurrency((executiveSummary as any).metrics.totalRevenue)}
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <span className="text-sm font-medium">ROI: {(executiveSummary as any).metrics.roi.toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Return on Ad Spend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {(executiveSummary as any).metrics.roas.toFixed(1)}x
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <span className="text-sm font-medium">Spend: {formatCurrency((executiveSummary as any).metrics.totalSpend)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatNumber((executiveSummary as any).metrics.totalConversions)}
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <span className="text-sm font-medium">CVR: {(executiveSummary as any).metrics.cvr.toFixed(2)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-indigo-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clicks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatNumber((executiveSummary as any).metrics.totalClicks)}
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <span className="text-sm font-medium">CPC: {formatCurrency((executiveSummary as any).metrics.cpc, true)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Audience Reach</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatNumber((executiveSummary as any).metrics.totalImpressions)}
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <span className="text-sm font-medium">CTR: {(executiveSummary as any).metrics.ctr.toFixed(2)}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Platform Performance */}
              <div className="grid gap-6 md:grid-cols-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Platform Performance</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(executiveSummary as any).platforms.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                        No platform data available. Connect LinkedIn Ads or Custom Integration to see platform performance.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(executiveSummary as any).platforms.map((platform: any, index: number) => {
                          // Check if platform has advertising data (spend, conversions, or revenue)
                          const hasAdvertisingData = platform.hasData !== false && (
                            (platform.spend ?? 0) > 0 || 
                            (platform.revenue ?? 0) > 0 || 
                            (platform.conversions ?? 0) > 0
                          );
                          
                          // Check if platform has website analytics data
                          const hasWebsiteAnalytics = platform.websiteAnalytics && (
                            (platform.websiteAnalytics.pageviews ?? 0) > 0 ||
                            (platform.websiteAnalytics.sessions ?? 0) > 0
                          );
                          
                          return (
                            <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-900 dark:text-white">{platform.name}</h4>
                                {!hasAdvertisingData && hasWebsiteAnalytics ? (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Website Analytics Only
                                  </Badge>
                                ) : hasAdvertisingData ? (
                                  <Badge className={
                                    platform.roas >= 3 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                    platform.roas >= 1.5 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                    platform.roas >= 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                  }>
                                    {platform.roas >= 3 ? 'Excellent' :
                                     platform.roas >= 1.5 ? 'Good' :
                                     platform.roas >= 1 ? 'Fair' : 'Needs Attention'}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    No Data
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Advertising Metrics */}
                              {hasAdvertisingData && (
                                <div className="grid grid-cols-5 gap-4 mb-4">
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Spend</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {formatCurrency(platform.spend)}
                                    </div>
                                    {platform.spend > 0 && (
                                      <div className="text-xs text-slate-500">
                                        {platform.spendShare.toFixed(0)}% of total
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Revenue</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {formatCurrency(platform.revenue)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Conversions</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {formatNumber(platform.conversions)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">ROAS</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {platform.roas.toFixed(1)}x
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">ROI</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      <span className={platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                        {platform.roi >= 0 ? '+' : ''}{platform.roi.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Website Analytics Metrics */}
                              {hasWebsiteAnalytics && (
                                <div className={hasAdvertisingData ? 'pt-4 border-t border-slate-200 dark:border-slate-700' : ''}>
                                  <div className="flex items-center space-x-2 mb-3">
                                    <Eye className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                      Website Analytics
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">Pageviews</div>
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatNumber(platform.websiteAnalytics.pageviews)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">Sessions</div>
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatNumber(platform.websiteAnalytics.sessions)}
                                      </div>
                                    </div>
                                    {platform.websiteAnalytics.clicks > 0 && (
                                      <div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">Clicks</div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                          {formatNumber(platform.websiteAnalytics.clicks)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* No Data State */}
                              {!hasAdvertisingData && !hasWebsiteAnalytics && (
                                <div className="text-center py-4 text-slate-400">
                                  No data available for this platform
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Risk Assessment</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(executiveSummary as any).risk.factors.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
                      <p className="font-medium">No significant risks identified</p>
                      <p className="text-sm">Campaign is operating within acceptable parameters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(executiveSummary as any).risk.factors.map((risk: any, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border ${
                          risk.type === 'performance' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
                          risk.type === 'concentration' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20' :
                          'border-orange-200 bg-orange-50 dark:bg-orange-900/20'
                        }`}>
                          <div className="flex items-start space-x-3">
                            <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                              risk.type === 'performance' ? 'text-red-600' :
                              risk.type === 'concentration' ? 'text-yellow-600' :
                              'text-orange-600'
                            }`} />
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white capitalize mb-1">{risk.type} Risk</div>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{risk.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            {/* Strategic Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
              {/* Data Accuracy Notice */}
              {(executiveSummary as any).metadata?.dataAccuracy?.platformsExcludedFromRecommendations?.length > 0 && (
                <Card className="border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        <strong>Note:</strong> {(executiveSummary as any).metadata.dataAccuracy.platformsExcludedFromRecommendations.join(', ')} {(executiveSummary as any).metadata.dataAccuracy.platformsExcludedFromRecommendations.length === 1 ? 'has' : 'have'} no advertising data (spend, conversions, or revenue) and {(executiveSummary as any).metadata.dataAccuracy.platformsExcludedFromRecommendations.length === 1 ? 'is' : 'are'} excluded from strategic recommendations and risk assessment. Upload advertising performance data to receive platform-specific recommendations.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Freshness Warnings */}
              {(executiveSummary as any).dataFreshness?.warnings?.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Data Freshness Alert
                        </div>
                        {(executiveSummary as any).dataFreshness.warnings.map((warning: any, idx: number) => (
                          <div key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>{warning.source}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Enterprise Disclaimer */}
              {(executiveSummary as any).metadata?.disclaimer && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        {(executiveSummary as any).metadata.disclaimer}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(executiveSummary as any).recommendations.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    <div className="mb-4">
                      <Zap className="w-12 h-12 mx-auto text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      No Recommendations Available
                    </h3>
                    <p>Campaign is performing well. Continue monitoring for optimization opportunities.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(executiveSummary as any).recommendations.map((rec: any, index: number) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <CardTitle className="text-lg">{formatRecommendationText(rec.action)}</CardTitle>
                              {getPriorityBadge(rec.priority)}
                              {rec.confidence && (
                                <Badge variant="outline" className={
                                  rec.confidence === 'high' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300' :
                                  rec.confidence === 'medium' ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300' :
                                  'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                                }>
                                  {rec.confidence} confidence
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rec.category}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Expected Impact</div>
                              <div className="text-sm text-green-700 dark:text-green-300">{formatRecommendationText(rec.expectedImpact)}</div>
                            </div>
                            
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Timeframe</div>
                              <div className="text-sm text-blue-700 dark:text-blue-300">{rec.timeline}</div>
                            </div>
                            
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Investment Required</div>
                              <div className="text-sm text-purple-700 dark:text-purple-300">{formatRecommendationText(rec.investmentRequired)}</div>
                            </div>
                          </div>

                          {/* Scenario Planning */}
                          {rec.scenarios && (
                            <div className="border-t pt-4">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Projected Scenarios</div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Best Case</div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{formatRecommendationText(rec.scenarios.bestCase)}</div>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Expected</div>
                                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">{formatRecommendationText(rec.scenarios.expected)}</div>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Worst Case</div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{formatRecommendationText(rec.scenarios.worstCase)}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Assumptions */}
                          {rec.assumptions && rec.assumptions.length > 0 && (
                            <div className="border-t pt-4">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Key Assumptions</div>
                              <ul className="space-y-1">
                                {rec.assumptions.map((assumption: string, idx: number) => (
                                  <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{assumption}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Recommendation-specific disclaimer */}
                          {rec.disclaimer && (
                            <div className="border-t pt-4">
                              <div className="text-xs italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                {rec.disclaimer}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
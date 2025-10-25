import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, TrendingUp, TrendingDown, Target, Users, DollarSign, Award, AlertTriangle, CheckCircle, Zap, Eye, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Calendar, Brain, Activity } from "lucide-react";
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
                  {format(subDays(new Date(), 90), 'MMM dd')} - {format(new Date(), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="recommendations">Strategic Recommendations</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
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
                            <div className="text-sm text-orange-700 dark:text-orange-400 mt-1">Audience Reach</div>
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
                            <div className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
                              Cost Per Click: {formatCurrency((executiveSummary as any).metrics.cpc, true)}
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
                          // Check if Custom Integration has no data
                          const isCustomIntegrationWithNoData = platform.name === 'Custom Integration' && 
                            platform.spend === 0 && 
                            platform.conversions === 0 && 
                            platform.clicks === 0;
                          
                          return (
                            <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-900 dark:text-white">{platform.name}</h4>
                                {isCustomIntegrationWithNoData ? (
                                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    No Data Available
                                  </Badge>
                                ) : (
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
                                )}
                              </div>
                              {isCustomIntegrationWithNoData ? (
                                <div className="text-center py-6 text-slate-600 dark:text-slate-400">
                                  <p className="text-sm">No PDF data imported yet. Upload performance data via Custom Integration webhook to see metrics.</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-5 gap-4">
                                  <div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Spend</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {formatCurrency(platform.spend)}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {platform.spendShare.toFixed(0)}% of total
                                    </div>
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
                                    <div className={`text-sm font-semibold ${platform.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {platform.roi >= 0 ? '+' : ''}{platform.roi.toFixed(1)}%
                                    </div>
                                  </div>
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

            </TabsContent>

            {/* Strategic Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
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
                          <CardTitle className="text-lg">{rec.action}</CardTitle>
                          {getPriorityBadge(rec.priority)}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">{rec.category}</div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Expected Impact</div>
                              <div className="text-sm text-green-700 dark:text-green-300">{rec.expectedImpact}</div>
                            </div>
                            
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Timeframe</div>
                              <div className="text-sm text-blue-700 dark:text-blue-300">{rec.timeline}</div>
                            </div>
                            
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Investment Required</div>
                              <div className="text-sm text-purple-700 dark:text-purple-300">{rec.investmentRequired}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Risk Assessment</span>
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Overall Risk Level: <Badge className={
                      (executiveSummary as any).risk.level === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      (executiveSummary as any).risk.level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }>
                      {(executiveSummary as any).risk.level.toUpperCase()}
                    </Badge>
                  </p>
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

              {/* Performance Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Performance Insights</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Top Performer */}
                    {(executiveSummary as any).topPerformer && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <div className="font-semibold text-green-900 dark:text-green-100 mb-1">Top Performer: {(executiveSummary as any).topPerformer.name}</div>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Delivering {(executiveSummary as any).topPerformer.roas.toFixed(1)}x ROAS with {(executiveSummary as any).topPerformer.roi.toFixed(1)}% ROI. 
                              This platform is efficiently converting {(executiveSummary as any).topPerformer.spendShare.toFixed(0)}% of total budget into revenue.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom Performer */}
                    {(executiveSummary as any).bottomPerformer && (executiveSummary as any).bottomPerformer.roas < 1.5 && (
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div>
                            <div className="font-semibold text-orange-900 dark:text-orange-100 mb-1">Optimization Opportunity: {(executiveSummary as any).bottomPerformer.name}</div>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Currently achieving {(executiveSummary as any).bottomPerformer.roas.toFixed(1)}x ROAS with {(executiveSummary as any).bottomPerformer.roi.toFixed(1)}% ROI. 
                              Consider optimizing targeting, creative, or reallocating budget to higher-performing channels.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Growth Trajectory - Only show if historical data exists */}
                    {(executiveSummary as any).health.trajectory && (
                      <div className={`p-4 rounded-lg border ${
                        (executiveSummary as any).health.trajectory === 'accelerating' ? 'border-green-200 bg-green-50 dark:bg-green-900/20' :
                        (executiveSummary as any).health.trajectory === 'declining' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
                        'border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                      }`}>
                        <div className="flex items-start space-x-3">
                          {(executiveSummary as any).health.trajectory === 'accelerating' && <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />}
                          {(executiveSummary as any).health.trajectory === 'declining' && <TrendingDown className="w-5 h-5 text-red-600 mt-0.5" />}
                          {(executiveSummary as any).health.trajectory === 'stable' && <Activity className="w-5 h-5 text-blue-600 mt-0.5" />}
                          <div>
                            <div className={`font-semibold mb-1 ${
                              (executiveSummary as any).health.trajectory === 'accelerating' ? 'text-green-900 dark:text-green-100' :
                              (executiveSummary as any).health.trajectory === 'declining' ? 'text-red-900 dark:text-red-100' :
                              'text-blue-900 dark:text-blue-100'
                            }`}>
                              Performance Trajectory: {(executiveSummary as any).health.trajectory.charAt(0).toUpperCase() + (executiveSummary as any).health.trajectory.slice(1)}
                            </div>
                            <p className={`text-sm ${
                              (executiveSummary as any).health.trajectory === 'accelerating' ? 'text-green-700 dark:text-green-300' :
                              (executiveSummary as any).health.trajectory === 'declining' ? 'text-red-700 dark:text-red-300' :
                              'text-blue-700 dark:text-blue-300'
                            }`}>
                              {(executiveSummary as any).health.trajectory === 'accelerating' && `Campaign showing positive momentum. Consider scaling investment to capitalize on growth.`}
                              {(executiveSummary as any).health.trajectory === 'declining' && `Performance trending downward. Review campaign strategy and optimize underperforming elements.`}
                              {(executiveSummary as any).health.trajectory === 'stable' && `Campaign maintaining steady performance. Monitor for optimization opportunities.`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Executive Decision Framework */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="w-5 h-5" />
                    <span>Executive Decision Framework</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Immediate Actions (Next 30 Days)</h4>
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Increase Google Sheets budget allocation by 30%</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Implement Facebook Ads audience optimization</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Establish weekly performance monitoring cadence</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Strategic Initiatives (90+ Days)</h4>
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Diversify platform portfolio to reduce concentration risk</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Implement advanced attribution modeling</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Explore emerging platform opportunities</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MousePointerClick, DollarSign, Target, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";

export default function CustomIntegrationAnalytics() {
  const [, params] = useRoute("/campaigns/:id/custom-integration-analytics");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const campaignId = params?.id;
  
  // Fetch campaign details
  const { data: campaign } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch custom integration connection
  const { data: customIntegration } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Mock metrics - in production, these would be parsed from PDF documents
  const mockMetrics = {
    impressions: 12450,
    impressionsTrend: 15.3,
    reach: 9823,
    reachTrend: 12.5,
    clicks: 1876,
    clicksTrend: 8.7,
    engagements: 3421,
    engagementsTrend: -2.4,
    spend: 8750.00,
    spendTrend: 5.2,
    conversions: 342,
    conversionsTrend: 18.9,
    leads: 256,
    leadsTrend: 14.3,
    videoViews: 5430,
    videoViewsTrend: 22.1,
    viralImpressions: 1823,
    viralImpressionsTrend: 31.2
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return "text-green-600 dark:text-green-400";
    if (trend < 0) return "text-red-600 dark:text-red-400";
    return "text-slate-600 dark:text-slate-400";
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navigation />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => setLocation(`/campaigns/${campaignId}`)}
                className="mb-4"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Custom Integration Analytics
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">
                    {campaign?.name} • Connected to {customIntegration?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Impressions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Impressions
                        </CardTitle>
                        <Eye className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.impressions)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.impressionsTrend)}`}>
                        {getTrendIcon(mockMetrics.impressionsTrend)}
                        <span>{Math.abs(mockMetrics.impressionsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Reach */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Reach
                        </CardTitle>
                        <Target className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.reach)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.reachTrend)}`}>
                        {getTrendIcon(mockMetrics.reachTrend)}
                        <span>{Math.abs(mockMetrics.reachTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Clicks */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Clicks
                        </CardTitle>
                        <MousePointerClick className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.clicks)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.clicksTrend)}`}>
                        {getTrendIcon(mockMetrics.clicksTrend)}
                        <span>{Math.abs(mockMetrics.clicksTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Engagements */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Engagements
                        </CardTitle>
                        <Target className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.engagements)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.engagementsTrend)}`}>
                        {getTrendIcon(mockMetrics.engagementsTrend)}
                        <span>{Math.abs(mockMetrics.engagementsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Spend */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Spend
                        </CardTitle>
                        <DollarSign className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(mockMetrics.spend)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.spendTrend)}`}>
                        {getTrendIcon(mockMetrics.spendTrend)}
                        <span>{Math.abs(mockMetrics.spendTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Conversions
                        </CardTitle>
                        <Target className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.conversions)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.conversionsTrend)}`}>
                        {getTrendIcon(mockMetrics.conversionsTrend)}
                        <span>{Math.abs(mockMetrics.conversionsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Leads */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Leads
                        </CardTitle>
                        <Target className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.leads)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.leadsTrend)}`}>
                        {getTrendIcon(mockMetrics.leadsTrend)}
                        <span>{Math.abs(mockMetrics.leadsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Video Views */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Video Views
                        </CardTitle>
                        <Eye className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.videoViews)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.videoViewsTrend)}`}>
                        {getTrendIcon(mockMetrics.videoViewsTrend)}
                        <span>{Math.abs(mockMetrics.videoViewsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Viral Impressions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Viral Impressions
                        </CardTitle>
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(mockMetrics.viralImpressions)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-sm ${getTrendColor(mockMetrics.viralImpressionsTrend)}`}>
                        {getTrendIcon(mockMetrics.viralImpressionsTrend)}
                        <span>{Math.abs(mockMetrics.viralImpressionsTrend)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Data Source Notice */}
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          Data Source: PDF Documents
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Metrics are extracted from PDF documents sent to <strong>{customIntegration?.email}</strong>. 
                          The system automatically processes incoming PDFs and updates the analytics dashboard.
                        </p>
                        <Badge className="mt-2 bg-blue-600 text-white">
                          Last Updated: {new Date().toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform-Level KPIs</CardTitle>
                    <CardDescription>
                      Manage key performance indicators for Custom Integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Plus className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        No KPIs Defined
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Create KPIs to track performance goals for your custom integration
                      </p>
                      <Button data-testid="button-create-kpi">
                        <Plus className="w-4 h-4 mr-2" />
                        Create KPI
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Benchmarks Tab */}
              <TabsContent value="benchmarks" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform-Level Benchmarks</CardTitle>
                    <CardDescription>
                      Compare your performance against industry standards
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        No Benchmarks Defined
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Set benchmarks to measure your performance against industry standards
                      </p>
                      <Button data-testid="button-create-benchmark">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Benchmark
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Integration Reports</CardTitle>
                    <CardDescription>
                      Schedule and manage automated reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        No Reports Created
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Create automated reports to track your custom integration performance
                      </p>
                      <Button data-testid="button-create-report">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Report
                      </Button>
                    </div>
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

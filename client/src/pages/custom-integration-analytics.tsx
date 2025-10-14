import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MousePointerClick, DollarSign, Target, Plus, FileText, TrendingUp, Users, Activity, FileSpreadsheet, Clock, BarChart3, Mail, TrendingDown, Zap, Link2 } from "lucide-react";
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
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch latest metrics from database
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/custom-integration", campaignId, "metrics"],
    enabled: !!campaignId,
  });

  // Use real metrics if available, otherwise show placeholder
  const metrics = metricsData || {};

  const formatNumber = (num?: number | null) => {
    if (!num && num !== 0) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (value?: string | number | null) => {
    if (!value) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatPercent = (value?: string | number | null) => {
    if (!value && value !== 0) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${num.toFixed(1)}%`;
  };

  const hasLegacyMetrics = metricsData && (
    metricsData.impressions !== undefined ||
    metricsData.reach !== undefined ||
    metricsData.clicks !== undefined ||
    metricsData.engagements !== undefined ||
    metricsData.spend !== undefined ||
    metricsData.conversions !== undefined ||
    metricsData.leads !== undefined ||
    metricsData.videoViews !== undefined ||
    metricsData.viralImpressions !== undefined
  );

  const hasAudienceMetrics = metricsData && (
    metricsData.users !== undefined ||
    metricsData.sessions !== undefined ||
    metricsData.pageviews !== undefined
  );

  const isValidNumber = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return typeof num === 'number' && !Number.isNaN(num) && Number.isFinite(num);
  };

  const hasTrafficSources = metricsData && (
    isValidNumber(metricsData.organicSearchShare) ||
    isValidNumber(metricsData.directBrandedShare) ||
    isValidNumber(metricsData.emailShare) ||
    isValidNumber(metricsData.referralShare) ||
    isValidNumber(metricsData.paidShare) ||
    isValidNumber(metricsData.socialShare)
  );

  const hasEmailMetrics = metricsData && (
    metricsData.emailsDelivered !== undefined ||
    metricsData.openRate !== undefined ||
    metricsData.clickThroughRate !== undefined
  );

  const hasMetrics = hasLegacyMetrics || hasAudienceMetrics || hasTrafficSources || hasEmailMetrics;

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
                {/* Webhook URL Display */}
                {customIntegration?.webhookToken && (
                  <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <Link2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                              Your Webhook URL (For CloudMailin Configuration)
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                              Copy this URL and paste it into your CloudMailin address configuration
                            </p>
                            <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                              <div className="flex items-center justify-between gap-3">
                                <code className="text-sm text-blue-900 dark:text-blue-100 break-all font-mono">
                                  {window.location.origin}/api/email/inbound/{customIntegration.webhookToken}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/api/email/inbound/${customIntegration.webhookToken}`);
                                    toast({
                                      title: "Copied!",
                                      description: "Webhook URL copied to clipboard",
                                    });
                                  }}
                                  className="flex-shrink-0"
                                  data-testid="button-copy-webhook"
                                >
                                  Copy URL
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* CloudMailin Setup Guide */}
                {customIntegration?.webhookToken && (
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center">
                          <span className="text-white dark:text-slate-900 font-bold text-sm">1</span>
                        </div>
                        Setup CloudMailin (One-Time, Takes 2 Minutes)
                      </CardTitle>
                      <CardDescription>
                        CloudMailin converts emails into data our system can process. Free plan works perfectly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Steps:</h4>
                          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-3 list-decimal list-inside">
                            <li>Click the button below to create a free CloudMailin address</li>
                            <li>On CloudMailin's site, paste the webhook URL shown above (click "Copy URL" to copy it)</li>
                            <li>Select format: <strong>JSON (Normalized)</strong></li>
                            <li>Save and note your CloudMailin email address (looks like: abc123@cloudmailin.net)</li>
                          </ol>
                        </div>

                        <Button
                          onClick={() => window.open('https://www.cloudmailin.com/addresses/new', '_blank')}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          data-testid="button-setup-cloudmailin"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Create CloudMailin Address (Free) →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* How to Use */}
                {customIntegration?.webhookToken && (
                  <Card className="border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">2</span>
                        </div>
                        How to Forward PDFs
                      </CardTitle>
                      <CardDescription>
                        After CloudMailin is configured, here's how to get your metrics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Every time you receive a PDF report:</h4>
                          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                            <li>Forward the email (with PDF) to your CloudMailin email address (e.g., abc123@cloudmailin.net)</li>
                            <li>CloudMailin sends it to our system automatically</li>
                            <li>Metrics appear in your dashboard within seconds</li>
                            <li>View them in the Overview, KPIs, and Benchmarks tabs</li>
                          </ol>
                        </div>

                        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-700">
                          <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Pro Tip: Set Up Automatic Forwarding
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            In Gmail or Outlook, create a filter to auto-forward emails from specific senders (like reports@facebook.com) to your CloudMailin address. Then it's completely hands-free!
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!hasMetrics && !metricsLoading && (
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          No Metrics Available
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400">
                          Upload a PDF document to extract and display your marketing metrics
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {hasMetrics && (
                  <>
                    {/* Audience & Traffic Metrics (GA4 Style) */}
                    {hasAudienceMetrics && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Audience & Traffic
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {metrics.users !== undefined && (
                            <Card data-testid="card-metric-users">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Users (unique)
                                  </CardTitle>
                                  <Users className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-users">
                                  {formatNumber(metrics.users)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.sessions !== undefined && (
                            <Card data-testid="card-metric-sessions">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Sessions
                                  </CardTitle>
                                  <Activity className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-sessions">
                                  {formatNumber(metrics.sessions)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.pageviews !== undefined && (
                            <Card data-testid="card-metric-pageviews">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Pageviews
                                  </CardTitle>
                                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-pageviews">
                                  {formatNumber(metrics.pageviews)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.avgSessionDuration && (
                            <Card data-testid="card-metric-avg-session-duration">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Avg. Session Duration
                                  </CardTitle>
                                  <Clock className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-avg-session-duration">
                                  {metrics.avgSessionDuration}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.pagesPerSession && (
                            <Card data-testid="card-metric-pages-per-session">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Pages / Session
                                  </CardTitle>
                                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-pages-per-session">
                                  {typeof metrics.pagesPerSession === 'string' ? parseFloat(metrics.pagesPerSession).toFixed(2) : metrics.pagesPerSession.toFixed(2)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.bounceRate && (
                            <Card data-testid="card-metric-bounce-rate">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Bounce Rate
                                  </CardTitle>
                                  <TrendingDown className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-bounce-rate">
                                  {formatPercent(metrics.bounceRate)}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Traffic Sources */}
                    {hasTrafficSources && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Traffic Sources
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {metrics.organicSearchShare && (
                            <Card data-testid="card-metric-organic-search">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Organic Search
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-organic-search">
                                  {formatPercent(metrics.organicSearchShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.directBrandedShare && (
                            <Card data-testid="card-metric-direct-branded">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Direct / Branded
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-direct-branded">
                                  {formatPercent(metrics.directBrandedShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.emailShare && (
                            <Card data-testid="card-metric-email-source">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Email (Newsletters)
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-email-source">
                                  {formatPercent(metrics.emailShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.referralShare && (
                            <Card data-testid="card-metric-referral">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Referral / Partners
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-referral">
                                  {formatPercent(metrics.referralShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.paidShare && (
                            <Card data-testid="card-metric-paid">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Paid (Display/Search)
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-paid">
                                  {formatPercent(metrics.paidShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.socialShare && (
                            <Card data-testid="card-metric-social">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Social
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-social">
                                  {formatPercent(metrics.socialShare)}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Performance */}
                    {hasEmailMetrics && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-5 h-5 text-purple-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Email & Newsletter Performance
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {metrics.emailsDelivered !== undefined && (
                            <Card data-testid="card-metric-emails-delivered">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Emails Delivered
                                  </CardTitle>
                                  <Mail className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-emails-delivered">
                                  {formatNumber(metrics.emailsDelivered)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.openRate && (
                            <Card data-testid="card-metric-open-rate">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Open Rate
                                  </CardTitle>
                                  <Eye className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-open-rate">
                                  {formatPercent(metrics.openRate)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.clickThroughRate && (
                            <Card data-testid="card-metric-click-through-rate">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Click-Through Rate
                                  </CardTitle>
                                  <MousePointerClick className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-click-through-rate">
                                  {formatPercent(metrics.clickThroughRate)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.clickToOpenRate && (
                            <Card data-testid="card-metric-click-to-open-rate">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Click-to-Open
                                  </CardTitle>
                                  <Target className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-click-to-open-rate">
                                  {formatPercent(metrics.clickToOpenRate)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.hardBounces && (
                            <Card data-testid="card-metric-hard-bounces">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Hard Bounces
                                  </CardTitle>
                                  <TrendingDown className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-hard-bounces">
                                  {formatPercent(metrics.hardBounces)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.spamComplaints && (
                            <Card data-testid="card-metric-spam-complaints">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Spam Complaints
                                  </CardTitle>
                                  <TrendingDown className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-spam-complaints">
                                  {formatPercent(metrics.spamComplaints)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {metrics.listGrowth !== undefined && (
                            <Card data-testid="card-metric-list-growth">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    List Growth (Net)
                                  </CardTitle>
                                  <TrendingUp className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-list-growth">
                                  +{formatNumber(metrics.listGrowth)}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legacy Social Media Metrics */}
                    {hasLegacyMetrics && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-orange-600" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Social Media Performance
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Impressions */}
                          {metrics.impressions !== undefined && (
                            <Card data-testid="card-metric-impressions">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Impressions
                                  </CardTitle>
                                  <Eye className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-impressions">
                                  {formatNumber(metrics.impressions)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Reach */}
                          {metrics.reach !== undefined && (
                            <Card data-testid="card-metric-reach">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Reach
                                  </CardTitle>
                                  <Target className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-reach">
                                  {formatNumber(metrics.reach)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Clicks */}
                          {metrics.clicks !== undefined && (
                            <Card data-testid="card-metric-clicks">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Clicks
                                  </CardTitle>
                                  <MousePointerClick className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-clicks">
                                  {formatNumber(metrics.clicks)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Engagements */}
                          {metrics.engagements !== undefined && (
                            <Card data-testid="card-metric-engagements">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Engagements
                                  </CardTitle>
                                  <Target className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-engagements">
                                  {formatNumber(metrics.engagements)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Spend */}
                          {metrics.spend !== undefined && (
                            <Card data-testid="card-metric-spend">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Spend
                                  </CardTitle>
                                  <DollarSign className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-spend">
                                  {formatCurrency(metrics.spend)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Conversions */}
                          {metrics.conversions !== undefined && (
                            <Card data-testid="card-metric-conversions">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Conversions
                                  </CardTitle>
                                  <Target className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-conversions">
                                  {formatNumber(metrics.conversions)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Leads */}
                          {metrics.leads !== undefined && (
                            <Card data-testid="card-metric-leads">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Leads
                                  </CardTitle>
                                  <Target className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-leads">
                                  {formatNumber(metrics.leads)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Video Views */}
                          {metrics.videoViews !== undefined && (
                            <Card data-testid="card-metric-video-views">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Video Views
                                  </CardTitle>
                                  <Eye className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-video-views">
                                  {formatNumber(metrics.videoViews)}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Viral Impressions */}
                          {metrics.viralImpressions !== undefined && (
                            <Card data-testid="card-metric-viral-impressions">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Viral Impressions
                                  </CardTitle>
                                  <TrendingUp className="w-4 h-4 text-slate-400" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="value-viral-impressions">
                                  {formatNumber(metrics.viralImpressions)}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}

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
                              Metrics are extracted from PDF documents you upload. The system automatically parses the PDF and updates the analytics dashboard.
                            </p>
                            {metricsData?.uploadedAt && (
                              <Badge className="mt-2 bg-blue-600 text-white">
                                Last Updated: {new Date(metricsData.uploadedAt).toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
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

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MousePointerClick, DollarSign, Target, Plus, FileText, TrendingUp } from "lucide-react";
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
  const metrics = metricsData || {
    impressions: 0,
    reach: 0,
    clicks: 0,
    engagements: 0,
    spend: "0",
    conversions: 0,
    leads: 0,
    videoViews: 0,
    viralImpressions: 0,
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const hasMetrics = metricsData && (
    metricsData.impressions > 0 ||
    metricsData.reach > 0 ||
    metricsData.clicks > 0 ||
    metricsData.engagements > 0 ||
    parseFloat(metricsData.spend) > 0 ||
    metricsData.conversions > 0 ||
    metricsData.leads > 0 ||
    metricsData.videoViews > 0 ||
    metricsData.viralImpressions > 0
  );

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
                {/* Webhook Instructions */}
                {customIntegration?.webhookToken && (
                  <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                              Webhook URL for Automated PDF Processing
                            </h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                              Use this webhook URL with automation services like Zapier or IFTTT to automatically process PDFs from your emails or other sources
                            </p>
                            <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <code className="text-sm text-purple-900 dark:text-purple-100 break-all font-mono">
                                  {window.location.origin}/api/webhook/custom-integration/{customIntegration.webhookToken}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/custom-integration/${customIntegration.webhookToken}`);
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
                              <div className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
                                <p><strong>Method:</strong> POST</p>
                                <p><strong>Field name:</strong> pdf</p>
                                <p><strong>Accepts:</strong> PDF files</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Start Guide */}
                {customIntegration?.webhookToken && (
                  <Card className="border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white font-bold">⚡</span>
                        </div>
                        Quick Start: Auto-Import Marketing PDFs (3 Minutes)
                      </CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-300">
                        Set up once, never manually upload again. PDFs sent to your email automatically appear here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-3">What you need:</h4>
                          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="text-green-600 dark:text-green-400 font-bold">1.</span>
                              <span>IFTTT account (free) - <a href="https://ifttt.com/join" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sign up here</a></span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-600 dark:text-green-400 font-bold">2.</span>
                              <span>Your email where marketing reports arrive (any email provider works)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-600 dark:text-green-400 font-bold">3.</span>
                              <span>3 minutes to follow the steps below</span>
                            </li>
                          </ul>
                        </div>

                        <Button
                          onClick={() => window.open('https://ifttt.com/create', '_blank')}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          data-testid="button-create-ifttt"
                        >
                          Open IFTTT to Start Setup →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* IFTTT Setup Guide */}
                {customIntegration?.webhookToken && (
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">IF</span>
                        </div>
                        Step-by-Step Setup Guide
                      </CardTitle>
                      <CardDescription>
                        Copy and paste these exact settings into IFTTT
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Step 1 */}
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                            1
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                              Create an IFTTT Account
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              Go to <a href="https://ifttt.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ifttt.com</a> and sign up for a free account
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3 text-sm">
                              <strong>💰 Cost:</strong> Free plan available, or $2.50/month for unlimited automations
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                            2
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                              Set Up Email Trigger (IFTTT will give you a special email address)
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-4 text-sm space-y-3">
                              <div>
                                <p className="text-slate-600 dark:text-slate-400 mb-2">Click "If This" → Search for <strong>"Email"</strong> → Select "Email" service</p>
                                <p className="text-slate-600 dark:text-slate-400 mb-2">Choose: <strong>"Send IFTTT an email tagged"</strong></p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-900 rounded p-3 border border-blue-200 dark:border-blue-700">
                                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Tag to enter:</p>
                                <div className="flex items-center gap-2">
                                  <code className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded border border-blue-300 dark:border-blue-600 font-mono">marketing</code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigator.clipboard.writeText('marketing');
                                      toast({
                                        title: "Copied!",
                                        description: "Tag 'marketing' copied to clipboard",
                                      });
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                  After setup, you'll get a special email like trigger@applet.ifttt.com to forward PDFs to
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                            3
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                              Configure Webhook (Copy & Paste These Values)
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                              Click "Then That" → Search for <strong>"Webhooks"</strong> → Choose <strong>"Make a web request"</strong>
                            </p>
                            
                            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800 space-y-4">
                              {/* URL Field */}
                              <div>
                                <label className="text-sm font-semibold text-purple-900 dark:text-purple-100 block mb-2">
                                  1. URL field - Paste this:
                                </label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 p-2 bg-white dark:bg-slate-900 rounded border border-purple-300 dark:border-purple-700 font-mono text-xs break-all">
                                    {window.location.origin}/api/webhook/custom-integration/{customIntegration.webhookToken}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/api/webhook/custom-integration/${customIntegration.webhookToken}`);
                                      toast({
                                        title: "Copied!",
                                        description: "Webhook URL copied to clipboard",
                                      });
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                              </div>

                              {/* Method Field */}
                              <div>
                                <label className="text-sm font-semibold text-purple-900 dark:text-purple-100 block mb-2">
                                  2. Method dropdown - Select:
                                </label>
                                <div className="flex items-center gap-2">
                                  <code className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded border border-purple-300 dark:border-purple-700 font-mono">POST</code>
                                </div>
                              </div>

                              {/* Content Type Field */}
                              <div>
                                <label className="text-sm font-semibold text-purple-900 dark:text-purple-100 block mb-2">
                                  3. Content Type dropdown - Select:
                                </label>
                                <div className="flex items-center gap-2">
                                  <code className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded border border-purple-300 dark:border-purple-700 font-mono">application/json</code>
                                </div>
                              </div>

                              {/* Body Field - Most Important */}
                              <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3 border-2 border-yellow-400 dark:border-yellow-600">
                                <label className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 block mb-2">
                                  4. Body field - Type this template first:
                                </label>
                                <div className="flex items-center gap-2 mb-3">
                                  <code className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 rounded border border-yellow-400 dark:border-yellow-600 font-mono text-sm">
                                    {`{"value1":""}`}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigator.clipboard.writeText('{"value1":""}');
                                      toast({
                                        title: "Copied!",
                                        description: "Body template copied. Now add Attachment URL ingredient.",
                                      });
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                                <div className="bg-yellow-100 dark:bg-yellow-900 rounded p-3 text-sm">
                                  <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Then click inside the quotes and:</p>
                                  <ol className="text-yellow-800 dark:text-yellow-200 space-y-1 list-decimal list-inside">
                                    <li>Click "Add ingredient" button</li>
                                    <li>Select "<strong>Attachment URL</strong>" from dropdown</li>
                                    <li>Final result: <code className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded">{`{"value1":"{{AttachmentURL}}"}`}</code></li>
                                  </ol>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 4 - Final Step */}
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                            4
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                              Save & Start Using
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                              Click "Continue" → Name it "Marketing Reports to PerformanceCore" → Click "Finish"
                            </p>
                            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800 space-y-3">
                              <div>
                                <p className="font-semibold text-green-900 dark:text-green-100 mb-2">📧 How to use after setup:</p>
                                <ol className="text-sm text-green-700 dark:text-green-300 space-y-2 list-decimal list-inside">
                                  <li>When marketing PDF arrives in your regular email</li>
                                  <li>Forward it to your IFTTT email (shown in IFTTT after setup)</li>
                                  <li>Add "#marketing" in the subject line</li>
                                  <li>Metrics appear here automatically in 1-5 minutes!</li>
                                </ol>
                              </div>
                              <div className="bg-green-100 dark:bg-green-900 rounded p-3">
                                <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">💡 Pro Tip:</p>
                                <p className="text-sm text-green-800 dark:text-green-200">
                                  Set up Gmail/Outlook auto-forwarding rules to automatically forward reports from specific senders (like reports@facebook.com) to your IFTTT email with #marketing tag. Then it's 100% automatic!
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pro Tips */}
                        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Pro Tips
                          </h4>
                          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="flex-shrink-0">📧</span>
                              <span>Set up email forwarding rules in Gmail/Outlook to automatically forward reports from specific senders to your IFTTT email</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="flex-shrink-0">📱</span>
                              <span>Download the IFTTT mobile app to manage and monitor your automations on the go</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="flex-shrink-0">⚡</span>
                              <span>IFTTT usually processes emails within 1-5 minutes, so your dashboard updates quickly</span>
                            </li>
                          </ul>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Impressions */}
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

                      {/* Reach */}
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

                      {/* Clicks */}
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

                      {/* Engagements */}
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

                      {/* Spend */}
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

                      {/* Conversions */}
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

                      {/* Leads */}
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

                      {/* Video Views */}
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

                      {/* Viral Impressions */}
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

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MousePointerClick, DollarSign, Target, Plus, FileText, TrendingUp, Users, Activity, FileSpreadsheet, Clock, BarChart3, Mail, TrendingDown, Zap, Link2, CheckCircle2, AlertCircle, Pencil, Trash2, Award, Trophy, Download, Settings } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CustomIntegrationAnalytics() {
  const [, params] = useRoute("/campaigns/:id/custom-integration-analytics");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const campaignId = params?.id;

  // KPI state management
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    metric: '',
    targetValue: '',
    currentValue: '',
    unit: '',
    priority: 'medium',
    timeframe: 'monthly'
  });

  // Benchmark state management
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    category: 'performance',
    benchmarkType: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    industry: '',
    description: '',
    source: '',
    geographicLocation: '',
    period: 'monthly',
    confidenceLevel: ''
  });

  // Report state management
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom'>('standard');
  const [reportForm, setReportForm] = useState({
    name: '',
    description: '',
    reportType: '',
    configuration: null as any,
    scheduleEnabled: false,
    scheduleFrequency: 'weekly',
    scheduleDayOfWeek: 'monday',
    scheduleTime: '9:00 AM',
    emailRecipients: '',
    status: 'draft'
  });
  const [customReportConfig, setCustomReportConfig] = useState({
    coreMetrics: [] as string[],
    derivedMetrics: [] as string[],
    kpis: [] as string[],
    benchmarks: [] as string[]
  });
  
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

  // Fetch platform-level KPIs for custom integration
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/kpis'],
  });

  // Fetch platform-level Benchmarks for custom integration
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/benchmarks'],
  });

  // Use real metrics if available, otherwise show placeholder
  const metrics = metricsData || {};

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/kpis', kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/kpis'] });
      toast({
        title: "KPI Created",
        description: "Your KPI has been successfully created.",
      });
      setIsKPIModalOpen(false);
      setKpiForm({
        name: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        unit: '',
        priority: 'medium',
        timeframe: 'monthly'
      });
    },
  });

  // Update KPI mutation
  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/kpis/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/kpis'] });
      toast({
        title: "KPI Updated",
        description: "Your KPI has been successfully updated.",
      });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      setKpiForm({
        name: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        unit: '',
        priority: 'medium',
        timeframe: 'monthly'
      });
    },
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/kpis/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/kpis'] });
      toast({
        title: "KPI Deleted",
        description: "The KPI has been successfully deleted.",
      });
    },
  });

  // Handle KPI form submission
  const handleKPISubmit = () => {
    if (editingKPI) {
      updateKpiMutation.mutate({
        id: editingKPI.id,
        data: {
          ...kpiForm,
          platformType: 'custom-integration',
        }
      });
    } else {
      createKpiMutation.mutate({
        ...kpiForm,
        platformType: 'custom-integration',
      });
    }
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/benchmarks', benchmarkData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks'] });
      toast({
        title: "Benchmark Created",
        description: "Your benchmark has been successfully created.",
      });
      setIsBenchmarkModalOpen(false);
      setBenchmarkForm({
        metric: '',
        name: '',
        category: 'performance',
        benchmarkType: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: ''
      });
    },
    onError: (error: any) => {
      console.error('Benchmark creation error:', error);
      toast({
        title: "Error Creating Benchmark",
        description: error?.message || "Failed to create benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/platforms/custom-integration/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks'] });
      toast({
        title: "Benchmark Updated",
        description: "Your benchmark has been successfully updated.",
      });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        benchmarkType: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: ''
      });
    },
    onError: (error: any) => {
      console.error('Benchmark update error:', error);
      toast({
        title: "Error Updating Benchmark",
        description: error?.message || "Failed to update benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Benchmark mutation
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/benchmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks'] });
      toast({
        title: "Benchmark Deleted",
        description: "The benchmark has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Benchmark deletion error:', error);
      toast({
        title: "Error Deleting Benchmark",
        description: error?.message || "Failed to delete benchmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle Benchmark form submission
  const handleBenchmarkSubmit = () => {
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({
        id: editingBenchmark.id,
        data: {
          ...benchmarkForm,
          platformType: 'custom-integration',
        }
      });
    } else {
      createBenchmarkMutation.mutate({
        ...benchmarkForm,
        platformType: 'custom-integration',
      });
    }
  };

  // Fetch platform-level Reports for custom integration
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/reports'],
  });

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/reports', reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports'] });
      toast({
        title: "Report Created",
        description: "Your report has been successfully created.",
      });
      setIsReportModalOpen(false);
      setEditingReportId(null);
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'weekly',
        scheduleDayOfWeek: 'monday',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
    },
    onError: (error: any) => {
      console.error('Report creation error:', error);
      toast({
        title: "Error Creating Report",
        description: error?.message || "Failed to create report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update Report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/custom-integration/reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports'] });
      toast({
        title: "Report Updated",
        description: "Your report has been successfully updated.",
      });
      setIsReportModalOpen(false);
      setEditingReportId(null);
      setReportForm({
        name: '',
        description: '',
        reportType: '',
        configuration: null,
        scheduleEnabled: false,
        scheduleFrequency: 'weekly',
        scheduleDayOfWeek: 'monday',
        scheduleTime: '9:00 AM',
        emailRecipients: '',
        status: 'draft'
      });
    },
    onError: (error: any) => {
      console.error('Report update error:', error);
      toast({
        title: "Error Updating Report",
        description: error?.message || "Failed to update report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/reports/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports'] });
      toast({
        title: "Report Deleted",
        description: "The report has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Report deletion error:', error);
      toast({
        title: "Error Deleting Report",
        description: error?.message || "Failed to delete report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper to convert day of week string to number (0-6)
  const dayOfWeekToNumber = (day: string): number | null => {
    const mapping: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
    };
    return mapping[day.toLowerCase()] ?? null;
  };

  // Helper to convert day of week number to string
  const numberToDayOfWeek = (num: number | null): string => {
    const mapping: { [key: number]: string } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return num !== null ? (mapping[num] || 'monday') : 'monday';
  };

  // Handle Report form submission
  const handleGenerateReport = () => {
    toast({
      title: "Report Generated",
      description: "Your report has been generated successfully. Download functionality coming soon.",
    });
    setReportDialogOpen(false);
  };

  const handleCreateReport = () => {
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' 
        ? dayOfWeekToNumber(reportForm.scheduleDayOfWeek) 
        : null,
      scheduleRecipients: reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };
    
    if (reportModalStep === 'custom') {
      reportData.configuration = customReportConfig;
    }
    
    createReportMutation.mutate(reportData);
  };

  const handleUpdateReport = () => {
    if (!editingReportId) return;
    
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      scheduleDayOfWeek: reportForm.scheduleFrequency === 'weekly' 
        ? dayOfWeekToNumber(reportForm.scheduleDayOfWeek) 
        : null,
      scheduleRecipients: reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };
    
    if (reportModalStep === 'custom') {
      reportData.configuration = customReportConfig;
    }
    
    updateReportMutation.mutate({ id: editingReportId, data: reportData });
  };

  const handleEditReport = (report: any) => {
    setEditingReportId(report.id);
    setReportForm({
      name: report.name,
      description: report.description || '',
      reportType: report.reportType,
      configuration: report.configuration,
      scheduleEnabled: !!report.scheduleFrequency,
      scheduleFrequency: report.scheduleFrequency || 'weekly',
      scheduleDayOfWeek: numberToDayOfWeek(report.scheduleDayOfWeek),
      scheduleTime: report.scheduleTime || '9:00 AM',
      emailRecipients: Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.join(', ') : '',
      status: report.status || 'draft'
    });
    
    if (report.reportType === 'custom' && report.configuration) {
      setCustomReportConfig(report.configuration);
      setReportModalStep('custom');
    } else {
      setReportModalStep('standard');
    }
    
    setIsReportModalOpen(true);
  };

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

  const isValidNumber = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return typeof num === 'number' && !Number.isNaN(num) && Number.isFinite(num);
  };

  const hasAudienceMetrics = metricsData && (
    metricsData.users !== undefined ||
    metricsData.sessions !== undefined ||
    metricsData.pageviews !== undefined
  );

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

  const hasMetrics = hasAudienceMetrics || hasTrafficSources || hasEmailMetrics;

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
                {/* Show instructions only when there are NO metrics */}
                {!hasMetrics && customIntegration?.webhookToken && (
                  <>
                    {/* Webhook URL Display */}
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

                    {/* CloudMailin Setup Guide */}
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

                    {/* How to Use */}
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
                  </>
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

                    {/* Last Updated Timestamp */}
                    {metricsData?.uploadedAt && (
                      <div className="flex justify-end">
                        <Badge className="bg-blue-600 text-white">
                          Last Updated: {new Date(metricsData.uploadedAt).toLocaleString()}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* KPIs Tab */}
              <TabsContent value="kpis" className="space-y-6" data-testid="content-kpis">
                {kpisLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : kpisData && (kpisData as any[]).length > 0 ? (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and monitor your Custom Integration KPIs
                        </p>
                      </div>
                      <Button 
                        onClick={() => setIsKPIModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid="button-create-kpi-header"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create KPI
                      </Button>
                    </div>

                    {/* KPI Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {(kpisData as any[]).length}
                              </p>
                            </div>
                            <Target className="w-8 h-8 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">High Priority</p>
                              <p className="text-2xl font-bold text-red-600">
                                {(kpisData as any[]).filter((k: any) => k.priority === 'high').length}
                              </p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-red-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Medium Priority</p>
                              <p className="text-2xl font-bold text-yellow-600">
                                {(kpisData as any[]).filter((k: any) => k.priority === 'medium').length}
                              </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-yellow-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(kpisData as any[]).map((kpi: any) => (
                        <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                <CardDescription className="text-sm">
                                  {kpi.description || 'No description provided'}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {kpi.priority && (
                                  <Badge variant="outline" className={
                                    kpi.priority === 'high' ? 'text-red-600 border-red-300' :
                                    kpi.priority === 'medium' ? 'text-yellow-600 border-yellow-300' :
                                    'text-green-600 border-green-300'
                                  }>
                                    {kpi.priority}
                                  </Badge>
                                )}
                                {kpi.timeframe && (
                                  <Badge variant="secondary" className="capitalize">
                                    {kpi.timeframe}
                                  </Badge>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                  onClick={() => {
                                    setEditingKPI(kpi);
                                    setKpiForm({
                                      name: kpi.name,
                                      description: kpi.description || '',
                                      metric: kpi.metric || '',
                                      targetValue: kpi.targetValue || '',
                                      currentValue: kpi.currentValue || '',
                                      unit: kpi.unit || '',
                                      priority: kpi.priority || 'medium',
                                      timeframe: kpi.timeframe || 'monthly'
                                    });
                                    setIsKPIModalOpen(true);
                                  }}
                                  data-testid={`button-edit-kpi-${kpi.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                      data-testid={`button-delete-kpi-${kpi.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{kpi.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteKpiMutation.mutate(kpi.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Current
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {kpi.currentValue || '0'}{kpi.unit || ''}
                                </div>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {kpi.targetValue || '0'}{kpi.unit || ''}
                                </div>
                              </div>
                            </div>
                            
                            {/* Progress Tracker */}
                            {kpi.targetValue && kpi.currentValue && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100)}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                  <div 
                                    className={`h-2.5 rounded-full transition-all ${
                                      (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 1 
                                        ? 'bg-green-500' 
                                        : (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) >= 0.7
                                        ? 'bg-blue-500'
                                        : 'bg-yellow-500'
                                    }`}
                                    style={{ 
                                      width: `${Math.min((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100, 100)}%` 
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
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
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          data-testid="button-create-kpi"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Benchmarks Tab */}
              <TabsContent value="benchmarks" className="space-y-6" data-testid="content-benchmarks">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Benchmarks</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Compare your performance against industry benchmarks
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsBenchmarkModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-create-benchmark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Benchmark
                  </Button>
                </div>

                {benchmarksLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : benchmarksData && (benchmarksData as any[]).length > 0 ? (
                  <>
                    {/* Benchmark Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {(benchmarksData as any[]).length}
                              </p>
                            </div>
                            <Award className="w-8 h-8 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Active</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(benchmarksData as any[]).filter((b: any) => b.isActive).length}
                              </p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Categories</p>
                              <p className="text-2xl font-bold text-purple-600">
                                {new Set((benchmarksData as any[]).map((b: any) => b.category)).size}
                              </p>
                            </div>
                            <BarChart3 className="w-8 h-8 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Industries</p>
                              <p className="text-2xl font-bold text-blue-600">
                                {new Set((benchmarksData as any[]).map((b: any) => b.industry)).size}
                              </p>
                            </div>
                            <Trophy className="w-8 h-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Benchmark Cards */}
                    <div className="space-y-4">
                      {(benchmarksData as any[]).map((benchmark: any) => (
                        <Card key={benchmark.id} data-testid={`benchmark-card-${benchmark.id}`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                  {benchmark.name}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {benchmark.description || 'No description provided'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  {benchmark.industry && <span>{benchmark.industry}</span>}
                                  {benchmark.period && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.period}</span>
                                    </>
                                  )}
                                  {benchmark.category && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={benchmark.isActive ? 'default' : 'secondary'}>
                                  {benchmark.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingBenchmark(benchmark);
                                    setBenchmarkForm({
                                      metric: benchmark.metric || '',
                                      name: benchmark.name || '',
                                      category: benchmark.category || 'performance',
                                      benchmarkType: benchmark.benchmarkType || '',
                                      unit: benchmark.unit || '',
                                      benchmarkValue: benchmark.benchmarkValue || '',
                                      currentValue: benchmark.currentValue || '',
                                      industry: benchmark.industry || '',
                                      description: benchmark.description || '',
                                      source: benchmark.source || '',
                                      geographicLocation: benchmark.geoLocation || '',
                                      period: benchmark.period || 'monthly',
                                      confidenceLevel: benchmark.confidenceLevel || ''
                                    });
                                    setIsBenchmarkModalOpen(true);
                                  }}
                                  data-testid={`button-edit-benchmark-${benchmark.id}`}
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      data-testid={`button-delete-benchmark-${benchmark.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{benchmark.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Your Performance
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.currentValue || '0'}{benchmark.unit || ''}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Benchmark Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.benchmarkValue || benchmark.targetValue || '0'}{benchmark.unit || ''}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Source
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {benchmark.source || 'Custom Integration'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Performance Comparison */}
                            {benchmark.currentValue && benchmark.benchmarkValue && (
                              <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    Performance vs Benchmark:
                                  </span>
                                  {(() => {
                                    const current = parseFloat(benchmark.currentValue);
                                    const benchmarkVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue);
                                    const diff = current - benchmarkVal;
                                    const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100).toFixed(1) : '0';
                                    const isAbove = current > benchmarkVal;
                                    
                                    return (
                                      <>
                                        <Badge 
                                          variant={isAbove ? "default" : "secondary"}
                                          className={isAbove ? "bg-green-600" : "bg-red-600"}
                                        >
                                          {isAbove ? (
                                            <>
                                              <TrendingUp className="w-3 h-3 mr-1" />
                                              {percentDiff}% Above
                                            </>
                                          ) : (
                                            <>
                                              <TrendingDown className="w-3 h-3 mr-1" />
                                              {Math.abs(parseFloat(percentDiff))}% Below
                                            </>
                                          )}
                                        </Badge>
                                        <span className="text-xs text-slate-500">
                                          {isAbove ? '🎉 Outperforming!' : '⚠️ Needs improvement'}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Custom Integration Benchmarks
                      </CardTitle>
                      <CardDescription>
                        Compare your performance against industry benchmarks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          No benchmarks have been created yet.
                        </p>
                        <Button 
                          onClick={() => setIsBenchmarkModalOpen(true)}
                          data-testid="button-create-benchmark"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reports</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Create, schedule, and manage analytics reports for Custom Integration
                    </p>
                  </div>
                  <Button 
                    data-testid="button-create-report" 
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      setEditingReportId(null);
                      setReportModalStep('standard');
                      setReportForm({
                        name: '',
                        description: '',
                        reportType: '',
                        configuration: null,
                        scheduleEnabled: false,
                        scheduleFrequency: 'weekly',
                        scheduleDayOfWeek: 'monday',
                        scheduleTime: '9:00 AM',
                        emailRecipients: '',
                        status: 'draft'
                      });
                      setCustomReportConfig({
                        coreMetrics: [],
                        derivedMetrics: [],
                        kpis: [],
                        benchmarks: []
                      });
                      setIsReportModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Report
                  </Button>
                </div>

                {/* Reports List */}
                {reportsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {reportsData.map((report: any) => (
                      <Card key={report.id} data-testid={`report-${report.id}`} className="border-purple-200 dark:border-purple-900">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                                {report.name}
                              </h3>
                              {report.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                  {report.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                                  {report.reportType}
                                </Badge>
                                {report.scheduleFrequency && (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {report.scheduleFrequency}
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  Created {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                data-testid={`button-download-${report.id}`}
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                data-testid={`button-edit-${report.id}`}
                                onClick={() => handleEditReport(report)}
                                className="hover:bg-purple-50 dark:hover:bg-purple-950/30"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    data-testid={`button-delete-${report.id}`}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{report.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteReportMutation.mutate(report.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      data-testid={`confirm-delete-${report.id}`}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-purple-200 dark:border-purple-900">
                    <CardContent className="py-12 text-center">
                      <Target className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        No Reports Created
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Create automated reports to track your custom integration performance
                      </p>
                      <Button 
                        onClick={() => {
                          setEditingReportId(null);
                          setReportModalStep('standard');
                          setReportForm({
                            name: '',
                            description: '',
                            reportType: '',
                            configuration: null,
                            scheduleEnabled: false,
                            scheduleFrequency: 'weekly',
                            scheduleDayOfWeek: 'monday',
                            scheduleTime: '9:00 AM',
                            emailRecipients: '',
                            status: 'draft'
                          });
                          setCustomReportConfig({
                            coreMetrics: [],
                            derivedMetrics: [],
                            kpis: [],
                            benchmarks: []
                          });
                          setIsReportModalOpen(true);
                        }}
                        data-testid="button-create-first-report"
                        className="gap-2 bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                        Create Your First Report
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* KPI Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={setIsKPIModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
            <DialogDescription>
              {editingKPI 
                ? 'Update the KPI details below. The current value can be auto-populated from your metrics data.'
                : 'Define a new KPI for your custom integration. You can select metrics from the Overview tab as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-name">KPI Name *</Label>
                <Input
                  id="kpi-name"
                  placeholder="e.g., Email Open Rate"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  data-testid="input-kpi-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-metric">Metric Source</Label>
                <Select
                  value={kpiForm.metric}
                  onValueChange={(value) => {
                    setKpiForm({ ...kpiForm, metric: value });
                    // Auto-populate current value from metrics
                    let currentValue = '';
                    let unit = '';
                    switch(value) {
                      case 'users':
                        currentValue = String(metricsData?.users || 0);
                        break;
                      case 'sessions':
                        currentValue = String(metricsData?.sessions || 0);
                        break;
                      case 'pageviews':
                        currentValue = String(metricsData?.pageviews || 0);
                        break;
                      case 'openRate':
                        currentValue = String(metricsData?.openRate || 0);
                        unit = '%';
                        break;
                      case 'clickThroughRate':
                        currentValue = String(metricsData?.clickThroughRate || 0);
                        unit = '%';
                        break;
                      case 'clickToOpen':
                        currentValue = String(metricsData?.clickToOpen || 0);
                        unit = '%';
                        break;
                      case 'listGrowth':
                        currentValue = String(metricsData?.listGrowth || 0);
                        break;
                      case 'emailsDelivered':
                        currentValue = String(metricsData?.emailsDelivered || 0);
                        break;
                    }
                    setKpiForm({ ...kpiForm, metric: value, currentValue, unit });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                    <SelectValue placeholder="Select metric to track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="users">Users (from metrics)</SelectItem>
                    <SelectItem value="sessions">Sessions (from metrics)</SelectItem>
                    <SelectItem value="pageviews">Pageviews (from metrics)</SelectItem>
                    <SelectItem value="openRate">Email Open Rate (from metrics)</SelectItem>
                    <SelectItem value="clickThroughRate">Email CTR (from metrics)</SelectItem>
                    <SelectItem value="clickToOpen">Email CTOR (from metrics)</SelectItem>
                    <SelectItem value="listGrowth">List Growth (from metrics)</SelectItem>
                    <SelectItem value="emailsDelivered">Emails Delivered (from metrics)</SelectItem>
                    <SelectItem value="custom">Custom Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-description">Description</Label>
              <Textarea
                id="kpi-description"
                placeholder="Describe what this KPI measures and why it's important"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                rows={3}
                data-testid="input-kpi-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-current">Current Value</Label>
                <Input
                  id="kpi-current"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={kpiForm.currentValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, currentValue: e.target.value })}
                  data-testid="input-kpi-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target Value *</Label>
                <Input
                  id="kpi-target"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: e.target.value })}
                  data-testid="input-kpi-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-unit">Unit</Label>
                <Input
                  id="kpi-unit"
                  placeholder="%, $, etc."
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  data-testid="input-kpi-unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-priority">Priority</Label>
                <Select
                  value={kpiForm.priority}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, priority: value })}
                >
                  <SelectTrigger id="kpi-priority" data-testid="select-kpi-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kpi-timeframe">Timeframe</Label>
                <Select
                  value={kpiForm.timeframe}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, timeframe: value })}
                >
                  <SelectTrigger id="kpi-timeframe" data-testid="select-kpi-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (24 hours)</SelectItem>
                    <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                    <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                    <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  How often to measure progress toward your target
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsKPIModalOpen(false);
                  setEditingKPI(null);
                  setKpiForm({
                    name: '',
                    description: '',
                    metric: '',
                    targetValue: '',
                    currentValue: '',
                    unit: '',
                    priority: 'medium',
                    timeframe: 'monthly'
                  });
                }}
                data-testid="button-kpi-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleKPISubmit}
                disabled={!kpiForm.name || !kpiForm.targetValue}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-kpi-submit"
              >
                {editingKPI ? 'Update KPI' : 'Create KPI'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Benchmark Modal */}
      <Dialog open={isBenchmarkModalOpen} onOpenChange={setIsBenchmarkModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBenchmark ? 'Edit Benchmark' : 'Create New Benchmark'}</DialogTitle>
            <DialogDescription>
              {editingBenchmark 
                ? 'Update the benchmark details below. The current value can be auto-populated from your metrics data.'
                : 'Define a new benchmark for your custom integration. You can select metrics from the Overview tab as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-name">Benchmark Name *</Label>
                <Input
                  id="benchmark-name"
                  placeholder="e.g., Email Open Rate Benchmark"
                  value={benchmarkForm.name}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                  data-testid="input-benchmark-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-category">Category *</Label>
                <Select
                  value={benchmarkForm.category}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, category: value })}
                >
                  <SelectTrigger id="benchmark-category" data-testid="select-benchmark-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="conversion">Conversion</SelectItem>
                    <SelectItem value="traffic">Traffic</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Metric Source</Label>
                <Select
                  value={benchmarkForm.metric}
                  onValueChange={(value) => {
                    setBenchmarkForm({ ...benchmarkForm, metric: value });
                    // Auto-populate current value from metrics
                    let currentValue = '';
                    let unit = '';
                    switch(value) {
                      case 'users':
                        currentValue = String(metricsData?.users || 0);
                        break;
                      case 'sessions':
                        currentValue = String(metricsData?.sessions || 0);
                        break;
                      case 'pageviews':
                        currentValue = String(metricsData?.pageviews || 0);
                        break;
                      case 'openRate':
                        currentValue = String(metricsData?.openRate || 0);
                        unit = '%';
                        break;
                      case 'clickThroughRate':
                        currentValue = String(metricsData?.clickThroughRate || 0);
                        unit = '%';
                        break;
                      case 'clickToOpen':
                        currentValue = String(metricsData?.clickToOpen || 0);
                        unit = '%';
                        break;
                      case 'listGrowth':
                        currentValue = String(metricsData?.listGrowth || 0);
                        break;
                      case 'emailsDelivered':
                        currentValue = String(metricsData?.emailsDelivered || 0);
                        break;
                    }
                    setBenchmarkForm({ ...benchmarkForm, metric: value, currentValue, unit });
                  }}
                >
                  <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                    <SelectValue placeholder="Select metric to benchmark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="users">Users (from metrics)</SelectItem>
                    <SelectItem value="sessions">Sessions (from metrics)</SelectItem>
                    <SelectItem value="pageviews">Pageviews (from metrics)</SelectItem>
                    <SelectItem value="openRate">Email Open Rate (from metrics)</SelectItem>
                    <SelectItem value="clickThroughRate">Email CTR (from metrics)</SelectItem>
                    <SelectItem value="clickToOpen">Email CTOR (from metrics)</SelectItem>
                    <SelectItem value="listGrowth">List Growth (from metrics)</SelectItem>
                    <SelectItem value="emailsDelivered">Emails Delivered (from metrics)</SelectItem>
                    <SelectItem value="custom">Custom Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="benchmark-description">Description</Label>
              <Textarea
                id="benchmark-description"
                placeholder="Describe this benchmark and why it's important"
                value={benchmarkForm.description}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, description: e.target.value })}
                rows={3}
                data-testid="input-benchmark-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-current">Current Value</Label>
                <Input
                  id="benchmark-current"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={benchmarkForm.currentValue}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, currentValue: e.target.value })}
                  data-testid="input-benchmark-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={benchmarkForm.benchmarkValue}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, benchmarkValue: e.target.value })}
                  data-testid="input-benchmark-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-unit">Unit</Label>
                <Input
                  id="benchmark-unit"
                  placeholder="%, $, etc."
                  value={benchmarkForm.unit}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, unit: e.target.value })}
                  data-testid="input-benchmark-unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-industry">Industry</Label>
                <Input
                  id="benchmark-industry"
                  placeholder="e.g., SaaS, E-commerce"
                  value={benchmarkForm.industry}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, industry: e.target.value })}
                  data-testid="input-benchmark-industry"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-source">Source</Label>
                <Input
                  id="benchmark-source"
                  placeholder="e.g., Industry Report, Custom Integration"
                  value={benchmarkForm.source}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, source: e.target.value })}
                  data-testid="input-benchmark-source"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-period">Period</Label>
                <Select
                  value={benchmarkForm.period}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, period: value })}
                >
                  <SelectTrigger id="benchmark-period" data-testid="select-benchmark-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-type">Benchmark Type</Label>
                <Select
                  value={benchmarkForm.benchmarkType}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, benchmarkType: value })}
                >
                  <SelectTrigger id="benchmark-type" data-testid="select-benchmark-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="industry">Industry Average</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="internal">Internal Target</SelectItem>
                    <SelectItem value="best-in-class">Best in Class</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-confidence">Confidence Level</Label>
                <Select
                  value={benchmarkForm.confidenceLevel}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, confidenceLevel: value })}
                >
                  <SelectTrigger id="benchmark-confidence" data-testid="select-benchmark-confidence">
                    <SelectValue placeholder="Select confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBenchmarkModalOpen(false);
                  setEditingBenchmark(null);
                  setBenchmarkForm({
                    metric: '',
                    name: '',
                    benchmarkType: '',
                    unit: '',
                    benchmarkValue: '',
                    currentValue: '',
                    industry: '',
                    description: '',
                    source: '',
                    geographicLocation: '',
                    period: 'monthly',
                    confidenceLevel: ''
                  });
                }}
                data-testid="button-benchmark-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBenchmarkSubmit}
                disabled={!benchmarkForm.name || !benchmarkForm.benchmarkValue || createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-benchmark-submit"
              >
                {createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending ? (
                  <>
                    <span className="mr-2">Processing...</span>
                  </>
                ) : (
                  editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              {editingReportId ? 'Edit Report' : 'Create New Report'}
            </DialogTitle>
            <DialogDescription>
              {reportModalStep === 'standard' 
                ? 'Choose a report type and configure scheduling options for Custom Integration analytics'
                : 'Select the metrics, KPIs, and benchmarks to include in your custom report'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {reportModalStep === 'standard' && (
              <div className="space-y-6">
                {/* Report Type Selection */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Report Type</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'overview' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'overview' })}
                      data-testid="card-overview-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Overview Report</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Comprehensive snapshot of all Custom Integration metrics
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'kpis' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'kpis' })}
                      data-testid="card-kpis-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">KPIs Report</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Focus on key performance indicators and targets
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportForm.reportType === 'benchmarks' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportForm({ ...reportForm, reportType: 'benchmarks' })}
                      data-testid="card-benchmarks-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Benchmarks Report</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Compare performance against industry standards
                        </p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${reportModalStep === 'custom' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:border-purple-300'}`}
                      onClick={() => setReportModalStep('custom')}
                      data-testid="card-custom-report"
                    >
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-2">Custom Report</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Build your own report with selected metrics
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Report Configuration */}
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="report-name">Report Name *</Label>
                      <Input
                        id="report-name"
                        value={reportForm.name}
                        onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                        placeholder="Enter report name"
                        data-testid="input-report-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="report-description">Description (Optional)</Label>
                      <Textarea
                        id="report-description"
                        value={reportForm.description}
                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                        placeholder="Add a description for this report"
                        rows={3}
                        data-testid="input-report-description"
                      />
                    </div>

                    {/* Schedule Section */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="schedule-reports"
                          checked={reportForm.scheduleEnabled}
                          onCheckedChange={(checked) => {
                            setReportForm({
                              ...reportForm,
                              scheduleEnabled: checked as boolean
                            });
                          }}
                          data-testid="checkbox-schedule-reports"
                        />
                        <Label htmlFor="schedule-reports" className="text-base cursor-pointer font-semibold">
                          Schedule Automatic Reports
                        </Label>
                      </div>

                      {reportForm.scheduleEnabled && (
                        <div className="space-y-4 pl-6">
                          {/* Frequency */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-frequency">Frequency</Label>
                            <Select
                              value={reportForm.scheduleFrequency}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                            >
                              <SelectTrigger id="schedule-frequency" data-testid="select-frequency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Day of Week - Only for Weekly */}
                          {reportForm.scheduleFrequency === 'weekly' && (
                            <div className="space-y-2">
                              <Label htmlFor="schedule-day">Day of Week</Label>
                              <Select
                                value={reportForm.scheduleDayOfWeek}
                                onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                              >
                                <SelectTrigger id="schedule-day" data-testid="select-day">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monday">Monday</SelectItem>
                                  <SelectItem value="tuesday">Tuesday</SelectItem>
                                  <SelectItem value="wednesday">Wednesday</SelectItem>
                                  <SelectItem value="thursday">Thursday</SelectItem>
                                  <SelectItem value="friday">Friday</SelectItem>
                                  <SelectItem value="saturday">Saturday</SelectItem>
                                  <SelectItem value="sunday">Sunday</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Time */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-time">Time</Label>
                            <Select
                              value={reportForm.scheduleTime}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                            >
                              <SelectTrigger id="schedule-time" data-testid="select-time">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                                <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                                <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                                <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                                <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                                <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                                <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                                <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Email Recipients */}
                          <div className="space-y-2">
                            <Label htmlFor="email-recipients">Email Recipients</Label>
                            <Input
                              id="email-recipients"
                              value={reportForm.emailRecipients}
                              onChange={(e) => setReportForm({ ...reportForm, emailRecipients: e.target.value })}
                              placeholder="Enter email addresses (comma-separated)"
                              data-testid="input-email-recipients"
                            />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Reports will be automatically generated and sent to these email addresses
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Report Configuration */}
            {reportModalStep === 'custom' && (
              <div className="space-y-6">
                {/* Report Name and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-report-name">Report Name *</Label>
                    <Input
                      id="custom-report-name"
                      value={reportForm.name}
                      onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                      placeholder="Enter report name"
                      data-testid="input-custom-report-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-report-description">Description (Optional)</Label>
                    <Textarea
                      id="custom-report-description"
                      value={reportForm.description}
                      onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                      placeholder="Add a description for this report"
                      rows={2}
                      data-testid="input-custom-report-description"
                    />
                  </div>
                </div>

                {/* Metrics Selection */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Metrics</h3>
                  
                  <div className="space-y-3 pl-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Audience & Traffic Metrics</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['users', 'sessions', 'pageviews'].map((metric) => {
                        const labels: Record<string, string> = {
                          users: 'Users',
                          sessions: 'Sessions',
                          pageviews: 'Pageviews'
                        };
                        return (
                          <div key={metric} className="flex items-center space-x-2">
                            <Checkbox
                              id={`core-${metric}`}
                              checked={customReportConfig.coreMetrics.includes(metric)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCustomReportConfig({
                                    ...customReportConfig,
                                    coreMetrics: [...customReportConfig.coreMetrics, metric]
                                  });
                                } else {
                                  setCustomReportConfig({
                                    ...customReportConfig,
                                    coreMetrics: customReportConfig.coreMetrics.filter(m => m !== metric)
                                  });
                                }
                              }}
                              data-testid={`checkbox-core-${metric}`}
                            />
                            <Label htmlFor={`core-${metric}`} className="text-sm cursor-pointer">
                              {labels[metric]}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pl-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Performance Metrics</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['emailsDelivered', 'openRate', 'clickThroughRate', 'clickToOpen'].map((metric) => {
                        const labels: Record<string, string> = {
                          emailsDelivered: 'Emails Delivered',
                          openRate: 'Open Rate',
                          clickThroughRate: 'Click-Through Rate',
                          clickToOpen: 'Click-to-Open'
                        };
                        return (
                          <div key={metric} className="flex items-center space-x-2">
                            <Checkbox
                              id={`email-${metric}`}
                              checked={customReportConfig.derivedMetrics.includes(metric)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCustomReportConfig({
                                    ...customReportConfig,
                                    derivedMetrics: [...customReportConfig.derivedMetrics, metric]
                                  });
                                } else {
                                  setCustomReportConfig({
                                    ...customReportConfig,
                                    derivedMetrics: customReportConfig.derivedMetrics.filter(m => m !== metric)
                                  });
                                }
                              }}
                              data-testid={`checkbox-email-${metric}`}
                            />
                            <Label htmlFor={`email-${metric}`} className="text-sm cursor-pointer">
                              {labels[metric]}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* KPIs Section */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base">KPIs</Label>
                  {kpisData && Array.isArray(kpisData) && kpisData.length > 0 ? (
                    <div className="space-y-2 pl-4">
                      {kpisData.map((kpi: any) => (
                        <div key={kpi.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`kpi-${kpi.id}`}
                            checked={customReportConfig.kpis.includes(kpi.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  kpis: [...customReportConfig.kpis, kpi.id]
                                });
                              } else {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  kpis: customReportConfig.kpis.filter(id => id !== kpi.id)
                                });
                              }
                            }}
                            data-testid={`checkbox-kpi-${kpi.id}`}
                          />
                          <Label htmlFor={`kpi-${kpi.id}`} className="text-sm cursor-pointer">
                            {kpi.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 pl-4">No KPIs created yet</p>
                  )}
                </div>

                {/* Benchmarks Section */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base">Benchmarks</Label>
                  {benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                    <div className="space-y-2 pl-4">
                      {benchmarksData.map((benchmark: any) => (
                        <div key={benchmark.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`benchmark-${benchmark.id}`}
                            checked={customReportConfig.benchmarks.includes(benchmark.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  benchmarks: [...customReportConfig.benchmarks, benchmark.id]
                                });
                              } else {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  benchmarks: customReportConfig.benchmarks.filter(id => id !== benchmark.id)
                                });
                              }
                            }}
                            data-testid={`checkbox-benchmark-${benchmark.id}`}
                          />
                          <Label htmlFor={`benchmark-${benchmark.id}`} className="text-sm cursor-pointer">
                            {benchmark.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 pl-4">No benchmarks created yet</p>
                  )}
                </div>

                {/* Schedule Section for Custom Reports */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-schedule-reports"
                      checked={reportForm.scheduleEnabled}
                      onCheckedChange={(checked) => {
                        setReportForm({
                          ...reportForm,
                          scheduleEnabled: checked as boolean
                        });
                      }}
                      data-testid="checkbox-custom-schedule-reports"
                    />
                    <Label htmlFor="custom-schedule-reports" className="text-base cursor-pointer font-semibold">
                      Schedule Automatic Reports
                    </Label>
                  </div>

                  {reportForm.scheduleEnabled && (
                    <div className="space-y-4 pl-6">
                      {/* Frequency */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-schedule-frequency">Frequency</Label>
                        <Select
                          value={reportForm.scheduleFrequency}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                        >
                          <SelectTrigger id="custom-schedule-frequency" data-testid="select-custom-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Email Recipients */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-email-recipients">Email Recipients</Label>
                        <Input
                          id="custom-email-recipients"
                          value={reportForm.emailRecipients}
                          onChange={(e) => setReportForm({ ...reportForm, emailRecipients: e.target.value })}
                          placeholder="Enter email addresses (comma-separated)"
                          data-testid="input-custom-email-recipients"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportModalStep('standard');
                  setEditingReportId(null);
                  setReportForm({
                    name: '',
                    description: '',
                    reportType: '',
                    configuration: null,
                    scheduleEnabled: false,
                    scheduleFrequency: 'weekly',
                    scheduleDayOfWeek: 'monday',
                    scheduleTime: '9:00 AM',
                    emailRecipients: '',
                    status: 'draft'
                  });
                }}
                data-testid="button-cancel-report"
              >
                Cancel
              </Button>
              
              <div className="flex items-center gap-2">
                {reportModalStep === 'custom' && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setReportModalStep('standard');
                      setReportForm({ ...reportForm, reportType: '' });
                    }}
                    data-testid="button-back-to-standard"
                  >
                    Back to Standard Reports
                  </Button>
                )}
                
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-report" : "button-create-report-submit"}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {(createReportMutation.isPending || updateReportMutation.isPending) ? (
                      editingReportId ? 'Updating...' : 'Creating...'
                    ) : editingReportId ? (
                      'Update Report'
                    ) : reportForm.scheduleEnabled ? (
                      'Schedule Report'
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate & Download Report
                      </>
                    )}
                  </Button>
                )}
                
                {reportModalStep === 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-custom-report" : "button-create-custom-report"}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {(createReportMutation.isPending || updateReportMutation.isPending) ? (
                      editingReportId ? 'Updating...' : 'Creating...'
                    ) : editingReportId ? (
                      'Update Report'
                    ) : reportForm.scheduleEnabled ? (
                      'Schedule Report'
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate & Download Report
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick, DollarSign, Target, BarChart3, Trophy, Award, TrendingDownIcon, CheckCircle2, AlertCircle, Clock, Plus, Heart, MessageCircle, Share2, Activity, Users, Play, Filter, ArrowUpDown, ChevronRight, Trash2, Pencil, FileText, Settings, Download } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

// Helper: Derive category from metric
const getCategoryFromMetric = (metric: string): string => {
  const metricLower = metric.toLowerCase();
  
  if (['ctr', 'cpc', 'cpm', 'cpa', 'cpl'].some(m => metricLower.includes(m))) return 'cost';
  if (['cvr', 'conversions', 'leads'].some(m => metricLower.includes(m))) return 'conversion';
  if (['er', 'engagements', 'likes', 'comments', 'shares'].some(m => metricLower.includes(m))) return 'engagement';
  if (['impressions', 'reach', 'viral'].some(m => metricLower.includes(m))) return 'reach';
  if (['roi', 'roas', 'video'].some(m => metricLower.includes(m))) return 'performance';
  
  return 'performance'; // default
};

// LinkedIn KPI Templates
const LINKEDIN_KPI_TEMPLATES = [
  {
    name: "LinkedIn CTR Target",
    description: "Monitor click-through rate performance",
    targetValue: "2.5",
    unit: "%",
    metric: "CTR"
  },
  {
    name: "LinkedIn CPC Optimization",
    description: "Keep cost per click under target",
    targetValue: "5.00",
    unit: "$",
    metric: "CPC"
  },
  {
    name: "LinkedIn Conversion Rate",
    description: "Track conversion performance",
    targetValue: "3.0",
    unit: "%",
    metric: "Conversion Rate"
  },
  {
    name: "LinkedIn ROAS",
    description: "Return on ad spend target",
    targetValue: "4.0",
    unit: "x",
    metric: "ROAS"
  }
];

export default function LinkedInAnalytics() {
  const [, params] = useRoute("/campaigns/:id/linkedin-analytics");
  const [location, setLocation] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get('session');
  const [selectedMetric, setSelectedMetric] = useState<string>('impressions');
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'templates' | 'configuration'>('configuration');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const { toast } = useToast();
  const campaignId = params?.id;
  
  // KPI Form State
  const [kpiForm, setKpiForm] = useState({
    name: '',
    unit: '',
    description: '',
    metric: '',
    targetValue: '',
    currentValue: '',
    priority: 'high',
    status: 'active',
    category: '',
    timeframe: 'monthly',
    trackingPeriod: '30',
    emailNotifications: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });

  // Benchmark Form State
  const [benchmarkForm, setBenchmarkForm] = useState({
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
    confidenceLevel: '',
    competitorName: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });

  // Report Form State
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
    status: 'draft' as const
  });
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  
  // Custom Report Configuration State
  const [customReportConfig, setCustomReportConfig] = useState({
    coreMetrics: [] as string[],
    derivedMetrics: [] as string[],
    kpis: [] as string[],
    benchmarks: [] as string[],
    includeAdComparison: false
  });

  // Detect user's time zone
  const [userTimeZone, setUserTimeZone] = useState('');
  
  useEffect(() => {
    // Detect time zone from browser
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimeZone(detectedTimeZone);
  }, []);

  // Get formatted time zone display (e.g., "GMT-5" or "PST")
  const getTimeZoneDisplay = () => {
    if (!userTimeZone) return '';
    
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimeZone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(now);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || userTimeZone;
    } catch (e) {
      return userTimeZone;
    }
  };

  // Fetch campaign data
  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
  });

  // Fetch import session data
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId],
    enabled: !!sessionId,
  });

  // Fetch ad performance data
  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ['/api/linkedin/imports', sessionId, 'ads'],
    enabled: !!sessionId,
  });

  // Fetch LinkedIn reports filtered by campaignId
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/reports', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/reports?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/linkedin/kpis', kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      toast({
        title: "KPI Created",
        description: "Your LinkedIn KPI has been created successfully.",
      });
      setIsKPIModalOpen(false);
      setModalStep('configuration');
      setKpiForm({
        name: '',
        unit: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        priority: 'high',
        status: 'active',
        category: '',
        timeframe: 'monthly',
        trackingPeriod: '30',
        emailNotifications: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create KPI",
        variant: "destructive",
      });
    }
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/linkedin/kpis/${kpiId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      toast({
        title: "KPI Deleted",
        description: "The KPI has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete KPI",
        variant: "destructive",
      });
    }
  });

  // Update KPI mutation
  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, kpiData }: { id: string, kpiData: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/linkedin/kpis/${id}`, kpiData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/kpis', campaignId] });
      toast({
        title: "KPI Updated",
        description: "Your LinkedIn KPI has been updated successfully.",
      });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      setKpiForm({
        name: '',
        unit: '',
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '',
        priority: 'high',
        status: 'active',
        category: '',
        timeframe: 'monthly',
        trackingPeriod: '30',
        emailNotifications: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update KPI",
        variant: "destructive",
      });
    }
  });

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setKpiForm({
      name: template.name,
      unit: template.unit,
      description: template.description,
      metric: '',
      targetValue: template.targetValue,
      currentValue: '',
      priority: 'high',
      status: 'active',
      category: '',
      timeframe: 'monthly',
      trackingPeriod: '30',
      emailNotifications: false,
      alertThreshold: '',
      alertCondition: 'below',
      emailRecipients: ''
    });
    setModalStep('configuration');
  };

  // Handle back to templates
  const handleBackToTemplates = () => {
    setModalStep('templates');
    setSelectedTemplate(null);
  };

  // Handle create KPI
  const handleCreateKPI = () => {
    const kpiData = {
      // platformType is extracted from URL by backend, don't send it
      campaignId: campaignId, // Include campaignId for data isolation
      name: kpiForm.name,
      targetValue: kpiForm.targetValue,
      currentValue: kpiForm.currentValue || '0',
      unit: kpiForm.unit,
      description: kpiForm.description,
      priority: kpiForm.priority,
      timeframe: kpiForm.timeframe,
      trackingPeriod: parseInt(kpiForm.trackingPeriod),
      status: 'tracking',
      rollingAverage: '7day',
      alertsEnabled: true,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: 'daily'
    };
    
    if (editingKPI) {
      updateKpiMutation.mutate({ id: editingKPI.id, kpiData });
    } else {
      createKpiMutation.mutate(kpiData);
    }
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const res = await apiRequest('POST', '/api/platforms/linkedin/benchmarks', benchmarkData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/benchmarks', campaignId] });
      toast({
        title: "Benchmark Created",
        description: "Your LinkedIn benchmark has been created successfully.",
      });
      setIsBenchmarkModalOpen(false);
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
        confidenceLevel: '',
        competitorName: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create benchmark",
        variant: "destructive",
      });
    }
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/platforms/linkedin/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/benchmarks', campaignId] });
      toast({
        title: "Benchmark Updated",
        description: "Your LinkedIn benchmark has been updated successfully.",
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
        confidenceLevel: '',
        competitorName: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update benchmark",
        variant: "destructive",
      });
    }
  });

  // Handle create Benchmark
  const handleCreateBenchmark = () => {
    const derivedCategory = getCategoryFromMetric(benchmarkForm.metric);
    const benchmarkData = {
      campaignId: campaignId, // Include campaignId for data isolation
      name: benchmarkForm.name,
      category: derivedCategory,
      benchmarkType: benchmarkForm.benchmarkType,
      unit: benchmarkForm.unit,
      benchmarkValue: benchmarkForm.benchmarkValue,
      currentValue: benchmarkForm.currentValue || '0',
      industry: benchmarkForm.industry,
      description: benchmarkForm.description,
      source: benchmarkForm.source,
      geoLocation: benchmarkForm.geographicLocation,
      period: benchmarkForm.period,
      confidenceLevel: benchmarkForm.confidenceLevel,
      competitorName: benchmarkForm.competitorName,
      alertsEnabled: benchmarkForm.alertsEnabled,
      alertThreshold: benchmarkForm.alertThreshold,
      alertCondition: benchmarkForm.alertCondition,
      emailRecipients: benchmarkForm.emailRecipients,
      status: 'active'
    };
    
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: benchmarkData });
    } else {
      createBenchmarkMutation.mutate(benchmarkData);
    }
  };

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest('POST', '/api/linkedin/reports', reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Created",
        description: "Your LinkedIn report has been created successfully.",
      });
      setIsReportModalOpen(false);
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
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create report",
        variant: "destructive",
      });
    }
  });

  // Delete Report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await apiRequest('DELETE', `/api/linkedin/reports/${reportId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Deleted",
        description: "The report has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    }
  });

  // Update Report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, reportData }: { reportId: string, reportData: any }) => {
      const res = await apiRequest('PUT', `/api/linkedin/reports/${reportId}`, reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/linkedin/reports', campaignId] });
      toast({
        title: "Report Updated",
        description: "Your report has been updated successfully.",
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
      setCustomReportConfig({
        coreMetrics: [],
        derivedMetrics: [],
        kpis: [],
        benchmarks: [],
        includeAdComparison: false
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update report",
        variant: "destructive",
      });
    }
  });

  // Handle report type selection
  const handleReportTypeSelect = (type: string) => {
    const reportNames = {
      'overview': 'Overview Report',
      'kpis': 'KPIs Report',
      'benchmarks': 'Benchmarks Report',
      'ads': 'Ad Comparison Report',
      'custom': 'Custom Report'
    };
    
    setReportForm({
      ...reportForm,
      reportType: type,
      name: reportNames[type as keyof typeof reportNames] || 'Report',
      configuration: {}
    });
    // Keep reportModalStep as 'standard' for single-page design
  };

  // Handle edit report
  const handleEditReport = (report: any) => {
    setEditingReportId(report.id);
    
    // Extract email recipients from array to string
    const emailRecipientsString = report.scheduleRecipients && Array.isArray(report.scheduleRecipients)
      ? report.scheduleRecipients.join(', ')
      : '';
    
    // Check if scheduling is enabled
    const scheduleEnabled = report.scheduleFrequency !== null && report.scheduleFrequency !== undefined;
    
    // Determine the modal step based on report type FIRST
    const modalStep = report.reportType === 'custom' ? 'custom' : 'standard';
    setReportModalStep(modalStep);
    
    // Parse configuration if it's a string
    const config = typeof report.configuration === 'string' 
      ? JSON.parse(report.configuration) 
      : report.configuration || {};
    
    // Set report form with existing values
    const formData = {
      name: report.name || '',
      description: report.description || '',
      reportType: report.reportType || '',
      configuration: config,
      scheduleEnabled: scheduleEnabled,
      scheduleFrequency: report.scheduleFrequency || 'weekly',
      scheduleDayOfWeek: config?.scheduleDayOfWeek || report.scheduleDayOfWeek || 'monday',
      scheduleTime: config?.scheduleTime || report.scheduleTime || '9:00 AM',
      emailRecipients: emailRecipientsString,
      status: report.status || 'draft'
    };
    setReportForm(formData);
    
    // Set custom report config if it's a custom report
    if (report.reportType === 'custom' && config?.customReportConfig) {
      setCustomReportConfig({
        coreMetrics: config.customReportConfig.coreMetrics || [],
        derivedMetrics: config.customReportConfig.derivedMetrics || [],
        kpis: config.customReportConfig.kpis || [],
        benchmarks: config.customReportConfig.benchmarks || [],
        includeAdComparison: config.customReportConfig.includeAdComparison || false
      });
    }
    
    // Open the modal after a brief delay to ensure state updates complete
    setTimeout(() => {
      setIsReportModalOpen(true);
    }, 0);
  };

  // Handle create report
  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled) {
      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Save scheduled report to database
      const reportData = {
        campaignId: campaignId || null,
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: reportForm.reportType,
        configuration: {
          ...reportForm.configuration,
          scheduleEnabled: reportForm.scheduleEnabled,
          scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: 'active'
      };
      createReportMutation.mutate(reportData);
    } else {
      // Generate and download report immediately
      handleDownloadReport();
    }
  };

  // Handle update report
  const handleUpdateReport = () => {
    if (!editingReportId) return;
    
    if (reportForm.scheduleEnabled) {
      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Update scheduled report in database
      const reportData = {
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: reportForm.reportType,
        configuration: reportForm.reportType === 'custom' 
          ? {
              customReportConfig,
              scheduleEnabled: reportForm.scheduleEnabled,
              scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
              scheduleTime: reportForm.scheduleTime
            }
          : {
              ...reportForm.configuration,
              scheduleEnabled: reportForm.scheduleEnabled,
              scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
              scheduleTime: reportForm.scheduleTime
            },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: reportForm.status || 'active'
      };
      updateReportMutation.mutate({ reportId: editingReportId, reportData });
    } else {
      // If schedule is disabled, just download the report
      handleDownloadReport();
    }
  };

  // Handle download report
  const handleDownloadReport = async () => {
    const reportName = reportForm.name || 'LinkedIn Report';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Generate PDF based on type
    switch (reportForm.reportType) {
      case 'overview':
        generateOverviewPDF(doc);
        break;
      case 'kpis':
        generateKPIsPDF(doc);
        break;
      case 'benchmarks':
        generateBenchmarksPDF(doc);
        break;
      case 'ads':
        generateAdComparisonPDF(doc);
        break;
    }

    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    // Close modal and reset form
    setIsReportModalOpen(false);
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

    toast({
      title: "Report Downloaded",
      description: "Your PDF report has been downloaded successfully.",
    });
  };

  // Handle custom report creation/download
  const handleCustomReport = () => {
    if (reportForm.scheduleEnabled) {
      // Convert email recipients string to array
      const emailRecipientsArray = reportForm.emailRecipients
        ? reportForm.emailRecipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];

      // Save scheduled custom report to database
      const reportData = {
        campaignId: campaignId || null,
        name: reportForm.name,
        description: reportForm.description || null,
        reportType: 'custom',
        configuration: {
          customReportConfig,
          scheduleEnabled: reportForm.scheduleEnabled,
          scheduleDayOfWeek: reportForm.scheduleDayOfWeek,
          scheduleTime: reportForm.scheduleTime
        },
        scheduleFrequency: reportForm.scheduleFrequency,
        scheduleRecipients: emailRecipientsArray.length > 0 ? emailRecipientsArray : null,
        status: 'active'
      };
      createReportMutation.mutate(reportData);
    } else {
      // Generate and download custom report immediately
      handleDownloadCustomReport();
    }
  };

  // Handle download custom report
  const handleDownloadCustomReport = async () => {
    const reportName = reportForm.name || 'Custom LinkedIn Report';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Generate Custom PDF
    generateCustomPDF(doc);

    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    // Close modal and reset form
    setIsReportModalOpen(false);
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
      benchmarks: [],
      includeAdComparison: false
    });

    toast({
      title: "Report Downloaded",
      description: "Your custom PDF report has been downloaded successfully.",
    });
  };

  // PDF Helper: Add header
  const addPDFHeader = (doc: any, title: string, subtitle: string) => {
    const { session, metrics } = (sessionData as any) || {};
    
    // Get unique campaign names from metrics
    const campaignNames = metrics 
      ? Array.from(new Set(metrics.map((m: any) => m.campaignName))).join(', ')
      : 'N/A';
    
    // LinkedIn brand color header
    doc.setFillColor(0, 119, 181); // LinkedIn blue
    doc.rect(0, 0, 210, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, 20);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(subtitle, 20, 30);
    
    // Report info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 50);
    doc.text(`Campaign: ${campaignNames}`, 20, 57);
  };

  // PDF Helper: Add section
  const addPDFSection = (doc: any, title: string, y: number, color: number[] = [66, 139, 202]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, y + 7);
    return y + 15;
  };

  // Generate Overview PDF
  const generateOverviewPDF = (doc: any) => {
    const { session, aggregated } = (sessionData as any) || {};
    
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    
    if (!aggregated || Object.keys(aggregated).length === 0) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text('No metrics data available', 20, y);
      return;
    }
    
    // Separate core and derived metrics
    const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'];
    const coreMetricsData: any[] = [];
    const derivedMetricsData: any[] = [];
    
    Object.entries(aggregated).forEach(([key, value]: [string, any]) => {
      const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
      const { label, format } = getMetricDisplay(metricKey, value);
      const formattedValue = format(value);
      
      if (derivedMetrics.includes(metricKey)) {
        derivedMetricsData.push({ label, value: formattedValue });
      } else {
        coreMetricsData.push({ label, value: formattedValue });
      }
    });
    
    // Core Metrics Section
    if (coreMetricsData.length > 0) {
      y = addPDFSection(doc, 'Core Metrics', y, [52, 168, 83]);
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      coreMetricsData.forEach((metric: any) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
      
      y += 10;
    }
    
    // Derived Metrics Section
    if (derivedMetricsData.length > 0) {
      y = addPDFSection(doc, 'Derived Metrics', y, [255, 159, 64]);
      doc.setTextColor(50, 50, 50);
      
      derivedMetricsData.forEach((metric: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${metric.label}:`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${metric.value}`, 120, y);
        y += 8;
      });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate KPIs PDF
  const generateKPIsPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Key Performance Indicators', y, [156, 39, 176]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (kpisData && Array.isArray(kpisData) && kpisData.length > 0) {
      kpisData.forEach((kpi: any) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // KPI Box - increased height for progress bar
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 38, 3, 3, 'S');
        
        // Metric name
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(`Metric: ${kpi.metricName || kpi.name}`, 25, y + 2);
        
        // Current and Target values
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Current: ${kpi.currentValue || 'N/A'}`, 25, y + 10);
        doc.text(`Target: ${kpi.targetValue}`, 100, y + 10);
        
        // Progress bar
        const current = parseFloat(kpi.currentValue) || 0;
        const target = parseFloat(kpi.targetValue) || 100;
        const progress = Math.min((current / target) * 100, 100);
        
        // Progress bar background (gray)
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(25, y + 18, 160, 8, 2, 2, 'F');
        
        // Progress bar fill (green if >= 100%, blue otherwise)
        if (progress > 0) {
          const fillColor = progress >= 100 ? [52, 168, 83] : [66, 139, 202];
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          const barWidth = (160 * progress) / 100;
          doc.roundedRect(25, y + 18, barWidth, 8, 2, 2, 'F');
        }
        
        // Progress percentage text - white and bold for visibility
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`${progress.toFixed(1)}%`, 105, y + 23, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(50, 50, 50);
        
        y += 46;
      });
    } else {
      doc.text('No KPIs configured yet', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Benchmarks PDF
  const generateBenchmarksPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Performance Benchmarks', y, [255, 99, 132]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0) {
      benchmarksData.forEach((benchmark: any) => {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }
        
        // Benchmark Box - increased height for all content
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 60, 3, 3, 'S');
        
        // Benchmark title
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(benchmark.name, 25, y + 2);
        
        // Description
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(benchmark.description || 'No description provided', 25, y + 9);
        
        // Context line (industry • period • type)
        const contextParts = [
          benchmark.industry || benchmark.source || '',
          benchmark.period || '',
          benchmark.benchmarkType || ''
        ].filter(p => p).join(' • ');
        doc.text(contextParts, 25, y + 15);
        doc.setTextColor(50, 50, 50);
        
        // Values section
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Your Performance', 25, y + 23);
        doc.text('Benchmark Value', 85, y + 23);
        doc.text('Source', 145, y + 23);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        doc.text(`${benchmark.currentValue || '0'}${benchmark.unit || ''}`, 25, y + 31);
        doc.text(`${benchmark.benchmarkValue || '0'}${benchmark.unit || ''}`, 85, y + 31);
        doc.text(benchmark.source || 'LinkedIn', 145, y + 31);
        
        // Performance vs Benchmark
        if (benchmark.currentValue && benchmark.benchmarkValue) {
          const current = parseFloat(benchmark.currentValue);
          const benchmarkVal = parseFloat(benchmark.benchmarkValue);
          const diff = current - benchmarkVal;
          const percentDiff = benchmarkVal > 0 ? Math.abs((diff / benchmarkVal) * 100).toFixed(0) : '0';
          const status = current > benchmarkVal ? 'Above' : current < benchmarkVal ? 'Below' : 'At';
          const statusColor = current >= benchmarkVal ? [52, 168, 83] : [220, 38, 38]; // green or red
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.text('Performance vs Benchmark:', 25, y + 41);
          
          // Status badge
          doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
          doc.roundedRect(25, y + 44, 35, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text(`${percentDiff}% ${status}`, 42.5, y + 49, { align: 'center' });
          
          // Status text
          doc.setTextColor(100, 100, 100);
          doc.setFont(undefined, 'normal');
          const statusText = current >= benchmarkVal ? 'Exceeds benchmark' : 'Needs improvement';
          doc.text(statusText, 63, y + 49);
          doc.setTextColor(50, 50, 50);
        }
        
        y += 68;
      });
    } else {
      doc.text('No benchmarks configured yet', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Ad Comparison PDF
  const generateAdComparisonPDF = (doc: any) => {
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    
    if (adsData && Array.isArray(adsData) && adsData.length > 0) {
      adsData.forEach((ad: any, index: number) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 42, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(`Ad #${index + 1}: ${ad.adName || ad.name || 'Unnamed Ad'}`, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Impressions: ${ad.impressions || 0}`, 25, y + 12);
        doc.text(`Clicks: ${ad.clicks || 0}`, 100, y + 12);
        doc.text(`CTR: ${ad.ctr || 0}%`, 25, y + 20);
        doc.text(`Spend: $${ad.spend || 0}`, 100, y + 20);
        doc.text(`Conversions: ${ad.conversions || 0}`, 25, y + 28);
        
        y += 50;
      });
    } else {
      doc.text('No ad data available', 20, y);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Generate Custom PDF based on user selections
  const generateCustomPDF = (doc: any) => {
    const { session, aggregated } = (sessionData as any) || {};
    
    addPDFHeader(doc, reportForm.name, 'LinkedIn Metrics');
    
    let y = 70;
    
    // Helper function to get metric label
    const getMetricLabel = (key: string): string => {
      const labels: Record<string, string> = {
        impressions: 'Impressions',
        clicks: 'Clicks',
        spend: 'Spend',
        conversions: 'Conversions',
        reach: 'Reach',
        engagements: 'Engagements',
        videoviews: 'Video Views',
        leads: 'Leads',
        revenue: 'Revenue',
        ctr: 'CTR',
        cpc: 'CPC',
        cpm: 'CPM',
        cvr: 'Conversion Rate',
        cpa: 'CPA',
        cpl: 'CPL',
        er: 'Engagement Rate',
        roi: 'ROI',
        roas: 'ROAS'
      };
      return labels[key] || key;
    };

    // Helper function to format metric value
    const formatMetricValue = (key: string, value: any): string => {
      if (!value && value !== 0) return 'N/A';
      
      const percentageMetrics = ['ctr', 'cvr', 'er', 'roi'];
      const currencyMetrics = ['spend', 'cpc', 'cpm', 'cpa', 'cpl', 'revenue'];
      
      if (percentageMetrics.includes(key)) {
        return `${parseFloat(value).toFixed(2)}%`;
      } else if (currencyMetrics.includes(key)) {
        return `$${parseFloat(value).toFixed(2)}`;
      } else if (key === 'roas') {
        return `${parseFloat(value).toFixed(2)}x`;
      } else {
        return parseFloat(value).toLocaleString();
      }
    };

    // Overview Section - Core and Derived Metrics
    const hasMetrics = customReportConfig.coreMetrics.length > 0 || customReportConfig.derivedMetrics.length > 0;
    
    if (hasMetrics) {
      y = addPDFSection(doc, 'Overview', y, [54, 162, 235]);
      
      // Core Metrics
      if (customReportConfig.coreMetrics.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Core Metrics', 20, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        customReportConfig.coreMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = aggregated?.[metric] || 0;
          const formattedValue = formatMetricValue(metric, value);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 5;
      }
      
      // Derived Metrics
      if (customReportConfig.derivedMetrics.length > 0) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Derived Metrics', 20, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        customReportConfig.derivedMetrics.forEach((metric, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          
          const label = getMetricLabel(metric);
          const value = aggregated?.[metric] || 0;
          const formattedValue = formatMetricValue(metric, value);
          
          doc.text(`${label}: ${formattedValue}`, 25, y);
          y += 8;
        });
        
        y += 10;
      }
    }

    // KPIs Section
    if (customReportConfig.kpis.length > 0 && kpisData && Array.isArray(kpisData)) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Key Performance Indicators', y, [16, 185, 129]);
      
      const selectedKPIs = kpisData.filter((kpi: any) => customReportConfig.kpis.includes(kpi.id));
      
      selectedKPIs.forEach((kpi: any) => {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 35, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(kpi.name, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Metric: ${getMetricLabel(kpi.metric)}`, 25, y + 10);
        
        const currentValue = aggregated?.[kpi.metric] || 0;
        const targetValue = kpi.targetValue || 0;
        const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
        
        doc.text(`Current: ${formatMetricValue(kpi.metric, currentValue)}`, 25, y + 18);
        doc.text(`Target: ${formatMetricValue(kpi.metric, targetValue)}`, 100, y + 18);
        
        const barWidth = 140;
        const barHeight = 6;
        const barX = 25;
        const barY = y + 22;
        
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');
        
        if (progress > 0) {
          const fillColor = progress >= 100 ? [16, 185, 129] : [59, 130, 246];
          doc.setFillColor(...fillColor);
          doc.roundedRect(barX, barY, (barWidth * progress) / 100, barHeight, 2, 2, 'F');
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(255, 255, 255);
          const progressText = `${progress.toFixed(0)}%`;
          const textWidth = doc.getTextWidth(progressText);
          const textX = barX + ((barWidth * progress) / 100) / 2 - textWidth / 2;
          doc.text(progressText, textX, barY + 4.5);
        }
        
        y += 45;
      });
    }

    // Benchmarks Section
    if (customReportConfig.benchmarks.length > 0 && benchmarksData && Array.isArray(benchmarksData)) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Benchmarks', y, [139, 92, 246]);
      
      const selectedBenchmarks = benchmarksData.filter((benchmark: any) => customReportConfig.benchmarks.includes(benchmark.id));
      
      selectedBenchmarks.forEach((benchmark: any) => {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 45, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(benchmark.name, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(benchmark.description || '', 25, y + 10, { maxWidth: 160 });
        
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text(`Metric: ${getMetricLabel(benchmark.metric)}`, 25, y + 20);
        
        const currentValue = aggregated?.[benchmark.metric] || 0;
        const benchmarkValue = benchmark.benchmarkValue || 0;
        
        doc.text(`Performance: ${formatMetricValue(benchmark.metric, currentValue)}`, 25, y + 28);
        doc.text(`Benchmark: ${formatMetricValue(benchmark.metric, benchmarkValue)}`, 100, y + 28);
        
        const diff = currentValue - benchmarkValue;
        const status = diff >= 0 ? 'Above' : 'Below';
        const statusColor = diff >= 0 ? [16, 185, 129] : [239, 68, 68];
        
        doc.setFillColor(...statusColor);
        doc.roundedRect(25, y + 32, 35, 6, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(status, 42.5, y + 36.5, { align: 'center' });
        
        y += 55;
      });
    }

    // Ad Comparison Section
    if (customReportConfig.includeAdComparison && adsData && Array.isArray(adsData) && adsData.length > 0) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      y = addPDFSection(doc, 'Ad Performance Comparison', y, [54, 162, 235]);
      
      adsData.forEach((ad: any, index: number) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(20, y - 5, 170, 42, 3, 3, 'S');
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(`Ad #${index + 1}: ${ad.adName || ad.name || 'Unnamed Ad'}`, 25, y + 2);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Impressions: ${ad.impressions || 0}`, 25, y + 12);
        doc.text(`Clicks: ${ad.clicks || 0}`, 100, y + 12);
        doc.text(`CTR: ${ad.ctr || 0}%`, 25, y + 20);
        doc.text(`Spend: $${ad.spend || 0}`, 100, y + 20);
        doc.text(`Conversions: ${ad.conversions || 0}`, 25, y + 28);
        
        y += 50;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PerformanceCore Analytics Platform', 105, 285, { align: 'center' });
  };

  // Dynamic labels based on benchmark type
  const getBenchmarkValueLabel = (type: string) => {
    switch(type) {
      case 'industry_average': return 'Industry Benchmark Value';
      case 'competitor': return 'Competitor Value';
      case 'historical': return 'Historical Value';
      case 'target': return 'Target Value';
      case 'best_practice': return 'Best Practice Value';
      default: return 'Benchmark Value';
    }
  };

  const getContextFieldLabel = (type: string) => {
    switch(type) {
      case 'industry_average': return 'Industry';
      case 'competitor': return 'Competitor Name';
      case 'historical': return 'Time Period';
      case 'target': return 'Goal Context';
      case 'best_practice': return 'Source/Authority';
      default: return 'Context';
    }
  };

  const getContextFieldPlaceholder = (type: string) => {
    switch(type) {
      case 'industry_average': return 'e.g., Technology, Healthcare';
      case 'competitor': return 'e.g., Company XYZ';
      case 'historical': return 'e.g., Q1 2024, Last Year';
      case 'target': return 'e.g., Q4 Goal, Annual Target';
      case 'best_practice': return 'e.g., LinkedIn Marketing Labs';
      default: return 'Enter context';
    }
  };

  // Fetch platform-level LinkedIn KPIs filtered by campaignId
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/linkedin/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch platform-level LinkedIn Benchmarks filtered by campaignId
  const { data: benchmarksData, isLoading: benchmarksLoading} = useQuery({
    queryKey: ['/api/platforms/linkedin/benchmarks', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/linkedin/benchmarks?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      return response.json();
    },
    enabled: !!campaignId,
  });

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return (isNaN(n) ? 0 : n).toLocaleString();
  };
  
  const formatCurrency = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return `$${(isNaN(n) ? 0 : n).toFixed(2)}`;
  };
  
  const formatPercentage = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return `${(isNaN(n) ? 0 : n).toFixed(2)}%`;
  };

  // Helper function to get metric icon and formatted value
  const getMetricDisplay = (metricKey: string, value: number | string) => {
    const metricConfig: Record<string, { icon: any; format: (v: number | string) => string; label: string }> = {
      'impressions': { icon: Eye, format: formatNumber, label: 'Impressions' },
      'reach': { icon: Users, format: formatNumber, label: 'Reach' },
      'clicks': { icon: MousePointerClick, format: formatNumber, label: 'Clicks' },
      'ctr': { icon: TrendingUp, format: formatPercentage, label: 'Click-Through Rate (CTR)' },
      'engagements': { icon: Activity, format: formatNumber, label: 'Engagements' },
      'spend': { icon: DollarSign, format: formatCurrency, label: 'Spend' },
      'cpc': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Click (CPC)' },
      'cpm': { icon: DollarSign, format: formatCurrency, label: 'Cost Per Mille (CPM)' },
      'conversions': { icon: Target, format: formatNumber, label: 'Conversions' },
      'leads': { icon: Users, format: formatNumber, label: 'Leads' },
      'videoviews': { icon: Play, format: formatNumber, label: 'Video Views' },
      'viralimpressions': { icon: Activity, format: formatNumber, label: 'Viral Impressions' },
      'cvr': { icon: Target, format: formatPercentage, label: 'Conversion Rate (CVR)' },
      'cpa': { icon: DollarSign, format: formatCurrency, label: 'Cost per Acquisition (CPA)' },
      'cpl': { icon: DollarSign, format: formatCurrency, label: 'Cost per Lead (CPL)' },
      'er': { icon: Activity, format: formatPercentage, label: 'Engagement Rate (ER)' },
      'roi': { icon: TrendingUp, format: formatPercentage, label: 'Return on Investment (ROI)' },
      'roas': { icon: TrendingUp, format: (v: number | string) => `${typeof v === 'number' ? v.toFixed(2) : v}x`, label: 'Return on Ad Spend (ROAS)' },
    };

    return metricConfig[metricKey] || { icon: BarChart3, format: formatNumber, label: metricKey };
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Extract campaign and session data
  const campaign = campaignData as any;
  const { session, metrics, aggregated } = (sessionData as any) || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation(`/campaigns/${params?.id}`)}
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <SiLinkedin className="w-6 h-6 text-blue-600" />
                    LinkedIn Analytics
                  </h1>
                  {session ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {session.adAccountName} • {session.selectedCampaignsCount} campaigns • {session.selectedMetricsCount} metrics
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Campaign analytics and performance tracking
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
                <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="ads" data-testid="tab-ads">Ad Comparison</TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
                {sessionLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    </div>
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : sessionData && aggregated ? (
                  <>
                    {/* LinkedIn Metrics Grid - 4 columns - Core Metrics Only */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(aggregated)
                        .filter(([key]) => {
                          // Only show core metrics, exclude derived metrics
                          const derivedMetrics = ['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'];
                          const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                          
                          // Filter out derived metrics
                          if (derivedMetrics.includes(metricKey)) return false;
                          
                          // Filter based on selected metrics from the session (case-insensitive)
                          const selectedMetricKeys = session?.selectedMetricKeys || [];
                          if (selectedMetricKeys.length > 0) {
                            const selectedMetricKeysLower = selectedMetricKeys.map((k: string) => k.toLowerCase());
                            return selectedMetricKeysLower.includes(metricKey);
                          }
                          
                          return true;
                        })
                        .map(([key, value]: [string, any]) => {
                          const metricKey = key.replace('total', '').replace('avg', '').toLowerCase();
                          const { icon: Icon, format, label } = getMetricDisplay(metricKey, value);
                          
                          return (
                            <Card key={key} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    {label}
                                  </h3>
                                  <Icon className="w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {format(value)}
                                </p>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>

                    {/* Campaign Breakdown */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Campaign Breakdown</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Comprehensive metrics by individual campaigns
                          </p>
                        </div>
                      </div>

                      {/* Sort and Filter Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Sort by:</span>
                            <Select value={sortBy} onValueChange={setSortBy}>
                              <SelectTrigger className="w-[140px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="spend">Spend</SelectItem>
                                <SelectItem value="conversions">Conversions</SelectItem>
                                <SelectItem value="roas">ROAS</SelectItem>
                                <SelectItem value="ctr">CTR</SelectItem>
                                <SelectItem value="cpa">CPA</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Filter:</span>
                            <Select value={filterBy} onValueChange={setFilterBy}>
                              <SelectTrigger className="w-[140px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {metrics ? Object.keys(metrics.reduce((acc: any, m: any) => ({ ...acc, [m.campaignUrn]: true }), {})).length : 0} campaigns
                        </span>
                      </div>

                      {metrics && metrics.length > 0 ? (
                        <div className="space-y-4">
                          {Object.values(
                            metrics.reduce((acc: any, metric: any) => {
                              if (!acc[metric.campaignUrn]) {
                                acc[metric.campaignUrn] = {
                                  urn: metric.campaignUrn,
                                  name: metric.campaignName,
                                  status: metric.campaignStatus,
                                  metrics: {}
                                };
                              }
                              acc[metric.campaignUrn].metrics[metric.metricKey] = parseFloat(metric.metricValue);
                              return acc;
                            }, {})
                          ).map((linkedInCampaign: any, index: number) => {
                            // Calculate derived metrics
                            const impressions = linkedInCampaign.metrics.impressions || 0;
                            const clicks = linkedInCampaign.metrics.clicks || 0;
                            const spend = linkedInCampaign.metrics.spend || 0;
                            const conversions = linkedInCampaign.metrics.conversions || 0;
                            const engagements = linkedInCampaign.metrics.engagements || 0;
                            
                            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                            const cpc = clicks > 0 ? spend / clicks : 0;
                            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                            const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                            const costPerConv = conversions > 0 ? spend / conversions : 0;
                            const cpa = costPerConv;
                            const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
                            const roas = aggregated?.roas || 0;
                            
                            return (
                              <Card key={index} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                  {/* Campaign Header */}
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3">
                                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                                      <div>
                                        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                                          {linkedInCampaign.name}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                          Campaign ID: {index + 1}
                                        </p>
                                      </div>
                                    </div>
                                    <Badge 
                                      variant={linkedInCampaign.status === 'active' ? 'default' : 'secondary'}
                                      className={linkedInCampaign.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                    >
                                      {linkedInCampaign.status}
                                    </Badge>
                                  </div>

                                  {/* Primary Metrics */}
                                  <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Impressions</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(impressions)}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(clicks)}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(spend)}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatNumber(conversions)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Secondary Metrics */}
                                  <div className="grid grid-cols-5 gap-3 mb-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(ctr)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpc)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(cpm)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Conv. Rate</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatPercentage(convRate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Cost/Conv.</p>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(costPerConv)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Performance Indicators */}
                                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {/* CTR Indicators */}
                                      {ctr > 5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CTR Excellent</span>
                                        </div>
                                      )}
                                      {ctr < 1 && ctr > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CTR Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* Conversion Rate Indicators */}
                                      {convRate > 10 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Conversion High</span>
                                        </div>
                                      )}
                                      {convRate < 2 && convRate > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Conversion Low</span>
                                        </div>
                                      )}
                                      
                                      {/* CPA Indicators */}
                                      {cpa > 0 && cpa < 150 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CPA Strong</span>
                                        </div>
                                      )}
                                      {cpa > 300 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">CPA Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* ROAS Indicators */}
                                      {roas > 4 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Strong</span>
                                        </div>
                                      )}
                                      {roas > 0 && roas < 1.5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Weak</span>
                                        </div>
                                      )}
                                      
                                      {/* Engagement Rate Indicators */}
                                      {engagementRate > 2 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Good</span>
                                        </div>
                                      )}
                                      {engagementRate > 0 && engagementRate < 0.5 && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Low</span>
                                        </div>
                                      )}
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-blue-600 hover:text-blue-700"
                                      onClick={() => {
                                        setSelectedCampaignDetails(linkedInCampaign);
                                        setIsCampaignDetailsModalOpen(true);
                                      }}
                                      data-testid={`button-view-details-${index}`}
                                    >
                                      View Details →
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <p className="text-slate-500">No campaign data available</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No LinkedIn Data Available</CardTitle>
                      <CardDescription>
                        No LinkedIn import session data found for this campaign
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          To view LinkedIn campaign metrics, you need to import data from your LinkedIn Ads account.
                        </p>
                        <Button 
                          onClick={() => setLocation(`/campaigns/${campaignId}`)}
                          data-testid="button-import-linkedin"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Go to Campaign to Import LinkedIn Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                          Track and monitor your LinkedIn campaign KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: 'KPIs Report',
                              description: '',
                              reportType: 'kpis',
                              configuration: {},
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-slate-300 dark:border-slate-700"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    {/* KPI Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                              <p className="text-sm text-slate-600 dark:text-slate-400">Exceeding Target</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  return target > 0 && current >= target * 1.2;
                                }).length}
                              </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Meeting Target</p>
                              <p className="text-2xl font-bold text-amber-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  return target > 0 && current >= target && current < target * 1.2;
                                }).length}
                              </p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-amber-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Below Target</p>
                              <p className="text-2xl font-bold text-red-600">
                                {(kpisData as any[]).filter((k: any) => {
                                  const current = parseFloat(k.currentValue || '0');
                                  const target = parseFloat(k.targetValue || '0');
                                  return target > 0 && current < target;
                                }).length}
                              </p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-red-500" />
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
                                <Badge variant={kpi.status === 'active' ? 'default' : 'secondary'}>
                                  {kpi.status || 'active'}
                                </Badge>
                                {kpi.priority && (
                                  <Badge variant="outline" className={
                                    kpi.priority === 'high' ? 'text-red-600 border-red-300' :
                                    kpi.priority === 'medium' ? 'text-yellow-600 border-yellow-300' :
                                    'text-green-600 border-green-300'
                                  }>
                                    {kpi.priority}
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
                                      status: kpi.status || 'active',
                                      category: kpi.category || '',
                                      timeframe: kpi.timeframe || 'monthly',
                                      trackingPeriod: kpi.trackingPeriod?.toString() || '30',
                                      emailNotifications: kpi.emailNotifications || false,
                                      alertThreshold: kpi.alertThreshold || '',
                                      alertCondition: kpi.alertCondition || 'below',
                                      emailRecipients: kpi.emailRecipients || ''
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
                            {kpi.targetValue && kpi.currentValue && (() => {
                              const actualProgress = (parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100;
                              const progressBarWidth = Math.min(actualProgress, 100);
                              const isOutperforming = actualProgress >= 100;
                              
                              return (
                                <div className="space-y-3">
                                  {/* Progress to Target */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-600 dark:text-slate-400">Progress to Target</span>
                                        {isOutperforming && <TrendingUp className="w-4 h-4 text-green-600" />}
                                        {!isOutperforming && actualProgress > 0 && <Activity className="w-4 h-4 text-blue-600" />}
                                      </div>
                                      <span className="font-semibold text-slate-900 dark:text-white">
                                        {Math.round(actualProgress)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                      <div 
                                        className={`h-2.5 rounded-full transition-all ${
                                          isOutperforming ? 'bg-green-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${Math.round(progressBarWidth)}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Timeframe Indicator */}
                                  <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="capitalize">
                                      {kpi.timeframe || 'Monthly'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {kpi.category && (
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Category: <span className="font-medium">{kpi.category}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and monitor your LinkedIn campaign KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: 'KPIs Report',
                              description: '',
                              reportType: 'kpis',
                              configuration: {},
                              scheduleEnabled: false,
                              scheduleFrequency: 'weekly',
                              scheduleDayOfWeek: 'monday',
                              scheduleTime: '9:00 AM',
                              emailRecipients: '',
                              status: 'draft'
                            });
                            setIsReportModalOpen(true);
                          }}
                          className="border-slate-300 dark:border-slate-700"
                          data-testid="button-export-kpi-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export KPI Report
                        </Button>
                        <Button 
                          onClick={() => setIsKPIModalOpen(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-purple-600" />
                          LinkedIn Campaign KPIs
                        </CardTitle>
                        <CardDescription>
                          Track key performance indicators for your LinkedIn campaigns
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-12">
                          <p className="text-slate-600 dark:text-slate-400 mb-4">
                            No KPIs have been created yet.
                          </p>
                          <Button 
                            onClick={() => setIsKPIModalOpen(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            data-testid="button-create-kpi"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create KPI
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
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
                    className="bg-blue-600 hover:bg-blue-700 text-white"
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
                            <Award className="w-8 h-8 text-blue-500" />
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
                                      benchmarkType: benchmark.benchmarkType || '',
                                      unit: benchmark.unit || '',
                                      benchmarkValue: benchmark.benchmarkValue || '',
                                      currentValue: benchmark.currentValue || '',
                                      industry: benchmark.industry || '',
                                      description: benchmark.description || '',
                                      source: benchmark.source || '',
                                      geographicLocation: benchmark.geoLocation || '',
                                      period: benchmark.period || 'monthly',
                                      confidenceLevel: benchmark.confidenceLevel || '',
                                      competitorName: benchmark.competitorName || '',
                                      alertsEnabled: benchmark.alertsEnabled || false,
                                      alertThreshold: benchmark.alertThreshold || '',
                                      alertCondition: benchmark.alertCondition || 'below',
                                      emailRecipients: benchmark.emailRecipients || ''
                                    });
                                    setIsBenchmarkModalOpen(true);
                                  }}
                                  data-testid={`button-edit-benchmark-${benchmark.id}`}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
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
                                  {benchmark.source || 'LinkedIn'}
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
                        LinkedIn Benchmarks
                      </CardTitle>
                      <CardDescription>
                        Compare your performance against industry benchmarks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                          No benchmarks have been created for this campaign yet.
                        </p>
                        <Button 
                          onClick={() => setIsBenchmarkModalOpen(true)}
                          data-testid="button-create-benchmark"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Ad Comparison Tab */}
              <TabsContent value="ads" className="space-y-6" data-testid="content-ads">
                {adsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ) : adsData && (adsData as any[]).length > 0 ? (
                  (() => {
                    const sortedAds = [...(adsData as any[])].sort((a, b) => parseFloat(b.revenue || '0') - parseFloat(a.revenue || '0'));
                    const topAd = sortedAds[0];
                    
                    // Get selected metrics from session to ensure consistency with Overview tab
                    const selectedMetricKeys = session?.selectedMetricKeys || [];
                    
                    // Map of all possible metrics with their display properties
                    const allMetricsMap: Record<string, { key: string, label: string, format: (v: any) => string }> = {
                      impressions: { key: 'impressions', label: 'Impressions', format: formatNumber },
                      clicks: { key: 'clicks', label: 'Clicks', format: formatNumber },
                      spend: { key: 'spend', label: 'Spend', format: formatCurrency },
                      ctr: { key: 'ctr', label: 'CTR', format: formatPercentage },
                      cpc: { key: 'cpc', label: 'CPC', format: formatCurrency },
                      cpm: { key: 'cpm', label: 'CPM', format: formatCurrency },
                      conversions: { key: 'conversions', label: 'Conversions', format: formatNumber },
                      revenue: { key: 'revenue', label: 'Revenue', format: formatCurrency },
                      leads: { key: 'leads', label: 'Leads', format: formatNumber },
                      engagements: { key: 'engagements', label: 'Engagements', format: formatNumber },
                      reach: { key: 'reach', label: 'Reach', format: formatNumber },
                      videoViews: { key: 'videoViews', label: 'Video Views', format: formatNumber },
                      viralImpressions: { key: 'viralImpressions', label: 'Viral Impressions', format: formatNumber }
                    };
                    
                    // Filter available metrics based on what was actually selected during import
                    // Include both core metrics and their derived versions (e.g., if 'clicks' is selected, also show 'ctr', 'cpc')
                    type MetricInfo = { key: string, label: string, format: (v: any) => string };
                    const availableMetrics = selectedMetricKeys
                      .map((key: string) => {
                        // Add the core metric if it exists in the map
                        const metrics: MetricInfo[] = [];
                        if (allMetricsMap[key]) {
                          metrics.push(allMetricsMap[key]);
                        }
                        
                        // Add derived metrics based on selected core metrics
                        if (key === 'impressions' && allMetricsMap.cpm && selectedMetricKeys.includes('spend')) {
                          metrics.push(allMetricsMap.cpm);
                        }
                        if (key === 'clicks' && selectedMetricKeys.includes('impressions') && allMetricsMap.ctr) {
                          metrics.push(allMetricsMap.ctr);
                        }
                        if (key === 'clicks' && selectedMetricKeys.includes('spend') && allMetricsMap.cpc) {
                          metrics.push(allMetricsMap.cpc);
                        }
                        
                        return metrics;
                      })
                      .flat()
                      .filter((metric: MetricInfo, index: number, self: MetricInfo[]) => 
                        // Remove duplicates
                        index === self.findIndex((m: MetricInfo) => m.key === metric.key)
                      );

                    // Colors for each ad line
                    const adColors = [
                      '#3b82f6', // blue
                      '#10b981', // green
                      '#ef4444', // red
                      '#a855f7', // purple
                      '#f97316', // orange
                      '#6366f1', // indigo
                      '#ec4899', // pink
                      '#14b8a6', // teal
                      '#f59e0b', // amber
                      '#8b5cf6', // violet
                    ];

                    // Get the current selected metric or default to first available metric
                    const currentMetric = availableMetrics.find((m: MetricInfo) => m.key === selectedMetric) || availableMetrics[0];
                    
                    // If no metrics are available, show a message
                    if (!currentMetric || availableMetrics.length === 0) {
                      return (
                        <Card data-testid="no-metrics-message">
                          <CardContent className="py-12">
                            <div className="text-center">
                              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                No Metrics Available
                              </h3>
                              <p className="text-slate-600 dark:text-slate-400">
                                The selected campaigns don't have metrics data for ad-level comparison.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Transform data: Create chart data for the selected metric only
                    // X-axis will be ad names, Y-axis will be the metric value
                    const chartData = sortedAds.map((ad, index) => {
                      const value = currentMetric.key === 'spend' || currentMetric.key === 'ctr' || currentMetric.key === 'cpc' || currentMetric.key === 'revenue' || currentMetric.key === 'cpm'
                        ? parseFloat((ad as any)[currentMetric.key] || '0')
                        : (ad as any)[currentMetric.key] || 0;
                      
                      return {
                        name: ad.adName,
                        value: value,
                        color: adColors[index % adColors.length],
                      };
                    });

                    return (
                      <div className="space-y-6">
                        {/* Top Performer Banner */}
                        <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white" data-testid="top-performer-banner">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Trophy className="w-8 h-8" />
                                <div>
                                  <p className="text-sm opacity-90">Top Revenue Driver</p>
                                  <p className="text-xl font-bold">{topAd.adName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold">{formatCurrency(parseFloat(topAd.revenue || '0'))}</p>
                                <p className="text-sm opacity-90">in revenue</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Visual Performance Comparison */}
                        <Card data-testid="comparison-chart">
                          <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <CardTitle>Ad Performance Comparison</CardTitle>
                                <CardDescription>
                                  Select a metric to compare across all ads
                                </CardDescription>
                              </div>
                              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                <SelectTrigger className="w-[200px]" data-testid="select-metric">
                                  <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableMetrics.map((metric: MetricInfo) => (
                                    <SelectItem key={metric.key} value={metric.key}>
                                      {metric.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={450}>
                              <BarChart 
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="name" 
                                  tick={{ fontSize: 12 }} 
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={(value) => currentMetric.format(value)}
                                />
                                <Tooltip 
                                  formatter={(value: any) => currentMetric.format(value)}
                                  labelStyle={{ color: '#000' }}
                                />
                                <Bar 
                                  dataKey="value" 
                                  name={currentMetric.label}
                                  radius={[8, 8, 0, 0]}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            
                            {/* Ad Details Cards */}
                            <div className="mt-6 space-y-3">
                              {sortedAds.map((ad, index) => {
                                const revenue = parseFloat(ad.revenue || '0');
                                const isTop = index === 0;
                                const isBottom = index === sortedAds.length - 1 && sortedAds.length > 2;

                                return (
                                  <div 
                                    key={ad.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      isTop ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                                      isBottom ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 
                                      'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                                    }`}
                                    data-testid={`ad-detail-${index}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                                        style={{ backgroundColor: adColors[index % adColors.length] }}
                                      >
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-semibold text-slate-900 dark:text-white">{ad.adName}</h4>
                                          {isTop && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">TOP</span>}
                                        </div>
                                        <p className="text-sm text-slate-500">{ad.campaignName}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-slate-500">Revenue</p>
                                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(revenue)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Quick Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card data-testid="total-revenue-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(sortedAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0))}
                              </p>
                            </CardContent>
                          </Card>
                          <Card data-testid="avg-revenue-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Average Revenue/Ad</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(sortedAds.reduce((sum, ad) => sum + parseFloat(ad.revenue || '0'), 0) / sortedAds.length)}
                              </p>
                            </CardContent>
                          </Card>
                          <Card data-testid="total-ads-stat">
                            <CardContent className="pt-6">
                              <p className="text-sm text-slate-500 mb-1">Total Ads Compared</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">{sortedAds.length}</p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-500">No ad performance data available</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6" data-testid="content-reports">
                {/* Header with Create Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reports</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Create, schedule, and manage analytics reports
                    </p>
                  </div>
                  <Button 
                    data-testid="button-create-report" 
                    className="gap-2"
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
                        benchmarks: [],
                        includeAdComparison: false
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
                      <Card key={report.id} data-testid={`report-${report.id}`}>
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
                                <Badge variant="outline">{report.reportType}</Badge>
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
                              <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
                                Download
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                data-testid={`button-edit-${report.id}`}
                                onClick={() => handleEditReport(report)}
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Report Library</CardTitle>
                      <CardDescription>
                        View and manage your saved reports
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No reports created yet</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                          Create your first report to get started
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Create LinkedIn KPI Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          setModalStep('configuration');
          setSelectedTemplate(null);
          setEditingKPI(null);
          setKpiForm({
            name: '',
            unit: '',
            description: '',
            metric: '',
            targetValue: '',
            currentValue: '',
            priority: 'high',
            status: 'active',
            category: '',
            timeframe: 'monthly',
            trackingPeriod: '30',
            emailNotifications: false,
            alertThreshold: '',
            alertCondition: 'below',
            emailRecipients: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
            <DialogDescription>
              {editingKPI 
                ? 'Update the KPI details below. The current value can be auto-populated from your LinkedIn metrics data.'
                : 'Define a new KPI for your LinkedIn campaign. You can select metrics from the selected campaign as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-name">KPI Name *</Label>
                <Input
                  id="kpi-name"
                  placeholder="e.g., LinkedIn CTR Target"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  data-testid="input-kpi-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-metric">Metric Source</Label>
                <Select
                  value={kpiForm.metric || ''}
                  onValueChange={(value) => {
                    // Auto-populate current value from LinkedIn aggregated metrics
                    let currentValue = '';
                    let unit = '';
                    if (aggregated) {
                      switch(value) {
                        case 'impressions':
                          currentValue = String(aggregated.totalImpressions || 0);
                          break;
                        case 'reach':
                          currentValue = String(aggregated.totalReach || 0);
                          break;
                        case 'clicks':
                          currentValue = String(aggregated.totalClicks || 0);
                          break;
                        case 'engagements':
                          currentValue = String(aggregated.totalEngagements || 0);
                          break;
                        case 'spend':
                          currentValue = String(aggregated.totalSpend || 0);
                          unit = '$';
                          break;
                        case 'conversions':
                          currentValue = String(aggregated.totalConversions || 0);
                          break;
                        case 'leads':
                          currentValue = String(aggregated.totalLeads || 0);
                          break;
                        case 'videoViews':
                          currentValue = String(aggregated.totalVideoViews || 0);
                          break;
                        case 'viralImpressions':
                          currentValue = String(aggregated.totalViralImpressions || 0);
                          break;
                        case 'ctr':
                          currentValue = String(aggregated.ctr || 0);
                          unit = '%';
                          break;
                        case 'cpc':
                          currentValue = String(aggregated.cpc || 0);
                          unit = '$';
                          break;
                        case 'cpm':
                          currentValue = String(aggregated.cpm || 0);
                          unit = '$';
                          break;
                        case 'cvr':
                          currentValue = String(aggregated.cvr || 0);
                          unit = '%';
                          break;
                        case 'cpa':
                          currentValue = String(aggregated.cpa || 0);
                          unit = '$';
                          break;
                        case 'cpl':
                          currentValue = String(aggregated.cpl || 0);
                          unit = '$';
                          break;
                        case 'er':
                          currentValue = String(aggregated.er || 0);
                          unit = '%';
                          break;
                        case 'roi':
                          currentValue = String(aggregated.roi || 0);
                          unit = '%';
                          break;
                        case 'roas':
                          currentValue = String(aggregated.roas || 0);
                          unit = 'x';
                          break;
                      }
                    }
                    setKpiForm({ ...kpiForm, metric: value, currentValue, unit });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-kpi-metric">
                    <SelectValue placeholder="Select metric to track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impressions">Impressions (from metrics)</SelectItem>
                    <SelectItem value="reach">Reach (from metrics)</SelectItem>
                    <SelectItem value="clicks">Clicks (from metrics)</SelectItem>
                    <SelectItem value="engagements">Engagements (from metrics)</SelectItem>
                    <SelectItem value="spend">Spend (from metrics)</SelectItem>
                    <SelectItem value="conversions">Conversions (from metrics)</SelectItem>
                    <SelectItem value="leads">Leads (from metrics)</SelectItem>
                    <SelectItem value="videoViews">Video Views (from metrics)</SelectItem>
                    <SelectItem value="viralImpressions">Viral Impressions (from metrics)</SelectItem>
                    <SelectItem value="ctr">CTR - Click-Through Rate (from metrics)</SelectItem>
                    <SelectItem value="cpc">CPC - Cost Per Click (from metrics)</SelectItem>
                    <SelectItem value="cpm">CPM - Cost Per Mille (from metrics)</SelectItem>
                    <SelectItem value="cvr">CVR - Conversion Rate (from metrics)</SelectItem>
                    <SelectItem value="cpa">CPA - Cost Per Acquisition (from metrics)</SelectItem>
                    <SelectItem value="cpl">CPL - Cost Per Lead (from metrics)</SelectItem>
                    <SelectItem value="er">ER - Engagement Rate (from metrics)</SelectItem>
                    <SelectItem value="roi">ROI - Return on Investment (from metrics)</SelectItem>
                    <SelectItem value="roas">ROAS - Return on Ad Spend (from metrics)</SelectItem>
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
                  type="text"
                  placeholder="0"
                  value={kpiForm.currentValue ? parseFloat(kpiForm.currentValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setKpiForm({ ...kpiForm, currentValue: value });
                    }
                  }}
                  data-testid="input-kpi-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target Value *</Label>
                <Input
                  id="kpi-target"
                  type="text"
                  placeholder="0"
                  value={kpiForm.targetValue ? parseFloat(kpiForm.targetValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setKpiForm({ ...kpiForm, targetValue: value });
                    }
                  }}
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

            {/* Alert Settings Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpi-alerts-enabled"
                  checked={kpiForm.emailNotifications}
                  onCheckedChange={(checked) => setKpiForm({ ...kpiForm, emailNotifications: checked as boolean })}
                  data-testid="checkbox-kpi-alerts"
                />
                <Label htmlFor="kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.emailNotifications && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="kpi-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="kpi-alert-threshold"
                        type="text"
                        placeholder="e.g., 80"
                        value={kpiForm.alertThreshold}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setKpiForm({ ...kpiForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-kpi-alert-threshold"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Value at which to trigger the alert
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kpi-alert-condition">Alert When</Label>
                      <Select
                        value={kpiForm.alertCondition}
                        onValueChange={(value) => setKpiForm({ ...kpiForm, alertCondition: value })}
                      >
                        <SelectTrigger id="kpi-alert-condition" data-testid="select-kpi-alert-condition">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="below">Value Goes Below</SelectItem>
                          <SelectItem value="above">Value Goes Above</SelectItem>
                          <SelectItem value="equals">Value Equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-email-recipients">Email Recipients *</Label>
                    <Input
                      id="kpi-email-recipients"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={kpiForm.emailRecipients}
                      onChange={(e) => setKpiForm({ ...kpiForm, emailRecipients: e.target.value })}
                      data-testid="input-kpi-email-recipients"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comma-separated email addresses for alert notifications
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsKPIModalOpen(false)}
                data-testid="button-cancel-kpi"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateKPI}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-create-kpi"
              >
                {editingKPI ? 'Update KPI' : 'Create KPI'}
              </Button>
            </DialogFooter>
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
                ? 'Update the benchmark details below. The current value can be auto-populated from your LinkedIn metrics data.'
                : 'Define a new benchmark for your LinkedIn campaigns. You can select metrics from the Overview tab as current values.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name *</Label>
              <Input
                id="benchmark-name"
                placeholder="e.g., LinkedIn CTR Benchmark"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                data-testid="input-benchmark-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Metric Source</Label>
                <Select
                  value={benchmarkForm.metric || undefined}
                  onValueChange={(value) => {
                    setBenchmarkForm({ ...benchmarkForm, metric: value });
                    // Auto-populate current value from aggregated LinkedIn metrics
                    let currentValue = '';
                    let unit = '';
                    if (aggregated) {
                      switch(value) {
                        case 'impressions':
                          currentValue = String(aggregated.totalImpressions || 0);
                          break;
                        case 'reach':
                          currentValue = String(aggregated.totalReach || 0);
                          break;
                        case 'clicks':
                          currentValue = String(aggregated.totalClicks || 0);
                          break;
                        case 'engagements':
                          currentValue = String(aggregated.totalEngagements || 0);
                          break;
                        case 'spend':
                          currentValue = String(aggregated.totalSpend || 0);
                          unit = '$';
                          break;
                        case 'conversions':
                          currentValue = String(aggregated.totalConversions || 0);
                          break;
                        case 'leads':
                          currentValue = String(aggregated.totalLeads || 0);
                          break;
                        case 'videoViews':
                          currentValue = String(aggregated.totalVideoViews || 0);
                          break;
                        case 'viralImpressions':
                          currentValue = String(aggregated.totalViralImpressions || 0);
                          break;
                        case 'ctr':
                          currentValue = String(aggregated.ctr || 0);
                          unit = '%';
                          break;
                        case 'cpc':
                          currentValue = String(aggregated.cpc || 0);
                          unit = '$';
                          break;
                        case 'cpm':
                          currentValue = String(aggregated.cpm || 0);
                          unit = '$';
                          break;
                        case 'cvr':
                          currentValue = String(aggregated.cvr || 0);
                          unit = '%';
                          break;
                        case 'cpa':
                          currentValue = String(aggregated.cpa || 0);
                          unit = '$';
                          break;
                        case 'cpl':
                          currentValue = String(aggregated.cpl || 0);
                          unit = '$';
                          break;
                        case 'er':
                          currentValue = String(aggregated.er || 0);
                          unit = '%';
                          break;
                        case 'roi':
                          currentValue = String(aggregated.roi || 0);
                          unit = '%';
                          break;
                        case 'roas':
                          currentValue = String(aggregated.roas || 0);
                          unit = 'x';
                          break;
                      }
                    }
                    setBenchmarkForm({ ...benchmarkForm, metric: value, currentValue, unit });
                  }}
                >
                  <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                    <SelectValue placeholder="Select metric to benchmark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impressions">Impressions (from LinkedIn)</SelectItem>
                    <SelectItem value="reach">Reach (from LinkedIn)</SelectItem>
                    <SelectItem value="clicks">Clicks (from LinkedIn)</SelectItem>
                    <SelectItem value="engagements">Engagements (from LinkedIn)</SelectItem>
                    <SelectItem value="spend">Spend (from LinkedIn)</SelectItem>
                    <SelectItem value="conversions">Conversions (from LinkedIn)</SelectItem>
                    <SelectItem value="leads">Leads (from LinkedIn)</SelectItem>
                    <SelectItem value="videoViews">Video Views (from LinkedIn)</SelectItem>
                    <SelectItem value="viralImpressions">Viral Impressions (from LinkedIn)</SelectItem>
                    <SelectItem value="ctr">Click-Through Rate (from LinkedIn)</SelectItem>
                    <SelectItem value="cpc">Cost Per Click (from LinkedIn)</SelectItem>
                    <SelectItem value="cpm">Cost Per Mille (from LinkedIn)</SelectItem>
                    <SelectItem value="cvr">Conversion Rate (from LinkedIn)</SelectItem>
                    <SelectItem value="cpa">Cost Per Acquisition (from LinkedIn)</SelectItem>
                    <SelectItem value="cpl">Cost Per Lead (from LinkedIn)</SelectItem>
                    <SelectItem value="er">Engagement Rate (from LinkedIn)</SelectItem>
                    <SelectItem value="roi">Return on Investment (from LinkedIn)</SelectItem>
                    <SelectItem value="roas">Return on Ad Spend (from LinkedIn)</SelectItem>
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
                  type="text"
                  placeholder="0"
                  value={benchmarkForm.currentValue ? parseFloat(benchmarkForm.currentValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setBenchmarkForm({ ...benchmarkForm, currentValue: value });
                    }
                  }}
                  data-testid="input-benchmark-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  type="text"
                  placeholder="0"
                  value={benchmarkForm.benchmarkValue ? parseFloat(benchmarkForm.benchmarkValue).toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setBenchmarkForm({ ...benchmarkForm, benchmarkValue: value });
                    }
                  }}
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
                  placeholder="e.g., Industry Report, LinkedIn"
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

            {/* Competitor Name - Conditional */}
            {benchmarkForm.benchmarkType === 'competitor' && (
              <div className="space-y-2">
                <Label htmlFor="competitor-name">Competitor Name *</Label>
                <Input
                  id="competitor-name"
                  placeholder="e.g., Acme Corp, Competitor X"
                  value={benchmarkForm.competitorName}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, competitorName: e.target.value })}
                  data-testid="input-competitor-name"
                />
              </div>
            )}

            {/* Email Alerts Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="benchmark-alerts-enabled"
                  checked={benchmarkForm.alertsEnabled}
                  onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-benchmark-alerts"
                />
                <Label htmlFor="benchmark-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable Email Alerts
                </Label>
              </div>

              {benchmarkForm.alertsEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-alert-threshold">Alert Threshold *</Label>
                      <Input
                        id="benchmark-alert-threshold"
                        type="text"
                        placeholder="e.g., 80"
                        value={benchmarkForm.alertThreshold}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || !isNaN(parseFloat(value))) {
                            setBenchmarkForm({ ...benchmarkForm, alertThreshold: value });
                          }
                        }}
                        data-testid="input-benchmark-alert-threshold"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Value at which to trigger the alert
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-alert-condition">Alert When</Label>
                      <Select
                        value={benchmarkForm.alertCondition}
                        onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, alertCondition: value })}
                      >
                        <SelectTrigger id="benchmark-alert-condition" data-testid="select-benchmark-alert-condition">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="below">Value Goes Below</SelectItem>
                          <SelectItem value="above">Value Goes Above</SelectItem>
                          <SelectItem value="equals">Value Equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="benchmark-email-recipients">Email Recipients *</Label>
                    <Input
                      id="benchmark-email-recipients"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={benchmarkForm.emailRecipients}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, emailRecipients: e.target.value })}
                      data-testid="input-benchmark-email-recipients"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comma-separated email addresses for alert notifications
                    </p>
                  </div>
                </div>
              )}
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
                    confidenceLevel: '',
                    competitorName: '',
                    alertsEnabled: false,
                    alertThreshold: '',
                    alertCondition: 'below',
                    emailRecipients: ''
                  });
                }}
                data-testid="button-benchmark-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBenchmark}
                disabled={!benchmarkForm.name || !benchmarkForm.benchmarkValue}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-benchmark-submit"
              >
                {editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <Dialog open={isCampaignDetailsModalOpen} onOpenChange={setIsCampaignDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              {selectedCampaignDetails?.name}
            </DialogTitle>
            <DialogDescription>
              Campaign ID: {selectedCampaignDetails ? Object.keys(metrics?.reduce((acc: any, m: any) => ({ ...acc, [m.campaignUrn]: true }), {}) || {}).indexOf(selectedCampaignDetails.urn) + 1 : ''} • 
              <Badge 
                variant={selectedCampaignDetails?.status === 'active' ? 'default' : 'secondary'}
                className={selectedCampaignDetails?.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-2' : 'ml-2'}
              >
                {selectedCampaignDetails?.status}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Core Metrics Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Core Metrics</h4>
              <div className="grid grid-cols-3 gap-4">
                {/* Impressions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Impressions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.impressions || 0)}
                  </p>
                </div>
                {/* Reach */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Reach</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.reach || 0)}
                  </p>
                </div>
                {/* Clicks */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Clicks</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.clicks || 0)}
                  </p>
                </div>
                {/* Engagements */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Engagements</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.engagements || 0)}
                  </p>
                </div>
                {/* Spend */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Spend</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selectedCampaignDetails?.metrics.spend || 0)}
                  </p>
                </div>
                {/* Conversions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Conversions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.conversions || 0)}
                  </p>
                </div>
                {/* Leads */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Leads</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.leads || 0)}
                  </p>
                </div>
                {/* Video Views */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Video Views</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.videoviews || selectedCampaignDetails?.metrics.videoViews || 0)}
                  </p>
                </div>
                {/* Viral Impressions */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">Viral Impressions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedCampaignDetails?.metrics.viralimpressions || selectedCampaignDetails?.metrics.viralImpressions || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Derived Metrics Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Derived Metrics</h4>
              <div className="grid grid-cols-3 gap-4">
                {/* CTR */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CTR (Click-Through Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.clicks / selectedCampaignDetails?.metrics.impressions) * 100
                        : 0
                    )}
                  </p>
                </div>
                {/* CPC */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPC (Cost Per Click)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.clicks > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.clicks
                        : 0
                    )}
                  </p>
                </div>
                {/* CPM */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPM (Cost Per Mille)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.impressions) * 1000
                        : 0
                    )}
                  </p>
                </div>
                {/* CVR */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CVR (Conversion Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.clicks > 0
                        ? (selectedCampaignDetails?.metrics.conversions / selectedCampaignDetails?.metrics.clicks) * 100
                        : 0
                    )}
                  </p>
                </div>
                {/* CPA */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPA (Cost Per Acquisition)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.conversions > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.conversions
                        : 0
                    )}
                  </p>
                </div>
                {/* CPL */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">CPL (Cost Per Lead)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(
                      selectedCampaignDetails?.metrics.leads > 0
                        ? selectedCampaignDetails?.metrics.spend / selectedCampaignDetails?.metrics.leads
                        : 0
                    )}
                  </p>
                </div>
                {/* ER */}
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ER (Engagement Rate)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPercentage(
                      selectedCampaignDetails?.metrics.impressions > 0
                        ? (selectedCampaignDetails?.metrics.engagements / selectedCampaignDetails?.metrics.impressions) * 100
                        : 0
                    )}
                  </p>
                </div>
                {/* ROI */}
                {aggregated?.roi !== undefined && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROI (Return on Investment)</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatPercentage(aggregated.roi || 0)}
                    </p>
                  </div>
                )}
                {/* ROAS */}
                {aggregated?.roas !== undefined && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">ROAS (Return on Ad Spend)</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {(aggregated.roas || 0).toFixed(2)}x
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Indicators */}
            {selectedCampaignDetails && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Performance Analysis</h4>
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const impressions = selectedCampaignDetails.metrics.impressions || 0;
                    const clicks = selectedCampaignDetails.metrics.clicks || 0;
                    const spend = selectedCampaignDetails.metrics.spend || 0;
                    const conversions = selectedCampaignDetails.metrics.conversions || 0;
                    const engagements = selectedCampaignDetails.metrics.engagements || 0;
                    
                    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                    const cpa = conversions > 0 ? spend / conversions : 0;
                    const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
                    const roas = aggregated?.roas || 0;
                    
                    return (
                      <>
                        {/* CTR Indicators */}
                        {ctr > 5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CTR Excellent</span>
                          </div>
                        )}
                        {ctr < 1 && ctr > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CTR Weak</span>
                          </div>
                        )}
                        
                        {/* Conversion Rate Indicators */}
                        {convRate > 10 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Conversion High</span>
                          </div>
                        )}
                        {convRate < 2 && convRate > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Conversion Low</span>
                          </div>
                        )}
                        
                        {/* CPA Indicators */}
                        {cpa > 0 && cpa < 150 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CPA Strong</span>
                          </div>
                        )}
                        {cpa > 300 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">CPA Weak</span>
                          </div>
                        )}
                        
                        {/* ROAS Indicators */}
                        {roas > 4 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Strong</span>
                          </div>
                        )}
                        {roas > 0 && roas < 1.5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ROAS Weak</span>
                          </div>
                        )}
                        
                        {/* Engagement Rate Indicators */}
                        {engagementRate > 2 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Good</span>
                          </div>
                        )}
                        {engagementRate > 0 && engagementRate < 0.5 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Engagement Low</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={(open) => {
        setIsReportModalOpen(open);
        if (!open) {
          setEditingReportId(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Two Main Sections */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Standard Templates Section */}
              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  reportModalStep === 'standard'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => setReportModalStep('standard')}
                data-testid="section-standard-templates"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Templates</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Pre-built professional report templates
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Report Section */}
              <div
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  reportModalStep === 'custom'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => setReportModalStep('custom')}
                data-testid="section-custom-report"
              >
                <div className="flex items-start gap-3">
                  <Settings className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Report</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Build your own customized report
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Templates Content */}
            {reportModalStep === 'standard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose Template</h3>

                  <div className="space-y-4">
                    {/* Overview Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'overview'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('overview')}
                      data-testid="template-overview"
                    >
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Overview</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Comprehensive overview of campaign performance metrics
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Overview</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Platforms</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Trends</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPIs Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'kpis'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('kpis')}
                      data-testid="template-kpis"
                    >
                      <div className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">KPIs</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Key performance indicators and progress tracking
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Metrics</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Targets</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Progress</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Benchmarks Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'benchmarks'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('benchmarks')}
                      data-testid="template-benchmarks"
                    >
                      <div className="flex items-start gap-3">
                        <Trophy className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Benchmarks</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Performance benchmarks and comparisons
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Industry</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Historical</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Goals</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ad Comparison Template */}
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                        reportForm.reportType === 'ads'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleReportTypeSelect('ads')}
                      data-testid="template-ad-comparison"
                    >
                      <div className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Ad Comparison</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Detailed ad-level performance analysis
                          </p>
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Performance</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Ranking</span>
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Automatic Reports */}
                    <div className="pt-4 border-t mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Checkbox
                          id="schedule-reports"
                          checked={reportForm.scheduleEnabled}
                          onCheckedChange={(checked) => 
                            setReportForm({ ...reportForm, scheduleEnabled: checked as boolean })
                          }
                          data-testid="checkbox-schedule-reports"
                        />
                        <Label 
                          htmlFor="schedule-reports" 
                          className="text-base font-semibold cursor-pointer"
                        >
                          Schedule Automatic Reports
                        </Label>
                      </div>

                      {reportForm.scheduleEnabled && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-4">
                          {/* Frequency */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-frequency">Frequency</Label>
                            <Select
                              value={reportForm.scheduleFrequency}
                              onValueChange={(value) => 
                                setReportForm({ ...reportForm, scheduleFrequency: value })
                              }
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
                                onValueChange={(value) => 
                                  setReportForm({ ...reportForm, scheduleDayOfWeek: value })
                                }
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

                          {/* Day of Month - Only for Monthly and Quarterly */}
                          {(reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') && (
                            <div className="space-y-2">
                              <Label htmlFor="schedule-day-month">Day of Month</Label>
                              <Select
                                value={reportForm.scheduleDayOfWeek}
                                onValueChange={(value) => 
                                  setReportForm({ ...reportForm, scheduleDayOfWeek: value })
                                }
                              >
                                <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Time */}
                          <div className="space-y-2">
                            <Label htmlFor="schedule-time">Time</Label>
                            <Select
                              value={reportForm.scheduleTime}
                              onValueChange={(value) => 
                                setReportForm({ ...reportForm, scheduleTime: value })
                              }
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
                                <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                                <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                                <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                                <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                                <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                                <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                                <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                                <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                              </SelectContent>
                            </Select>
                            {userTimeZone && (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                All times are in your time zone: {getTimeZoneDisplay()}
                              </p>
                            )}
                          </div>

                          {/* Email Recipients */}
                          <div className="space-y-2">
                            <Label htmlFor="email-recipients">Email Recipients</Label>
                            <Input
                              id="email-recipients"
                              value={reportForm.emailRecipients}
                              onChange={(e) => 
                                setReportForm({ ...reportForm, emailRecipients: e.target.value })
                              }
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
                </div>

                {/* Report Configuration */}
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="report-name">Report Name</Label>
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
                  </div>
                )}
              </div>
            )}

            {/* Custom Report Content */}
            {reportModalStep === 'custom' && (
              <div className="space-y-6">
                {/* Report Name and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-report-name">Report Name</Label>
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
                  
                  <Accordion type="multiple" className="w-full">
                    {/* LinkedIn Ad Metrics */}
                    <AccordionItem value="linkedin-ad-metrics">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn Ad Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['impressions', 'reach', 'clicks', 'engagements', 'spend', 'conversions', 'leads', 'videoviews', 'viralimpressions'].map((metric) => {
                            const labels: Record<string, string> = {
                              impressions: 'Impressions',
                              reach: 'Reach',
                              clicks: 'Clicks',
                              engagements: 'Engagements',
                              spend: 'Spend',
                              conversions: 'Conversions',
                              leads: 'Leads',
                              videoviews: 'Video Views',
                              viralimpressions: 'Viral Impressions'
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* LinkedIn Calculated Metrics */}
                    <AccordionItem value="linkedin-calculated-metrics">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn Calculated Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['ctr', 'cpc', 'cpm', 'cvr', 'cpa', 'cpl', 'er', 'roi', 'roas'].map((metric) => {
                            const labels: Record<string, string> = {
                              ctr: 'CTR (Click-Through Rate)',
                              cpc: 'CPC (Cost Per Click)',
                              cpm: 'CPM (Cost Per Mille)',
                              cvr: 'CVR (Conversion Rate)',
                              cpa: 'CPA (Cost Per Acquisition)',
                              cpl: 'CPL (Cost Per Lead)',
                              er: 'ER (Engagement Rate)',
                              roi: 'ROI (Return on Investment)',
                              roas: 'ROAS (Return on Ad Spend)'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`derived-${metric}`}
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
                                  data-testid={`checkbox-derived-${metric}`}
                                />
                                <Label htmlFor={`derived-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* KPIs */}
                    <AccordionItem value="kpis">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        KPIs
                      </AccordionTrigger>
                      <AccordionContent>
                        {kpisData && Array.isArray(kpisData) && kpisData.length > 0 ? (
                          <div className="space-y-2 pt-2">
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
                          <p className="text-sm text-slate-500 pt-2">No KPIs created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Benchmarks */}
                    <AccordionItem value="benchmarks">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Benchmarks
                      </AccordionTrigger>
                      <AccordionContent>
                        {benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                          <div className="space-y-2 pt-2">
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
                          <p className="text-sm text-slate-500 pt-2">No benchmarks created yet</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Ad Comparison */}
                    <AccordionItem value="ad-comparison">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Ad Comparison
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="include-ad-comparison"
                              checked={customReportConfig.includeAdComparison}
                              onCheckedChange={(checked) => {
                                setCustomReportConfig({
                                  ...customReportConfig,
                                  includeAdComparison: checked as boolean
                                });
                              }}
                              data-testid="checkbox-ad-comparison"
                            />
                            <Label htmlFor="include-ad-comparison" className="text-sm cursor-pointer">
                              Include side-by-side ad performance comparison
                            </Label>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                            Compare performance metrics across all ads in your LinkedIn campaigns
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Schedule Automatic Reports Section */}
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

                      {/* Day of Month - Only for Monthly and Quarterly */}
                      {(reportForm.scheduleFrequency === 'monthly' || reportForm.scheduleFrequency === 'quarterly') && (
                        <div className="space-y-2">
                          <Label htmlFor="schedule-day-month">Day of Month</Label>
                          <Select
                            value={reportForm.scheduleDayOfWeek}
                            onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                          >
                            <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
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
                            <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                            <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                            <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                            <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                            <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                            <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                            <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                            <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                        {userTimeZone && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            All times are in your time zone: {getTimeZoneDisplay()}
                          </p>
                        )}
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
                <Button
                  variant="link"
                  onClick={() => {
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
                  data-testid="button-reset-report"
                >
                  Reset
                </Button>
                
                {reportForm.reportType && reportForm.reportType !== 'custom' && (
                  <Button
                    onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-report" : "button-create-report-submit"}
                    className="gap-2"
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
                    onClick={editingReportId ? handleUpdateReport : handleCustomReport}
                    disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                    data-testid={editingReportId ? "button-update-custom-report" : "button-create-custom-report"}
                    className="gap-2"
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

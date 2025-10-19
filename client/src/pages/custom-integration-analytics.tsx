import { useState, useEffect } from "react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatTimeAgo } from "@/lib/utils";

// Helper function to calculate expected progress based on timeframe
function calculateExpectedProgress(timeframe: string): number {
  const now = new Date();
  
  switch(timeframe) {
    case 'daily': {
      // Calculate progress through the current day (0-100%)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return ((hours * 60 + minutes) / (24 * 60)) * 100;
    }
    case 'weekly': {
      // Calculate progress through the current week (0-100%)
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const hours = now.getHours();
      return ((dayOfWeek * 24 + hours) / (7 * 24)) * 100;
    }
    case 'monthly': {
      // Calculate progress through the current month (0-100%)
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return (dayOfMonth / daysInMonth) * 100;
    }
    case 'quarterly': {
      // Calculate progress through the current quarter (0-100%)
      const month = now.getMonth(); // 0-11
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const daysSinceQuarterStart = Math.floor((now.getTime() - new Date(now.getFullYear(), quarterStartMonth, 1).getTime()) / (1000 * 60 * 60 * 24));
      return (daysSinceQuarterStart / 90) * 100;
    }
    case 'yearly': {
      // Calculate progress through the current year (0-100%)
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const daysSinceYearStart = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const isLeapYear = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || (now.getFullYear() % 400 === 0);
      const daysInYear = isLeapYear ? 366 : 365;
      return (daysSinceYearStart / daysInYear) * 100;
    }
    default:
      return 100; // Default to 100% if timeframe is unknown
  }
}

export default function CustomIntegrationAnalytics() {
  const [matchCampaignRoute, campaignParams] = useRoute("/campaigns/:id/custom-integration-analytics");
  const [matchIntegrationRoute, integrationParams] = useRoute("/integrations/:id/analytics");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Determine if we're on the campaign route or integration route
  const integrationId = integrationParams?.id;
  
  // Fetch integration data to get the campaign_id when accessed via integration route
  const { data: integrationData, isLoading: integrationLoading } = useQuery({
    queryKey: ["/api/custom-integration-by-id", integrationId],
    queryFn: async () => {
      console.log('[Integration Query] Fetching integration ID:', integrationId);
      const res = await fetch(`/api/custom-integration-by-id/${integrationId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('[Integration Query] Failed:', res.status, res.statusText);
        throw new Error('Failed to fetch integration');
      }
      const data = await res.json();
      console.log('[Integration Query] Fetched integration data:', data);
      return data;
    },
    enabled: !!integrationId,
    staleTime: 0,
  });
  
  // Get campaign ID from either route
  // For campaign route, use ID directly. For integration route, use campaign_id from integration data
  const campaignId = matchCampaignRoute ? campaignParams?.id : integrationData?.campaign_id;
  
  console.log('[Route Debug] matchCampaignRoute:', matchCampaignRoute);
  console.log('[Route Debug] matchIntegrationRoute:', matchIntegrationRoute);
  console.log('[Route Debug] campaignParams:', campaignParams);
  console.log('[Route Debug] integrationParams:', integrationParams);
  console.log('[Route Debug] integrationId:', integrationId);
  console.log('[Route Debug] integrationData:', integrationData);
  console.log('[Route Debug] integrationLoading:', integrationLoading);
  console.log('[Route Debug] campaignId:', campaignId);

  // KPI state management
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    category: 'performance',
    metric: '',
    targetValue: '',
    currentValue: '',
    unit: '',
    priority: 'medium',
    timeframe: 'monthly',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
  });

  // Benchmark state management
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    category: 'performance',
    benchmarkType: '',
    competitorName: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    industry: '',
    description: '',
    source: '',
    geographicLocation: '',
    period: 'monthly',
    confidenceLevel: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below',
    emailRecipients: ''
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
  
  // Detect user's time zone
  const [userTimeZone, setUserTimeZone] = useState('');
  
  useEffect(() => {
    // Detect time zone from browser
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimeZone(detectedTimeZone);
  }, []);

  // Sync kpiForm when editingKPI changes
  useEffect(() => {
    if (editingKPI) {
      const formData = {
        name: editingKPI.name,
        description: editingKPI.description || '',
        category: editingKPI.category || 'performance',
        metric: editingKPI.metric || '',
        targetValue: editingKPI.targetValue || '',
        currentValue: editingKPI.currentValue || '',
        unit: editingKPI.unit || '',
        priority: editingKPI.priority || 'medium',
        timeframe: editingKPI.timeframe || 'monthly',
        alertsEnabled: editingKPI.alertsEnabled || false,
        alertThreshold: editingKPI.alertThreshold || '',
        alertCondition: editingKPI.alertCondition || 'below',
        emailRecipients: editingKPI.emailRecipients || ''
      };
      
      setKpiForm(formData);
      
      // Open modal if not already open
      if (!isKPIModalOpen) {
        setTimeout(() => setIsKPIModalOpen(true), 0);
      }
    }
  }, [editingKPI]);

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

  // Fetch platform-level KPIs for custom integration filtered by campaignId
  const kpiQueryKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: [kpiQueryKey],
    enabled: !!kpiQueryKey,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Fetch platform-level Benchmarks for custom integration filtered by campaignId
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId],
    queryFn: async () => {
      const url = `/api/platforms/custom-integration/benchmarks?campaignId=${campaignId}`;
      console.log('[Benchmarks Query] Fetching with URL:', url);
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch benchmarks');
      const data = await res.json();
      console.log('[Benchmarks Query] Response data:', data);
      return data;
    },
    enabled: !!campaignId,
  });

  // Use real metrics if available, otherwise show placeholder
  const metrics = metricsData || {};

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (kpiData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/kpis', kpiData);
      return res.json();
    },
    onSuccess: (data: any) => {
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      }
      
      // DEBUGGING: Show debug info
      if (data.__debug) {
        console.log('[KPI Created] Debug Info:', data.__debug);
        toast({
          title: "KPI Created - DEBUG",
          description: `Received: ${data.__debug.receivedCampaignId} (${data.__debug.receivedCampaignIdType}), Saved: ${data.__debug.savedCampaignId}`,
        });
      } else {
        toast({
          title: "KPI Created",
          description: "Your KPI has been successfully created.",
        });
      }
      
      setIsKPIModalOpen(false);
      setKpiForm({
        name: '',
        description: '',
        category: 'performance',
        metric: '',
        targetValue: '',
        currentValue: '',
        unit: '',
        priority: 'medium',
        timeframe: 'monthly',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
  });

  // Update KPI mutation
  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log('=== UPDATE KPI MUTATION ===');
      console.log('KPI ID:', id);
      console.log('Data to send:', data);
      const res = await apiRequest('PATCH', `/api/platforms/custom-integration/kpis/${id}`, data);
      console.log('Response status:', res.status);
      const result = await res.json();
      console.log('Response data:', result);
      return result;
    },
    onSuccess: async () => {
      console.log('KPI update successful! Invalidating cache and refetching...');
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        // Remove from cache and force refetch
        await queryClient.invalidateQueries({ 
          queryKey: [invalidateKey],
          refetchType: 'all' 
        });
        await queryClient.refetchQueries({ 
          queryKey: [invalidateKey]
        });
      }
      console.log('Cache invalidated and refetch complete');
      toast({
        title: "KPI Updated",
        description: "Your KPI has been successfully updated.",
      });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      setKpiForm({
        name: '',
        description: '',
        category: 'performance',
        metric: '',
        targetValue: '',
        currentValue: '',
        unit: '',
        priority: 'medium',
        timeframe: 'monthly',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
      });
    },
    onError: (error: any) => {
      console.error('=== KPI UPDATE ERROR ===');
      console.error('Error:', error);
      toast({
        title: "Error Updating KPI",
        description: error?.message || "Failed to update KPI. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/custom-integration/kpis/${id}`);
      return res.json();
    },
    onSuccess: () => {
      const invalidateKey = campaignId ? `/api/platforms/custom-integration/kpis?campaignId=${campaignId}` : null;
      if (invalidateKey) {
        queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      }
      toast({
        title: "KPI Deleted",
        description: "The KPI has been successfully deleted.",
      });
    },
  });

  // Handle KPI form submission
  const handleKPISubmit = () => {
    console.log('[KPI Submit] campaignId value:', campaignId);
    console.log('[KPI Submit] integrationData:', integrationData);
    console.log('[KPI Submit] matchCampaignRoute:', matchCampaignRoute);
    console.log('[KPI Submit] matchIntegrationRoute:', matchIntegrationRoute);
    console.log('[KPI Submit] kpiForm:', kpiForm);
    
    if (!campaignId) {
      toast({
        title: "Error",
        description: "Campaign ID not available. Please wait for the page to fully load.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingKPI) {
      const updateData = {
        id: editingKPI.id,
        data: {
          ...kpiForm,
          platformType: 'custom-integration',
          campaignId: campaignId,
        }
      };
      console.log('[KPI Submit] Update data:', updateData);
      updateKpiMutation.mutate(updateData);
    } else {
      const createData = {
        ...kpiForm,
        platformType: 'custom-integration',
        campaignId: campaignId,
      };
      console.log('[KPI Submit] Create data:', createData);
      createKpiMutation.mutate(createData);
    }
  };

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (benchmarkData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/benchmarks', benchmarkData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
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
        competitorName: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
      toast({
        title: "Benchmark Updated",
        description: "Your benchmark has been successfully updated.",
      });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      setBenchmarkForm({
        metric: '',
        name: '',
        category: 'performance',
        benchmarkType: '',
        competitorName: '',
        unit: '',
        benchmarkValue: '',
        currentValue: '',
        industry: '',
        description: '',
        source: '',
        geographicLocation: '',
        period: 'monthly',
        confidenceLevel: '',
        alertsEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        emailRecipients: ''
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/benchmarks', campaignId] });
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
          campaignId: campaignId,
        }
      });
    } else {
      createBenchmarkMutation.mutate({
        ...benchmarkForm,
        platformType: 'custom-integration',
        campaignId: campaignId,
      });
    }
  };

  // Fetch platform-level Reports for custom integration filtered by campaignId
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/platforms/custom-integration/reports', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/platforms/custom-integration/reports?campaignId=${campaignId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Create Report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const res = await apiRequest('POST', '/api/platforms/custom-integration/reports', reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/custom-integration/reports', campaignId] });
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

  // PDF Helper Functions
  const addPDFHeader = (doc: any, title: string, subtitle: string) => {
    // Custom Integration brand color header (purple/blue gradient)
    doc.setFillColor(99, 102, 241); // Indigo-500
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
    
    // Date
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Generated: ${dateStr}`, 20, 50);
  };

  const addPDFSection = (doc: any, title: string, y: number, color: number[] = [99, 102, 241]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, 20, y + 7);
    // Reset text color to black for content
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    return y + 15;
  };

  // Handle Report form submission
  const handleGenerateReport = async (overrideReport?: any) => {
    const reportName = overrideReport?.name || reportForm.name || 'Custom Integration Report';
    const reportType = overrideReport?.reportType || reportForm.reportType || 'overview';
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Add header
    addPDFHeader(doc, reportName, 'Custom Integration Analytics');
    
    let y = 70;
    
    // Handle different report types
    if (reportType === 'benchmarks') {
      // Benchmarks Report
      const benchmarks = benchmarksData as any[] || [];
      
      if (benchmarks.length === 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No benchmarks data available', 20, y);
      } else {
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        
        y = addPDFSection(doc, 'Industry Benchmarks', y, [168, 85, 247]);
        
        benchmarks.forEach((benchmark: any, index: number) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFont(undefined, 'bold');
          doc.setFontSize(12);
          doc.text(benchmark.name || benchmark.metric, 20, y);
          y += 6;
          
          doc.setFont(undefined, 'normal');
          doc.setFontSize(10);
          
          // Description
          if (benchmark.description) {
            const lines = doc.splitTextToSize(benchmark.description, 160);
            doc.setTextColor(100, 100, 100);
            lines.forEach((line: string) => {
              doc.text(line, 25, y);
              y += 5;
            });
            doc.setTextColor(50, 50, 50);
            y += 2;
          }
          
          // Metadata (industry, period, category)
          const metadata: string[] = [];
          if (benchmark.industry) metadata.push(benchmark.industry);
          if (benchmark.period) metadata.push(benchmark.period);
          if (benchmark.category) metadata.push(benchmark.category);
          if (metadata.length > 0) {
            doc.setTextColor(120, 120, 120);
            doc.text(metadata.join(' • '), 25, y);
            doc.setTextColor(50, 50, 50);
            y += 6;
          }
          
          // Performance Values
          if (benchmark.currentValue) {
            doc.setFont(undefined, 'bold');
            doc.text('Your Performance:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${benchmark.currentValue}${benchmark.unit || ''}`, 80, y);
            y += 5;
          }
          
          if (benchmark.benchmarkValue) {
            doc.setFont(undefined, 'bold');
            doc.text('Benchmark Value:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${benchmark.benchmarkValue}${benchmark.unit || ''}`, 80, y);
            y += 5;
          }
          
          // Source - always show with fallback
          doc.setFont(undefined, 'bold');
          doc.text('Source:', 25, y);
          doc.setFont(undefined, 'normal');
          doc.text(benchmark.source || 'Custom Integration', 80, y);
          y += 5;
          
          // Performance vs Benchmark comparison
          if (benchmark.currentValue && benchmark.benchmarkValue) {
            const current = parseFloat(benchmark.currentValue);
            const benchmarkVal = parseFloat(benchmark.benchmarkValue);
            const diff = current - benchmarkVal;
            const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
            const isAbove = current >= benchmarkVal;
            
            doc.setFont(undefined, 'bold');
            doc.text('Performance vs Benchmark:', 25, y);
            doc.setFont(undefined, 'normal');
            
            if (isAbove) {
              doc.setTextColor(22, 163, 74); // Green
              doc.text(`${percentDiff.toFixed(2)}% Above - Outperforming!`, 80, y);
            } else {
              doc.setTextColor(220, 38, 38); // Red
              doc.text(`${Math.abs(percentDiff).toFixed(2)}% Below - Needs improvement`, 80, y);
            }
            doc.setTextColor(50, 50, 50); // Reset to dark
            y += 5;
          }
          
          if (benchmark.benchmarkType) {
            doc.setFont(undefined, 'bold');
            doc.text('Type:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(benchmark.benchmarkType, 80, y);
            y += 5;
          }
          
          if (benchmark.geoLocation || benchmark.geographicLocation) {
            doc.setFont(undefined, 'bold');
            doc.text('Location:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(benchmark.geoLocation || benchmark.geographicLocation, 80, y);
            y += 5;
          }
          
          if (benchmark.confidenceLevel) {
            doc.setFont(undefined, 'bold');
            doc.text('Confidence:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(benchmark.confidenceLevel, 80, y);
            y += 5;
          }
          
          doc.setFontSize(11);
          y += 10;
        });
      }
    } else if (reportType === 'custom') {
      // Custom Report - filter based on customReportConfig or override configuration
      const config = overrideReport?.configuration || customReportConfig;
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      // Core Metrics (Audience & Traffic)
      const hasSelectedCoreMetrics = config.coreMetrics && config.coreMetrics.length > 0;
      if (hasSelectedCoreMetrics && metrics) {
        y = addPDFSection(doc, 'Selected Metrics', y, [59, 130, 246]);
        
        config.coreMetrics.forEach((metric: string) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          const metricLabels: Record<string, string> = {
            users: 'Users (unique)',
            sessions: 'Sessions',
            pageviews: 'Pageviews',
            avgSessionDuration: 'Avg. Session Duration',
            pagesPerSession: 'Pages / Session',
            bounceRate: 'Bounce Rate'
          };
          
          if (metrics[metric]) {
            doc.setFont(undefined, 'bold');
            doc.text(metricLabels[metric] + ':', 20, y);
            doc.setFont(undefined, 'normal');
            if (metric === 'avgSessionDuration') {
              doc.text(String(metrics[metric]), 120, y);
            } else if (metric === 'pagesPerSession') {
              const value = typeof metrics[metric] === 'string' ? parseFloat(metrics[metric]).toFixed(2) : metrics[metric].toFixed(2);
              doc.text(value, 120, y);
            } else if (metric === 'bounceRate') {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else {
              doc.text(formatNumber(metrics[metric]), 120, y);
            }
            y += 8;
          }
        });
        y += 5;
      }
      
      // Derived Metrics (Traffic Sources, Email, Social)
      const hasSelectedDerivedMetrics = config.derivedMetrics && config.derivedMetrics.length > 0;
      if (hasSelectedDerivedMetrics && metrics) {
        config.derivedMetrics.forEach((metric: string) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          
          const metricLabels: Record<string, string> = {
            organicSearchShare: 'Organic Search',
            directBrandedShare: 'Direct/Branded',
            emailShare: 'Email (Newsletters)',
            referralShare: 'Referral/Partners',
            paidShare: 'Paid (Display/Search)',
            socialShare: 'Social',
            emailsDelivered: 'Emails Delivered',
            openRate: 'Open Rate',
            clickThroughRate: 'Click-Through Rate',
            clickToOpen: 'Click-to-Open',
            hardBounces: 'Hard Bounces',
            spamComplaints: 'Spam Complaints',
            listGrowth: 'List Growth',
            impressions: 'Impressions',
            reach: 'Reach',
            clicks: 'Clicks',
            engagements: 'Engagements',
            spend: 'Spend',
            conversions: 'Conversions',
            leads: 'Leads',
            videoViews: 'Video Views',
            viralImpressions: 'Viral Impressions'
          };
          
          if (metrics[metric] !== undefined && metrics[metric] !== null) {
            doc.setFont(undefined, 'bold');
            doc.text(metricLabels[metric] + ':', 20, y);
            doc.setFont(undefined, 'normal');
            
            // Format based on metric type
            if (metric.includes('Share')) {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else if (metric.includes('Rate') || metric.includes('Open') || metric.includes('clickToOpen')) {
              doc.text(formatPercent(metrics[metric]), 120, y);
            } else if (metric === 'spend') {
              const spendValue = typeof metrics[metric] === 'string' ? parseFloat(metrics[metric]) : metrics[metric];
              doc.text('$' + formatNumber(spendValue), 120, y);
            } else {
              doc.text(formatNumber(metrics[metric]), 120, y);
            }
            y += 8;
          }
        });
        y += 5;
      }
      
      // Selected KPIs
      if (config.kpis && config.kpis.length > 0 && kpisData) {
        const selectedKPIs = (kpisData as any[]).filter(kpi => config.kpis.includes(kpi.id));
        
        if (selectedKPIs.length > 0) {
          y = addPDFSection(doc, 'Selected KPIs', y, [59, 130, 246]);
          doc.setTextColor(50, 50, 50);
          
          selectedKPIs.forEach((kpi: any) => {
            if (y > 230) {
              doc.addPage();
              y = 20;
            }
            
            // KPI Name
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(kpi.name, 20, y);
            y += 6;
            
            // Description
            if (kpi.description) {
              doc.setFont(undefined, 'normal');
              doc.setFontSize(9);
              doc.setTextColor(100, 100, 100);
              const lines = doc.splitTextToSize(kpi.description, 170);
              lines.forEach((line: string) => {
                doc.text(line, 20, y);
                y += 4;
              });
              doc.setTextColor(50, 50, 50);
              y += 2;
            }
            
            // Priority and Timeframe badges
            if (kpi.priority || kpi.timeframe) {
              doc.setFontSize(9);
              let badgeText = '';
              if (kpi.priority) {
                badgeText += `Priority: ${kpi.priority}`;
              }
              if (kpi.timeframe) {
                badgeText += (badgeText ? ' | ' : '') + `Timeframe: ${kpi.timeframe}`;
              }
              doc.setTextColor(100, 100, 100);
              doc.text(badgeText, 20, y);
              doc.setTextColor(50, 50, 50);
              y += 6;
            }
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            
            // Current and Target values with formatting
            if (kpi.currentValue) {
              doc.setFont(undefined, 'bold');
              doc.text('Current:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(`${formatNumber(kpi.currentValue)}${kpi.unit || ''}`, 50, y);
              y += 5;
            }
            
            if (kpi.targetValue) {
              doc.setFont(undefined, 'bold');
              doc.text('Target:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(`${formatNumber(kpi.targetValue)}${kpi.unit || ''}`, 50, y);
              y += 5;
            }
            
            // Progress percentage
            if (kpi.currentValue && kpi.targetValue) {
              const progress = Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100);
              doc.setFont(undefined, 'bold');
              doc.text('Progress:', 25, y);
              doc.setFont(undefined, 'normal');
              
              // Color-code the progress
              if (progress >= 100) {
                doc.setTextColor(22, 163, 74); // Green
              } else if (progress >= 70) {
                doc.setTextColor(59, 130, 246); // Blue
              } else {
                doc.setTextColor(234, 179, 8); // Yellow
              }
              doc.text(`${progress}%`, 50, y);
              doc.setTextColor(50, 50, 50); // Reset to dark
              y += 5;
            }
            
            if (kpi.targetDate) {
              const dateStr = new Date(kpi.targetDate).toLocaleDateString();
              doc.setFont(undefined, 'bold');
              doc.text('Target Date:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(dateStr, 60, y);
              y += 5;
            }
            
            doc.setFontSize(11);
            y += 8;
          });
        }
      }
      
      // Selected Benchmarks
      if (config.benchmarks && config.benchmarks.length > 0 && benchmarksData) {
        const selectedBenchmarks = (benchmarksData as any[]).filter(b => config.benchmarks.includes(b.id));
        
        if (selectedBenchmarks.length > 0) {
          y = addPDFSection(doc, 'Selected Benchmarks', y, [168, 85, 247]);
          doc.setTextColor(50, 50, 50);
          
          selectedBenchmarks.forEach((benchmark: any) => {
            if (y > 250) {
              doc.addPage();
              y = 20;
            }
            
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(benchmark.name || benchmark.metric, 20, y);
            y += 6;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            
            // Description
            if (benchmark.description) {
              const lines = doc.splitTextToSize(benchmark.description, 160);
              doc.setTextColor(100, 100, 100);
              lines.forEach((line: string) => {
                doc.text(line, 25, y);
                y += 5;
              });
              doc.setTextColor(50, 50, 50);
              y += 2;
            }
            
            // Metadata (industry, period, category)
            const metadata: string[] = [];
            if (benchmark.industry) metadata.push(benchmark.industry);
            if (benchmark.period) metadata.push(benchmark.period);
            if (benchmark.category) metadata.push(benchmark.category);
            if (metadata.length > 0) {
              doc.setTextColor(120, 120, 120);
              doc.text(metadata.join(' • '), 25, y);
              doc.setTextColor(50, 50, 50);
              y += 6;
            }
            
            // Performance Values
            if (benchmark.currentValue) {
              doc.setFont(undefined, 'bold');
              doc.text('Your Performance:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(`${formatNumber(benchmark.currentValue)}${benchmark.unit || ''}`, 80, y);
              y += 5;
            }
            
            if (benchmark.benchmarkValue) {
              doc.setFont(undefined, 'bold');
              doc.text('Benchmark Value:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(`${formatNumber(benchmark.benchmarkValue)}${benchmark.unit || ''}`, 80, y);
              y += 5;
            }
            
            // Source - always show with fallback
            doc.setFont(undefined, 'bold');
            doc.text('Source:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(benchmark.source || 'Custom Integration', 80, y);
            y += 5;
            
            // Performance vs Benchmark comparison
            if (benchmark.currentValue && benchmark.benchmarkValue) {
              const current = parseFloat(benchmark.currentValue);
              const benchmarkVal = parseFloat(benchmark.benchmarkValue);
              const diff = current - benchmarkVal;
              const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
              const isAbove = current >= benchmarkVal;
              
              doc.setFont(undefined, 'bold');
              doc.text('Performance vs Benchmark:', 25, y);
              doc.setFont(undefined, 'normal');
              
              if (isAbove) {
                doc.setTextColor(22, 163, 74); // Green
                doc.text(`${percentDiff.toFixed(2)}% Above - Outperforming!`, 80, y);
              } else {
                doc.setTextColor(220, 38, 38); // Red
                doc.text(`${Math.abs(percentDiff).toFixed(2)}% Below - Needs improvement`, 80, y);
              }
              doc.setTextColor(50, 50, 50); // Reset to dark
              y += 5;
            }
            
            if (benchmark.benchmarkType) {
              doc.setFont(undefined, 'bold');
              doc.text('Type:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(benchmark.benchmarkType, 80, y);
              y += 5;
            }
            
            if (benchmark.geoLocation || benchmark.geographicLocation) {
              doc.setFont(undefined, 'bold');
              doc.text('Location:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(benchmark.geoLocation || benchmark.geographicLocation, 80, y);
              y += 5;
            }
            
            if (benchmark.confidenceLevel) {
              doc.setFont(undefined, 'bold');
              doc.text('Confidence:', 25, y);
              doc.setFont(undefined, 'normal');
              doc.text(benchmark.confidenceLevel, 80, y);
              y += 5;
            }
            
            doc.setFontSize(11);
            y += 10;
          });
        }
      }
    } else if (reportType === 'kpis') {
      // KPIs Report
      const kpis = kpisData as any[] || [];
      
      if (kpis.length === 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No KPIs data available', 20, y);
      } else {
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        
        y = addPDFSection(doc, 'Key Performance Indicators', y, [59, 130, 246]);
        doc.setTextColor(50, 50, 50); // Reset to dark after section header
        
        kpis.forEach((kpi: any, index: number) => {
          if (y > 230) {
            doc.addPage();
            y = 20;
          }
          
          // KPI Name
          doc.setFont(undefined, 'bold');
          doc.setFontSize(12);
          doc.text(kpi.name, 20, y);
          y += 6;
          
          // Description
          if (kpi.description) {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const lines = doc.splitTextToSize(kpi.description, 170);
            lines.forEach((line: string) => {
              doc.text(line, 20, y);
              y += 4;
            });
            doc.setTextColor(50, 50, 50);
            y += 2;
          }
          
          // Priority and Timeframe badges
          if (kpi.priority || kpi.timeframe) {
            doc.setFontSize(9);
            let badgeText = '';
            if (kpi.priority) {
              badgeText += `Priority: ${kpi.priority}`;
            }
            if (kpi.timeframe) {
              badgeText += (badgeText ? ' | ' : '') + `Timeframe: ${kpi.timeframe}`;
            }
            doc.setTextColor(100, 100, 100);
            doc.text(badgeText, 20, y);
            doc.setTextColor(50, 50, 50);
            y += 6;
          }
          
          doc.setFont(undefined, 'normal');
          doc.setFontSize(10);
          
          // Current and Target values with formatting
          if (kpi.currentValue) {
            doc.setFont(undefined, 'bold');
            doc.text('Current:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${formatNumber(kpi.currentValue)}${kpi.unit || ''}`, 50, y);
            y += 5;
          }
          
          if (kpi.targetValue) {
            doc.setFont(undefined, 'bold');
            doc.text('Target:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(`${formatNumber(kpi.targetValue)}${kpi.unit || ''}`, 50, y);
            y += 5;
          }
          
          // Progress percentage
          if (kpi.currentValue && kpi.targetValue) {
            const progress = Math.min(Math.round((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100), 100);
            doc.setFont(undefined, 'bold');
            doc.text('Progress:', 25, y);
            doc.setFont(undefined, 'normal');
            
            // Color-code the progress
            if (progress >= 100) {
              doc.setTextColor(22, 163, 74); // Green
            } else if (progress >= 70) {
              doc.setTextColor(59, 130, 246); // Blue
            } else {
              doc.setTextColor(234, 179, 8); // Yellow
            }
            doc.text(`${progress}%`, 50, y);
            doc.setTextColor(50, 50, 50); // Reset to dark
            y += 5;
          }
          
          if (kpi.targetDate) {
            const dateStr = new Date(kpi.targetDate).toLocaleDateString();
            doc.setFont(undefined, 'bold');
            doc.text('Target Date:', 25, y);
            doc.setFont(undefined, 'normal');
            doc.text(dateStr, 60, y);
            y += 5;
          }
          
          doc.setFontSize(11);
          y += 8;
        });
      }
    } else {
      // Overview Report (default)
      const hasAnyData = metrics && (
        metrics.users ||
        metrics.sessions ||
        metrics.pageviews ||
        metrics.impressions ||
        metrics.reach ||
        metrics.clicks ||
        metrics.emailsDelivered ||
        metrics.openRate
      );
      
      if (!hasAnyData) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.text('No metrics data available', 20, y);
      } else {
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      // Audience & Traffic Section
      if (metrics.users || metrics.sessions || metrics.pageviews || metrics.avgSessionDuration || metrics.pagesPerSession || metrics.bounceRate) {
        y = addPDFSection(doc, 'Audience & Traffic', y, [59, 130, 246]);
        
        if (metrics.users) {
          doc.setFont(undefined, 'bold');
          doc.text('Users (unique):', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.users), 120, y);
          y += 8;
        }
        if (metrics.sessions) {
          doc.setFont(undefined, 'bold');
          doc.text('Sessions:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.sessions), 120, y);
          y += 8;
        }
        if (metrics.pageviews) {
          doc.setFont(undefined, 'bold');
          doc.text('Pageviews:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.pageviews), 120, y);
          y += 8;
        }
        if (metrics.avgSessionDuration) {
          doc.setFont(undefined, 'bold');
          doc.text('Avg. Session Duration:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(String(metrics.avgSessionDuration), 120, y);
          y += 8;
        }
        if (metrics.pagesPerSession) {
          doc.setFont(undefined, 'bold');
          doc.text('Pages / Session:', 20, y);
          doc.setFont(undefined, 'normal');
          const pagesValue = typeof metrics.pagesPerSession === 'string' ? parseFloat(metrics.pagesPerSession).toFixed(2) : metrics.pagesPerSession.toFixed(2);
          doc.text(pagesValue, 120, y);
          y += 8;
        }
        if (metrics.bounceRate) {
          doc.setFont(undefined, 'bold');
          doc.text('Bounce Rate:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.bounceRate + '%', 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Traffic Sources Section
      if (metrics.organicSearchShare || metrics.directBrandedShare || metrics.emailShare || 
          metrics.referralShare || metrics.paidShare || metrics.socialShare) {
        y = addPDFSection(doc, 'Traffic Sources', y, [234, 179, 8]);
        
        if (metrics.organicSearchShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Organic Search:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.organicSearchShare + '%', 120, y);
          y += 8;
        }
        if (metrics.directBrandedShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Direct/Branded:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.directBrandedShare + '%', 120, y);
          y += 8;
        }
        if (metrics.emailShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Email (Newsletters):', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.emailShare + '%', 120, y);
          y += 8;
        }
        if (metrics.referralShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Referral/Partners:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.referralShare + '%', 120, y);
          y += 8;
        }
        if (metrics.paidShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Paid (Display/Search):', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.paidShare + '%', 120, y);
          y += 8;
        }
        if (metrics.socialShare) {
          doc.setFont(undefined, 'bold');
          doc.text('Social:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.socialShare + '%', 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Email Performance Section
      if (metrics.emailsDelivered || metrics.openRate || metrics.clickThroughRate || metrics.clickToOpenRate || metrics.hardBounces || metrics.spamComplaints || metrics.listGrowth) {
        y = addPDFSection(doc, 'Email Performance', y, [16, 185, 129]);
        
        if (metrics.emailsDelivered) {
          doc.setFont(undefined, 'bold');
          doc.text('Emails Delivered:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.emailsDelivered), 120, y);
          y += 8;
        }
        if (metrics.openRate) {
          doc.setFont(undefined, 'bold');
          doc.text('Open Rate:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.openRate + '%', 120, y);
          y += 8;
        }
        if (metrics.clickThroughRate) {
          doc.setFont(undefined, 'bold');
          doc.text('Click-Through Rate:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.clickThroughRate + '%', 120, y);
          y += 8;
        }
        if (metrics.clickToOpenRate) {
          doc.setFont(undefined, 'bold');
          doc.text('Click-to-Open Rate:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.clickToOpenRate + '%', 120, y);
          y += 8;
        }
        if (metrics.hardBounces) {
          doc.setFont(undefined, 'bold');
          doc.text('Hard Bounces:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.hardBounces + '%', 120, y);
          y += 8;
        }
        if (metrics.spamComplaints) {
          doc.setFont(undefined, 'bold');
          doc.text('Spam Complaints:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(metrics.spamComplaints + '%', 120, y);
          y += 8;
        }
        if (metrics.listGrowth) {
          doc.setFont(undefined, 'bold');
          doc.text('List Growth:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.listGrowth), 120, y);
          y += 8;
        }
        y += 10;
      }
      
      // Social Media Section
      if (metrics.impressions || metrics.reach || metrics.clicks || metrics.engagements || metrics.spend || metrics.conversions || metrics.leads || metrics.videoViews || metrics.viralImpressions) {
        y = addPDFSection(doc, 'Social Media Metrics', y, [168, 85, 247]);
        
        if (metrics.impressions) {
          doc.setFont(undefined, 'bold');
          doc.text('Impressions:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.impressions), 120, y);
          y += 8;
        }
        if (metrics.reach) {
          doc.setFont(undefined, 'bold');
          doc.text('Reach:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.reach), 120, y);
          y += 8;
        }
        if (metrics.clicks) {
          doc.setFont(undefined, 'bold');
          doc.text('Clicks:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.clicks), 120, y);
          y += 8;
        }
        if (metrics.engagements) {
          doc.setFont(undefined, 'bold');
          doc.text('Engagements:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.engagements), 120, y);
          y += 8;
        }
        if (metrics.spend) {
          doc.setFont(undefined, 'bold');
          doc.text('Spend:', 20, y);
          doc.setFont(undefined, 'normal');
          const spendValue = typeof metrics.spend === 'string' ? parseFloat(metrics.spend) : metrics.spend;
          doc.text('$' + formatNumber(spendValue), 120, y);
          y += 8;
        }
        if (metrics.conversions) {
          doc.setFont(undefined, 'bold');
          doc.text('Conversions:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.conversions), 120, y);
          y += 8;
        }
        if (metrics.leads) {
          doc.setFont(undefined, 'bold');
          doc.text('Leads:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.leads), 120, y);
          y += 8;
        }
        if (metrics.videoViews) {
          doc.setFont(undefined, 'bold');
          doc.text('Video Views:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.videoViews), 120, y);
          y += 8;
        }
        if (metrics.viralImpressions) {
          doc.setFont(undefined, 'bold');
          doc.text('Viral Impressions:', 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(formatNumber(metrics.viralImpressions), 120, y);
          y += 8;
        }
        y += 10;
      }
      }
    }
    
    // Download the PDF
    doc.save(`${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Report Downloaded",
      description: "Your PDF report has been generated and downloaded successfully.",
    });
    setIsReportModalOpen(false);
  };

  const handleCreateReport = () => {
    // Validate custom reports have configuration
    if (reportForm.reportType === 'custom') {
      const hasConfig = customReportConfig.coreMetrics.length > 0 || 
                       customReportConfig.derivedMetrics.length > 0 || 
                       customReportConfig.kpis.length > 0 || 
                       customReportConfig.benchmarks.length > 0;
      
      if (!hasConfig) {
        toast({
          title: "Configuration Required",
          description: "Please select at least one metric, KPI, or benchmark for your custom report.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
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
    
    // Validate custom reports have configuration
    if (reportForm.reportType === 'custom') {
      const hasConfig = customReportConfig.coreMetrics.length > 0 || 
                       customReportConfig.derivedMetrics.length > 0 || 
                       customReportConfig.kpis.length > 0 || 
                       customReportConfig.benchmarks.length > 0;
      
      if (!hasConfig) {
        toast({
          title: "Configuration Required",
          description: "Please select at least one metric, KPI, or benchmark for your custom report.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!reportForm.scheduleEnabled) {
      handleGenerateReport();
      return;
    }
    
    const reportData: any = {
      ...reportForm,
      platformType: 'custom-integration',
      campaignId: campaignId,
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

  const handleDownloadReport = async (report: any) => {
    // For custom reports, ensure configuration exists
    if (report.reportType === 'custom' && !report.configuration) {
      toast({
        title: "Cannot Download Report",
        description: "This custom report has no configuration. Please edit and save it with metrics selected.",
        variant: "destructive",
      });
      return;
    }
    
    // Parse configuration if it's a JSON string
    let reportWithParsedConfig = { ...report };
    if (report.configuration && typeof report.configuration === 'string') {
      try {
        reportWithParsedConfig.configuration = JSON.parse(report.configuration);
      } catch (e) {
        console.error('Failed to parse report configuration for download:', e);
        toast({
          title: "Cannot Download Report",
          description: "Report configuration is invalid. Please edit and save the report again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Generate and download the PDF directly with the parsed report data
    await handleGenerateReport(reportWithParsedConfig);
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
    
    if (report.reportType === 'custom') {
      // Parse configuration if it's a JSON string
      let config = report.configuration;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.error('Failed to parse report configuration:', e);
          config = null;
        }
      }
      
      // Ensure customReportConfig has default structure
      setCustomReportConfig({
        coreMetrics: config?.coreMetrics || [],
        derivedMetrics: config?.derivedMetrics || [],
        kpis: config?.kpis || [],
        benchmarks: config?.benchmarks || []
      });
      setReportModalStep('custom');
    } else {
      setReportModalStep('standard');
    }
    
    setIsReportModalOpen(true);
  };

  const formatNumber = (num?: number | string | null) => {
    if (!num && num !== 0) return 'N/A';
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US').format(value);
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
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: '',
                              description: '',
                              reportType: 'kpis',
                              configuration: null,
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
                          onClick={() => {
                            setEditingKPI(null);
                            setKpiForm({
                              name: '',
                              description: '',
                              category: 'performance',
                              metric: '',
                              targetValue: '',
                              currentValue: '',
                              unit: '',
                              priority: 'medium',
                              timeframe: 'monthly',
                              alertsEnabled: false,
                              alertThreshold: '',
                              alertCondition: 'below',
                              emailRecipients: ''
                            });
                            setIsKPIModalOpen(true);
                          }}
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
                            <Target className="w-8 h-8 text-amber-500" />
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
                            <TrendingDown className="w-8 h-8 text-red-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(kpisData as any[]).map((kpi: any) => {
                        // Calculate status using industry-standard 120% threshold
                        const currentVal = kpi.currentValue ? parseFloat(kpi.currentValue) : 0;
                        const targetVal = kpi.targetValue ? parseFloat(kpi.targetValue) : 0;
                        
                        // Determine status based on percentage of target
                        let status = 'Underperforming';
                        if (targetVal > 0) {
                          if (currentVal >= targetVal * 1.2) {
                            status = 'Exceeding Target';
                          } else if (currentVal >= targetVal) {
                            status = 'Meeting Target';
                          }
                        }
                        
                        const getStatusColor = (status: string) => {
                          switch (status) {
                            case 'Exceeding Target':
                              return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                            case 'Meeting Target':
                              return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
                            case 'Underperforming':
                              return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
                            default:
                              return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
                          }
                        };
                        
                        const getPriorityColor = (priority: string) => {
                          switch (priority) {
                            case 'high':
                              return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
                            case 'medium':
                              return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
                            case 'low':
                              return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
                            default:
                              return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300';
                          }
                        };
                        
                        return (
                        <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                  {kpi.metric && (
                                    <Badge variant="outline" className="text-xs font-normal">
                                      Metric: {kpi.metric}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm">
                                  {kpi.description || 'No description provided'}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(status)}>
                                  {status}
                                </Badge>
                                {kpi.priority && (
                                  <Badge variant="outline" className={getPriorityColor(kpi.priority)}>
                                    {kpi.priority.charAt(0).toUpperCase() + kpi.priority.slice(1)}
                                  </Badge>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                  onClick={() => setEditingKPI(kpi)}
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
                                  {formatNumber(kpi.currentValue)}{kpi.unit || ''}
                                </div>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Target
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">
                                  {formatNumber(kpi.targetValue)}{kpi.unit || ''}
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
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Header with Create Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Track and monitor your Custom Integration KPIs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingReportId(null);
                            setReportForm({
                              name: '',
                              description: '',
                              reportType: 'kpis',
                              configuration: null,
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
                          onClick={() => {
                            setEditingKPI(null);
                            setKpiForm({
                              name: '',
                              description: '',
                              category: 'performance',
                              metric: '',
                              targetValue: '',
                              currentValue: '',
                              unit: '',
                              priority: 'medium',
                              timeframe: 'monthly',
                              alertsEnabled: false,
                              alertThreshold: '',
                              alertCondition: 'below',
                              emailRecipients: ''
                            });
                            setIsKPIModalOpen(true);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-create-kpi-header"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>
                    </div>

                    <Card>
                      <CardContent>
                        <div className="text-center py-12">
                          <p className="text-slate-600 dark:text-slate-400 mb-4">
                            No KPIs have been created yet.
                          </p>
                          <Button 
                            onClick={() => {
                              setEditingKPI(null);
                              setKpiForm({
                                name: '',
                                description: '',
                                category: 'performance',
                                metric: '',
                                targetValue: '',
                                currentValue: '',
                                unit: '',
                                priority: 'medium',
                                timeframe: 'monthly',
                                alertsEnabled: false,
                                alertThreshold: '',
                                alertCondition: 'below',
                                emailRecipients: ''
                              });
                              setIsKPIModalOpen(true);
                            }}
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
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditingReportId(null);
                        setReportForm({
                          name: '',
                          description: '',
                          reportType: 'benchmarks',
                          configuration: null,
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
                      data-testid="button-export-benchmarks-report"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Export Benchmarks Report
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingBenchmark(null);
                        setBenchmarkForm({
                          metric: '',
                          name: '',
                          category: 'performance',
                          benchmarkType: '',
                          competitorName: '',
                          unit: '',
                          benchmarkValue: '',
                          currentValue: '',
                          industry: '',
                          description: '',
                          source: '',
                          geographicLocation: '',
                          period: 'monthly',
                          confidenceLevel: '',
                          alertsEnabled: false,
                          alertThreshold: '',
                          alertCondition: 'below',
                          emailRecipients: ''
                        });
                        setIsBenchmarkModalOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      data-testid="button-create-benchmark"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Benchmark
                    </Button>
                  </div>
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
                              <p className="text-sm text-slate-600 dark:text-slate-400">Exceeding Target</p>
                              <p className="text-2xl font-bold text-green-600">
                                {(benchmarksData as any[]).filter((b: any) => {
                                  const current = parseFloat(b.currentValue || '0');
                                  const benchmark = parseFloat(b.benchmarkValue || '0');
                                  return benchmark > 0 && current >= benchmark * 1.2;
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
                                {(benchmarksData as any[]).filter((b: any) => {
                                  const current = parseFloat(b.currentValue || '0');
                                  const benchmark = parseFloat(b.benchmarkValue || '0');
                                  return benchmark > 0 && current >= benchmark && current < benchmark * 1.2;
                                }).length}
                              </p>
                            </div>
                            <Target className="w-8 h-8 text-amber-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Below Target</p>
                              <p className="text-2xl font-bold text-red-600">
                                {(benchmarksData as any[]).filter((b: any) => {
                                  const current = parseFloat(b.currentValue || '0');
                                  const benchmark = parseFloat(b.benchmarkValue || '0');
                                  return benchmark > 0 && current < benchmark;
                                }).length}
                              </p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-red-500" />
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
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                    {benchmark.name}
                                  </h3>
                                  {benchmark.metric && (
                                    <Badge variant="outline" className="text-xs font-normal">
                                      Metric: {benchmark.metric}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {benchmark.description || 'No description provided'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  {benchmark.benchmarkType && <span>Type: {benchmark.benchmarkType}</span>}
                                  {benchmark.industry && (
                                    <>
                                      <span>•</span>
                                      <span>{benchmark.industry}</span>
                                    </>
                                  )}
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
                                      competitorName: benchmark.competitorName || '',
                                      unit: benchmark.unit || '',
                                      benchmarkValue: benchmark.benchmarkValue || '',
                                      currentValue: benchmark.currentValue || '',
                                      industry: benchmark.industry || '',
                                      description: benchmark.description || '',
                                      source: benchmark.source || '',
                                      geographicLocation: benchmark.geoLocation || '',
                                      period: benchmark.period || 'monthly',
                                      confidenceLevel: benchmark.confidenceLevel || '',
                                      alertsEnabled: benchmark.alertsEnabled || false,
                                      alertThreshold: benchmark.alertThreshold || '',
                                      alertCondition: benchmark.alertCondition || 'below',
                                      emailRecipients: benchmark.emailRecipients || ''
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
                                  {formatNumber(benchmark.currentValue)}{benchmark.unit || ''}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  Benchmark Value
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                  {formatNumber(benchmark.benchmarkValue || benchmark.targetValue)}{benchmark.unit || ''}
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
                            
                            {/* Progress Tracker - Benchmark Comparison */}
                            {benchmark.currentValue && benchmark.benchmarkValue && (() => {
                              // Calculate accurate progress and comparison
                              const current = parseFloat(benchmark.currentValue);
                              const benchmarkVal = parseFloat(benchmark.benchmarkValue);
                              
                              // Progress: percentage of benchmark achieved (no Math.min cap, use precision)
                              const progressTowardBenchmark = (current / benchmarkVal) * 100;
                              
                              // Performance comparison
                              const diff = current - benchmarkVal;
                              const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
                              
                              // Status determination based on industry-standard 120% threshold
                              const isExceeding = current >= benchmarkVal * 1.2; // 120% or more
                              const isMeetingBenchmark = current >= benchmarkVal && current < benchmarkVal * 1.2; // 100-119%
                              const isBelowBenchmark = current < benchmarkVal; // Below 100%
                              
                              // Display values with appropriate precision
                              const displayProgress = progressTowardBenchmark >= 100 
                                ? '100' 
                                : progressTowardBenchmark.toFixed(2);
                              
                              return (
                                <div className="mt-4 space-y-3">
                                  {/* Progress to Benchmark */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-600 dark:text-slate-400">Progress to Benchmark</span>
                                        {(isExceeding || isMeetingBenchmark) && <TrendingUp className="w-4 h-4 text-green-600" />}
                                        {isBelowBenchmark && <TrendingDown className="w-4 h-4 text-red-600" />}
                                      </div>
                                      <span className="font-semibold text-slate-900 dark:text-white">
                                        {displayProgress}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                      <div 
                                        className={`h-2.5 rounded-full transition-all ${
                                          isExceeding
                                            ? 'bg-green-500'
                                            : isMeetingBenchmark
                                            ? 'bg-amber-500'
                                            : 'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(progressTowardBenchmark, 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Benchmark Status and Comparison */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                                      isExceeding
                                        ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                                        : isMeetingBenchmark
                                        ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                        : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
                                    }`}>
                                      {isExceeding && <CheckCircle2 className="w-3 h-3" />}
                                      {isMeetingBenchmark && <CheckCircle2 className="w-3 h-3" />}
                                      {isBelowBenchmark && <AlertCircle className="w-3 h-3" />}
                                      <span>
                                        {isExceeding
                                          ? 'Exceeding Target' 
                                          : isMeetingBenchmark
                                          ? 'Meeting Target'
                                          : 'Below Target'}
                                      </span>
                                    </div>
                                    
                                    <Badge 
                                      variant={isExceeding || isMeetingBenchmark ? "default" : "secondary"}
                                      className={isExceeding ? "bg-green-600 text-white" : isMeetingBenchmark ? "bg-amber-600 text-white" : "bg-red-600 text-white"}
                                    >
                                      {current >= benchmarkVal ? (
                                        <>
                                          <TrendingUp className="w-3 h-3 mr-1" />
                                          {percentDiff.toFixed(2)}% Above Benchmark
                                        </>
                                      ) : (
                                        <>
                                          <TrendingDown className="w-3 h-3 mr-1" />
                                          {Math.abs(percentDiff).toFixed(2)}% Below Benchmark
                                        </>
                                      )}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })()}
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
                                onClick={() => handleDownloadReport(report)}
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
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) {
          // Reset editing state when modal closes
          setEditingKPI(null);
          setKpiForm({
            name: '',
            description: '',
            category: 'performance',
            metric: '',
            targetValue: '',
            currentValue: '',
            unit: '',
            priority: 'medium',
            timeframe: 'monthly',
            alertsEnabled: false,
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
                  key={`metric-select-${editingKPI?.id || 'new'}-${kpiForm.metric}`}
                  value={kpiForm.metric || ''}
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
                  checked={kpiForm.alertsEnabled}
                  onCheckedChange={(checked) => setKpiForm({ ...kpiForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-kpi-alerts"
                />
                <Label htmlFor="kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.alertsEnabled && (
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
                    timeframe: 'monthly',
                    alertsEnabled: false,
                    alertThreshold: '',
                    alertCondition: 'below',
                    emailRecipients: ''
                  });
                }}
                data-testid="button-kpi-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleKPISubmit}
                disabled={!kpiForm.name || !kpiForm.targetValue || !campaignId}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Metric Source</Label>
                <Select
                  value={benchmarkForm.metric || undefined}
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

            {/* Alert Settings Section */}
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
                    category: 'performance',
                    benchmarkType: '',
                    competitorName: '',
                    unit: '',
                    benchmarkValue: '',
                    currentValue: '',
                    industry: '',
                    description: '',
                    source: '',
                    geographicLocation: '',
                    period: 'monthly',
                    confidenceLevel: '',
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
                onClick={handleBenchmarkSubmit}
                disabled={!benchmarkForm.name || !benchmarkForm.benchmarkValue || !campaignId || createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending}
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
                      onClick={() => {
                        setReportModalStep('custom');
                        setReportForm({ ...reportForm, reportType: 'custom' });
                      }}
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
                  
                  <Accordion type="multiple" className="w-full">
                    {/* Audience & Traffic Metrics */}
                    <AccordionItem value="audience-traffic">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Audience & Traffic Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['users', 'sessions', 'pageviews', 'avgSessionDuration', 'pagesPerSession', 'bounceRate'].map((metric) => {
                            const labels: Record<string, string> = {
                              users: 'Users',
                              sessions: 'Sessions',
                              pageviews: 'Pageviews',
                              avgSessionDuration: 'Avg. Session Duration',
                              pagesPerSession: 'Pages/Session',
                              bounceRate: 'Bounce Rate'
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

                    {/* Traffic Sources */}
                    <AccordionItem value="traffic-sources">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Traffic Sources
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['organicSearchShare', 'directBrandedShare', 'emailShare', 'referralShare', 'paidShare', 'socialShare'].map((metric) => {
                            const labels: Record<string, string> = {
                              organicSearchShare: 'Organic Search',
                              directBrandedShare: 'Direct/Branded',
                              emailShare: 'Email',
                              referralShare: 'Referral/Partners',
                              paidShare: 'Paid',
                              socialShare: 'Social'
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`traffic-${metric}`}
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
                                  data-testid={`checkbox-traffic-${metric}`}
                                />
                                <Label htmlFor={`traffic-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Email Performance Metrics */}
                    <AccordionItem value="email-performance">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Email Performance Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['emailsDelivered', 'openRate', 'clickThroughRate', 'clickToOpen', 'hardBounces', 'spamComplaints', 'listGrowth'].map((metric) => {
                            const labels: Record<string, string> = {
                              emailsDelivered: 'Emails Delivered',
                              openRate: 'Open Rate',
                              clickThroughRate: 'Click-Through Rate',
                              clickToOpen: 'Click-to-Open',
                              hardBounces: 'Hard Bounces',
                              spamComplaints: 'Spam Complaints',
                              listGrowth: 'List Growth'
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* KPIs and Benchmarks Section */}
                <div className="space-y-3 pt-4 border-t">
                  <Accordion type="multiple" className="w-full">
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
                  </Accordion>
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

                      {/* Time */}
                      <div className="space-y-2">
                        <Label htmlFor="custom-schedule-time">Time</Label>
                        <Select
                          value={reportForm.scheduleTime}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                        >
                          <SelectTrigger id="custom-schedule-time" data-testid="select-custom-time">
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

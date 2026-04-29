import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Calendar, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, CheckCircle2, XCircle, AlertCircle, Loader2, Star, Plus, Trash2, X, DollarSign, Eye, MousePointerClick, BarChart3, Hash } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiGooglesheets } from "react-icons/si";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ColumnMappingInterface } from "@/components/ColumnMappingInterface";
import { GuidedColumnMapping } from "@/components/GuidedColumnMapping";
import { UploadAdditionalDataModal } from "@/components/UploadAdditionalDataModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GoogleSheetsKpiModal } from "@/pages/google-sheets-analytics/GoogleSheetsKpiModal";
import { GoogleSheetsBenchmarkModal } from "@/pages/google-sheets-analytics/GoogleSheetsBenchmarkModal";
import { GoogleSheetsReportModal } from "@/pages/google-sheets-analytics/GoogleSheetsReportModal";
import { Edit2, Clock, Mail, Download } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  platform?: string;
}

interface GoogleSheetsData {
  spreadsheetName: string;
  spreadsheetId: string;
  totalRows: number;
  filteredRows?: number;
  lastUpdated: string;
  lastDataRefreshAt?: string | null;
  headers: string[];
  data: any[][];
  rowLimitWarning?: string;
  failedSheets?: Array<{ spreadsheetId: string; spreadsheetName: string; sheetName: string; reason: string }>;
  summary: {
    metrics?: Record<string, number>;
    detectedColumns?: Array<{
      name: string;
      index: number;
      type: 'currency' | 'integer' | 'decimal';
      total: number;
    }>;
    // Legacy fields for backward compatibility
    totalImpressions?: number;
    totalClicks?: number;
    totalSpend?: number;
    averageCTR?: number;
  };
  insights?: {
    topPerformers: Array<{
      metric: string;
      value: number;
      rowNumber: number;
      type: string;
      percentOfTotal: number;
    }>;
    bottomPerformers: Array<{
      metric: string;
      value: number;
      rowNumber: number;
      type: string;
      percentOfTotal: number;
    }>;
    anomalies: Array<{
      metric: string;
      value: number;
      rowNumber: number;
      type: string;
      deviation: number;
      direction: string;
      message: string;
    }>;
    trends: Array<{
      metric: string;
      direction: string;
      percentChange: number;
      type: string;
      message: string;
    }>;
    correlations: Array<{
      metric1: string;
      metric2: string;
      correlation: number;
      strength: string;
      direction: string;
      message: string;
    }>;
    recommendations: Array<{
      type: string;
      priority: string;
      metric: string;
      message: string;
      action: string;
    }>;
    dataQuality: {
      completeness: number;
      missingValues: number;
      outliers: Array<{
        metric: string;
        value: number;
        rowNumber: number;
        type: string;
      }>;
    };
  };
}

export default function GoogleSheetsData() {
  const [, params] = useRoute("/campaigns/:id/google-sheets-data");
  const [location, setLocation] = useLocation();
  const campaignId = params?.id;
  const [mappingConnectionId, setMappingConnectionId] = useState<string | null>(null);
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [showAddDatasetModal, setShowAddDatasetModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get selected spreadsheetId from URL query params - update when location changes
  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(window.location.search));
  const selectedSpreadsheetId = urlParams.get('spreadsheetId');
  const isCombinedView = urlParams.get('view') === 'combined';

  // Update URL params when location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams(params);
  }, [location]);

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch Google Sheets connections
  const { data: googleSheetsConnectionsData, refetch: refetchConnections } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Google Sheets connections: ${response.status}`);
      }
      return response.json();
    },
  });

  const googleSheetsConnections = googleSheetsConnectionsData?.connections || [];
  const MAX_GOOGLE_SHEETS_CONNECTIONS = 10;
  const canAddMoreSheets = googleSheetsConnections.length < MAX_GOOGLE_SHEETS_CONNECTIONS;


  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/google-sheets/${campaignId}/connection?connectionId=${connectionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete connection');
      }
      return response.json();
    },
    onMutate: async (connectionId: string) => {
      // Optimistic update to avoid UI "jumping" on delete (no full refetch/skeleton churn)
      const connectionsKey = ["/api/campaigns", campaignId, "google-sheets-connections"];
      await queryClient.cancelQueries({ queryKey: connectionsKey });

      const prev = queryClient.getQueryData<any>(connectionsKey);
      const prevConnections: any[] = prev?.connections || [];

      // Determine if we are deleting the currently selected connection
      const currentValue = activeSpreadsheetId;
      let wasActive = false;
      if (currentValue && currentValue !== 'combined') {
        const [spreadsheetId, identifier] = currentValue.includes(':') ? currentValue.split(':') : [currentValue, null];
        const activeConn = prevConnections.find((c: any) =>
          c.spreadsheetId === spreadsheetId && (identifier === null || c.sheetName === identifier || c.id === identifier)
        );
        wasActive = !!activeConn && activeConn.id === connectionId;
      }

      // Optimistically remove the connection from the list
      queryClient.setQueryData(connectionsKey, (old: any) => {
        const connections = old?.connections || [];
        return { ...(old || {}), connections: connections.filter((c: any) => c.id !== connectionId) };
      });

      // If the deleted connection was active, switch to the next available connection smoothly
      if (wasActive) {
        const remaining = prevConnections.filter((c: any) => c.id !== connectionId);
        const next = remaining[0];
        if (next) {
          const nextValue = next.sheetName ? `${next.spreadsheetId}:${next.sheetName}` : `${next.spreadsheetId}:${next.id}`;
          handleSheetChange(nextValue);
        } else {
          handleSheetChange('combined');
        }
      }

      return { prev };
    },
    onError: (error: Error, _connectionId: string, context: any) => {
      // Roll back optimistic update
      const connectionsKey = ["/api/campaigns", campaignId, "google-sheets-connections"];
      if (context?.prev) queryClient.setQueryData(connectionsKey, context.prev);

      toast({
        title: "Failed to Remove Connection",
        description: error.message || "An error occurred while removing the connection.",
        variant: "destructive"
      });
    },
    onSuccess: async () => {
      // Background refresh (no forced double refetch loop â†’ avoids UI jumping)
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"], exact: false });

      toast({
        title: "Connection Removed",
        description: "Google Sheets connection has been removed successfully.",
      });
    }
  });

  // Manual data refresh mutation
  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/google-sheets-refresh`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      toast({ title: "Data refreshed", description: "Google Sheets data has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
    },
  });

  const isMapped = (connection: any): boolean => {
    if (!connection.columnMappings) return false;
    try {
      const mappings = JSON.parse(connection.columnMappings);
      return Array.isArray(mappings) && mappings.length > 0;
    } catch {
      return false;
    }
  };

  // Get primary connection for default selection
  const primaryConnection = useMemo(() => {
    return googleSheetsConnections.find((conn: any) => conn.isPrimary) || googleSheetsConnections[0];
  }, [googleSheetsConnections]);

  // Determine which spreadsheet to fetch data from
  const activeSpreadsheetId = useMemo(() => {
    if (isCombinedView) return 'combined';
    if (selectedSpreadsheetId) {
      // Parse composite value (spreadsheetId:sheetName or spreadsheetId:connectionId)
      const [spreadsheetId, identifier] = selectedSpreadsheetId.includes(':') 
        ? selectedSpreadsheetId.split(':') 
        : [selectedSpreadsheetId, null];
      
      // Verify the selected connection exists
      // identifier can be sheetName or connectionId (for tabs without sheetName)
      const exists = googleSheetsConnections.some((conn: any) => 
        conn.spreadsheetId === spreadsheetId && 
        (identifier === null || conn.sheetName === identifier || conn.id === identifier)
      );
      if (exists) return selectedSpreadsheetId;
    }
    // Default to primary or first connection
    const defaultConn = primaryConnection || googleSheetsConnections[0];
    if (defaultConn) {
      return defaultConn.sheetName 
        ? `${defaultConn.spreadsheetId}:${defaultConn.sheetName}`
        : `${defaultConn.spreadsheetId}:${defaultConn.id}`;
    }
    return null;
  }, [selectedSpreadsheetId, isCombinedView, primaryConnection, googleSheetsConnections]);

  // Handle sheet selection change with smooth transition
  const handleSheetChange = useCallback((value: string) => {
    if (!value) return; // Don't handle empty values
    
    const newParams = new URLSearchParams(window.location.search);
    if (value === 'combined') {
      newParams.set('view', 'combined');
      newParams.delete('spreadsheetId');
    } else {
      // Parse composite value (spreadsheetId:sheetName or spreadsheetId:connectionId)
      const [spreadsheetId, identifier] = value.includes(':') 
        ? value.split(':') 
        : [value, null];
      
      // Verify the value exists in connections before setting it
      // identifier can be sheetName or connectionId (for tabs without sheetName)
      const exists = googleSheetsConnections.some((conn: any) => 
        conn.spreadsheetId === spreadsheetId && 
        (identifier === null || conn.sheetName === identifier || conn.id === identifier)
      );
      if (exists) {
        newParams.set('spreadsheetId', value);
        newParams.delete('view');
      } else {
        console.warn('[Sheet Selector] Invalid connection:', value);
        return;
      }
    }
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    
    // Update URL params state immediately for smooth transition
    setUrlParams(newParams);
    
    // Use client-side navigation for smooth transition (no page reload)
    window.history.pushState({}, '', newUrl);
    setLocation(newUrl);
  }, [googleSheetsConnections, setLocation]);

  const { data: sheetsData, isLoading: sheetsLoading, isFetching: sheetsFetching, status: sheetsStatus, error: sheetsError, refetch } = useQuery<GoogleSheetsData & { calculatedConversionValues?: any[]; matchingInfo?: any; sheetBreakdown?: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data", activeSpreadsheetId],
    enabled: !!campaignId && activeSpreadsheetId !== null,
    refetchInterval: 3600000, // Auto-refresh every hour
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    staleTime: 0, // Always consider data stale - force fresh fetch
    gcTime: 30000, // Keep data in cache for 30 seconds for smooth transitions
    placeholderData: (previousData) => previousData, // Keep previous data visible during fetch for smooth transition
      queryFn: async () => {
        let response: Response;
        try {
          const url = isCombinedView 
            ? `/api/campaigns/${campaignId}/google-sheets-data?view=combined`
            : `/api/campaigns/${campaignId}/google-sheets-data${activeSpreadsheetId && activeSpreadsheetId !== 'combined' ? `?spreadsheetId=${encodeURIComponent(activeSpreadsheetId)}` : ''}`;
        response = await fetch(url, {
          signal: AbortSignal.timeout(60000) // 60 second timeout for the entire request
        });
      } catch (fetchError: any) {
        // Handle network errors, timeouts, etc.
        console.error('[Google Sheets] Fetch error:', fetchError);
        const error = new Error(fetchError.name === 'AbortError' 
          ? 'Request timeout: Server did not respond within 60 seconds'
          : fetchError.message || 'Network error: Failed to connect to server') as any;
        error.isNetworkError = true;
        throw error;
      }
      
      // Get response text first to check if it's valid JSON
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('[Google Sheets] Failed to read response:', textError);
        throw new Error('Failed to read response from server');
      }
      
      if (!response.ok) {
        let errorData: any = {};
        
        // Try to parse JSON, but handle empty or invalid responses
        try {
          if (responseText && responseText.trim()) {
            errorData = JSON.parse(responseText);
          }
        } catch (parseError) {
          // If JSON parsing fails, use status text or default message
          console.error('Failed to parse error response:', parseError);
          errorData = {
            error: response.statusText || 'Unknown error',
            message: responseText || `Server returned ${response.status} with no error details`
          };
        }
        
        // Handle token expiration
        if (response.status === 401 && (errorData.error === 'REFRESH_TOKEN_EXPIRED' || errorData.error === 'ACCESS_TOKEN_EXPIRED' || errorData.requiresReauthorization)) {
          const error = new Error('TOKEN_EXPIRED') as any;
          error.requiresReauthorization = true;
          error.message = errorData.message || 'Google Sheets connection expired. Please reconnect.';
          throw error;
        }
        
        // Handle missing spreadsheet
        if (response.status === 400 && errorData.missingSpreadsheet) {
          const error = new Error('MISSING_SPREADSHEET') as any;
          error.message = errorData.error || 'No spreadsheet selected. Please select a spreadsheet.';
          throw error;
        }
        
        // For other errors, include the full error message
        const errorMessage = errorData.error || errorData.message || `Failed to fetch Google Sheets data (${response.status})`;
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.errorCode = errorData.error;
        throw error;
      }
      
      // Parse successful response
      let data: any;
      try {
        if (!responseText || !responseText.trim()) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError, 'Response text:', responseText.substring(0, 200));
        throw new Error(`Invalid response from server: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      // Check if response indicates failure
      if (data.success === false) {
        const errorMessage = data.error || data.message || 'Google Sheets data request failed';
        const error = new Error(errorMessage) as any;
        error.errorCode = data.error;
        throw error;
      }
      
      return data;
    },
  });
  
  // Determine if we're in a loading state (initial load or refetch)
  // Show loading if: actively loading, fetching without data, or query is pending (hasn't started yet)
  // Priority: Always show loading if we don't have data yet and there's no error (prevents "No Data Available" flash)
  // Only show full skeleton when there's genuinely no data to display.
  // When switching sheets, placeholderData keeps previous data visible —
  // the subtle overlay (sheetsFetching check in JSX) handles the transition.
  const isDataLoading = !sheetsData && !sheetsError && (sheetsLoading || sheetsFetching || sheetsStatus === 'pending');


  // Debug data structure
  useEffect(() => {
    if (sheetsData) {
      console.log('Sheets data received:', {
        totalRows: sheetsData.totalRows,
        headersLength: sheetsData.headers?.length,
        dataLength: sheetsData.data?.length,
        firstRow: sheetsData.data?.[0],
        headers: sheetsData.headers,
        summary: sheetsData.summary,
        fullData: sheetsData
      });
    }
  }, [sheetsData]);

  // ═══ KPI State ═══
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({
    name: "", unit: "", description: "", metric: "", targetValue: "", currentValue: "",
    priority: "high", status: "active", timeframe: "monthly",
    alertsEnabled: false, emailNotifications: false, alertFrequency: "daily",
    alertThreshold: "", alertCondition: "below", emailRecipients: "",
  });

  // ═══ Benchmark State ═══
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: "", unit: "", description: "", metric: "", benchmarkValue: "", currentValue: "",
    alertsEnabled: false, emailNotifications: false, alertFrequency: "daily",
    alertThreshold: "", alertCondition: "below", emailRecipients: "",
  });

  // ═══ Report State ═══
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalStep, setReportModalStep] = useState<"standard" | "custom">("standard");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({
    name: "", description: "", reportType: "", scheduleEnabled: false,
    scheduleFrequency: "weekly", scheduleDayOfWeek: "monday", scheduleDayOfMonth: "first",
    quarterTiming: "end", scheduleTime: "9:00 AM", emailRecipients: "", status: "draft",
  });
  const [reportFormErrors, setReportFormErrors] = useState<any>({});
  const [customReportConfig, setCustomReportConfig] = useState<any>({
    selectedMetrics: [], kpis: [], benchmarks: [],
  });

  // ═══ Insights State ═══
  const [gsInsightsTrendMetric, setGsInsightsTrendMetric] = useState<string>('');

  // ═══ KPI Queries ═══
  const { data: kpisData, isLoading: kpisLoading, isError: kpisIsError, error: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['/api/platforms/google_sheets/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_sheets/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // ═══ Benchmark Queries ═══
  const { data: benchmarksData, isLoading: benchmarksLoading, isError: benchmarksIsError, error: benchmarksError, refetch: refetchBenchmarks } = useQuery({
    queryKey: ['/api/platforms/google_sheets/benchmarks', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_sheets/benchmarks?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // ═══ Report Queries ═══
  const { data: reportsData, isLoading: reportsLoading, isError: reportsIsError, error: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ['/api/platforms/google_sheets/reports', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_sheets/reports?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // ═══ KPI Mutations ═══
  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/platforms/google_sheets/kpis', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/kpis', campaignId] });
      toast({ title: "KPI Created", description: "Your KPI has been created successfully." });
      setIsKpiModalOpen(false);
      setEditingKpi(null);
      setKpiForm({ name: "", unit: "", description: "", metric: "", targetValue: "", currentValue: "", priority: "high", status: "active", timeframe: "monthly", alertsEnabled: false, emailNotifications: false, alertFrequency: "daily", alertThreshold: "", alertCondition: "below", emailRecipients: "" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to create KPI", variant: "destructive" }); },
  });

  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/google_sheets/kpis/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/kpis', campaignId] });
      toast({ title: "KPI Updated", description: "Your KPI has been updated successfully." });
      setIsKpiModalOpen(false);
      setEditingKpi(null);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update KPI", variant: "destructive" }); },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/google_sheets/kpis/${kpiId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/kpis', campaignId] });
      toast({ title: "KPI Deleted", description: "The KPI has been deleted successfully." });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to delete KPI", variant: "destructive" }); },
  });

  // ═══ Benchmark Mutations ═══
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/platforms/google_sheets/benchmarks', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/benchmarks', campaignId] });
      toast({ title: "Benchmark Created", description: "Your benchmark has been created successfully." });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      setBenchmarkForm({ name: "", unit: "", description: "", metric: "", benchmarkValue: "", currentValue: "", alertsEnabled: false, emailNotifications: false, alertFrequency: "daily", alertThreshold: "", alertCondition: "below", emailRecipients: "" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to create benchmark", variant: "destructive" }); },
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/platforms/google_sheets/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/benchmarks', campaignId] });
      toast({ title: "Benchmark Updated", description: "Your benchmark has been updated successfully." });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update benchmark", variant: "destructive" }); },
  });

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (bmId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/google_sheets/benchmarks/${bmId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/benchmarks', campaignId] });
      toast({ title: "Benchmark Deleted", description: "The benchmark has been deleted successfully." });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to delete benchmark", variant: "destructive" }); },
  });

  // ═══ Report Mutations ═══
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/platforms/google_sheets/reports', data);
      return { data: await res.json(), reportData: data };
    },
    onSuccess: ({ reportData }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/reports', campaignId] });
      if (reportData.scheduleEnabled && reportData.scheduleRecipients?.length > 0) {
        toast({ title: "Report Created & Scheduled", description: `Report scheduled (${reportData.scheduleFrequency}) for ${reportData.scheduleRecipients.length} recipient(s).` });
      } else {
        toast({ title: "Report Created", description: "Your report has been created successfully." });
      }
      setIsReportModalOpen(false);
      setEditingReportId(null);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to create report", variant: "destructive" }); },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/platforms/google_sheets/reports/${reportId}`, data);
      return { data: await res.json(), reportData: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/reports', campaignId] });
      toast({ title: "Report Updated", description: "Your report has been updated successfully." });
      setIsReportModalOpen(false);
      setEditingReportId(null);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update report", variant: "destructive" }); },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await apiRequest('DELETE', `/api/platforms/google_sheets/reports/${reportId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_sheets/reports', campaignId] });
      toast({ title: "Report Deleted", description: "The report has been deleted successfully." });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to delete report", variant: "destructive" }); },
  });

  // ═══ Handler Functions ═══
  const handleCreateKpi = () => {
    if (!kpiForm.name || !kpiForm.targetValue) {
      toast({ title: "Required Fields", description: "Please fill in the KPI name and target value.", variant: "destructive" });
      return;
    }
    if (kpiForm.alertsEnabled && !kpiForm.alertThreshold) {
      toast({ title: "Alert Threshold Required", description: "Please set an alert threshold value.", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...kpiForm, campaignId, platformType: "google_sheets",
      targetValue: parseFloat(String(kpiForm.targetValue).replace(/,/g, '')),
      currentValue: kpiForm.currentValue ? parseFloat(String(kpiForm.currentValue).replace(/,/g, '')) : 0,
      alertThreshold: kpiForm.alertThreshold ? parseFloat(String(kpiForm.alertThreshold).replace(/,/g, '')) : null,
      emailRecipients: kpiForm.emailRecipients ? kpiForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
      metricKey: kpiForm.metric,
    };
    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  const handleCreateBenchmark = () => {
    if (!benchmarkForm.name || !benchmarkForm.benchmarkValue) {
      toast({ title: "Required Fields", description: "Please fill in the benchmark name and value.", variant: "destructive" });
      return;
    }
    if (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold) {
      toast({ title: "Alert Threshold Required", description: "Please set an alert threshold value.", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...benchmarkForm, campaignId, platformType: "google_sheets",
      benchmarkValue: parseFloat(String(benchmarkForm.benchmarkValue).replace(/,/g, '')),
      currentValue: benchmarkForm.currentValue ? parseFloat(String(benchmarkForm.currentValue).replace(/,/g, '')) : 0,
      alertThreshold: benchmarkForm.alertThreshold ? parseFloat(String(benchmarkForm.alertThreshold).replace(/,/g, '')) : null,
      emailRecipients: benchmarkForm.emailRecipients ? benchmarkForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
      metricKey: benchmarkForm.metric,
    };
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: payload });
    } else {
      createBenchmarkMutation.mutate(payload);
    }
  };

  const handleReportTypeSelect = (type: string) => {
    const names: Record<string, string> = {
      overview: "Google Sheets Overview Report", kpis: "KPIs Report",
      benchmarks: "Benchmarks Report", insights: "Insights Report", custom: "Custom Report",
    };
    setReportForm({ ...reportForm, reportType: type, name: names[type] || "Report" });
  };

  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled && !reportForm.emailRecipients?.trim()) {
      setReportFormErrors({ emailRecipients: "Email recipients are required for scheduled reports" });
      return;
    }
    const recipients = reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    createReportMutation.mutate({
      ...reportForm, campaignId, platformType: "google_sheets",
      scheduleRecipients: recipients,
    });
  };

  const handleUpdateReport = () => {
    if (!editingReportId) return;
    const recipients = reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    updateReportMutation.mutate({
      reportId: editingReportId,
      data: { ...reportForm, scheduleRecipients: recipients },
    });
  };

  const handleCustomReport = () => {
    if (reportForm.scheduleEnabled && !reportForm.emailRecipients?.trim()) {
      setReportFormErrors({ emailRecipients: "Email recipients are required for scheduled reports" });
      return;
    }
    const recipients = reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    createReportMutation.mutate({
      ...reportForm, campaignId, platformType: "google_sheets",
      reportType: "custom", configuration: customReportConfig,
      scheduleRecipients: recipients,
    });
  };

  const formatMetricValue = (value: number, type?: string): string => {
    if (type === 'currency') return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (type === 'decimal') return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value.toLocaleString();
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Campaign not found</h2>
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

  // ═══ Summary Tab Helpers ═══
  function formatSummaryValue(value: number, colType: string, colName: string): string {
    const n = colName.toLowerCase();
    if (n.includes('%') || n.includes('rate') || n.includes('ctr') || n.includes('cvr')) {
      return value.toFixed(2) + '%';
    }
    if (n.includes('roas') || n.includes('return on')) {
      return value.toFixed(2) + 'x';
    }
    const isCurrency = colType === 'currency' || n.includes('$') || n.includes('revenue')
      || n.includes('spend') || n.includes('cost') || n.includes('budget')
      || n.includes('cpc') || n.includes('cpm') || n.includes('cpa');
    if (isCurrency) {
      if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
      if (Math.abs(value) >= 10_000) return '$' + (value / 1_000).toFixed(1) + 'K';
      return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (colType === 'integer') {
      if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
      if (value >= 10_000) return (value / 1_000).toFixed(1) + 'K';
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function classifyColumns(cols: Array<{ name: string; index: number; type: string; total: number }>) {
    const hero: typeof cols = [];
    const supporting: typeof cols = [];
    for (const col of cols) {
      const n = col.name.toLowerCase();
      const isPct = n.includes('%') || n.includes('rate') || n.includes('ctr') || n.includes('cvr');
      const isRoas = n.includes('roas') || n.includes('return on');
      const isCurrency = col.type === 'currency' || n.includes('$') || n.includes('revenue')
        || n.includes('spend') || n.includes('cost') || n.includes('budget');
      const isUtility = n.includes('days') || n.includes('month');
      const isSmallCount = col.type === 'integer' && col.total < 100;
      if (isPct || isRoas || isSmallCount || isUtility) {
        supporting.push(col);
      } else if (isCurrency || (col.type === 'integer' && col.total >= 100)) {
        hero.push(col);
      } else {
        supporting.push(col);
      }
    }
    if (hero.length > 4) {
      hero.sort((a, b) => b.total - a.total);
      supporting.unshift(...hero.splice(4));
    }
    return { hero, supporting };
  }

  function getSummaryIcon(colName: string) {
    const n = colName.toLowerCase();
    if (n.includes('revenue') || n.includes('spend') || n.includes('cost') || n.includes('budget') || n.includes('$')) return DollarSign;
    if (n.includes('impression') || n.includes('reach') || n.includes('view')) return Eye;
    if (n.includes('click')) return MousePointerClick;
    if (n.includes('conversion') || n.includes('lead') || n.includes('mql') || n.includes('sql') || n.includes('opportunit')) return Target;
    if (n.includes('rate') || n.includes('%') || n.includes('ctr') || n.includes('roas')) return TrendingUp;
    return BarChart3;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <SiGooglesheets className="w-8 h-8 text-green-600" />
                    <h1 className="text-3xl font-bold text-foreground">Google Sheets Data</h1>
                  </div>
                  <p className="text-muted-foreground/70">Marketing data for {campaign.name}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Auto-refreshing hourly
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={sheetsLoading}
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${sheetsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {sheetsData?.spreadsheetId && !isCombinedView && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(`https://docs.google.com/spreadsheets/d/${sheetsData.spreadsheetId}/edit`, '_blank');
                    }}
                    size="sm"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Open in Sheets
                  </Button>
                )}
              </div>
            </div>

            {/* Sheet Selector and Active Sheet Indicator */}
            {googleSheetsConnections.length > 0 && (
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground/80/60 whitespace-nowrap">
                    View Data From:
                  </label>
                  <Select
                    value={(() => {
                      if (isCombinedView) return 'combined';
                      if (activeSpreadsheetId && activeSpreadsheetId !== 'combined') {
                        // Parse activeSpreadsheetId to verify it exists
                        const [spreadsheetId, identifier] = activeSpreadsheetId.includes(':') 
                          ? activeSpreadsheetId.split(':') 
                          : [activeSpreadsheetId, null];
                        const exists = googleSheetsConnections.some((conn: any) => 
                          conn.spreadsheetId === spreadsheetId && 
                          (identifier === null || conn.sheetName === identifier || conn.id === identifier)
                        );
                        if (exists) return activeSpreadsheetId;
                      }
                      // Default to first connection if available
                      const defaultConn = googleSheetsConnections[0];
                      if (defaultConn) {
                        return defaultConn.sheetName 
                          ? `${defaultConn.spreadsheetId}:${defaultConn.sheetName}`
                          : `${defaultConn.spreadsheetId}:${defaultConn.id}`;
                      }
                      return '';
                    })()}
                    onValueChange={handleSheetChange}
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select a sheet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {googleSheetsConnections.map((conn: any, index: number) => {
                        // Check if multiple tabs from same spreadsheet exist
                        const connectionsFromSameSpreadsheet = googleSheetsConnections.filter(
                          (c: any) => c.spreadsheetId === conn.spreadsheetId
                        );
                        const hasMultipleTabsFromSameSpreadsheet = connectionsFromSameSpreadsheet.length > 1;
                        
                        let displayName: string;
                        if (hasMultipleTabsFromSameSpreadsheet) {
                          // When multiple tabs exist, always show something to distinguish them
                          if (conn.sheetName) {
                            // Show tab name first and prominently
                            displayName = `${conn.sheetName} - ${conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`}`;
                          } else {
                            // No sheetName, use connection index or ID to distinguish
                            const tabIndex = connectionsFromSameSpreadsheet.findIndex((c: any) => c.id === conn.id) + 1;
                            displayName = `${conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`} (Tab ${tabIndex})`;
                          }
                        } else {
                          // Single tab from this spreadsheet
                          if (conn.sheetName) {
                            displayName = `${conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`} (${conn.sheetName})`;
                          } else {
                            displayName = conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`;
                          }
                        }
                        
                        return (
                          <SelectItem key={conn.id} value={`${conn.spreadsheetId}${conn.sheetName ? `:${conn.sheetName}` : `:${conn.id}`}`}>
                            <div className="flex items-center gap-2 w-full">
                              <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                              <span className="flex-1 truncate">{displayName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Sheet Indicator */}
                {sheetsData && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Badge variant="outline" className="text-xs">
                      {isCombinedView ? (
                        <>
                          <FileSpreadsheet className="w-3 h-3 mr-1" />
                          Viewing: All Sheets (Combined)
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-3 h-3 mr-1" />
                          Active: {(() => {
                          // Parse activeSpreadsheetId to find the correct connection
                          const [spreadsheetId, identifier] = activeSpreadsheetId?.includes(':') 
                            ? activeSpreadsheetId.split(':') 
                            : [activeSpreadsheetId, null];
                          const activeConn = googleSheetsConnections.find((conn: any) => 
                            conn.spreadsheetId === spreadsheetId && 
                            (identifier === null || conn.sheetName === identifier || conn.id === identifier)
                          );
                          if (!activeConn) return 'Unknown';
                          
                          // Show tab name prominently if multiple tabs from same spreadsheet
                          const connectionsFromSameSpreadsheet = googleSheetsConnections.filter(
                            (c: any) => c.spreadsheetId === activeConn.spreadsheetId
                          );
                          const hasMultipleTabs = connectionsFromSameSpreadsheet.length > 1;
                          
                          if (hasMultipleTabs) {
                            if (activeConn.sheetName) {
                              return `${activeConn.sheetName} - ${activeConn.spreadsheetName || 'Sheet'}`;
                            } else {
                              const tabIndex = connectionsFromSameSpreadsheet.findIndex((c: any) => c.id === activeConn.id) + 1;
                              return `${activeConn.spreadsheetName || 'Sheet'} (Tab ${tabIndex})`;
                            }
                          } else {
                            if (activeConn.sheetName) {
                              return `${activeConn.spreadsheetName || 'Sheet'} (${activeConn.sheetName})`;
                            }
                            return activeConn.spreadsheetName || 'Sheet';
                          }
                          })()}
                        </>
                      )}
                    </Badge>
                    {sheetsData.filteredRows !== undefined && sheetsData.totalRows !== undefined && (
                      <span className="text-xs">
                        • {sheetsData.filteredRows.toLocaleString()} rows used for summary
                        {sheetsData.filteredRows < sheetsData.totalRows && (
                          <span className="text-muted-foreground"> (filtered from {sheetsData.totalRows.toLocaleString()} total)</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {sheetsError ? (
            <Card className="mb-8">
              <CardContent className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load Data</h3>
                <p className="text-muted-foreground/70 mb-4">
                  {sheetsError.message.includes('TOKEN_EXPIRED') || sheetsError.message.includes('401') || (sheetsError as any)?.requiresReauthorization
                    ? 'Your Google Sheets connection has expired. Please reconnect to continue accessing your data.'
                    : sheetsError.message.includes('MISSING_SPREADSHEET') || sheetsError.message.includes('no spreadsheet')
                    ? 'Google Sheets connection exists but no spreadsheet is selected. Please go to the campaign settings and select a spreadsheet.'
                    : (sheetsError as any)?.isNetworkError
                    ? `Network error: ${sheetsError.message}. The server may be restarting or unavailable. Please try again in a moment.`
                    : sheetsError.message || 'Failed to fetch Google Sheets data'}
                </p>
                <div className="flex gap-3 justify-center">
                  {sheetsError.message.includes('TOKEN_EXPIRED') || sheetsError.message.includes('401') || (sheetsError as any)?.requiresReauthorization ? (
                    <Link href={`/campaigns/${campaignId}`}>
                      <Button>
                        Reconnect Google Sheets
                      </Button>
                    </Link>
                  ) : sheetsError.message.includes('MISSING_SPREADSHEET') || sheetsError.message.includes('no spreadsheet') ? (
                    <Link href={`/campaigns/${campaignId}`}>
                      <Button>
                        Select Spreadsheet
                      </Button>
                    </Link>
                  ) : (
                    <Button onClick={() => refetch()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : isDataLoading ? (
            // Show loading state with tabs structure while data is being fetched
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
                ))}
              </div>
              <Tabs defaultValue="data" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="data">Overview</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                  <TabsTrigger value="connections">Connection Details</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Spreadsheet Data
                      </CardTitle>
                      <CardDescription>Loading data from Google Sheets...</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : sheetsData ? (
            <div className="relative">
              {/* Subtle loading indicator - non-blocking */}
              {sheetsFetching && (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-card rounded-lg px-3 py-2 shadow-lg border border-border animate-in fade-in slide-in-from-top-2 duration-200">
                  <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                  <span className="text-sm text-muted-foreground/60">Loading...</span>
                </div>
              )}
              <div className="transition-opacity duration-300 ease-in-out" style={{ opacity: sheetsFetching ? 0.7 : 1 }}>
                <Tabs defaultValue="data" className="space-y-6">
                {/* Warnings */}
                {sheetsData.rowLimitWarning && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {sheetsData.rowLimitWarning}
                  </div>
                )}
                {sheetsData.failedSheets && sheetsData.failedSheets.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{sheetsData.failedSheets.length} sheet(s) failed to load:</span>
                      <ul className="mt-1 list-disc list-inside">
                        {sheetsData.failedSheets.map((f, i) => (
                          <li key={i}>{f.spreadsheetName}{f.sheetName ? ` (${f.sheetName})` : ''} — {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <TabsList>
                  <TabsTrigger value="data">Overview</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                  <TabsTrigger value="connections">Connection Details</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Spreadsheet Data
                      </CardTitle>
                      <CardDescription className="flex items-center justify-between">
                        <span>
                          {sheetsData.totalRows} rows • Last updated {new Date(sheetsData.lastUpdated).toLocaleString()}
                          {sheetsData.lastDataRefreshAt && (
                            <span className="ml-2 text-xs text-muted-foreground/70">
                              (cached {new Date(sheetsData.lastDataRefreshAt).toLocaleString()})
                            </span>
                          )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshDataMutation.mutate()}
                          disabled={refreshDataMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
                          {refreshDataMutation.isPending ? 'Refreshing...' : 'Refresh Now'}
                        </Button>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {sheetsData.data && sheetsData.data.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                          <div className="overflow-x-auto">
                            <table className="w-full caption-bottom text-sm">
                              <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50">
                                  {sheetsData.headers?.map((header, index) => (
                                    <th key={index} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground font-semibold">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="[&_tr:last-child]:border-0">
                                {sheetsData.data.map((row, rowIndex) => (
                                  <tr key={rowIndex} className="border-b transition-colors hover:bg-muted/50">
                                    {row.map((cell, cellIndex) => (
                                      <td key={cellIndex} className="p-4 align-middle font-mono text-sm">
                                        {cell || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                          <p className="text-muted-foreground/70">No data available</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            {sheetsData.totalRows > 0 
                              ? `${sheetsData.totalRows} rows found but no data to display`
                              : 'No rows found in the spreadsheet'
                            }
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ═══ SUMMARY TAB ═══ */}
                <TabsContent value="summary" className="mt-6">
                  <div className="space-y-6">
                    {(() => {
                      // Build sections: one per sheet (combined) or one for the single sheet
                      const sections = isCombinedView && sheetsData?.sheetBreakdown && sheetsData.sheetBreakdown.length > 0
                        ? sheetsData.sheetBreakdown.map((sheet: any) => ({
                            key: `${sheet.spreadsheetId}-${sheet.sheetName}`,
                            name: sheet.spreadsheetName && sheet.sheetName && sheet.spreadsheetName !== sheet.sheetName
                              ? `${sheet.spreadsheetName} — ${sheet.sheetName}`
                              : sheet.sheetName || sheet.spreadsheetName || 'Unnamed Sheet',
                            rowCount: sheet.rowCount,
                            detectedColumns: sheet.detectedColumns || [],
                            categoricalColumns: sheet.categoricalColumns || [],
                          }))
                        : sheetsData?.summary?.detectedColumns && sheetsData.summary.detectedColumns.length > 0
                          ? [{
                              key: 'single',
                              name: (sheetsData as any).sheetName && sheetsData.spreadsheetName && (sheetsData as any).sheetName !== sheetsData.spreadsheetName
                                ? `${sheetsData.spreadsheetName} — ${(sheetsData as any).sheetName}`
                                : sheetsData.spreadsheetName || 'Sheet',
                              rowCount: sheetsData.filteredRows || sheetsData.totalRows,
                              detectedColumns: sheetsData.summary.detectedColumns,
                              categoricalColumns: (sheetsData.summary as any).categoricalColumns || [],
                            }]
                          : [];

                      if (sections.length === 0) {
                        return (
                          <Card>
                            <CardContent className="py-12">
                              <div className="text-center">
                                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                                <p className="text-muted-foreground/70">No numeric columns detected</p>
                                <p className="text-sm text-muted-foreground mt-1">Map columns in Connection Details to see metrics here</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      return sections.map((section) => {
                        const { hero, supporting } = classifyColumns(section.detectedColumns);

                        return (
                          <Card key={section.key}>
                            <CardHeader className="pb-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                    {section.name}
                                  </CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {(section.rowCount || 0).toLocaleString()} rows
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {section.detectedColumns.length} metrics
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {/* Hero Metrics */}
                              {hero.length > 0 && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                  {hero.map((col) => {
                                    const IconComp = getSummaryIcon(col.name);
                                    return (
                                      <div
                                        key={col.name}
                                        className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-5"
                                      >
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                            <IconComp className="w-5 h-5 text-muted-foreground/60" />
                                          </div>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground tracking-tight">
                                          {formatSummaryValue(col.total, col.type, col.name)}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70 mt-1 truncate" title={col.name}>
                                          {col.name}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Supporting Metrics */}
                              {supporting.length > 0 && (
                                <>
                                  {hero.length > 0 && (
                                    <div className="border-t border-slate-100 mb-4" />
                                  )}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                    {supporting.map((col) => (
                                      <div
                                        key={col.name}
                                        className="rounded-lg bg-muted/50 px-3 py-2.5 border border-slate-100/50"
                                      >
                                        <p className="text-[11px] text-muted-foreground/70 truncate mb-0.5" title={col.name}>
                                          {col.name}
                                        </p>
                                        <p className="text-sm font-semibold text-foreground dark:text-slate-200">
                                          {formatSummaryValue(col.total, col.type, col.name)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              {/* Data Breakdown — categorical columns */}
                              {section.categoricalColumns && section.categoricalColumns.length > 0 && (
                                <>
                                  <div className="border-t border-slate-100 mt-6 mb-4" />
                                  <div className="mb-2">
                                    <p className="text-sm font-semibold text-foreground/80/60">Data Breakdown</p>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {section.categoricalColumns.map((cat: any) => {
                                      const maxCount = cat.topValues[0]?.count || 1;
                                      return (
                                        <div key={cat.name} className="rounded-lg border border-border bg-card/50 p-4">
                                          <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-medium text-foreground dark:text-slate-200">{cat.name}</p>
                                            <Badge variant="outline" className="text-[10px]">
                                              {cat.uniqueCount} unique
                                            </Badge>
                                          </div>
                                          <div className="space-y-2">
                                            {cat.topValues.slice(0, 8).map((v: any) => (
                                              <div key={v.value}>
                                                <div className="flex items-center justify-between text-xs mb-0.5">
                                                  <span className="text-foreground/80/60 truncate mr-2 max-w-[60%]" title={v.value}>
                                                    {v.value}
                                                  </span>
                                                  <span className="text-muted-foreground/70 whitespace-nowrap">
                                                    {v.count.toLocaleString()} <span className="text-muted-foreground/70">({v.percentage}%)</span>
                                                  </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                  <div
                                                    className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                                                    style={{ width: `${Math.round((v.count / maxCount) * 100)}%` }}
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                            {cat.topValues.length > 8 && (
                                              <p className="text-[11px] text-muted-foreground/70 pt-1">
                                                +{cat.topValues.length - 8} more
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}

                              {/* Edge case: no metrics at all */}
                              {hero.length === 0 && supporting.length === 0 && (!section.categoricalColumns || section.categoricalColumns.length === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No data detected in this sheet
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      });
                    })()}
                  </div>
                </TabsContent>

                {/* ═══ KPIs TAB ═══ */}
                <TabsContent value="kpis" className="mt-6 space-y-6">
                  {kpisLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-32 bg-muted rounded"></div>
                      <div className="h-64 bg-muted rounded"></div>
                    </div>
                  ) : kpisIsError ? (
                    <Card>
                      <CardContent className="text-center py-12">
                        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load KPIs</h3>
                        <p className="text-muted-foreground/70 mb-4">{(kpisError as any)?.message || "An error occurred."}</p>
                        <Button variant="outline" onClick={() => void refetchKpis()}>Retry</Button>
                      </CardContent>
                    </Card>
                  ) : kpisData && (kpisData as any[]).length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Key Performance Indicators</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Track your KPI targets against your Google Sheets data
                          </p>
                        </div>
                        <Button onClick={() => setIsKpiModalOpen(true)} variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add KPI
                        </Button>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        {(kpisData as any[]).map((kpi: any) => {
                          const currentVal = sheetsData?.summary?.metrics?.[kpi.metric || kpi.metricKey] ?? parseFloat(kpi.currentValue || '0');
                          const targetVal = parseFloat(kpi.targetValue || '0');
                          const pct = targetVal > 0 ? Math.min((currentVal / targetVal) * 100, 100) : 0;
                          const col = sheetsData?.summary?.detectedColumns?.find((c: any) => c.name === (kpi.metric || kpi.metricKey));
                          return (
                            <Card key={kpi.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                      {kpi.metric && (
                                        <Badge variant="outline" className="bg-muted text-foreground/80/60 font-mono text-xs">
                                          {kpi.metric}
                                        </Badge>
                                      )}
                                      {kpi.alertsEnabled && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                    </div>
                                    {kpi.description && (
                                      <CardDescription className="text-sm">{kpi.description}</CardDescription>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingKpi(kpi);
                                        setKpiForm({
                                          name: kpi.name || "", unit: kpi.unit || "", description: kpi.description || "",
                                          metric: kpi.metric || kpi.metricKey || "", targetValue: String(kpi.targetValue || ""),
                                          currentValue: String(currentVal), priority: kpi.priority || "high",
                                          status: kpi.status || "active", timeframe: kpi.timeframe || "monthly",
                                          alertsEnabled: !!kpi.alertsEnabled, emailNotifications: !!kpi.emailNotifications,
                                          alertFrequency: kpi.alertFrequency || "daily",
                                          alertThreshold: kpi.alertThreshold ? String(kpi.alertThreshold) : "",
                                          alertCondition: kpi.alertCondition || "below",
                                          emailRecipients: Array.isArray(kpi.emailRecipients) ? kpi.emailRecipients.join(', ') : (kpi.emailRecipients || ""),
                                        });
                                        setIsKpiModalOpen(true);
                                      }}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                                          <AlertDialogDescription>Are you sure you want to delete "{kpi.name}"? This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteKpiMutation.mutate(kpi.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground/70">Current: <span className="font-semibold text-foreground">{formatMetricValue(currentVal, col?.type)}</span></span>
                                    <span className="text-muted-foreground/70">Target: <span className="font-semibold text-foreground">{formatMetricValue(targetVal, col?.type)}{kpi.unit ? ` ${kpi.unit}` : ''}</span></span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">{pct.toFixed(1)}% of target</span>
                                    <Badge variant="outline" className={pct >= 100 ? 'bg-green-50 text-green-700 border-green-200' : pct >= 75 ? 'bg-blue-50 text-blue-700 border-blue-200' : pct >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                      {pct >= 100 ? 'On Target' : pct >= 75 ? 'Near Target' : pct >= 50 ? 'Below Target' : 'At Risk'}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <Target className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No KPIs Yet</h3>
                        <p className="text-muted-foreground/70 mb-4">
                          Set targets and track KPIs based on your Google Sheets metrics.
                        </p>
                        <Button onClick={() => setIsKpiModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First KPI
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ═══ BENCHMARKS TAB ═══ */}
                <TabsContent value="benchmarks" className="mt-6 space-y-6">
                  {benchmarksLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-32 bg-muted rounded"></div>
                      <div className="h-64 bg-muted rounded"></div>
                    </div>
                  ) : benchmarksIsError ? (
                    <Card>
                      <CardContent className="text-center py-12">
                        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load Benchmarks</h3>
                        <p className="text-muted-foreground/70 mb-4">{(benchmarksError as any)?.message || "An error occurred."}</p>
                        <Button variant="outline" onClick={() => void refetchBenchmarks()}>Retry</Button>
                      </CardContent>
                    </Card>
                  ) : benchmarksData && (benchmarksData as any[]).length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Benchmarks</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Compare your actual metrics against custom benchmark values
                          </p>
                        </div>
                        <Button onClick={() => setIsBenchmarkModalOpen(true)} variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Benchmark
                        </Button>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        {(benchmarksData as any[]).map((bm: any) => {
                          const currentVal = sheetsData?.summary?.metrics?.[bm.metric || bm.metricKey] ?? parseFloat(bm.currentValue || '0');
                          const benchmarkVal = parseFloat(bm.benchmarkValue || '0');
                          const variance = benchmarkVal > 0 ? ((currentVal - benchmarkVal) / benchmarkVal) * 100 : 0;
                          const isAbove = currentVal >= benchmarkVal;
                          const col = sheetsData?.summary?.detectedColumns?.find((c: any) => c.name === (bm.metric || bm.metricKey));
                          return (
                            <Card key={bm.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CardTitle className="text-lg">{bm.name}</CardTitle>
                                      {bm.metric && (
                                        <Badge variant="outline" className="bg-muted text-foreground/80/60 font-mono text-xs">
                                          {bm.metric}
                                        </Badge>
                                      )}
                                    </div>
                                    {bm.description && (
                                      <CardDescription className="text-sm">{bm.description}</CardDescription>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingBenchmark(bm);
                                        setBenchmarkForm({
                                          name: bm.name || "", unit: bm.unit || "", description: bm.description || "",
                                          metric: bm.metric || bm.metricKey || "",
                                          benchmarkValue: String(bm.benchmarkValue || ""),
                                          currentValue: String(currentVal),
                                          alertsEnabled: !!bm.alertsEnabled, emailNotifications: !!bm.emailNotifications,
                                          alertFrequency: bm.alertFrequency || "daily",
                                          alertThreshold: bm.alertThreshold ? String(bm.alertThreshold) : "",
                                          alertCondition: bm.alertCondition || "below",
                                          emailRecipients: Array.isArray(bm.emailRecipients) ? bm.emailRecipients.join(', ') : (bm.emailRecipients || ""),
                                        });
                                        setIsBenchmarkModalOpen(true);
                                      }}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                          <AlertDialogDescription>Are you sure you want to delete "{bm.name}"? This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteBenchmarkMutation.mutate(bm.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                      <p className="text-xs text-muted-foreground/70 mb-1">Actual</p>
                                      <p className="text-lg font-semibold text-foreground">{formatMetricValue(currentVal, col?.type)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground/70 mb-1">Benchmark</p>
                                      <p className="text-lg font-semibold text-foreground">{formatMetricValue(benchmarkVal, col?.type)}{bm.unit ? ` ${bm.unit}` : ''}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground/70 mb-1">Variance</p>
                                      <p className={`text-lg font-semibold ${isAbove ? 'text-green-600' : 'text-red-600'}`}>
                                        {isAbove ? '+' : ''}{variance.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex justify-center">
                                    <Badge variant="outline" className={isAbove ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                      {isAbove ? 'Above Benchmark' : 'Below Benchmark'}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Benchmarks Yet</h3>
                        <p className="text-muted-foreground/70 mb-4">
                          Compare your Google Sheets metrics against custom benchmark values.
                        </p>
                        <Button onClick={() => setIsBenchmarkModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Benchmark
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ═══ INSIGHTS TAB ═══ */}
                <TabsContent value="insights" className="mt-6">
                  {isCombinedView ? (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Insights</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Overview across all connected sheets. Select an individual sheet for detailed analysis.
                        </p>
                      </div>

                      {sheetsData?.sheetBreakdown && sheetsData.sheetBreakdown.length > 0 ? (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              Data Quality Across Sheets
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {sheetsData.sheetBreakdown.map((sheet: any, idx: number) => {
                                const sheetLabel = sheet.spreadsheetName && sheet.sheetName && sheet.spreadsheetName !== sheet.sheetName
                                  ? `${sheet.spreadsheetName} — ${sheet.sheetName}`
                                  : sheet.sheetName || sheet.spreadsheetName || 'Sheet';
                                const colCount = sheet.detectedColumns?.length || 0;
                                return (
                                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground truncate">{sheetLabel}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{sheet.rowCount?.toLocaleString() || 0} rows, {colCount} metrics detected</p>
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {sheet.rowCount > 0 ? 'Active' : 'Empty'}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                              Select a specific sheet from the dropdown above to see detailed insights, trend charts, and recommendations.
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className="text-center py-12">
                            <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Sheets Connected</h3>
                            <p className="text-muted-foreground/70">
                              Connect Google Sheets to generate insights.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : sheetsData?.insights ? (
                    <div className="space-y-6">
                      {/* Header */}
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Insights</h2>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Actionable insights from statistical analysis of your sheet data.
                        </p>
                      </div>

                      {/* Summary Cards */}
                      {sheetsData.insights.summary && (
                        <div className="grid grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="p-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground/70">Total insights</p>
                                  <p className="text-2xl font-bold text-foreground">{sheetsData.insights.summary.total}</p>
                                </div>
                                <BarChart3 className="w-7 h-7 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground/70">High priority</p>
                                  <p className="text-2xl font-bold text-red-600">{sheetsData.insights.summary.high}</p>
                                </div>
                                <AlertTriangle className="w-7 h-7 text-red-600" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground/70">Needs attention</p>
                                  <p className="text-2xl font-bold text-amber-600">{sheetsData.insights.summary.medium}</p>
                                </div>
                                <TrendingDown className="w-7 h-7 text-amber-600" />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Data Context Metadata + Data Quality */}
                      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground/70">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <div><span className="font-medium text-foreground/80/60">Data points:</span> {sheetsData.insights.totalDataPoints?.toLocaleString() || 0}</div>
                          {sheetsData.insights.dateRange && (
                            <div><span className="font-medium text-foreground/80/60">Date range:</span> {sheetsData.insights.dateRange.start} to {sheetsData.insights.dateRange.end}</div>
                          )}
                          <div><span className="font-medium text-foreground/80/60">Metrics analyzed:</span> {sheetsData.insights.trendMetrics?.length || 0}</div>
                          {sheetsData.insights.labelColumn && (
                            <div><span className="font-medium text-foreground/80/60">Grouped by:</span> {sheetsData.insights.labelColumn}</div>
                          )}
                          {sheetsData.insights.dataQuality && (
                            <>
                              <div>
                                <span className="font-medium text-foreground/80/60">Completeness:</span>{' '}
                                <span className={sheetsData.insights.dataQuality.completeness >= 95 ? 'text-green-600' : sheetsData.insights.dataQuality.completeness >= 80 ? 'text-amber-600' : 'text-red-600'}>
                                  {sheetsData.insights.dataQuality.completeness}%
                                </span>
                              </div>
                              {sheetsData.insights.dataQuality.outliers?.length > 0 && (
                                <div><span className="font-medium text-foreground/80/60">Outliers:</span> {sheetsData.insights.dataQuality.outliers.length}</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Trend Chart */}
                      {sheetsData.insights.trendSeries?.length >= 2 && sheetsData.insights.trendMetrics?.length > 0 && (
                        <Card className="border-border">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <CardTitle>Trends</CardTitle>
                                <CardDescription>
                                  {sheetsData.insights.dateColumn ? `Daily averages by ${sheetsData.insights.dateColumn}` : 'Metric trends over time'}
                                </CardDescription>
                              </div>
                              <div className="min-w-[220px]">
                                <Select
                                  value={gsInsightsTrendMetric || sheetsData.insights.trendMetrics[0]}
                                  onValueChange={(v: string) => setGsInsightsTrendMetric(v)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select metric" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sheetsData.insights.trendMetrics.map((m: string) => (
                                      <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[280px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={sheetsData.insights.trendSeries}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                  />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Line
                                    type="monotone"
                                    dataKey={gsInsightsTrendMetric || sheetsData.insights.trendMetrics[0]}
                                    stroke="#7c3aed"
                                    strokeWidth={2}
                                    dot={false}
                                    name={gsInsightsTrendMetric || sheetsData.insights.trendMetrics[0]}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Performance Insights */}
                      {(sheetsData.insights.topPerformers?.length > 0 || sheetsData.insights.bottomPerformers?.length > 0) && (
                        <Card className="border-border">
                          <CardHeader>
                            <CardTitle>Performance</CardTitle>
                            <CardDescription>Top and bottom performers across your metrics</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {sheetsData.insights.topPerformers?.map((insight: any, i: number) => {
                              const severityClass = insight.severity === 'high'
                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                : insight.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900';
                              return (
                                <div key={`top-${i}`} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                                        <span className="font-semibold text-foreground">{insight.message}</span>
                                        <Badge className={`text-xs border ${severityClass}`}>
                                          {insight.severity === 'high' ? 'High' : insight.severity === 'medium' ? 'Medium' : 'Low'}
                                        </Badge>
                                        {insight.confidence && (
                                          <Badge className={`text-xs border ${
                                            insight.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900' :
                                            'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900'
                                          }`}>
                                            Confidence: {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
                                          </Badge>
                                        )}
                                      </div>
                                      {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                        <div className="text-xs text-muted-foreground/70 mt-2">
                                          <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                          {insight.evidence.join(' \u2022 ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {sheetsData.insights.bottomPerformers?.map((insight: any, i: number) => {
                              const severityClass = insight.severity === 'high'
                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                : insight.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                  : 'bg-muted text-foreground border-border dark:text-slate-200';
                              return (
                                <div key={`bottom-${i}`} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
                                        <span className="font-semibold text-foreground">{insight.message}</span>
                                        <Badge className={`text-xs border ${severityClass}`}>
                                          {insight.severity === 'high' ? 'High' : insight.severity === 'medium' ? 'Medium' : 'Low'}
                                        </Badge>
                                      </div>
                                      {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                        <div className="text-xs text-muted-foreground/70 mt-2">
                                          <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                          {insight.evidence.join(' \u2022 ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}

                      {/* Anomalies & Trends */}
                      {(sheetsData.insights.anomalies?.length > 0 || sheetsData.insights.trends?.length > 0) && (
                        <Card className="border-border">
                          <CardHeader>
                            <CardTitle>Anomalies & Trends</CardTitle>
                            <CardDescription>Statistical outliers and directional changes in your data</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {sheetsData.insights.trends?.map((insight: any, i: number) => {
                              const severityClass = insight.severity === 'high'
                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                : insight.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                  : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900';
                              return (
                                <div key={`trend-${i}`} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {insight.direction === 'increasing' ? (
                                          <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                                        ) : (
                                          <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
                                        )}
                                        <span className="font-semibold text-foreground">{insight.message}</span>
                                        <Badge className={`text-xs border ${severityClass}`}>
                                          {insight.severity === 'high' ? 'High' : insight.severity === 'medium' ? 'Medium' : 'Low'}
                                        </Badge>
                                        {insight.confidence && (
                                          <Badge className={`text-xs border ${
                                            insight.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900' :
                                            'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900'
                                          }`}>
                                            Confidence: {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
                                          </Badge>
                                        )}
                                      </div>
                                      {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                        <div className="text-xs text-muted-foreground/70 mt-2">
                                          <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                          {insight.evidence.join(' \u2022 ')}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant={insight.direction === 'increasing' ? 'default' : 'destructive'} className="text-xs shrink-0">
                                      {insight.direction === 'increasing' ? '+' : '-'}{insight.percentChange?.toFixed(1)}%
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                            {sheetsData.insights.anomalies?.map((insight: any, i: number) => {
                              const severityClass = insight.severity === 'high'
                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900';
                              return (
                                <div key={`anomaly-${i}`} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span className="font-semibold text-foreground">{insight.message}</span>
                                        <Badge className={`text-xs border ${severityClass}`}>
                                          {insight.severity === 'high' ? 'High' : 'Medium'}
                                        </Badge>
                                      </div>
                                      {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                        <div className="text-xs text-muted-foreground/70 mt-2">
                                          <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                          {insight.evidence.join(' \u2022 ')}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400 shrink-0">
                                      {insight.deviation?.toFixed(1)}x {insight.direction}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}

                      {/* Correlations */}
                      {sheetsData.insights.correlations?.length > 0 && (
                        <Card className="border-border">
                          <CardHeader>
                            <CardTitle>Correlations</CardTitle>
                            <CardDescription>Statistically significant relationships between metrics</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {sheetsData.insights.correlations.map((insight: any, i: number) => (
                              <div key={`corr-${i}`} className="rounded-lg border border-border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Target className="w-4 h-4 text-purple-600 shrink-0" />
                                      <span className="font-semibold text-foreground">{insight.message}</span>
                                      {insight.confidence && (
                                        <Badge className={`text-xs border ${
                                          insight.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900' :
                                          'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900'
                                        }`}>
                                          Confidence: {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
                                        </Badge>
                                      )}
                                    </div>
                                    {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
                                      <div className="text-xs text-muted-foreground/70 mt-2">
                                        <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                        {insight.evidence.join(' \u2022 ')}
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className={`text-xs shrink-0 ${
                                    insight.strength === 'strong' ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'
                                  }`}>
                                    {insight.strength} (r={insight.correlation?.toFixed(2)})
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* Recommendations */}
                      {sheetsData.insights.recommendations?.length > 0 && (
                        <Card className="border-border">
                          <CardHeader>
                            <CardTitle>What to do next</CardTitle>
                            <CardDescription>Actionable recommendations based on the analysis above</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {sheetsData.insights.recommendations.map((r: any, i: number) => {
                              const severityClass = r.severity === 'high'
                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                : r.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                  : 'bg-muted text-foreground border-border dark:text-slate-200';
                              return (
                                <div key={`rec-${i}`} className="rounded-lg border border-border p-4">
                                  <div className="flex items-start gap-3">
                                    <Badge className={`text-xs border shrink-0 ${severityClass}`}>
                                      {r.priority === 'high' ? 'High' : r.priority === 'medium' ? 'Medium' : 'Low'}
                                    </Badge>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">{r.message}</p>
                                      <p className="text-sm text-foreground/80/60 mt-1">
                                        <span className="font-medium">Next step:</span> {r.action}
                                      </p>
                                      {Array.isArray(r.evidence) && r.evidence.length > 0 && (
                                        <div className="text-xs text-muted-foreground/70 mt-2">
                                          <span className="font-medium text-foreground/80/60">Evidence:</span>{' '}
                                          {r.evidence.join(' \u2022 ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}

                      {/* KPI & Benchmark Gap Analysis */}
                      {(() => {
                        const kpiList = Array.isArray(kpisData) ? kpisData : [];
                        const bmList = Array.isArray(benchmarksData) ? benchmarksData : [];
                        const atRiskKpis = kpiList.filter((k: any) => k.status === 'at_risk' || k.status === 'critical');
                        const missedBenchmarks = bmList.filter((b: any) => {
                          const current = parseFloat(String(b.currentValue || '0'));
                          const target = parseFloat(String(b.targetValue || '0'));
                          return target > 0 && current < target;
                        });

                        if (atRiskKpis.length === 0 && missedBenchmarks.length === 0) return null;

                        return (
                          <Card className="border-border">
                            <CardHeader>
                              <CardTitle>Goal Impact</CardTitle>
                              <CardDescription>KPIs and Benchmarks that need attention</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-4 md:grid-cols-2">
                                {atRiskKpis.length > 0 && (
                                  <div className="rounded-md border border-border p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-sm font-semibold text-foreground">KPI Gaps</div>
                                      <Badge variant="outline" className="text-xs">{atRiskKpis.length}</Badge>
                                    </div>
                                    <div className="space-y-2">
                                      {atRiskKpis.slice(0, 5).map((k: any) => {
                                        const current = parseFloat(String(k.currentValue || '0'));
                                        const target = parseFloat(String(k.targetValue || '0'));
                                        const gapPct = target > 0 ? ((current / target - 1) * 100) : 0;
                                        return (
                                          <div key={k.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                                              <p className="text-xs text-muted-foreground truncate">
                                                {k.metric || 'No metric'} {'\u2022'} Gap: {gapPct.toFixed(1)}%
                                              </p>
                                            </div>
                                            <Badge className={`text-xs border shrink-0 ${
                                              k.status === 'critical'
                                                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200'
                                                : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200'
                                            }`}>
                                              {k.status === 'critical' ? 'Critical' : 'At Risk'}
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {missedBenchmarks.length > 0 && (
                                  <div className="rounded-md border border-border p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-sm font-semibold text-foreground">Benchmark Gaps</div>
                                      <Badge variant="outline" className="text-xs">{missedBenchmarks.length}</Badge>
                                    </div>
                                    <div className="space-y-2">
                                      {missedBenchmarks.slice(0, 5).map((b: any) => {
                                        const current = parseFloat(String(b.currentValue || '0'));
                                        const target = parseFloat(String(b.targetValue || '0'));
                                        const gapPct = target > 0 ? ((current / target - 1) * 100) : 0;
                                        return (
                                          <div key={b.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                                              <p className="text-xs text-muted-foreground truncate">
                                                {b.metric || 'No metric'} {'\u2022'} Gap: {gapPct.toFixed(1)}%
                                              </p>
                                            </div>
                                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 shrink-0">
                                              Below target
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {/* Empty state when no insights */}
                      {(!sheetsData.insights.summary || sheetsData.insights.summary.total === 0) && (
                        <Card>
                          <CardContent className="text-center py-12">
                            <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Insights Yet</h3>
                            <p className="text-muted-foreground/70">
                              Add more data to your sheet to generate insights. At least 10 data points are needed for trend and anomaly detection.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Insights Available</h3>
                        <p className="text-muted-foreground/70">
                          Insights will appear here once your sheet data is analyzed.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ═══ REPORTS TAB ═══ */}
                <TabsContent value="reports" className="mt-6 space-y-6">
                  {reportsLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-32 bg-muted rounded"></div>
                      <div className="h-64 bg-muted rounded"></div>
                    </div>
                  ) : reportsIsError ? (
                    <Card>
                      <CardContent className="text-center py-12">
                        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load Reports</h3>
                        <p className="text-muted-foreground/70 mb-4">{(reportsError as any)?.message || "An error occurred."}</p>
                        <Button variant="outline" onClick={() => void refetchReports()}>Retry</Button>
                      </CardContent>
                    </Card>
                  ) : reportsData && (reportsData as any[]).length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Schedule and generate reports from your Google Sheets data
                          </p>
                        </div>
                        <Button onClick={() => { setReportModalStep("standard"); setIsReportModalOpen(true); }} variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Report
                        </Button>
                      </div>

                      <div className="grid gap-4">
                        {(reportsData as any[]).map((report: any) => (
                          <Card key={report.id}>
                            <CardContent className="py-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-semibold text-foreground">{report.name}</h3>
                                    <Badge variant="outline" className="capitalize">{report.reportType || 'overview'}</Badge>
                                    {report.scheduleEnabled && (
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {report.scheduleFrequency}
                                      </Badge>
                                    )}
                                  </div>
                                  {report.description && (
                                    <p className="text-sm text-muted-foreground/70">{report.description}</p>
                                  )}
                                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground/70">
                                    {report.scheduleEnabled && report.scheduleRecipients && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.length : 0} recipient(s)
                                      </span>
                                    )}
                                    {report.createdAt && (
                                      <span>Created {new Date(report.createdAt).toLocaleDateString()}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingReportId(report.id);
                                      setReportForm({
                                        name: report.name || "", description: report.description || "",
                                        reportType: report.reportType || "overview",
                                        scheduleEnabled: !!report.scheduleEnabled,
                                        scheduleFrequency: report.scheduleFrequency || "weekly",
                                        scheduleDayOfWeek: report.scheduleDayOfWeek || "monday",
                                        scheduleDayOfMonth: report.scheduleDayOfMonth || "first",
                                        quarterTiming: report.quarterTiming || "end",
                                        scheduleTime: report.scheduleTime || "9:00 AM",
                                        emailRecipients: Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.join(', ') : "",
                                        status: report.status || "draft",
                                      });
                                      setReportModalStep(report.reportType === "custom" ? "custom" : "standard");
                                      if (report.configuration) {
                                        setCustomReportConfig(report.configuration);
                                      }
                                      setIsReportModalOpen(true);
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                        <AlertDialogDescription>Are you sure you want to delete "{report.name}"? This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteReportMutation.mutate(report.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Reports Yet</h3>
                        <p className="text-muted-foreground/70 mb-4">
                          Schedule and generate reports from your Google Sheets data.
                        </p>
                        <Button onClick={() => { setReportModalStep("standard"); setIsReportModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Report
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="connections" className="mt-6">
                  <div className="space-y-6">
                    {/* Connected Datasets */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Connected Datasets ({googleSheetsConnections.length}/{MAX_GOOGLE_SHEETS_CONNECTIONS})
                            </CardTitle>
                            <CardDescription>
                              Manage your Google Sheets connections
                            </CardDescription>
                          </div>
                          {canAddMoreSheets && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setShowAddDatasetModal(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Dataset
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {googleSheetsConnections.length === 0 ? (
                          <div className="text-center py-8">
                            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                            <p className="text-muted-foreground/70 mb-4">
                              No Google Sheets datasets connected yet.
                            </p>
                            <Button onClick={() => setShowAddDatasetModal(true)}>
                              <Plus className="w-4 h-4 mr-2" />
                              Add Dataset
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {googleSheetsConnections.map((conn: any) => {
                              return (
                                <Card
                                  key={conn.id}
                                  className="border-border"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium text-foreground truncate">
                                              {conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`}
                                            </h4>
                                          </div>
                                          <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground/70">
                                              {conn.spreadsheetId}
                                            </p>
                                            {conn.sheetName && (
                                              <p className="text-xs text-muted-foreground/60">
                                                Tab: <span className="font-medium">{conn.sheetName}</span>
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setMappingConnectionId(conn.id);
                                            setShowMappingInterface(true);
                                          }}
                                        >
                                          Edit Mappings
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-red-600"
                                              title="Remove connection"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Remove Google Sheet Connection?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will remove the connection to "{conn.spreadsheetName || conn.spreadsheetId}".
                                                {conn.isPrimary && googleSheetsConnections.length > 1 && " Another sheet will be set as primary."}
                                                This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => deleteConnectionMutation.mutate(conn.id)}
                                                className="bg-red-600 hover:bg-red-700"
                                                disabled={deleteConnectionMutation.isPending}
                                              >
                                                {deleteConnectionMutation.isPending ? "Removing..." : "Remove"}
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Data Available</h3>
                <p className="text-muted-foreground/70">Unable to load Google Sheets data for this campaign.</p>
              </CardContent>
            </Card>
          )}

          {/* Column Mapping Interface Dialog */}
          <Dialog open={showMappingInterface} onOpenChange={setShowMappingInterface}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Map Columns</DialogTitle>
                <DialogDescription>
                  Follow the guided steps to map your campaign identifier, revenue column, and optional platform filter.
                </DialogDescription>
              </DialogHeader>
              {showMappingInterface && mappingConnectionId && (() => {
                const selectedConnection = googleSheetsConnections.find((c: any) => c.id === mappingConnectionId);
                const spreadsheetId = selectedConnection?.spreadsheetId;
                const spreadsheetConnections = googleSheetsConnections.filter((c: any) => c.spreadsheetId === spreadsheetId);
                const sheetNames = spreadsheetConnections.map((c: any) => c.sheetName).filter(Boolean);
                const platform = campaign?.platform || "general";

                if (spreadsheetId) {
                  return (
                    <GuidedColumnMapping
                      campaignId={campaignId!}
                      connectionId={mappingConnectionId}
                      spreadsheetId={spreadsheetId}
                      sheetNames={sheetNames.length > 0 ? sheetNames : undefined}
                      platform={platform}
                      onMappingComplete={() => {
                        setShowMappingInterface(false);
                        setMappingConnectionId(null);
                        refetchConnections();
                        refetch();
                      }}
                      onCancel={() => {
                        setShowMappingInterface(false);
                        setMappingConnectionId(null);
                      }}
                    />
                  );
                }

                return (
                  <ColumnMappingInterface
                    campaignId={campaignId!}
                    connectionId={mappingConnectionId}
                    spreadsheetId={spreadsheetId}
                    platform={platform}
                    onMappingComplete={() => {
                      setShowMappingInterface(false);
                      setMappingConnectionId(null);
                      refetchConnections();
                      refetch();
                    }}
                    onCancel={() => {
                      setShowMappingInterface(false);
                      setMappingConnectionId(null);
                    }}
                  />
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Add Dataset Modal */}
          {showAddDatasetModal && campaignId && (
            <UploadAdditionalDataModal
              campaignId={campaignId}
              isOpen={showAddDatasetModal}
              onClose={() => setShowAddDatasetModal(false)}
              onDataConnected={() => {
                refetchConnections();
                refetch();
              }}
              returnUrl={window.location.pathname + window.location.search}
              googleSheetsOnly={true}
            />
          )}

          {/* ═══ KPI Modal ═══ */}
          <GoogleSheetsKpiModal
            isOpen={isKpiModalOpen}
            setIsOpen={setIsKpiModalOpen}
            editing={editingKpi}
            setEditing={setEditingKpi}
            form={kpiForm}
            setForm={setKpiForm}
            detectedColumns={sheetsData?.summary?.detectedColumns || []}
            metrics={sheetsData?.summary?.metrics || {}}
            toast={toast}
            handleCreate={handleCreateKpi}
          />

          {/* ═══ Benchmark Modal ═══ */}
          <GoogleSheetsBenchmarkModal
            isOpen={isBenchmarkModalOpen}
            setIsOpen={setIsBenchmarkModalOpen}
            editing={editingBenchmark}
            setEditing={setEditingBenchmark}
            form={benchmarkForm}
            setForm={setBenchmarkForm}
            detectedColumns={sheetsData?.summary?.detectedColumns || []}
            metrics={sheetsData?.summary?.metrics || {}}
            toast={toast}
            handleCreate={handleCreateBenchmark}
          />

          {/* ═══ Report Modal ═══ */}
          <GoogleSheetsReportModal
            isOpen={isReportModalOpen}
            setIsOpen={setIsReportModalOpen}
            modalStep={reportModalStep}
            setModalStep={setReportModalStep}
            editingId={editingReportId}
            setEditingId={setEditingReportId}
            form={reportForm}
            setForm={setReportForm}
            formErrors={reportFormErrors}
            setFormErrors={setReportFormErrors}
            customConfig={customReportConfig}
            setCustomConfig={setCustomReportConfig}
            detectedColumns={sheetsData?.summary?.detectedColumns || []}
            kpisData={kpisData}
            benchmarksData={benchmarksData}
            handleTypeSelect={handleReportTypeSelect}
            handleCreate={handleCreateReport}
            handleUpdate={handleUpdateReport}
            handleCustom={handleCustomReport}
            createMutation={createReportMutation}
            updateMutation={updateReportMutation}
          />
        </main>
      </div>
    </div>
  );
}

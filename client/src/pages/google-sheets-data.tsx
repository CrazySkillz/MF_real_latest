import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Calendar, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, CheckCircle2, XCircle, AlertCircle, Loader2, Star, Plus, Trash2, X, DollarSign, Eye, MousePointerClick, BarChart3, Hash, Percent } from "lucide-react";
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
import { useEffect, useState, useMemo, useCallback, useLayoutEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ColumnMappingInterface } from "@/components/ColumnMappingInterface";
import { GuidedColumnMapping } from "@/components/GuidedColumnMapping";
import { UploadAdditionalDataModal } from "@/components/UploadAdditionalDataModal";
import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";
import { AddSpendWizardModal } from "@/components/AddSpendWizardModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GoogleSheetsKpiModal } from "@/pages/google-sheets-analytics/GoogleSheetsKpiModal";
import { GoogleSheetsBenchmarkModal } from "@/pages/google-sheets-analytics/GoogleSheetsBenchmarkModal";
import { GoogleSheetsReportModal } from "@/pages/google-sheets-analytics/GoogleSheetsReportModal";
import { Edit2, Clock, Mail, Download, Pencil } from "lucide-react";
import { formatPct } from "@shared/metric-math";
import { computeAttainmentFillPct, computeAttainmentPct, computeEffectiveDeltaPct, classifyKpiBand, isLowerIsBetterKpi } from "@shared/kpi-math";

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
      count?: number;
      summaryValue?: number;
      aggregation?: string;
    }>;
    // Legacy fields for backward compatibility
    totalImpressions?: number;
    totalClicks?: number;
    totalSpend?: number;
    averageCTR?: number;
  };
  insights?: {
    summary?: {
      total: number;
      high: number;
      medium: number;
      low?: number;
    };
    totalDataPoints?: number;
    dateRange?: {
      start: string;
      end: string;
    };
    dateColumn?: string;
    labelColumn?: string;
    trendMetrics: string[];
    trendSeries: Array<Record<string, string | number | null>>;
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

type GoogleSheetsAnalysisSourceScope = {
  platform: "google_sheets";
  scopeType: "single";
  activeSpreadsheetId: string;
  connectionId: string | null;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  sheetName: string | null;
  displayName: string;
};

type GoogleSheetsKpiMetricOption = {
  key: string;
  label: string;
  type: 'currency' | 'integer' | 'decimal';
  unit: string;
  currentValue: number | null;
  available: boolean;
  reason: string;
  sourceLabel?: string;
  sourceKind?: "confirmed_financial" | "sheet_column";
};

const createEmptyGoogleSheetsReportForm = () => ({
  name: "",
  description: "",
  reportType: "",
  scheduleEnabled: false,
  scheduleFrequency: "daily",
  scheduleDayOfWeek: "monday",
  scheduleDayOfMonth: "first",
  quarterTiming: "end",
  scheduleTime: "9:00 AM",
  emailRecipients: "",
  status: "active",
});

const createEmptyGoogleSheetsCustomReportConfig = () => ({
  sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false },
  subsections: {
    overview: { metrics: false },
    kpis: { items: false },
    benchmarks: { items: false },
    ads: { unavailable: false },
    insights: { summary: false },
  },
  selectedMetrics: [],
  kpis: [],
  benchmarks: [],
  selectedKpiIds: [],
  selectedBenchmarkIds: [],
});

const parseGoogleSheetsReportConfiguration = (configuration: any) => {
  if (!configuration) return createEmptyGoogleSheetsCustomReportConfig();
  try {
    const parsed = typeof configuration === "string" ? JSON.parse(configuration) : configuration;
    return { ...createEmptyGoogleSheetsCustomReportConfig(), ...(parsed || {}) };
  } catch {
    return createEmptyGoogleSheetsCustomReportConfig();
  }
};

const serializeGoogleSheetsReportState = (form: any, customConfig: any, modalStep: string) =>
  JSON.stringify({ form, customConfig, modalStep });

const getGoogleSheetsConnectionValue = (conn: any): string => {
  const spreadsheetId = String(conn?.spreadsheetId || "").trim();
  const connectionId = String(conn?.id || "").trim();
  if (!spreadsheetId) return "";
  if (connectionId) return `${spreadsheetId}:${connectionId}`;
  return conn?.sheetName ? `${spreadsheetId}:${conn.sheetName}` : spreadsheetId;
};

const parseGoogleSheetsConnectionValue = (value: any): { spreadsheetId: string; identifier: string | null } => {
  const raw = String(value || "").trim();
  if (!raw) return { spreadsheetId: "", identifier: null };
  const [spreadsheetId, ...identifierParts] = raw.split(':');
  return { spreadsheetId, identifier: identifierParts.join(':') || null };
};

const GOOGLE_SHEETS_KPI_DATE_COLUMN_PATTERN = /^(date|week|day|time|timestamp|period|month|year)/i;
const GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN = /(\$|revenue|spend|cost|budget|profit|cpa|cpc|cpm)/i;
const GOOGLE_SHEETS_KPI_NEAR_TARGET_BAND_PCT = 5;

const parseRevenueSourceConfig = (source: any) => {
  try {
    return source?.mappingConfig ? JSON.parse(String(source.mappingConfig)) : {};
  } catch {
    return {};
  }
};

const revenueSourceTypeLabel = (sourceType: any) => {
  const value = String(sourceType || "").trim().toLowerCase();
  if (value === "google_sheets") return "Google Sheets";
  if (value === "hubspot") return "HubSpot";
  if (value === "salesforce") return "Salesforce";
  if (value === "shopify") return "Shopify";
  if (value === "csv") return "CSV";
  return value ? value.replace(/_/g, " ") : "Revenue Source";
};

const googleSheetsRevenueSourceLabel = (source: any) => {
  const cfg = parseRevenueSourceConfig(source);
  return String(source?.displayName || cfg?.sheetName || cfg?.spreadsheetName || revenueSourceTypeLabel(source?.sourceType));
};

const spendSourceTypeLabel = (sourceType: any) => {
  const value = String(sourceType || "").trim().toLowerCase();
  if (value === "google_sheets") return "Google Sheets";
  if (value === "csv") return "CSV";
  if (value === "manual") return "Manual";
  if (value === "linkedin_api") return "LinkedIn Ads";
  if (value === "meta_api") return "Meta Ads";
  if (value === "google_ads_api") return "Google Ads";
  return value ? value.replace(/_/g, " ") : "Spend Source";
};

const googleSheetsSpendSourceLabel = (source: any) => {
  const cfg = parseRevenueSourceConfig(source);
  return String(source?.displayName || cfg?.sheetName || cfg?.spreadsheetName || spendSourceTypeLabel(source?.sourceType));
};

export default function GoogleSheetsData() {
  const [, params] = useRoute("/campaigns/:id/google-sheets-data");
  const [location, setLocation] = useLocation();
  const campaignId = params?.id;
  const [mappingConnectionId, setMappingConnectionId] = useState<string | null>(null);
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [showAddDatasetModal, setShowAddDatasetModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const dayOfWeekKeyToInt = (value: any): number | undefined => {
    const key = String(value || "").trim().toLowerCase();
    const map: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return typeof map[key] === "number" ? map[key] : undefined;
  };

  const dayOfWeekIntToKey = (value: any): string => {
    const map: Record<number, string> = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };
    return map[Number(value)] || "monday";
  };

  const dayOfMonthToInt = (value: any): number | undefined => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "last") return 0;
    if (raw === "first") return 1;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(31, parsed)) : undefined;
  };

  const to24HourHHMM = (value: any): string => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      const simple = raw.match(/^(\d{1,2}):(\d{2})$/);
      return simple ? `${String(parseInt(simple[1], 10)).padStart(2, "0")}:${simple[2]}` : "09:00";
    }
    let hour = parseInt(match[1], 10);
    if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
    if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  };

  const from24HourTo12Hour = (value: any): string => {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "9:00 AM";
    let hour = parseInt(match[1], 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
    return `${hour}:${match[2]} ${suffix}`;
  };

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [campaignId]);

  // Get selected spreadsheetId from URL query params - update when location changes
  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(window.location.search));
  const selectedSpreadsheetId = urlParams.get('spreadsheetId');

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
    queryKey: ["/api/campaigns", campaignId, "google-sheets-connections", "main"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?scope=main`);
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
      const connectionsKey = ["/api/campaigns", campaignId, "google-sheets-connections", "main"];
      await queryClient.cancelQueries({ queryKey: connectionsKey });

      const prev = queryClient.getQueryData<any>(connectionsKey);
      const prevConnections: any[] = prev?.connections || [];

      // Determine if we are deleting the currently selected connection
      const currentValue = activeSpreadsheetId;
      let wasActive = false;
      if (currentValue) {
        const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(currentValue);
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
          handleSheetChange(getGoogleSheetsConnectionValue(next));
        }
      }

      return { prev };
    },
    onError: (error: Error, _connectionId: string, context: any) => {
      // Roll back optimistic update
      const connectionsKey = ["/api/campaigns", campaignId, "google-sheets-connections", "main"];
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
    if (selectedSpreadsheetId) {
      // Parse composite value (spreadsheetId:sheetName or spreadsheetId:connectionId)
      const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(selectedSpreadsheetId);
      
      // Verify the selected connection exists
      // identifier can be sheetName or connectionId (for tabs without sheetName)
      const selectedConn = googleSheetsConnections.find((conn: any) =>
        conn.spreadsheetId === spreadsheetId &&
        (identifier === null || conn.sheetName === identifier || conn.id === identifier)
      );
      if (selectedConn) return getGoogleSheetsConnectionValue(selectedConn);
    }
    // Default to primary or first connection
    const defaultConn = primaryConnection || googleSheetsConnections[0];
    if (defaultConn) {
      return getGoogleSheetsConnectionValue(defaultConn);
    }
    return null;
  }, [selectedSpreadsheetId, primaryConnection, googleSheetsConnections]);

  const getGoogleSheetsConnectionDisplayName = useCallback((conn: any): string => {
    if (!conn) return 'Unknown';
    const connectionsFromSameSpreadsheet = googleSheetsConnections.filter(
      (c: any) => c.spreadsheetId === conn.spreadsheetId
    );
    const hasMultipleTabs = connectionsFromSameSpreadsheet.length > 1;

    if (hasMultipleTabs) {
      if (conn.sheetName) return `${conn.sheetName} - ${conn.spreadsheetName || 'Sheet'}`;
      const tabIndex = connectionsFromSameSpreadsheet.findIndex((c: any) => c.id === conn.id) + 1;
      return `${conn.spreadsheetName || 'Sheet'} (Tab ${tabIndex})`;
    }
    if (conn.sheetName) return `${conn.spreadsheetName || 'Sheet'} (${conn.sheetName})`;
    return conn.spreadsheetName || 'Sheet';
  }, [googleSheetsConnections]);

  const activeGoogleSheetsSourceScope = useMemo<GoogleSheetsAnalysisSourceScope | null>(() => {
    if (!activeSpreadsheetId) return null;
    const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(activeSpreadsheetId);
    const activeConn = googleSheetsConnections.find((conn: any) =>
      conn.spreadsheetId === spreadsheetId &&
      (identifier === null || conn.sheetName === identifier || conn.id === identifier)
    );
    if (!activeConn) return null;

    return {
      platform: "google_sheets",
      scopeType: "single",
      activeSpreadsheetId,
      connectionId: activeConn.id || null,
      spreadsheetId: activeConn.spreadsheetId || spreadsheetId || null,
      spreadsheetName: activeConn.spreadsheetName || null,
      sheetName: activeConn.sheetName || null,
      displayName: getGoogleSheetsConnectionDisplayName(activeConn),
    };
  }, [activeSpreadsheetId, getGoogleSheetsConnectionDisplayName, googleSheetsConnections]);

  // Handle sheet selection change with smooth transition
  const handleSheetChange = useCallback((value: string) => {
    if (!value) return; // Don't handle empty values
    
    const newParams = new URLSearchParams(window.location.search);
    // Parse composite value (spreadsheetId:sheetName or spreadsheetId:connectionId)
    const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(value);

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
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    
    // Update URL params state immediately for smooth transition
    setUrlParams(newParams);
    
    // Use client-side navigation for smooth transition (no page reload)
    window.history.pushState({}, '', newUrl);
    setLocation(newUrl);
  }, [googleSheetsConnections, setLocation]);

  const { data: sheetsData, isLoading: sheetsLoading, isFetching: sheetsFetching, status: sheetsStatus, error: sheetsError, refetch } = useQuery<GoogleSheetsData & { calculatedConversionValues?: any[]; matchingInfo?: any }>({
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
          const url = `/api/campaigns/${campaignId}/google-sheets-data${activeSpreadsheetId ? `?spreadsheetId=${encodeURIComponent(activeSpreadsheetId)}` : ''}`;
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
    alertsEnabled: false, emailNotifications: false, alertFrequency: "immediate",
    alertThreshold: "", alertCondition: "below", emailRecipients: "",
  });

  // ═══ Benchmark State ═══
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: "", unit: "", description: "", metric: "", benchmarkValue: "", currentValue: "",
    alertsEnabled: false, emailNotifications: false, alertFrequency: "immediate",
    alertThreshold: "", alertCondition: "below", emailRecipients: "",
  });

  // ═══ Report State ═══
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalStep, setReportModalStep] = useState<"standard" | "custom">("standard");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState(createEmptyGoogleSheetsReportForm);
  const [reportFormErrors, setReportFormErrors] = useState<any>({});
  const [customReportConfig, setCustomReportConfig] = useState<any>(createEmptyGoogleSheetsCustomReportConfig);
  const [expandedCustomReportSections, setExpandedCustomReportSections] = useState<Record<string, boolean>>({});
  const [reportEditSnapshot, setReportEditSnapshot] = useState("");
  const [isRevenueWizardOpen, setIsRevenueWizardOpen] = useState(false);
  const [isSpendWizardOpen, setIsSpendWizardOpen] = useState(false);
  const [revenueWizardInitialSource, setRevenueWizardInitialSource] = useState<any>(null);
  const [spendWizardInitialSource, setSpendWizardInitialSource] = useState<any>(null);
  const [showRevenueSourcesDialog, setShowRevenueSourcesDialog] = useState(false);
  const [showSpendSourcesDialog, setShowSpendSourcesDialog] = useState(false);
  const [showPipelineProxySourcesDialog, setShowPipelineProxySourcesDialog] = useState(false);
  const [deletingRevenueSourceId, setDeletingRevenueSourceId] = useState<string | null>(null);
  const [deletingSpendSourceId, setDeletingSpendSourceId] = useState<string | null>(null);

  const resetGoogleSheetsReportCreateState = () => {
    setEditingReportId(null);
    setReportModalStep("standard");
    setReportForm(createEmptyGoogleSheetsReportForm());
    setReportFormErrors({});
    setCustomReportConfig(createEmptyGoogleSheetsCustomReportConfig());
    setExpandedCustomReportSections({});
    setReportEditSnapshot("");
  };

  const withGoogleSheetsSourceScope = useCallback((configuration: any = {}) => ({
    ...(configuration && typeof configuration === "object" && !Array.isArray(configuration) ? configuration : {}),
    sourceScope: activeGoogleSheetsSourceScope,
  }), [activeGoogleSheetsSourceScope]);

  const buildGoogleSheetsReportPayload = (overrides: any = {}) => {
    const scheduled = !!reportForm.scheduleEnabled;
    const recipients = reportForm.emailRecipients ? reportForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    const payload: any = {
      campaignId,
      platformType: "google_sheets",
      name: String(reportForm.name || "").trim(),
      description: String(reportForm.description || "").trim() || null,
      reportType: String(overrides.reportType || reportForm.reportType || "").trim().toLowerCase(),
      configuration: withGoogleSheetsSourceScope(overrides.configuration),
      status: reportForm.status || "active",
      scheduleEnabled: scheduled,
    };

    if (scheduled) {
      payload.scheduleFrequency = reportForm.scheduleFrequency || "daily";
      payload.scheduleDayOfWeek = reportForm.scheduleFrequency === "weekly" ? dayOfWeekKeyToInt(reportForm.scheduleDayOfWeek) : undefined;
      payload.scheduleDayOfMonth = reportForm.scheduleFrequency === "monthly" || reportForm.scheduleFrequency === "quarterly" ? dayOfMonthToInt(reportForm.scheduleDayOfMonth) : undefined;
      payload.scheduleTime = to24HourHHMM(reportForm.scheduleTime);
      payload.scheduleTimeZone = userTimeZone;
      payload.quarterTiming = reportForm.scheduleFrequency === "quarterly" ? reportForm.quarterTiming : undefined;
      payload.scheduleRecipients = recipients;
    }

    return payload;
  };

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

  const getSavedGoogleSheetsConfig = useCallback((row: any) => {
    const readConfig = (value: any) => {
      if (!value) return null;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === "object" ? value : null;
    };
    return readConfig(row?.calculationConfig) || readConfig(row?.configuration);
  }, []);

  const getSavedGoogleSheetsSourceScope = useCallback((row: any): GoogleSheetsAnalysisSourceScope | null => {
    const config = getSavedGoogleSheetsConfig(row);
    const scope = config?.sourceScope;
    return scope && scope.platform === "google_sheets" && scope.activeSpreadsheetId ? scope : null;
  }, [getSavedGoogleSheetsConfig]);

  const savedGoogleSheetsSourceValues = useMemo(() => {
    const values = new Set<string>();
    [...(Array.isArray(kpisData) ? kpisData : []), ...(Array.isArray(benchmarksData) ? benchmarksData : []), ...(Array.isArray(reportsData) ? reportsData : [])]
      .map(getSavedGoogleSheetsSourceScope)
      .forEach((scope) => {
        if (scope?.activeSpreadsheetId && scope.activeSpreadsheetId !== activeSpreadsheetId) values.add(scope.activeSpreadsheetId);
      });
    return Array.from(values);
  }, [activeSpreadsheetId, benchmarksData, getSavedGoogleSheetsSourceScope, kpisData, reportsData]);

  const savedGoogleSheetsSourceQueries = useQueries({
    queries: savedGoogleSheetsSourceValues.map((sourceValue) => ({
      queryKey: ["/api/campaigns", campaignId, "google-sheets-data", sourceValue, "saved-source-scope"],
      enabled: !!campaignId && !!sourceValue,
      queryFn: async () => {
        const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data?spreadsheetId=${encodeURIComponent(sourceValue)}`);
        if (!response.ok) throw new Error("Failed to fetch saved Google Sheets source");
        return response.json();
      },
      staleTime: 0,
      gcTime: 30000,
    })),
  });

  const { data: googleSheetsRevenueSourcesData, isLoading: googleSheetsRevenueSourcesLoading } = useQuery<{ success: boolean; sources: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_sheets"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=google_sheets`);
      if (!response.ok) return { success: false, sources: [] };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, sources: Array.isArray(json?.sources) ? json.sources : [] };
    },
  });

  const { data: googleSheetsRevenueTotalsData, isLoading: googleSheetsRevenueTotalsLoading } = useQuery<{ success: boolean; totalRevenue: number; currency?: string }>({
    queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_sheets&dateRange=all`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_sheets&dateRange=all`);
      if (!response.ok) return { success: false, totalRevenue: 0 };
      const json = await response.json().catch(() => ({}));
      return { success: !!json?.success, totalRevenue: Number(json?.totalRevenue || 0), currency: json?.currency };
    },
  });

  const { data: googleSheetsSpendTotalsData, isLoading: googleSheetsSpendTotalsLoading } = useQuery<{ success: boolean; totalSpend: number; currency?: string; sourceIds?: string[]; sources?: any[] }>({
    queryKey: [`/api/campaigns/${campaignId}/spend-totals?platformContext=google_sheets&dateRange=all`],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/spend-totals?platformContext=google_sheets&dateRange=all`);
      if (!response.ok) return { success: false, totalSpend: 0, sourceIds: [], sources: [] };
      const json = await response.json().catch(() => ({}));
      return {
        success: !!json?.success,
        totalSpend: Number(json?.totalSpend || 0),
        currency: json?.currency,
        sourceIds: Array.isArray(json?.sourceIds) ? json.sourceIds.map(String).filter(Boolean) : [],
        sources: Array.isArray(json?.sources) ? json.sources : [],
      };
    },
  });

  const { data: hubspotPipelineProxyData, isLoading: hubspotPipelineProxyLoading } = useQuery<any>({
    queryKey: ["/api/hubspot", campaignId, "pipeline-proxy", "google_sheets"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/hubspot/${encodeURIComponent(String(campaignId))}/pipeline-proxy?platformContext=google_sheets`);
      if (!response.ok) return null;
      return response.json().catch(() => null);
    },
  });

  const { data: salesforcePipelineProxyData, isLoading: salesforcePipelineProxyLoading } = useQuery<any>({
    queryKey: ["/api/salesforce", campaignId, "pipeline-proxy", "google_sheets"],
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/salesforce/${encodeURIComponent(String(campaignId))}/pipeline-proxy?platformContext=google_sheets`);
      if (!response.ok) return null;
      return response.json().catch(() => null);
    },
  });

  const activeGoogleSheetsRevenueSources = Array.isArray(googleSheetsRevenueSourcesData?.sources)
    ? googleSheetsRevenueSourcesData.sources.filter((source: any) => source?.isActive !== false)
    : [];
  const googleSheetsTotalRevenue = Number(googleSheetsRevenueTotalsData?.totalRevenue || 0);
  const hasGoogleSheetsConfirmedRevenue = googleSheetsTotalRevenue > 0 && activeGoogleSheetsRevenueSources.length > 0;
  const googleSheetsTotalSpend = Number(googleSheetsSpendTotalsData?.totalSpend || 0);
  const googleSheetsSpendSourceIds = Array.isArray(googleSheetsSpendTotalsData?.sourceIds) ? googleSheetsSpendTotalsData.sourceIds : [];
  const activeGoogleSheetsSpendSources = Array.isArray(googleSheetsSpendTotalsData?.sources) ? googleSheetsSpendTotalsData.sources : [];
  const hasGoogleSheetsConfirmedSpend = googleSheetsTotalSpend > 0 && googleSheetsSpendSourceIds.length > 0;
  const hasGoogleSheetsDerivedFinancials = hasGoogleSheetsConfirmedRevenue && hasGoogleSheetsConfirmedSpend;
  const googleSheetsRoas = hasGoogleSheetsDerivedFinancials ? googleSheetsTotalRevenue / googleSheetsTotalSpend : null;
  const googleSheetsRoi = hasGoogleSheetsDerivedFinancials ? ((googleSheetsTotalRevenue - googleSheetsTotalSpend) / googleSheetsTotalSpend) * 100 : null;
  const googleSheetsRevenueCurrency = googleSheetsRevenueTotalsData?.currency || googleSheetsSpendTotalsData?.currency || (campaign as any)?.currency || "USD";
  const googleSheetsFinancialCardsInitialLoading =
    (!googleSheetsRevenueSourcesData && googleSheetsRevenueSourcesLoading) ||
    (!googleSheetsRevenueTotalsData && googleSheetsRevenueTotalsLoading) ||
    (!googleSheetsSpendTotalsData && googleSheetsSpendTotalsLoading);
  const googleSheetsPipelineProxyInitialLoading =
    googleSheetsFinancialCardsInitialLoading ||
    (!hubspotPipelineProxyData && hubspotPipelineProxyLoading) ||
    (!salesforcePipelineProxyData && salesforcePipelineProxyLoading);
  const renderGoogleSheetsCardValuePlaceholder = () => (
    <span className="inline-block h-8 w-36 rounded bg-muted animate-pulse align-middle" aria-hidden="true" />
  );
  const renderGoogleSheetsCardHelperPlaceholder = () => (
    <span className="mt-1 inline-block h-3 w-32 rounded bg-muted animate-pulse" aria-hidden="true" />
  );
  const fmtCurrency = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    if (String(googleSheetsRevenueCurrency || "").toUpperCase() === "USD") {
      return `$${safeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: googleSheetsRevenueCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  };

  const googleSheetsConfirmedFinancialMetricOptions = useMemo<GoogleSheetsKpiMetricOption[]>(() => [
    {
      key: "overview.total_revenue",
      label: "Total Revenue",
      type: "currency",
      unit: "$",
      currentValue: hasGoogleSheetsConfirmedRevenue ? googleSheetsTotalRevenue : null,
      available: hasGoogleSheetsConfirmedRevenue,
      reason: hasGoogleSheetsConfirmedRevenue ? "" : "Requires confirmed Google Sheets revenue",
      sourceLabel: "Overview financial metrics",
      sourceKind: "confirmed_financial",
    },
    {
      key: "overview.total_spend",
      label: "Total Spend",
      type: "currency",
      unit: "$",
      currentValue: hasGoogleSheetsConfirmedSpend ? googleSheetsTotalSpend : null,
      available: hasGoogleSheetsConfirmedSpend,
      reason: hasGoogleSheetsConfirmedSpend ? "" : "Requires confirmed Google Sheets spend",
      sourceLabel: "Overview financial metrics",
      sourceKind: "confirmed_financial",
    },
    {
      key: "overview.roas",
      label: "ROAS",
      type: "decimal",
      unit: "ratio",
      currentValue: googleSheetsRoas,
      available: googleSheetsRoas !== null,
      reason: googleSheetsRoas !== null ? "" : "Requires confirmed Google Sheets revenue and spend",
      sourceLabel: "Overview financial metrics",
      sourceKind: "confirmed_financial",
    },
    {
      key: "overview.roi",
      label: "ROI",
      type: "decimal",
      unit: "%",
      currentValue: googleSheetsRoi,
      available: googleSheetsRoi !== null,
      reason: googleSheetsRoi !== null ? "" : "Requires confirmed Google Sheets revenue and spend",
      sourceLabel: "Overview financial metrics",
      sourceKind: "confirmed_financial",
    },
  ], [googleSheetsRoas, googleSheetsRoi, googleSheetsTotalRevenue, googleSheetsTotalSpend, hasGoogleSheetsConfirmedRevenue, hasGoogleSheetsConfirmedSpend]);

  const googleSheetsPipelineProxySourceEntries = useMemo(() => {
    const sourceForProvider = (provider: "hubspot" | "salesforce", endpointData: any) => {
      const source = activeGoogleSheetsRevenueSources
        .filter((item: any) => String(item?.sourceType || "").trim().toLowerCase() === provider)
        .map((item: any) => ({ source: item, cfg: parseRevenueSourceConfig(item) }))
        .filter(({ cfg }: any) => cfg?.pipelineEnabled === true && !!(cfg?.pipelineStageId || cfg?.pipelineStageName || cfg?.pipelineStageLabel))
        .sort((a: any, b: any) => new Date(b.source?.connectedAt || b.source?.createdAt || 0).getTime() - new Date(a.source?.connectedAt || a.source?.createdAt || 0).getTime())[0];
      if (!source && !endpointData?.success) return null;
      const cfg = source?.cfg || {};
      const providerLabel = provider === "salesforce" ? "Salesforce" : "HubSpot";
      const pipelineValueRevenueTotals = Array.isArray(endpointData?.pipelineValueRevenueTotals)
        ? endpointData.pipelineValueRevenueTotals
        : Array.isArray(cfg?.pipelineValueRevenueTotals) ? cfg.pipelineValueRevenueTotals : [];
      const campaignValues = pipelineValueRevenueTotals.length > 0
        ? pipelineValueRevenueTotals.map((item: any) => String(item?.campaignValue || "").trim()).filter(Boolean)
        : Array.isArray(cfg?.selectedValues) ? cfg.selectedValues.map((value: any) => String(value || "").trim()).filter(Boolean) : [];
      return {
        sourceId: String(source?.source?.id || provider),
        providerLabel,
        pipelineStageLabel: endpointData?.pipelineStageLabel || cfg?.pipelineStageLabel || cfg?.pipelineStageName || cfg?.pipelineStageId || "Selected stage",
        totalToDate: Number(endpointData?.success ? endpointData?.totalToDate || 0 : cfg?.pipelineTotalToDate || 0),
        campaignValues,
      };
    };
    return [
      sourceForProvider("hubspot", hubspotPipelineProxyData),
      sourceForProvider("salesforce", salesforcePipelineProxyData),
    ].filter(Boolean) as any[];
  }, [activeGoogleSheetsRevenueSources, hubspotPipelineProxyData, salesforcePipelineProxyData]);
  const googleSheetsPipelineProxyTotal = googleSheetsPipelineProxySourceEntries.reduce((sum: number, entry: any) => sum + Number(entry?.totalToDate || 0), 0);
  const googleSheetsCampaignScopeValues = (() => {
    const seen = new Set<string>();
    const values: string[] = [];
    const addValue = (value: any) => {
      const label = String(value ?? "").trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      values.push(label);
    };
    const addValues = (items: any) => {
      if (!Array.isArray(items)) return;
      items.forEach(addValue);
    };
    const addSourceScope = (source: any) => {
      const cfg = parseRevenueSourceConfig(source);
      const displayName = String(cfg?.campaignDisplayName || "").trim();
      if (displayName) {
        addValue(displayName);
        return;
      }
      addValues(cfg?.campaignValues);
      addValue(cfg?.campaignValue);
      addValues(cfg?.selectedValues);
      addValues(Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals.map((item: any) => item?.campaignValue) : []);
      addValues(Array.isArray(cfg?.pipelineValueRevenueTotals) ? cfg.pipelineValueRevenueTotals.map((item: any) => item?.campaignValue) : []);
    };
    activeGoogleSheetsRevenueSources.forEach(addSourceScope);
    activeGoogleSheetsSpendSources.forEach(addSourceScope);
    googleSheetsPipelineProxySourceEntries.forEach((entry: any) => addValues(entry?.campaignValues));
    return values;
  })();
  const googleSheetsCampaignScopeInitialLoading =
    isDataLoading || googleSheetsFinancialCardsInitialLoading || googleSheetsPipelineProxyInitialLoading;

  const refreshGoogleSheetsRevenueQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_sheets"] });
    await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_sheets&dateRange=all`], exact: false });
    await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals?platformContext=google_sheets&dateRange=all`], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy", "google_sheets"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy", "google_sheets"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_sheets/kpis", campaignId], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_sheets/benchmarks", campaignId], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_sheets/reports", campaignId], exact: false });
    await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_sheets"], exact: true });
    await queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_sheets&dateRange=all`], exact: true });
    await queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/spend-totals?platformContext=google_sheets&dateRange=all`], exact: true });
    await queryClient.refetchQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy", "google_sheets"], exact: false });
    await queryClient.refetchQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy", "google_sheets"], exact: false });
  };

  const renderGoogleSheetsFinancialCards = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm text-muted-foreground/70">Total Revenue</p>
            <button
              type="button"
              onClick={() => {
                setRevenueWizardInitialSource(null);
                setIsRevenueWizardOpen(true);
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
              title="Add Google Sheets revenue source"
              aria-label="Add Google Sheets revenue source"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardValuePlaceholder() : hasGoogleSheetsConfirmedRevenue ? fmtCurrency(googleSheetsTotalRevenue) : "Not connected"}
          </p>
          {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardHelperPlaceholder() : !hasGoogleSheetsConfirmedRevenue && (
            <p className="text-xs text-muted-foreground mt-1">Connect confirmed revenue</p>
          )}
          {!googleSheetsFinancialCardsInitialLoading && activeGoogleSheetsRevenueSources.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRevenueSourcesDialog(true)}
              className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground"
            >
              Sources ({activeGoogleSheetsRevenueSources.length})
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm text-muted-foreground/70">Total Spend</p>
            <button
              type="button"
              onClick={() => {
                setSpendWizardInitialSource(null);
                setIsSpendWizardOpen(true);
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
              title="Add spend source"
              aria-label="Add spend source"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardValuePlaceholder() : hasGoogleSheetsConfirmedSpend ? fmtCurrency(googleSheetsTotalSpend) : "Not connected"}
          </p>
          {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardHelperPlaceholder() : !hasGoogleSheetsConfirmedSpend && (
            <p className="text-xs text-muted-foreground mt-1">Connect confirmed spend</p>
          )}
          {!googleSheetsFinancialCardsInitialLoading && activeGoogleSheetsSpendSources.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSpendSourcesDialog(true)}
              className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground"
            >
              Sources ({activeGoogleSheetsSpendSources.length})
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm text-muted-foreground/70">Pipeline Proxy</p>
            <Target className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {googleSheetsPipelineProxyInitialLoading ? renderGoogleSheetsCardValuePlaceholder() : googleSheetsPipelineProxySourceEntries.length > 0 ? fmtCurrency(googleSheetsPipelineProxyTotal) : "Not configured"}
          </p>
          {googleSheetsPipelineProxyInitialLoading ? renderGoogleSheetsCardHelperPlaceholder() : (
            <p className="text-xs text-muted-foreground mt-1">
              {googleSheetsPipelineProxySourceEntries.length > 0
                ? "Open CRM value only. Not counted in Total Revenue, ROI, or ROAS."
                : "Select Total Revenue + Pipeline (Proxy) in the revenue wizard"}
            </p>
          )}
          {!googleSheetsPipelineProxyInitialLoading && googleSheetsPipelineProxySourceEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPipelineProxySourcesDialog(true)}
              className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground"
            >
              Sources ({googleSheetsPipelineProxySourceEntries.length})
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm text-muted-foreground/70">ROAS</p>
            <TrendingUp className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardValuePlaceholder() : googleSheetsRoas !== null ? `${googleSheetsRoas.toFixed(2)}x` : "Unavailable"}
          </p>
          {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardHelperPlaceholder() : (
            <p className="text-xs text-muted-foreground mt-1">
              {googleSheetsRoas !== null ? "Confirmed revenue / confirmed spend" : "Requires confirmed revenue and spend"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm text-muted-foreground/70">ROI</p>
            <Percent className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <p className={`text-2xl font-bold ${googleSheetsRoi !== null && googleSheetsRoi < 0 ? "text-red-600" : "text-foreground"}`}>
            {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardValuePlaceholder() : googleSheetsRoi !== null ? formatPct(googleSheetsRoi) : "Unavailable"}
          </p>
          {googleSheetsFinancialCardsInitialLoading ? renderGoogleSheetsCardHelperPlaceholder() : (
            <p className="text-xs text-muted-foreground mt-1">
              {googleSheetsRoi !== null ? "Confirmed revenue ROI" : "Requires confirmed revenue and spend"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGoogleSheetsCampaignScopeCard = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground/70">Selected Campaigns</p>
            <p className="text-xl font-bold text-foreground">
              {googleSheetsCampaignScopeInitialLoading
                ? renderGoogleSheetsCardValuePlaceholder()
                : googleSheetsCampaignScopeValues.length > 0
                  ? `${googleSheetsCampaignScopeValues.length} campaign value${googleSheetsCampaignScopeValues.length === 1 ? "" : "s"}`
                  : "All rows"}
            </p>
          </div>
          <Target className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        </div>
        {googleSheetsCampaignScopeInitialLoading ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {[...Array(3)].map((_, index) => (
              <span key={index} className="h-6 w-28 rounded-full bg-muted animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : googleSheetsCampaignScopeValues.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">Google Sheets metrics are scoped to these selected campaign values.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {googleSheetsCampaignScopeValues.slice(0, 8).map((value) => (
                <Badge key={value} variant="outline" className="max-w-full text-xs" title={value}>
                  <span className="max-w-[260px] truncate">{value}</span>
                </Badge>
              ))}
              {googleSheetsCampaignScopeValues.length > 8 && (
                <Badge variant="secondary" className="text-xs">
                  +{googleSheetsCampaignScopeValues.length - 8} more
                </Badge>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No campaign filter is configured. Google Sheets metrics use all rows from the selected source.
          </p>
        )}
      </CardContent>
    </Card>
  );

  const deleteGoogleSheetsRevenueSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/revenue-sources/${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to remove revenue source");
      }
      return json;
    },
    onSuccess: async () => {
      setDeletingRevenueSourceId(null);
      toast({ title: "Revenue source removed", description: "Google Sheets Total Revenue has been recalculated." });
      await refreshGoogleSheetsRevenueQueries();
    },
    onError: (error: any) => {
      setDeletingRevenueSourceId(null);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove revenue source",
        variant: "destructive",
      });
    },
  });

  const deleteGoogleSheetsSpendSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/spend-sources/${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to remove spend source");
      }
      return json;
    },
    onSuccess: async () => {
      setDeletingSpendSourceId(null);
      toast({ title: "Spend source removed", description: "Google Sheets Total Spend has been recalculated." });
      await refreshGoogleSheetsRevenueQueries();
    },
    onError: (error: any) => {
      setDeletingSpendSourceId(null);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove spend source",
        variant: "destructive",
      });
    },
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
      setKpiForm({ name: "", unit: "", description: "", metric: "", targetValue: "", currentValue: "", priority: "high", status: "active", timeframe: "monthly", alertsEnabled: false, emailNotifications: false, alertFrequency: "immediate", alertThreshold: "", alertCondition: "below", emailRecipients: "" });
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
      setBenchmarkForm({ name: "", unit: "", description: "", metric: "", benchmarkValue: "", currentValue: "", alertsEnabled: false, emailNotifications: false, alertFrequency: "immediate", alertThreshold: "", alertCondition: "below", emailRecipients: "" });
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
      setReportEditSnapshot("");
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
      setReportEditSnapshot("");
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

  const parseSheetMetricNumber = useCallback((value: any): number | null => {
    if (value === null || typeof value === "undefined" || value === "") return null;
    const cleaned = typeof value === "string" ? value.replace(/[$,%\s,]/g, "") : value;
    const parsed = typeof cleaned === "string" ? parseFloat(cleaned) : Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const buildGoogleSheetsMetricOptions = useCallback((data: any, sourceLabel?: string): GoogleSheetsKpiMetricOption[] => {
    const columns = Array.isArray(data?.summary?.detectedColumns) ? data.summary.detectedColumns : [];
    const metrics = data?.summary?.metrics || {};
    return columns
      .filter((col: any) => !GOOGLE_SHEETS_KPI_DATE_COLUMN_PATTERN.test(String(col?.name || "").trim()))
      .map((col: any) => {
        const key = String(col?.name || "").trim();
        const sourceValue = parseSheetMetricNumber((metrics as any)[key] ?? col?.total);
        const available = !!key && sourceValue !== null;
        const unit = /roas|return on/i.test(key)
          ? "ratio"
          : String(key).includes("%") || /rate|ctr|cvr/i.test(key)
          ? "%"
          : col?.type === "currency" || GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN.test(key)
            ? "$"
            : col?.type === "integer"
            ? "count"
            : "";
        return {
          key,
          label: key,
          type: col?.type || "decimal",
          unit,
          currentValue: sourceValue,
          available,
          reason: sourceValue === null
            ? "Current value requires a mapped metric column with refreshed sheet rows"
            : "",
          sourceLabel,
          sourceKind: "sheet_column",
        };
      });
  }, [parseSheetMetricNumber]);

  const googleSheetsKpiMetricOptions = useMemo<GoogleSheetsKpiMetricOption[]>(() => {
    const sheetOptions = buildGoogleSheetsMetricOptions(sheetsData, activeGoogleSheetsSourceScope?.displayName || sheetsData?.spreadsheetName || "Google Sheets");
    return [...googleSheetsConfirmedFinancialMetricOptions, ...sheetOptions];
  }, [activeGoogleSheetsSourceScope?.displayName, buildGoogleSheetsMetricOptions, googleSheetsConfirmedFinancialMetricOptions, sheetsData]);

  const savedGoogleSheetsMetricOptionsByScope = useMemo(() => {
    const map = new Map<string, GoogleSheetsKpiMetricOption[]>();
    savedGoogleSheetsSourceValues.forEach((sourceValue, index) => {
      const scope = [...(Array.isArray(kpisData) ? kpisData : []), ...(Array.isArray(benchmarksData) ? benchmarksData : []), ...(Array.isArray(reportsData) ? reportsData : [])]
        .map(getSavedGoogleSheetsSourceScope)
        .find((item) => item?.activeSpreadsheetId === sourceValue);
      const query = savedGoogleSheetsSourceQueries[index];
      map.set(sourceValue, buildGoogleSheetsMetricOptions(query?.data, scope?.displayName || "Saved Google Sheets source"));
    });
    return map;
  }, [benchmarksData, buildGoogleSheetsMetricOptions, getSavedGoogleSheetsSourceScope, kpisData, reportsData, savedGoogleSheetsSourceQueries, savedGoogleSheetsSourceValues]);

  const googleSheetsConnectionMatchesScopeValue = useCallback((conn: any, scopeValue: string) => {
    const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(scopeValue);
    return conn?.spreadsheetId === spreadsheetId &&
      (identifier === null || conn?.sheetName === identifier || conn?.id === identifier);
  }, []);

  const getGoogleSheetsMetricOptionsForSavedScope = useCallback((row: any) => {
    const config = getSavedGoogleSheetsConfig(row);
    if (config?.valueSource === "confirmed_financial_overview") {
      return { scope: null, options: googleSheetsConfirmedFinancialMetricOptions, reason: "" };
    }
    const scope = getSavedGoogleSheetsSourceScope(row);
    if (!scope?.activeSpreadsheetId) {
      return { scope, options: [] as GoogleSheetsKpiMetricOption[], reason: "Saved Google Sheets source scope is missing" };
    }
    const connectionExists = googleSheetsConnections.some((conn: any) => googleSheetsConnectionMatchesScopeValue(conn, scope.activeSpreadsheetId));
    if (!connectionExists) {
      return { scope, options: [] as GoogleSheetsKpiMetricOption[], reason: "Saved Google Sheets source is no longer connected" };
    }
    if (scope.activeSpreadsheetId === activeSpreadsheetId) {
      return { scope, options: googleSheetsKpiMetricOptions, reason: "" };
    }
    const queryIndex = savedGoogleSheetsSourceValues.indexOf(scope.activeSpreadsheetId);
    const query = queryIndex >= 0 ? savedGoogleSheetsSourceQueries[queryIndex] : null;
    const options = savedGoogleSheetsMetricOptionsByScope.get(scope.activeSpreadsheetId) || [];
    if ((query?.isLoading || query?.isFetching) && options.length === 0) {
      return { scope, options, reason: "Saved Google Sheets source data is still loading" };
    }
    if (query?.isError) {
      return { scope, options: [] as GoogleSheetsKpiMetricOption[], reason: "Saved Google Sheets source could not be loaded" };
    }
    return { scope, options, reason: "" };
  }, [activeSpreadsheetId, googleSheetsConnections, googleSheetsConfirmedFinancialMetricOptions, googleSheetsConnectionMatchesScopeValue, googleSheetsKpiMetricOptions, getSavedGoogleSheetsConfig, getSavedGoogleSheetsSourceScope, savedGoogleSheetsMetricOptionsByScope, savedGoogleSheetsSourceQueries, savedGoogleSheetsSourceValues]);

  const resolveGoogleSheetsKpiMetric = useCallback((kpi: any) => {
    const metricKey = String(kpi?.metric || kpi?.metricKey || "").trim();
    const scoped = getGoogleSheetsMetricOptionsForSavedScope(kpi);
    const option = scoped.options.find((item) => item.key === metricKey);
    if (option?.available && option.currentValue !== null) {
      return { available: true, option, currentValue: option.currentValue, reason: "", sourceLabel: scoped.scope?.displayName || option.sourceLabel || "" };
    }
    return {
      available: false,
      option,
      currentValue: null,
      reason: scoped.reason || option?.reason || "This KPI metric is not available from the saved Google Sheets source",
      sourceLabel: scoped.scope?.displayName || option?.sourceLabel || "",
    };
  }, [getGoogleSheetsMetricOptionsForSavedScope]);

  const computeGoogleSheetsKpiProgress = useCallback((kpi: any, current: number, target: number) => {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeTarget = Number.isFinite(target) ? target : 0;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: kpi?.metric || kpi?.metricKey, name: kpi?.name });
    const effectiveDeltaPct = computeEffectiveDeltaPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const band = effectiveDeltaPct !== null
      ? classifyKpiBand({ effectiveDeltaPct, nearTargetBandPct: GOOGLE_SHEETS_KPI_NEAR_TARGET_BAND_PCT })
      : "below";
    const attainmentPct = computeAttainmentPct({ current: safeCurrent, target: safeTarget, lowerIsBetter });
    const fillPct = attainmentPct !== null ? computeAttainmentFillPct(attainmentPct) : 0;
    const progressColor = band === "above" ? "bg-green-500" : band === "near" ? "bg-blue-500" : "bg-red-500";
    return { band, effectiveDeltaPct, attainmentPct: attainmentPct ?? 0, fillPct, progressColor };
  }, []);

  const googleSheetsKpiTracker = useMemo(() => {
    const list = Array.isArray(kpisData) ? kpisData : [];
    let above = 0;
    let near = 0;
    let below = 0;
    let blocked = 0;
    let progressTotal = 0;
    let progressCount = 0;
    for (const kpi of list) {
      const resolved = resolveGoogleSheetsKpiMetric(kpi);
      const target = parseSheetMetricNumber(kpi?.targetValue);
      if (!resolved.available || resolved.currentValue === null || !target || target <= 0) {
        blocked += 1;
        continue;
      }
      const progress = computeGoogleSheetsKpiProgress(kpi, resolved.currentValue, target);
      progressTotal += progress.fillPct;
      progressCount += 1;
      if (progress.band === "above") above += 1;
      else if (progress.band === "below") below += 1;
      else near += 1;
    }
    return {
      total: list.length,
      above,
      near,
      below,
      blocked,
      avgPct: progressCount > 0 ? progressTotal / progressCount : 0,
    };
  }, [computeGoogleSheetsKpiProgress, kpisData, parseSheetMetricNumber, resolveGoogleSheetsKpiMetric]);

  const resolveGoogleSheetsBenchmarkMetric = useCallback((benchmark: any) => {
    const metricKey = String(benchmark?.metric || benchmark?.metricKey || "").trim();
    const scoped = getGoogleSheetsMetricOptionsForSavedScope(benchmark);
    const option = scoped.options.find((item) => item.key === metricKey);
    if (option?.available && option.currentValue !== null) {
      return { available: true, option, currentValue: option.currentValue, reason: "", sourceLabel: scoped.scope?.displayName || option.sourceLabel || "" };
    }
    return {
      available: false,
      option,
      currentValue: null,
      reason: scoped.reason || option?.reason || "This Benchmark metric is not available from the saved Google Sheets source",
      sourceLabel: scoped.scope?.displayName || option?.sourceLabel || "",
    };
  }, [getGoogleSheetsMetricOptionsForSavedScope]);

  const computeGoogleSheetsBenchmarkProgress = useCallback((benchmark: any, current: number, benchmarkValue: number) => {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeBenchmark = Number.isFinite(benchmarkValue) ? benchmarkValue : 0;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: benchmark?.metric || benchmark?.metricKey, name: benchmark?.name });
    const attainmentPct = computeAttainmentPct({ current: safeCurrent, target: safeBenchmark, lowerIsBetter });
    const fillPct = attainmentPct !== null ? computeAttainmentFillPct(attainmentPct) : 0;
    const ratio = (attainmentPct ?? 0) / 100;
    const status = ratio >= 0.9 ? "on_track" : ratio >= 0.7 ? "needs_attention" : "behind";
    const color = status === "on_track" ? "bg-green-500" : status === "needs_attention" ? "bg-yellow-500" : "bg-red-500";
    const deltaPct = computeEffectiveDeltaPct({ current: safeCurrent, target: safeBenchmark, lowerIsBetter });
    return {
      ratio,
      pct: fillPct,
      labelPct: (attainmentPct ?? 0).toFixed(1),
      status,
      color,
      deltaPct: deltaPct ?? 0,
      attainmentPct: attainmentPct ?? 0,
      fillPct,
    };
  }, []);

  const googleSheetsBenchmarkTracker = useMemo(() => {
    const list = Array.isArray(benchmarksData) ? benchmarksData : [];
    let onTrack = 0;
    let needsAttention = 0;
    let behind = 0;
    let blocked = 0;
    let progressTotal = 0;
    let progressCount = 0;
    for (const benchmark of list) {
      const resolved = resolveGoogleSheetsBenchmarkMetric(benchmark);
      const benchmarkValue = parseSheetMetricNumber(benchmark?.benchmarkValue);
      if (!resolved.available || resolved.currentValue === null || !benchmarkValue || benchmarkValue <= 0) {
        blocked += 1;
        continue;
      }
      const progress = computeGoogleSheetsBenchmarkProgress(benchmark, resolved.currentValue, benchmarkValue);
      progressTotal += progress.fillPct;
      progressCount += 1;
      if (progress.status === "on_track") onTrack += 1;
      else if (progress.status === "needs_attention") needsAttention += 1;
      else behind += 1;
    }
    return {
      total: list.length,
      onTrack,
      needsAttention,
      behind,
      blocked,
      avgPct: progressCount > 0 ? progressTotal / progressCount : 0,
    };
  }, [benchmarksData, computeGoogleSheetsBenchmarkProgress, parseSheetMetricNumber, resolveGoogleSheetsBenchmarkMetric]);

  const downloadGoogleSheetsReport = async (opts: { reportType: string; configuration?: any; reportName?: string }) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const right = pageW - margin;
    let y = 18;
    const safeText = (value: any) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ").trim();
    const text = (value: any, x: number, yy: number, size = 10, style: "normal" | "bold" = "normal") => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.text(safeText(value), x, yy);
    };
    const ensureSpace = (height: number) => {
      if (y + height > 280) {
        doc.addPage();
        y = 18;
      }
    };
    const addRow = (label: string, value: any) => {
      ensureSpace(8);
      text(label, margin, y, 9, "bold");
      text(value, margin + 75, y, 9);
      y += 7;
    };
    const formatValue = (value: any, unit?: string, type?: string) => {
      const numeric = parseSheetMetricNumber(value);
      if (numeric === null) return "Unavailable";
      if (unit === "$" || type === "currency") return `$${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (unit === "%") return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
      if (unit === "ratio") return `${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
      return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };
    const selectedConfig = parseGoogleSheetsReportConfiguration(opts.configuration || customReportConfig);
    const reportScopedMetrics = getGoogleSheetsMetricOptionsForSavedScope({ configuration: selectedConfig });
    const reportMetricOptions = reportScopedMetrics.options;
    const metricOptionsByKey = new Map(reportMetricOptions.map((metric) => [metric.key, metric]));
    const reportType = String(opts.reportType || "overview").toLowerCase();

    text(opts.reportName || reportForm.name || "Google Sheets Report", margin, y, 16, "bold");
    y += 8;
    text(`Source: ${reportScopedMetrics.scope?.displayName || reportScopedMetrics.reason || activeGoogleSheetsSourceScope?.displayName || sheetsData?.spreadsheetName || "Google Sheets"}`, margin, y, 9);
    y += 6;
    text(`Rows: ${(sheetsData?.filteredRows ?? sheetsData?.totalRows ?? 0).toLocaleString()} | Generated: ${new Date().toLocaleString()}`, margin, y, 9);
    y += 10;

    const addMetrics = (metrics: GoogleSheetsKpiMetricOption[]) => {
      metrics.slice(0, 30).forEach((metric) => addRow(metric.label, formatValue(metric.currentValue, metric.unit, metric.type)));
      if (metrics.length > 30) addRow("Additional metrics", `${metrics.length - 30} omitted from PDF view`);
    };

    if (reportType === "overview") {
      text("Overview", margin, y, 12, "bold");
      y += 8;
      addMetrics(reportMetricOptions.filter((metric) => metric.available));
    } else if (reportType === "kpis") {
      text("KPIs", margin, y, 12, "bold");
      y += 8;
      (Array.isArray(kpisData) ? kpisData : []).forEach((kpi: any) => {
        const resolved = resolveGoogleSheetsKpiMetric(kpi);
        addRow(String(kpi.name || kpi.metric || "KPI"), `${formatValue(resolved.currentValue, resolved.option?.unit, resolved.option?.type)} / ${formatValue(kpi.targetValue, resolved.option?.unit, resolved.option?.type)}`);
      });
    } else if (reportType === "benchmarks") {
      text("Benchmarks", margin, y, 12, "bold");
      y += 8;
      (Array.isArray(benchmarksData) ? benchmarksData : []).forEach((benchmark: any) => {
        const resolved = resolveGoogleSheetsBenchmarkMetric(benchmark);
        addRow(String(benchmark.name || benchmark.metric || "Benchmark"), `${formatValue(resolved.currentValue, resolved.option?.unit, resolved.option?.type)} / ${formatValue(benchmark.benchmarkValue, resolved.option?.unit, resolved.option?.type)}`);
      });
    } else if (reportType === "custom") {
      text("Custom Report", margin, y, 12, "bold");
      y += 8;
      const selectedMetrics = (selectedConfig.selectedMetrics || []).map((metric: string) => metricOptionsByKey.get(metric)).filter(Boolean) as GoogleSheetsKpiMetricOption[];
      if (selectedMetrics.length > 0) {
        text("Overview", margin, y, 10, "bold");
        y += 7;
        addMetrics(selectedMetrics);
      }
      const selectedKpis = new Set([...(selectedConfig.kpis || []), ...(selectedConfig.selectedKpiIds || [])].map(String));
      (Array.isArray(kpisData) ? kpisData : []).filter((kpi: any) => selectedKpis.has(String(kpi.id))).forEach((kpi: any) => {
        const resolved = resolveGoogleSheetsKpiMetric(kpi);
        addRow(`KPI: ${String(kpi.name || kpi.metric || "")}`, formatValue(resolved.currentValue, resolved.option?.unit, resolved.option?.type));
      });
      const selectedBenchmarks = new Set([...(selectedConfig.benchmarks || []), ...(selectedConfig.selectedBenchmarkIds || [])].map(String));
      (Array.isArray(benchmarksData) ? benchmarksData : []).filter((benchmark: any) => selectedBenchmarks.has(String(benchmark.id))).forEach((benchmark: any) => {
        const resolved = resolveGoogleSheetsBenchmarkMetric(benchmark);
        addRow(`Benchmark: ${String(benchmark.name || benchmark.metric || "")}`, formatValue(resolved.currentValue, resolved.option?.unit, resolved.option?.type));
      });
    } else if (reportType === "ads") {
      text("Ad Comparison", margin, y, 12, "bold");
      y += 8;
      text("Google Sheets does not expose ad-level rows for this source. Use a paid-media source for Ad Comparison reports.", margin, y, 9);
      y += 8;
    } else {
      text("Insights", margin, y, 12, "bold");
      y += 8;
      addRow("Detected metrics", reportMetricOptions.length);
      addRow("Top metric", reportMetricOptions[0]?.label || "Unavailable");
      addRow("Current rows", sheetsData?.filteredRows ?? sheetsData?.totalRows ?? 0);
    }

    doc.setFontSize(8);
    doc.text("Generated by MimoSaaS", margin, 287);
    doc.text(new Date().toISOString().slice(0, 10), right - 30, 287);
    const safeName = safeText(opts.reportName || reportForm.name || "Google_Sheets_Report").replace(/\s+/g, "_") || "Google_Sheets_Report";
    doc.save(`${safeName}.pdf`);
  };

  // ═══ Handler Functions ═══
  const handleCreateKpi = () => {
    if (!kpiForm.name || !kpiForm.metric || !kpiForm.targetValue) {
      toast({ title: "Required Fields", description: "Please fill in the KPI name, metric, and target value.", variant: "destructive" });
      return;
    }
    const metricOption = googleSheetsKpiMetricOptions.find((item) => item.key === kpiForm.metric);
    if (!metricOption?.available || metricOption.currentValue === null) {
      toast({ title: "Metric Unavailable", description: metricOption?.reason || "Select a mapped Google Sheets metric with a current value.", variant: "destructive" });
      return;
    }
    if (kpiForm.alertsEnabled && !kpiForm.alertThreshold) {
      toast({ title: "Alert Threshold Required", description: "Please set an alert threshold value.", variant: "destructive" });
      return;
    }
    const targetValue = parseSheetMetricNumber(kpiForm.targetValue);
    if (targetValue === null) {
      toast({ title: "Invalid Target", description: "Please enter a valid numeric target value.", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...kpiForm, campaignId, platformType: "google_sheets",
      targetValue,
      currentValue: metricOption.currentValue,
      alertThreshold: kpiForm.alertThreshold ? parseFloat(String(kpiForm.alertThreshold).replace(/,/g, '')) : null,
      emailRecipients: kpiForm.emailRecipients ? kpiForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean).join(', ') : null,
      metricKey: kpiForm.metric,
      sourceType: "platform",
      calculationConfig: metricOption.sourceKind === "confirmed_financial"
        ? {
          source: "google_sheets_overview_financials",
          valueSource: "confirmed_financial_overview",
          metric: kpiForm.metric,
        }
        : {
          source: "google_sheets_main",
          valueSource: "source_backed_summary",
          metric: kpiForm.metric,
          sourceScope: activeGoogleSheetsSourceScope,
        },
    };
    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  const handleCreateBenchmark = () => {
    if (!benchmarkForm.name || !benchmarkForm.metric || !benchmarkForm.benchmarkValue) {
      toast({ title: "Required Fields", description: "Please fill in the benchmark name, metric, and value.", variant: "destructive" });
      return;
    }
    const metricOption = googleSheetsKpiMetricOptions.find((item) => item.key === benchmarkForm.metric);
    if (!metricOption?.available || metricOption.currentValue === null) {
      toast({ title: "Metric Unavailable", description: metricOption?.reason || "Select a mapped Google Sheets metric with a current value.", variant: "destructive" });
      return;
    }
    if (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold) {
      toast({ title: "Alert Threshold Required", description: "Please set an alert threshold value.", variant: "destructive" });
      return;
    }
    const benchmarkValue = parseSheetMetricNumber(benchmarkForm.benchmarkValue);
    if (benchmarkValue === null) {
      toast({ title: "Invalid Benchmark", description: "Please enter a valid numeric benchmark value.", variant: "destructive" });
      return;
    }
    const alertThreshold = benchmarkForm.alertThreshold ? parseSheetMetricNumber(benchmarkForm.alertThreshold) : null;
    const payload: any = {
      ...benchmarkForm, campaignId, platformType: "google_sheets",
      category: "performance",
      benchmarkType: "goal",
      source: "Google Sheets",
      benchmarkValue: String(benchmarkValue),
      currentValue: String(metricOption.currentValue),
      alertThreshold: alertThreshold !== null ? String(alertThreshold) : null,
      emailRecipients: benchmarkForm.emailRecipients ? benchmarkForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean).join(', ') : null,
      metricKey: benchmarkForm.metric,
      calculationConfig: metricOption.sourceKind === "confirmed_financial"
        ? {
          source: "google_sheets_overview_financials",
          valueSource: "confirmed_financial_overview",
          metric: benchmarkForm.metric,
        }
        : {
          source: "google_sheets_main",
          valueSource: "source_backed_summary",
          metric: benchmarkForm.metric,
          sourceScope: activeGoogleSheetsSourceScope,
        },
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
    setReportForm((prev) => ({ ...prev, reportType: type, name: names[type] || "Report" }));
  };

  const handleCreateReport = async () => {
    if (!reportForm.reportType) {
      toast({ title: "Report Type Required", description: "Choose a report template before generating a report.", variant: "destructive" });
      return;
    }
    if (reportForm.scheduleEnabled && !reportForm.emailRecipients?.trim()) {
      setReportFormErrors({ emailRecipients: "Email recipients are required for scheduled reports" });
      return;
    }
    const payload = buildGoogleSheetsReportPayload();
    if (!payload.scheduleEnabled) {
      try {
        await downloadGoogleSheetsReport({ reportType: payload.reportType, configuration: payload.configuration, reportName: payload.name });
        setIsReportModalOpen(false);
      } catch (error: any) {
        toast({ title: "Failed to generate report", description: error?.message || "An unexpected error occurred", variant: "destructive" });
      }
      return;
    }
    createReportMutation.mutate(payload);
  };

  const handleUpdateReport = () => {
    if (!editingReportId) return;
    if (reportForm.scheduleEnabled && !reportForm.emailRecipients?.trim()) {
      setReportFormErrors({ emailRecipients: "Email recipients are required for scheduled reports" });
      return;
    }
    updateReportMutation.mutate({
      reportId: editingReportId,
      data: buildGoogleSheetsReportPayload({
        reportType: reportForm.reportType,
        configuration: reportForm.reportType === "custom" ? customReportConfig : null,
      }),
    });
  };

  const handleCustomReport = async () => {
    if (reportForm.scheduleEnabled && !reportForm.emailRecipients?.trim()) {
      setReportFormErrors({ emailRecipients: "Email recipients are required for scheduled reports" });
      return;
    }
    const payload = buildGoogleSheetsReportPayload({
      reportType: "custom",
      configuration: customReportConfig,
    });
    if (!payload.scheduleEnabled) {
      try {
        await downloadGoogleSheetsReport({ reportType: "custom", configuration: payload.configuration, reportName: payload.name });
        setIsReportModalOpen(false);
      } catch (error: any) {
        toast({ title: "Failed to generate report", description: error?.message || "An unexpected error occurred", variant: "destructive" });
      }
      return;
    }
    createReportMutation.mutate(payload);
  };

  const formatMetricValue = (value: number, type?: string): string => {
    if (type === 'currency') return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (type === 'decimal') return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value.toLocaleString();
  };

  const formatGoogleSheetsKpiCardValue = (value: number, unit: string, type?: string): string => {
    if (unit === "$") return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (unit === "%") return formatPct(value);
    if (unit === "ratio") return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
    if (unit === "count") return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return formatMetricValue(value, type);
  };

  const formatGoogleSheetsBenchmarkInputValue = (value: any, unit: string, type?: string): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (unit === "count" || type === "integer") {
      const parsed = parseSheetMetricNumber(raw);
      if (parsed !== null && Number.isInteger(parsed)) {
        return parsed.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }
    }
    return raw;
  };

  const getGoogleSheetsKpiIcon = (metricName: string) => {
    const n = String(metricName || "").toLowerCase();
    if (n.includes("revenue") || n.includes("spend") || n.includes("cost") || n.includes("budget")) return { Icon: DollarSign, color: "text-emerald-600" };
    if (n.includes("roas") || n.includes("roi") || n.includes("rate") || n.includes("%")) return { Icon: TrendingUp, color: "text-violet-600" };
    if (n.includes("conversion") || n.includes("lead") || n.includes("customer")) return { Icon: Target, color: "text-indigo-600" };
    if (n.includes("click")) return { Icon: MousePointerClick, color: "text-orange-600" };
    if (n.includes("session") || n.includes("time")) return { Icon: Clock, color: "text-muted-foreground" };
    return { Icon: BarChart3, color: "text-muted-foreground" };
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-w-0 p-8">
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
          <main className="flex-1 min-w-0 p-8">
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
  type GoogleSheetsSummaryColumn = NonNullable<GoogleSheetsData["summary"]["detectedColumns"]>[number];

  function isSummaryIdentifierColumn(colName: string): boolean {
    const n = String(colName || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    return n === "id" || /\b(id|identifier|urn|uuid)\b/.test(n);
  }

  function getSummaryMetricDisplayValue(col: GoogleSheetsSummaryColumn): number {
    const summaryValue = Number((col as any)?.summaryValue);
    if (Number.isFinite(summaryValue)) return summaryValue;
    const total = Number(col?.total);
    return Number.isFinite(total) ? total : 0;
  }

  function getSummaryMetricBusinessPriority(colName: string): number | null {
    const n = String(colName || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    const priorities: Array<[RegExp, number]> = [
      [/\brevenue\b|\bsales\b|\bconversion value\b/, 10],
      [/\bspend\b|\bcost\b|\bbudget\b/, 20],
      [/\broas\b|\breturn on ad spend\b/, 30],
      [/\broi\b|\breturn on investment\b/, 40],
      [/\bpipeline\b/, 50],
      [/\bcac\b|\bcpa\b|\bcpl\b|\bcpc\b|\bcpm\b|\bcost per\b/, 60],
      [/\bcustomers?\b|\bleads?\b|\bconversions?\b|\bmql\b|\bsql\b|\bopportunit/, 70],
      [/\bclicks?\b|\bimpressions?\b|\breach\b|\bviews?\b|\bsessions?\b|\busers?\b/, 80],
      [/\bctr\b|\bcvr\b|\bconversion rate\b|\brate\b|%/, 90],
    ];
    return priorities.find(([pattern]) => pattern.test(n))?.[1] ?? null;
  }

  function getExecutiveSummaryColumns(cols: GoogleSheetsSummaryColumn[]) {
    const candidates = cols.filter((col: any) => !isSummaryIdentifierColumn(col?.name || ""));
    const executiveColumns = candidates
      .map((col) => ({ col, priority: getSummaryMetricBusinessPriority(col.name) }))
      .filter((item): item is { col: GoogleSheetsSummaryColumn; priority: number } => item.priority !== null)
      .sort((a, b) => a.priority - b.priority || a.col.name.localeCompare(b.col.name))
      .map((item) => item.col);
    return executiveColumns.length > 0 ? executiveColumns : candidates;
  }

  function formatSummaryValue(value: number, colType: string, colName: string): string {
    const n = colName.toLowerCase();
    if (n.includes('%') || n.includes('rate') || n.includes('ctr') || n.includes('cvr') || n.includes('roi')) {
      return value.toFixed(2) + '%';
    }
    if (n.includes('roas') || n.includes('return on ad spend')) {
      return value.toFixed(2) + 'x';
    }
    const isCurrency = colType === 'currency' || n.includes('$') || n.includes('revenue')
      || n.includes('spend') || n.includes('cost') || n.includes('budget')
      || n.includes('cpc') || n.includes('cpm') || n.includes('cpa')
      || n.includes('cac') || n.includes('cpl');
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

  function classifyColumns(cols: GoogleSheetsSummaryColumn[]) {
    const hero: typeof cols = [];
    const supporting: typeof cols = [];
    for (const col of cols) {
      if (isSummaryIdentifierColumn(col.name)) continue;
      const n = col.name.toLowerCase();
      const value = getSummaryMetricDisplayValue(col);
      const isPct = n.includes('%') || n.includes('rate') || n.includes('ctr') || n.includes('cvr');
      const isRoas = n.includes('roas') || n.includes('return on');
      const isCurrency = col.type === 'currency' || n.includes('$') || n.includes('revenue')
        || n.includes('spend') || n.includes('cost') || n.includes('budget')
        || n.includes('cac') || n.includes('cpa') || n.includes('cpc') || n.includes('cpm') || n.includes('cpl');
      const isUtility = n.includes('days') || n.includes('month');
      const isSmallCount = col.type === 'integer' && value < 100;
      if (isPct || isRoas || isSmallCount || isUtility) {
        supporting.push(col);
      } else if (isCurrency || (col.type === 'integer' && value >= 100)) {
        hero.push(col);
      } else {
        supporting.push(col);
      }
    }
    if (hero.length > 4) {
      hero.sort((a, b) =>
        (getSummaryMetricBusinessPriority(a.name) ?? 999) - (getSummaryMetricBusinessPriority(b.name) ?? 999)
        || getSummaryMetricDisplayValue(b) - getSummaryMetricDisplayValue(a)
      );
      supporting.unshift(...hero.splice(4));
    }
    return { hero, supporting };
  }

  function getSummaryIcon(colName: string) {
    const n = colName.toLowerCase();
    if (n.includes('revenue') || n.includes('spend') || n.includes('cost') || n.includes('budget') || n.includes('$') || n.includes('cac') || n.includes('cpa') || n.includes('cpc') || n.includes('cpm') || n.includes('cpl')) return DollarSign;
    if (n.includes('impression') || n.includes('reach') || n.includes('view')) return Eye;
    if (n.includes('click')) return MousePointerClick;
    if (n.includes('conversion') || n.includes('lead') || n.includes('mql') || n.includes('sql') || n.includes('opportunit')) return Target;
    if (n.includes('rate') || n.includes('%') || n.includes('ctr') || n.includes('roas')) return TrendingUp;
    return BarChart3;
  }

  const reportHasChanges = !editingReportId ||
    serializeGoogleSheetsReportState(reportForm, customReportConfig, reportModalStep) !== reportEditSnapshot;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 min-w-0 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-6 mb-6">
              <div className="flex items-center space-x-4 min-w-0">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm" className="whitespace-nowrap">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <SiGooglesheets className="w-8 h-8 text-green-600 shrink-0" />
                    <h1 className="text-3xl font-bold text-foreground whitespace-nowrap">Google Sheets Data</h1>
                  </div>
                  <p className="text-muted-foreground/70">Marketing data for {campaign.name}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 shrink-0 flex-nowrap">
                <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                  <Calendar className="w-3 h-3 mr-1" />
                  Auto-refreshing hourly
                </Badge>
                {canAddMoreSheets && (
                  <Button
                    onClick={() => setShowAddDatasetModal(true)}
                    size="sm"
                    className="whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Dataset
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={sheetsLoading}
                  size="sm"
                  className="whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${sheetsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (sheetsData?.spreadsheetId) {
                      window.open(`https://docs.google.com/spreadsheets/d/${sheetsData.spreadsheetId}/edit`, '_blank');
                    }
                  }}
                  disabled={!sheetsData?.spreadsheetId}
                  aria-hidden={!sheetsData?.spreadsheetId}
                  size="sm"
                  className={`whitespace-nowrap shrink-0 ${sheetsData?.spreadsheetId ? "" : "invisible"}`}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Open in Sheets
                </Button>
              </div>
            </div>

            {/* Sheet Selector and Active Sheet Indicator */}
            <div className="mb-6 space-y-3 min-h-[76px]">
              {googleSheetsConnections.length > 0 && (
                <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground/80/60 whitespace-nowrap">
                    View Data From:
                  </label>
                  <Select
                    value={(() => {
                      if (activeSpreadsheetId) {
                        // Parse activeSpreadsheetId to verify it exists
                        const { spreadsheetId, identifier } = parseGoogleSheetsConnectionValue(activeSpreadsheetId);
                        const exists = googleSheetsConnections.some((conn: any) => 
                          conn.spreadsheetId === spreadsheetId && 
                          (identifier === null || conn.sheetName === identifier || conn.id === identifier)
                        );
                        if (exists) return activeSpreadsheetId;
                      }
                      // Default to first connection if available
                      const defaultConn = googleSheetsConnections[0];
                      if (defaultConn) {
                        return getGoogleSheetsConnectionValue(defaultConn);
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
                          <SelectItem key={conn.id} value={getGoogleSheetsConnectionValue(conn)}>
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
                {sheetsData ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Badge variant="outline" className="text-xs">
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Active: {activeGoogleSheetsSourceScope?.displayName || 'Unknown'}
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
                ) : (
                  <div className="h-5" aria-hidden="true" />
                )}
                </>
              )}
            </div>
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

                <TabsContent value="data" className="mt-6 space-y-6">
                  {renderGoogleSheetsFinancialCards()}
                  {renderGoogleSheetsCampaignScopeCard()}

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

                <TabsContent value="data" className="mt-6 space-y-6">
                  {renderGoogleSheetsFinancialCards()}
                  {renderGoogleSheetsCampaignScopeCard()}

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
                      const sections = sheetsData?.summary?.detectedColumns && sheetsData.summary.detectedColumns.length > 0
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
                        const displayColumns = getExecutiveSummaryColumns(section.detectedColumns || []);
                        const { hero, supporting } = classifyColumns(displayColumns);
                        const categoricalColumns = section.categoricalColumns || [];

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
                                    {displayColumns.length} metrics
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
                                          {formatSummaryValue(getSummaryMetricDisplayValue(col), col.type, col.name)}
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
                                          {formatSummaryValue(getSummaryMetricDisplayValue(col), col.type, col.name)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              <div className="border-t border-slate-100 mt-6 mb-4" />
                              <div className="mb-2">
                                <p className="text-sm font-semibold text-foreground/80/60">Data Breakdown</p>
                              </div>
                              {categoricalColumns.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {categoricalColumns.map((cat: any) => {
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
                              ) : (
                                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                                  No categorical breakdown column detected for this selected spreadsheet.
                                </div>
                              )}

                              {/* Edge case: no metrics at all */}
                              {hero.length === 0 && supporting.length === 0 && categoricalColumns.length === 0 && (
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
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Key Performance Indicators</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Track Google Sheets KPIs from mapped source-backed metrics.
                          </p>
                        </div>
                        <Button onClick={() => setIsKpiModalOpen(true)} size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Create KPI
                        </Button>
                      </div>

                      <Card>
                        <CardContent className="p-5 space-y-5">
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Total KPIs</p>
                                    <p className="text-2xl font-bold text-foreground">{googleSheetsKpiTracker.total}</p>
                                  </div>
                                  <Target className="w-8 h-8 text-purple-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Above Target</p>
                                    <p className="text-2xl font-bold text-green-600">{googleSheetsKpiTracker.above}</p>
                                    <p className="text-xs text-muted-foreground">more than +5% above target</p>
                                  </div>
                                  <TrendingUp className="w-8 h-8 text-green-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">On Track</p>
                                    <p className="text-2xl font-bold text-blue-600">{googleSheetsKpiTracker.near}</p>
                                    <p className="text-xs text-muted-foreground">within +/-5% of target</p>
                                  </div>
                                  <CheckCircle2 className="w-8 h-8 text-blue-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Below Target</p>
                                    <p className="text-2xl font-bold text-red-600">{googleSheetsKpiTracker.below}</p>
                                    <p className="text-xs text-muted-foreground">more than -5% below target</p>
                                  </div>
                                  <AlertCircle className="w-8 h-8 text-red-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground/70">Avg. Progress</p>
                                    <p className="text-2xl font-bold text-foreground">{googleSheetsKpiTracker.avgPct.toFixed(1)}%</p>
                                  </div>
                                  <TrendingUp className="w-8 h-8 text-violet-600" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {googleSheetsKpiTracker.blocked > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                              {googleSheetsKpiTracker.blocked} KPI{googleSheetsKpiTracker.blocked === 1 ? "" : "s"} cannot be evaluated from the selected Google Sheets source. Blocked KPIs are excluded from scoring.
                            </div>
                          )}

                          {(kpisData as any[])?.length > 0 ? (
                            <div className="grid gap-6 lg:grid-cols-2">
                        {(kpisData as any[]).map((kpi: any) => {
                          const resolved = resolveGoogleSheetsKpiMetric(kpi);
                          const currentVal = resolved.currentValue;
                          const targetVal = parseSheetMetricNumber(kpi.targetValue);
                          const col = resolved.option;
                          const displayUnit = String(kpi.unit || col?.unit || "");
                          const progress = resolved.available && currentVal !== null && targetVal !== null && targetVal > 0
                            ? computeGoogleSheetsKpiProgress(kpi, currentVal, targetVal)
                            : null;
                          const metricLabel = String(kpi.metric || kpi.metricKey || kpi.name || "");
                          const { Icon, color } = getGoogleSheetsKpiIcon(metricLabel);
                          return (
                            <Card key={kpi.id}>
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                      <Icon className={`w-5 h-5 ${color}`} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <CardTitle className="text-lg truncate">{kpi.name}</CardTitle>
                                        {(kpi.metric || kpi.metricKey) && (
                                          <Badge variant="outline" className="bg-muted text-foreground/80 font-mono text-xs shrink-0">
                                            {kpi.metric || kpi.metricKey}
                                          </Badge>
                                        )}
                                        {kpi.alertsEnabled && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                                      </div>
                                    {kpi.description && (
                                        <CardDescription className="text-sm">{kpi.description}</CardDescription>
                                    )}
                                      <p className="text-xs text-muted-foreground/70 mt-1">
                                        Source: {resolved.sourceLabel || "Saved Google Sheets source unavailable"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingKpi(kpi);
                                        setKpiForm({
                                          name: kpi.name || "", unit: kpi.unit || col?.unit || "", description: kpi.description || "",
                                          metric: kpi.metric || kpi.metricKey || "", targetValue: String(kpi.targetValue || ""),
                                          currentValue: currentVal !== null ? String(currentVal) : "", priority: kpi.priority || "high",
                                          status: kpi.status || "active", timeframe: kpi.timeframe || "monthly",
                                          alertsEnabled: !!kpi.alertsEnabled, emailNotifications: !!kpi.emailNotifications,
                                          alertFrequency: kpi.alertFrequency || "immediate",
                                          alertThreshold: kpi.alertThreshold ? String(kpi.alertThreshold) : "",
                                          alertCondition: kpi.alertCondition || "below",
                                          emailRecipients: Array.isArray(kpi.emailRecipients) ? kpi.emailRecipients.join(', ') : (kpi.emailRecipients || ""),
                                        });
                                        setIsKpiModalOpen(true);
                                      }}
                                      title="Edit KPI"
                                      aria-label="Edit KPI"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50">
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

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                  <div className="bg-muted rounded-lg p-3">
                                    <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current</div>
                                    <div className="text-xl font-bold text-foreground">
                                      {currentVal !== null ? formatGoogleSheetsKpiCardValue(currentVal, displayUnit, col?.type) : "Unavailable"}
                                    </div>
                                  </div>
                                  <div className="bg-muted rounded-lg p-3">
                                    <div className="text-sm font-medium text-muted-foreground/70 mb-1">Target</div>
                                    <div className="text-xl font-bold text-foreground">
                                      {targetVal !== null ? formatGoogleSheetsKpiCardValue(targetVal, displayUnit, col?.type) : "Unavailable"}
                                    </div>
                                  </div>
                                </div>

                                {progress ? (
                                  <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                      <span>Progress</span>
                                      <span>{formatPct(progress.attainmentPct)}</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2">
                                      <div className={`h-2 rounded-full ${progress.progressColor}`} style={{ width: `${progress.fillPct}%` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground/70 mt-4">{resolved.reason}</p>
                                )}

                                {progress && progress.effectiveDeltaPct !== null && (
                                  <div className="mt-2 text-xs text-muted-foreground/70">
                                    {(() => {
                                      if (Math.abs(progress.effectiveDeltaPct) < 0.0001) return "At target";
                                      const absStr = formatPct(Math.abs(progress.effectiveDeltaPct)).replace("%", "");
                                      return progress.effectiveDeltaPct > 0
                                        ? `${absStr}% above target`
                                        : `${absStr}% below target`;
                                    })()}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                            </div>
                          ) : (
                            <div className="text-center py-10">
                              <Target className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                              <h3 className="text-lg font-medium text-foreground mb-2">No KPIs Yet</h3>
                              <p className="text-muted-foreground/70">
                                Create your first KPI from a mapped Google Sheets metric.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
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
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Performance Benchmarks</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Compare Google Sheets metrics against source-backed benchmark values.
                          </p>
                        </div>
                        <Button onClick={() => setIsBenchmarkModalOpen(true)} size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Benchmark
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Total Benchmarks</p><p className="text-2xl font-bold text-foreground">{googleSheetsBenchmarkTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">On Track</p><p className="text-2xl font-bold text-green-600">{googleSheetsBenchmarkTracker.onTrack}</p><p className="text-xs text-muted-foreground">90% or more of benchmark</p></div><CheckCircle2 className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Needs Attention</p><p className="text-2xl font-bold text-amber-600">{googleSheetsBenchmarkTracker.needsAttention}</p><p className="text-xs text-muted-foreground">70% to under 90% of benchmark</p></div><AlertCircle className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Behind</p><p className="text-2xl font-bold text-red-600">{googleSheetsBenchmarkTracker.behind}</p><p className="text-xs text-muted-foreground">below 70% of benchmark</p></div><AlertTriangle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground/70">Avg. Progress</p><p className="text-2xl font-bold text-foreground">{googleSheetsBenchmarkTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
                      </div>

                      {googleSheetsBenchmarkTracker.blocked > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          {googleSheetsBenchmarkTracker.blocked} Benchmark{googleSheetsBenchmarkTracker.blocked === 1 ? "" : "s"} cannot be evaluated from the selected Google Sheets source. Blocked Benchmarks are excluded from scoring.
                        </div>
                      )}

                      {(benchmarksData as any[])?.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                          {(benchmarksData as any[]).map((bm: any) => {
                            const resolved = resolveGoogleSheetsBenchmarkMetric(bm);
                            const currentVal = resolved.currentValue;
                            const benchmarkVal = parseSheetMetricNumber(bm.benchmarkValue);
                            const displayUnit = String(bm.unit || resolved.option?.unit || "");
                            const progress = resolved.available && currentVal !== null && benchmarkVal !== null && benchmarkVal > 0
                              ? computeGoogleSheetsBenchmarkProgress(bm, currentVal, benchmarkVal)
                              : null;
                            const metricLabel = String(bm.metric || bm.metricKey || bm.name || "");
                            const { Icon, color } = getGoogleSheetsKpiIcon(metricLabel);
                            const statusLabel = progress?.status === "on_track" ? "On Track" : progress?.status === "needs_attention" ? "Needs Attention" : "Behind";
                            const statusColor = progress?.status === "on_track" ? "text-green-600" : progress?.status === "needs_attention" ? "text-yellow-600" : "text-red-600";
                            const delta = Number.isFinite(progress?.deltaPct) ? progress?.deltaPct || 0 : 0;
                            const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
                            return (
                              <Card key={bm.id}>
                                <CardContent className="p-6">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 min-w-0">
                                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <Icon className={`w-5 h-5 ${color}`} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <CardTitle className="text-lg truncate">{bm.name}</CardTitle>
                                          {(bm.metric || bm.metricKey) && (
                                            <Badge variant="outline" className="bg-muted text-foreground/80 font-mono text-xs shrink-0">
                                              {bm.metric || bm.metricKey}
                                            </Badge>
                                          )}
                                          {bm.alertsEnabled && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                                        </div>
                                        {bm.description && <CardDescription className="text-sm">{bm.description}</CardDescription>}
                                        <p className="text-xs text-muted-foreground/70 mt-1">
                                          Source: {resolved.sourceLabel || "Saved Google Sheets source unavailable"}
                                        </p>
                                        {bm.industry && <p className="text-xs text-muted-foreground/70 mt-1">Industry: {bm.industry}</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setEditingBenchmark(bm);
                                          const editUnit = String(bm.unit || resolved.option?.unit || "");
                                          setBenchmarkForm({
                                            name: bm.name || "", unit: editUnit, description: bm.description || "",
                                            metric: bm.metric || bm.metricKey || "",
                                            benchmarkValue: formatGoogleSheetsBenchmarkInputValue(bm.benchmarkValue, editUnit, resolved.option?.type),
                                            currentValue: currentVal !== null ? String(currentVal) : "",
                                            alertsEnabled: !!bm.alertsEnabled, emailNotifications: !!bm.emailNotifications,
                                            alertFrequency: bm.alertFrequency || "immediate",
                                            alertThreshold: bm.alertThreshold ? formatGoogleSheetsBenchmarkInputValue(bm.alertThreshold, editUnit, resolved.option?.type) : "",
                                            alertCondition: bm.alertCondition || "below",
                                            emailRecipients: Array.isArray(bm.emailRecipients) ? bm.emailRecipients.join(', ') : (bm.emailRecipients || ""),
                                          });
                                          setIsBenchmarkModalOpen(true);
                                        }}
                                        title="Edit Benchmark"
                                        aria-label="Edit Benchmark"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50">
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

                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="bg-muted rounded-lg p-3">
                                      <div className="text-sm font-medium text-muted-foreground/70 mb-1">Current</div>
                                      <div className="text-xl font-bold text-foreground">
                                        {currentVal !== null ? formatGoogleSheetsKpiCardValue(currentVal, displayUnit, resolved.option?.type) : "Unavailable"}
                                      </div>
                                    </div>
                                    <div className="bg-muted rounded-lg p-3">
                                      <div className="text-sm font-medium text-muted-foreground/70 mb-1">Benchmark</div>
                                      <div className="text-xl font-bold text-foreground">
                                        {benchmarkVal !== null ? formatGoogleSheetsKpiCardValue(benchmarkVal, displayUnit, resolved.option?.type) : "Unavailable"}
                                      </div>
                                    </div>
                                  </div>

                                  {progress ? (
                                    <div className="mt-4 space-y-3">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                                          <span>Progress</span>
                                          <span>{progress.labelPct}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                          <div className={`h-2 rounded-full ${progress.color}`} style={{ width: `${progress.pct}%` }} />
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground/70">Performance</span>
                                        <div className="flex items-center space-x-2">
                                          <span className={`font-medium ${statusColor}`}>{deltaLabel}</span>
                                          {delta >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                                          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground/70 mt-4">{resolved.reason}</p>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="text-center py-12">
                            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/70 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Benchmarks Yet</h3>
                            <p className="text-muted-foreground/70 mb-4">
                              Create your first Benchmark from a mapped Google Sheets metric.
                            </p>
                            <Button onClick={() => setIsBenchmarkModalOpen(true)}>
                              <Plus className="w-4 h-4 mr-2" />
                              Create Your First Benchmark
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ═══ INSIGHTS TAB ═══ */}
                <TabsContent value="insights" className="mt-6">
                  {sheetsData?.insights ? (
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
                          <h2 className="text-2xl font-bold text-foreground">Google Sheets Reports</h2>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            Schedule and generate reports from your Google Sheets data
                          </p>
                        </div>
                        <Button onClick={() => { resetGoogleSheetsReportCreateState(); setIsReportModalOpen(true); }} variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Report
                        </Button>
                      </div>

                      <div className="grid gap-4">
                        {(reportsData as any[]).map((report: any) => {
                          const reportConfig = parseGoogleSheetsReportConfiguration(report.configuration);
                          const reportScope = getSavedGoogleSheetsSourceScope({ configuration: reportConfig });
                          const reportSourceLabel = reportScope?.displayName || "Saved Google Sheets source unavailable";
                          return (
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
                                  <p className="text-xs text-muted-foreground/70 mt-1">Source: {reportSourceLabel}</p>
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
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      void downloadGoogleSheetsReport({
                                        reportType: String(report.reportType || "overview"),
                                        configuration: parseGoogleSheetsReportConfiguration(report.configuration),
                                        reportName: String(report.name || "Google Sheets Report"),
                                      }).catch((error: any) => toast({
                                        title: "Failed to generate report",
                                        description: error?.message || "An unexpected error occurred",
                                        variant: "destructive",
                                      }));
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const nextForm = {
                                        name: report.name || "", description: report.description || "",
                                        reportType: report.reportType || "overview",
                                        scheduleEnabled: !!report.scheduleEnabled,
                                        scheduleFrequency: report.scheduleFrequency || "daily",
                                        scheduleDayOfWeek: dayOfWeekIntToKey(report.scheduleDayOfWeek),
                                        scheduleDayOfMonth: report.scheduleDayOfMonth === 0 ? "last" : String(report.scheduleDayOfMonth || "first"),
                                        quarterTiming: report.quarterTiming || "end",
                                        scheduleTime: from24HourTo12Hour(report.scheduleTime),
                                        emailRecipients: Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.join(', ') : "",
                                        status: report.status || "active",
                                      };
                                      const nextModalStep = report.reportType === "custom" ? "custom" : "standard";
                                      const nextConfig = parseGoogleSheetsReportConfiguration(report.configuration);
                                      setEditingReportId(report.id);
                                      setReportForm(nextForm);
                                      setReportModalStep(nextModalStep);
                                      setCustomReportConfig(nextConfig);
                                      setExpandedCustomReportSections({});
                                      setReportFormErrors({});
                                      setReportEditSnapshot(serializeGoogleSheetsReportState(nextForm, nextConfig, nextModalStep));
                                      setIsReportModalOpen(true);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
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
                        );
                        })}
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
                        <Button onClick={() => { resetGoogleSheetsReportCreateState(); setIsReportModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
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

          {campaignId && (
            <AddRevenueWizardModal
              open={isRevenueWizardOpen}
              onOpenChange={(open) => {
                setIsRevenueWizardOpen(open);
                if (!open) setRevenueWizardInitialSource(null);
              }}
              campaignId={campaignId}
              currency={(campaign as any)?.currency || googleSheetsRevenueCurrency || "USD"}
              dateRange="90days"
              platformContext="google_sheets"
              initialSource={revenueWizardInitialSource || undefined}
              onSuccess={() => {
                void refreshGoogleSheetsRevenueQueries();
              }}
            />
          )}

          {campaignId && (
            <AddSpendWizardModal
              campaignId={campaignId}
              open={isSpendWizardOpen}
              onOpenChange={(open) => {
                setIsSpendWizardOpen(open);
                if (!open) setSpendWizardInitialSource(null);
              }}
              currency={(campaign as any)?.currency || googleSheetsRevenueCurrency || "USD"}
              dateRange="90days"
              platformContext="google_sheets"
              initialSource={spendWizardInitialSource || undefined}
              onProcessed={() => {
                void refreshGoogleSheetsRevenueQueries();
              }}
            />
          )}

          <Dialog open={showSpendSourcesDialog} onOpenChange={setShowSpendSourcesDialog}>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Google Sheets Spend Sources</DialogTitle>
                <DialogDescription className="text-muted-foreground/70">
                  Sources contributing to Google Sheets Total Spend.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {activeGoogleSheetsSpendSources.length > 0 ? activeGoogleSheetsSpendSources.map((source: any) => (
                  <div key={source.sourceId} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground" title={googleSheetsSpendSourceLabel(source)}>
                        {googleSheetsSpendSourceLabel(source)}
                      </p>
                      <p className="text-xs text-muted-foreground/70">{spendSourceTypeLabel(source.sourceType)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums text-foreground">
                        {fmtCurrency(Number(source.spend || 0))}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSpendSourcesDialog(false);
                          setSpendWizardInitialSource({
                            id: source.sourceId,
                            sourceType: source.sourceType,
                            displayName: source.displayName,
                            mappingConfig: source.mappingConfig,
                          });
                          setIsSpendWizardOpen(true);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground"
                        title="Edit spend source"
                        aria-label="Edit spend source"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSpendSourcesDialog(false);
                          setDeletingSpendSourceId(String(source.sourceId));
                        }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/70 hover:text-red-600"
                        title="Remove spend source"
                        aria-label="Remove spend source"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground/70">No Google Sheets spend sources connected.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showRevenueSourcesDialog} onOpenChange={setShowRevenueSourcesDialog}>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Google Sheets Revenue Sources</DialogTitle>
                <DialogDescription className="text-muted-foreground/70">
                  Sources contributing to Google Sheets Total Revenue.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {activeGoogleSheetsRevenueSources.length > 0 ? activeGoogleSheetsRevenueSources.map((source: any) => {
                  const cfg = parseRevenueSourceConfig(source);
                  const selectedCount = Array.isArray(cfg?.selectedValues) ? cfg.selectedValues.length : 0;
                  return (
                    <div key={source.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground" title={googleSheetsRevenueSourceLabel(source)}>
                          {googleSheetsRevenueSourceLabel(source)}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {revenueSourceTypeLabel(source.sourceType)}{selectedCount > 0 ? ` - ${selectedCount} selected attribution value${selectedCount === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-foreground">
                          {fmtCurrency(Number(source.lastTotalRevenue || 0))}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRevenueSourcesDialog(false);
                            setRevenueWizardInitialSource(source);
                            setIsRevenueWizardOpen(true);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground"
                          title="Edit revenue source"
                          aria-label="Edit revenue source"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRevenueSourceId(String(source.id))}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/70 hover:text-red-600"
                          title="Remove revenue source"
                          aria-label="Remove revenue source"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground/70">No Google Sheets revenue sources connected.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showPipelineProxySourcesDialog} onOpenChange={setShowPipelineProxySourcesDialog}>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Pipeline Proxy Sources</DialogTitle>
                <DialogDescription className="text-muted-foreground/70">
                  Sources contributing to Google Sheets Pipeline Proxy.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {googleSheetsPipelineProxySourceEntries.map((entry: any) => (
                  <div key={entry.sourceId} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{entry.providerLabel}</p>
                      <p className="font-medium tabular-nums text-foreground">{fmtCurrency(Number(entry.totalToDate || 0))}</p>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground/70">
                      {Array.isArray(entry.campaignValues) && entry.campaignValues.length > 0 ? (
                        entry.campaignValues.map((value: any, index: number) => (
                          <p key={`${entry.sourceId}-${index}`}>
                            {[`Stage: ${entry.pipelineStageLabel}`, String(value || "").trim()].filter(Boolean).join(" | ")}
                          </p>
                        ))
                      ) : (
                        <p>{entry.pipelineStageLabel}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deletingRevenueSourceId} onOpenChange={(open) => { if (!open) setDeletingRevenueSourceId(null); }}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Remove revenue source?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground/70">
                  This removes only the selected Google Sheets revenue source. Total Revenue will be recalculated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (deletingRevenueSourceId) {
                      deleteGoogleSheetsRevenueSourceMutation.mutate(deletingRevenueSourceId);
                    }
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!deletingSpendSourceId} onOpenChange={(open) => { if (!open) setDeletingSpendSourceId(null); }}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Remove spend source?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground/70">
                  This removes only the selected Google Sheets spend source. Total Spend, ROAS, and ROI will be recalculated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (deletingSpendSourceId) {
                      deleteGoogleSheetsSpendSourceMutation.mutate(deletingSpendSourceId);
                    }
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ═══ KPI Modal ═══ */}
          <GoogleSheetsKpiModal
            isOpen={isKpiModalOpen}
            setIsOpen={setIsKpiModalOpen}
            editing={editingKpi}
            setEditing={setEditingKpi}
            form={kpiForm}
            setForm={setKpiForm}
            metricOptions={googleSheetsKpiMetricOptions}
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
            metricOptions={googleSheetsKpiMetricOptions}
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
            expandedSections={expandedCustomReportSections}
            setExpandedSections={setExpandedCustomReportSections}
            detectedColumns={sheetsData?.summary?.detectedColumns || []}
            kpisData={kpisData}
            benchmarksData={benchmarksData}
            handleTypeSelect={handleReportTypeSelect}
            handleCreate={handleCreateReport}
            handleUpdate={handleUpdateReport}
            handleCustom={handleCustomReport}
            hasChanges={reportHasChanges}
            createMutation={createReportMutation}
            updateMutation={updateReportMutation}
          />
        </main>
      </div>
    </div>
  );
}

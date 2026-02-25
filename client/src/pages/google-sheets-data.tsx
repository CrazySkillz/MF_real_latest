import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, setLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Calendar, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, CheckCircle2, XCircle, AlertCircle, Loader2, Star, Plus, Trash2, X } from "lucide-react";
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
        return { success: false, connections: [] };
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

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Campaign not found</h2>
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
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
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Sheets Data</h1>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Marketing data for {campaign.name}</p>
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
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
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
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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
                          <span className="text-slate-500"> (filtered from {sheetsData.totalRows.toLocaleString()} total)</span>
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
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Failed to Load Data</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
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
                  <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
              </div>
              <Tabs defaultValue="data" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
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
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 shadow-lg border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">Loading...</span>
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
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
                  <TabsTrigger value="connections">Connection Details</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Spreadsheet Data
                      </CardTitle>
                      <CardDescription>
                        {sheetsData.totalRows} rows • Last updated {new Date(sheetsData.lastUpdated).toLocaleString()}
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
                          <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                          <p className="text-slate-600 dark:text-slate-400">No data available</p>
                          <p className="text-sm text-slate-500 mt-2">
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
                            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                            <p className="text-slate-600 dark:text-slate-400 mb-4">
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
                                  className="border-slate-200 dark:border-slate-700"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                                              {conn.spreadsheetName || `Sheet ${conn.spreadsheetId?.slice(0, 8)}...`}
                                            </h4>
                                          </div>
                                          <div className="space-y-0.5">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                              {conn.spreadsheetId}
                                            </p>
                                            {conn.sheetName && (
                                              <p className="text-xs text-slate-600 dark:text-slate-300">
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
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
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
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Data Available</h3>
                <p className="text-slate-500 dark:text-slate-400">Unable to load Google Sheets data for this campaign.</p>
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
        </main>
      </div>
    </div>
  );
}

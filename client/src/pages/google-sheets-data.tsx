import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, FileSpreadsheet, Calendar, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiGooglesheets } from "react-icons/si";
import { useEffect } from "react";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface GoogleSheetsData {
  spreadsheetName: string;
  spreadsheetId: string;
  totalRows: number;
  lastUpdated: string;
  headers: string[];
  data: any[][];
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
  const campaignId = params?.id;

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: sheetsData, isLoading: sheetsLoading, isFetching: sheetsFetching, status: sheetsStatus, error: sheetsError, refetch } = useQuery<GoogleSheetsData>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    refetchInterval: 300000, // Auto-refresh every 5 minutes
    refetchIntervalInBackground: true, // Continue refreshing when tab is in background
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    staleTime: 0, // Always consider data stale - force fresh fetch
    gcTime: 0, // Don't cache the data (TanStack Query v5)
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        const errorData = await response.json();
        
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
        
        throw new Error(errorData.error || errorData.message || 'Failed to fetch Google Sheets data');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Google Sheets data request failed');
      }
      
      return data;
    },
  });
  
  // Determine if we're in a loading state (initial load or refetch)
  // Show loading if: actively loading, fetching without data, or query is pending (hasn't started yet)
  // Priority: Always show loading if we don't have data yet and there's no error (prevents "No Data Available" flash)
  const isDataLoading = sheetsLoading || sheetsFetching || (sheetsStatus === 'pending' && !sheetsError) || (!sheetsData && !sheetsError && !!campaignId && sheetsStatus !== 'error');


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

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };


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
                  Auto-refreshing every 5 min
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
                {sheetsData?.spreadsheetId && (
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
                    : sheetsError.message}
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
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
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
            <>
              <Tabs defaultValue="data" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
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

                <TabsContent value="summary" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Summary</CardTitle>
                      <CardDescription>
                        {sheetsData.summary?.detectedColumns && sheetsData.summary.detectedColumns.length > 0 
                          ? `Dynamically detected and aggregated ${sheetsData.summary.detectedColumns.length} numeric columns from your spreadsheet`
                          : 'Overview of your marketing data from Google Sheets'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-6">
                        {/* Data Overview Section */}
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Data Overview</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Rows</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(sheetsData.totalRows)}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Columns</div>
                              <div className="text-2xl font-bold text-slate-900 dark:text-white">{sheetsData.headers?.length || 0}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Numeric Columns</div>
                              <div className="text-2xl font-bold text-green-600">{sheetsData.summary?.detectedColumns?.length || 0}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Dynamically Detected Metrics */}
                        {sheetsData.summary?.detectedColumns && sheetsData.summary.detectedColumns.length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                              Aggregated Metrics
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {sheetsData.summary.detectedColumns.map((col) => (
                                <div key={col.name} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{col.name}</div>
                                    <Badge variant="outline" className="text-xs">
                                      {col.type === 'currency' ? '$' : col.type === 'decimal' ? '#.#' : '#'}
                                    </Badge>
                                  </div>
                                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {col.type === 'currency' 
                                      ? formatCurrency(col.total)
                                      : col.type === 'decimal'
                                      ? col.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      : formatNumber(Math.round(col.total))
                                    }
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                    Column {col.index + 1} • Sum of {sheetsData.totalRows} rows
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fallback: Show message if no numeric columns detected */}
                        {(!sheetsData.summary?.detectedColumns || sheetsData.summary.detectedColumns.length === 0) && (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Numeric Data Detected</h4>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                              Your spreadsheet doesn't appear to contain numeric columns that can be aggregated. 
                              Make sure your data includes columns with numbers (e.g., impressions, clicks, spend).
                            </p>
                          </div>
                        )}

                        {/* Last Updated */}
                        <div className="text-center text-sm text-slate-500 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700">
                          Last updated: {new Date(sheetsData.lastUpdated).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insights" className="mt-6">
                  <div className="space-y-6">
                    {sheetsData.insights ? (
                      <>
                        {/* Recommendations Section */}
                        {sheetsData.insights.recommendations && sheetsData.insights.recommendations.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-yellow-600" />
                                Key Recommendations
                              </CardTitle>
                              <CardDescription>
                                Actionable insights based on your data analysis
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {sheetsData.insights.recommendations.map((rec, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`p-4 rounded-lg border-l-4 ${
                                      rec.priority === 'high' 
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-500' 
                                        : rec.priority === 'medium'
                                        ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500'
                                        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-500'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          {rec.type === 'alert' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                                          {rec.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                                          {rec.type === 'opportunity' && <Target className="w-4 h-4 text-green-600" />}
                                          <span className="font-semibold text-slate-900 dark:text-white">
                                            {rec.metric}
                                          </span>
                                          <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                            {rec.priority.toUpperCase()}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                          {rec.message}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                          → {rec.action}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Top Performers */}
                          {sheetsData.insights.topPerformers && sheetsData.insights.topPerformers.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <TrendingUp className="w-5 h-5 text-green-600" />
                                  Top Performers
                                </CardTitle>
                                <CardDescription>
                                  Highest performing data points
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {sheetsData.insights.topPerformers.slice(0, 6).map((perf, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                                          {perf.metric}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Row {perf.rowNumber}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-green-700 dark:text-green-400">
                                          {perf.type === 'currency' 
                                            ? formatCurrency(perf.value)
                                            : perf.type === 'decimal'
                                            ? perf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : formatNumber(Math.round(perf.value))
                                          }
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          {perf.percentOfTotal.toFixed(1)}% of total
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Bottom Performers */}
                          {sheetsData.insights.bottomPerformers && sheetsData.insights.bottomPerformers.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <TrendingDown className="w-5 h-5 text-red-600" />
                                  Areas for Improvement
                                </CardTitle>
                                <CardDescription>
                                  Lowest performing data points
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {sheetsData.insights.bottomPerformers.slice(0, 6).map((perf, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                                          {perf.metric}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Row {perf.rowNumber}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-red-700 dark:text-red-400">
                                          {perf.type === 'currency' 
                                            ? formatCurrency(perf.value)
                                            : perf.type === 'decimal'
                                            ? perf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : formatNumber(Math.round(perf.value))
                                          }
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          {perf.percentOfTotal.toFixed(1)}% of total
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Trends */}
                        {sheetsData.insights.trends && sheetsData.insights.trends.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Performance Trends
                              </CardTitle>
                              <CardDescription>
                                How your metrics are changing over time
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sheetsData.insights.trends.map((trend, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`p-4 rounded-lg ${
                                      trend.direction === 'increasing' 
                                        ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800' 
                                        : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      {trend.direction === 'increasing' ? (
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                      ) : (
                                        <TrendingDown className="w-4 h-4 text-red-600" />
                                      )}
                                      <span className="font-semibold text-slate-900 dark:text-white">
                                        {trend.metric}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                                      {trend.message}
                                    </p>
                                    <div className={`text-lg font-bold ${
                                      trend.direction === 'increasing' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                    }`}>
                                      {trend.direction === 'increasing' ? '+' : '-'}{trend.percentChange.toFixed(1)}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Correlations */}
                        {sheetsData.insights.correlations && sheetsData.insights.correlations.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-purple-600" />
                                Metric Correlations
                              </CardTitle>
                              <CardDescription>
                                Relationships between your metrics
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {sheetsData.insights.correlations.map((corr, idx) => (
                                  <div key={idx} className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                          {corr.metric1} ↔ {corr.metric2}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                          {corr.strength} {corr.direction}
                                        </Badge>
                                      </div>
                                      <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                                        {(corr.correlation * 100).toFixed(0)}%
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                      {corr.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Data Quality */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-blue-600" />
                              Data Quality
                            </CardTitle>
                            <CardDescription>
                              Health check of your spreadsheet data
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Completeness</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {sheetsData.insights.dataQuality.completeness.toFixed(1)}%
                                </div>
                                <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${
                                      sheetsData.insights.dataQuality.completeness >= 90 
                                        ? 'bg-green-600' 
                                        : sheetsData.insights.dataQuality.completeness >= 70
                                        ? 'bg-yellow-600'
                                        : 'bg-red-600'
                                    }`}
                                    style={{ width: `${sheetsData.insights.dataQuality.completeness}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Missing Values</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {sheetsData.insights.dataQuality.missingValues}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                  {sheetsData.insights.dataQuality.missingValues === 0 ? 'Perfect!' : 'Data points with no value'}
                                </div>
                              </div>
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Outliers Detected</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {sheetsData.insights.dataQuality.outliers.length}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                  {sheetsData.insights.dataQuality.outliers.length === 0 ? 'All values normal' : 'Values requiring review'}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Anomalies */}
                        {sheetsData.insights.anomalies && sheetsData.insights.anomalies.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                                Anomalies Detected
                              </CardTitle>
                              <CardDescription>
                                Data points that deviate significantly from the norm
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {sheetsData.insights.anomalies.slice(0, 8).map((anomaly, idx) => (
                                  <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                          {anomaly.metric} - Row {anomaly.rowNumber}
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                          {anomaly.message}
                                        </div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <div className="text-sm font-bold text-orange-700 dark:text-orange-400">
                                          {anomaly.type === 'currency' 
                                            ? formatCurrency(anomaly.value)
                                            : anomaly.type === 'decimal'
                                            ? anomaly.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : formatNumber(Math.round(anomaly.value))
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                      <Card>
                        <CardContent className="text-center py-12">
                          <Lightbulb className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Insights Available</h3>
                          <p className="text-slate-500 dark:text-slate-400">
                            Insights will be generated once we have enough data to analyze.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Data Available</h3>
                <p className="text-slate-500 dark:text-slate-400">Unable to load Google Sheets data for this campaign.</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
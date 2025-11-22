import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, FileSpreadsheet, Calendar, RefreshCw } from "lucide-react";
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
}

export default function GoogleSheetsData() {
  const [, params] = useRoute("/campaigns/:id/google-sheets-data");
  const campaignId = params?.id;

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: sheetsData, isLoading: sheetsLoading, error: sheetsError, refetch } = useQuery<GoogleSheetsData>({
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
        throw new Error(errorData.error || 'Failed to fetch Google Sheets data');
      }
      return response.json();
    },
  });


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

          {sheetsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : sheetsError ? (
            <Card className="mb-8">
              <CardContent className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Failed to Load Data</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {sheetsError.message.includes('TOKEN_EXPIRED') || sheetsError.message.includes('401') 
                    ? 'Your Google Sheets connection has expired. Please reconnect to continue accessing your data.'
                    : sheetsError.message}
                </p>
                <div className="flex gap-3 justify-center">
                  {sheetsError.message.includes('TOKEN_EXPIRED') || sheetsError.message.includes('401') ? (
                    <Link href="/campaigns">
                      <Button>
                        Reconnect Google Sheets
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
          ) : sheetsData ? (
            <>
              <Tabs defaultValue="data" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
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
                      {sheetsLoading ? (
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                          ))}
                        </div>
                      ) : sheetsData.data && sheetsData.data.length > 0 ? (
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
                              <Badge variant="secondary" className="ml-2 text-xs">Auto-detected</Badge>
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
                                      ? col.total.toFixed(2).toLocaleString()
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
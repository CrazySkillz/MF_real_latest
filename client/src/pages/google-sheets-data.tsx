import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, FileSpreadsheet, TrendingUp, Download, Calendar, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiGooglesheets } from "react-icons/si";

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

  const { data: sheetsData, isLoading: sheetsLoading, error: sheetsError } = useQuery<GoogleSheetsData>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Google Sheets data');
      }
      const data = await response.json();
      console.log('Frontend received Google Sheets data:', {
        hasData: !!data,
        totalRows: data.totalRows,
        hasHeaders: data.headers && data.headers.length > 0,
        headersCount: data.headers?.length || 0,
        headers: data.headers,
        hasDataRows: data.data && data.data.length > 0,
        dataRowsCount: data.data?.length || 0,
        firstDataRow: data.data?.[0],
        dataStructure: typeof data.data,
        rawData: data
      });
      return data;
    },
  });

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
                  {sheetsData?.spreadsheetName && (
                    <Badge variant="outline" className="mt-2">
                      Spreadsheet: {sheetsData.spreadsheetName}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {sheetsData?.spreadsheetId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(`https://docs.google.com/spreadsheets/d/${sheetsData.spreadsheetId}/edit`, '_blank');
                    }}
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
                <p className="text-slate-500 dark:text-slate-400 mb-4">{sheetsError.message}</p>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : sheetsData ? (
            <>
              {/* Summary Cards */}
              {sheetsData.summary && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                  {sheetsData.summary.totalImpressions !== undefined && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Impressions</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatNumber(sheetsData.summary.totalImpressions)}
                            </p>
                          </div>
                          <BarChart3 className="w-8 h-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sheetsData.summary.totalClicks !== undefined && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clicks</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatNumber(sheetsData.summary.totalClicks)}
                            </p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sheetsData.summary.totalSpend !== undefined && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatCurrency(sheetsData.summary.totalSpend)}
                            </p>
                          </div>
                          <Download className="w-8 h-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sheetsData.summary.averageCTR !== undefined && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Average CTR</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {formatPercentage(sheetsData.summary.averageCTR)}
                            </p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Data Table */}
              <Tabs defaultValue="data" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="data">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            Spreadsheet Data
                          </CardTitle>
                          <CardDescription>
                            {sheetsData.totalRows} rows • Last updated {new Date(sheetsData.lastUpdated).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">
                          <Calendar className="w-3 h-3 mr-1" />
                          Live Data
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {sheetsData.headers?.map((header, index) => (
                                <TableHead key={index} className="font-semibold">
                                  {header}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sheetsData.data?.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                  <TableCell key={cellIndex} className="font-mono text-sm">
                                    {cell}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="summary">
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Summary</CardTitle>
                      <CardDescription>Overview of your marketing data from Google Sheets</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Data Overview</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Total Rows:</span>
                              <span className="font-semibold">{formatNumber(sheetsData.totalRows)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Columns:</span>
                              <span className="font-semibold">{sheetsData.headers?.length || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Last Updated:</span>
                              <span className="font-semibold">{new Date(sheetsData.lastUpdated).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {sheetsData.summary && (
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Performance Metrics</h4>
                            <div className="space-y-3">
                              {sheetsData.summary.totalImpressions !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Total Impressions:</span>
                                  <span className="font-semibold">{formatNumber(sheetsData.summary.totalImpressions)}</span>
                                </div>
                              )}
                              {sheetsData.summary.totalClicks !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Total Clicks:</span>
                                  <span className="font-semibold">{formatNumber(sheetsData.summary.totalClicks)}</span>
                                </div>
                              )}
                              {sheetsData.summary.totalSpend !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Total Spend:</span>
                                  <span className="font-semibold">{formatCurrency(sheetsData.summary.totalSpend)}</span>
                                </div>
                              )}
                              {sheetsData.summary.averageCTR !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Average CTR:</span>
                                  <span className="font-semibold">{formatPercentage(sheetsData.summary.averageCTR)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
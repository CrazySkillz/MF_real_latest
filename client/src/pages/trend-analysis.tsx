import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Brain, Calendar, Target, Users, Award, Zap, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Eye, MousePointer, DollarSign, Clock, Settings, Plus, X } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart } from "recharts";
import { format, subDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function TrendAnalysis() {
  const { id: campaignId } = useParams();
  const { toast } = useToast();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-trends"],
    enabled: !!campaignId && !!campaign && !!(campaign as any).trendKeywords?.length,
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
  });

  const updateKeywordsMutation = useMutation({
    mutationFn: async (data: { industry: string; trendKeywords: string[] }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-trends"] });
      toast({
        title: "Keywords Updated",
        description: "Google Trends tracking keywords have been configured successfully.",
      });
      setIsConfiguring(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update keywords. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleSaveKeywords = () => {
    // Auto-add any keyword that's currently in the input field
    let finalKeywords = [...keywords];
    if (newKeyword.trim() && !finalKeywords.includes(newKeyword.trim())) {
      finalKeywords.push(newKeyword.trim());
      setKeywords(finalKeywords);
      setNewKeyword("");
    }
    
    if (finalKeywords.length === 0) {
      toast({
        title: "No Keywords",
        description: "Please add at least one keyword to track.",
        variant: "destructive",
      });
      return;
    }
    updateKeywordsMutation.mutate({ industry, trendKeywords: finalKeywords });
  };

  // Hydrate form state from campaign data
  useEffect(() => {
    if (campaign && !isConfiguring) {
      setIndustry((campaign as any).industry || "");
      setKeywords((campaign as any).trendKeywords || []);
    }
  }, [campaign, isConfiguring]);

  // Process Google Trends data into chart-ready format
  const processedTrendsData = useMemo(() => {
    if (!trendsData || !(trendsData as any).trends) {
      return null;
    }

    const trends = (trendsData as any).trends;
    
    // Create time series data combining all keywords
    const timeSeriesData: any[] = [];
    const keywordStats: any = {};
    const monthlyData: any[] = [];
    
    // Get the longest dataset to use as time reference
    const longestDataset = trends.reduce((longest: any, current: any) => {
      return (current.data?.length || 0) > (longest.data?.length || 0) ? current : longest;
    }, trends[0] || { data: [] });

    // Process each time point
    (longestDataset.data || []).forEach((timePoint: any, index: number) => {
      const dataPoint: any = {
        date: format(new Date(parseInt(timePoint.time) * 1000), 'MMM dd'),
        timestamp: parseInt(timePoint.time) * 1000,
      };

      trends.forEach((trend: any, trendIndex: number) => {
        const value = trend.data?.[index]?.value?.[0] || 0;
        dataPoint[trend.keyword] = value;

        // Track keyword statistics
        if (!keywordStats[trend.keyword]) {
          keywordStats[trend.keyword] = {
            keyword: trend.keyword,
            values: [],
            color: COLORS[trendIndex % COLORS.length]
          };
        }
        keywordStats[trend.keyword].values.push(value);
      });

      timeSeriesData.push(dataPoint);
    });

    // Calculate statistics for each keyword
    Object.keys(keywordStats).forEach(keyword => {
      const values = keywordStats[keyword].values;
      const sum = values.reduce((a: number, b: number) => a + b, 0);
      const avg = values.length > 0 ? sum / values.length : 0;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const recent = values.slice(-7).reduce((a: number, b: number) => a + b, 0) / 7;
      const previous = values.slice(-14, -7).reduce((a: number, b: number) => a + b, 0) / 7;
      const trend = recent > previous ? 'up' : recent < previous ? 'down' : 'stable';
      const trendPercentage = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

      keywordStats[keyword] = {
        ...keywordStats[keyword],
        average: avg,
        max,
        min,
        recent,
        previous,
        trend,
        trendPercentage,
        totalInterest: sum
      };
    });

    // Process monthly aggregates
    const monthlyAggregates: any = {};
    timeSeriesData.forEach(point => {
      const month = format(new Date(point.timestamp), 'MMM');
      if (!monthlyAggregates[month]) {
        monthlyAggregates[month] = {};
        trends.forEach((trend: any) => {
          monthlyAggregates[month][trend.keyword] = [];
        });
      }
      trends.forEach((trend: any) => {
        monthlyAggregates[month][trend.keyword].push(point[trend.keyword] || 0);
      });
    });

    Object.keys(monthlyAggregates).forEach(month => {
      const monthData: any = { month };
      Object.keys(monthlyAggregates[month]).forEach(keyword => {
        const values = monthlyAggregates[month][keyword];
        monthData[keyword] = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      });
      monthlyData.push(monthData);
    });

    return {
      timeSeriesData,
      keywordStats,
      monthlyData,
      keywords: Object.keys(keywordStats)
    };
  }, [trendsData]);

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Campaign Not Found</h1>
              <p className="text-slate-600 dark:text-slate-400">Unable to load campaign data for trend analysis.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getVarianceBadge = (variance: number) => {
    if (variance > 15) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        <ArrowUpRight className="w-3 h-3 mr-1" />
        +{variance.toFixed(1)}%
      </Badge>;
    } else if (variance > 5) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        <ArrowUpRight className="w-3 h-3 mr-1" />
        +{variance.toFixed(1)}%
      </Badge>;
    } else if (variance > -5) {
      return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {variance.toFixed(1)}%
      </Badge>;
    } else {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
        <ArrowDownRight className="w-3 h-3 mr-1" />
        {variance.toFixed(1)}%
      </Badge>;
    }
  };

  const getTrendIcon = (variance: number) => {
    if (variance > 10) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (variance > 0) return <TrendingUp className="w-4 h-4 text-blue-600" />;
    return <TrendingDown className="w-4 h-4 text-orange-600" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${(campaign as any)?.id}`}>
                  <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Trend Analysis</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
              {(campaign as any)?.trendKeywords?.length > 0 && !isConfiguring && (
                <Button variant="outline" size="sm" onClick={() => {
                  setIsConfiguring(true);
                  setIndustry((campaign as any).industry || "");
                  setKeywords((campaign as any).trendKeywords || []);
                }} data-testid="button-configure-trends">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Keywords
                </Button>
              )}
            </div>
          </div>

          {/* Configuration Card */}
          {(!(campaign as any)?.trendKeywords?.length || isConfiguring) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Configure Industry Trend Tracking</span>
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Add keywords to track market trends from Google Trends. For example, if this is a wine campaign, add keywords like "wine", "red wine", "organic wine".
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                    Industry (Optional)
                  </label>
                  <Input
                    placeholder="e.g., Wine, Digital Marketing, Healthcare"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    data-testid="input-industry"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                    Trend Keywords *
                  </label>
                  <div className="flex items-center space-x-2 mb-3">
                    <Input
                      placeholder="e.g., wine"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                      data-testid="input-keyword"
                    />
                    <Button onClick={handleAddKeyword} size="sm" data-testid="button-add-keyword">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword, idx) => (
                        <Badge key={idx} variant="secondary" className="text-sm" data-testid={`badge-keyword-${idx}`}>
                          {keyword}
                          <button
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="ml-2 hover:text-red-600"
                            data-testid={`button-remove-keyword-${idx}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={handleSaveKeywords} 
                    disabled={updateKeywordsMutation.isPending}
                    data-testid="button-save-keywords"
                  >
                    {updateKeywordsMutation.isPending ? "Saving..." : "Save & Track Trends"}
                  </Button>
                  {isConfiguring && (campaign as any)?.trendKeywords?.length > 0 && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setIsConfiguring(false);
                        setKeywords([]);
                        setIndustry("");
                        setNewKeyword("");
                      }}
                      data-testid="button-cancel-configure"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trend Analysis Tabs */}
          {(campaign as any)?.trendKeywords?.length > 0 && !isConfiguring && (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="keyword-comparison">Keyword Comparison</TabsTrigger>
                <TabsTrigger value="seasonal-trends">Seasonal Trends</TabsTrigger>
                <TabsTrigger value="insights">Market Insights</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {trendsLoading ? (
                  <Card>
                    <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                      Loading Google Trends data...
                    </CardContent>
                  </Card>
                ) : !processedTrendsData ? (
                  <Card>
                    <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                      Unable to load trend data. Please try refreshing.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Keyword Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {processedTrendsData.keywords.map((keyword: string) => {
                        const stats = processedTrendsData.keywordStats[keyword];
                        return (
                          <Card key={keyword}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                "{keyword}"
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Search Interest</span>
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {Math.round(stats.recent)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">7-day avg</span>
                                <div className="flex items-center space-x-1">
                                  {stats.trend === 'up' ? (
                                    <ArrowUpRight className="w-3 h-3 text-green-600" />
                                  ) : stats.trend === 'down' ? (
                                    <ArrowDownRight className="w-3 h-3 text-red-600" />
                                  ) : null}
                                  <span className={stats.trend === 'up' ? 'text-green-600' : stats.trend === 'down' ? 'text-red-600' : 'text-slate-500'}>
                                    {stats.trendPercentage > 0 ? '+' : ''}{stats.trendPercentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <div className="pt-2 border-t dark:border-slate-700">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Peak: {Math.round(stats.max)}</span>
                                  <span>Avg: {Math.round(stats.average)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Search Interest Trend Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Activity className="w-5 h-5" />
                          <span>Search Interest Over Time (90 Days)</span>
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Google Trends search interest (0-100 scale)
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={processedTrendsData.timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis domain={[0, 100]} className="text-xs" label={{ value: 'Interest (0-100)', angle: -90, position: 'insideLeft' }} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'var(--background)', 
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px' 
                                }} 
                              />
                              {processedTrendsData.keywords.map((keyword: string, index: number) => (
                                <Line 
                                  key={keyword}
                                  type="monotone" 
                                  dataKey={keyword} 
                                  stroke={processedTrendsData.keywordStats[keyword].color}
                                  strokeWidth={2}
                                  name={keyword}
                                  dot={false}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Performing Keyword */}
                    <div className="grid gap-4 md:grid-cols-3">
                      {(() => {
                        const topKeyword = processedTrendsData.keywords.reduce((top: any, current: string) => {
                          const currentStats = processedTrendsData.keywordStats[current];
                          const topStats = top ? processedTrendsData.keywordStats[top] : null;
                          if (!top || currentStats.average > topStats.average) return current;
                          return top;
                        }, null);
                        
                        const trendingKeyword = processedTrendsData.keywords.reduce((top: any, current: string) => {
                          const currentStats = processedTrendsData.keywordStats[current];
                          const topStats = top ? processedTrendsData.keywordStats[top] : null;
                          if (!top || currentStats.trendPercentage > topStats.trendPercentage) return current;
                          return top;
                        }, null);

                        const topStats = topKeyword ? processedTrendsData.keywordStats[topKeyword] : null;
                        const trendingStats = trendingKeyword ? processedTrendsData.keywordStats[trendingKeyword] : null;

                        return (
                          <>
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center space-x-2">
                                  <Award className="w-4 h-4" />
                                  <span>Top Keyword</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                                    "{topKeyword}"
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Avg interest: {topStats ? Math.round(topStats.average) : 0}
                                  </div>
                                  <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    Highest Search Volume
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center space-x-2">
                                  <TrendingUp className="w-4 h-4" />
                                  <span>Trending Keyword</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                    "{trendingKeyword}"
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {trendingStats ? (trendingStats.trendPercentage > 0 ? '+' : '') : ''}{trendingStats ? trendingStats.trendPercentage.toFixed(1) : 0}% this week
                                  </div>
                                  <Badge className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Rising Interest
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center space-x-2">
                                  <Target className="w-4 h-4" />
                                  <span>Market Status</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                                    {trendsData.industry || 'Market'}
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Tracking {processedTrendsData.keywords.length} keyword{processedTrendsData.keywords.length > 1 ? 's' : ''}
                                  </div>
                                  <Badge className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                    Active Monitoring
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </TabsContent>

            {/* Keyword Comparison Tab */}
            <TabsContent value="keyword-comparison" className="space-y-6">
              {trendsLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading comparison data...
                  </CardContent>
                </Card>
              ) : !processedTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load comparison data. Please try refreshing.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Keyword Comparison Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <BarChart3 className="w-5 h-5" />
                        <span>Keyword Performance Comparison</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Average search interest by keyword (last 90 days)
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={processedTrendsData.keywords.map((keyword: string) => ({
                            keyword,
                            average: Math.round(processedTrendsData.keywordStats[keyword].average),
                            max: Math.round(processedTrendsData.keywordStats[keyword].max)
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="keyword" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'var(--background)', 
                                border: '1px solid var(--border)',
                                borderRadius: '6px' 
                              }} 
                            />
                            <Bar dataKey="average" fill="#3b82f6" name="Average Interest" />
                            <Bar dataKey="max" fill="#10b981" fillOpacity={0.6} name="Peak Interest" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Keyword Statistics Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Detailed Keyword Statistics</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {processedTrendsData.keywords.map((keyword: string) => {
                          const stats = processedTrendsData.keywordStats[keyword];
                          return (
                            <div key={keyword} className="p-4 border rounded-lg dark:border-slate-700">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stats.color }}></div>
                                  <span className="font-semibold text-slate-900 dark:text-white">"{keyword}"</span>
                                </div>
                                {stats.trend === 'up' ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    Trending Up
                                  </Badge>
                                ) : stats.trend === 'down' ? (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                    <TrendingDown className="w-3 h-3 mr-1" />
                                    Trending Down
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    Stable
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="block text-slate-500 text-xs">Avg Interest</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{Math.round(stats.average)}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-xs">Peak</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{Math.round(stats.max)}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-xs">Recent (7d)</span>
                                  <span className="text-slate-900 dark:text-white font-semibold">{Math.round(stats.recent)}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 text-xs">7d Change</span>
                                  <span className={`font-semibold ${stats.trend === 'up' ? 'text-green-600' : stats.trend === 'down' ? 'text-red-600' : 'text-slate-600'}`}>
                                    {stats.trendPercentage > 0 ? '+' : ''}{stats.trendPercentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Seasonal Trends Tab */}
            <TabsContent value="seasonal-trends" className="space-y-6">
              {trendsLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading seasonal data...
                  </CardContent>
                </Card>
              ) : !processedTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load seasonal data. Please try refreshing.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Monthly Trends Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5" />
                        <span>Monthly Search Interest Patterns</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Monthly average search interest for each keyword
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={processedTrendsData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="month" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'var(--background)', 
                                border: '1px solid var(--border)',
                                borderRadius: '6px' 
                              }} 
                            />
                            {processedTrendsData.keywords.map((keyword: string) => (
                              <Line 
                                key={keyword}
                                type="monotone" 
                                dataKey={keyword} 
                                stroke={processedTrendsData.keywordStats[keyword].color}
                                strokeWidth={2}
                                name={keyword}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Seasonal Insights */}
                  <div className="grid gap-4 md:grid-cols-3">
                    {(() => {
                      const peakKeyword = processedTrendsData.keywords.reduce((peak: any, current: string) => {
                        const currentStats = processedTrendsData.keywordStats[current];
                        const peakStats = peak ? processedTrendsData.keywordStats[peak] : null;
                        if (!peak || currentStats.max > peakStats.max) return current;
                        return peak;
                      }, null);

                      const mostStableKeyword = processedTrendsData.keywords.reduce((stable: any, current: string) => {
                        const currentStats = processedTrendsData.keywordStats[current];
                        const stableStats = stable ? processedTrendsData.keywordStats[stable] : null;
                        const currentVariance = currentStats.max - currentStats.min;
                        const stableVariance = stable ? stableStats.max - stableStats.min : Infinity;
                        if (currentVariance < stableVariance) return current;
                        return stable;
                      }, null);

                      const peakStats = peakKeyword ? processedTrendsData.keywordStats[peakKeyword] : null;
                      const stableStats = mostStableKeyword ? processedTrendsData.keywordStats[mostStableKeyword] : null;

                      return (
                        <>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Highest Peak</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">"{peakKeyword}"</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Peak interest: {peakStats ? Math.round(peakStats.max) : 0}
                                </div>
                                <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  Maximum Demand
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Most Stable</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">"{mostStableKeyword}"</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Variance: {stableStats ? Math.round(stableStats.max - stableStats.min) : 0}
                                </div>
                                <Badge className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                  Consistent Interest
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Data Period</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">90 Days</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Last 3 months
                                </div>
                                <Badge className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  Google Trends
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Market Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {trendsLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading market insights...
                  </CardContent>
                </Card>
              ) : !processedTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load market insights. Please try refreshing.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Key Market Insights */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="w-5 h-5" />
                        <span>Key Market Insights</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Data-driven insights from Google Trends analysis
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {processedTrendsData.keywords.map((keyword: string) => {
                          const stats = processedTrendsData.keywordStats[keyword];
                          let insightType = 'info';
                          let insightMessage = '';
                          
                          if (stats.trend === 'up' && stats.trendPercentage > 15) {
                            insightType = 'success';
                            insightMessage = `Strong momentum: "${keyword}" search interest increased ${stats.trendPercentage.toFixed(1)}% this week. Consider increasing ad spend to capitalize on growing demand.`;
                          } else if (stats.trend === 'down' && stats.trendPercentage < -15) {
                            insightType = 'warning';
                            insightMessage = `Declining interest: "${keyword}" searches dropped ${Math.abs(stats.trendPercentage).toFixed(1)}% recently. Consider refreshing creative or exploring alternative keywords.`;
                          } else if (stats.average > 60) {
                            insightType = 'success';
                            insightMessage = `High demand: "${keyword}" maintains strong search interest (avg: ${Math.round(stats.average)}). This keyword shows consistent market demand.`;
                          } else if (stats.average < 30) {
                            insightType = 'info';
                            insightMessage = `Niche opportunity: "${keyword}" has moderate search volume (avg: ${Math.round(stats.average)}). Focus on long-tail variations for better targeting.`;
                          } else {
                            insightType = 'info';
                            insightMessage = `Stable interest: "${keyword}" shows steady search patterns (avg: ${Math.round(stats.average)}). Good baseline keyword for consistent reach.`;
                          }

                          const bgColors = {
                            success: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
                            warning: 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800',
                            info: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          };

                          const iconColors = {
                            success: 'text-green-600 dark:text-green-400',
                            warning: 'text-orange-600 dark:text-orange-400',
                            info: 'text-blue-600 dark:text-blue-400'
                          };

                          const textColors = {
                            success: 'text-green-700 dark:text-green-300',
                            warning: 'text-orange-700 dark:text-orange-300',
                            info: 'text-blue-700 dark:text-blue-300'
                          };

                          const icons = {
                            success: CheckCircle,
                            warning: AlertTriangle,
                            info: Activity
                          };

                          const Icon = icons[insightType as keyof typeof icons];

                          return (
                            <div key={keyword} className={`p-4 rounded-lg ${bgColors[insightType as keyof typeof bgColors]}`}>
                              <div className="flex items-start space-x-3">
                                <Icon className={`w-5 h-5 mt-0.5 ${iconColors[insightType as keyof typeof iconColors]}`} />
                                <p className={`text-sm ${textColors[insightType as keyof typeof textColors]}`}>
                                  {insightMessage}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategic Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Strategic Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {(() => {
                          const topKeyword = processedTrendsData.keywords.reduce((top: any, current: string) => {
                            const currentStats = processedTrendsData.keywordStats[current];
                            const topStats = top ? processedTrendsData.keywordStats[top] : null;
                            if (!top || currentStats.average > topStats.average) return current;
                            return top;
                          }, null);

                          const trendingUp = processedTrendsData.keywords.filter((kw: string) => 
                            processedTrendsData.keywordStats[kw].trend === 'up'
                          );

                          const trendingDown = processedTrendsData.keywords.filter((kw: string) => 
                            processedTrendsData.keywordStats[kw].trend === 'down'
                          );

                          return (
                            <>
                              <div className="border-l-4 border-green-500 pl-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Capitalize on Demand</h4>
                                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                  <li>• Focus budget on "{topKeyword}" which shows highest search interest</li>
                                  {trendingUp.length > 0 && (
                                    <li>• Increase bids for trending keywords: {trendingUp.map((kw: string) => `"${kw}"`).join(', ')}</li>
                                  )}
                                  <li>• Create landing pages optimized for high-performing search terms</li>
                                  <li>• Test ad copy variations that emphasize popular keywords</li>
                                </ul>
                              </div>

                              {trendingDown.length > 0 && (
                                <div className="border-l-4 border-orange-500 pl-4">
                                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Address Declining Interest</h4>
                                  <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                    <li>• Review messaging for: {trendingDown.map((kw: string) => `"${kw}"`).join(', ')}</li>
                                    <li>• Consider seasonal factors affecting search behavior</li>
                                    <li>• Explore related keywords to capture shifting demand</li>
                                    <li>• Refresh creative assets to re-engage audience</li>
                                  </ul>
                                </div>
                              )}

                              <div className="border-l-4 border-blue-500 pl-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Market Positioning</h4>
                                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                  <li>• Monitor keyword trends weekly to stay ahead of market shifts</li>
                                  <li>• Align ad spend with search interest patterns</li>
                                  <li>• Test new keyword variations during high-interest periods</li>
                                  <li>• Build content strategy around consistent search terms</li>
                                </ul>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Market Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Eye className="w-5 h-5" />
                        <span>Market Summary</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <h5 className="font-semibold text-slate-900 dark:text-white">Market Indicators</h5>
                          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'up').length > 0 && (
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>
                                  {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'up').length} 
                                  {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'up').length === 1 ? ' keyword' : ' keywords'} trending up
                                </span>
                              </div>
                            )}
                            {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'down').length > 0 && (
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span>
                                  {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'down').length} 
                                  {processedTrendsData.keywords.filter((kw: string) => processedTrendsData.keywordStats[kw].trend === 'down').length === 1 ? ' keyword' : ' keywords'} declining
                                </span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>Data from Google Trends (90-day period)</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-semibold text-slate-900 dark:text-white">Next Steps</h5>
                          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span>Review ad performance by keyword</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              <span>Adjust bids based on search trends</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Monitor weekly for market changes</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}

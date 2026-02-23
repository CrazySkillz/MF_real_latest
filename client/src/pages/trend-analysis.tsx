import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Brain, Calendar, Target, Users, Award, Zap, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Eye, MousePointer, DollarSign, Clock, Settings, Plus, X, FlaskConical } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [perfPeriod, setPerfPeriod] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState("performance");

  const perfDays = perfPeriod === '7d' ? 7 : perfPeriod === '14d' ? 14 : perfPeriod === '90d' ? 90 : 30;

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: trendsData, isFetching: trendsFetching, isError: trendsError, refetch: refetchTrends } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-trends"],
    enabled: false, // Don't auto-fetch - only fetch when user explicitly requests
    staleTime: 0, // Prevent showing stale cached data
    retry: false, // Don't retry automatically to prevent showing stale data on failures
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
  });

  // Performance Trends queries (only when performance tab is active)
  const { data: connectedPlatforms } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId && activeTab === 'performance',
  });

  const { data: linkedinDaily } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "linkedin-daily", perfDays],
    enabled: !!campaignId && activeTab === 'performance',
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/linkedin-daily?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: metaDaily } = useQuery({
    queryKey: ["/api/meta", campaignId, "insights/daily", perfDays],
    enabled: !!campaignId && activeTab === 'performance',
    queryFn: async () => {
      const resp = await fetch(`/api/meta/${campaignId}/insights/daily?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: dailyFinancials } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "daily-financials", perfDays],
    enabled: !!campaignId && activeTab === 'performance',
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/daily-financials?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  // Cross-platform data processing
  const crossPlatformData = useMemo(() => {
    if (activeTab !== 'performance') return null;

    const dateMap: Record<string, any> = {};
    const allDates: string[] = [];

    // Process LinkedIn daily data
    const liRows = Array.isArray(linkedinDaily) ? linkedinDaily : (linkedinDaily as any)?.dailyMetrics || (linkedinDaily as any)?.data || [];
    liRows.forEach((row: any) => {
      const date = row.date || row.day;
      if (!date) return;
      const d = date.substring(0, 10);
      if (!dateMap[d]) { dateMap[d] = { date: d }; allDates.push(d); }
      dateMap[d].li_impressions = (dateMap[d].li_impressions || 0) + (parseFloat(row.impressions) || 0);
      dateMap[d].li_clicks = (dateMap[d].li_clicks || 0) + (parseFloat(row.clicks) || 0);
      dateMap[d].li_spend = (dateMap[d].li_spend || 0) + (parseFloat(row.spend || row.costInLocalCurrency) || 0);
      dateMap[d].li_conversions = (dateMap[d].li_conversions || 0) + (parseFloat(row.conversions || row.externalWebsiteConversions) || 0);
    });

    // Process Meta daily data
    const metaRows = Array.isArray(metaDaily) ? metaDaily : (metaDaily as any)?.data || (metaDaily as any)?.daily || [];
    metaRows.forEach((row: any) => {
      const date = row.date || row.date_start;
      if (!date) return;
      const d = date.substring(0, 10);
      if (!dateMap[d]) { dateMap[d] = { date: d }; allDates.push(d); }
      dateMap[d].meta_impressions = (dateMap[d].meta_impressions || 0) + (parseFloat(row.impressions) || 0);
      dateMap[d].meta_clicks = (dateMap[d].meta_clicks || 0) + (parseFloat(row.clicks) || 0);
      dateMap[d].meta_spend = (dateMap[d].meta_spend || 0) + (parseFloat(row.spend) || 0);
      dateMap[d].meta_conversions = (dateMap[d].meta_conversions || 0) + (parseFloat(row.conversions) || 0);
      dateMap[d].meta_reach = (dateMap[d].meta_reach || 0) + (parseFloat(row.reach) || 0);
    });

    // Process daily financials (canonical spend/revenue)
    const finRows = Array.isArray(dailyFinancials) ? dailyFinancials : (dailyFinancials as any)?.data || [];
    finRows.forEach((row: any) => {
      const date = row.date;
      if (!date) return;
      const d = date.substring(0, 10);
      if (!dateMap[d]) { dateMap[d] = { date: d }; allDates.push(d); }
      dateMap[d].total_spend = (dateMap[d].total_spend || 0) + (parseFloat(row.spend || row.totalSpend) || 0);
      dateMap[d].total_revenue = (dateMap[d].total_revenue || 0) + (parseFloat(row.revenue || row.totalRevenue) || 0);
    });

    // Sort dates and compute totals per day
    const sortedDates = [...new Set(allDates)].sort();
    const series = sortedDates.map(d => {
      const pt = dateMap[d];
      const impressions = (pt.li_impressions || 0) + (pt.meta_impressions || 0);
      const clicks = (pt.li_clicks || 0) + (pt.meta_clicks || 0);
      const spend = pt.total_spend || (pt.li_spend || 0) + (pt.meta_spend || 0);
      const conversions = (pt.li_conversions || 0) + (pt.meta_conversions || 0);
      const revenue = pt.total_revenue || 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return {
        date: d,
        label: format(new Date(d + 'T00:00:00'), 'MMM dd'),
        impressions, clicks, spend, conversions, revenue, ctr,
        li_impressions: pt.li_impressions || 0,
        li_clicks: pt.li_clicks || 0,
        li_spend: pt.li_spend || 0,
        meta_impressions: pt.meta_impressions || 0,
        meta_clicks: pt.meta_clicks || 0,
        meta_spend: pt.meta_spend || 0,
      };
    });

    if (series.length === 0) return null;

    // Split into current period and previous period for comparison
    const currentPeriod = series.slice(-perfDays);
    const previousPeriod = series.slice(-perfDays * 2, -perfDays);

    const sumMetric = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] || 0), 0);
    const avgMetric = (arr: any[], key: string) => arr.length > 0 ? sumMetric(arr, key) / arr.length : 0;

    const current = {
      spend: sumMetric(currentPeriod, 'spend'),
      revenue: sumMetric(currentPeriod, 'revenue'),
      impressions: sumMetric(currentPeriod, 'impressions'),
      clicks: sumMetric(currentPeriod, 'clicks'),
      conversions: sumMetric(currentPeriod, 'conversions'),
      ctr: avgMetric(currentPeriod, 'ctr'),
    };
    const previous = {
      spend: sumMetric(previousPeriod, 'spend'),
      revenue: sumMetric(previousPeriod, 'revenue'),
      impressions: sumMetric(previousPeriod, 'impressions'),
      clicks: sumMetric(previousPeriod, 'clicks'),
      conversions: sumMetric(previousPeriod, 'conversions'),
      ctr: avgMetric(previousPeriod, 'ctr'),
    };

    const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;

    const comparison = {
      spend: pctChange(current.spend, previous.spend),
      revenue: pctChange(current.revenue, previous.revenue),
      conversions: pctChange(current.conversions, previous.conversions),
      ctr: pctChange(current.ctr, previous.ctr),
    };

    // Anomaly detection: find days where metric deviates >2 stddev from rolling mean
    const anomalies: Array<{ date: string; metric: string; value: number; expected: number; stddev: number }> = [];
    const metricsToCheck = ['spend', 'clicks', 'conversions', 'impressions'] as const;

    metricsToCheck.forEach(metric => {
      const values = currentPeriod.map(r => r[metric] || 0);
      if (values.length < 7) return;

      // Rolling 7-day mean and stddev
      for (let i = 7; i < values.length; i++) {
        const window = values.slice(i - 7, i);
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
        const stddev = Math.sqrt(variance);
        const val = values[i];
        if (stddev > 0 && Math.abs(val - mean) > 2 * stddev) {
          anomalies.push({
            date: currentPeriod[i].date,
            metric,
            value: val,
            expected: mean,
            stddev,
          });
        }
      }
    });

    return { series: currentPeriod, current, previous, comparison, anomalies, hasPrevious: previousPeriod.length > 0 };
  }, [activeTab, linkedinDaily, metaDaily, dailyFinancials, perfDays]);

  // Demo mode: generate realistic Google Trends-style data
  const demoTrendsData = useMemo(() => {
    if (!demoMode) return null;
    const now = Math.floor(Date.now() / 1000);
    const daySeconds = 86400;
    const generateTimeSeries = (baseValue: number, volatility: number, trendDirection: number) => {
      const data: any[] = [];
      for (let i = 90; i >= 0; i--) {
        const time = String(now - i * daySeconds);
        const seasonal = Math.sin((90 - i) / 14 * Math.PI) * 8;
        const trend = trendDirection * (90 - i) * 0.1;
        const noise = (Math.random() - 0.5) * volatility;
        const value = Math.max(5, Math.min(100, Math.round(baseValue + seasonal + trend + noise)));
        data.push({ time, value: [value] });
      }
      return data;
    };
    return {
      industry: 'Digital Marketing',
      trends: [
        { keyword: 'digital marketing', success: true, data: generateTimeSeries(62, 12, 0.3) },
        { keyword: 'social media ads', success: true, data: generateTimeSeries(48, 15, -0.2) },
        { keyword: 'content strategy', success: true, data: generateTimeSeries(35, 10, 0.5) },
      ],
    };
  }, [demoMode]);

  const effectiveTrendsData = demoTrendsData || trendsData;

  const updateKeywordsMutation = useMutation({
    mutationFn: async (data: { industry: string; trendKeywords: string[] }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: async () => {
      // Start 2-minute cooldown to prevent rate limiting
      setCooldownSeconds(120);
      
      toast({
        title: "Fetching Trend Data...",
        description: "This may take up to 30 seconds. Please wait.",
      });
      
      setIsConfiguring(false);
      
      // Invalidate campaign query to refresh keywords
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      
      // Manually trigger trends fetch
      refetchTrends();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update keywords. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRefreshTrends = async () => {
    if (cooldownSeconds > 0) {
      toast({
        title: "Cooldown Active",
        description: `Please wait ${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, '0')} before refreshing again.`,
        variant: "destructive",
      });
      return;
    }

    setCooldownSeconds(120);
    toast({
      title: "Fetching Trend Data...",
      description: "This may take up to 30 seconds. Please wait.",
    });
    
    await refetchTrends();
  };

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

  // Cooldown timer countdown
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Process Google Trends data into chart-ready format
  const processedTrendsData = useMemo(() => {
    if (!effectiveTrendsData || !(effectiveTrendsData as any).trends) {
      return null;
    }

    const trends = (effectiveTrendsData as any).trends;
    
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
  }, [effectiveTrendsData]);

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
              <div className="flex items-center space-x-2">
                <Button
                  variant={demoMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoMode(!demoMode)}
                >
                  <FlaskConical className="w-4 h-4 mr-1" />
                  {demoMode ? "Demo On" : "Demo Data"}
                </Button>
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
          </div>

          {demoMode && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <FlaskConical className="w-4 h-4 inline mr-1" />
                Showing demo data for testing. Toggle off to see real trend data.
              </p>
            </div>
          )}

          {/* Configuration Card */}
          {!demoMode && (!(campaign as any)?.trendKeywords?.length || isConfiguring) && (
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

                {cooldownSeconds > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Cooldown Active
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Please wait {Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, '0')} before next search to avoid rate limiting
                        </p>
                      </div>
                    </div>
                    <Progress value={((120 - cooldownSeconds) / 120) * 100} className="mt-2 h-1" />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={handleSaveKeywords} 
                    disabled={updateKeywordsMutation.isPending || cooldownSeconds > 0 || trendsFetching}
                    data-testid="button-save-keywords"
                  >
                    {trendsFetching ? "Fetching Data..." : updateKeywordsMutation.isPending ? "Saving..." : cooldownSeconds > 0 ? `Wait ${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, '0')}` : "Save & Track Trends"}
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

          {/* Performance Trends Tab (always visible) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="performance">Performance Trends</TabsTrigger>
              <TabsTrigger value="overview">Google Trends</TabsTrigger>
              <TabsTrigger value="keyword-comparison">Keyword Comparison</TabsTrigger>
              <TabsTrigger value="seasonal-trends">Seasonal Trends</TabsTrigger>
              <TabsTrigger value="insights">Market Insights</TabsTrigger>
            </TabsList>

            {/* Performance Trends Tab */}
            <TabsContent value="performance" className="space-y-6">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Select value={perfPeriod} onValueChange={setPerfPeriod}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="14d">Last 14 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Cross-platform performance data
                </div>
              </div>

              {!crossPlatformData || crossPlatformData.series.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Activity className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Performance Data Available</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Connect LinkedIn Ads or Meta/Facebook to see cross-platform performance trends.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Period Comparison Cards */}
                  {crossPlatformData.hasPrevious && (
                    <div className="grid gap-4 md:grid-cols-4">
                      {[
                        { label: 'Total Spend', current: crossPlatformData.current.spend, change: crossPlatformData.comparison.spend, fmt: 'currency' },
                        { label: 'Total Revenue', current: crossPlatformData.current.revenue, change: crossPlatformData.comparison.revenue, fmt: 'currency' },
                        { label: 'Avg CTR', current: crossPlatformData.current.ctr, change: crossPlatformData.comparison.ctr, fmt: 'pct' },
                        { label: 'Total Conversions', current: crossPlatformData.current.conversions, change: crossPlatformData.comparison.conversions, fmt: 'number' },
                      ].map((card, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{card.label}</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                              {card.fmt === 'currency' ? formatCurrency(card.current) : card.fmt === 'pct' ? `${card.current.toFixed(2)}%` : formatNumber(card.current)}
                            </div>
                            <div className={`flex items-center text-xs mt-1 ${card.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {card.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                              {card.change >= 0 ? '+' : ''}{card.change.toFixed(1)}% vs prev period
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Performance Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Cross-Platform Daily Performance</span>
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Impressions, clicks, and spend across all connected platforms
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--background)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                              }}
                              formatter={(value: any, name: string) => {
                                if (name.includes('Spend')) return [`$${Number(value).toFixed(2)}`, name];
                                return [Number(value).toLocaleString(), name];
                              }}
                            />
                            <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} name="Impressions" />
                            <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
                            <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#f59e0b" strokeWidth={2} dot={false} name="Spend ($)" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversions & Revenue Chart */}
                  {(crossPlatformData.current.conversions > 0 || crossPlatformData.current.revenue > 0) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <DollarSign className="w-5 h-5" />
                          <span>Conversions & Revenue</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={crossPlatformData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis yAxisId="left" className="text-xs" />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                }}
                                formatter={(value: any, name: string) => {
                                  if (name.includes('Revenue')) return [`$${Number(value).toFixed(2)}`, name];
                                  return [Number(value).toLocaleString(), name];
                                }}
                              />
                              <Bar yAxisId="left" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />
                              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue ($)" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Platform Breakdown */}
                  {(crossPlatformData.current.spend > 0) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BarChart3 className="w-5 h-5" />
                          <span>Platform Breakdown</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={crossPlatformData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                }}
                                formatter={(value: any, name: string) => [Number(value).toLocaleString(), name]}
                              />
                              <Bar dataKey="li_clicks" stackId="clicks" fill="#0077B5" name="LinkedIn Clicks" />
                              <Bar dataKey="meta_clicks" stackId="clicks" fill="#1877F2" name="Meta Clicks" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Anomaly Alerts */}
                  {crossPlatformData.anomalies.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          <span>Anomaly Detection</span>
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Data points that deviate more than 2 standard deviations from the 7-day rolling average
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {crossPlatformData.anomalies.slice(0, 10).map((anomaly, idx) => {
                            const isSpike = anomaly.value > anomaly.expected;
                            return (
                              <div key={idx} className={`p-3 rounded-lg border ${isSpike ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/20' : 'border-blue-200 bg-blue-50 dark:bg-blue-900/20'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {isSpike ? <TrendingUp className="w-4 h-4 text-orange-600" /> : <TrendingDown className="w-4 h-4 text-blue-600" />}
                                    <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                                      {anomaly.metric} {isSpike ? 'Spike' : 'Drop'}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {format(new Date(anomaly.date + 'T00:00:00'), 'MMM dd')}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-semibold">{anomaly.value.toLocaleString()}</span>
                                    <span className="text-xs ml-1">(expected ~{Math.round(anomaly.expected).toLocaleString()})</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

          {/* Google Trends Tabs */}
          {(demoMode || ((campaign as any)?.trendKeywords?.length > 0 && !isConfiguring)) ? (
            <>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {!demoMode && trendsFetching ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-slate-900 dark:text-white font-medium">Fetching Trend Data via SerpAPI</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">This may take up to 30 seconds...</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : !effectiveTrendsData ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="flex flex-col items-center space-y-4">
                        <TrendingUp className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                        <div>
                          <p className="text-slate-900 dark:text-white font-medium text-lg mb-2">No Trend Data Yet</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Click the button below to fetch Google Trends data for your keywords
                          </p>
                        </div>
                        <Button 
                          onClick={handleRefreshTrends} 
                          disabled={cooldownSeconds > 0}
                          data-testid="button-refresh-trends"
                        >
                          {cooldownSeconds > 0 ? `Wait ${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, '0')}` : "Refresh Trends Data"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : trendsError || !processedTrendsData || !((effectiveTrendsData as any)?.trends?.some((t: any) => t.success && t.data && t.data.length > 0)) ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="flex flex-col items-center space-y-4">
                        <AlertTriangle className="w-12 h-12 text-yellow-600" />
                        <div>
                          <p className="text-slate-900 dark:text-white font-medium text-lg mb-2">Failed to Fetch Trend Data</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            SerpAPI request timed out or failed. This is usually due to Google rate limiting.
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Please wait 2-5 minutes before trying again.
                          </p>
                        </div>
                        <Button 
                          onClick={handleRefreshTrends} 
                          disabled={cooldownSeconds > 0}
                          variant="outline"
                          data-testid="button-retry-trends"
                        >
                          {cooldownSeconds > 0 ? `Wait ${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, '0')}` : "Try Again"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {processedTrendsData.keywords.length === 0 ? (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            No Trend Data Available
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Google Trends API is currently unavailable. Please try again later or contact support for assistance.
                          </p>
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
                                    {(effectiveTrendsData as any)?.industry || 'Market'}
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
                  </>
                )}
              </TabsContent>

            {/* Keyword Comparison Tab */}
            <TabsContent value="keyword-comparison" className="space-y-6">
              {!demoMode && trendsFetching ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading comparison data...
                  </CardContent>
                </Card>
              ) : !effectiveTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <BarChart3 className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                      <div>
                        <p className="text-slate-900 dark:text-white font-medium text-lg mb-2">No Data Available</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Fetch trend data from the Overview tab first
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !processedTrendsData || !((effectiveTrendsData as any)?.trends?.some((t: any) => t.success && t.data && t.data.length > 0)) ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load comparison data. Please try refreshing from the Overview tab.
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
              {!demoMode && trendsFetching ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading seasonal data...
                  </CardContent>
                </Card>
              ) : !effectiveTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                      <div>
                        <p className="text-slate-900 dark:text-white font-medium text-lg mb-2">No Data Available</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Fetch trend data from the Overview tab first
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !processedTrendsData || !((effectiveTrendsData as any)?.trends?.some((t: any) => t.success && t.data && t.data.length > 0)) ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load seasonal data. Please try refreshing from the Overview tab.
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
              {!demoMode && trendsFetching ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Loading market insights...
                  </CardContent>
                </Card>
              ) : !effectiveTrendsData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <Brain className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                      <div>
                        <p className="text-slate-900 dark:text-white font-medium text-lg mb-2">No Data Available</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Fetch trend data from the Overview tab first
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !processedTrendsData || !((effectiveTrendsData as any)?.trends?.some((t: any) => t.success && t.data && t.data.length > 0)) ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">
                    Unable to load market insights. Please try refreshing from the Overview tab.
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
            </>
          ) : (
            <>
              {/* Empty fragments for Google Trends tabs when no keywords configured */}
              <TabsContent value="overview">
                <Card>
                  <CardContent className="p-8 text-center">
                    <TrendingUp className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Google Trends Not Configured</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Configure industry keywords above to track Google Trends data.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="keyword-comparison">
                <Card><CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">Configure keywords to see comparison data.</CardContent></Card>
              </TabsContent>
              <TabsContent value="seasonal-trends">
                <Card><CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">Configure keywords to see seasonal data.</CardContent></Card>
              </TabsContent>
              <TabsContent value="insights">
                <Card><CardContent className="p-8 text-center text-slate-600 dark:text-slate-400">Configure keywords to see market insights.</CardContent></Card>
              </TabsContent>
            </>
          )}
          </Tabs>
        </main>
      </div>
    </div>
  );
}

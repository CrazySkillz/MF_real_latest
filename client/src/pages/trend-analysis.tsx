import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Brain, Calendar, Target, Users, Award, Zap, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Eye, MousePointer, DollarSign, Clock } from "lucide-react";
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

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

// Industry benchmark data
const industryBenchmarks = {
  'Digital Marketing': { ctr: 2.35, cpc: 0.58, conversionRate: 3.75, roas: 4.2, qualityScore: 7.8 },
  'E-commerce': { ctr: 1.91, cpc: 0.70, conversionRate: 2.86, roas: 4.1, qualityScore: 7.5 },
  'SaaS': { ctr: 2.18, cpc: 1.22, conversionRate: 4.31, roas: 5.8, qualityScore: 8.2 },
  'Healthcare': { ctr: 1.84, cpc: 1.45, conversionRate: 3.22, roas: 3.9, qualityScore: 7.9 },
  'Financial Services': { ctr: 2.02, cpc: 2.15, conversionRate: 4.52, roas: 5.2, qualityScore: 8.1 }
};

// Generate trend data for the last 90 days
const generateTrendData = () => {
  const data = [];
  const industryAvg = industryBenchmarks['Digital Marketing'];
  
  for (let i = 90; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Campaign performance with some seasonal variation
    const seasonalMultiplier = 1 + 0.3 * Math.sin((i / 90) * Math.PI * 2);
    const campaignCtr = (2.8 + Math.random() * 0.8) * seasonalMultiplier;
    const campaignConversionRate = (4.2 + Math.random() * 1.2) * seasonalMultiplier;
    const campaignRoas = (4.5 + Math.random() * 1.0) * seasonalMultiplier;
    
    data.push({
      date: format(date, 'MMM dd'),
      fullDate: date,
      campaignCTR: parseFloat(campaignCtr.toFixed(2)),
      industryCTR: parseFloat((industryAvg.ctr + Math.random() * 0.2).toFixed(2)),
      campaignConversionRate: parseFloat(campaignConversionRate.toFixed(2)),
      industryConversionRate: parseFloat((industryAvg.conversionRate + Math.random() * 0.3).toFixed(2)),
      campaignROAS: parseFloat(campaignRoas.toFixed(2)),
      industryROAS: parseFloat((industryAvg.roas + Math.random() * 0.4).toFixed(2)),
      campaignVolume: Math.floor((15000 + Math.random() * 5000) * seasonalMultiplier),
      industryVolume: Math.floor((12000 + Math.random() * 3000) * seasonalMultiplier),
    });
  }
  return data;
};

const trendData = generateTrendData();

// Performance comparison data
const performanceComparison = {
  ctr: { campaign: 2.84, industry: 2.35, variance: 20.9 },
  conversionRate: { campaign: 4.68, industry: 3.75, variance: 24.8 },
  roas: { campaign: 4.72, industry: 4.20, variance: 12.4 },
  cpc: { campaign: 0.52, industry: 0.58, variance: -10.3 },
  qualityScore: { campaign: 8.4, industry: 7.8, variance: 7.7 }
};

// Seasonal trends data
const seasonalTrends = [
  { month: 'Jan', campaign: 95, industry: 88, variance: 8 },
  { month: 'Feb', campaign: 102, industry: 92, variance: 11 },
  { month: 'Mar', campaign: 118, industry: 105, variance: 12 },
  { month: 'Apr', campaign: 125, industry: 115, variance: 9 },
  { month: 'May', campaign: 134, industry: 122, variance: 10 },
  { month: 'Jun', campaign: 128, industry: 118, variance: 8 },
  { month: 'Jul', campaign: 142, industry: 125, variance: 14 },
  { month: 'Aug', campaign: 138, industry: 128, variance: 8 },
  { month: 'Sep', campaign: 145, industry: 132, variance: 10 },
  { month: 'Oct', campaign: 152, industry: 135, variance: 13 },
  { month: 'Nov', campaign: 168, industry: 148, variance: 14 },
  { month: 'Dec', campaign: 175, industry: 155, variance: 13 }
];

// Market share trends
const marketShareData = [
  { platform: 'Google Ads', q1: 35, q2: 38, q3: 40, q4: 42 },
  { platform: 'Facebook Ads', q1: 25, q2: 24, q3: 23, q4: 22 },
  { platform: 'LinkedIn Ads', q1: 15, q2: 16, q3: 17, q4: 18 },
  { platform: 'Twitter Ads', q1: 12, q2: 11, q3: 10, q4: 9 },
  { platform: 'Others', q1: 13, q2: 11, q3: 10, q4: 9 }
];

export default function TrendAnalysis() {
  const { id: campaignId } = useParams();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
  });

  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
  });

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
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Trend Analysis Report</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Analysis Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="industry-comparison">Industry Comparison</TabsTrigger>
              <TabsTrigger value="seasonal-trends">Seasonal Trends</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Performance vs Industry Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {Object.entries(performanceComparison).map(([metric, data], index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 capitalize">
                        {metric === 'ctr' ? 'CTR' : metric === 'roas' ? 'ROAS' : metric.replace(/([A-Z])/g, ' $1')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(data.variance)}
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {metric === 'cpc' ? formatCurrency(data.campaign) : 
                           metric === 'roas' ? `${data.campaign}x` :
                           `${data.campaign}${metric.includes('Rate') || metric === 'ctr' ? '%' : ''}`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Industry: {metric === 'cpc' ? formatCurrency(data.industry) : 
                                 metric === 'roas' ? `${data.industry}x` :
                                 `${data.industry}${metric.includes('Rate') || metric === 'ctr' ? '%' : ''}`}
                      </div>
                      <div className="flex items-center">
                        {getVarianceBadge(data.variance)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Performance Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>Performance Trends vs Industry (90 Days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trendData.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis yAxisId="left" orientation="left" className="text-xs" />
                        <YAxis yAxisId="right" orientation="right" className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--background)', 
                            border: '1px solid var(--border)',
                            borderRadius: '6px' 
                          }} 
                        />
                        <Area yAxisId="left" type="monotone" dataKey="campaignCTR" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Campaign CTR" />
                        <Line yAxisId="left" type="monotone" dataKey="industryCTR" stroke="#94a3b8" strokeDasharray="5 5" name="Industry CTR" />
                        <Bar yAxisId="right" dataKey="campaignVolume" fill="#10b981" fillOpacity={0.6} name="Campaign Volume" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Performance Insights */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Award className="w-4 h-4" />
                      <span>Top Performance Area</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">Conversion Rate</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">24.8% above industry average</div>
                      <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Excellent Performance
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Target className="w-4 h-4" />
                      <span>Optimization Target</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">ROAS</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">12.4% above industry, room for growth</div>
                      <Badge className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Growth Opportunity
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>Trending Metric</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">CTR</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Consistent 20%+ outperformance</div>
                      <Badge className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        Stable Advantage
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Industry Comparison Tab */}
            <TabsContent value="industry-comparison" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Detailed Industry Benchmarking */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Industry Benchmarking</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(industryBenchmarks).map(([industry, benchmarks], index) => (
                        <div key={index} className="p-3 border rounded-lg dark:border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{industry}</span>
                            {industry === 'Digital Marketing' && <Badge>Your Industry</Badge>}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="block text-slate-500 font-medium">CTR</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{benchmarks.ctr}%</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">Conv. Rate</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{benchmarks.conversionRate}%</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">ROAS</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{benchmarks.roas}x</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Market Position Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">Top 15%</div>
                        <div className="text-sm text-green-700 dark:text-green-300">Industry Performance Ranking</div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">CTR Performance</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={85} className="w-20 h-2" />
                            <span className="text-xs font-medium">85th percentile</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Conversion Rate</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={92} className="w-20 h-2" />
                            <span className="text-xs font-medium">92nd percentile</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">ROAS</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={78} className="w-20 h-2" />
                            <span className="text-xs font-medium">78th percentile</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Cost Efficiency</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={88} className="w-20 h-2" />
                            <span className="text-xs font-medium">88th percentile</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Competitive Analysis Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="w-5 h-5" />
                    <span>Competitive Performance Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { metric: 'CTR', campaign: 2.84, industry: 2.35, topQuartile: 3.2 },
                        { metric: 'Conv Rate', campaign: 4.68, industry: 3.75, topQuartile: 5.1 },
                        { metric: 'ROAS', campaign: 4.72, industry: 4.20, topQuartile: 5.8 },
                        { metric: 'Quality Score', campaign: 8.4, industry: 7.8, topQuartile: 9.2 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="metric" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--background)', 
                            border: '1px solid var(--border)',
                            borderRadius: '6px' 
                          }} 
                        />
                        <Bar dataKey="campaign" fill="#3b82f6" name="Your Campaign" />
                        <Bar dataKey="industry" fill="#94a3b8" name="Industry Average" />
                        <Bar dataKey="topQuartile" fill="#10b981" name="Top 25%" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Seasonal Trends Tab */}
            <TabsContent value="seasonal-trends" className="space-y-6">
              <div className="grid gap-6">
                {/* Seasonal Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Seasonal Performance Patterns</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={seasonalTrends}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis yAxisId="left" orientation="left" className="text-xs" />
                          <YAxis yAxisId="right" orientation="right" className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--background)', 
                              border: '1px solid var(--border)',
                              borderRadius: '6px' 
                            }} 
                          />
                          <Area yAxisId="left" type="monotone" dataKey="campaign" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Campaign Performance" />
                          <Line yAxisId="left" type="monotone" dataKey="industry" stroke="#94a3b8" strokeDasharray="5 5" name="Industry Average" />
                          <Bar yAxisId="right" dataKey="variance" fill="#10b981" fillOpacity={0.6} name="Performance Advantage %" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Market Share Evolution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span>Platform Market Share Evolution</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={marketShareData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="platform" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--background)', 
                              border: '1px solid var(--border)',
                              borderRadius: '6px' 
                            }} 
                          />
                          <Line type="monotone" dataKey="q1" stroke="#3b82f6" name="Q1" />
                          <Line type="monotone" dataKey="q2" stroke="#10b981" name="Q2" />
                          <Line type="monotone" dataKey="q3" stroke="#f59e0b" name="Q3" />
                          <Line type="monotone" dataKey="q4" stroke="#ef4444" name="Q4" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Seasonal Insights */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Peak Season</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Q4</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">November-December peak</div>
                        <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          +15% above average
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Growth Period</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Q1-Q2</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Steady upward trend</div>
                        <Badge className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          +8% monthly growth
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Opportunity Window</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">September</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Pre-holiday preparation</div>
                        <Badge className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          Budget scaling window
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="grid gap-6">
                {/* AI-Powered Trend Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="w-5 h-5" />
                      <span>Trend Analysis Insights</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Outstanding Performance</h4>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Your campaign consistently outperforms industry benchmarks across all key metrics. Conversion rate performance places you in the top 8% of digital marketing campaigns.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Seasonal Advantage</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Your campaign shows strong seasonal performance with 25% higher effectiveness during Q4. Historical data suggests optimal budget scaling opportunities in September-October.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Market Position Strength</h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              CTR performance has maintained a 20%+ advantage over industry standards for 90+ days, indicating strong creative resonance and audience targeting effectiveness.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Growth Opportunity</h4>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              While ROAS is 12% above industry average, there's potential to reach top-quartile performance (5.8x) through optimization. Focus on high-converting audience segments.
                            </p>
                          </div>
                        </div>
                      </div>
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
                      <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Seasonal Optimization</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Increase budget allocation by 40% starting September for Q4 preparation</li>
                          <li>• Implement holiday-specific creative variations 6-8 weeks before peak season</li>
                          <li>• Scale successful audience segments during Q4 peak performance window</li>
                          <li>• Maintain aggressive bidding strategies during November-December peak</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Performance Enhancement</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Leverage strong CTR performance to expand to similar audience segments</li>
                          <li>• Test higher-value conversion actions to improve ROAS by 20%+</li>
                          <li>• Implement dynamic bidding strategies based on seasonal patterns</li>
                          <li>• Expand successful creative themes identified through trend analysis</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Competitive Advantage</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Maintain creative freshness to sustain 20%+ CTR advantage</li>
                          <li>• Monitor industry benchmarks weekly to identify emerging opportunities</li>
                          <li>• Test emerging platforms where competition may be lower</li>
                          <li>• Document winning strategies for replication across campaigns</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Industry Outlook */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Eye className="w-5 h-5" />
                      <span>Industry Outlook & Predictions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <h5 className="font-semibold text-slate-900 dark:text-white">Q1 2025 Predictions</h5>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>CTR industry average expected to rise to 2.5%</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>CPC costs projected to increase 8-12%</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span>Privacy updates may impact targeting precision</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h5 className="font-semibold text-slate-900 dark:text-white">Recommended Preparations</h5>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span>Diversify traffic sources before Q1</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span>Implement first-party data collection</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Test AI-powered creative optimization</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
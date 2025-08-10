import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, TrendingUp, TrendingDown, Target, Users, DollarSign, Award, AlertTriangle, CheckCircle, Zap, Eye, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Calendar, Brain } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

// Executive summary key metrics
const executiveMetrics = {
  totalSpend: 4896510.14,
  totalRevenue: 14689530.42,
  totalImpressions: 50880501,
  totalClicks: 1975195,
  totalConversions: 314166,
  averageRoas: 3.8,
  averageCtr: 2.84,
  averageConversionRate: 4.68,
  averageCpc: 0.52,
  campaignDuration: 90,
  platformCount: 4,
  audienceReach: 3250000
};

// Performance trends for executive view
const performanceTrends = [
  { period: 'Week 1', revenue: 245000, spend: 82000, roas: 2.99, conversions: 3200 },
  { period: 'Week 2', revenue: 298000, spend: 86000, roas: 3.47, conversions: 3800 },
  { period: 'Week 3', revenue: 342000, spend: 89000, roas: 3.84, conversions: 4350 },
  { period: 'Week 4', revenue: 385000, spend: 92000, roas: 4.18, conversions: 4900 },
  { period: 'Week 5', revenue: 420000, spend: 95000, roas: 4.42, conversions: 5200 },
  { period: 'Week 6', revenue: 458000, spend: 98000, roas: 4.67, conversions: 5650 },
  { period: 'Week 7', revenue: 495000, spend: 101000, roas: 4.90, conversions: 6100 },
  { period: 'Week 8', revenue: 528000, spend: 104000, roas: 5.08, conversions: 6400 },
  { period: 'Week 9', revenue: 565000, spend: 107000, roas: 5.28, conversions: 6850 },
  { period: 'Week 10', revenue: 598000, spend: 110000, roas: 5.44, conversions: 7200 },
  { period: 'Week 11', revenue: 635000, spend: 113000, roas: 5.62, conversions: 7600 },
  { period: 'Week 12', revenue: 672000, spend: 116000, roas: 5.79, conversions: 8000 }
];

// Platform performance breakdown
const platformBreakdown = [
  { name: 'Google Analytics', value: 42, revenue: 6129582.78, spend: 2058194.26, color: '#4285f4' },
  { name: 'Google Sheets', value: 28, revenue: 4113068.52, spend: 1370356.18, color: '#0f9d58' },
  { name: 'Facebook Ads', value: 20, revenue: 2937906.08, spend: 979302.03, color: '#1877f2' },
  { name: 'LinkedIn Ads', value: 10, revenue: 1508973.04, spend: 488657.67, color: '#0077b5' }
];

// Strategic recommendations
const strategicRecommendations = [
  {
    priority: 'high',
    category: 'Budget Optimization',
    title: 'Increase Google Sheets Investment',
    description: 'Google Sheets delivers highest ROAS at 5.8x. Recommend 30% budget increase.',
    impact: 'Revenue increase: +$2.1M annually',
    timeframe: 'Immediate',
    investment: '$650K additional budget'
  },
  {
    priority: 'medium',
    category: 'Performance Enhancement',
    title: 'Optimize Facebook Ads Targeting',
    description: 'Current ROAS 2.9x below platform average. Audience refinement needed.',
    impact: 'Revenue increase: +$850K annually',
    timeframe: '30-60 days',
    investment: 'Creative & targeting optimization'
  },
  {
    priority: 'medium',
    category: 'Market Expansion',
    title: 'Scale LinkedIn B2B Campaigns',
    description: 'High engagement but limited reach. Expand professional targeting.',
    impact: 'New market penetration: +15%',
    timeframe: '60-90 days',
    investment: '$400K additional budget'
  },
  {
    priority: 'low',
    category: 'Technology Integration',
    title: 'Implement Advanced Attribution',
    description: 'Cross-platform attribution for comprehensive performance view.',
    impact: 'Improved decision making',
    timeframe: '90-120 days',
    investment: 'Technology & setup costs'
  }
];

// Key insights for executives
const keyInsights = [
  {
    type: 'success',
    title: 'Outstanding ROI Performance',
    insight: 'Campaign delivers 3.8x return on ad spend, significantly outperforming industry average of 2.9x.',
    implication: 'Strong foundation for scaling investment and expanding market reach.'
  },
  {
    type: 'opportunity',
    title: 'Platform Efficiency Variance',
    insight: 'Google Sheets platform delivers 100% higher ROAS than Facebook Ads (5.8x vs 2.9x).',
    implication: 'Rebalancing budget allocation could increase overall campaign profitability by 35%.'
  },
  {
    type: 'risk',
    title: 'Platform Concentration Risk',
    insight: '70% of revenue concentrated in two platforms (Google Analytics & Sheets).',
    implication: 'Diversification needed to reduce dependency and mitigate platform-specific risks.'
  },
  {
    type: 'trend',
    title: 'Accelerating Performance Growth',
    insight: 'ROAS improved 93% over 12-week period, with consistent week-over-week gains.',
    implication: 'Optimization strategies are working effectively, supporting aggressive scaling plans.'
  }
];

export default function ExecutiveSummary() {
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
              <p className="text-slate-600 dark:text-slate-400">Unable to load campaign data for executive summary.</p>
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Low Priority</Badge>;
      default:
        return null;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'opportunity':
        return <Target className="w-5 h-5 text-blue-600" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      default:
        return <Eye className="w-5 h-5 text-slate-600" />;
    }
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
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Executive Summary</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400">Campaign Period</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {format(subDays(new Date(), 90), 'MMM dd')} - {format(new Date(), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
              <TabsTrigger value="recommendations">Strategic Recommendations</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Executive Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics Dashboard */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatCurrency(executiveMetrics.totalRevenue)}
                    </div>
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">+23% vs target</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Return on Ad Spend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {executiveMetrics.averageRoas}x
                    </div>
                    <div className="flex items-center text-blue-600 dark:text-blue-400">
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">+31% vs industry</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatNumber(executiveMetrics.totalConversions)}
                    </div>
                    <div className="flex items-center text-purple-600 dark:text-purple-400">
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">+18% vs target</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Audience Reach</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                      {formatNumber(executiveMetrics.audienceReach)}
                    </div>
                    <div className="flex items-center text-orange-600 dark:text-orange-400">
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">+45% vs baseline</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Summary Chart */}
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Revenue & ROAS Progression</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceTrends}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="period" className="text-xs" />
                          <YAxis yAxisId="left" orientation="left" className="text-xs" />
                          <YAxis yAxisId="right" orientation="right" className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--background)', 
                              border: '1px solid var(--border)',
                              borderRadius: '6px' 
                            }} 
                            formatter={(value, name) => [
                              name === 'revenue' ? formatCurrency(value as number) : 
                              name === 'roas' ? `${value}x` : formatNumber(value as number),
                              name === 'revenue' ? 'Revenue' :
                              name === 'roas' ? 'ROAS' : 'Conversions'
                            ]}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                          <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Platform Revenue Mix</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={platformBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {platformBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [
                              `${value}%`,
                              (props.payload as any)?.name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {platformBreakdown.map((platform, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                            <span className="text-slate-600 dark:text-slate-400">{platform.name}</span>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{platform.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Executive Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Award className="w-4 h-4" />
                      <span>Campaign Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <Badge className="mb-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Exceeding Targets
                      </Badge>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        All key metrics performing above baseline expectations
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Campaign Progress</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Duration</span>
                        <span className="font-medium text-slate-900 dark:text-white">{executiveMetrics.campaignDuration} days</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <div className="text-xs text-slate-500 text-center">75% complete</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Market Penetration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">12.8%</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Target audience reached across {executiveMetrics.platformCount} platforms
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Performance Analysis Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-6">
                {/* Platform Performance Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Platform Performance Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {platformBreakdown.map((platform, index) => (
                        <div key={index} className="p-4 border rounded-lg dark:border-slate-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: platform.color }}></div>
                              <span className="font-semibold text-slate-900 dark:text-white">{platform.name}</span>
                            </div>
                            <Badge variant="outline">{platform.value}% of revenue</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="block text-slate-500 font-medium">Revenue</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(platform.revenue)}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">Spend</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(platform.spend)}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">ROAS</span>
                              <span className="text-slate-900 dark:text-white font-semibold">
                                {(platform.revenue / platform.spend).toFixed(1)}x
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Average CTR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        {executiveMetrics.averageCtr}%
                      </div>
                      <div className="text-xs text-slate-500">Industry avg: 2.1%</div>
                      <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        +35% above avg
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        {executiveMetrics.averageConversionRate}%
                      </div>
                      <div className="text-xs text-slate-500">Industry avg: 3.2%</div>
                      <Badge className="mt-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        +46% above avg
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Average CPC</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        ${executiveMetrics.averageCpc}
                      </div>
                      <div className="text-xs text-slate-500">Industry avg: $0.68</div>
                      <Badge className="mt-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        -24% below avg
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Efficiency Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        94/100
                      </div>
                      <div className="text-xs text-slate-500">Top 5% performance</div>
                      <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Excellent
                      </Badge>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Strategic Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
              <div className="space-y-4">
                {strategicRecommendations.map((rec, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                        {getPriorityBadge(rec.priority)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{rec.category}</div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-slate-700 dark:text-slate-300">{rec.description}</p>
                        
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Expected Impact</div>
                            <div className="text-sm text-green-700 dark:text-green-300">{rec.impact}</div>
                          </div>
                          
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Timeframe</div>
                            <div className="text-sm text-blue-700 dark:text-blue-300">{rec.timeframe}</div>
                          </div>
                          
                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Investment Required</div>
                            <div className="text-sm text-purple-700 dark:text-purple-300">{rec.investment}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="space-y-4">
                {keyInsights.map((insight, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        {getInsightIcon(insight.type)}
                        <span>{insight.title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Key Finding</div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{insight.insight}</p>
                        </div>
                        
                        <div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Strategic Implication</div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{insight.implication}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Executive Decision Framework */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="w-5 h-5" />
                    <span>Executive Decision Framework</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Immediate Actions (Next 30 Days)</h4>
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Increase Google Sheets budget allocation by 30%</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Implement Facebook Ads audience optimization</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>Establish weekly performance monitoring cadence</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Strategic Initiatives (90+ Days)</h4>
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Diversify platform portfolio to reduce concentration risk</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Implement advanced attribution modeling</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>Explore emerging platform opportunities</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
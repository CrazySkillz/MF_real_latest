import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, TrendingUp, Target, Users, MousePointer, DollarSign, Eye, Clock, AlertCircle, Zap, Brain, GitCompare, Activity, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { format } from "date-fns";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

// Platform performance comparison data
const platformMetrics = [
  {
    platform: 'Google Analytics',
    impressions: 15420000,
    clicks: 182500,
    conversions: 8430,
    spend: 47500,
    ctr: 1.18,
    cpc: 0.26,
    conversionRate: 4.62,
    roas: 3.8,
    qualityScore: 8.5,
    reach: 1200000,
    engagement: 4.2,
    color: '#4285f4'
  },
  {
    platform: 'Google Sheets',
    impressions: 8900000,
    clicks: 125600,
    conversions: 4920,
    spend: 32100,
    ctr: 1.41,
    cpc: 0.26,
    conversionRate: 3.92,
    roas: 4.1,
    qualityScore: 7.8,
    reach: 850000,
    engagement: 3.9,
    color: '#0f9d58'
  },
  {
    platform: 'Facebook Ads',
    impressions: 12300000,
    clicks: 98400,
    conversions: 3150,
    spend: 28900,
    ctr: 0.80,
    cpc: 0.29,
    conversionRate: 3.20,
    roas: 2.9,
    qualityScore: 6.9,
    reach: 920000,
    engagement: 5.1,
    color: '#1877f2'
  },
  {
    platform: 'LinkedIn Ads',
    impressions: 2400000,
    clicks: 45600,
    conversions: 1830,
    spend: 18200,
    ctr: 1.90,
    cpc: 0.40,
    conversionRate: 4.01,
    roas: 3.2,
    qualityScore: 8.1,
    reach: 180000,
    engagement: 2.8,
    color: '#0077b5'
  }
];

// Performance trend data over time
const generateTrendData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: format(date, 'MMM dd'),
      'Google Analytics': Math.floor(Math.random() * 1000) + 800,
      'Google Sheets': Math.floor(Math.random() * 600) + 400,
      'Facebook Ads': Math.floor(Math.random() * 800) + 500,
      'LinkedIn Ads': Math.floor(Math.random() * 300) + 200,
    });
  }
  return data;
};

const trendData = generateTrendData();

// Radar chart data for platform comparison
const radarData = [
  { metric: 'CTR', 'Google Analytics': 85, 'Google Sheets': 92, 'Facebook Ads': 65, 'LinkedIn Ads': 88 },
  { metric: 'CPC Efficiency', 'Google Analytics': 90, 'Google Sheets': 88, 'Facebook Ads': 75, 'LinkedIn Ads': 70 },
  { metric: 'Conversion Rate', 'Google Analytics': 88, 'Google Sheets': 82, 'Facebook Ads': 72, 'LinkedIn Ads': 85 },
  { metric: 'ROAS', 'Google Analytics': 86, 'Google Sheets': 90, 'Facebook Ads': 68, 'LinkedIn Ads': 75 },
  { metric: 'Quality Score', 'Google Analytics': 85, 'Google Sheets': 78, 'Facebook Ads': 69, 'LinkedIn Ads': 81 },
  { metric: 'Reach', 'Google Analytics': 95, 'Google Sheets': 70, 'Facebook Ads': 80, 'LinkedIn Ads': 45 }
];

// Cost analysis data
const costAnalysisData = platformMetrics.map(platform => ({
  name: platform.platform,
  costPerConversion: platform.spend / platform.conversions,
  totalSpend: platform.spend,
  conversions: platform.conversions,
  efficiency: ((platform.conversions / platform.spend) * 100).toFixed(2)
}));

export default function PlatformComparison() {
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
              <p className="text-slate-600 dark:text-slate-400">Unable to load campaign data for platform comparison.</p>
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

  const getPerformanceBadge = (value: number, metric: string) => {
    let threshold = 0;
    if (metric === 'ctr') threshold = 1.5;
    if (metric === 'roas') threshold = 3.0;
    if (metric === 'conversionRate') threshold = 3.5;
    
    if (value >= threshold) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Excellent</Badge>;
    } else if (value >= threshold * 0.7) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Good</Badge>;
    } else {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Needs Improvement</Badge>;
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
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Platform Comparison</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Comparison Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
              <TabsTrigger value="cost-analysis">Cost Analysis</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Platform Performance Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {platformMetrics.map((platform, index) => (
                  <Card key={index} className="border-l-4" style={{ borderLeftColor: platform.color }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {platform.platform}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Conversions</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(platform.conversions)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Spend</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(platform.spend)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">ROAS</span>
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold text-slate-900 dark:text-white">{platform.roas}x</span>
                          {getPerformanceBadge(platform.roas, 'roas')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Platform Performance Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <GitCompare className="w-5 h-5" />
                    <span>Platform Performance Trends</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--background)', 
                            border: '1px solid var(--border)',
                            borderRadius: '6px' 
                          }} 
                        />
                        <Line type="monotone" dataKey="Google Analytics" stroke="#4285f4" strokeWidth={2} />
                        <Line type="monotone" dataKey="Google Sheets" stroke="#0f9d58" strokeWidth={2} />
                        <Line type="monotone" dataKey="Facebook Ads" stroke="#1877f2" strokeWidth={2} />
                        <Line type="monotone" dataKey="LinkedIn Ads" stroke="#0077b5" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Comparison Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Best CTR Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">LinkedIn Ads</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">1.90% average CTR</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        Best
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Lowest CPC</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">Google Analytics</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">$0.26 average CPC</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <ArrowDown className="w-3 h-3 mr-1" />
                        Efficient
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Highest ROAS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">Google Sheets</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">4.1x return on ad spend</p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        Top ROI
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Performance Metrics Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Radar Chart for Platform Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Performance Radar</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" className="text-xs" />
                          <PolarRadiusAxis domain={[0, 100]} className="text-xs" />
                          <Radar name="Google Analytics" dataKey="Google Analytics" stroke="#4285f4" fill="#4285f4" fillOpacity={0.1} />
                          <Radar name="Google Sheets" dataKey="Google Sheets" stroke="#0f9d58" fill="#0f9d58" fillOpacity={0.1} />
                          <Radar name="Facebook Ads" dataKey="Facebook Ads" stroke="#1877f2" fill="#1877f2" fillOpacity={0.1} />
                          <Radar name="LinkedIn Ads" dataKey="LinkedIn Ads" stroke="#0077b5" fill="#0077b5" fillOpacity={0.1} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Metrics Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Detailed Performance Metrics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {platformMetrics.map((platform, index) => (
                        <div key={index} className="p-3 border rounded-lg dark:border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{platform.platform}</span>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }}></div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="block text-slate-500 font-medium">CTR</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{platform.ctr}%</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">CPC</span>
                              <span className="text-slate-900 dark:text-white font-semibold">${platform.cpc}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 font-medium">Conv. Rate</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{platform.conversionRate}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Platform Volume Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Volume & Reach Comparison</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="platform" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--background)', 
                            border: '1px solid var(--border)',
                            borderRadius: '6px' 
                          }} 
                          formatter={(value, name) => [formatNumber(value as number), name]}
                        />
                        <Bar dataKey="impressions" fill="#3b82f6" name="Impressions" />
                        <Bar dataKey="clicks" fill="#10b981" name="Clicks" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cost Analysis Tab */}
            <TabsContent value="cost-analysis" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Cost Efficiency Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5" />
                      <span>Cost per Conversion</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={costAnalysisData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--background)', 
                              border: '1px solid var(--border)',
                              borderRadius: '6px' 
                            }} 
                            formatter={(value) => [formatCurrency(value as number), "Cost per Conversion"]}
                          />
                          <Bar dataKey="costPerConversion" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Budget Allocation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Budget Allocation Efficiency</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {costAnalysisData.map((platform, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900 dark:text-white">{platform.name}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {platform.efficiency} conversions per $100
                            </span>
                          </div>
                          <Progress value={parseFloat(platform.efficiency) * 2} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Total Spend: {formatCurrency(platform.totalSpend)}</span>
                            <span>{formatNumber(platform.conversions)} conversions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ROI Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Return on Investment Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {platformMetrics.map((platform, index) => (
                      <div key={index} className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                          {platform.roas}x
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">{platform.platform}</div>
                        <Badge variant={platform.roas >= 4 ? "default" : platform.roas >= 3 ? "secondary" : "outline"}>
                          {platform.roas >= 4 ? "Excellent" : platform.roas >= 3 ? "Good" : "Fair"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="grid gap-6">
                {/* AI-Powered Platform Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="w-5 h-5" />
                      <span>Platform Performance Insights</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Top Performer: Google Sheets</h4>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Google Sheets delivers the highest ROAS at 4.1x with strong conversion efficiency. Consider increasing budget allocation by 25% to maximize returns.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Volume Leader: Google Analytics</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Google Analytics provides the highest reach with 15.4M impressions and maintains competitive CPC. Ideal for brand awareness campaigns.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Quality Focus: LinkedIn Ads</h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              LinkedIn Ads shows the highest CTR at 1.90% and strong engagement rates. Perfect for B2B targeting and professional audiences.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Optimization Opportunity: Facebook Ads</h4>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Facebook Ads shows lower ROAS at 2.9x but high reach potential. Consider audience refinement and creative optimization to improve performance.
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
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Budget Reallocation</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Increase Google Sheets budget by 25% (highest ROAS)</li>
                          <li>• Maintain Google Analytics for volume and brand awareness</li>
                          <li>• Optimize LinkedIn Ads creative while maintaining budget</li>
                          <li>• Reduce Facebook Ads budget by 15% until optimization complete</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Platform-Specific Optimizations</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Google Analytics: Focus on high-volume keywords and dayparting</li>
                          <li>• Google Sheets: Expand successful campaign themes and audiences</li>
                          <li>• LinkedIn Ads: Test video formats to leverage high engagement</li>
                          <li>• Facebook Ads: Implement dynamic product ads and lookalike audiences</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Performance Monitoring</h4>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Set up automated alerts for ROAS drops below 3.0x</li>
                          <li>• Monitor CPC trends weekly for early optimization signals</li>
                          <li>• Track cross-platform attribution for holistic view</li>
                          <li>• Implement A/B testing schedule for continuous improvement</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitive Benchmarking */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <GitCompare className="w-5 h-5" />
                      <span>Industry Benchmarking</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400 mb-1">Above Average</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Overall CTR Performance</div>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">+28% vs Industry</Badge>
                      </div>
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">Competitive</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Average CPC Efficiency</div>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Market Average</Badge>
                      </div>
                      <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mb-1">Excellent</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Conversion Performance</div>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">+22% vs Industry</Badge>
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
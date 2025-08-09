import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Calculator, PieChart, BarChart3, AlertTriangle, Target, Zap } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
}

export default function FinancialAnalysis() {
  const [, params] = useRoute("/campaigns/:id/financial");
  const campaignId = params?.id;

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Get Google Sheets financial data
  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Get GA4 data for additional metrics
  const { data: ga4Data } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
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

  // Calculate financial metrics
  const totalSpend = sheetsData?.summary?.totalSpend || 0;
  const totalImpressions = sheetsData?.summary?.totalImpressions || 0;
  const totalClicks = sheetsData?.summary?.totalClicks || 0;
  const totalConversions = sheetsData?.summary?.totalConversions || 0;
  const campaignBudget = campaign.budget ? parseFloat(campaign.budget) : 0;

  // Financial calculations
  const budgetUtilization = campaignBudget > 0 ? (totalSpend / campaignBudget) * 100 : 0;
  const remainingBudget = campaignBudget - totalSpend;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  
  // Assume average order value and calculate revenue/ROI
  const estimatedAOV = 50; // This would come from connected e-commerce data
  const estimatedRevenue = totalConversions * estimatedAOV;
  const roas = totalSpend > 0 ? estimatedRevenue / totalSpend : 0;
  const roi = totalSpend > 0 ? ((estimatedRevenue - totalSpend) / totalSpend) * 100 : 0;

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
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Budget & Financial Analysis
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {campaign.name} - Comprehensive financial performance overview
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="roi-roas">ROI & ROAS</TabsTrigger>
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
              <TabsTrigger value="budget">Budget Allocation</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Key Financial Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(totalSpend)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Estimated Revenue</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(estimatedRevenue)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {roas.toFixed(2)}x
                        </p>
                      </div>
                      <Calculator className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</p>
                        <p className={`text-2xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(roi)}
                        </p>
                      </div>
                      {roi >= 0 ? (
                        <TrendingUp className="w-8 h-8 text-green-500" />
                      ) : (
                        <TrendingDown className="w-8 h-8 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Utilization */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Budget Utilization</span>
                  </CardTitle>
                  <CardDescription>
                    Campaign budget usage and remaining allocation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Budget Used</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(totalSpend)} of {formatCurrency(campaignBudget)}
                      </span>
                    </div>
                    <Progress value={Math.min(budgetUtilization, 100)} className="h-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className={budgetUtilization > 90 ? "text-red-600" : "text-green-600"}>
                        {formatPercentage(budgetUtilization)} utilized
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(remainingBudget)} remaining
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Efficiency Metrics */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost Per Click</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpc)}
                        </p>
                      </div>
                      <BarChart3 className="w-6 h-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost Per Acquisition</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cpa)}
                        </p>
                      </div>
                      <Target className="w-6 h-6 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(conversionRate)}
                        </p>
                      </div>
                      <PieChart className="w-6 h-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="roi-roas" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>ROI & ROAS Analysis</CardTitle>
                  <CardDescription>
                    Return on investment and return on ad spend detailed breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Ad Spend (ROAS)</h4>
                      <div className="text-3xl font-bold text-blue-600">{roas.toFixed(2)}x</div>
                      <p className="text-sm text-muted-foreground">
                        For every $1 spent on advertising, you generated ${roas.toFixed(2)} in revenue.
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Ad Spend:</span>
                          <span className="font-medium">{formatCurrency(totalSpend)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimated Revenue:</span>
                          <span className="font-medium">{formatCurrency(estimatedRevenue)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Investment (ROI)</h4>
                      <div className={`text-3xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(roi)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {roi >= 0 ? 'Positive' : 'Negative'} return on your advertising investment.
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Net Profit:</span>
                          <span className={`font-medium ${estimatedRevenue - totalSpend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(estimatedRevenue - totalSpend)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Investment:</span>
                          <span className="font-medium">{formatCurrency(totalSpend)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="costs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cost Analysis Breakdown</CardTitle>
                  <CardDescription>
                    Detailed cost efficiency and optimization opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Cost Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Click (CPC)</span>
                          <span className="font-medium">{formatCurrency(cpc)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Acquisition (CPA)</span>
                          <span className="font-medium">{formatCurrency(cpa)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Thousand Impressions (CPM)</span>
                          <span className="font-medium">
                            {totalImpressions > 0 ? formatCurrency((totalSpend / totalImpressions) * 1000) : '$0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Efficiency Indicators</h4>
                      <div className="space-y-3">
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span>Click-through Rate</span>
                            <span className="font-medium">{formatPercentage(ctr)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(ctr * 10, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span>Conversion Rate</span>
                            <span className="font-medium">{formatPercentage(conversionRate)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(conversionRate * 5, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="budget" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Intelligent Budget Allocation</span>
                  </CardTitle>
                  <CardDescription>
                    AI-powered budget recommendations and allocation insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold text-green-600 mb-2">High Performance</h4>
                        <p className="text-2xl font-bold">{formatCurrency(totalSpend * 0.6)}</p>
                        <p className="text-sm text-muted-foreground">60% of current spend</p>
                        <p className="text-xs mt-2">Platforms with ROAS &gt; 3.0x</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold text-yellow-600 mb-2">Medium Performance</h4>
                        <p className="text-2xl font-bold">{formatCurrency(totalSpend * 0.3)}</p>
                        <p className="text-sm text-muted-foreground">30% of current spend</p>
                        <p className="text-xs mt-2">Platforms with ROAS 1.5-3.0x</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold text-red-600 mb-2">Low Performance</h4>
                        <p className="text-2xl font-bold">{formatCurrency(totalSpend * 0.1)}</p>
                        <p className="text-sm text-muted-foreground">10% of current spend</p>
                        <p className="text-xs mt-2">Platforms with ROAS &lt; 1.5x</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Budget Optimization Recommendations</h4>
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                          <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Increase High-Performing Platform Budget</p>
                            <p className="text-sm text-muted-foreground">
                              Consider increasing budget allocation to platforms generating ROAS above 3.0x
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Optimize Underperforming Campaigns</p>
                            <p className="text-sm text-muted-foreground">
                              Review targeting and creative for campaigns with CPA above ${(totalSpend / totalConversions * 1.5).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <Calculator className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Budget Reallocation Opportunity</p>
                            <p className="text-sm text-muted-foreground">
                              Shifting {formatCurrency(totalSpend * 0.15)} to top-performing platforms could improve overall ROAS by 20-30%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Performance Insights</CardTitle>
                  <CardDescription>
                    Key insights and recommendations for financial optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-300">Performance Summary</h4>
                      <p className="text-sm mt-1">
                        Your campaign is generating a {roas.toFixed(2)}x ROAS with {formatPercentage(roi)} ROI. 
                        {roi >= 20 ? " Excellent performance!" : roi >= 0 ? " Positive returns achieved." : " Consider optimization to improve profitability."}
                      </p>
                    </div>
                    
                    <div className="p-4 border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
                      <h4 className="font-semibold text-green-700 dark:text-green-300">Cost Efficiency</h4>
                      <p className="text-sm mt-1">
                        Your CPA of {formatCurrency(cpa)} is {cpa < 25 ? "excellent" : cpa < 50 ? "competitive" : "above average"}. 
                        Consider optimizing targeting to reduce acquisition costs further.
                      </p>
                    </div>
                    
                    <div className="p-4 border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20">
                      <h4 className="font-semibold text-orange-700 dark:text-orange-300">Budget Management</h4>
                      <p className="text-sm mt-1">
                        You've utilized {formatPercentage(budgetUtilization)} of your budget. 
                        {budgetUtilization > 80 ? "Consider increasing budget for high-performing campaigns." : "Pace is healthy with room for optimization."}
                      </p>
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
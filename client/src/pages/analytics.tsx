import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { Download, CalendarIcon, TrendingUp, TrendingDown, DollarSign, Target, Eye, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

// Sample analytics data
const performanceData = [
  { date: "Jan", impressions: 45000, clicks: 2200, conversions: 180, spend: 1200, revenue: 5400 },
  { date: "Feb", impressions: 52000, clicks: 2800, conversions: 220, spend: 1450, revenue: 6200 },
  { date: "Mar", impressions: 48000, clicks: 2500, conversions: 195, spend: 1300, revenue: 5850 },
  { date: "Apr", impressions: 58000, clicks: 3200, conversions: 280, spend: 1600, revenue: 7200 },
  { date: "May", impressions: 62000, clicks: 3500, conversions: 310, spend: 1750, revenue: 8100 },
  { date: "Jun", impressions: 55000, clicks: 3100, conversions: 285, spend: 1650, revenue: 7600 },
];

const platformData = [
  { platform: "Facebook", spend: 3200, revenue: 12400, roas: 3.9, color: "#2563EB" },
  { platform: "Google Ads", spend: 2800, revenue: 15200, roas: 5.4, color: "#10B981" },
  { platform: "LinkedIn", spend: 1500, revenue: 6800, roas: 4.5, color: "#F59E0B" },
  { platform: "Twitter", spend: 1200, revenue: 4200, roas: 3.5, color: "#EF4444" },
];

const conversionFunnelData = [
  { name: "Impressions", value: 320000, fill: "#2563EB" },
  { name: "Clicks", value: 16000, fill: "#10B981" },
  { name: "Landing Page Views", value: 12800, fill: "#F59E0B" },
  { name: "Add to Cart", value: 3200, fill: "#EF4444" },
  { name: "Purchases", value: 1280, fill: "#8B5CF6" },
];

const attributionData = [
  { touchpoint: "First Click", conversions: 380, percentage: 32 },
  { touchpoint: "Last Click", conversions: 450, percentage: 38 },
  { touchpoint: "Linear", conversions: 180, percentage: 15 },
  { touchpoint: "Time Decay", conversions: 120, percentage: 10 },
  { touchpoint: "Position Based", conversions: 70, percentage: 5 },
];

const cohortData = [
  { week: "Week 1", retention: 100, revenue: 2500 },
  { week: "Week 2", retention: 75, revenue: 2100 },
  { week: "Week 3", retention: 58, revenue: 1800 },
  { week: "Week 4", retention: 45, revenue: 1500 },
  { week: "Week 8", retention: 32, revenue: 1200 },
  { week: "Week 12", retention: 28, revenue: 1100 },
];

export default function Analytics() {
  const [dateRange, setDateRange] = useState("30days");
  const [selectedMetric, setSelectedMetric] = useState("revenue");
  const [date, setDate] = useState<Date>();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const calculateTotalRevenue = () => {
    return performanceData.reduce((sum, item) => sum + item.revenue, 0);
  };

  const calculateTotalSpend = () => {
    return performanceData.reduce((sum, item) => sum + item.spend, 0);
  };

  const calculateROAS = () => {
    const totalRevenue = calculateTotalRevenue();
    const totalSpend = calculateTotalSpend();
    return totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "0.00";
  };

  const calculateConversionRate = () => {
    const totalClicks = performanceData.reduce((sum, item) => sum + item.clicks, 0);
    const totalConversions = performanceData.reduce((sum, item) => sum + item.conversions, 0);
    return totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : "0.00";
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case "revenue":
        return "#10B981";
      case "spend":
        return "#EF4444";
      case "impressions":
        return "#2563EB";
      case "conversions":
        return "#F59E0B";
      default:
        return "#2563EB";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Advanced Analytics</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Deep insights into your marketing performance and ROI</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(calculateTotalRevenue())}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <ArrowUpRight className="w-4 h-4 text-accent" />
                        <span className="text-sm text-accent">+12.5%</span>
                      </div>
                    </div>
                    <DollarSign className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{calculateROAS()}x</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <ArrowUpRight className="w-4 h-4 text-accent" />
                        <span className="text-sm text-accent">+8.2%</span>
                      </div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Rate</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{calculateConversionRate()}%</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">-2.1%</span>
                      </div>
                    </div>
                    <Target className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(calculateTotalSpend())}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <ArrowUpRight className="w-4 h-4 text-warning" />
                        <span className="text-sm text-warning">+15.3%</span>
                      </div>
                    </div>
                    <Eye className="w-8 h-8 text-warning" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Tabs defaultValue="performance" className="space-y-6">
            <TabsList>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="attribution">Attribution</TabsTrigger>
              <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
              <TabsTrigger value="cohort">Cohort Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="performance">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Performance Over Time</CardTitle>
                      <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revenue">Revenue</SelectItem>
                          <SelectItem value="spend">Spend</SelectItem>
                          <SelectItem value="impressions">Impressions</SelectItem>
                          <SelectItem value="conversions">Conversions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#64748b"
                            fontSize={12}
                          />
                          <YAxis 
                            stroke="#64748b"
                            fontSize={12}
                          />
                          <Line
                            type="monotone"
                            dataKey={selectedMetric}
                            stroke={getMetricColor()}
                            strokeWidth={3}
                            dot={{ fill: getMetricColor(), strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8, stroke: getMetricColor(), strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Platform Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {platformData.map((platform, index) => (
                        <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900 dark:text-white">{platform.platform}</span>
                            <Badge variant="outline" style={{ borderColor: platform.color, color: platform.color }}>
                              {platform.roas}x ROAS
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Spend:</span>
                              <span className="font-medium">{formatCurrency(platform.spend)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Revenue:</span>
                              <span className="font-medium">{formatCurrency(platform.revenue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attribution">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Attribution Models</CardTitle>
                    <CardDescription>How conversions are attributed to different touchpoints</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attributionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="touchpoint" 
                            stroke="#64748b"
                            fontSize={10}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            stroke="#64748b"
                            fontSize={12}
                          />
                          <Bar dataKey="conversions" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Attribution Breakdown</CardTitle>
                    <CardDescription>Percentage contribution by model</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {attributionData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">{item.touchpoint}</span>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{item.conversions} conversions</p>
                          </div>
                          <Badge variant="outline">
                            {item.percentage}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Customer Journey Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Customer Journey Paths</CardTitle>
                  <CardDescription>Multi-touch conversion paths and channel contribution analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Top Conversion Paths</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">1</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">TikTok → Product Page → Cart → Purchase</span>
                              <div className="text-xs text-slate-600 dark:text-slate-400">Mobile-first journey, impulse buying</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">42%</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">Instagram → Browse → Email → Purchase</span>
                              <div className="text-xs text-slate-600 dark:text-slate-400">Discovery through social, nurtured via email</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">31%</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-green-600 dark:text-green-400">3</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">Google → Compare → Return → Purchase</span>
                              <div className="text-xs text-slate-600 dark:text-slate-400">Research-driven, multiple touchpoints</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">27%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Attribution Insights</h4>
                      <div className="grid gap-4">
                        <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">2.3</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Avg. Sessions to Convert</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">4.2 days</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Avg. Time to Convert</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg dark:border-slate-700">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">68%</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">First-Touch Attribution</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="funnel">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Conversion Funnel</CardTitle>
                    <CardDescription>User journey from awareness to conversion</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {conversionFunnelData.map((step, index) => {
                        const nextStep = conversionFunnelData[index + 1];
                        const conversionRate = nextStep ? ((nextStep.value / step.value) * 100).toFixed(1) : null;
                        
                        return (
                          <div key={index} className="relative">
                            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg" 
                                 style={{ borderLeftColor: step.fill, borderLeftWidth: '4px' }}>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-white">{step.name}</span>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{formatNumber(step.value)} users</p>
                              </div>
                              {conversionRate && (
                                <Badge variant="outline">
                                  {conversionRate}% convert
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Funnel Insights</CardTitle>
                    <CardDescription>Key optimization opportunities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <span className="font-medium text-red-900 dark:text-red-100">Biggest Drop-off</span>
                        </div>
                        <p className="text-sm text-red-800 dark:text-red-200">
                          Only 80% of clicks result in landing page views. Check page load speed and relevance.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-900 dark:text-green-100">Best Conversion</span>
                        </div>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          40% of cart additions convert to purchases. Strong checkout experience.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-900 dark:text-blue-100">Overall Rate</span>
                        </div>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          0.4% overall conversion rate from impression to purchase.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cohort">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Cohort Analysis</CardTitle>
                  <CardDescription>User retention and revenue patterns over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cohortData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="week" 
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="retention"
                          stroke="#2563EB"
                          strokeWidth={3}
                          dot={{ fill: "#2563EB", strokeWidth: 2, r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ fill: "#10B981", strokeWidth: 2, r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
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
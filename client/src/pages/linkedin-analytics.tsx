import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, TrendingUp, DollarSign, Eye, MousePointer, Users, Award, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";

// Mock LinkedIn Ads data for Summer Splash campaign
const mockLinkedInAds = [
  {
    id: "lin-001",
    name: "Summer Splash - Professional Style",
    status: "active",
    type: "Single Image Ad",
    budget: 1200,
    spent: 847.32,
    impressions: 43520,
    clicks: 892,
    conversions: 34,
    revenue: 2650.50,
    ctr: 2.05,
    cpc: 0.95,
    conversionRate: 3.81,
    roas: 3.13,
    createdDate: "2024-07-15",
    lastModified: "2024-08-10"
  },
  {
    id: "lin-002", 
    name: "Summer Splash - Executive Collection",
    status: "active",
    type: "Carousel Ad",
    budget: 800,
    spent: 523.45,
    impressions: 28675,
    clicks: 641,
    conversions: 29,
    revenue: 2247.75,
    ctr: 2.24,
    cpc: 0.82,
    conversionRate: 4.52,
    roas: 4.29,
    createdDate: "2024-07-20",
    lastModified: "2024-08-09"
  },
  {
    id: "lin-003",
    name: "Summer Splash - Business Casual",
    status: "active", 
    type: "Video Ad",
    budget: 1500,
    spent: 1234.67,
    impressions: 67840,
    clicks: 1358,
    conversions: 52,
    revenue: 4185.30,
    ctr: 2.00,
    cpc: 0.91,
    conversionRate: 3.83,
    roas: 3.39,
    createdDate: "2024-07-18",
    lastModified: "2024-08-11"
  },
  {
    id: "lin-004",
    name: "Summer Splash - Networking Essentials",
    status: "paused",
    type: "Single Image Ad", 
    budget: 600,
    spent: 287.89,
    impressions: 15240,
    clicks: 203,
    conversions: 8,
    revenue: 615.60,
    ctr: 1.33,
    cpc: 1.42,
    conversionRate: 3.94,
    roas: 2.14,
    createdDate: "2024-07-25",
    lastModified: "2024-08-05"
  },
  {
    id: "lin-005",
    name: "Summer Splash - Premium Workwear",
    status: "active",
    type: "Dynamic Ad",
    budget: 2000,
    spent: 1567.23,
    impressions: 89340,
    clicks: 1789,
    conversions: 71,
    revenue: 5899.45,
    ctr: 2.00,
    cpc: 0.88,
    conversionRate: 3.97,
    roas: 3.76,
    createdDate: "2024-07-12",
    lastModified: "2024-08-12"
  }
];

export default function LinkedInAnalytics() {
  const { id: campaignId } = useParams();
  const [sortField, setSortField] = useState<string>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch real campaign data
  const { data: campaign } = useQuery({
    queryKey: ["campaign", campaignId],
    enabled: !!campaignId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case "completed":
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAdTypeIcon = (type: string) => {
    switch (type) {
      case "Video Ad":
        return <Play className="w-4 h-4" />;
      case "Carousel Ad":
        return <BarChart3 className="w-4 h-4" />;
      case "Dynamic Ad":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  // Calculate totals
  const totals = mockLinkedInAds.reduce((acc, ad) => ({
    budget: acc.budget + ad.budget,
    spent: acc.spent + ad.spent,
    impressions: acc.impressions + ad.impressions,
    clicks: acc.clicks + ad.clicks,
    conversions: acc.conversions + ad.conversions,
    revenue: acc.revenue + ad.revenue
  }), { budget: 0, spent: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

  const overallCTR = (totals.clicks / totals.impressions) * 100;
  const overallCPC = totals.spent / totals.clicks;
  const overallConversionRate = (totals.conversions / totals.clicks) * 100;
  const overallROAS = totals.revenue / totals.spent;

  // Sort ads
  const sortedAds = [...mockLinkedInAds].sort((a, b) => {
    const aValue = a[sortField as keyof typeof a] as number;
    const bValue = b[sortField as keyof typeof b] as number;
    return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-8">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  LinkedIn Ads Analytics
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {campaign?.name} • LinkedIn Advertising Performance
                </p>
              </div>
            </div>

            {/* Overview Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Revenue</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(totals.revenue)}
                      </p>
                      <p className="text-sm text-green-600">+24.5% vs last month</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Conversions</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(totals.conversions)}
                      </p>
                      <p className="text-sm text-green-600">+18.3% vs last month</p>
                    </div>
                    <Award className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Overall ROAS</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {overallROAS.toFixed(2)}x
                      </p>
                      <p className="text-sm text-green-600">+12.1% vs last month</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Impressions</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(totals.impressions)}
                      </p>
                      <p className="text-sm text-green-600">+31.7% vs last month</p>
                    </div>
                    <Eye className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Summary */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Campaign Performance Summary</CardTitle>
                <CardDescription>
                  Overall performance metrics across all LinkedIn ads in this campaign
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {formatPercentage(overallCTR)}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      Click-Through Rate
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {formatCurrency(overallCPC)}
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-200">
                      Cost Per Click
                    </div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {formatPercentage(overallConversionRate)}
                    </div>
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                      Conversion Rate
                    </div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {formatPercentage((totals.spent / totals.budget) * 100)}
                    </div>
                    <div className="text-sm text-orange-800 dark:text-orange-200">
                      Budget Utilization
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ad Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Individual Ad Performance</span>
                </CardTitle>
                <CardDescription>
                  Compare performance across all LinkedIn ads to identify top performers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Ad Name</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => {
                              if (sortField === "revenue") {
                                setSortDirection(sortDirection === "desc" ? "asc" : "desc");
                              } else {
                                setSortField("revenue");
                                setSortDirection("desc");
                              }
                            }}>
                          Revenue {sortField === "revenue" && (sortDirection === "desc" ? "↓" : "↑")}
                        </th>
                        <th className="text-right p-3 font-medium">Conversions</th>
                        <th className="text-right p-3 font-medium">ROAS</th>
                        <th className="text-right p-3 font-medium">CTR</th>
                        <th className="text-right p-3 font-medium">Spent</th>
                        <th className="text-right p-3 font-medium">Budget Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAds.map((ad) => (
                        <tr key={ad.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="p-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {ad.name}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              ID: {ad.id}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              {getAdTypeIcon(ad.type)}
                              <span className="text-sm">{ad.type}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {getStatusBadge(ad.status)}
                          </td>
                          <td className="text-right p-3 font-medium text-green-600">
                            {formatCurrency(ad.revenue)}
                          </td>
                          <td className="text-right p-3">
                            {ad.conversions}
                          </td>
                          <td className="text-right p-3">
                            <span className={ad.roas >= 3 ? "text-green-600 font-medium" : ad.roas >= 2 ? "text-yellow-600" : "text-red-600"}>
                              {ad.roas.toFixed(2)}x
                            </span>
                          </td>
                          <td className="text-right p-3">
                            {formatPercentage(ad.ctr)}
                          </td>
                          <td className="text-right p-3">
                            {formatCurrency(ad.spent)}
                          </td>
                          <td className="text-right p-3">
                            <div className="w-16 ml-auto">
                              <Progress 
                                value={(ad.spent / ad.budget) * 100} 
                                className="h-2"
                              />
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {formatPercentage((ad.spent / ad.budget) * 100)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Ad Insights */}
            <div className="grid gap-6 md:grid-cols-2 mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">🏆 Top Revenue Driver</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-semibold">Premium Workwear</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Revenue:</span>
                        <div className="font-medium text-green-600">{formatCurrency(5899.45)}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">ROAS:</span>
                        <div className="font-medium">3.76x</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Dynamic ads targeting executives and senior professionals are performing exceptionally well
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">📈 Best Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-semibold">Executive Collection</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Conversion Rate:</span>
                        <div className="font-medium text-blue-600">4.52%</div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">ROAS:</span>
                        <div className="font-medium">4.29x</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Carousel ads showcasing premium collection are converting at the highest rate
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
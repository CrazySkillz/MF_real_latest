import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MetaAnalytics() {
  const [, params] = useRoute("/campaigns/:id/meta-analytics");
  const campaignId = params?.id;

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch Meta analytics");
      return response.json();
    },
    enabled: !!campaignId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading Meta analytics...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No Meta analytics data available</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { summary, campaigns } = analyticsData;
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  // Prepare data for charts
  const campaignPerformanceData = campaigns.slice(0, 5).map((c: any) => ({
    name: c.campaign.name.length > 20 ? c.campaign.name.substring(0, 20) + '...' : c.campaign.name,
    spend: c.totals.spend,
    conversions: c.totals.conversions,
    clicks: c.totals.clicks,
  }));

  const objectiveDistribution = campaigns.reduce((acc: any, c: any) => {
    const objective = c.campaign.objective;
    if (!acc[objective]) {
      acc[objective] = { name: objective, value: 0, campaigns: 0 };
    }
    acc[objective].value += c.totals.spend;
    acc[objective].campaigns += 1;
    return acc;
  }, {});

  const objectiveData = Object.values(objectiveDistribution);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meta/Facebook Ads Analytics</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Ad Account: {analyticsData.adAccountName}
                </p>
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                Test Mode - Realistic Demo Data
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {summary.totalCampaigns} campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalImpressions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total ad views
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((summary.totalClicks / summary.totalImpressions) * 100).toFixed(2)}% CTR
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalConversions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${(summary.totalSpend / summary.totalConversions).toFixed(2)} per conversion
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Top 5 campaigns by spend</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={campaignPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="spend" fill="#3b82f6" name="Spend ($)" />
                    <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spend by Objective</CardTitle>
                <CardDescription>Budget allocation across campaign types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={objectiveData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: $${entry.value.toFixed(0)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {objectiveData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns</CardTitle>
              <CardDescription>Detailed performance metrics for all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Objective</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaignData: any) => {
                    const { campaign, totals } = campaignData;
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.objective}</TableCell>
                        <TableCell className="text-right">${totals.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{totals.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{totals.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{totals.ctr}%</TableCell>
                        <TableCell className="text-right">{totals.conversions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${totals.cpc.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Demographics & Geographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Top Demographics</CardTitle>
                <CardDescription>Performance by age and gender (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.demographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Range</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].demographics.slice(0, 6).map((demo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{demo.ageRange}</TableCell>
                          <TableCell className="capitalize">{demo.gender}</TableCell>
                          <TableCell className="text-right">{demo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{demo.clicks.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
                <CardDescription>Performance by country (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.geographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].geographics.map((geo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{geo.country}</TableCell>
                          <TableCell className="text-right">{geo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{geo.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${geo.spend.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Placements */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Ad Placements</CardTitle>
              <CardDescription>Performance by placement (first campaign)</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns[0]?.placements && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placement</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns[0].placements.map((placement: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{placement.placement}</TableCell>
                        <TableCell className="text-right">{placement.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${placement.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.conversions.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}


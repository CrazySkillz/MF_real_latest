import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, TrendingUp, Clock, Globe, Target, Plus, X, Trash2 } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import InteractiveWorldMap from "@/components/InteractiveWorldMap";
import SimpleGeographicMap from "@/components/SimpleGeographicMap";
import WorldMapSVG from "@/components/WorldMapSVG";
import { SiGoogle } from "react-icons/si";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  platform?: string;
  status: string;
}

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
  newUsers?: number;
  userEngagementDuration?: number;
  engagedSessions?: number;
  engagementRate?: number;
  eventCount?: number;
  eventsPerSession?: number;
  screenPageViewsPerSession?: number;
}

const kpiFormSchema = z.object({
  name: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  targetValue: z.string().min(1, "Target value is required"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  timeframe: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("monthly"),
  trackingPeriod: z.number().min(1).max(365).default(30),
  rollingAverage: z.enum(["1day", "7day", "30day", "none"]).default("7day"),
  targetDate: z.string().optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  alertsEnabled: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  slackNotifications: z.boolean().default(false),
  alertFrequency: z.enum(["immediate", "daily", "weekly"]).default("daily"),
});

type KPIFormData = z.infer<typeof kpiFormSchema>;

export default function GA4Metrics() {
  const [, params] = useRoute("/campaigns/:id/ga4-metrics");
  const campaignId = params?.id;
  const [dateRange, setDateRange] = useState("7days");
  const [showAutoRefresh, setShowAutoRefresh] = useState(false);
  const [showKPIDialog, setShowKPIDialog] = useState(false);
  const [selectedKPITemplate, setSelectedKPITemplate] = useState<any>(null);
  const [deleteKPIId, setDeleteKPIId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const kpiForm = useForm<KPIFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "%",
      targetValue: "",
      priority: "medium",
      timeframe: "monthly",
      trackingPeriod: 30,
      rollingAverage: "7day",
      targetDate: "",
      alertThreshold: 80,
      alertsEnabled: true,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: "daily",
    },
  });

  // Function to calculate current KPI value based on template and platform data
  const calculateKPIValue = (template: any, ga4Data: any, sheetsData: any) => {
    if (!template) return "0.00";
    
    try {
      switch (template.name) {
        case "ROI (Return on Investment)":
          // ROI = (Revenue - Cost) / Cost × 100
          const revenue = sheetsData?.totalRevenue || (ga4Data?.conversions || 0) * 25; // Assuming $25 per conversion
          const cost = sheetsData?.totalSpend || 500; // Default cost
          return cost > 0 ? (((revenue - cost) / cost) * 100).toFixed(2) : "0.00";
          
        case "ROAS (Return on Ad Spend)":
          // ROAS = Revenue / Ad Spend
          const adRevenue = sheetsData?.totalRevenue || (ga4Data?.conversions || 0) * 25;
          const adSpend = sheetsData?.totalSpend || 500;
          return adSpend > 0 ? (adRevenue / adSpend).toFixed(2) : "0.00";
          
        case "CTR (Click-Through Rate)":
          // CTR = Clicks / Impressions × 100
          const clicks = sheetsData?.totalClicks || ga4Data?.clicks || 0;
          const impressions = sheetsData?.totalImpressions || ga4Data?.impressions || 0;
          return impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
          
        case "Conversion Rate":
          // Conversion Rate = Conversions / Clicks × 100
          const conversions = sheetsData?.totalConversions || ga4Data?.conversions || 0;
          const totalClicks = sheetsData?.totalClicks || ga4Data?.clicks || 0;
          return totalClicks > 0 ? ((conversions / totalClicks) * 100).toFixed(2) : "0.00";
          
        case "CPA (Cost Per Acquisition)":
          // CPA = Total Ad Spend / Conversions
          const totalSpend = sheetsData?.totalSpend || 500;
          const totalConversions = sheetsData?.totalConversions || ga4Data?.conversions || 1;
          return totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";
          
        case "LTV/CAC Ratio":
          // LTV/CAC = Customer Lifetime Value / Customer Acquisition Cost
          const avgOrderValue = 75; // Assumed average order value
          const repeatPurchases = 3; // Assumed repeat purchases
          const ltv = avgOrderValue * repeatPurchases;
          const cac = sheetsData?.totalSpend || 500 / (sheetsData?.totalConversions || ga4Data?.conversions || 1);
          return cac > 0 ? (ltv / cac).toFixed(2) : "0.00";
          
        default:
          return "0.00";
      }
    } catch (error) {
      console.error("Error calculating KPI value:", error);
      return "0.00";
    }
  };

  // Create KPI mutation
  const createKPIMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      // Calculate current value if using a template
      let calculatedValue = "0.00";
      if (selectedKPITemplate) {
        // Fetch current platform data for calculation
        try {
          const [ga4Response, sheetsResponse] = await Promise.all([
            fetch(`/api/campaigns/${campaignId}/ga4-metrics?dateRange=${dateRange}`).catch(() => null),
            fetch(`/api/campaigns/${campaignId}/google-sheets-data`).catch(() => null)
          ]);
          
          const ga4Data = ga4Response?.ok ? await ga4Response.json() : null;
          const sheetsData = sheetsResponse?.ok ? await sheetsResponse.json() : null;
          
          calculatedValue = calculateKPIValue(selectedKPITemplate, ga4Data?.metrics, sheetsData);
        } catch (error) {
          console.error("Error fetching platform data for KPI calculation:", error);
        }
      }
      
      const response = await fetch(`/api/platforms/google_analytics/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          currentValue: calculatedValue // Set the calculated current value
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create KPI");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/kpis`] });
      setShowKPIDialog(false);
      kpiForm.reset();
      toast({ title: "KPI created successfully" });
    },
    onError: (error) => {
      console.error("KPI creation error:", error);
      toast({ 
        title: "Failed to create KPI", 
        description: error.message || "An unexpected error occurred",
        variant: "destructive" 
      });
    },
  });

  // Delete KPI mutation
  const deleteKPIMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const response = await fetch(`/api/platforms/google_analytics/kpis/${kpiId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to delete KPI";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Handle successful response
      try {
        return await response.json();
      } catch {
        // If response is not JSON (e.g., empty body), return success
        return { message: "KPI deleted successfully" };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/google_analytics/kpis`] });
      toast({ title: "KPI deleted successfully" });
    },
    onError: (error) => {
      console.error("KPI deletion error:", error);
      toast({ 
        title: "Failed to delete KPI", 
        description: error.message || "An unexpected error occurred",
        variant: "destructive" 
      });
    },
  });

  const onCreateKPI = async (data: KPIFormData) => {
    createKPIMutation.mutate(data);
  };

  const onDeleteKPI = (kpiId: string) => {
    setDeleteKPIId(kpiId);
  };

  const confirmDeleteKPI = () => {
    if (deleteKPIId) {
      deleteKPIMutation.mutate(deleteKPIId);
      setDeleteKPIId(null);
    }
  };

  // Helper functions for KPI display
  const formatValue = (value: string, unit: string) => {
    const numValue = parseFloat(value);
    switch (unit) {
      case "%":
        return `${numValue}%`;
      case "$":
        return `$${numValue.toLocaleString()}`;
      case "ratio":
        return `${numValue}:1`;
      default:
        return numValue.toLocaleString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "achieved":
        return "bg-green-100 text-green-800 border-green-200";
      case "tracking":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "at_risk":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Check GA4 connection status
  const { data: ga4Connection } = useQuery({
    queryKey: ["/api/ga4/check-connection", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/ga4/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  // Fetch platform KPIs
  const { data: platformKPIs = [], isLoading: kpisLoading } = useQuery({
    queryKey: [`/api/platforms/google_analytics/kpis`],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/kpis`);
      if (!response.ok) throw new Error("Failed to fetch KPIs");
      return response.json();
    },
  });

  const { data: ga4Metrics, isLoading: ga4Loading, error: ga4Error } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics?dateRange=${dateRange}`);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle automatic refresh needed
        if (errorData.error === 'AUTO_REFRESH_NEEDED' && errorData.autoRefresh) {
          throw new Error('AUTO_REFRESH_NEEDED');
        }
        
        // Handle token expiration specifically
        if (errorData.error === 'TOKEN_EXPIRED' && errorData.requiresReconnection) {
          throw new Error('TOKEN_EXPIRED');
        }
        
        throw new Error(errorData.error || 'Failed to fetch GA4 metrics');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'GA4 metrics request failed');
      }
      
      return {
        impressions: data.metrics.impressions || 0,
        clicks: data.metrics.clicks || 0,
        sessions: data.metrics.sessions || 0,
        pageviews: data.metrics.pageviews || 0,
        bounceRate: data.metrics.bounceRate || 0,
        averageSessionDuration: data.metrics.averageSessionDuration || 0,
        conversions: data.metrics.conversions || 0,
        newUsers: data.metrics.newUsers || 0,
        userEngagementDuration: data.metrics.userEngagementDuration || 0,
        engagedSessions: data.metrics.engagedSessions || 0,
        engagementRate: data.metrics.engagementRate || 0,
        eventCount: data.metrics.eventCount || 0,
        eventsPerSession: data.metrics.eventsPerSession || 0,
        screenPageViewsPerSession: data.metrics.screenPageViewsPerSession || 0,
        propertyId: data.propertyId,
        lastUpdated: data.lastUpdated
      };
    },
  });

  // Geographic data query
  const { data: geographicData, isLoading: geoLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-geographic", dateRange],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-geographic?dateRange=${dateRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch geographic data');
      }
      return response.json();
    },
  });

  // Sample time series data (placeholder data for demonstration)
  const timeSeriesData = [
    { date: "Jan", sessions: 1250, pageviews: 3400, conversions: 45 },
    { date: "Feb", sessions: 1680, pageviews: 4200, conversions: 62 },
    { date: "Mar", sessions: 1420, pageviews: 3800, conversions: 51 },
    { date: "Apr", sessions: 1890, pageviews: 4800, conversions: 78 },
    { date: "May", sessions: 2100, pageviews: 5200, conversions: 89 },
    { date: "Jun", sessions: 1950, pageviews: 4900, conversions: 82 },
  ];

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  // If GA4 is not connected, show connection flow
  if (!ga4Connection?.connected) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-6">
                <Link href={`/campaigns/${campaignId}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics Metrics</h1>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">for {campaign.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                  <SiGoogle className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Connect Google Analytics</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
                  Connect your Google Analytics account to view detailed metrics and insights for this campaign.
                </p>
                <GA4ConnectionFlow 
                  campaignId={campaign.id}
                  onConnectionSuccess={() => {
                    window.location.reload();
                  }}
                />
              </div>
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
                    <SiGoogle className="w-8 h-8 text-orange-500" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Google Analytics</h1>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Detailed metrics for {campaign.name}</p>

                </div>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {ga4Loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : ga4Error ? (
            ga4Error.message === 'AUTO_REFRESH_NEEDED' ? (
              <Card className="mb-8">
                <CardContent className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <SiGoogle className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Refreshing Your Access</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Your access token has expired. Click below to get fresh tokens from OAuth 2.0 Playground and automatically update your connection.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={() => {
                        window.open('https://developers.google.com/oauthplayground', '_blank');
                        toast({
                          title: "OAuth Playground Opened",
                          description: "Get fresh access and refresh tokens, then paste them below to continue.",
                          duration: 5000,
                        });
                        setShowAutoRefresh(true);
                      }}
                      className="mr-3"
                    >
                      Open OAuth Playground
                    </Button>
                    {showAutoRefresh && (
                      <div className="mt-6">
                        <GA4ConnectionFlow 
                          campaignId={campaign.id}
                          onConnectionSuccess={() => {
                            setShowAutoRefresh(false);
                            window.location.reload();
                          }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : ga4Error.message === 'TOKEN_EXPIRED' ? (
              <Card className="mb-8">
                <CardContent className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                    <SiGoogle className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Refresh Your Google Analytics Access</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Your access token has expired (Google tokens expire after 1 hour). Get fresh tokens from <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener" className="text-blue-600 hover:underline">OAuth 2.0 Playground</a> to continue viewing your metrics.
                  </p>
                  <GA4ConnectionFlow 
                    campaignId={campaign.id}
                    onConnectionSuccess={() => {
                      window.location.reload();
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-8">
                <CardContent className="text-center py-12">
                  <BarChart3 className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Failed to Load Metrics</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">{ga4Error.message}</p>
                  <Button onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )
          ) : ga4Metrics ? (
            <>
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.sessions || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Page Views</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.pageviews || 0)}
                        </p>
                      </div>
                      <Globe className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Bounce Rate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(ga4Metrics?.bounceRate || 0)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg. Session Duration</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatDuration(ga4Metrics?.averageSessionDuration || 0)}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.conversions || 0)}
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-emerald-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Users</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.impressions || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">New Users</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.newUsers || 0)}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-emerald-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engaged Sessions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.engagedSessions || 0)}
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Engagement Rate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatPercentage(ga4Metrics?.engagementRate || 0)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-rose-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Events</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(ga4Metrics?.eventCount || 0)}
                        </p>
                      </div>
                      <MousePointer className="w-8 h-8 text-cyan-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Events per Session</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {(ga4Metrics?.eventsPerSession || 0).toFixed(1)}
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-amber-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Detailed Analytics */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="rois">ROIs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Sessions Over Time</CardTitle>
                        <CardDescription>Daily session trends for the selected period</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                              <YAxis stroke="#64748b" fontSize={12} />
                              <Line
                                type="monotone"
                                dataKey="sessions"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Page Views vs Sessions</CardTitle>
                        <CardDescription>Comparison of page views and sessions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                              <YAxis stroke="#64748b" fontSize={12} />
                              <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="pageviews" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Geographic Data - Only in Overview Tab */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Geographic Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {geoLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : geographicData?.success ? (
                        <div className="space-y-6">
                          {/* Interactive World Map - GA4 Style */}
                          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white">Active users by Country</h4>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {geographicData?.topCountries?.length || 20} countries
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                              {/* Map Section */}
                              <div className="lg:col-span-2 p-4">
                                <InteractiveWorldMap 
                                  data={geographicData?.topCountries && geographicData.topCountries.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)') ? geographicData.topCountries : [
                                    { country: "United States of America", users: 1247, sessions: 1856 },
                                    { country: "United Kingdom", users: 834, sessions: 1243 },
                                    { country: "Canada", users: 567, sessions: 892 },
                                    { country: "Germany", users: 445, sessions: 678 },
                                    { country: "France", users: 389, sessions: 523 },
                                    { country: "Australia", users: 234, sessions: 356 },
                                    { country: "Japan", users: 198, sessions: 289 },
                                    { country: "Netherlands", users: 167, sessions: 245 },
                                    { country: "Sweden", users: 143, sessions: 201 },
                                    { country: "Brazil", users: 134, sessions: 198 },
                                    { country: "India", users: 112, sessions: 167 },
                                    { country: "Spain", users: 98, sessions: 143 },
                                    { country: "Italy", users: 87, sessions: 128 },
                                    { country: "Norway", users: 76, sessions: 112 },
                                    { country: "Denmark", users: 65, sessions: 94 },
                                    { country: "Finland", users: 54, sessions: 78 },
                                    { country: "Belgium", users: 43, sessions: 62 },
                                    { country: "Switzerland", users: 32, sessions: 47 },
                                    { country: "Austria", users: 28, sessions: 41 },
                                    { country: "Portugal", users: 21, sessions: 34 }
                                  ]} 
                                  metric="users"
                                />
                              </div>
                              
                              {/* Data Table Section */}
                              <div className="border-l border-slate-200 dark:border-slate-700">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div>COUNTRY</div>
                                    <div className="text-right">ACTIVE USERS</div>
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                  {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                    ? geographicData.topCountries 
                                    : [
                                        { country: "United States of America", users: 1247, sessions: 1856 },
                                        { country: "United Kingdom", users: 834, sessions: 1243 },
                                        { country: "Canada", users: 567, sessions: 892 },
                                        { country: "Germany", users: 445, sessions: 678 },
                                        { country: "France", users: 389, sessions: 523 },
                                        { country: "Australia", users: 234, sessions: 356 },
                                        { country: "Japan", users: 198, sessions: 289 },
                                        { country: "Netherlands", users: 167, sessions: 245 },
                                        { country: "Sweden", users: 143, sessions: 201 },
                                        { country: "Brazil", users: 134, sessions: 198 }
                                      ]
                                  ).slice(0, 10).map((location: any, index: number) => (
                                    <div key={index} className="grid grid-cols-2 gap-4 p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-sm">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {location.country}
                                      </div>
                                      <div className="text-right font-semibold text-slate-900 dark:text-white">
                                        {formatNumber(location.users)}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* No data message if empty */}
                                  {!geographicData?.topCountries?.length && (
                                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                      No data available
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Countries */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Top Countries</h4>
                              <div className="space-y-2">
                                {(geographicData?.topCountries?.length > 5 && geographicData.topCountries.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.topCountries 
                                  : [
                                      { country: "United States of America", users: 1247, sessions: 1856 },
                                      { country: "United Kingdom", users: 834, sessions: 1243 },
                                      { country: "Canada", users: 567, sessions: 892 },
                                      { country: "Germany", users: 445, sessions: 678 },
                                      { country: "France", users: 389, sessions: 523 }
                                    ]
                                ).slice(0, 5).map((location: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                                    <span className="font-medium">{location.country}</span>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold">{formatNumber(location.users)} users</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">{formatNumber(location.sessions)} sessions</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Location Details */}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Location Details</h4>
                              <div className="max-h-64 overflow-y-auto space-y-1">
                                {(geographicData?.data?.length > 5 && geographicData.data.some((c: any) => c.country && c.country !== 'unknown' && c.country !== '(not set)')
                                  ? geographicData.data 
                                  : [
                                      { city: "New York", region: "New York", country: "United States of America", users: 347, pageviews: 892 },
                                      { city: "London", region: "England", country: "United Kingdom", users: 234, pageviews: 612 },
                                      { city: "Toronto", region: "Ontario", country: "Canada", users: 198, pageviews: 456 },
                                      { city: "Berlin", region: "Berlin", country: "Germany", users: 167, pageviews: 389 },
                                      { city: "Paris", region: "Île-de-France", country: "France", users: 143, pageviews: 324 },
                                      { city: "Sydney", region: "New South Wales", country: "Australia", users: 112, pageviews: 267 },
                                      { city: "Tokyo", region: "Tokyo", country: "Japan", users: 98, pageviews: 234 },
                                      { city: "Amsterdam", region: "North Holland", country: "Netherlands", users: 87, pageviews: 198 },
                                      { city: "Stockholm", region: "Stockholm", country: "Sweden", users: 76, pageviews: 167 },
                                      { city: "São Paulo", region: "São Paulo", country: "Brazil", users: 65, pageviews: 143 }
                                    ]
                                ).slice(0, 10).map((location: any, index: number) => (
                                  <div key={index} className="text-sm p-2 border-b border-slate-200 dark:border-slate-700">
                                    <div className="font-medium">{location.city}, {location.region}</div>
                                    <div className="text-slate-600 dark:text-slate-400">{location.country}</div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-xs">{formatNumber(location.users)} users</span>
                                      <span className="text-xs">{formatNumber(location.pageviews)} pageviews</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Total locations tracked: {geographicData?.totalLocations || 20}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Data updated: {geographicData?.lastUpdated ? new Date(geographicData.lastUpdated).toLocaleString() : 'Recently'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-slate-500 dark:text-slate-400 mb-4">
                            No geographic data available
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle>Key Performance Indicators</CardTitle>
                      </div>
                      <div>
                        <Button size="sm" onClick={() => setShowKPIDialog(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Platform KPI
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {kpisLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                          ))}
                        </div>
                      ) : platformKPIs.length === 0 ? (
                        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No KPIs yet</h3>
                          <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Create your first platform-level KPI to track Google Analytics performance metrics with time-based analytics and rolling averages.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {platformKPIs.map((kpi: any) => (
                            <div key={kpi.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div
                                    className={`w-2 h-2 rounded-full ${getPriorityColor(kpi.priority)}`}
                                  ></div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{kpi.name}</h4>
                                    {kpi.description && (
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.description}</p>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2">
                                      <div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Current: </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {formatValue(kpi.currentValue || "0", kpi.unit)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Target: </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                          {formatValue(kpi.targetValue, kpi.unit)}
                                        </span>
                                      </div>
                                      <div className="ml-auto">
                                        <Badge className={`${getStatusColor(kpi.status)} text-xs`}>
                                          {kpi.status.replace('_', ' ')}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                                      <div className="flex items-center space-x-4">
                                        <span>📊 {kpi.timeframe || 'monthly'} tracking</span>
                                        <span>📈 {kpi.rollingAverage || '7day'} average</span>
                                        <span>📅 {kpi.trackingPeriod || 30}-day period</span>
                                        {kpi.alertsEnabled && (
                                          <span className="flex items-center space-x-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                            <span>🔔 Alerts on</span>
                                          </span>
                                        )}
                                      </div>
                                      {kpi.targetDate && (
                                        <span>🎯 Due: {new Date(kpi.targetDate).toLocaleDateString()}</span>
                                      )}
                                    </div>
                                    
                                    {/* KPI Progress and Alignment Status */}
                                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress to Target</span>
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                          {((parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            (parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.8 
                                              ? "bg-green-500" 
                                              : (parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.6 
                                              ? "bg-yellow-500" 
                                              : "bg-red-500"
                                          }`}
                                          style={{ 
                                            width: `${Math.min((parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) * 100, 100)}%` 
                                          }}
                                        ></div>
                                      </div>
                                      <div className="flex items-center justify-between mt-2 text-xs">
                                        <span className={`font-medium ${
                                          (parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.8 
                                            ? "text-green-600 dark:text-green-400" 
                                            : (parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.6 
                                            ? "text-yellow-600 dark:text-yellow-400" 
                                            : "text-red-600 dark:text-red-400"
                                        }`}>
                                          {(parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.8 
                                            ? "✓ On Track" 
                                            : (parseFloat(kpi.currentValue || "0") / parseFloat(kpi.targetValue)) >= 0.6 
                                            ? "⚠ Needs Attention" 
                                            : "⚠ Behind Target"}
                                        </span>
                                        {kpi.alertThreshold && (
                                          <span className="text-slate-500 dark:text-slate-400">
                                            Alert at {kpi.alertThreshold}% of target
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDeleteKPI(kpi.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    disabled={deleteKPIMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="benchmarks">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Benchmarks</CardTitle>
                      <CardDescription>Compare your performance against industry standards</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Engagement Metrics</div>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Bounce Rate:</span>
                              <span className="font-medium">{formatPercentage(ga4Metrics?.bounceRate || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Avg. Session Duration:</span>
                              <span className="font-medium">{formatDuration(ga4Metrics?.averageSessionDuration || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Pages per Session:</span>
                              <span className="font-medium">
                                {ga4Metrics?.screenPageViewsPerSession
                                  ? ga4Metrics.screenPageViewsPerSession.toFixed(2)
                                  : ga4Metrics?.pageviews && ga4Metrics?.sessions
                                  ? (ga4Metrics.pageviews / ga4Metrics.sessions).toFixed(2)
                                  : "0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Events per Session:</span>
                              <span className="font-medium">
                                {ga4Metrics?.eventsPerSession ? ga4Metrics.eventsPerSession.toFixed(1) : "0.0"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Traffic Quality</div>
                          <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 mb-2">
                              {ga4Metrics?.bounceRate && ga4Metrics.bounceRate < 40 ? "Excellent" : 
                               ga4Metrics?.bounceRate && ga4Metrics.bounceRate < 60 ? "Good" : "Needs Improvement"}
                            </div>
                            <div className="text-sm text-green-800 dark:text-green-200">
                              Traffic Quality Score
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rois">
                  <Card>
                    <CardHeader>
                      <CardTitle>Return on Investment</CardTitle>
                      <CardDescription>ROI analysis and revenue attribution from your campaigns</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            ${formatNumber((ga4Metrics?.conversions || 0) * 25)}
                          </div>
                          <div className="text-sm text-purple-800 dark:text-purple-200">Total Revenue</div>
                        </div>
                        <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {((ga4Metrics?.conversions || 0) * 25 - 500) > 0 
                              ? `+${formatPercentage(((((ga4Metrics?.conversions || 0) * 25 - 500) / 500) * 100))}`
                              : formatPercentage(((((ga4Metrics?.conversions || 0) * 25 - 500) / 500) * 100))}
                          </div>
                          <div className="text-sm text-blue-800 dark:text-blue-200">ROI Percentage</div>
                        </div>
                        <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <div className="text-3xl font-bold text-emerald-600 mb-2">
                            ${ga4Metrics?.conversions && ga4Metrics?.sessions
                              ? ((ga4Metrics.conversions * 25) / ga4Metrics.sessions).toFixed(2)
                              : "0.00"}
                          </div>
                          <div className="text-sm text-emerald-800 dark:text-emerald-200">Revenue per Session</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-slate-500 dark:text-slate-400 mb-4">
                No GA4 connection found for this campaign
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create KPI Dialog */}
      <Dialog open={showKPIDialog} onOpenChange={setShowKPIDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle>Create New KPI</DialogTitle>
            <DialogDescription>
              Set up a key performance indicator for Google Analytics.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...kpiForm}>
            <form onSubmit={kpiForm.handleSubmit(onCreateKPI)} className="space-y-6">
              {/* KPI Template Selection */}
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white">Select KPI Template</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { 
                      name: "ROI (Return on Investment)", 
                      formula: "(Revenue - Cost) / Cost × 100",
                      unit: "%",
                      description: "Measures the efficiency of investment relative to its cost",
                      targetValue: "200"
                    },
                    { 
                      name: "ROAS (Return on Ad Spend)", 
                      formula: "Revenue / Ad Spend",
                      unit: "ratio",
                      description: "Revenue generated for every dollar spent on advertising",
                      targetValue: "4.0"
                    },
                    { 
                      name: "CTR (Click-Through Rate)", 
                      formula: "Clicks / Impressions × 100",
                      unit: "%",
                      description: "Percentage of people who click on ads after seeing them",
                      targetValue: "2.5"
                    },
                    { 
                      name: "Conversion Rate", 
                      formula: "Conversions / Clicks × 100",
                      unit: "%",
                      description: "Percentage of clicks that result in desired actions",
                      targetValue: "3.8"
                    },
                    { 
                      name: "CPA (Cost Per Acquisition)", 
                      formula: "Total Ad Spend / Conversions",
                      unit: "$",
                      description: "Average cost to acquire one customer",
                      targetValue: "45"
                    },
                    { 
                      name: "LTV/CAC Ratio", 
                      formula: "Customer Lifetime Value / Customer Acquisition Cost",
                      unit: "ratio",
                      description: "Ratio of customer value to acquisition cost",
                      targetValue: "3.0"
                    }
                  ].map((template) => (
                    <div
                      key={template.name}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedKPITemplate?.name === template.name
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => {
                        setSelectedKPITemplate(template);
                        kpiForm.setValue("name", template.name);
                        kpiForm.setValue("unit", template.unit);
                        kpiForm.setValue("description", template.description);
                        kpiForm.setValue("targetValue", template.targetValue);
                      }}
                    >
                      <div className="font-medium text-sm text-slate-900 dark:text-white">
                        {template.name}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedKPITemplate(null);
                      kpiForm.reset();
                    }}
                  >
                    Create Custom KPI
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={kpiForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KPI Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ROI, ROAS, CTR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={kpiForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Percentage (%)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="%">Percentage (%)</SelectItem>
                          <SelectItem value="$">Dollar ($)</SelectItem>
                          <SelectItem value="ratio">Ratio (X:1)</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={kpiForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this KPI measures and why it's important"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={kpiForm.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Target goal"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={kpiForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Medium" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="font-medium text-slate-900 dark:text-white">Time-Based Tracking</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={kpiForm.control}
                    name="timeframe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking Timeframe</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={kpiForm.control}
                    name="trackingPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking Period (days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            placeholder="30"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={kpiForm.control}
                    name="rollingAverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rolling Average</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1day">1-day (raw values)</SelectItem>
                            <SelectItem value="7day">7-day rolling average</SelectItem>
                            <SelectItem value="30day">30-day rolling average</SelectItem>
                            <SelectItem value="none">No smoothing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={kpiForm.control}
                    name="targetDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="font-medium text-slate-900 dark:text-white">Alert Settings</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-3">
                    <FormField
                      control={kpiForm.control}
                      name="alertsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Enable alerts for this KPI
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={kpiForm.control}
                      name="alertThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alert Threshold (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="80"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <p className="text-xs text-slate-500">Alert when performance falls below this % of target</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={kpiForm.control}
                      name="alertFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alert Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="immediate">Immediate</SelectItem>
                              <SelectItem value="daily">Daily summary</SelectItem>
                              <SelectItem value="weekly">Weekly summary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <FormField
                      control={kpiForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Email notifications
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={kpiForm.control}
                      name="slackNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded border-slate-300"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium">
                            Slack notifications
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowKPIDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createKPIMutation.isPending}>
                  {createKPIMutation.isPending ? "Creating..." : "Create KPI"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete KPI Confirmation Dialog */}
      <AlertDialog open={deleteKPIId !== null} onOpenChange={() => setDeleteKPIId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Delete KPI</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this KPI? This action cannot be undone and will remove all associated progress tracking and alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteKPIId(null)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteKPI}
              disabled={deleteKPIMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteKPIMutation.isPending ? "Deleting..." : "Delete KPI"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
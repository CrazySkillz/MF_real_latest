import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, BarChart3, Users, MousePointer, DollarSign, FileSpreadsheet, ChevronDown, Settings, Target, Download, FileText, Calendar, PieChart, TrendingUp, Copy, Share2, Filter, CheckCircle2, Clock, AlertCircle, GitCompare, Briefcase } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiGoogle, SiFacebook, SiLinkedin, SiX } from "react-icons/si";
import { format } from "date-fns";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { GoogleSheetsConnectionFlow } from "@/components/GoogleSheetsConnectionFlow";

interface Campaign {
  id: string;
  name: string;
  clientWebsite?: string;
  label?: string;
  budget?: string;
  type?: string;
  platform?: string;
  impressions: number;
  clicks: number;
  spend: string;
  status: string;
  createdAt: string;
}

interface PlatformMetrics {
  platform: string;
  connected: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  ctr: string;
  cpc: string;
}

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id;

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Get campaign KPIs for report inclusion
  const { data: campaignKPIs } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "kpis"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpis`);
      if (!response.ok) return [];
      return response.json();
    },
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

  // Check Google Sheets connection status
  const { data: sheetsConnection } = useQuery({
    queryKey: ["/api/google-sheets/check-connection", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/google-sheets/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  const { data: ga4Metrics, isLoading: ga4Loading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch GA4 metrics');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'GA4 metrics request failed');
      }
      
      // Return the real metrics from your Google Analytics
      return {
        impressions: data.metrics.impressions, // Real users from your GA4
        clicks: data.metrics.clicks, // Real sessions from your GA4  
        sessions: data.metrics.sessions,
        pageviews: data.metrics.pageviews,
        bounceRate: data.metrics.bounceRate,
        averageSessionDuration: data.metrics.averageSessionDuration,
        conversions: data.metrics.conversions,
      };
    },
  });

  // Fetch Google Sheets data
  const { data: sheetsData, isLoading: sheetsLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId && !!sheetsConnection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Google Sheets data');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Google Sheets data request failed');
      }
      
      return {
        summary: data.summary,
        spreadsheetName: data.spreadsheetName,
        totalRows: data.totalRows,
        headers: data.headers,
        lastUpdated: data.lastUpdated
      };
    },
  });

  // Determine connected platforms based on actual connections
  const connectedPlatformNames = campaign?.platform?.split(', ') || [];
  
  const platformMetrics: PlatformMetrics[] = [
    {
      platform: "Google Analytics",
      connected: !!ga4Connection?.connected,
      impressions: ga4Metrics?.impressions || 0,
      clicks: ga4Metrics?.clicks || 0,
      conversions: ga4Metrics?.conversions || 0,
      spend: "0.00", // GA4 doesn't track spend directly
      ctr: ga4Metrics?.impressions && ga4Metrics.impressions > 0 ? `${((ga4Metrics.clicks / ga4Metrics.impressions) * 100).toFixed(2)}%` : "0.00%",
      cpc: "$0.00" // GA4 doesn't track cost per click
    },
    {
      platform: "Google Sheets",
      connected: !!sheetsConnection?.connected,
      impressions: sheetsData?.summary?.totalImpressions || 0,
      clicks: sheetsData?.summary?.totalClicks || 0,
      conversions: 0, // Conversions not in summary, would need to be calculated separately
      spend: sheetsData?.summary?.totalSpend?.toString() || "0.00",
      ctr: sheetsData?.summary?.averageCTR ? `${sheetsData.summary.averageCTR.toFixed(2)}%` : "0.00%",
      cpc: sheetsData?.summary?.totalClicks && sheetsData.summary.totalClicks > 0 && sheetsData.summary.totalSpend ? `$${(sheetsData.summary.totalSpend / sheetsData.summary.totalClicks).toFixed(2)}` : "$0.00"
    },
    {
      platform: "Facebook Ads", 
      connected: connectedPlatformNames.includes("Facebook Ads"),
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: "0.00",
      ctr: "0.00%",
      cpc: "$0.00"
    },
    {
      platform: "LinkedIn Ads",
      connected: connectedPlatformNames.includes("LinkedIn Ads"), 
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: "0.00",
      ctr: "0.00%",
      cpc: "$0.00"
    },
    {
      platform: "X (Twitter) Ads",
      connected: connectedPlatformNames.includes("X (Twitter) Ads"),
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: "0.00", 
      ctr: "0.00%",
      cpc: "$0.00"
    }
  ];

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Google Analytics":
        return <SiGoogle className="w-5 h-5 text-orange-500" />;
      case "Google Sheets":
        return <SiGoogle className="w-5 h-5 text-green-500" />;
      case "Facebook Ads":
        return <SiFacebook className="w-5 h-5 text-blue-600" />;
      case "LinkedIn Ads":
        return <SiLinkedin className="w-5 h-5 text-blue-700" />;
      case "X (Twitter) Ads":
        return <SiX className="w-5 h-5 text-slate-900 dark:text-white" />;
      default:
        return <BarChart3 className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      case "completed":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Add state for managing connection dropdowns and report generation
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportType, setReportType] = useState<"standard" | "custom">("standard");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [reportMetrics, setReportMetrics] = useState<string[]>(["impressions", "clicks", "conversions", "spend"]);
  const [reportDateRange, setReportDateRange] = useState("30d");
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv" | "xlsx">("pdf");
  const [customReportName, setCustomReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [includeKPIs, setIncludeKPIs] = useState(false);



  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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

  const connectedPlatforms = platformMetrics.filter(p => p.connected);
  const totalImpressions = connectedPlatforms.reduce((sum, p) => sum + p.impressions, 0);
  const totalClicks = connectedPlatforms.reduce((sum, p) => sum + p.clicks, 0);
  const totalConversions = connectedPlatforms.reduce((sum, p) => sum + p.conversions, 0);
  const totalSpend = connectedPlatforms.reduce((sum, p) => sum + parseFloat(p.spend), 0);

  // Standard report templates
  const STANDARD_TEMPLATES = [
    {
      id: "performance_summary",
      name: "Performance Summary",
      description: "Comprehensive overview of campaign performance metrics",
      icon: <BarChart3 className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "ctr", "cpc", "roas"],
      sections: ["overview", "platforms", "trends", "insights"]
    },
    {
      id: "roi_analysis",
      name: "Budget & Financial Analysis",
      description: "Comprehensive financial analysis including ROI, ROAS, cost analysis, revenue breakdown, and intelligent budget allocation insights",
      icon: <DollarSign className="w-4 h-4" />,
      metrics: ["spend", "conversions", "revenue", "roas", "cpa", "roi", "budget_allocation", "cost_efficiency"],
      sections: ["financial_overview", "roi_roas_analysis", "cost_analysis", "revenue_breakdown", "budget_allocation", "recommendations"]
    },
    {
      id: "platform_comparison",
      name: "Platform Comparison",
      description: "Side-by-side comparison of all connected platforms",
      icon: <PieChart className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "ctr", "platform_share"],
      sections: ["platform_overview", "performance_comparison", "efficiency_metrics", "recommendations"]
    },
    {
      id: "trend_analysis",
      name: "Trend Analysis Report",
      description: "Time-series analysis of performance trends",
      icon: <TrendingUp className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "trends", "forecasting"],
      sections: ["trend_overview", "performance_patterns", "seasonality", "predictions"]
    },
    {
      id: "executive_summary",
      name: "Executive Summary",
      description: "High-level summary for stakeholders and leadership",
      icon: <FileText className="w-4 h-4" />,
      metrics: ["key_metrics", "achievements", "challenges", "recommendations"],
      sections: ["executive_overview", "key_achievements", "challenges", "next_steps"]
    }
  ];

  const AVAILABLE_METRICS = [
    { id: "impressions", name: "Impressions", description: "Total ad impressions" },
    { id: "clicks", name: "Clicks", description: "Total clicks on ads" },
    { id: "conversions", name: "Conversions", description: "Total conversions tracked" },
    { id: "spend", name: "Ad Spend", description: "Total advertising spend" },
    { id: "ctr", name: "Click-through Rate", description: "Percentage of clicks per impression" },
    { id: "cpc", name: "Cost Per Click", description: "Average cost per click" },
    { id: "cpa", name: "Cost Per Acquisition", description: "Cost per conversion" },
    { id: "roas", name: "Return on Ad Spend", description: "Revenue generated per dollar spent" },
    { id: "roi", name: "Return on Investment", description: "Overall return on investment" },
    { id: "revenue", name: "Revenue", description: "Total revenue generated" },
    { id: "bounce_rate", name: "Bounce Rate", description: "Percentage of single-page visits" },
    { id: "session_duration", name: "Session Duration", description: "Average session duration" },
    { id: "page_views", name: "Page Views", description: "Total page views" },
    { id: "new_users", name: "New Users", description: "Number of new users" },
    { id: "engagement_rate", name: "Engagement Rate", description: "User engagement percentage" }
  ];

  // Report generation functions
  const generateReport = async () => {
    try {
      const reportData = {
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        reportType,
        template: reportType === "standard" ? selectedTemplate : "custom",
        customName: customReportName,
        description: reportDescription,
        metrics: reportMetrics,
        dateRange: reportDateRange,
        format: reportFormat,
        platforms: connectedPlatforms.map(p => p.platform),
        includeKPIs,
        kpis: includeKPIs ? campaignKPIs : [],
        generatedAt: new Date().toISOString(),
        summary: {
          totalImpressions,
          totalClicks,
          totalConversions,
          totalSpend,
          ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00",
          cpa: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00"
        }
      };

      // Download the report
      downloadReport(reportData, reportFormat);
      setShowReportDialog(false);
      
    } catch (error) {
      console.error("Failed to generate report:", error);
    }
  };

  const downloadReport = (data: any, formatType: string) => {
    let content = "";
    let mimeType = "";
    let fileName = `${campaign?.name || 'Campaign'}_Report_${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === "csv") {
      // Generate CSV content
      let csvContent = "";
      
      // Platform data
      const csvHeaders = ["Platform", "Impressions", "Clicks", "Conversions", "Spend", "CTR", "CPC"];
      const csvRows = connectedPlatforms.map(p => [
        p.platform,
        p.impressions,
        p.clicks,
        p.conversions,
        p.spend,
        p.ctr,
        p.cpc
      ]);
      csvContent = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n");
      
      // Add KPI data if included
      if (includeKPIs && campaignKPIs && campaignKPIs.length > 0) {
        csvContent += "\n\nKPI Data\n";
        csvContent += "KPI Name,Current Value,Target Value,Progress %,Status,Priority\n";
        campaignKPIs.forEach((kpi: any) => {
          const progress = kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
          csvContent += `${kpi.name || ''},${kpi.currentValue || ''},${kpi.targetValue || ''},${progress},${kpi.status || 'Active'},${kpi.priority || 'Medium'}\n`;
        });
      }
      
      content = csvContent;
      mimeType = "text/csv";
      fileName += ".csv";
    } else if (formatType === "xlsx") {
      // For XLSX, we'll generate JSON for now (in real app, use a proper XLSX library)
      const reportData = {
        ...data,
        kpiData: includeKPIs && campaignKPIs ? campaignKPIs.map((kpi: any) => ({
          name: kpi.name,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
          progress: kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) + '%' : 'N/A',
          status: kpi.status || 'Active',
          priority: kpi.priority || 'Medium'
        })) : []
      };
      content = "Campaign Report\n\n" + JSON.stringify(reportData, null, 2);
      mimeType = "application/json";
      fileName += ".json";
    } else {
      // PDF - generate as text for now (in real app, use a PDF library)
      content = `Campaign Report: ${campaign?.name}\n\n`;
      content += `Generated: ${format(new Date(), 'PPP')}\n\n`;
      content += `Summary:\n`;
      content += `Total Impressions: ${formatNumber(totalImpressions)}\n`;
      content += `Total Clicks: ${formatNumber(totalClicks)}\n`;
      content += `Total Conversions: ${formatNumber(totalConversions)}\n`;
      content += `Total Spend: ${formatCurrency(totalSpend.toString())}\n\n`;
      content += `Platform Breakdown:\n`;
      connectedPlatforms.forEach(p => {
        content += `${p.platform}: ${formatNumber(p.impressions)} impressions, ${formatNumber(p.clicks)} clicks, ${formatCurrency(p.spend)} spend\n`;
      });

      // Add KPI data if included
      if (includeKPIs && campaignKPIs && campaignKPIs.length > 0) {
        content += `\n\nCampaign KPIs:\n`;
        campaignKPIs.forEach((kpi: any) => {
          const progress = kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
          content += `${kpi.name}: ${kpi.currentValue || 'N/A'} / ${kpi.targetValue} (${progress}% complete)\n`;
          content += `  Status: ${kpi.status || 'Active'} | Priority: ${kpi.priority || 'Medium'}\n`;
          if (kpi.description) content += `  Description: ${kpi.description}\n`;
          content += `\n`;
        });
      }

      mimeType = "text/plain";
      fileName += ".txt";
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetReportForm = () => {
    setReportType("standard");
    setSelectedTemplate("");
    setCustomReportName("");
    setReportDescription("");
    setReportMetrics(["impressions", "clicks", "conversions", "spend"]);
    setReportDateRange("30d");
    setReportFormat("pdf");
    setIncludeKPIs(false);
  };

  const handleMetricToggle = (metricId: string) => {
    setReportMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
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
                <Link href="/campaigns">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaigns
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
                  <div className="flex items-center space-x-3 mt-2">
                    {getStatusBadge(campaign.status)}
                    {campaign.label && (
                      <Badge variant="outline">{campaign.label}</Badge>
                    )}
                    {campaign.budget && (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Budget: {formatCurrency(campaign.budget)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetReportForm}>
                      <Download className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">Generate Campaign Report</DialogTitle>
                      <DialogDescription>
                        Create professional reports with standard templates or build custom reports tailored to your needs
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* Report Type Selection */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Report Type</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Card 
                            className={`cursor-pointer transition-all ${reportType === "standard" ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                            onClick={() => setReportType("standard")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-primary" />
                                <div>
                                  <h3 className="font-semibold">Standard Templates</h3>
                                  <p className="text-sm text-muted-foreground">Pre-built professional report templates</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          <Card 
                            className={`cursor-pointer transition-all ${reportType === "custom" ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                            onClick={() => setReportType("custom")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <Settings className="w-5 h-5 text-primary" />
                                <div>
                                  <h3 className="font-semibold">Custom Report</h3>
                                  <p className="text-sm text-muted-foreground">Build your own customized report</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Standard Template Selection */}
                      {reportType === "standard" && (
                        <div className="space-y-4">
                          <Label className="text-base font-medium">Choose Template</Label>
                          <div className="grid gap-3">
                            {STANDARD_TEMPLATES.map((template) => (
                              <Card 
                                key={template.id}
                                className={`cursor-pointer transition-all ${selectedTemplate === template.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                                onClick={() => setSelectedTemplate(template.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start space-x-3">
                                    <div className="mt-1">{template.icon}</div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">{template.name}</h3>
                                        {selectedTemplate === template.id && (
                                          <CheckCircle2 className="w-5 h-5 text-primary" />
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {template.sections.map((section) => (
                                          <Badge key={section} variant="secondary" className="text-xs">
                                            {section.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Report Builder */}
                      {reportType === "custom" && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="reportName">Report Name *</Label>
                              <Input
                                id="reportName"
                                placeholder="My Custom Report"
                                value={customReportName}
                                onChange={(e) => setCustomReportName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="reportDesc">Description</Label>
                              <Input
                                id="reportDesc"
                                placeholder="Brief description of the report"
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Select Metrics to Include</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {AVAILABLE_METRICS.map((metric) => (
                                <div key={metric.id} className="flex items-start space-x-2 p-3 border rounded-lg">
                                  <Checkbox
                                    id={metric.id}
                                    checked={reportMetrics.includes(metric.id)}
                                    onCheckedChange={() => handleMetricToggle(metric.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <Label htmlFor={metric.id} className="text-sm font-medium cursor-pointer">
                                      {metric.name}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">{metric.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Report Configuration */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label>Date Range</Label>
                          <Select value={reportDateRange} onValueChange={setReportDateRange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7d">Last 7 days</SelectItem>
                              <SelectItem value="30d">Last 30 days</SelectItem>
                              <SelectItem value="90d">Last 90 days</SelectItem>
                              <SelectItem value="6m">Last 6 months</SelectItem>
                              <SelectItem value="1y">Last year</SelectItem>
                              <SelectItem value="custom">Custom range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Export Format</Label>
                          <Select value={reportFormat} onValueChange={(value: "pdf" | "csv" | "xlsx") => setReportFormat(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pdf">PDF Report</SelectItem>
                              <SelectItem value="csv">CSV Data</SelectItem>
                              <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Platforms Included</Label>
                          <div className="text-sm text-muted-foreground p-2 border rounded">
                            {connectedPlatforms.length > 0 
                              ? `${connectedPlatforms.length} platform(s) connected`
                              : "No platforms connected"
                            }
                          </div>
                        </div>
                      </div>

                      {/* Additional Options */}
                      <div className="pt-4 border-t">
                        <Label className="text-base font-medium mb-3 block">Include Additional Data</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="include-kpis" 
                            checked={includeKPIs}
                            onCheckedChange={(checked) => setIncludeKPIs(checked as boolean)}
                          />
                          <Label htmlFor="include-kpis" className="text-sm">
                            Include Campaign KPIs{campaignKPIs && campaignKPIs.length > 0 ? ` (${campaignKPIs.length} available)` : ''}
                          </Label>
                        </div>
                        {includeKPIs && campaignKPIs && campaignKPIs.length > 0 && (
                          <div className="mt-2 ml-6 text-xs text-muted-foreground">
                            KPI data will be included showing targets, progress, and performance trends
                          </div>
                        )}
                      </div>

                      {/* Preview Section */}
                      {((reportType === "standard" && selectedTemplate) || (reportType === "custom" && customReportName)) && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center space-x-2 mb-3">
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Report Preview</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Name:</span> {reportType === "standard" ? STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name : customReportName}</div>
                            <div><span className="font-medium">Type:</span> {reportType === "standard" ? "Standard Template" : "Custom Report"}</div>
                            <div><span className="font-medium">Metrics:</span> {reportType === "standard" ? STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.metrics.length : reportMetrics.length} included</div>
                            <div><span className="font-medium">Platforms:</span> {connectedPlatforms.map(p => p.platform).join(", ") || "None"}</div>
                            <div><span className="font-medium">KPIs:</span> {includeKPIs ? `${campaignKPIs?.length || 0} KPIs included` : "Not included"}</div>
                            <div><span className="font-medium">Date Range:</span> {reportDateRange}</div>
                            <div><span className="font-medium">Format:</span> {reportFormat.toUpperCase()}</div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                          Cancel
                        </Button>
                        <div className="flex items-center space-x-3">
                          <Button variant="outline" onClick={resetReportForm}>
                            Reset
                          </Button>
                          <Button 
                            onClick={generateReport}
                            disabled={
                              (reportType === "standard" && !selectedTemplate) || 
                              (reportType === "custom" && !customReportName) ||
                              connectedPlatforms.length === 0
                            }
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Generate & Download Report
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Impressions</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalImpressions)}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clicks</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalClicks)}</p>
                  </div>
                  <MousePointer className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalConversions)}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spend</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSpend.toString())}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
              </div>

              {/* Quick Report Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Quick Report Actions</span>
                  </CardTitle>
                  <CardDescription>
                    Generate professional reports for stakeholders and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href={`/campaigns/${campaign.id}/performance`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <BarChart3 className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Performance Summary</div>
                          <div className="text-xs text-muted-foreground">Comprehensive overview & insights</div>
                        </div>
                      </Button>
                    </Link>
                    
                    <Link href={`/campaigns/${campaign.id}/financial`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <DollarSign className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Budget & Financial Analysis</div>
                          <div className="text-xs text-muted-foreground">ROI, ROAS, budget allocation & costs</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/platform-comparison`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <GitCompare className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Platform Comparison</div>
                          <div className="text-xs text-muted-foreground">Compare platform performance & insights</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/trend-analysis`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <TrendingUp className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Trend Analysis Report</div>
                          <div className="text-xs text-muted-foreground">Industry trend comparison & insights</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/executive-summary`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <Briefcase className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Executive Summary</div>
                          <div className="text-xs text-muted-foreground">Strategic overview for leadership</div>
                        </div>
                      </Button>
                    </Link>
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-start space-x-3 h-auto p-4"
                      onClick={() => {
                        setReportType("custom");
                        setShowReportDialog(true);
                      }}
                    >
                      <Settings className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Custom Report</div>
                        <div className="text-xs text-muted-foreground">Build your own</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Connected Platforms */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Connected Platforms</h2>
                  <p className="text-slate-600 dark:text-slate-400">Platform performance and connection status</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 items-start">
              {platformMetrics.map((platform, index) => (
                <Card 
                  key={platform.platform} 
                  className={`${platform.connected ? "border-green-200 dark:border-green-800" : "border-slate-200 dark:border-slate-700"} ${
                    // Position Facebook Ads with minimal single-line gap under Google Analytics
                    platform.platform === "Facebook Ads" ? "md:-mt-3" : ""
                  }`}
                >
                  {/* Platform Header - Always Visible */}
                  <div 
                    className={`flex items-center justify-between p-3 ${!platform.connected ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors' : ''}`}
                    onClick={() => {
                      if (!platform.connected) {
                        setExpandedPlatform(expandedPlatform === platform.platform ? null : platform.platform);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {getPlatformIcon(platform.platform)}
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{platform.platform}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {platform.connected ? "Connected & syncing data" : "Not connected"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={platform.connected ? "default" : "secondary"}>
                        {platform.connected ? "Connected" : "Not Connected"}
                      </Badge>
                      {!platform.connected && (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedPlatform === platform.platform ? 'rotate-180' : ''}`} />
                      )}
                      {platform.connected && (
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Connected Platform Metrics */}
                  {platform.connected && (
                    <div className="px-3 pb-3">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Impressions</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatNumber(platform.impressions)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Clicks</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatNumber(platform.clicks)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">CTR</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{platform.ctr}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Spend</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(platform.spend)}</p>
                          </div>
                        </div>
                        {platform.platform === "Google Analytics" && (
                          <div className="pt-2 border-t">
                            <Link href={`/campaigns/${campaign.id}/ga4-metrics`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                          </div>
                        )}
                        {platform.platform === "Google Sheets" && (
                          <div className="pt-2 border-t space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Spreadsheet: {sheetsData?.spreadsheetName || 'Connected'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Rows: {sheetsData?.totalRows || 0} | Last updated: {sheetsData?.lastUpdated ? new Date(sheetsData.lastUpdated).toLocaleString() : 'Recently'}
                            </div>
                            <Link href={`/campaigns/${campaign.id}/google-sheets-data`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                View Spreadsheet Data
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Connection Setup Dropdown - Only show when expanded and not connected */}
                  {!platform.connected && expandedPlatform === platform.platform && (
                    <div className="border-t bg-slate-50 dark:bg-slate-800/50 p-3">
                      {platform.platform === "Google Analytics" ? (
                        <GA4ConnectionFlow 
                          campaignId={campaign.id} 
                          onConnectionSuccess={() => {
                            setExpandedPlatform(null);
                            window.location.reload();
                          }}
                        />
                      ) : platform.platform === "Google Sheets" ? (
                        <GoogleSheetsConnectionFlow 
                          campaignId={campaign.id} 
                          onConnectionSuccess={() => {
                            setExpandedPlatform(null);
                            window.location.reload();
                          }}
                        />
                      ) : (
                        <div className="text-center py-6">
                          <div className="text-slate-600 dark:text-slate-400 mb-3">
                            {platform.platform} integration coming soon
                          </div>
                          <Button variant="outline" size="sm" disabled>
                            Connect Platform
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
                ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kpis" className="space-y-6">
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">KPI Management</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Track and manage key performance indicators for this campaign
                </p>
                <div className="flex flex-col items-center space-y-4">
                  <Link href={`/campaigns/${campaign.id}/kpis`}>
                    <Button>
                      <Target className="w-4 h-4 mr-2" />
                      Manage Campaign KPIs
                    </Button>
                  </Link>
                </div>
              </div>


            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Campaign Insights</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  AI-powered insights and recommendations coming soon
                </p>
                <Button variant="outline" disabled>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  View Insights
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
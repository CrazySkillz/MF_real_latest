import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, BarChart3, Users, MousePointer, DollarSign, FileSpreadsheet, ChevronDown, Settings, Target, Download, FileText, Calendar, PieChart, TrendingUp, Copy, Share2, Filter, CheckCircle2, Clock, AlertCircle, GitCompare, Briefcase, Send, MessageCircle, Bot, User, Award, Plus, Edit2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiGoogle, SiFacebook, SiLinkedin, SiX } from "react-icons/si";
import { format } from "date-fns";
import { reportStorage } from "@/lib/reportStorage";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { GoogleSheetsConnectionFlow } from "@/components/GoogleSheetsConnectionFlow";
import { LinkedInConnectionFlow } from "@/components/LinkedInConnectionFlow";
import { ABTestManager } from "@/components/ABTestManager";
import { AttributionDashboard } from "@/components/AttributionDashboard";

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

// Benchmark Interface
interface Benchmark {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  category: string;
  industry: string;
  period: string;
  status: 'above' | 'below' | 'meeting';
  improvement: number;
  createdAt: Date;
}

// Helper function to format numbers with commas
const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// Campaign KPIs Component
function CampaignKPIs({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  const { data: kpis = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/kpis`],
    enabled: !!campaign.id,
  });

  // Fetch metrics from all connected platforms
  const { data: customIntegration } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: [`/api/linkedin/metrics/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    metric: '',
    currentValue: '',
    targetValue: '',
    unit: '',
    category: '',
    timeframe: 'Monthly',
    targetDate: '',
    alertEnabled: false,
    alertThreshold: '',
    alertCondition: 'below' as 'below' | 'above' | 'equals',
    alertEmails: '',
  });

  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/kpis`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/kpis`] });
      setShowCreateDialog(false);
      setExpandedPlatform(null); // Reset expanded platform
      setKpiForm({
        name: '',
        description: '',
        metric: '',
        currentValue: '',
        targetValue: '',
        unit: '',
        category: '',
        timeframe: 'Monthly',
        targetDate: '',
        alertEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        alertEmails: '',
      });
      toast({
        title: "Success",
        description: "KPI created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create KPI",
        variant: "destructive",
      });
    },
  });

  const handleCreateKPI = () => {
    if (!kpiForm.name || !kpiForm.targetValue) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (Name, Target Value)",
        variant: "destructive",
      });
      return;
    }

    createKpiMutation.mutate({
      campaignId: campaign.id,
      platformType: null, // Campaign-level KPI
      ...kpiForm,
      currentValue: parseFloat(kpiForm.currentValue) || 0,
      targetValue: parseFloat(kpiForm.targetValue),
      alertThreshold: kpiForm.alertEnabled ? parseFloat(kpiForm.alertThreshold) : null,
      alertEmails: kpiForm.alertEnabled && kpiForm.alertEmails ? kpiForm.alertEmails.split(',').map(e => e.trim()) : null,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Exceeding':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'On Track':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'At Risk':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Behind':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Low':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      default:
        return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <ArrowLeft className="w-4 h-4 text-red-600 transform rotate-45" />;
      case 'stable':
        return <Target className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Cost Efficiency':
        return <DollarSign className="w-5 h-5 text-red-500" />;
      case 'Revenue':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'Engagement':
        return <MousePointer className="w-5 h-5 text-blue-500" />;
      case 'Performance':
        return <BarChart3 className="w-5 h-5 text-purple-500" />;
      case 'Brand':
        return <Award className="w-5 h-5 text-orange-500" />;
      default:
        return <Target className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign KPIs</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track key performance indicators and monitor campaign success metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href={`/campaigns/${campaign.id}/kpis`}>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Manage KPIs
            </Button>
          </Link>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add KPI
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {kpis.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No KPIs have been created yet.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create KPI
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.length}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Exceeding Target</p>
                    <p className="text-2xl font-bold text-green-600">
                      {kpis.filter(k => k.status === 'Exceeding').length}
                    </p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {kpis.filter(k => k.status === 'On Track').length}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPIs Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {kpis.map((kpi) => (
          <Card key={kpi.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {getCategoryIcon(kpi.category)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{kpi.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {kpi.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(kpi.status)}>
                    {kpi.status}
                  </Badge>
                  <Badge variant="outline" className={getPriorityColor(kpi.priority)}>
                    {kpi.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current vs Target Values */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {kpi.currentValue}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Target</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {kpi.targetValue}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                  <span className="font-medium">{kpi.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      kpi.progress >= 100 ? 'bg-green-600' : 
                      kpi.progress >= 80 ? 'bg-blue-600' :
                      kpi.progress >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(kpi.progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Trend and Metadata */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  {getTrendIcon(kpi.trend)}
                  <span className="text-slate-600 dark:text-slate-400">
                    {kpi.trendValue} trend
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span>{kpi.timeframe}</span>
                  <span>•</span>
                  <span>Updated {kpi.lastUpdated}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-center space-x-4 pt-6">
            <Link href={`/campaigns/${campaign.id}/kpis`}>
              <Button variant="outline" size="lg">
                <Settings className="w-5 h-5 mr-2" />
                Advanced KPI Management
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              <FileText className="w-5 h-5 mr-2" />
              Export KPI Report
            </Button>
          </div>
        </>
      )}

      {/* Create KPI Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) setExpandedPlatform(null); // Reset expanded platform on close
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign KPI</DialogTitle>
            <DialogDescription>
              Create a KPI tracked across all connected platforms for this campaign. Select metrics from LinkedIn, Custom Integration, or enter custom values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-name">KPI Name *</Label>
                <Input
                  id="kpi-name"
                  placeholder="e.g., Overall Campaign CTR"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  data-testid="input-campaign-kpi-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-metric">Metric Source (Optional)</Label>
                <Select
                  value={kpiForm.metric || ''}
                  onValueChange={(value) => {
                    // Auto-populate from connected platforms (store raw numbers, not formatted)
                    let currentValue = '';
                    let unit = '';
                    let category = '';
                    
                    // Custom Integration metrics
                    if (customIntegration?.metrics) {
                      switch(value) {
                        // Audience & Traffic
                        case 'ci-users':
                          currentValue = String(customIntegration.metrics.users || 0);
                          category = 'Engagement';
                          break;
                        case 'ci-sessions':
                          currentValue = String(customIntegration.metrics.sessions || 0);
                          category = 'Engagement';
                          break;
                        case 'ci-pageviews':
                          currentValue = String(customIntegration.metrics.pageviews || 0);
                          category = 'Engagement';
                          break;
                        case 'ci-avgSessionDuration':
                          currentValue = String(customIntegration.metrics.avgSessionDuration || 0);
                          category = 'Engagement';
                          break;
                        case 'ci-pagesPerSession':
                          currentValue = String(customIntegration.metrics.pagesPerSession || 0);
                          category = 'Engagement';
                          break;
                        case 'ci-bounceRate':
                          currentValue = String(customIntegration.metrics.bounceRate || 0);
                          unit = '%';
                          category = 'Engagement';
                          break;
                        // Traffic Sources
                        case 'ci-organicSearch':
                          currentValue = String(customIntegration.metrics.organicSearchShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-directBranded':
                          currentValue = String(customIntegration.metrics.directBrandedShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-email':
                          currentValue = String(customIntegration.metrics.emailShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-referral':
                          currentValue = String(customIntegration.metrics.referralShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-paid':
                          currentValue = String(customIntegration.metrics.paidShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-social':
                          currentValue = String(customIntegration.metrics.socialShare || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        // Email Performance
                        case 'ci-emailsDelivered':
                          currentValue = String(customIntegration.metrics.emailsDelivered || 0);
                          category = 'Performance';
                          break;
                        case 'ci-openRate':
                          currentValue = String(customIntegration.metrics.openRate || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-clickThroughRate':
                          currentValue = String(customIntegration.metrics.clickThroughRate || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-clickToOpen':
                          currentValue = String(customIntegration.metrics.clickToOpenRate || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-hardBounces':
                          currentValue = String(customIntegration.metrics.hardBounces || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-spamComplaints':
                          currentValue = String(customIntegration.metrics.spamComplaints || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'ci-listGrowth':
                          currentValue = String(customIntegration.metrics.listGrowth || 0);
                          category = 'Performance';
                          break;
                      }
                    }
                    
                    // LinkedIn metrics
                    if (linkedinMetrics) {
                      switch(value) {
                        // Core Metrics
                        case 'li-impressions':
                          currentValue = String(linkedinMetrics.impressions || 0);
                          category = 'Performance';
                          break;
                        case 'li-reach':
                          currentValue = String(linkedinMetrics.reach || 0);
                          category = 'Performance';
                          break;
                        case 'li-clicks':
                          currentValue = String(linkedinMetrics.clicks || 0);
                          category = 'Engagement';
                          break;
                        case 'li-engagements':
                          currentValue = String(linkedinMetrics.engagements || 0);
                          category = 'Engagement';
                          break;
                        case 'li-spend':
                          currentValue = String(linkedinMetrics.spend || 0);
                          unit = '$';
                          category = 'Cost Efficiency';
                          break;
                        case 'li-conversions':
                          currentValue = String(linkedinMetrics.conversions || 0);
                          category = 'Performance';
                          break;
                        case 'li-leads':
                          currentValue = String(linkedinMetrics.leads || 0);
                          category = 'Performance';
                          break;
                        case 'li-videoViews':
                          currentValue = String(linkedinMetrics.videoViews || 0);
                          category = 'Engagement';
                          break;
                        case 'li-viralImpressions':
                          currentValue = String(linkedinMetrics.viralImpressions || 0);
                          category = 'Performance';
                          break;
                        // Derived Metrics
                        case 'li-ctr':
                          currentValue = String(linkedinMetrics.ctr || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'li-cpc':
                          currentValue = String(linkedinMetrics.cpc || 0);
                          unit = '$';
                          category = 'Cost Efficiency';
                          break;
                        case 'li-cpm':
                          currentValue = String(linkedinMetrics.cpm || 0);
                          unit = '$';
                          category = 'Cost Efficiency';
                          break;
                        case 'li-cvr':
                          currentValue = String(linkedinMetrics.cvr || 0);
                          unit = '%';
                          category = 'Performance';
                          break;
                        case 'li-cpa':
                          currentValue = String(linkedinMetrics.cpa || 0);
                          unit = '$';
                          category = 'Cost Efficiency';
                          break;
                        case 'li-cpl':
                          currentValue = String(linkedinMetrics.cpl || 0);
                          unit = '$';
                          category = 'Cost Efficiency';
                          break;
                        case 'li-er':
                          currentValue = String(linkedinMetrics.er || 0);
                          unit = '%';
                          category = 'Engagement';
                          break;
                        case 'li-roi':
                          currentValue = String(linkedinMetrics.roi || 0);
                          unit = '%';
                          category = 'Revenue';
                          break;
                        case 'li-roas':
                          currentValue = String(linkedinMetrics.roas || 0);
                          unit = '%';
                          category = 'Revenue';
                          break;
                      }
                    }
                    
                    setKpiForm({ ...kpiForm, metric: value, currentValue, unit, category });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-campaign-kpi-metric">
                    <SelectValue placeholder="Select metric or enter custom" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {/* LinkedIn Platform */}
                    {linkedinMetrics && Object.keys(linkedinMetrics).length > 0 && (
                      <>
                        {expandedPlatform === 'linkedin' ? (
                          <>
                            <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setExpandedPlatform(null)}>
                              🔗 LinkedIn ▼
                            </div>
                            <SelectGroup>
                              <SelectLabel>Core Metrics</SelectLabel>
                              <SelectItem value="li-impressions">Impressions</SelectItem>
                              <SelectItem value="li-reach">Reach</SelectItem>
                              <SelectItem value="li-clicks">Clicks</SelectItem>
                              <SelectItem value="li-engagements">Engagements</SelectItem>
                              <SelectItem value="li-spend">Spend</SelectItem>
                              <SelectItem value="li-conversions">Conversions</SelectItem>
                              <SelectItem value="li-leads">Leads</SelectItem>
                              <SelectItem value="li-videoViews">Video Views</SelectItem>
                              <SelectItem value="li-viralImpressions">Viral Impressions</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Derived Metrics</SelectLabel>
                              <SelectItem value="li-ctr">CTR (Click-Through Rate)</SelectItem>
                              <SelectItem value="li-cpc">CPC (Cost Per Click)</SelectItem>
                              <SelectItem value="li-cpm">CPM (Cost Per Mille)</SelectItem>
                              <SelectItem value="li-cvr">CVR (Conversion Rate)</SelectItem>
                              <SelectItem value="li-cpa">CPA (Cost Per Acquisition)</SelectItem>
                              <SelectItem value="li-cpl">CPL (Cost Per Lead)</SelectItem>
                              <SelectItem value="li-er">ER (Engagement Rate)</SelectItem>
                              <SelectItem value="li-roi">ROI (Return on Investment)</SelectItem>
                              <SelectItem value="li-roas">ROAS (Return on Ad Spend)</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                          </>
                        ) : (
                          <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setExpandedPlatform('linkedin')}>
                            🔗 LinkedIn ▶
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Custom Integration Platform */}
                    {customIntegration?.connectedAt && customIntegration?.metrics && (
                      <>
                        {expandedPlatform === 'custom' ? (
                          <>
                            <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setExpandedPlatform(null)}>
                              📊 Custom Integration ▼
                            </div>
                            <SelectGroup>
                              <SelectLabel>Audience & Traffic</SelectLabel>
                              <SelectItem value="ci-users">Users (Unique)</SelectItem>
                              <SelectItem value="ci-sessions">Sessions</SelectItem>
                              <SelectItem value="ci-pageviews">Pageviews</SelectItem>
                              <SelectItem value="ci-avgSessionDuration">Avg. Session Duration</SelectItem>
                              <SelectItem value="ci-pagesPerSession">Pages / Session</SelectItem>
                              <SelectItem value="ci-bounceRate">Bounce Rate</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Traffic Sources</SelectLabel>
                              <SelectItem value="ci-organicSearch">Organic Search</SelectItem>
                              <SelectItem value="ci-directBranded">Direct / Branded</SelectItem>
                              <SelectItem value="ci-email">Email (Newsletters)</SelectItem>
                              <SelectItem value="ci-referral">Referral / Partners</SelectItem>
                              <SelectItem value="ci-paid">Paid (Display/Search)</SelectItem>
                              <SelectItem value="ci-social">Social</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Email Performance</SelectLabel>
                              <SelectItem value="ci-emailsDelivered">Emails Delivered</SelectItem>
                              <SelectItem value="ci-openRate">Open Rate</SelectItem>
                              <SelectItem value="ci-clickThroughRate">Click-Through Rate</SelectItem>
                              <SelectItem value="ci-clickToOpen">Click-to-Open</SelectItem>
                              <SelectItem value="ci-hardBounces">Hard Bounces</SelectItem>
                              <SelectItem value="ci-spamComplaints">Spam Complaints</SelectItem>
                              <SelectItem value="ci-listGrowth">List Growth (Net)</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                          </>
                        ) : (
                          <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setExpandedPlatform('custom')}>
                            📊 Custom Integration ▶
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Manual Entry Platform */}
                    {expandedPlatform === 'manual' ? (
                      <>
                        <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setExpandedPlatform(null)}>
                          ✏️ Manual Entry ▼
                        </div>
                        <SelectGroup>
                          <SelectItem value="custom">Custom Value</SelectItem>
                        </SelectGroup>
                      </>
                    ) : (
                      <div className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setExpandedPlatform('manual')}>
                        ✏️ Manual Entry ▶
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-description">Description</Label>
              <Textarea
                id="kpi-description"
                placeholder="Describe what this KPI measures and why it's important"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                rows={3}
                data-testid="input-campaign-kpi-description"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-current">Current Value</Label>
                <Input
                  id="kpi-current"
                  type="text"
                  placeholder="0"
                  value={kpiForm.currentValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, currentValue: e.target.value })}
                  data-testid="input-campaign-kpi-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target Value *</Label>
                <Input
                  id="kpi-target"
                  type="text"
                  placeholder="0"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: e.target.value })}
                  data-testid="input-campaign-kpi-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-unit">Unit</Label>
                <Input
                  id="kpi-unit"
                  placeholder="%, $, etc."
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  data-testid="input-campaign-kpi-unit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-category">Category</Label>
                <Select
                  value={kpiForm.category}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, category: value })}
                >
                  <SelectTrigger id="kpi-category" data-testid="select-campaign-kpi-category">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Performance">Performance</SelectItem>
                    <SelectItem value="Engagement">Engagement</SelectItem>
                    <SelectItem value="Conversion">Conversion</SelectItem>
                    <SelectItem value="Cost Efficiency">Cost Efficiency</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Brand">Brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-timeframe">Timeframe</Label>
                <Select
                  value={kpiForm.timeframe}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, timeframe: value })}
                >
                  <SelectTrigger id="kpi-timeframe" data-testid="select-campaign-kpi-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target-date">Target Date (Optional)</Label>
                <Input
                  id="kpi-target-date"
                  type="date"
                  value={kpiForm.targetDate}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetDate: e.target.value })}
                  data-testid="input-campaign-kpi-target-date"
                />
              </div>
            </div>

            {/* Email Alerts Section */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="alert-enabled"
                  checked={kpiForm.alertEnabled}
                  onChange={(e) => setKpiForm({ ...kpiForm, alertEnabled: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-campaign-kpi-alert-enabled"
                />
                <Label htmlFor="alert-enabled" className="font-medium">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.alertEnabled && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Threshold</Label>
                    <Input
                      id="alert-threshold"
                      type="text"
                      placeholder="e.g., 50"
                      value={kpiForm.alertThreshold}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertThreshold: e.target.value })}
                      data-testid="input-campaign-kpi-alert-threshold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-condition">Condition</Label>
                    <Select
                      value={kpiForm.alertCondition}
                      onValueChange={(value: 'below' | 'above' | 'equals') => 
                        setKpiForm({ ...kpiForm, alertCondition: value })
                      }
                    >
                      <SelectTrigger id="alert-condition" data-testid="select-campaign-kpi-alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-3">
                    <Label htmlFor="alert-emails">Email Recipients (comma-separated)</Label>
                    <Input
                      id="alert-emails"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={kpiForm.alertEmails}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertEmails: e.target.value })}
                      data-testid="input-campaign-kpi-alert-emails"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setExpandedPlatform(null); // Reset expanded platform on cancel
            }} data-testid="button-campaign-kpi-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateKPI} 
              disabled={createKpiMutation.isPending}
              data-testid="button-campaign-kpi-create"
            >
              {createKpiMutation.isPending ? 'Creating...' : 'Create KPI'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Campaign Benchmarks Component
function CampaignBenchmarks({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  
  // Fetch campaign-level benchmarks
  const { data: benchmarks = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/benchmarks`],
    enabled: !!campaign.id,
  });

  // Fetch aggregated metrics from all connected platforms
  const { data: customIntegration } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: [`/api/linkedin/metrics/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    category: 'performance',
    benchmarkType: 'industry',
    competitorName: '',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    industry: '',
    description: '',
    source: '',
    geographicLocation: '',
    period: 'monthly',
    confidenceLevel: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below' as 'below' | 'above' | 'equals',
    emailRecipients: ''
  });

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/benchmarks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Created",
        description: "Your benchmark has been successfully created.",
      });
      setShowCreateDialog(false);
      setEditingBenchmark(null);
      resetBenchmarkForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Benchmark",
        description: error?.message || "Failed to create benchmark.",
        variant: "destructive",
      });
    },
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/campaigns/${campaign.id}/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Updated",
        description: "Your benchmark has been successfully updated.",
      });
      setShowCreateDialog(false);
      setEditingBenchmark(null);
      resetBenchmarkForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Benchmark",
        description: error?.message || "Failed to update benchmark.",
        variant: "destructive",
      });
    },
  });

  // Delete Benchmark mutation
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/campaigns/${campaign.id}/benchmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Deleted",
        description: "Your benchmark has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Benchmark",
        description: error?.message || "Failed to delete benchmark.",
        variant: "destructive",
      });
    },
  });

  const resetBenchmarkForm = () => {
    setBenchmarkForm({
      metric: '',
      name: '',
      category: 'performance',
      benchmarkType: 'industry',
      competitorName: '',
      unit: '',
      benchmarkValue: '',
      currentValue: '',
      industry: '',
      description: '',
      source: '',
      geographicLocation: '',
      period: 'monthly',
      confidenceLevel: '',
      alertsEnabled: false,
      alertThreshold: '',
      alertCondition: 'below',
      emailRecipients: ''
    });
  };

  const handleBenchmarkSubmit = () => {
    if (!benchmarkForm.name || !benchmarkForm.benchmarkValue) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (Name, Benchmark Value)",
        variant: "destructive",
      });
      return;
    }

    const benchmarkData = {
      campaignId: campaign.id,
      platformType: null, // Campaign-level benchmark
      ...benchmarkForm,
      benchmarkValue: parseFloat(benchmarkForm.benchmarkValue),
      currentValue: benchmarkForm.currentValue ? parseFloat(benchmarkForm.currentValue) : 0,
      alertThreshold: benchmarkForm.alertsEnabled ? parseFloat(benchmarkForm.alertThreshold) : null,
      emailRecipients: benchmarkForm.alertsEnabled && benchmarkForm.emailRecipients ? benchmarkForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };

    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: benchmarkData });
    } else {
      createBenchmarkMutation.mutate(benchmarkData);
    }
  };

  const handleEditBenchmark = (benchmark: any) => {
    setEditingBenchmark(benchmark);
    setBenchmarkForm({
      metric: benchmark.metric || '',
      name: benchmark.name || '',
      category: benchmark.category || 'performance',
      benchmarkType: benchmark.benchmarkType || 'industry',
      competitorName: benchmark.competitorName || '',
      unit: benchmark.unit || '',
      benchmarkValue: String(benchmark.benchmarkValue || ''),
      currentValue: String(benchmark.currentValue || ''),
      industry: benchmark.industry || '',
      description: benchmark.description || '',
      source: benchmark.source || '',
      geographicLocation: benchmark.geoLocation || '',
      period: benchmark.period || 'monthly',
      confidenceLevel: benchmark.confidenceLevel || '',
      alertsEnabled: benchmark.alertsEnabled || false,
      alertThreshold: String(benchmark.alertThreshold || ''),
      alertCondition: benchmark.alertCondition || 'below',
      emailRecipients: benchmark.emailRecipients || ''
    });
    setShowCreateDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'above':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'below':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'meeting':
        return <Target className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'above':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'below':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'meeting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Performance':
        return <BarChart3 className="w-4 h-4" />;
      case 'Conversion':
        return <Target className="w-4 h-4" />;
      case 'Cost':
        return <DollarSign className="w-4 h-4" />;
      case 'Revenue':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Award className="w-4 h-4" />;
    }
  };

  // Calculate benchmark status based on current vs benchmark value
  const getBenchmarkStatus = (currentValue: number, benchmarkValue: number): 'above' | 'below' | 'meeting' => {
    const diff = Math.abs(currentValue - benchmarkValue);
    const tolerance = benchmarkValue * 0.05; // 5% tolerance
    
    if (diff <= tolerance) return 'meeting';
    return currentValue > benchmarkValue ? 'above' : 'below';
  };

  const calculateImprovement = (currentValue: number, benchmarkValue: number): number => {
    if (benchmarkValue === 0) return 0;
    return ((currentValue - benchmarkValue) / benchmarkValue) * 100;
  };

  // Calculate summary stats
  const aboveTargetCount = benchmarks.filter(b => {
    const status = getBenchmarkStatus(b.currentValue || 0, b.benchmarkValue || 0);
    return status === 'above';
  }).length;

  const belowTargetCount = benchmarks.filter(b => {
    const status = getBenchmarkStatus(b.currentValue || 0, b.benchmarkValue || 0);
    return status === 'below';
  }).length;

  const avgImprovement = benchmarks.length > 0
    ? benchmarks.reduce((sum, b) => sum + calculateImprovement(b.currentValue || 0, b.benchmarkValue || 0), 0) / benchmarks.length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading benchmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Benchmarks</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track and compare your campaign performance against industry standards
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingBenchmark(null);
            resetBenchmarkForm();
            setShowCreateDialog(true);
          }} 
          className="flex items-center space-x-2"
          data-testid="button-create-benchmark"
        >
          <Plus className="w-4 h-4" />
          <span>Add Benchmark</span>
        </Button>
      </div>

      {benchmarks.length > 0 ? (
        <>
          {/* Benchmark Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-total-benchmarks">
                      {benchmarks.length}
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Above Target</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-above-target">
                      {aboveTargetCount}
                    </p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Below Target</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-below-target">
                      {belowTargetCount}
                    </p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Improvement</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-avg-improvement">
                      {avgImprovement.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benchmarks List */}
          <div className="space-y-4">
            {benchmarks.map((benchmark) => {
              const status = getBenchmarkStatus(benchmark.currentValue || 0, benchmark.benchmarkValue || 0);
              const improvement = calculateImprovement(benchmark.currentValue || 0, benchmark.benchmarkValue || 0);
              
              return (
          <Card key={benchmark.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {getCategoryIcon(benchmark.category)}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{benchmark.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{benchmark.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span>{benchmark.industry}</span>
                      <span>•</span>
                      <span>{benchmark.period}</span>
                      <span>•</span>
                      <span>Created {format(benchmark.createdAt, 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Badge className={getStatusColor(status)} data-testid={`badge-status-${benchmark.id}`}>
                    {status === 'above' ? 'Above Target' : 
                     status === 'below' ? 'Below Target' : 'Meeting Target'}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditBenchmark(benchmark)}
                    data-testid={`button-edit-${benchmark.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the benchmark "${benchmark.name}"?`)) {
                        deleteBenchmarkMutation.mutate(benchmark.id);
                      }
                    }}
                    data-testid={`button-delete-${benchmark.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current Value</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white" data-testid={`text-current-${benchmark.id}`}>
                    {benchmark.currentValue || 0}{benchmark.unit}
                  </div>
                </div>
                
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Benchmark Value</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white" data-testid={`text-benchmark-${benchmark.id}`}>
                    {benchmark.benchmarkValue || 0}{benchmark.unit}
                  </div>
                </div>
                
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Improvement</div>
                  <div className={`text-lg font-bold ${improvement > 0 ? 'text-green-600' : improvement < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`} data-testid={`text-improvement-${benchmark.id}`}>
                    {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
                  </div>
                </div>
                
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Status</div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status)}
                    <span className="text-sm font-medium text-slate-900 dark:text-white capitalize" data-testid={`text-status-${benchmark.id}`}>
                      {status}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Benchmarks Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Create your first benchmark to start tracking performance against industry standards
          </p>
          <Button 
            onClick={() => {
              setEditingBenchmark(null);
              resetBenchmarkForm();
              setShowCreateDialog(true);
            }}
            data-testid="button-create-first-benchmark"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Benchmark
          </Button>
        </div>
      )}

      {/* Create/Edit Benchmark Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setEditingBenchmark(null);
          resetBenchmarkForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBenchmark ? 'Edit Benchmark' : 'Create New Benchmark'}</DialogTitle>
            <DialogDescription>
              {editingBenchmark 
                ? 'Update the benchmark details below. Select a metric to auto-populate the current value.'
                : 'Define a new benchmark for your campaign. You can select metrics from connected platforms or enter custom values.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name *</Label>
              <Input
                id="benchmark-name"
                placeholder="e.g., Email Open Rate Benchmark"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                data-testid="input-benchmark-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Metric Source (Optional)</Label>
                <Select
                  value={benchmarkForm.metric || ''}
                  onValueChange={(value) => {
                    // Auto-populate current value from connected platforms (store raw numbers, not formatted)
                    let currentValue = '';
                    let unit = '';
                    
                    // Custom Integration metrics
                    if (customIntegration?.metrics) {
                      switch(value) {
                        case 'users':
                          currentValue = String(customIntegration.metrics.users || 0);
                          break;
                        case 'sessions':
                          currentValue = String(customIntegration.metrics.sessions || 0);
                          break;
                        case 'pageviews':
                          currentValue = String(customIntegration.metrics.pageviews || 0);
                          break;
                        case 'openRate':
                          currentValue = String(customIntegration.metrics.openRate || 0);
                          unit = '%';
                          break;
                        case 'clickThroughRate':
                          currentValue = String(customIntegration.metrics.clickThroughRate || 0);
                          unit = '%';
                          break;
                      }
                    }
                    
                    // LinkedIn metrics
                    if (linkedinMetrics) {
                      switch(value) {
                        case 'li-impressions':
                          currentValue = String(linkedinMetrics.impressions || 0);
                          break;
                        case 'li-clicks':
                          currentValue = String(linkedinMetrics.clicks || 0);
                          break;
                        case 'li-spend':
                          currentValue = String(linkedinMetrics.spend || 0);
                          unit = '$';
                          break;
                        case 'li-ctr':
                          currentValue = String(linkedinMetrics.ctr || 0);
                          unit = '%';
                          break;
                        case 'li-cpc':
                          currentValue = String(linkedinMetrics.cpc || 0);
                          unit = '$';
                          break;
                      }
                    }
                    
                    setBenchmarkForm({ ...benchmarkForm, metric: value, currentValue, unit: unit || benchmarkForm.unit });
                  }}
                >
                  <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                    <SelectValue placeholder="Select metric or leave empty for custom" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkedinMetrics && Object.keys(linkedinMetrics).length > 0 && (
                      <>
                        <SelectGroup>
                          <SelectLabel>🔗 LinkedIn Metrics</SelectLabel>
                          <SelectItem value="li-impressions">Impressions</SelectItem>
                          <SelectItem value="li-clicks">Clicks</SelectItem>
                          <SelectItem value="li-spend">Spend</SelectItem>
                          <SelectItem value="li-ctr">CTR</SelectItem>
                          <SelectItem value="li-cpc">CPC</SelectItem>
                        </SelectGroup>
                        <SelectSeparator />
                      </>
                    )}
                    {customIntegration?.connectedAt && customIntegration?.metrics && (
                      <>
                        <SelectGroup>
                          <SelectLabel>📧 Custom Integration Metrics</SelectLabel>
                          <SelectItem value="users">Users</SelectItem>
                          <SelectItem value="sessions">Sessions</SelectItem>
                          <SelectItem value="pageviews">Pageviews</SelectItem>
                          <SelectItem value="openRate">Open Rate</SelectItem>
                          <SelectItem value="clickThroughRate">Click-Through Rate</SelectItem>
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="benchmark-type">Benchmark Type</Label>
                <Select
                  value={benchmarkForm.benchmarkType}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, benchmarkType: value })}
                >
                  <SelectTrigger id="benchmark-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="industry">Industry Average</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="historical">Historical</SelectItem>
                    <SelectItem value="goal">Internal Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this benchmark represents"
                value={benchmarkForm.description}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, description: e.target.value })}
                rows={2}
                data-testid="input-benchmark-description"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-value">Current Value</Label>
                <Input
                  id="current-value"
                  placeholder="0"
                  value={benchmarkForm.currentValue}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, currentValue: e.target.value })}
                  data-testid="input-benchmark-current"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  placeholder="0"
                  value={benchmarkForm.benchmarkValue}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, benchmarkValue: e.target.value })}
                  data-testid="input-benchmark-value"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={benchmarkForm.unit}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="$">$</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="ratio">Ratio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={benchmarkForm.category}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="conversion">Conversion</SelectItem>
                    <SelectItem value="traffic">Traffic</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g., E-commerce"
                  value={benchmarkForm.industry}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, industry: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select
                  value={benchmarkForm.period}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, period: value })}
                >
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Email Alert Settings */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="alert-enabled"
                  checked={benchmarkForm.alertsEnabled}
                  onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-benchmark-alert"
                />
                <Label htmlFor="alert-enabled" className="text-sm font-medium">
                  Enable Email Alerts
                </Label>
              </div>

              {benchmarkForm.alertsEnabled && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Threshold</Label>
                    <Input
                      id="alert-threshold"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={benchmarkForm.alertThreshold}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, alertThreshold: e.target.value })}
                      data-testid="input-benchmark-alert-threshold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alert-condition">Condition</Label>
                    <Select
                      value={benchmarkForm.alertCondition}
                      onValueChange={(value: any) => setBenchmarkForm({ ...benchmarkForm, alertCondition: value })}
                    >
                      <SelectTrigger id="alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alert-emails">Email Recipients</Label>
                    <Input
                      id="alert-emails"
                      placeholder="email1@example.com, email2@example.com"
                      value={benchmarkForm.emailRecipients}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, emailRecipients: e.target.value })}
                      data-testid="input-benchmark-alert-emails"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingBenchmark(null);
              resetBenchmarkForm();
            }} data-testid="button-benchmark-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleBenchmarkSubmit} 
              disabled={createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending}
              data-testid="button-benchmark-submit"
            >
              {editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Campaign Chat Messages Interface
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// Campaign Insights Chat Component
function CampaignInsightsChat({ campaign }: { campaign: Campaign }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hi! I'm your AI marketing assistant. I can help you analyze your "${campaign.name}" campaign performance, provide insights, and answer questions about your marketing strategy. What would you like to know?`,
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sample predefined questions for marketing professionals
  const sampleQuestions = [
    "What are the key performance trends for this campaign?",
    "How does this campaign compare to industry benchmarks?",
    "What optimization opportunities do you recommend?",
    "Which platforms are delivering the best ROI?",
    "What audience segments are performing best?",
    "How can I improve conversion rates?"
  ];

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // Simulate AI response with marketing insights
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(currentMessage, campaign),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (question: string, campaign: Campaign): string => {
    // Simple response generation based on keywords in the question
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('performance') || lowerQuestion.includes('trend')) {
      return `Based on your ${campaign.name} campaign data, I can see strong performance with ${campaign.impressions.toLocaleString()} impressions and ${campaign.clicks.toLocaleString()} clicks. Your CTR is performing well, and spend efficiency shows room for optimization. Would you like me to dive deeper into any specific metrics?`;
    }
    
    if (lowerQuestion.includes('roi') || lowerQuestion.includes('roas') || lowerQuestion.includes('return')) {
      return `Your ${campaign.name} campaign shows promising returns. With current spend levels, I recommend focusing on high-performing audience segments to maximize ROI. Consider reallocating budget from underperforming platforms to top performers. Would you like specific budget reallocation recommendations?`;
    }
    
    if (lowerQuestion.includes('platform') || lowerQuestion.includes('channel')) {
      return `Looking at your multi-platform approach, different channels are showing varied performance. Google Analytics and Google Sheets integrations are providing strong data insights. I recommend analyzing cross-platform attribution to optimize your media mix. What platforms are you most curious about?`;
    }
    
    if (lowerQuestion.includes('audience') || lowerQuestion.includes('target')) {
      return `Audience performance varies across segments. High-engagement audiences are showing 23% better conversion rates. I suggest creating lookalike audiences based on your top performers and testing refined targeting parameters. Which audience segments are you most interested in analyzing?`;
    }
    
    if (lowerQuestion.includes('optimization') || lowerQuestion.includes('improve')) {
      return `Several optimization opportunities exist for ${campaign.name}. Key areas include: 1) Bid strategy refinement, 2) Ad creative testing, 3) Landing page optimization, 4) Audience targeting expansion. Which area would you like to focus on first?`;
    }
    
    // Default response
    return `That's an excellent question about ${campaign.name}! Based on the current campaign data, I can provide detailed insights and recommendations. Could you be more specific about what aspect of the campaign you'd like me to analyze? I can help with performance metrics, optimization strategies, audience analysis, or budget allocation.`;
  };

  const handleQuestionClick = (question: string) => {
    setCurrentMessage(question);
  };

  return (
    <div className="space-y-6">
      {/* Chat Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5" />
            <span>Campaign Intelligence Chat</span>
          </CardTitle>
          <CardDescription>
            Ask questions about your campaign performance, get insights, and receive personalized recommendations
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sample Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Start Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {sampleQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto p-3 text-xs"
                onClick={() => handleQuestionClick(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card>
        <CardContent className="p-0">
          {/* Messages */}
          <ScrollArea className="h-96 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`p-2 rounded-full ${message.sender === 'user' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {message.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-3 rounded-lg ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[80%]">
                    <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Ask about your campaign performance, optimization strategies, or any marketing questions..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!currentMessage.trim() || isLoading}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>AI Marketing Tips</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
              <p className="font-medium text-blue-800 dark:text-blue-200">Performance Insight</p>
              <p className="text-blue-700 dark:text-blue-300">Your campaign shows strong engagement patterns. Consider A/B testing your top-performing creatives.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
              <p className="font-medium text-green-800 dark:text-green-200">Optimization Opportunity</p>
              <p className="text-green-700 dark:text-green-300">Peak performance hours are 2-4 PM. Consider dayparting strategies to maximize efficiency.</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500">
              <p className="font-medium text-orange-800 dark:text-orange-200">Budget Recommendation</p>
              <p className="text-orange-700 dark:text-orange-300">High-performing segments have room for 20% budget increase without diminishing returns.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
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

  // Check LinkedIn connection status
  const { data: linkedInConnection } = useQuery({
    queryKey: ["/api/linkedin/check-connection", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/linkedin/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  // Fetch latest LinkedIn import session for analytics link
  const { data: linkedInSession } = useQuery({
    queryKey: ["/api/linkedin/import-sessions", campaignId],
    enabled: !!campaignId && !!linkedInConnection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/linkedin/import-sessions/${campaignId}`);
      if (!response.ok) return null;
      const sessions = await response.json();
      // Return the latest session (they're sorted by date, newest first)
      return sessions.length > 0 ? sessions[0] : null;
    },
  });

  // Check Custom Integration connection status
  const { data: customIntegration } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/custom-integration/${campaignId}`);
      if (!response.ok) return null;
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
  const connectedPlatformIds = campaign?.platform?.split(', ') || [];
  
  // Map platform IDs to display names
  const platformIdToName: Record<string, string> = {
    'google-analytics': 'Google Analytics',
    'google-sheets': 'Google Sheets',
    'linkedin': 'LinkedIn Ads',
    'facebook': 'Facebook Ads',
    'google-ads': 'Google Ads',
    'tiktok': 'TikTok Ads',
    'shopify': 'Shopify'
  };
  
  const connectedPlatformNames = connectedPlatformIds.map(id => platformIdToName[id] || id);
  
  // Use campaign data for realistic platform distribution
  const campaignImpressions = campaign?.impressions || 0;
  const campaignClicks = campaign?.clicks || 0;
  const campaignSpend = parseFloat(campaign?.spend || "0");
  const estimatedConversions = Math.round(campaignClicks * 0.0347); // 3.47% conversion rate
  
  // Distribute campaign metrics across connected platforms based on typical performance
  const platformDistribution = {
    "Facebook Ads": { impressions: 0.35, clicks: 0.32, spend: 0.38, conversions: 0.28 },
    "Google Ads": { impressions: 0.28, clicks: 0.35, spend: 0.32, conversions: 0.42 },
    "TikTok Ads": { impressions: 0.22, clicks: 0.18, spend: 0.18, conversions: 0.15 },
    "LinkedIn Ads": { impressions: 0.15, clicks: 0.15, spend: 0.12, conversions: 0.15 }
  };
  
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
      impressions: connectedPlatformNames.includes("Facebook Ads") ? Math.round(campaignImpressions * platformDistribution["Facebook Ads"].impressions) : 0,
      clicks: connectedPlatformNames.includes("Facebook Ads") ? Math.round(campaignClicks * platformDistribution["Facebook Ads"].clicks) : 0,
      conversions: connectedPlatformNames.includes("Facebook Ads") ? Math.round(estimatedConversions * platformDistribution["Facebook Ads"].conversions) : 0,
      spend: connectedPlatformNames.includes("Facebook Ads") ? (campaignSpend * platformDistribution["Facebook Ads"].spend).toFixed(2) : "0.00",
      ctr: connectedPlatformNames.includes("Facebook Ads") ? "2.64%" : "0.00%",
      cpc: connectedPlatformNames.includes("Facebook Ads") ? "$0.68" : "$0.00"
    },
    {
      platform: "Google Ads",
      connected: connectedPlatformNames.includes("Google Ads"), 
      impressions: connectedPlatformNames.includes("Google Ads") ? Math.round(campaignImpressions * platformDistribution["Google Ads"].impressions) : 0,
      clicks: connectedPlatformNames.includes("Google Ads") ? Math.round(campaignClicks * platformDistribution["Google Ads"].clicks) : 0,
      conversions: connectedPlatformNames.includes("Google Ads") ? Math.round(estimatedConversions * platformDistribution["Google Ads"].conversions) : 0,
      spend: connectedPlatformNames.includes("Google Ads") ? (campaignSpend * platformDistribution["Google Ads"].spend).toFixed(2) : "0.00",
      ctr: connectedPlatformNames.includes("Google Ads") ? "3.24%" : "0.00%",
      cpc: connectedPlatformNames.includes("Google Ads") ? "$0.42" : "$0.00"
    },
    {
      platform: "TikTok Ads",
      connected: connectedPlatformNames.includes("TikTok Ads"),
      impressions: connectedPlatformNames.includes("TikTok Ads") ? Math.round(campaignImpressions * platformDistribution["TikTok Ads"].impressions) : 0,
      clicks: connectedPlatformNames.includes("TikTok Ads") ? Math.round(campaignClicks * platformDistribution["TikTok Ads"].clicks) : 0,
      conversions: connectedPlatformNames.includes("TikTok Ads") ? Math.round(estimatedConversions * platformDistribution["TikTok Ads"].conversions) : 0,
      spend: connectedPlatformNames.includes("TikTok Ads") ? (campaignSpend * platformDistribution["TikTok Ads"].spend).toFixed(2) : "0.00",
      ctr: connectedPlatformNames.includes("TikTok Ads") ? "2.15%" : "0.00%",
      cpc: connectedPlatformNames.includes("TikTok Ads") ? "$0.59" : "$0.00"
    },
    {
      platform: "LinkedIn Ads",
      connected: !!linkedInConnection?.connected,
      impressions: linkedInConnection?.connected ? Math.round(campaignImpressions * platformDistribution["LinkedIn Ads"].impressions) : 0,
      clicks: linkedInConnection?.connected ? Math.round(campaignClicks * platformDistribution["LinkedIn Ads"].clicks) : 0,
      conversions: linkedInConnection?.connected ? Math.round(estimatedConversions * platformDistribution["LinkedIn Ads"].conversions) : 0,
      spend: linkedInConnection?.connected ? (campaignSpend * platformDistribution["LinkedIn Ads"].spend).toFixed(2) : "0.00",
      ctr: linkedInConnection?.connected ? "2.78%" : "0.00%",
      cpc: linkedInConnection?.connected ? "$0.48" : "$0.00"
    },
    {
      platform: "Shopify",
      connected: connectedPlatformNames.includes("Shopify"),
      impressions: 0, // Shopify doesn't track impressions directly
      clicks: 0, // Shopify doesn't track ad clicks directly
      conversions: connectedPlatformNames.includes("Shopify") ? estimatedConversions : 0, // Show total conversions through Shopify
      spend: "0.00", // Shopify doesn't track ad spend
      ctr: "0.00%",
      cpc: "$0.00"
    },
    {
      platform: "Custom Integration",
      connected: !!customIntegration,
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
      case "TikTok Ads":
        return <i className="fab fa-tiktok w-5 h-5 text-black" />;
      case "Shopify":
        return <i className="fab fa-shopify w-5 h-5 text-green-600" />;
      case "Custom Integration":
        return (
          <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" />
          </div>
        );
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
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleDay, setScheduleDay] = useState("monday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleRecipients, setScheduleRecipients] = useState("");



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
  
  // Use campaign data directly for Performance Summary calculations
  const totalImpressions = campaignImpressions;
  const totalClicks = campaignClicks;
  const totalConversions = estimatedConversions;
  const totalSpend = campaignSpend;

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
      // Mock benchmark data (would be fetched from API in production)
      const mockBenchmarks = [
        {
          name: 'Industry CTR Benchmark',
          currentValue: '2.84%',
          targetValue: '2.35%',
          status: 'Above Target',
          category: 'Performance',
          industry: 'Marketing & Advertising'
        },
        {
          name: 'Conversion Rate Standard',
          currentValue: '4.68%',
          targetValue: '3.20%',
          status: 'Above Target',
          category: 'Conversion',
          industry: 'E-commerce'
        },
        {
          name: 'Cost Per Acquisition',
          currentValue: '$18.50',
          targetValue: '$25.00',
          status: 'Above Target',
          category: 'Cost',
          industry: 'SaaS'
        },
        {
          name: 'Return on Ad Spend',
          currentValue: '5.8x',
          targetValue: '4.0x',
          status: 'Above Target',
          category: 'Revenue',
          industry: 'Multi-platform'
        }
      ];

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
        includeBenchmarks,
        benchmarks: includeBenchmarks ? mockBenchmarks : [],
        enableScheduling,
        schedule: enableScheduling ? {
          frequency: scheduleFrequency,
          day: scheduleDay,
          time: scheduleTime,
          recipients: scheduleRecipients.split(',').map(email => email.trim()).filter(email => email)
        } : null,
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

      if (enableScheduling) {
        // Save scheduled report to storage
        const savedReport = reportStorage.addReport({
          name: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Scheduled Report" : 
            customReportName,
          type: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Custom" : 
            "Custom",
          status: 'Scheduled',
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          generatedAt: new Date(),
          format: reportFormat.toUpperCase(),
          includeKPIs,
          includeBenchmarks,
          schedule: {
            frequency: scheduleFrequency,
            day: scheduleDay,
            time: scheduleTime,
            recipients: reportData.schedule?.recipients || []
          }
        });
        
        console.log('Scheduled report saved:', savedReport);
        
        // Trigger custom event to refresh Reports page if it's open
        window.dispatchEvent(new CustomEvent('reportAdded'));
        
        alert(`Report scheduled successfully! Reports will be generated ${scheduleFrequency} and sent to ${reportData.schedule?.recipients.length} recipient(s). View all reports in the Reports section.`);
      } else {
        // Save generated report to storage
        const savedReport = reportStorage.addReport({
          name: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Campaign Report" : 
            customReportName,
          type: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Custom" : 
            "Custom",
          status: 'Generated',
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          generatedAt: new Date(),
          format: reportFormat.toUpperCase(),
          size: reportFormat === "csv" ? "~15KB" : reportFormat === "xlsx" ? "~25KB" : "~45KB",
          includeKPIs,
          includeBenchmarks
        });
        
        // Download the report immediately
        downloadReport(reportData, reportFormat);
        
        console.log('Generated report saved:', savedReport);
        
        // Trigger custom event to refresh Reports page if it's open
        window.dispatchEvent(new CustomEvent('reportAdded'));
      }
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

      // Add benchmark data if included
      if (includeBenchmarks && data.benchmarks && data.benchmarks.length > 0) {
        csvContent += "\n\nBenchmark Data\n";
        csvContent += "Benchmark Name,Current Value,Target Value,Status,Category,Industry\n";
        data.benchmarks.forEach((benchmark: any) => {
          csvContent += `${benchmark.name},${benchmark.currentValue},${benchmark.targetValue},${benchmark.status},${benchmark.category},${benchmark.industry}\n`;
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
        })) : [],
        benchmarkData: includeBenchmarks && data.benchmarks ? data.benchmarks.map((benchmark: any) => ({
          name: benchmark.name,
          currentValue: benchmark.currentValue,
          targetValue: benchmark.targetValue,
          status: benchmark.status,
          category: benchmark.category,
          industry: benchmark.industry
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

      // Add benchmark data if included
      if (includeBenchmarks && data.benchmarks && data.benchmarks.length > 0) {
        content += `\n\nCampaign Benchmarks:\n`;
        data.benchmarks.forEach((benchmark: any) => {
          content += `${benchmark.name}: ${benchmark.currentValue} vs ${benchmark.targetValue} target\n`;
          content += `  Status: ${benchmark.status} | Category: ${benchmark.category} | Industry: ${benchmark.industry}\n`;
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
    setIncludeBenchmarks(false);
    setEnableScheduling(false);
    setScheduleFrequency("weekly");
    setScheduleDay("monday");
    setScheduleTime("09:00");
    setScheduleRecipients("");
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
                        <div className="space-y-3">
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
                            <div className="ml-6 text-xs text-muted-foreground">
                              KPI data will be included showing targets, progress, and performance trends
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="include-benchmarks" 
                              checked={includeBenchmarks}
                              onCheckedChange={(checked) => setIncludeBenchmarks(checked as boolean)}
                            />
                            <Label htmlFor="include-benchmarks" className="text-sm">
                              Include Campaign Benchmarks
                            </Label>
                          </div>
                          {includeBenchmarks && (
                            <div className="ml-6 text-xs text-muted-foreground">
                              Benchmark data will be included showing industry comparisons and performance standards
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scheduling Options */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center space-x-2 mb-3">
                          <Checkbox 
                            id="enable-scheduling" 
                            checked={enableScheduling}
                            onCheckedChange={(checked) => setEnableScheduling(checked as boolean)}
                          />
                          <Label htmlFor="enable-scheduling" className="text-base font-medium">
                            Schedule Automatic Reports
                          </Label>
                        </div>
                        
                        {enableScheduling && (
                          <div className="ml-6 space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {scheduleFrequency === "weekly" && (
                                <div className="space-y-2">
                                  <Label>Day of Week</Label>
                                  <Select value={scheduleDay} onValueChange={setScheduleDay}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="monday">Monday</SelectItem>
                                      <SelectItem value="tuesday">Tuesday</SelectItem>
                                      <SelectItem value="wednesday">Wednesday</SelectItem>
                                      <SelectItem value="thursday">Thursday</SelectItem>
                                      <SelectItem value="friday">Friday</SelectItem>
                                      <SelectItem value="saturday">Saturday</SelectItem>
                                      <SelectItem value="sunday">Sunday</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              {scheduleFrequency === "monthly" && (
                                <div className="space-y-2">
                                  <Label>Day of Month</Label>
                                  <Select value={scheduleDay} onValueChange={setScheduleDay}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">1st</SelectItem>
                                      <SelectItem value="15">15th</SelectItem>
                                      <SelectItem value="last">Last day</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <Label>Time</Label>
                                <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="06:00">6:00 AM</SelectItem>
                                    <SelectItem value="09:00">9:00 AM</SelectItem>
                                    <SelectItem value="12:00">12:00 PM</SelectItem>
                                    <SelectItem value="15:00">3:00 PM</SelectItem>
                                    <SelectItem value="18:00">6:00 PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Email Recipients</Label>
                              <Input
                                placeholder="Enter email addresses (comma-separated)"
                                value={scheduleRecipients}
                                onChange={(e) => setScheduleRecipients(e.target.value)}
                              />
                              <div className="text-xs text-muted-foreground">
                                Reports will be automatically generated and sent to these email addresses
                              </div>
                            </div>
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
                            <div><span className="font-medium">Benchmarks:</span> {includeBenchmarks ? "Industry benchmarks included" : "Not included"}</div>
                            <div><span className="font-medium">Date Range:</span> {reportDateRange}</div>
                            <div><span className="font-medium">Format:</span> {reportFormat.toUpperCase()}</div>
                            {enableScheduling && (
                              <div className="pt-2 border-t text-primary">
                                <div><span className="font-medium">Schedule:</span> {scheduleFrequency.charAt(0).toUpperCase() + scheduleFrequency.slice(1)} at {scheduleTime}</div>
                                {scheduleRecipients && (
                                  <div><span className="font-medium">Recipients:</span> {scheduleRecipients.split(',').length} email(s)</div>
                                )}
                              </div>
                            )}
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
                              connectedPlatforms.length === 0 ||
                              (enableScheduling && !scheduleRecipients.trim())
                            }
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {enableScheduling ? "Schedule Report" : "Generate & Download Report"}
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
              <TabsTrigger value="attribution">Attribution</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">

              {/* Campaign DeepDive */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Campaign DeepDive</span>
                  </CardTitle>
                  <CardDescription>
                    Unlock in-depth marketing analyses for key insights and tailored recommendations
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

                  {/* Connected Platform Metrics - Only show when platform is connected */}
                  {platform.connected && (
                    <div className="px-3 pb-3">
                      <div className="space-y-4">
                        {platform.platform === "Google Analytics" && (
                          <div className="pt-2 border-t">
                            <Link href={`/campaigns/${campaign.id}/ga4-metrics`}>
                              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-ga4-analytics">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                          </div>
                        )}
                        
                        {platform.platform === "Google Sheets" && (
                          <div className="pt-2 border-t">
                            <Link href={`/campaigns/${campaign.id}/google-sheets-data`}>
                              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-sheets-analytics">
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                          </div>
                        )}
                        
                        {platform.platform === "LinkedIn Ads" && (
                          <div className="pt-2 border-t">
                            <Link href={`/campaigns/${campaign.id}/linkedin-analytics${linkedInSession?.id ? `?session=${linkedInSession.id}` : ''}`}>
                              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-linkedin-analytics">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                          </div>
                        )}
                        
                        {platform.platform === "Custom Integration" && (
                          <div className="pt-2 border-t">
                            <Link href={`/campaigns/${campaign.id}/custom-integration-analytics`}>
                              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-custom-analytics">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
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
                      ) : platform.platform === "LinkedIn Ads" ? (
                        <LinkedInConnectionFlow 
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
              <CampaignKPIs campaign={campaign} />
            </TabsContent>

            <TabsContent value="ab-testing" className="space-y-6">
              <ABTestManager campaignId={campaign.id} />
            </TabsContent>

            <TabsContent value="attribution" className="space-y-6">
              <AttributionDashboard />
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6">
              <CampaignBenchmarks campaign={campaign} />
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <CampaignInsightsChat campaign={campaign} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
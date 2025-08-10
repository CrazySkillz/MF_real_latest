import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Plus, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Edit, Trash2, BarChart3, LineChart, Zap, CalendarIcon, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertKPISchema, insertKPIProgressSchema } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import type { KPI, Campaign, KPIProgress } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const kpiFormSchema = z.object({
  name: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  targetValue: z.string().min(1, "Target value is required"),
  currentValue: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["tracking", "achieved", "at_risk", "critical"]).default("tracking"),
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

const progressFormSchema = insertKPIProgressSchema.extend({
  value: z.coerce.number().min(0, "Value cannot be negative"),
});

type KPIFormData = z.infer<typeof kpiFormSchema>;
type ProgressFormData = z.infer<typeof progressFormSchema>;

// KPI preset templates for quick setup
const KPI_PRESETS = [
  {
    name: "ROI",
    description: "Return on Investment - measure profitability of campaigns",
    unit: "%",
    defaultTarget: 300,
    priority: "high" as const,
  },
  {
    name: "ROAS",
    description: "Return on Advertising Spend - revenue generated per dollar spent",
    unit: "ratio",
    defaultTarget: 4,
    priority: "high" as const,
  },
  {
    name: "CAC",
    description: "Customer Acquisition Cost - cost to acquire one new customer",
    unit: "$",
    defaultTarget: 50,
    priority: "high" as const,
  },
  {
    name: "LTV",
    description: "Customer Lifetime Value - total revenue from a customer",
    unit: "$",
    defaultTarget: 500,
    priority: "medium" as const,
  },
  {
    name: "CTR",
    description: "Click-Through Rate - percentage of people who click ads",
    unit: "%",
    defaultTarget: 2.5,
    priority: "medium" as const,
  },
  {
    name: "CPA",
    description: "Cost Per Acquisition - cost to acquire one conversion",
    unit: "$",
    defaultTarget: 25,
    priority: "medium" as const,
  },
];

function getStatusColor(status: string) {
  switch (status) {
    case "achieved":
      return "bg-green-100 text-green-800 border-green-200";
    case "tracking":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "at_risk":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "high":
      return <Zap className="w-4 h-4 text-orange-500" />;
    case "medium":
      return <Target className="w-4 h-4 text-blue-500" />;
    case "low":
      return <BarChart3 className="w-4 h-4 text-gray-500" />;
    default:
      return <Target className="w-4 h-4 text-blue-500" />;
  }
}

function calculateProgress(current: string | number, target: string | number): number {
  const currentNum = typeof current === 'string' ? parseFloat(current) : current;
  const targetNum = typeof target === 'string' ? parseFloat(target) : target;
  
  if (targetNum === 0) return 0;
  return Math.min((currentNum / targetNum) * 100, 100);
}

function formatValue(value: string | number, unit: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  switch (unit) {
    case '%':
      return `${num.toFixed(1)}%`;
    case '$':
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'ratio':
      return `${num.toFixed(2)}:1`;
    default:
      return num.toLocaleString();
  }
}

export default function KPIsPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showKPIReportDialog, setShowKPIReportDialog] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);
  const [kpiReportFormat, setKPIReportFormat] = useState<"pdf" | "csv" | "xlsx">("pdf");
  const [kpiReportDateRange, setKPIReportDateRange] = useState("30d");

  // Fetch campaign data
  const { data: campaign } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${campaignId}`],
    enabled: !!campaignId,
  });

  // Fetch KPIs
  const { data: kpis = [], isLoading } = useQuery<KPI[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpis`],
    enabled: !!campaignId,
  });

  // Create KPI mutation
  const createKPIMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create KPI");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpis`] });
      setShowCreateDialog(false);
      toast({
        title: "KPI Created",
        description: "Your KPI has been set up successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create KPI. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Record progress mutation
  const recordProgressMutation = useMutation({
    mutationFn: async (data: { kpiId: string; progressData: ProgressFormData }) => {
      const response = await fetch(`/api/kpis/${data.kpiId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.progressData),
      });
      if (!response.ok) throw new Error("Failed to record progress");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpis`] });
      setShowProgressDialog(false);
      setSelectedKPI(null);
      toast({
        title: "Progress Recorded",
        description: "KPI progress has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete KPI mutation
  const deleteKPIMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const response = await fetch(`/api/kpis/${kpiId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete KPI");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpis`] });
      toast({
        title: "KPI Deleted",
        description: "KPI has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete KPI. Please try again.",
        variant: "destructive",
      });
    },
  });

  const kpiForm = useForm<KPIFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "%",
      targetValue: "",
      currentValue: "",
      priority: "medium",
      status: "tracking",
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

  const progressForm = useForm<ProgressFormData>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      value: 0,
      notes: "",
    },
  });

  const onCreateKPI = (data: KPIFormData) => {
    createKPIMutation.mutate(data);
  };

  const onRecordProgress = (data: ProgressFormData) => {
    if (!selectedKPI) return;
    recordProgressMutation.mutate({
      kpiId: selectedKPI.id,
      progressData: data,
    });
  };

  const handlePresetSelect = (preset: typeof KPI_PRESETS[0]) => {
    kpiForm.setValue("name", preset.name);
    kpiForm.setValue("description", preset.description);
    kpiForm.setValue("unit", preset.unit);
    kpiForm.setValue("targetValue", preset.defaultTarget.toString());
    kpiForm.setValue("priority", preset.priority);
  };

  const handleRecordProgress = (kpi: KPI) => {
    setSelectedKPI(kpi);
    progressForm.setValue("value", parseFloat(kpi.currentValue || "0"));
    setShowProgressDialog(true);
  };

  // KPI Report generation
  const generateKPIReport = async () => {
    try {
      downloadKPIReport();
      setShowKPIReportDialog(false);
      toast({
        title: "Report Generated",
        description: "Your KPI report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Failed to generate KPI report:", error);
      toast({
        title: "Error",
        description: "Failed to generate KPI report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadKPIReport = () => {
    let content = "";
    let mimeType = "";
    let fileName = `${campaign?.name || 'Campaign'}_KPI_Report_${format(new Date(), 'yyyy-MM-dd')}`;

    if (kpiReportFormat === "csv") {
      content = "KPI Name,Current Value,Target Value,Progress %,Status,Priority,Description\n";
      kpis?.forEach((kpi: KPI) => {
        const progress = kpi.currentValue && kpi.targetValue ? 
          ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
        content += `"${kpi.name || ''}","${kpi.currentValue || ''}","${kpi.targetValue || ''}","${progress}","${kpi.status || 'Active'}","${kpi.priority || 'Medium'}","${kpi.description || ''}"\n`;
      });
      mimeType = "text/csv";
      fileName += ".csv";
    } else if (kpiReportFormat === "xlsx") {
      const reportData = {
        campaign: campaign?.name,
        generatedAt: new Date().toISOString(),
        kpis: kpis?.map((kpi: KPI) => ({
          name: kpi.name,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
          progress: kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) + '%' : 'N/A',
          status: kpi.status || 'Active',
          priority: kpi.priority || 'Medium',
          description: kpi.description || ''
        })) || []
      };
      content = JSON.stringify(reportData, null, 2);
      mimeType = "application/json";
      fileName += ".json";
    } else {
      // PDF/Text format
      content = `Campaign KPI Report: ${campaign?.name}\n\n`;
      content += `Generated: ${format(new Date(), 'PPP')}\n`;
      content += `Date Range: ${kpiReportDateRange}\n\n`;
      
      if (kpis && kpis.length > 0) {
        content += `Total KPIs: ${kpis.length}\n\n`;
        content += `KPI Details:\n`;
        content += "=".repeat(50) + "\n\n";
        
        kpis.forEach((kpi: KPI, index: number) => {
          const progress = kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
          
          content += `${index + 1}. ${kpi.name}\n`;
          content += `   Current Value: ${kpi.currentValue || 'N/A'}\n`;
          content += `   Target Value: ${kpi.targetValue || 'N/A'}\n`;
          content += `   Progress: ${progress}${progress !== 'N/A' ? '%' : ''}\n`;
          content += `   Status: ${kpi.status || 'Active'}\n`;
          content += `   Priority: ${kpi.priority || 'Medium'}\n`;
          if (kpi.description) content += `   Description: ${kpi.description}\n`;
          content += `\n`;
        });
      } else {
        content += `No KPIs found for this campaign.\n`;
      }
      
      mimeType = "text/plain";
      fileName += ".txt";
    }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col">
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="p-8">
              <div className="flex items-center space-x-4">
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-32"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-48"></div>
              </div>
            </div>
          </div>
          <main className="flex-1 p-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Campaign not found</h2>
          <Link href="/campaigns">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Campaigns
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <Target className="w-8 h-8 text-blue-500" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">KPI Tracking</h1>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Manage key performance indicators for {campaign.name}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline"
                  disabled={!kpis || kpis.length === 0}
                  onClick={() => setShowKPIReportDialog(true)}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generate Campaign KPI Report
                </Button>
                
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add KPI
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto p-4 !fixed !top-1/2 !left-1/2 !transform !-translate-x-1/2 !-translate-y-1/2 !z-[9999]">
                  <DialogClose className="absolute right-4 top-4 rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors z-[60]">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogClose>
                  <DialogHeader>
                    <DialogTitle>Create New KPI</DialogTitle>
                    <DialogDescription>
                      Set up a key performance indicator to track your campaign success
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Quick Presets */}
                    <div>
                      <label className="text-sm font-medium text-slate-900 dark:text-white mb-3 block">
                        Quick Setup
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {KPI_PRESETS.map((preset) => (
                          <Button
                            key={preset.name}
                            variant="outline"
                            size="sm"
                            onClick={() => handlePresetSelect(preset)}
                            className="text-left justify-start"
                          >
                            {preset.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Form {...kpiForm}>
                      <form onSubmit={kpiForm.handleSubmit(onCreateKPI)} className="space-y-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Basic Information</h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={kpiForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>KPI Name *</FormLabel>
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
                                  <FormLabel>Unit *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select unit" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="%">Percentage (%)</SelectItem>
                                      <SelectItem value="$">Dollar ($)</SelectItem>
                                      <SelectItem value="ratio">Ratio (X:1)</SelectItem>
                                      <SelectItem value="count">Count</SelectItem>
                                      <SelectItem value="seconds">Seconds</SelectItem>
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
                        </div>

                        {/* Target and Priority */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Target & Priority</h3>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={kpiForm.control}
                              name="targetValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Target Value *</FormLabel>
                                  <FormControl>
                                    <Input
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
                              name="currentValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Current Value</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Current value"
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
                                        <SelectValue />
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
                        </div>

                        {/* Time-Based Tracking */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Time-Based Tracking</h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={kpiForm.control}
                              name="timeframe"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Timeframe</FormLabel>
                                  <FormDescription>
                                    How often should this KPI be reviewed?
                                  </FormDescription>
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
                                  <FormDescription>
                                    How many days of data to track (1-365)
                                  </FormDescription>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="365"
                                      placeholder="30"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
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
                                  <FormDescription>
                                    Calculate rolling averages to smooth trends
                                  </FormDescription>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1day">1-Day Average</SelectItem>
                                      <SelectItem value="7day">7-Day Average</SelectItem>
                                      <SelectItem value="30day">30-Day Average</SelectItem>
                                      <SelectItem value="none">No Rolling Average</SelectItem>
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
                                  <FormDescription>
                                    When should this target be achieved?
                                  </FormDescription>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Alert Settings */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Alert Settings</h3>
                          
                          <FormField
                            control={kpiForm.control}
                            name="alertsEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Enable Alerts
                                  </FormLabel>
                                  <FormDescription>
                                    Get notified when KPI performance changes significantly
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          {kpiForm.watch("alertsEnabled") && (
                            <div className="space-y-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                              <FormField
                                control={kpiForm.control}
                                name="alertThreshold"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Alert Threshold (%)</FormLabel>
                                    <FormDescription>
                                      Trigger alert when performance drops below this % of target
                                    </FormDescription>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        placeholder="80"
                                        {...field}
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 80)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <div className="grid grid-cols-1 gap-4">
                                <FormField
                                  control={kpiForm.control}
                                  name="emailNotifications"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-sm font-medium">
                                          Email Notifications
                                        </FormLabel>
                                        <FormDescription className="text-xs">
                                          Send alerts via email
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={kpiForm.control}
                                  name="slackNotifications"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-sm font-medium">
                                          Slack Notifications
                                        </FormLabel>
                                        <FormDescription className="text-xs">
                                          Send alerts to Slack
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              <FormField
                                control={kpiForm.control}
                                name="alertFrequency"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Alert Frequency</FormLabel>
                                    <FormDescription>
                                      How often should alerts be sent?
                                    </FormDescription>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="immediate">Immediate</SelectItem>
                                        <SelectItem value="daily">Daily Digest</SelectItem>
                                        <SelectItem value="weekly">Weekly Summary</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-end space-x-3 pt-4">
                          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createKPIMutation.isPending}>
                            {createKPIMutation.isPending ? "Creating..." : "Create KPI"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <main className="flex-1 p-8">
          {kpis.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-16 h-16 mx-auto text-slate-400 mb-6" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No KPIs Set Up</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Start tracking your campaign performance by setting up key performance indicators like ROI, ROAS, and more.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First KPI
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((kpi) => {
                const progress = calculateProgress(kpi.currentValue || "0", kpi.targetValue);
                const isAchieved = progress >= 100;
                
                return (
                  <Card key={kpi.id} className="relative hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getPriorityIcon(kpi.priority)}
                          <CardTitle className="text-lg">{kpi.name}</CardTitle>
                        </div>
                        <Badge className={getStatusColor(kpi.status)}>
                          {kpi.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {kpi.description && (
                        <CardDescription className="text-sm">{kpi.description}</CardDescription>
                      )}
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Current vs Target */}
                      <div className="text-center space-y-2">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                          {formatValue(kpi.currentValue || "0", kpi.unit)}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Target: {formatValue(kpi.targetValue, kpi.unit)}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className={`font-medium ${isAchieved ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      
                      {/* Status Icon */}
                      <div className="flex justify-center">
                        {isAchieved ? (
                          <div className="flex items-center text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Target Achieved
                          </div>
                        ) : progress > 75 ? (
                          <div className="flex items-center text-blue-600 text-sm">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            On Track
                          </div>
                        ) : progress > 25 ? (
                          <div className="flex items-center text-orange-600 text-sm">
                            <LineChart className="w-4 h-4 mr-1" />
                            Needs Attention
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600 text-sm">
                            <TrendingDown className="w-4 h-4 mr-1" />
                            Below Target
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex space-x-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleRecordProgress(kpi)}
                          className="flex-1"
                        >
                          Update Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteKPIMutation.mutate(kpi.id)}
                          disabled={deleteKPIMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Record Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update KPI Progress</DialogTitle>
            <DialogDescription>
              Record the latest value for {selectedKPI?.name}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...progressForm}>
            <form onSubmit={progressForm.handleSubmit(onRecordProgress)} className="space-y-4">
              <FormField
                control={progressForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Current Value {selectedKPI && `(${selectedKPI.unit})`}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter current value"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Target: {selectedKPI && formatValue(selectedKPI.targetValue, selectedKPI.unit)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={progressForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add notes about this update..."
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowProgressDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={recordProgressMutation.isPending}>
                  {recordProgressMutation.isPending ? "Recording..." : "Record Progress"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* KPI Report Generation Dialog */}
      <Dialog open={showKPIReportDialog} onOpenChange={setShowKPIReportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate KPI Report</DialogTitle>
            <DialogDescription>
              Export campaign KPI data in your preferred format
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Report Format</label>
              <Select value={kpiReportFormat} onValueChange={(value: "pdf" | "csv" | "xlsx") => setKPIReportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF/Text Report</SelectItem>
                  <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                  <SelectItem value="xlsx">Excel/JSON Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={kpiReportDateRange} onValueChange={setKPIReportDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p><strong>Report will include:</strong></p>
                <ul className="mt-1 space-y-1">
                  <li>• All KPI progress data</li>
                  <li>• Status and priority levels</li>
                  <li>• Target vs actual values</li>
                  <li>• Performance calculations</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowKPIReportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={generateKPIReport}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
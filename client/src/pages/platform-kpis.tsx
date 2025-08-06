import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, Target, Plus, Trash2, Pencil, BarChart3, TrendingUp, Calendar } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiFacebook, SiLinkedin, SiX } from "react-icons/si";

interface KPI {
  id: string;
  campaignId: string | null;
  platformType: string | null;
  name: string;
  targetValue: string;
  currentValue: string;
  unit: string;
  description: string | null;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface KPIProgress {
  id: string;
  kpiId: string;
  value: string;
  recordedAt: string;
  notes: string | null;
}

const kpiFormSchema = z.object({
  name: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  targetValue: z.string().min(1, "Target value is required"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

const progressFormSchema = z.object({
  value: z.string().min(1, "Value is required"),
  notes: z.string().optional(),
});

type KPIFormData = z.infer<typeof kpiFormSchema>;
type ProgressFormData = z.infer<typeof progressFormSchema>;

export default function PlatformKPIs() {
  const [, params] = useRoute("/platforms/:platformType/kpis");
  const platformType = params?.platformType;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showKPIDialog, setShowKPIDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);
  const [editingKPI, setEditingKPI] = useState<KPI | null>(null);

  const kpiForm = useForm<KPIFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "%",
      targetValue: "",
      priority: "medium",
    },
  });

  const progressForm = useForm<ProgressFormData>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      value: "",
      notes: "",
    },
  });

  // Fetch platform KPIs
  const { data: kpis = [], isLoading: kpisLoading } = useQuery<KPI[]>({
    queryKey: [`/api/platforms/${platformType}/kpis`],
    enabled: !!platformType,
  });

  // Create KPI mutation
  const createKPIMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      const response = await fetch(`/api/platforms/${platformType}/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create KPI");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformType}/kpis`] });
      setShowKPIDialog(false);
      kpiForm.reset();
      toast({ title: "KPI created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create KPI", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformType}/kpis`] });
      setShowProgressDialog(false);
      progressForm.reset();
      setSelectedKPI(null);
      toast({ title: "Progress recorded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to record progress", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformType}/kpis`] });
      toast({ title: "KPI deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete KPI", variant: "destructive" });
    },
  });

  const onCreateKPI = async (data: KPIFormData) => {
    createKPIMutation.mutate(data);
  };

  const onRecordProgress = async (data: ProgressFormData) => {
    if (!selectedKPI) return;
    recordProgressMutation.mutate({ kpiId: selectedKPI.id, progressData: data });
  };

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

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "google_analytics":
        return <SiGoogle className="w-5 h-5 text-orange-500" />;
      case "google_sheets":
        return <SiGoogle className="w-5 h-5 text-green-500" />;
      case "facebook":
        return <SiFacebook className="w-5 h-5 text-blue-600" />;
      case "linkedin":
        return <SiLinkedin className="w-5 h-5 text-blue-700" />;
      case "x":
        return <SiX className="w-5 h-5 text-slate-900 dark:text-white" />;
      default:
        return <BarChart3 className="w-5 h-5 text-slate-500" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "google_analytics":
        return "Google Analytics";
      case "google_sheets":
        return "Google Sheets";
      case "facebook":
        return "Facebook Ads";
      case "linkedin":
        return "LinkedIn Ads";
      case "x":
        return "X (Twitter) Ads";
      default:
        return platform;
    }
  };

  if (!platformType) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Platform not found</h2>
              <Link href="/integrations">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Integrations
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (kpisLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
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
                <Link href="/integrations">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Integrations
                  </Button>
                </Link>
                <div className="flex items-center space-x-3">
                  {getPlatformIcon(platformType)}
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                      {getPlatformName(platformType)} KPIs
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Manage key performance indicators for {getPlatformName(platformType)}
                    </p>
                  </div>
                </div>
              </div>
              
              <Button onClick={() => setShowKPIDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add KPI
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total KPIs</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.length}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Achieved</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {kpis.filter(kpi => kpi.status === "achieved").length}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">At Risk</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {kpis.filter(kpi => kpi.status === "at_risk" || kpi.status === "critical").length}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High Priority</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {kpis.filter(kpi => kpi.priority === "high" || kpi.priority === "critical").length}
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPIs Grid */}
          {kpis.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No KPIs yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Start tracking your key performance indicators for {getPlatformName(platformType)}.
                </p>
                <Button onClick={() => setShowKPIDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first KPI
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((kpi) => (
                <Card key={kpi.id} className="relative">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${getPriorityColor(kpi.priority)}`}
                        ></div>
                        <CardTitle className="text-lg">{kpi.name}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedKPI(kpi);
                            setShowProgressDialog(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKPIMutation.mutate(kpi.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {kpi.description && (
                      <CardDescription>{kpi.description}</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Current</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatValue(kpi.currentValue, kpi.unit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600 dark:text-slate-400">Target</p>
                        <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                          {formatValue(kpi.targetValue, kpi.unit)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className={`${getStatusColor(kpi.status)} text-xs`}>
                        {kpi.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {kpi.priority} priority
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedKPI(kpi);
                        setShowProgressDialog(true);
                      }}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Update Progress
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create KPI Dialog */}
      <Dialog open={showKPIDialog} onOpenChange={setShowKPIDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New KPI</DialogTitle>
            <DialogDescription>
              Set up a key performance indicator for {getPlatformName(platformType)}.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...kpiForm}>
            <form onSubmit={kpiForm.handleSubmit(onCreateKPI)} className="space-y-6">
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
                            <SelectValue placeholder="Select unit" />
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
                            <SelectValue placeholder="Select priority" />
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
    </div>
  );
}
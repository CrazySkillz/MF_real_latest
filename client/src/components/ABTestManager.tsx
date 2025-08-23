import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Play, Pause, BarChart3, TrendingUp, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ABTestResults } from "./ABTestResults";

const createABTestSchema = z.object({
  name: z.string().min(1, "Test name is required").max(100, "Name too long"),
  description: z.string().optional(),
  hypothesis: z.string().min(1, "Hypothesis is required").max(500, "Hypothesis too long"), 
  objective: z.enum(["conversions", "clicks", "engagement", "revenue"]),
  trafficSplit: z.string().refine((val) => {
    const num = parseFloat(val);
    return num >= 10 && num <= 90;
  }, "Traffic split must be between 10% and 90%"),
  minSampleSize: z.string().refine((val) => {
    const num = parseInt(val);
    return num >= 50 && num <= 10000;
  }, "Sample size must be between 50 and 10,000"),
  confidenceLevel: z.string().default("95.00"),
});

type CreateABTestData = z.infer<typeof createABTestSchema>;

interface ABTest {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  hypothesis?: string;
  objective: string;
  trafficSplit: string;
  status: string;
  startDate?: string;
  endDate?: string;
  minSampleSize?: number;
  confidenceLevel?: string;
  significance?: boolean;
  winnerVariant?: string;
  createdAt: string;
  updatedAt: string;
}

interface ABTestVariant {
  id: string;
  testId: string;
  name: string;
  description?: string;
  content?: string;
  trafficPercentage: string;
  isControl: boolean;
  createdAt: string;
}

interface ABTestResult {
  id: string;
  testId: string;
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: string;
  conversionRate: string;
  clickThroughRate: string;
  revenuePerVisitor: string;
  costPerConversion: string;
  recordedAt: string;
  updatedAt: string;
}

interface ABTestManagerProps {
  campaignId: string;
}

export function ABTestManager({ campaignId }: ABTestManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ab-tests"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ab-tests`);
      return response.json();
    },
  });

  const form = useForm<CreateABTestData>({
    resolver: zodResolver(createABTestSchema),
    defaultValues: {
      trafficSplit: "50",
      minSampleSize: "100",
      confidenceLevel: "95.00",
      objective: "conversions",
    },
  });

  const createTestMutation = useMutation({
    mutationFn: async (data: CreateABTestData) => {
      const response = await apiRequest("POST", "/api/ab-tests", {
        ...data,
        campaignId,
        trafficSplit: parseFloat(data.trafficSplit),
        minSampleSize: parseInt(data.minSampleSize),
        confidenceLevel: parseFloat(data.confidenceLevel),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ab-tests"] });
      toast({
        title: "A/B Test Created",
        description: "Your A/B test has been created with variants A and B.",
      });
      setIsCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create A/B test. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTestStatusMutation = useMutation({
    mutationFn: async ({ testId, status }: { testId: string; status: string }) => {
      const updateData: any = { status };
      if (status === "active") {
        updateData.startDate = new Date().toISOString();
      } else if (status === "completed") {
        updateData.endDate = new Date().toISOString();
      }
      
      const response = await apiRequest("PATCH", `/api/ab-tests/${testId}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "ab-tests"] });
      toast({
        title: "Test Status Updated",
        description: "A/B test status has been updated successfully.",
      });
    },
  });

  const handleSubmit = (data: CreateABTestData) => {
    createTestMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "paused": return "bg-yellow-500";
      case "completed": return "bg-blue-500";
      case "archived": return "bg-gray-500";
      default: return "bg-gray-400";
    }
  };

  const getObjectiveIcon = (objective: string) => {
    switch (objective) {
      case "conversions": return <Target className="w-4 h-4" />;
      case "clicks": return <TrendingUp className="w-4 h-4" />;
      case "engagement": return <Users className="w-4 h-4" />;
      case "revenue": return <BarChart3 className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">A/B Tests</h3>
        </div>
        <div className="text-center py-8 text-gray-500">Loading A/B tests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ab-test-manager">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">A/B Tests</h3>
          <p className="text-sm text-gray-600">Test different approaches to optimize campaign performance</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-ab-test">
              <Plus className="w-4 h-4 mr-2" />
              New A/B Test
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>
                Set up a new A/B test to compare different approaches and optimize your campaign performance.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Landing Page CTA Test"
                          data-testid="input-test-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hypothesis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hypothesis *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., Changing the CTA button color from blue to red will increase conversion rates by 15%"
                          className="min-h-[80px] resize-none"
                          data-testid="input-test-hypothesis"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        What do you expect to happen and why?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="objective"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Objective</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-test-objective">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="conversions">Conversions</SelectItem>
                            <SelectItem value="clicks">Clicks</SelectItem>
                            <SelectItem value="engagement">Engagement</SelectItem>
                            <SelectItem value="revenue">Revenue</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trafficSplit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Traffic Split (% for A)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="10" 
                            max="90" 
                            placeholder="50"
                            data-testid="input-traffic-split"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          10-90% (Variant B gets the remainder)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="minSampleSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Sample Size</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="50" 
                            max="10000"
                            data-testid="input-sample-size"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          50-10,000 participants
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confidenceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confidence Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="90.00">90%</SelectItem>
                            <SelectItem value="95.00">95%</SelectItem>
                            <SelectItem value="99.00">99%</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Statistical significance threshold
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional details about the test setup..."
                          className="min-h-[60px] resize-none"
                          data-testid="input-test-description"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                    data-testid="button-cancel-test"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTestMutation.isPending}
                    data-testid="button-submit-test"
                  >
                    {createTestMutation.isPending ? "Creating..." : "Create Test"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No A/B Tests Yet</h4>
            <p className="text-gray-600 mb-4">
              Start testing different approaches to optimize your campaign performance.
            </p>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="button-create-first-test"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First A/B Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tests.map((test: ABTest) => (
            <Card key={test.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getObjectiveIcon(test.objective)}
                    </div>
                    <div>
                      <CardTitle className="text-base" data-testid={`text-test-name-${test.id}`}>
                        {test.name}
                      </CardTitle>
                      <CardDescription>
                        {test.hypothesis}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={`${getStatusColor(test.status)} text-white`}
                      data-testid={`status-${test.id}`}
                    >
                      {test.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>Split: {test.trafficSplit}% / {100 - parseFloat(test.trafficSplit)}%</span>
                    <span>•</span>
                    <span>Target: {test.objective}</span>
                    <span>•</span>
                    <span>Confidence: {test.confidenceLevel}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {test.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => updateTestStatusMutation.mutate({ testId: test.id, status: "active" })}
                        disabled={updateTestStatusMutation.isPending}
                        data-testid={`button-start-${test.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </Button>
                    )}
                    {test.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateTestStatusMutation.mutate({ testId: test.id, status: "paused" })}
                        disabled={updateTestStatusMutation.isPending}
                        data-testid={`button-pause-${test.id}`}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    {test.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => updateTestStatusMutation.mutate({ testId: test.id, status: "active" })}
                        disabled={updateTestStatusMutation.isPending}
                        data-testid={`button-resume-${test.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTest(test.id)}
                      data-testid={`button-view-results-${test.id}`}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Results
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* A/B Test Results Modal */}
      {selectedTest && (
        <ABTestResults 
          testId={selectedTest} 
          onClose={() => setSelectedTest(null)} 
        />
      )}
    </div>
  );
}
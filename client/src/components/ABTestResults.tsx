import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Target, Users, MousePointer, DollarSign, Award, BarChart3, AlertCircle, CheckCircle2 } from "lucide-react";

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

interface ABTestAnalytics {
  test: ABTest;
  variants: ABTestVariant[];
  results: ABTestResult[];
  statisticalSignificance: boolean;
  confidenceLevel: number;
  winnerVariant?: string;
}

interface ABTestResultsProps {
  testId: string;
  onClose: () => void;
}

export function ABTestResults({ testId, onClose }: ABTestResultsProps) {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ["/api/ab-tests", testId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/ab-tests/${testId}`);
      return response.json() as Promise<ABTestAnalytics>;
    },
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatPercentage = (rate: string) => {
    return `${parseFloat(rate).toFixed(2)}%`;
  };

  const getTrendIcon = (variant: ABTestVariant, results: ABTestResult[]) => {
    if (results.length < 2) return <Minus className="w-4 h-4 text-gray-400" />;
    
    const variantResult = results.find(r => r.variantId === variant.id);
    const controlResult = results.find(r => r.variantId !== variant.id);
    
    if (!variantResult || !controlResult) return <Minus className="w-4 h-4 text-gray-400" />;
    
    const variantRate = parseFloat(variantResult.conversionRate);
    const controlRate = parseFloat(controlResult.conversionRate);
    
    if (variantRate > controlRate) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (variantRate < controlRate) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const calculateLift = (variant: ABTestResult, control: ABTestResult) => {
    const variantRate = parseFloat(variant.conversionRate);
    const controlRate = parseFloat(control.conversionRate);
    
    if (controlRate === 0) return 0;
    
    return ((variantRate - controlRate) / controlRate) * 100;
  };

  const getVariantIcon = (objective: string) => {
    switch (objective) {
      case "conversions": return <Target className="w-5 h-5" />;
      case "clicks": return <MousePointer className="w-5 h-5" />;
      case "engagement": return <Users className="w-5 h-5" />;
      case "revenue": return <DollarSign className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>A/B Test Results</DialogTitle>
            <DialogDescription>Loading test analytics...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !analytics) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Error Loading Results</DialogTitle>
            <DialogDescription>
              Failed to load A/B test results. Please try again.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const { test, variants, results, statisticalSignificance, winnerVariant } = analytics;
  const controlVariant = variants.find(v => v.isControl);
  const testVariants = variants.filter(v => !v.isControl);
  
  const controlResult = controlVariant ? results.find(r => r.variantId === controlVariant.id) : null;
  const hasData = results.some(r => r.impressions > 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl" data-testid={`results-title-${test.id}`}>
                {test.name} - Results
              </DialogTitle>
              <DialogDescription className="mt-2">
                {test.hypothesis}
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                className={`${test.status === 'active' ? 'bg-green-500' : 'bg-gray-500'} text-white`}
                data-testid={`test-status-${test.id}`}
              >
                {test.status}
              </Badge>
              {statisticalSignificance ? (
                <Badge className="bg-green-500 text-white" data-testid="significance-badge">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Significant
                </Badge>
              ) : (
                <Badge className="bg-yellow-500 text-white" data-testid="pending-badge">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {!hasData ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Yet</h3>
            <p className="text-gray-600">
              Start the test and begin collecting data to see results here.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="variants">Variant Comparison</TabsTrigger>
              <TabsTrigger value="analysis">Statistical Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Test Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Test Duration</CardDescription>
                    <CardTitle className="text-2xl">
                      {test.startDate ? 
                        Math.ceil((new Date().getTime() - new Date(test.startDate).getTime()) / (1000 * 60 * 60 * 24)) 
                        : 0} days
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Participants</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(results.reduce((sum, r) => sum + r.impressions, 0))}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Confidence Level</CardDescription>
                    <CardTitle className="text-2xl">
                      {parseFloat(test.confidenceLevel || "95")}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Winner Announcement */}
              {statisticalSignificance && winnerVariant && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <Award className="w-6 h-6 text-green-600" />
                      <div>
                        <CardTitle className="text-green-800">
                          Winner: Variant {winnerVariant}
                        </CardTitle>
                        <CardDescription>
                          This variant has achieved statistical significance at the {test.confidenceLevel}% confidence level.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Quick Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {results.map((result) => {
                  const variant = variants.find(v => v.id === result.variantId);
                  if (!variant) return null;

                  return (
                    <Card key={result.id} className={winnerVariant === variant.name ? "border-green-200" : ""}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getVariantIcon(test.objective)}
                            <CardTitle className="text-lg">Variant {variant.name}</CardTitle>
                          </div>
                          {getTrendIcon(variant, results)}
                        </div>
                        <CardDescription>
                          {variant.isControl ? "Control" : "Test Variant"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm">
                            <span>Conversion Rate</span>
                            <span className="font-medium">{formatPercentage(result.conversionRate)}</span>
                          </div>
                          <Progress 
                            value={parseFloat(result.conversionRate)} 
                            className="mt-1" 
                            max={Math.max(...results.map(r => parseFloat(r.conversionRate))) || 10}
                          />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Participants</span>
                          <span className="font-medium">{formatNumber(result.impressions)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Conversions</span>
                          <span className="font-medium">{formatNumber(result.conversions)}</span>
                        </div>
                        {test.objective === "revenue" && (
                          <div className="flex justify-between text-sm">
                            <span>Revenue</span>
                            <span className="font-medium">{formatCurrency(result.revenue)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-6">
              {/* Detailed Variant Comparison */}
              <div className="space-y-4">
                {results.map((result) => {
                  const variant = variants.find(v => v.id === result.variantId);
                  if (!variant) return null;

                  const lift = controlResult && !variant.isControl ? 
                    calculateLift(result, controlResult) : 0;

                  return (
                    <Card key={result.id} className={winnerVariant === variant.name ? "border-green-200 bg-green-50" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center space-x-2">
                              <span>Variant {variant.name}</span>
                              {winnerVariant === variant.name && (
                                <Award className="w-5 h-5 text-green-600" />
                              )}
                            </CardTitle>
                            <CardDescription>
                              {variant.description || (variant.isControl ? "Control Group" : "Test Variant")}
                            </CardDescription>
                          </div>
                          {!variant.isControl && lift !== 0 && (
                            <Badge className={lift > 0 ? "bg-green-500" : "bg-red-500"}>
                              {lift > 0 ? "+" : ""}{lift.toFixed(1)}% vs Control
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-6">
                          <div>
                            <p className="text-sm text-gray-600">Participants</p>
                            <p className="text-xl font-semibold">{formatNumber(result.impressions)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Clicks</p>
                            <p className="text-xl font-semibold">{formatNumber(result.clicks)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Conversions</p>
                            <p className="text-xl font-semibold">{formatNumber(result.conversions)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">CVR</p>
                            <p className="text-xl font-semibold">{formatPercentage(result.conversionRate)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">CTR</p>
                            <p className="text-xl font-semibold">{formatPercentage(result.clickThroughRate)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Revenue</p>
                            <p className="text-xl font-semibold">{formatCurrency(result.revenue)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              {/* Statistical Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistical Analysis</CardTitle>
                  <CardDescription>
                    Test significance and reliability metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 border rounded-lg">
                      <div className={`text-2xl font-bold ${statisticalSignificance ? 'text-green-600' : 'text-yellow-600'}`}>
                        {statisticalSignificance ? "Significant" : "Not Yet"}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Statistical Significance</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {test.confidenceLevel}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Confidence Level</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {test.minSampleSize || "100"}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Min Sample Size</div>
                    </div>
                  </div>

                  {!statisticalSignificance && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-800">Test Still Running</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            This test hasn't reached statistical significance yet. Continue running the test 
                            to collect more data for reliable results.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {results.length >= 2 && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Sample Size Progress</h4>
                      {results.map((result) => {
                        const variant = variants.find(v => v.id === result.variantId);
                        if (!variant) return null;

                        const progress = Math.min((result.impressions / (test.minSampleSize || 100)) * 100, 100);

                        return (
                          <div key={result.id} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Variant {variant.name}</span>
                              <span>{formatNumber(result.impressions)} / {formatNumber(test.minSampleSize || 100)}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
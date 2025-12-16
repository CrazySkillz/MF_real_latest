/**
 * Guided Column Mapping Component
 * Step-by-step wizard to guide users through mapping columns
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, FileSpreadsheet, DollarSign, Target, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DetectedColumn {
  index: number;
  name: string;
  originalName: string;
  detectedType: string;
  confidence: number;
  sampleValues: any[];
  uniqueValues?: number;
  nullCount: number;
}

interface GuidedColumnMappingProps {
  campaignId: string;
  connectionId: string;
  spreadsheetId: string;
  platform: string;
  onMappingComplete?: () => void;
  onCancel?: () => void;
}

type Step = 'detect' | 'campaign-name' | 'revenue' | 'platform' | 'review' | 'complete';

export function GuidedColumnMapping({
  campaignId,
  connectionId,
  spreadsheetId,
  platform,
  onMappingComplete,
  onCancel
}: GuidedColumnMappingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState<Step>('detect');
  const [selectedCampaignName, setSelectedCampaignName] = useState<string | null>(null);
  const [selectedRevenue, setSelectedRevenue] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [skipPlatform, setSkipPlatform] = useState(false);

  // Fetch detected columns
  const { data: columnsData, isLoading: columnsLoading, error: columnsError } = useQuery<{ success: boolean; columns: DetectedColumn[]; totalRows: number }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "detect-columns", spreadsheetId],
    queryFn: async () => {
      const queryParam = spreadsheetId ? `?spreadsheetId=${spreadsheetId}` : '';
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/detect-columns${queryParam}`);
      if (!response.ok) throw new Error('Failed to detect columns');
      return response.json();
    },
    enabled: !!campaignId && !!spreadsheetId
  });

  const detectedColumns = columnsData?.columns || [];

  // Auto-advance to first step when columns are detected
  useEffect(() => {
    if (detectedColumns.length > 0 && currentStep === 'detect') {
      setCurrentStep('campaign-name');
    }
  }, [detectedColumns.length, currentStep]);

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async (mappings: any[]) => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/save-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          mappings,
          platform
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save mappings');
      }
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] })
      ]);
      
      // Wait a bit for backend to process the mappings and calculate conversion values
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refetch the data to ensure it's up to date
      await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      await queryClient.refetchQueries({ queryKey: ["/api/linkedin/imports"] });
      
      setCurrentStep('complete');
      toast({
        title: "Mappings Saved!",
        description: "Conversion values will be calculated automatically.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Mappings",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleNext = () => {
    if (currentStep === 'campaign-name') {
      if (!selectedCampaignName) {
        toast({
          title: "Campaign Name Required",
          description: "Please select a column that identifies the campaign name.",
          variant: "destructive"
        });
        return;
      }
      setCurrentStep('revenue');
    } else if (currentStep === 'revenue') {
      if (!selectedRevenue) {
        toast({
          title: "Revenue Column Required",
          description: "Please select a column that contains revenue data.",
          variant: "destructive"
        });
        return;
      }
      setCurrentStep('platform');
    } else if (currentStep === 'platform') {
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'revenue') {
      setCurrentStep('campaign-name');
    } else if (currentStep === 'platform') {
      setCurrentStep('revenue');
    } else if (currentStep === 'review') {
      setCurrentStep('platform');
    }
  };

  const handleSave = () => {
    const mappings: any[] = [];
    
    // Add campaign name mapping
    if (selectedCampaignName) {
      const column = detectedColumns.find(c => c.index.toString() === selectedCampaignName);
      if (column) {
        mappings.push({
          sourceColumnIndex: column.index,
          sourceColumnName: column.originalName,
          targetFieldId: 'campaign_name',
          targetFieldName: 'Campaign Name',
          matchType: 'manual',
          confidence: 1.0
        });
      }
    }

    // Add revenue mapping
    if (selectedRevenue) {
      const column = detectedColumns.find(c => c.index.toString() === selectedRevenue);
      if (column) {
        mappings.push({
          sourceColumnIndex: column.index,
          sourceColumnName: column.originalName,
          targetFieldId: 'revenue',
          targetFieldName: 'Revenue',
          matchType: 'manual',
          confidence: 1.0
        });
      }
    }

    // Add platform mapping (if selected and not skipped)
    if (selectedPlatform && !skipPlatform) {
      const column = detectedColumns.find(c => c.index.toString() === selectedPlatform);
      if (column) {
        mappings.push({
          sourceColumnIndex: column.index,
          sourceColumnName: column.originalName,
          targetFieldId: 'platform',
          targetFieldName: 'Platform',
          matchType: 'manual',
          confidence: 1.0
        });
      }
    }

    saveMappingsMutation.mutate(mappings);
  };

  if (columnsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-600 dark:text-slate-400">Detecting columns from your Google Sheet...</p>
      </div>
    );
  }

  if (columnsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          Failed to detect columns: {columnsError instanceof Error ? columnsError.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (detectedColumns.length === 0) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          No columns detected. Please ensure your Google Sheet has a header row and data.
        </AlertDescription>
      </Alert>
    );
  }

  // Step indicator
  const steps = [
    { id: 'campaign-name', label: 'Campaign Name', icon: Target },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'platform', label: 'Platform', icon: Filter },
    { id: 'review', label: 'Review', icon: CheckCircle2 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  if (currentStep === 'complete') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              Conversion Values Calculated!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Revenue metrics are now available in the campaign overview.
            </p>
          </div>
        </div>
        {onMappingComplete && (
          <Button
            onClick={async () => {
              // Poll for conversion values - wait up to 10 seconds
              let attempts = 0;
              const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds max
              
              while (attempts < maxAttempts) {
                // Invalidate and refetch
                await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
                await queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] });
                
                const sheetsDataResponse = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
                if (sheetsDataResponse.ok) {
                  const sheetsData = await sheetsDataResponse.json();
                  const hasConversionValues = sheetsData?.calculatedConversionValues && 
                    Array.isArray(sheetsData.calculatedConversionValues) && 
                    sheetsData.calculatedConversionValues.length > 0;
                  
                  if (hasConversionValues) {
                    console.log('[Guided Mapping] Conversion values calculated, navigating...');
                    // Update query cache with fresh data
                    queryClient.setQueryData(
                      ["/api/campaigns", campaignId, "google-sheets-data"],
                      sheetsData
                    );
                    break;
                  }
                }
                
                attempts++;
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between attempts
                }
              }
              
              // Final refetch to ensure everything is up to date
              await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
              await queryClient.refetchQueries({ queryKey: ["/api/linkedin/imports"] });
              
              onMappingComplete();
            }}
            className="w-full"
            size="lg"
          >
            Back to Campaign Overview
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isCompleted
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <p className={`text-xs mt-2 text-center ${
                  isActive
                    ? 'text-blue-600 font-medium'
                    : isCompleted
                    ? 'text-green-600'
                    : 'text-slate-400'
                }`}>
                  {step.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  isCompleted ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 'campaign-name' && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Select Campaign Name Column
              </>
            )}
            {currentStep === 'revenue' && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                Select Revenue Column
              </>
            )}
            {currentStep === 'platform' && (
              <>
                <Filter className="w-5 h-5 text-purple-600" />
                Select Platform Column (Optional)
              </>
            )}
            {currentStep === 'review' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Review Your Mappings
              </>
            )}
          </CardTitle>
          <CardDescription>
            {currentStep === 'campaign-name' && (
              "Which column in your Google Sheet identifies the campaign name? This is used to match your data with LinkedIn campaigns."
            )}
            {currentStep === 'revenue' && (
              "Which column contains the revenue data? This is required to calculate conversion values and revenue metrics like ROI and ROAS."
            )}
            {currentStep === 'platform' && (
              "Which column identifies the platform (e.g., LinkedIn, Facebook, Google Ads)? This is optional if your entire sheet is for LinkedIn only."
            )}
            {currentStep === 'review' && (
              "Review your column mappings before saving. Conversion values will be calculated automatically."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign Name Step */}
          {currentStep === 'campaign-name' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Campaign Name Column</Label>
                <Select value={selectedCampaignName || ""} onValueChange={setSelectedCampaignName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detectedColumns.map((column) => (
                      <SelectItem key={column.index} value={column.index.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{column.originalName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {column.detectedType}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCampaignName && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Sample values:</strong> {detectedColumns.find(c => c.index.toString() === selectedCampaignName)?.sampleValues.slice(0, 3).join(', ') || 'N/A'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Revenue Step */}
          {currentStep === 'revenue' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Revenue Column</Label>
                <Select value={selectedRevenue || ""} onValueChange={setSelectedRevenue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detectedColumns.map((column) => (
                      <SelectItem key={column.index} value={column.index.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{column.originalName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {column.detectedType}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRevenue && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-xs text-green-800 dark:text-green-300">
                    <strong>Sample values:</strong> {detectedColumns.find(c => c.index.toString() === selectedRevenue)?.sampleValues.slice(0, 3).join(', ') || 'N/A'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Platform Step */}
          {currentStep === 'platform' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Platform Column (Optional)</Label>
                <Select 
                  value={skipPlatform ? "skip" : (selectedPlatform || "")} 
                  onValueChange={(value) => {
                    if (value === "skip") {
                      setSkipPlatform(true);
                      setSelectedPlatform(null);
                    } else {
                      setSkipPlatform(false);
                      setSelectedPlatform(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a column or skip..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">
                      <span className="text-slate-500">— Skip (entire sheet is for LinkedIn) —</span>
                    </SelectItem>
                    {detectedColumns.map((column) => (
                      <SelectItem key={column.index} value={column.index.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{column.originalName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {column.detectedType}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPlatform && !skipPlatform && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <p className="text-xs text-purple-800 dark:text-purple-300">
                    <strong>Sample values:</strong> {detectedColumns.find(c => c.index.toString() === selectedPlatform)?.sampleValues.slice(0, 3).join(', ') || 'N/A'}
                  </p>
                </div>
              )}
              {skipPlatform && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    The entire sheet will be used for LinkedIn data.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Campaign Name:</span>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {detectedColumns.find(c => c.index.toString() === selectedCampaignName)?.originalName || 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Revenue:</span>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {detectedColumns.find(c => c.index.toString() === selectedRevenue)?.originalName || 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">Platform:</span>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {skipPlatform 
                      ? 'Skipped (entire sheet for LinkedIn)'
                      : (detectedColumns.find(c => c.index.toString() === selectedPlatform)?.originalName || 'Not selected')
                    }
                  </span>
                </div>
              </div>
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  After saving, conversion values will be calculated automatically and revenue metrics will be available in the campaign overview.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              {currentStep !== 'campaign-name' && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div>
              {currentStep === 'review' ? (
                <Button
                  onClick={handleSave}
                  disabled={saveMappingsMutation.isPending}
                >
                  {saveMappingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Mappings
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


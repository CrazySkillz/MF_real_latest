/**
 * Column Mapping Interface Component
 * Allows users to map uploaded columns to platform fields
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Star, Loader2, Info, Lightbulb, DollarSign, Calculator, ArrowLeft } from "lucide-react";
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

interface DatasetSchema {
  patterns: {
    isMultiPlatform: boolean;
    platformColumnIndex?: number;
  };
}

interface PlatformField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  category: string;
  description?: string;
}

interface FieldMapping {
  sourceColumnIndex: number;
  sourceColumnName: string;
  targetFieldId: string;
  targetFieldName: string;
  matchType: 'auto' | 'manual' | 'template';
  confidence: number;
}

interface ColumnMappingInterfaceProps {
  campaignId: string;
  connectionId?: string;
  spreadsheetId?: string; // Google Sheets spreadsheet ID (different from connectionId)
  platform: string;
  onMappingComplete?: () => void;
  onCancel?: () => void;
  isOpen?: boolean; // Only fetch data when dialog is open
}

export function ColumnMappingInterface({
  campaignId,
  connectionId,
  spreadsheetId,
  platform,
  onMappingComplete,
  onCancel
}: ColumnMappingInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  const [mappingsJustSaved, setMappingsJustSaved] = useState(false);
  
  // Step-by-step guided flow state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Fetch platform fields (with campaignId to check if LinkedIn API is connected)
  const { data: platformFieldsData } = useQuery<{ success: boolean; fields: PlatformField[] }>({
    queryKey: ["/api/platforms", platform, "fields", campaignId],
    queryFn: async () => {
      const url = `/api/platforms/${platform}/fields${campaignId ? `?campaignId=${campaignId}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch platform fields');
      return response.json();
    }
  });

  const platformFields = platformFieldsData?.fields || [];

  // Fetch detected columns
  const { data: columnsData, isLoading: columnsLoading, error: columnsError } = useQuery<{ success: boolean; columns: DetectedColumn[]; totalRows: number; schema?: DatasetSchema }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "detect-columns", spreadsheetId],
    queryFn: async () => {
      const queryParam = spreadsheetId ? `?spreadsheetId=${spreadsheetId}` : '';
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/detect-columns${queryParam}`);
      if (!response.ok) throw new Error('Failed to detect columns');
      return response.json();
    },
    enabled: !!campaignId
  });

  const detectedColumns = columnsData?.columns || [];
  const schema = columnsData?.schema;
  const isMultiPlatform = schema?.patterns?.isMultiPlatform || false;

  // Check if conversion values have been calculated (after mappings are saved)
  const { data: sheetsData, refetch: refetchSheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: mappingsJustSaved && !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: (data) => {
      // Poll every 2 seconds if mappings were just saved and no conversion values yet
      if (mappingsJustSaved && (!data?.calculatedConversionValues || data.calculatedConversionValues.length === 0)) {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling once we have conversion values
    },
    refetchIntervalInBackground: false,
  });

  const hasConversionValues = sheetsData?.calculatedConversionValues && sheetsData.calculatedConversionValues.length > 0;

  // Auto-map columns
  const autoMapMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/auto-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          columns: detectedColumns
        })
      });
      if (!response.ok) throw new Error('Failed to auto-map columns');
      return response.json();
    },
    onSuccess: (data) => {
      setMappings(data.mappings || []);
      toast({
        title: "Auto-Mapping Complete",
        description: `Mapped ${data.mappings?.length || 0} columns automatically.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Auto-Mapping Failed",
        description: error.message || "Failed to auto-map columns",
        variant: "destructive"
      });
    }
  });

  // Save mappings
  const saveMappingsMutation = useMutation({
    mutationFn: async (mappingsToSave: FieldMapping[]) => {
      if (!connectionId) {
        throw new Error('Connection ID is required to save mappings');
      }
      
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/save-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          mappings: mappingsToSave,
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
      toast({
        title: "Mappings Saved",
        description: "Column mappings have been saved successfully. Calculating conversion values...",
      });
      // Invalidate and refetch queries to refresh data and show conversion values
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets"] });
      // Mark that mappings were just saved (this enables the query and starts polling)
      setMappingsJustSaved(true);
      // Wait a moment for backend to process, then refetch
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      }, 1000);
      // Call onMappingComplete to update parent
      if (onMappingComplete) {
        onMappingComplete();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save mappings",
        variant: "destructive"
      });
    }
  });

  // Determine if Platform step is needed
  const needsPlatformStep = isMultiPlatform;
  const totalSteps = needsPlatformStep ? 3 : 2;
  
  // Get current mappings for each step
  const campaignNameMapping = mappings.find(m => m.targetFieldId === 'campaign_name');
  const revenueMapping = mappings.find(m => m.targetFieldId === 'revenue');
  const platformMapping = mappings.find(m => m.targetFieldId === 'platform');
  
  // Auto-advance steps when mappings are complete
  useEffect(() => {
    if (currentStep === 1 && campaignNameMapping) {
      setCurrentStep(2);
    } else if (currentStep === 2 && revenueMapping) {
      if (needsPlatformStep) {
        setCurrentStep(3);
      }
    }
  }, [campaignNameMapping, revenueMapping, platformMapping, currentStep, needsPlatformStep]);

  // Validate mappings - for LinkedIn conversion value, we need: campaign_name, revenue, and platform (if multi-platform)
  useEffect(() => {
    const errors = new Map<string, string>();
    
    // Required fields for LinkedIn conversion value
    if (!campaignNameMapping) {
      errors.set('campaign_name', 'Campaign Name is required');
    }
    if (!revenueMapping) {
      errors.set('revenue', 'Revenue is required');
    }
    if (needsPlatformStep && !platformMapping) {
      errors.set('platform', 'Platform is required for multi-platform datasets');
    }
    
    // Check for duplicate mappings
    const fieldIds = new Set<string>();
    for (const mapping of mappings) {
      if (fieldIds.has(mapping.targetFieldId)) {
        errors.set(mapping.targetFieldId, `Field "${mapping.targetFieldName}" is mapped multiple times`);
      }
      fieldIds.add(mapping.targetFieldId);
    }
    
    setValidationErrors(errors);
  }, [mappings, campaignNameMapping, revenueMapping, platformMapping, needsPlatformStep]);

  const handleFieldMapping = (fieldId: string, columnIndex: number | null) => {
    setMappings(prev => {
      // Remove existing mapping for this field
      const filtered = prev.filter(m => m.targetFieldId !== fieldId);
      
      // Add new mapping if column selected
      if (columnIndex !== null) {
        const column = detectedColumns.find(c => c.index === columnIndex);
        const field = platformFields.find(f => f.id === fieldId);
        
        if (column && field) {
          filtered.push({
            sourceColumnIndex: column.index,
            sourceColumnName: column.originalName,
            targetFieldId: field.id,
            targetFieldName: field.name,
            matchType: 'manual',
            confidence: 1.0
          });
        }
      }
      
      return filtered;
    });
  };

  // Validation for LinkedIn conversion value: campaign_name + revenue + platform (if needed)
  const isMappingValid = 
    !!campaignNameMapping && 
    !!revenueMapping && 
    (!needsPlatformStep || !!platformMapping) &&
    validationErrors.size === 0;

  // Check conversion value calculation status
  const revenueMapping = mappings.find(m => m.targetFieldId === 'revenue');
  const conversionsMapping = mappings.find(m => m.targetFieldId === 'conversions');
  const revenueField = platformFields.find(f => f.id === 'revenue');
  const conversionsField = platformFields.find(f => f.id === 'conversions');
  const platformLower = platform.toLowerCase();
  const isLinkedIn = platformLower.includes('linkedin');
  
  // For LinkedIn: conversions come from API, only need revenue
  // For other platforms: may need both revenue and conversions
  const canCalculateConversionValue = isLinkedIn 
    ? revenueMapping !== undefined // LinkedIn has conversions from API
    : revenueMapping !== undefined && conversionsMapping !== undefined; // Other platforms need both

  if (columnsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-600">Detecting columns...</span>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Map Columns for Conversion Value Calculation
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Map your Google Sheets columns to calculate conversion value and unlock revenue metrics (ROI, ROAS, Revenue, Profit)
        </p>
      </div>

      {/* Step Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, needsPlatformStep ? 3 : null].filter(Boolean).map((step) => (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep === step
                ? 'bg-blue-600 border-blue-600 text-white'
                : currentStep > step
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-slate-100 border-slate-300 text-slate-500'
            }`}>
              {currentStep > step ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <span className="font-semibold">{step}</span>
              )}
            </div>
            {step < totalSteps && (
              <div className={`w-16 h-0.5 ${
                currentStep > step ? 'bg-green-600' : 'bg-slate-300'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Info Card - Only show when all steps are complete */}
      {isMappingValid && (
        <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                  ✓ All Required Fields Mapped
                </p>
                <p className="text-xs text-green-800 dark:text-green-300">
                  After saving, the system will calculate: <strong>Conversion Value = Revenue ÷ Conversions</strong>
                  <br />
                  LinkedIn provides conversions automatically from the API. Revenue metrics (ROI, ROAS, Revenue, Profit) will be unlocked.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step-by-Step Guided Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {currentStep === 1 && "Step 1: Select Campaign Name Column"}
            {currentStep === 2 && "Step 2: Select Revenue Column"}
            {currentStep === 3 && "Step 3: Select Platform Column"}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Which column identifies the campaign name? This is used to match rows with your LinkedIn campaigns."}
            {currentStep === 2 && "Which column contains the revenue data? This is required to calculate conversion value."}
            {currentStep === 3 && "Which column identifies LinkedIn as the source? This filters your data to LinkedIn rows only."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Campaign Name */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Select the column that contains campaign names. This will be used to match rows from Google Sheets with campaigns imported from LinkedIn API.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {detectedColumns.map((column) => {
                  const isSelected = campaignNameMapping?.sourceColumnIndex === column.index;
                  return (
                    <div
                      key={column.index}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-green-50 dark:bg-green-950/20 border-green-500"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => handleFieldMapping('campaign_name', column.index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {column.originalName}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {column.detectedType}
                            </Badge>
                            {isSelected && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                          {column.sampleValues.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Sample: {column.sampleValues.slice(0, 3).join(', ')}
                              {column.sampleValues.length > 3 && '...'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {campaignNameMapping && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setCurrentStep(2)}>
                    Next: Select Revenue Column →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Revenue */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Alert>
                <DollarSign className="w-4 h-4" />
                <AlertDescription>
                  Select the column that contains revenue data. This is required to calculate conversion value (Revenue ÷ Conversions). LinkedIn provides conversions automatically from the API.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {detectedColumns.map((column) => {
                  const isSelected = revenueMapping?.sourceColumnIndex === column.index;
                  const isCampaignName = campaignNameMapping?.sourceColumnIndex === column.index;
                  return (
                    <div
                      key={column.index}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-green-50 dark:bg-green-950/20 border-green-500"
                          : isCampaignName
                          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 opacity-60"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => !isCampaignName && handleFieldMapping('revenue', column.index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {column.originalName}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {column.detectedType}
                            </Badge>
                            {isSelected && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                            {isCampaignName && (
                              <Badge variant="default" className="text-xs bg-blue-600">
                                Campaign Name
                              </Badge>
                            )}
                          </div>
                          {column.sampleValues.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Sample: {column.sampleValues.slice(0, 3).join(', ')}
                              {column.sampleValues.length > 3 && '...'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  ← Back
                </Button>
                {revenueMapping && (
                  <Button onClick={() => {
                    if (needsPlatformStep) {
                      setCurrentStep(3);
                    }
                  }}>
                    {needsPlatformStep ? 'Next: Select Platform Column →' : 'All Steps Complete ✓'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Platform (only if multi-platform) */}
          {currentStep === 3 && needsPlatformStep && (
            <div className="space-y-4">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Your dataset contains data for multiple platforms. Select the column that identifies LinkedIn as the source. This will filter your data to LinkedIn rows only.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {detectedColumns.map((column) => {
                  const isSelected = platformMapping?.sourceColumnIndex === column.index;
                  const isCampaignName = campaignNameMapping?.sourceColumnIndex === column.index;
                  const isRevenue = revenueMapping?.sourceColumnIndex === column.index;
                  return (
                    <div
                      key={column.index}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-green-50 dark:bg-green-950/20 border-green-500"
                          : isCampaignName || isRevenue
                          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 opacity-60"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => !isCampaignName && !isRevenue && handleFieldMapping('platform', column.index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {column.originalName}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {column.detectedType}
                            </Badge>
                            {isSelected && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                            {isCampaignName && (
                              <Badge variant="default" className="text-xs bg-blue-600">
                                Campaign Name
                              </Badge>
                            )}
                            {isRevenue && (
                              <Badge variant="default" className="text-xs bg-blue-600">
                                Revenue
                              </Badge>
                            )}
                          </div>
                          {column.sampleValues.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Sample: {column.sampleValues.slice(0, 3).join(', ')}
                              {column.sampleValues.length > 3 && '...'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  ← Back
                </Button>
                {platformMapping && (
                  <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    All steps complete! Click "Save Mappings" below.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          {validationErrors.size > 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                {!campaignNameMapping && "Please select a Campaign Name column."}
                {!revenueMapping && " Please select a Revenue column."}
                {needsPlatformStep && !platformMapping && " Please select a Platform column."}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            onClick={() => saveMappingsMutation.mutate(mappings)}
            disabled={!isMappingValid || !connectionId || saveMappingsMutation.isPending}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            {saveMappingsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving & Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Save & Calculate Conversion Value
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Back to Campaign Overview Link - Only show after mappings are saved and conversion values exist */}
      {mappingsJustSaved && (
        <div className="mt-6 pt-4 border-t">
          {hasConversionValues ? (
            <>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-200 text-base mb-2">
                      ✓ Conversion Value Calculated Successfully!
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                      Revenue metrics (ROI, ROAS, Revenue, Profit) are now available in the LinkedIn Overview tab. The orange notification has been removed.
                    </p>
                    {sheetsData?.calculatedConversionValues && sheetsData.calculatedConversionValues.length > 0 && (
                      <div className="space-y-1 text-xs text-green-700 dark:text-green-400">
                        {sheetsData.calculatedConversionValues.map((cv: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Calculator className="w-3 h-3" />
                            <span>
                              <strong>{cv.platform}:</strong> ${cv.conversionValue} per conversion
                              {cv.revenue && cv.conversions && (
                                <span className="text-slate-600 dark:text-slate-400 ml-2">
                                  (${cv.revenue.toLocaleString()} revenue ÷ {cv.conversions.toLocaleString()} conversions)
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                className="w-full justify-center bg-green-600 hover:bg-green-700"
                size="lg"
                onClick={() => {
                  if (onCancel) onCancel();
                  setTimeout(() => {
                    window.location.href = `/campaigns/${campaignId}/linkedin-analytics?tab=overview`;
                  }, 100);
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign Overview
              </Button>
            </>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Calculating conversion values... This may take a few seconds.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


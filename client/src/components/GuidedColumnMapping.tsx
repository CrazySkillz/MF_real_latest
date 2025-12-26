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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, FileSpreadsheet, DollarSign, Target, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";

interface DetectedColumn {
  index: number;
  name: string;
  originalName: string;
  detectedType: string;
  confidence: number;
  sampleValues: any[];
  uniqueValues?: number;
  nullCount: number;
  sheets?: string[];
}

interface GuidedColumnMappingProps {
  campaignId: string;
  connectionId: string;
  connectionIds?: string[];
  sheetNames?: string[];
  spreadsheetId?: string;
  platform: string;
  onMappingComplete?: () => void;
  onCancel?: () => void;
}

type Step = 'detect' | 'campaign-name' | 'crosswalk' | 'revenue' | 'platform' | 'complete';

export function GuidedColumnMapping({
  campaignId,
  connectionId,
  connectionIds,
  sheetNames,
  spreadsheetId,
  platform,
  onMappingComplete,
  onCancel
}: GuidedColumnMappingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState<Step>('detect');
  // Identifier mapping target:
  // - campaign_name: the selected identifier column is treated as Campaign Name
  // - campaign_id: the selected identifier column is treated as Campaign ID
  const [identifierRoute, setIdentifierRoute] = useState<'campaign_name' | 'campaign_id'>('campaign_name');
  // Auto-detect identifierRoute from the selected column. Users can override.
  const [identifierRouteAuto, setIdentifierRouteAuto] = useState(true);
  const [selectedCampaignName, setSelectedCampaignName] = useState<string | null>(null);
  const [selectedRevenue, setSelectedRevenue] = useState<string | null>(null);
  const [selectedConversionValue, setSelectedConversionValue] = useState<string | null>(null);
  const [valueMode, setValueMode] = useState<'conversion_value' | 'revenue'>('revenue');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [skipPlatform, setSkipPlatform] = useState(false);
  const [selectedIdentifierValue, setSelectedIdentifierValue] = useState<string | null>(null);
  const effectiveSheetNames = sheetNames || [];

  const inferIdentifierRoute = (col?: DetectedColumn | null): 'campaign_name' | 'campaign_id' => {
    if (!col) return 'campaign_name';
    const detected = String(col.detectedType || '').toLowerCase();
    if (detected.includes('number') || detected.includes('int') || detected.includes('numeric')) {
      return 'campaign_id';
    }
    const samples = Array.isArray(col.sampleValues) ? col.sampleValues : [];
    const normalized = samples
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0)
      .slice(0, 20);
    if (normalized.some((v) => v.toLowerCase().includes('urn:li'))) {
      return 'campaign_id';
    }
    if (normalized.length > 0) {
      const numericLike = normalized.filter((v) => /^\d+$/.test(v)).length;
      const ratio = numericLike / normalized.length;
      if (ratio >= 0.6) return 'campaign_id';
    }
    return 'campaign_name';
  };

  // Reset crosswalk selection when identifier column or route changes
  useEffect(() => {
    setSelectedIdentifierValue(null);
  }, [identifierRoute, selectedCampaignName]);

  // CRITICAL DEBUG LOG
  console.log('====== GUIDED COLUMN MAPPING INIT ======');
  console.log('campaignId:', campaignId);
  console.log('connectionId:', connectionId);
  console.log('connectionIds:', connectionIds);
  console.log('sheetNames:', sheetNames);
  console.log('sheetNames length:', sheetNames?.length);
  console.log('spreadsheetId:', spreadsheetId);
  console.log('========================================');

  // Fetch detected columns
  const { data: columnsData, isLoading: columnsLoading, error: columnsError } = useQuery<{ success: boolean; columns: DetectedColumn[]; totalRows: number; sheetsAnalyzed?: number }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "detect-columns", effectiveSheetNames.join(',') || connectionIds?.join(',') || connectionId, spreadsheetId],
    queryFn: async () => {
      // Use sheetNames if provided (ONLY fetch columns from selected sheets)
      let queryParam = '';
      
      if (effectiveSheetNames && effectiveSheetNames.length > 0 && spreadsheetId) {
        // Fetch ONLY the selected sheet names
        queryParam = `?spreadsheetId=${spreadsheetId}&sheetNames=${encodeURIComponent(effectiveSheetNames.join(','))}`;
        console.log('[GuidedColumnMapping] 🎯 Fetching ONLY selected sheets:', effectiveSheetNames);
      } else if (connectionIds && connectionIds.length > 0) {
        // Use specific connection IDs if provided
        queryParam = `?connectionIds=${connectionIds.join(',')}`;
      } else if (connectionId) {
        // Fallback to single connection
        queryParam = `?connectionId=${connectionId}`;
      } else if (spreadsheetId) {
        // Last resort: Fetch ALL sheets from this spreadsheet (only when we truly don't know which tabs to scope to)
        queryParam = `?spreadsheetId=${spreadsheetId}&fetchAll=true`;
        console.log('[GuidedColumnMapping] 📊 Fetching ALL sheets from spreadsheet (no tab scope provided)');
      }
      
      console.log('[GuidedColumnMapping] 🔍 Fetching columns with:', {
        campaignId,
        connectionIds,
        connectionId,
        spreadsheetId,
        queryParam,
        fullUrl: `/api/campaigns/${campaignId}/google-sheets/detect-columns${queryParam}`
      });
      
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/detect-columns${queryParam}`);
      if (!response.ok) throw new Error('Failed to detect columns');
      const data = await response.json();
      
      console.log('[GuidedColumnMapping] ✅ Received columns:', {
        success: data.success,
        columnsCount: data.columns?.length,
        sheetsAnalyzed: data.sheetsAnalyzed,
        totalRows: data.totalRows,
        columnNames: data.columns?.map((c: any) => c.name)
      });
      
      return data;
    },
    enabled: !!campaignId && (!!spreadsheetId || !!connectionIds?.length || !!connectionId)
  });

  const detectedColumns = columnsData?.columns || [];
  const requestedSheets = (columnsData as any)?.sheetNamesRequested as string[] | undefined;
  const fetchedSheets = (columnsData as any)?.sheetNamesFetched as string[] | undefined;
  const failedSheets = (columnsData as any)?.sheetNamesFailed as Array<{ sheet: string; status?: number; statusText?: string }> | undefined;

  // Auto-detect identifierRoute whenever the selected identifier column changes (unless user overrides).
  useEffect(() => {
    if (!identifierRouteAuto) return;
    if (!selectedCampaignName) return;
    const col = detectedColumns.find((c) => c.index.toString() === selectedCampaignName);
    if (!col) return;
    setIdentifierRoute(inferIdentifierRoute(col));
  }, [identifierRouteAuto, selectedCampaignName, detectedColumns]);
  
  // Debug logging
  useEffect(() => {
    console.log('[GuidedColumnMapping] Columns data:', {
      columnsData,
      detectedColumns,
      columnsLength: detectedColumns.length,
      sheetsAnalyzed: columnsData?.sheetsAnalyzed
    });
  }, [columnsData, detectedColumns]);

  // Fetch campaign name for tip
  const { data: campaignData } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch campaign');
      return response.json();
    },
    enabled: !!campaignId
  });

  const campaignName = campaignData?.name || 'your campaign';

  const identifierColumn = selectedCampaignName
    ? detectedColumns.find(c => c.index.toString() === selectedCampaignName)
    : undefined;
  const identifierColumnName = identifierColumn?.originalName ? String(identifierColumn.originalName) : '';

  // Edit mode: load existing mappings and prefill the wizard
  const { data: existingMappingsData } = useQuery<{ success: boolean; mappings: any[]; hasMappings: boolean }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "mappings", connectionId],
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets/mappings?connectionId=${encodeURIComponent(connectionId)}`);
      if (!resp.ok) throw new Error('Failed to load existing mappings');
      return resp.json();
    },
    enabled: !!campaignId && !!connectionId,
    staleTime: 0,
  });

  const [hasPrefilled, setHasPrefilled] = useState(false);
  useEffect(() => {
    if (hasPrefilled) return;
    if (!existingMappingsData?.hasMappings) return;
    if (!Array.isArray(existingMappingsData.mappings)) return;
    if (detectedColumns.length === 0) return;

    const mappings = existingMappingsData.mappings;
    const findColumnChoice = (m: any): string | null => {
      const idx = m?.sourceColumnIndex ?? m?.columnIndex;
      if (typeof idx === 'number') {
        const hitByIndex = detectedColumns.find((c) => c.index === idx);
        if (hitByIndex) return hitByIndex.index.toString();
      }
      const name = String(m?.sourceColumnName || '').trim();
      if (name) {
        const hitByName = detectedColumns.find((c) => String(c.originalName || '').trim() === name);
        if (hitByName) return hitByName.index.toString();
      }
      return null;
    };

    const idMapping = mappings.find((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
    const nameMapping = mappings.find((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name');
    const revenueMapping = mappings.find((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
    const convValueMapping = mappings.find((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value');
    const platformMapping = mappings.find((m: any) => m?.targetFieldId === 'platform' || m?.platformField === 'platform');

    // Identifier route + column
    if (idMapping) {
      setIdentifierRoute('campaign_id');
      setIdentifierRouteAuto(false);
      const choice = findColumnChoice(idMapping);
      if (choice) setSelectedCampaignName(choice);
      const selected = String(idMapping?.selectedValue || '').trim();
      if (selected) setSelectedIdentifierValue(selected);
    } else if (nameMapping) {
      setIdentifierRoute('campaign_name');
      setIdentifierRouteAuto(false);
      const choice = findColumnChoice(nameMapping);
      if (choice) setSelectedCampaignName(choice);
      const selected = String(nameMapping?.selectedValue || '').trim();
      if (selected) setSelectedIdentifierValue(selected);
    }

    // Value source
    if (convValueMapping) {
      setValueMode('conversion_value');
      const choice = findColumnChoice(convValueMapping);
      if (choice) setSelectedConversionValue(choice);
    } else if (revenueMapping) {
      setValueMode('revenue');
      const choice = findColumnChoice(revenueMapping);
      if (choice) setSelectedRevenue(choice);
    }

    // Platform
    if (platformMapping) {
      const choice = findColumnChoice(platformMapping);
      if (choice) {
        setSkipPlatform(false);
        setSelectedPlatform(choice);
      }
    } else {
      setSkipPlatform(true);
      setSelectedPlatform(null);
    }

    // Start at first step when editing, with values prefilled
    setCurrentStep('campaign-name');
    setHasPrefilled(true);
  }, [hasPrefilled, existingMappingsData, detectedColumns]);

  const { data: uniqueValuesData, isLoading: uniqueValuesLoading, error: uniqueValuesError } = useQuery<{ success: boolean; values: string[]; truncated?: boolean; count?: number }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "unique-values", spreadsheetId, effectiveSheetNames.join(','), identifierColumnName],
    queryFn: async () => {
      const queryParam = `?spreadsheetId=${encodeURIComponent(spreadsheetId || '')}&sheetNames=${encodeURIComponent((effectiveSheetNames || []).join(','))}&columnName=${encodeURIComponent(identifierColumnName)}`;
      const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets/unique-values${queryParam}`);
      if (!resp.ok) throw new Error('Failed to fetch unique values');
      return resp.json();
    },
    enabled: !!campaignId && !!spreadsheetId && !!effectiveSheetNames?.length && !!identifierColumnName && currentStep === 'crosswalk',
  });

  // Auto-advance to first step when columns are detected
  useEffect(() => {
    if (detectedColumns.length > 0 && currentStep === 'detect') {
      setCurrentStep('campaign-name');
    }
  }, [detectedColumns.length, currentStep]);

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async (mappings: any[]) => {
      // If we have multiple connections (multiple sheets), save mappings to all of them
      const connectionsToUpdate = connectionIds && connectionIds.length > 0 ? connectionIds : [connectionId];
      
      console.log('[GuidedColumnMapping] 💾 Saving mappings to', connectionsToUpdate.length, 'connection(s)');
      console.log('[GuidedColumnMapping] Mappings being saved:', JSON.stringify(mappings, null, 2));
      console.log('[GuidedColumnMapping] Campaign ID:', campaignId);
      console.log('[GuidedColumnMapping] Connection IDs:', connectionsToUpdate);
      
      // Save to all connections
      const savePromises = connectionsToUpdate.map(async (connId) => {
        const requestBody = {
          connectionId: connId,
          mappings,
          platform,
          spreadsheetId, // Also send spreadsheetId as fallback
          sheetNames: effectiveSheetNames, // CRITICAL: selected tabs to use for mapping + calculation
        };
        
        console.log(`[GuidedColumnMapping] 📤 Sending save-mappings request for connection ${connId}:`, requestBody);
        
        const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/save-mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        console.log(`[GuidedColumnMapping] 📥 Response status: ${response.status} for connection ${connId}`);
        
        if (!response.ok) {
          const error = await response.json();
          console.error(`[GuidedColumnMapping] ❌ Failed to save mappings for connection ${connId}:`, error);
          throw new Error(error.error || 'Failed to save mappings');
        }
        
        const result = await response.json();
        console.log(`[GuidedColumnMapping] ✅ Save mappings response for ${connId}:`, result);
        return result;
      });
      
      const results = await Promise.all(savePromises);
      console.log('[GuidedColumnMapping] ✅ Saved mappings to all connections');
      
      // IMMEDIATELY trigger Google Sheets data fetch to calculate conversion value
      console.log('[GuidedColumnMapping] 🚀 Triggering conversion value calculation...');
      try {
        const sheetsResponse = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
        if (sheetsResponse.ok) {
          const sheetsData = await sheetsResponse.json();
          console.log('[GuidedColumnMapping] ✅ Conversion value calculated:', sheetsData.calculatedConversionValues);
        }
      } catch (calcError) {
        console.error('[GuidedColumnMapping] ⚠️ Conversion value calculation failed:', calcError);
      }
      
      return results[0]; // Return first result
    },
    onSuccess: async (data: any) => {
      console.log('[Guided Mapping] Save mappings response:', data);
      
      // Check if conversion value was calculated
      if (data.conversionValue) {
        console.log('[Guided Mapping] ✅ Conversion value calculated:', data.conversionValue);
        toast({
          title: "Mappings Saved!",
          description: `Conversion value calculated: $${data.conversionValue}`,
        });
      } else {
        console.warn('[Guided Mapping] ⚠️ No conversion value in response');
        toast({
          title: "Mappings Saved!",
          description: "Conversion value calculation may be in progress...",
        });
      }
      
      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] })
      ]);
      
      // Wait a bit for backend to fully process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Refetch the data to ensure it's up to date
      await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      await queryClient.refetchQueries({ queryKey: ["/api/linkedin/imports"] });
      
      setCurrentStep('complete');
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
          title: "Campaign Identifier Required",
          description: "Please select the column that uniquely identifies the campaign.",
          variant: "destructive"
        });
        return;
      }
      setCurrentStep('crosswalk');
    } else if (currentStep === 'crosswalk') {
      if (!selectedIdentifierValue) {
        toast({
          title: "Link Required",
          description: `Please select the ${identifierRoute === 'campaign_id' ? 'Campaign ID' : 'Campaign Name'} value that corresponds to "${campaignName}".`,
          variant: "destructive"
        });
        return;
      }
      setCurrentStep('revenue');
    } else if (currentStep === 'revenue') {
      if (valueMode === 'conversion_value') {
        if (!selectedConversionValue) {
          toast({
            title: "Conversion Value Column Required",
            description: "Please select a column that contains conversion value (value per conversion).",
            variant: "destructive"
          });
          return;
        }
      } else if (!selectedRevenue) {
        toast({
          title: "Revenue Column Required",
          description: "Please select a column that contains revenue data.",
          variant: "destructive"
        });
        return;
      }
      setCurrentStep('platform');
    } else if (currentStep === 'platform') {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep === 'revenue') {
      setCurrentStep('crosswalk');
    } else if (currentStep === 'crosswalk') {
      setCurrentStep('campaign-name');
    } else if (currentStep === 'platform') {
      setCurrentStep('revenue');
    }
  };

  const handleSave = () => {
    const mappings: any[] = [];
    
    // Identifier mapping (campaign_name OR campaign_id) + selected crosswalk value
    if (selectedCampaignName) {
      const identifierColumn = detectedColumns.find(c => c.index.toString() === selectedCampaignName);
      if (identifierColumn) {
        mappings.push({
          sourceColumnIndex: identifierColumn.index,
          sourceColumnName: identifierColumn.originalName,
          targetFieldId: identifierRoute === 'campaign_id' ? 'campaign_id' : 'campaign_name',
          targetFieldName: identifierRoute === 'campaign_id' ? 'Campaign ID' : 'Campaign Name',
          selectedValue: selectedIdentifierValue,
          matchType: 'manual',
          confidence: 1.0
        });
      }
    }

    // Value source mapping: conversion_value OR revenue
    if (valueMode === 'conversion_value' && selectedConversionValue) {
      const column = detectedColumns.find(c => c.index.toString() === selectedConversionValue);
      if (column) {
        mappings.push({
          sourceColumnIndex: column.index,
          sourceColumnName: column.originalName,
          targetFieldId: 'conversion_value',
          targetFieldName: 'Conversion Value',
          matchType: 'manual',
          confidence: 1.0
        });
      }
    } else if (valueMode === 'revenue' && selectedRevenue) {
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

  // Step indicator (no review; Save happens on the last step)
  const steps = [
    { id: 'campaign-name', label: 'Campaign Identifier', icon: Target },
    { id: 'crosswalk', label: 'Link Campaign', icon: Target },
    { id: 'revenue', label: 'Value Source', icon: DollarSign },
    { id: 'platform', label: 'LinkedIn Filter', icon: Filter },
  ] as Array<{ id: Step; label: string; icon: any }>;

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
              console.log('[Guided Mapping] 🚀 Back to Campaign Overview button clicked!');
              
              // Conversion value is calculated IMMEDIATELY in save-mappings endpoint
              // Just wait a moment for it to be saved, then verify and navigate
              
              // Step 1: Wait for conversion value to be saved to database
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Step 2: Get session ID and verify conversion value is available
              let sessionId: string | null = null;
              try {
                const platformsResponse = await fetch(`/api/campaigns/${campaignId}/connected-platforms`);
                if (platformsResponse.ok) {
                  const platforms = await platformsResponse.json();
                  const linkedInPlatform = platforms.find((p: any) => p.id === 'linkedin');
                  if (linkedInPlatform?.analyticsPath) {
                    const url = new URL(linkedInPlatform.analyticsPath, window.location.origin);
                    sessionId = url.searchParams.get('session');
                    console.log('[Guided Mapping] Found session ID:', sessionId);
                  }
                }
              } catch (error) {
                console.error('[Guided Mapping] Error getting session ID:', error);
              }
              
              // Step 3: Verify conversion value is available (poll up to 5 seconds)
              if (sessionId) {
                console.log('[Guided Mapping] 🔍 Verifying conversion value is available...');
                let attempts = 0;
                const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds max
                
                while (attempts < maxAttempts) {
                  try {
                    const importsResponse = await fetch(`/api/linkedin/imports/${sessionId}?t=${Date.now()}`);
                    if (importsResponse.ok) {
                      const importsData = await importsResponse.json();
                      if (importsData?.aggregated?.hasRevenueTracking === 1) {
                        console.log('[Guided Mapping] ✅ Conversion value verified! hasRevenueTracking = 1');
                        break;
                      }
                    }
                  } catch (error) {
                    console.error('[Guided Mapping] Error verifying conversion value:', error);
                  }
                  
                  attempts++;
                  if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }
              }
              
              // Step 4: Invalidate queries to ensure fresh data
              console.log('[Guided Mapping] 📊 Invalidating queries...');
              await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
              
              console.log('[Guided Mapping] 🎯 Calling onMappingComplete()');
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
                Select Campaign Identifier Column
              </>
            )}
            {currentStep === 'crosswalk' && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Link Campaign to Sheet Value
              </>
            )}
            {currentStep === 'revenue' && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                Select Conversion Value or Revenue Column
              </>
            )}
            {currentStep === 'platform' && (
              <>
                <Filter className="w-5 h-5 text-purple-600" />
                Select Platform Column (Optional)
              </>
            )}
          </CardTitle>
          <CardDescription>
            {currentStep === 'campaign-name' && (
              "Select the column that identifies your campaign across the selected tabs. We’ll automatically detect whether it’s a Campaign Name or Campaign ID."
            )}
            {currentStep === 'crosswalk' && (
              "Select the specific Campaign ID/Name value from your sheet that corresponds to this MetricMind campaign."
            )}
            {currentStep === 'revenue' && (
              "Which column contains conversion value (value per conversion)? If conversion value is not available, select the revenue column so we can calculate it."
            )}
            {currentStep === 'platform' && (
              "Which column identifies the platform (e.g., LinkedIn, Facebook, Google Ads)? This is optional if your entire sheet is for LinkedIn only."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign Name Step */}
          {currentStep === 'campaign-name' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Campaign Identifier Column
                </Label>
                <Select
                  value={selectedCampaignName || ""}
                  onValueChange={(v) => {
                    setIdentifierRouteAuto(true);
                    setSelectedCampaignName(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detectedColumns.map((column) => (
                      <SelectItem key={column.index} value={column.index.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{column.originalName}</span>
                          <div className="flex items-center gap-2 ml-2">
                            {column.sheets && column.sheets.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                {column.sheets.length} tabs
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {column.detectedType}
                            </Badge>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCampaignName && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Detected: {identifierRoute === 'campaign_id' ? 'Campaign ID' : 'Campaign Name'}
                  </Badge>
                  {!identifierRouteAuto && (
                    <Badge variant="outline">Manual override</Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setIdentifierRouteAuto(false);
                      setIdentifierRoute(identifierRoute === 'campaign_id' ? 'campaign_name' : 'campaign_id');
                    }}
                  >
                    Treat as {identifierRoute === 'campaign_id' ? 'Campaign Name' : 'Campaign ID'}
                  </Button>
                </div>
              )}
              {selectedCampaignName && (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Sample values:</strong> {detectedColumns.find(c => c.index.toString() === selectedCampaignName)?.sampleValues.slice(0, 3).join(', ') || 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      💡 <strong>Tip:</strong> Next, you’ll pick the specific value from this column that corresponds to <strong>{campaignName}</strong>.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Crosswalk Step */}
          {currentStep === 'crosswalk' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>MetricMind Campaign:</strong> {campaignName}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {identifierRoute === 'campaign_id'
                    ? 'Select the Campaign ID value for this campaign'
                    : 'Select the Campaign Name value for this campaign'}
                </Label>
                <Select value={selectedIdentifierValue || ""} onValueChange={setSelectedIdentifierValue}>
                  <SelectTrigger>
                    <SelectValue placeholder={uniqueValuesLoading ? "Loading values..." : "Select a value..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(uniqueValuesData?.values || []).map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uniqueValuesError && (
                  <p className="text-xs mt-2 text-amber-700 dark:text-amber-400">
                    Could not load values automatically. Please go back and reselect tabs/columns, or try again later.
                  </p>
                )}
                {uniqueValuesData?.truncated && (
                  <p className="text-xs mt-2 text-slate-500">
                    Showing the first {uniqueValuesData.values.length} values (list truncated).
                  </p>
                )}

                {/* Fallback: allow manual entry when values cannot be loaded or list is empty */}
                {(!uniqueValuesLoading && (uniqueValuesError || (uniqueValuesData && (uniqueValuesData.values || []).length === 0))) && (
                  <div className="mt-3">
                    <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Or enter a value manually
                    </Label>
                    <Input
                      value={selectedIdentifierValue || ""}
                      onChange={(e) => setSelectedIdentifierValue(e.target.value)}
                      placeholder={identifierRoute === 'campaign_id' ? "e.g., 301" : "e.g., my_campaign"}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revenue Step */}
          {currentStep === 'revenue' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={valueMode === 'conversion_value' ? "default" : "outline"}
                  onClick={() => {
                    setValueMode('conversion_value');
                    setSelectedRevenue(null);
                  }}
                  size="sm"
                >
                  Use Conversion Value
                </Button>
                <Button
                  type="button"
                  variant={valueMode === 'revenue' ? "default" : "outline"}
                  onClick={() => {
                    setValueMode('revenue');
                    setSelectedConversionValue(null);
                  }}
                  size="sm"
                >
                  Use Revenue (Calculate)
                </Button>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {valueMode === 'conversion_value' ? 'Conversion Value Column' : 'Revenue Column'}
                </Label>
                <Select
                  value={valueMode === 'conversion_value' ? (selectedConversionValue || "") : (selectedRevenue || "")}
                  onValueChange={(v) => {
                    if (valueMode === 'conversion_value') setSelectedConversionValue(v);
                    else setSelectedRevenue(v);
                  }}
                >
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
              {(valueMode === 'conversion_value' ? selectedConversionValue : selectedRevenue) && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-xs text-green-800 dark:text-green-300">
                    <strong>Sample values:</strong>{' '}
                    {detectedColumns
                      .find(c => c.index.toString() === (valueMode === 'conversion_value' ? selectedConversionValue : selectedRevenue))
                      ?.sampleValues.slice(0, 3)
                      .join(', ') || 'N/A'}
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
              {currentStep === 'platform' ? (
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



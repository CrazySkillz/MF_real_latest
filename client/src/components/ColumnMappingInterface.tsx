/**
 * Column Mapping Interface Component
 * Allows users to map uploaded columns to platform fields
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Star, Loader2 } from "lucide-react";
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
  platform: string;
  onMappingComplete?: () => void;
  onCancel?: () => void;
  isOpen?: boolean; // Only fetch data when dialog is open
}

export function ColumnMappingInterface({
  campaignId,
  connectionId,
  platform,
  onMappingComplete,
  onCancel
}: ColumnMappingInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Fetch platform fields
  const { data: platformFieldsData } = useQuery<{ success: boolean; fields: PlatformField[] }>({
    queryKey: ["/api/platforms", platform, "fields"],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/${platform}/fields`);
      if (!response.ok) throw new Error('Failed to fetch platform fields');
      return response.json();
    }
  });

  const platformFields = platformFieldsData?.fields || [];

  // Fetch detected columns
  const { data: columnsData, isLoading: columnsLoading } = useQuery<{ success: boolean; columns: DetectedColumn[]; totalRows: number }>({
    queryKey: ["/api/campaigns", campaignId, "google-sheets", "detect-columns"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets/detect-columns${connectionId ? `?spreadsheetId=${connectionId}` : ''}`);
      if (!response.ok) throw new Error('Failed to detect columns');
      return response.json();
    },
    enabled: !!campaignId
  });

  const detectedColumns = columnsData?.columns || [];

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
    onSuccess: () => {
      toast({
        title: "Mappings Saved",
        description: "Column mappings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets"] });
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

  // Auto-map on mount if columns are detected
  useEffect(() => {
    if (detectedColumns.length > 0 && mappings.length === 0 && !autoMapMutation.isPending && !columnsLoading) {
      autoMapMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedColumns.length, columnsLoading]);

  // Validate mappings
  useEffect(() => {
    if (platformFields.length === 0 || mappings.length === 0) {
      setValidationErrors(new Map());
      return;
    }

    const errors = new Map<string, string>();
    const requiredFields = platformFields.filter(f => f.required);
    
    // Check if all required fields are mapped
    for (const field of requiredFields) {
      const mapping = mappings.find(m => m.targetFieldId === field.id);
      if (!mapping) {
        errors.set(field.id, `Required field "${field.name}" is not mapped`);
      }
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
  }, [mappings, platformFields]);

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

  const isMappingValid = validationErrors.size === 0 && 
    platformFields.filter(f => f.required).every(f => 
      mappings.some(m => m.targetFieldId === f.id)
    );

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
          Map Columns to Platform Fields
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Map your Google Sheets columns to the required fields for {platform}
        </p>
      </div>

      {/* Detected Columns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Detected Columns ({detectedColumns.length})</CardTitle>
          <CardDescription>
            Columns found in your Google Sheet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {detectedColumns.map((column) => {
              const mapping = mappings.find(m => m.sourceColumnIndex === column.index);
              return (
                <div
                  key={column.index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    mapping
                      ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {column.originalName}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {column.detectedType}
                      </Badge>
                      {mapping && (
                        <Badge variant="default" className="text-xs bg-blue-600">
                          → {mapping.targetFieldName}
                        </Badge>
                      )}
                    </div>
                    {column.sampleValues.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Sample: {column.sampleValues.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Required Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            🎯 Required Fields ({platformFields.filter(f => f.required).length} required)
          </CardTitle>
          <CardDescription>
            Map columns to these platform fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platformFields.map((field) => {
              const mapping = mappings.find(m => m.targetFieldId === field.id);
              const error = validationErrors.get(field.id);
              
              return (
                <div
                  key={field.id}
                  className={`p-3 rounded-lg border ${
                    error
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : mapping
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : field.required
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {field.name}
                        </span>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {!field.required && (
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {field.type}
                        </Badge>
                        {mapping && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            {mapping.matchType === 'auto' ? 'Auto' : 'Manual'}
                          </Badge>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {field.description}
                        </p>
                      )}
                      {mapping && (
                        <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                          ✓ Mapped to: {mapping.sourceColumnName}
                          {mapping.confidence < 1.0 && (
                            <span className="text-xs ml-2">
                              ({Math.round(mapping.confidence * 100)}% confidence)
                            </span>
                          )}
                        </p>
                      )}
                      {error && (
                        <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                          ⚠️ {error}
                        </p>
                      )}
                    </div>
                    <Select
                      value={mapping ? mapping.sourceColumnIndex.toString() : ""}
                      onValueChange={(value) => {
                        handleFieldMapping(field.id, value === "" ? null : parseInt(value));
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- None --</SelectItem>
                        {detectedColumns.map((column) => {
                          const isUsed = mappings.some(m => 
                            m.sourceColumnIndex === column.index && m.targetFieldId !== field.id
                          );
                          return (
                            <SelectItem
                              key={column.index}
                              value={column.index.toString()}
                              disabled={isUsed}
                            >
                              {column.originalName}
                              {isUsed && " (already mapped)"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          {validationErrors.size > 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Please fix {validationErrors.size} mapping error{validationErrors.size > 1 ? 's' : ''} before saving.
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
            variant="outline"
            onClick={() => autoMapMutation.mutate()}
            disabled={autoMapMutation.isPending}
          >
            {autoMapMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Re-detecting...
              </>
            ) : (
              "🔄 Re-detect"
            )}
          </Button>
          <Button
            onClick={() => saveMappingsMutation.mutate(mappings)}
            disabled={!isMappingValid || !connectionId || saveMappingsMutation.isPending}
          >
            {saveMappingsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "✅ Save Mappings"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


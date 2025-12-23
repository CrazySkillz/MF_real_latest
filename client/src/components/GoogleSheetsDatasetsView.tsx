import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Star, Map, CheckCircle2, AlertCircle, ArrowLeft, Trash2, X } from "lucide-react";
import { ColumnMappingInterface } from "./ColumnMappingInterface";
import { GuidedColumnMapping } from "./GuidedColumnMapping";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface GoogleSheetsConnection {
  id: string;
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  columnMappings?: string | null;
  connectedAt?: string;
}

interface GoogleSheetsDatasetsViewProps {
  campaignId: string;
  connections: GoogleSheetsConnection[];
  onConnectionChange?: () => void;
  platform?: string;
}

// Component to show "Back to Campaign Overview" link after mappings are saved  
function BackToOverviewSection({ campaignId, onClose, onNavigate }: { campaignId: string; onClose: () => void; onNavigate?: () => void }) {
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  
  // Check if conversion values have been calculated (only once, no polling)
  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId && !hasCheckedOnce,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      const data = await response.json();
      setHasCheckedOnce(true);
      return data;
    },
    staleTime: Infinity, // Don't refetch
  });

  const hasConversionValues = sheetsData?.calculatedConversionValues && sheetsData.calculatedConversionValues.length > 0;

  // Always show the link, with appropriate message based on conversion values status
  return (
    <>
      {hasConversionValues ? (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-200 text-sm mb-1">
                Conversion Values Calculated!
              </p>
              <p className="text-xs text-green-800 dark:text-green-300">
                Revenue metrics are now available in the campaign overview.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-200 text-sm mb-1">
                Mappings Saved Successfully
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Conversion values will be calculated automatically. Check the campaign overview for revenue metrics.
              </p>
            </div>
          </div>
        </div>
      )}
      <Button
        variant="default"
        className="w-full justify-center"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Call the navigation callback if provided, otherwise close and navigate
          if (onNavigate) {
            onNavigate();
          } else {
            if (onClose) onClose();
            // IMPORTANT: LinkedIn analytics page requires `?session=...` to load data.
            // Preserve existing session param if present; otherwise fetch latest session for the campaign.
            const urlParams = new URLSearchParams(window.location.search);
            const existingSession = urlParams.get('session');
            if (existingSession) {
              window.location.href = `/campaigns/${campaignId}/linkedin-analytics?session=${encodeURIComponent(existingSession)}&tab=overview`;
              return;
            }

            // Fallback: fetch latest session and navigate with it
            fetch(`/api/linkedin/import-sessions/${campaignId}`)
              .then(async (resp) => {
                if (!resp.ok) return null;
                const sessions = await resp.json();
                const session = sessions?.[0]?.id || null;
                return session;
              })
              .then((session) => {
                window.location.href = session
                  ? `/campaigns/${campaignId}/linkedin-analytics?session=${encodeURIComponent(session)}&tab=overview`
                  : `/campaigns/${campaignId}/linkedin-analytics?tab=overview`;
              })
              .catch(() => {
                window.location.href = `/campaigns/${campaignId}/linkedin-analytics?tab=overview`;
              });
          }
        }}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Campaign Overview
      </Button>
    </>
  );
}

export function GoogleSheetsDatasetsView({
  campaignId,
  connections,
  onConnectionChange,
  platform = 'linkedin',
  onNavigateBack
}: GoogleSheetsDatasetsViewProps & { onNavigateBack?: () => void }) {
  const [mappingConnectionId, setMappingConnectionId] = useState<string | null>(null);
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [mappingsJustSaved, setMappingsJustSaved] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isMapped = (connection: GoogleSheetsConnection): boolean => {
    if (!connection.columnMappings) return false;
    try {
      const mappings = JSON.parse(connection.columnMappings);
      return Array.isArray(mappings) && mappings.length > 0;
    } catch {
      return false;
    }
  };

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/google-sheets/${campaignId}/connection?connectionId=${connectionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete connection');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"] });
      toast({
        title: "Connection Deleted",
        description: "Google Sheets connection has been removed successfully.",
      });
      if (onConnectionChange) {
        onConnectionChange();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Connection",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No Google Sheets datasets connected yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Connected Datasets ({connections.length})
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your Google Sheets connections and column mappings
        </p>
      </div>

      <div className="space-y-3">
        {connections.map((conn) => {
          const mapped = isMapped(conn);
          return (
            <Card
              key={conn.id}
              className={`${
                mapped
                  ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-900 dark:text-white truncate">
                          {conn.spreadsheetName || `Sheet ${conn.spreadsheetId.slice(0, 8)}...`}
                        </h4>
                        {conn.isPrimary && (
                          <Badge variant="default" className="text-xs bg-blue-600">
                            <Star className="w-3 h-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                        {mapped ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Mapped
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Not Mapped
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {conn.spreadsheetId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={mapped ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        setMappingConnectionId(conn.id);
                        setShowMappingInterface(true);
                      }}
                    >
                      <Map className="w-4 h-4 mr-1" />
                      {mapped ? "Edit Mapping" : "Map"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                          title="Delete connection"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Google Sheet Connection?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the connection to "{conn.spreadsheetName || conn.spreadsheetId}".
                            {conn.isPrimary && connections.length > 1 && " Another sheet will be set as primary."}
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteConnectionMutation.mutate(conn.id)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteConnectionMutation.isPending}
                          >
                            {deleteConnectionMutation.isPending ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Column Mapping Interface Dialog */}
      <Dialog open={showMappingInterface} onOpenChange={setShowMappingInterface}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Map Columns</DialogTitle>
            <DialogDescription>
              Follow the guided steps to map your campaign identifier, revenue column, and optional platform filter.
            </DialogDescription>
          </DialogHeader>
          {showMappingInterface && mappingConnectionId && (() => {
            const selectedConnection = connections.find(c => c.id === mappingConnectionId);
            const spreadsheetId = selectedConnection?.spreadsheetId;
            const sheetName = selectedConnection?.sheetName;

            // For the LinkedIn flow, prefer the guided wizard UX.
            // Keep the classic mapper as a fallback for other platforms or missing spreadsheetId.
            if (platform === 'linkedin' && spreadsheetId) {
              return (
                <GuidedColumnMapping
                  campaignId={campaignId}
                  connectionId={mappingConnectionId}
                  spreadsheetId={spreadsheetId}
                  sheetNames={sheetName ? [sheetName] : undefined}
                  platform={platform}
                  onMappingComplete={() => {
                    setShowMappingInterface(false);
                    setMappingConnectionId(null);
                    setMappingsJustSaved(true);
                    if (onConnectionChange) onConnectionChange();
                  }}
                  onCancel={() => {
                    setShowMappingInterface(false);
                    setMappingConnectionId(null);
                    setMappingsJustSaved(false);
                  }}
                />
              );
            }

            return (
              <ColumnMappingInterface
                campaignId={campaignId}
                connectionId={mappingConnectionId}
                spreadsheetId={spreadsheetId}
                platform={platform}
                onMappingComplete={() => {
                  // Close dialog and go back to datasets view
                  setShowMappingInterface(false);
                  setMappingConnectionId(null);
                  // Mark that mappings were just saved to show the link
                  setMappingsJustSaved(true);
                  if (onConnectionChange) {
                    onConnectionChange();
                  }
                }}
                onCancel={() => {
                  setShowMappingInterface(false);
                  setMappingConnectionId(null);
                  setMappingsJustSaved(false);
                }}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Back to Campaign Overview Link - Show after mappings saved, in the main view */}
      {mappingsJustSaved && (
        <div className="mt-6 pt-4 border-t">
          <BackToOverviewSection 
            campaignId={campaignId} 
            onClose={() => {
              setMappingsJustSaved(false);
            }}
            onNavigate={onNavigateBack}
          />
        </div>
      )}
    </div>
  );
}

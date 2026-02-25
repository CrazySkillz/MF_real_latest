import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSpreadsheet, Star, Map, CheckCircle2, AlertCircle, ArrowLeft, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { ColumnMappingInterface } from "./ColumnMappingInterface";
import { GuidedColumnMapping } from "./GuidedColumnMapping";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn', icon: 'fab fa-linkedin', color: 'text-blue-700' },
  { id: 'facebook_ads', label: 'Meta / Facebook', icon: 'fab fa-facebook', color: 'text-blue-600' },
  { id: 'google_ads', label: 'Google Ads', icon: 'fab fa-google', color: 'text-red-500' },
  { id: 'ga4', label: 'Google Analytics (GA4)', icon: 'fas fa-chart-line', color: 'text-orange-500' },
  { id: 'twitter_ads', label: 'Twitter / X', icon: 'fab fa-twitter', color: 'text-blue-400' },
  { id: 'tiktok_ads', label: 'TikTok', icon: 'fab fa-tiktok', color: 'text-slate-800' },
  { id: 'other', label: 'Other', icon: 'fas fa-globe', color: 'text-slate-500' },
] as const;

interface GoogleSheetsConnection {
  id: string;
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  columnMappings?: string | null;
  platforms?: string | null;
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
            // IMPORTANT: LinkedIn analytics page requires `?session=...` to load data.
            // Preserve existing session param if present; otherwise fetch latest session for the campaign.
            const urlParams = new URLSearchParams(window.location.search);
            const existingSession = urlParams.get('session');
            if (existingSession) {
              window.location.replace(`/campaigns/${campaignId}/linkedin-analytics?session=${encodeURIComponent(existingSession)}&tab=overview`);
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
                window.location.replace(session
                  ? `/campaigns/${campaignId}/linkedin-analytics?session=${encodeURIComponent(session)}&tab=overview`
                  : `/campaigns/${campaignId}/linkedin-analytics?tab=overview`);
              })
              .catch(() => {
                window.location.replace(`/campaigns/${campaignId}/linkedin-analytics?tab=overview`);
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

  // Platform update mutation
  const updatePlatformsMutation = useMutation({
    mutationFn: async ({ connectionId, platforms }: { connectionId: string; platforms: string[] }) => {
      const response = await fetch(`/api/google-sheets/${campaignId}/connection/${connectionId}/platforms`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update platforms');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
    },
  });

  const [expandedPlatformId, setExpandedPlatformId] = useState<string | null>(null);

  const getConnectionPlatforms = (conn: GoogleSheetsConnection): string[] => {
    if (!conn.platforms) return [];
    try {
      const parsed = JSON.parse(conn.platforms);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const togglePlatform = (conn: GoogleSheetsConnection, platformId: string) => {
    const current = getConnectionPlatforms(conn);
    const next = current.includes(platformId)
      ? current.filter(p => p !== platformId)
      : [...current, platformId];
    updatePlatformsMutation.mutate({ connectionId: conn.id, platforms: next });
  };

  const visibleConnections = connections.filter((c) => c?.spreadsheetId && c.spreadsheetId !== 'pending');

  if (visibleConnections.length === 0) {
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
          Connected Datasets ({visibleConnections.length})
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your Google Sheets connections and column mappings
        </p>
      </div>

      <div className="space-y-3">
        {visibleConnections.map((conn) => {
          const mapped = isMapped(conn);
          const platforms = getConnectionPlatforms(conn);
          const isPlatformExpanded = expandedPlatformId === conn.id;
          return (
            <Card
              key={conn.id}
              className={`${mapped
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
                      {/* Platform badges */}
                      {platforms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {platforms.map(pid => {
                            const opt = PLATFORM_OPTIONS.find(p => p.id === pid);
                            return opt ? (
                              <Badge key={pid} variant="outline" className="text-[10px] px-1.5 py-0">
                                {opt.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPlatformId(isPlatformExpanded ? null : conn.id)}
                      title="Select platforms in this sheet"
                    >
                      {isPlatformExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="ml-1 text-xs">Platforms</span>
                    </Button>
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

                {/* Platform selector (expandable) */}
                {isPlatformExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                      Which platforms does this sheet contain data for?
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PLATFORM_OPTIONS.map(opt => {
                        const checked = platforms.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                              checked
                                ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePlatform(conn, opt.id)}
                            />
                            <span className={`text-xs ${checked ? 'font-medium' : ''}`}>
                              {opt.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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

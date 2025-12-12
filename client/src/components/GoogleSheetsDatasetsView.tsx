import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Star, Map, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { ColumnMappingInterface } from "./ColumnMappingInterface";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

interface GoogleSheetsConnection {
  id: string;
  spreadsheetId: string;
  spreadsheetName: string;
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
function BackToOverviewSection({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  // Check if conversion values have been calculated
  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const hasConversionValues = sheetsData?.calculatedConversionValues && sheetsData.calculatedConversionValues.length > 0;

  // Always show the link after mappings are saved, with appropriate message
  if (!hasConversionValues) {
    return (
      <>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-200 text-sm mb-1">
                Calculating conversion values...
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Conversion values are being calculated. You can go to the Overview tab to check revenue metrics.
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="default"
          className="w-full justify-center"
          onClick={() => {
            window.location.href = `/campaigns/${campaignId}/linkedin-analytics?tab=overview`;
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaign Overview
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-200 text-sm mb-1">
              Conversion Values Calculated!
            </p>
            <p className="text-xs text-green-800 dark:text-green-300">
              Revenue metrics are now available in the Overview tab.
            </p>
          </div>
        </div>
      </div>
      <Button
        variant="default"
        className="w-full justify-center"
        onClick={() => {
          window.location.href = `/campaigns/${campaignId}/linkedin-analytics?tab=overview`;
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
  platform = 'linkedin'
}: GoogleSheetsDatasetsViewProps) {
  const [mappingConnectionId, setMappingConnectionId] = useState<string | null>(null);
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [mappingsJustSaved, setMappingsJustSaved] = useState(false);

  const isMapped = (connection: GoogleSheetsConnection): boolean => {
    if (!connection.columnMappings) return false;
    try {
      const mappings = JSON.parse(connection.columnMappings);
      return Array.isArray(mappings) && mappings.length > 0;
    } catch {
      return false;
    }
  };

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
            <DialogTitle>Configure Column Mapping</DialogTitle>
            <DialogDescription>
              Map your Google Sheets columns to platform fields for accurate data processing.
            </DialogDescription>
          </DialogHeader>
          {showMappingInterface && mappingConnectionId && (
            <ColumnMappingInterface
              campaignId={campaignId}
              connectionId={mappingConnectionId}
              platform={platform}
              onMappingComplete={() => {
                // Don't close dialog immediately - wait for conversion values
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
          )}

          {/* Back to Campaign Overview Link - Show after mappings saved */}
          {mappingsJustSaved && (
            <div className="mt-4 pt-4 border-t">
              <BackToOverviewSection campaignId={campaignId} onClose={() => {
                setShowMappingInterface(false);
                setMappingConnectionId(null);
                setMappingsJustSaved(false);
              }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


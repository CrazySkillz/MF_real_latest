import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Building2, ShoppingCart, Code, Upload, CheckCircle2, Map, ArrowLeft } from "lucide-react";
import { SimpleGoogleSheetsAuth } from "./SimpleGoogleSheetsAuth";
import { GoogleSheetsDatasetsView } from "./GoogleSheetsDatasetsView";
import { GuidedColumnMapping } from "./GuidedColumnMapping";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface UploadAdditionalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  returnUrl?: string;
  onDataConnected?: () => void;
  googleSheetsOnly?: boolean; // If true, skip source selection and go directly to Google Sheets
}

type DataSourceType = 'google-sheets' | 'crm' | 'ecommerce' | 'custom-integration' | 'upload-file' | null;

export function UploadAdditionalDataModal({
  isOpen,
  onClose,
  campaignId,
  returnUrl,
  onDataConnected,
  googleSheetsOnly = false
}: UploadAdditionalDataModalProps) {
  const [selectedSource, setSelectedSource] = useState<DataSourceType>(googleSheetsOnly ? 'google-sheets' : null);
  const [showDatasetsView, setShowDatasetsView] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [showGuidedMapping, setShowGuidedMapping] = useState(false);
  const [newConnectionInfo, setNewConnectionInfo] = useState<{ connectionId: string; spreadsheetId: string; connectionIds?: string[]; sheetNames?: string[] } | null>(null);
  const { toast } = useToast();
  
  // Store the ACTUAL current URL when modal opens - this is where we came from
  const [originalReturnUrl] = useState(() => {
    if (returnUrl) {
      console.log('[Modal Init] Using provided returnUrl:', returnUrl);
      return returnUrl;
    }
    // Fallback: use current window location
    const currentUrl = window.location.pathname + window.location.search;
    console.log('[Modal Init] Using current URL as returnUrl:', currentUrl);
    return currentUrl;
  });
  const [originalCampaignId] = useState(campaignId);

  // Fetch Google Sheets connections
  const { data: googleSheetsConnections = [], refetch: refetchConnections } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"],
    enabled: isOpen && !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.connections || [];
    },
  });

  // Reset states when modal closes or source changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSource(null);
      setShowDatasetsView(false);
      setJustConnected(false);
      setShowGuidedMapping(false);
      setNewConnectionInfo(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedSource !== 'google-sheets') {
      setShowDatasetsView(false);
      setJustConnected(false);
    } else if (selectedSource === 'google-sheets' && googleSheetsConnections.length > 0 && !justConnected) {
      // If user has existing connections, show datasets view immediately
      setShowDatasetsView(true);
    }
  }, [selectedSource, googleSheetsConnections.length, justConnected]);

  const handleSourceSelect = (source: DataSourceType) => {
    setSelectedSource(source);
  };

  const handleGoogleSheetsSuccess = (connectionInfo?: { connectionId: string; spreadsheetId: string; connectionIds?: string[]; sheetNames?: string[] }) => {
    if (connectionInfo) {
      if (googleSheetsOnly) {
        // For Google Sheets only mode (from Connection Details), skip mapping and just connect
        const sheetsCount = connectionInfo.connectionIds?.length || 1;
        toast({
          title: "Google Sheet Connected!",
          description: `${sheetsCount} sheet${sheetsCount > 1 ? 's have' : ' has'} been added and ${sheetsCount > 1 ? 'are' : 'is'} now available in the dropdown.`,
        });
        refetchConnections();
        if (onDataConnected) {
          onDataConnected();
        }
        // Close modal after a short delay to show the toast
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // For LinkedIn conversion value flow, show guided mapping for the first connection
        setNewConnectionInfo(connectionInfo);
        setShowGuidedMapping(true);
        setJustConnected(false);
      }
    } else {
      // Existing connection or no connection info - show datasets view
    toast({
      title: "Google Sheets Connected!",
      description: "Your spreadsheet has been connected successfully.",
    });
    refetchConnections();
    if (onDataConnected) {
      onDataConnected();
    }
    setJustConnected(true);
    }
  };

  const handleGoogleSheetsError = (error: string) => {
    toast({
      title: "Connection Failed",
      description: error,
      variant: "destructive"
    });
  };

  const handleComingSoon = (sourceName: string) => {
    toast({
      title: "Coming Soon",
      description: `${sourceName} integration will be available soon.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{googleSheetsOnly ? 'Add Google Sheets Dataset' : 'Connect Additional Data'}</DialogTitle>
          <DialogDescription>
            {googleSheetsOnly ? 'Connect a Google Sheet or tab to add it to your campaign.' : 'Connect data sources to unlock revenue metrics including ROI, ROAS, Revenue, and Profit.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedSource && !googleSheetsOnly ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Google Sheets */}
            <Card 
              className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              onClick={() => handleSourceSelect('google-sheets')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  Connect Google Sheets
                </CardTitle>
                <CardDescription>
                  Import campaign data from Google Sheets
                </CardDescription>
              </CardHeader>
            </Card>

            {/* CRM */}
            <Card 
              className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              onClick={() => handleComingSoon('CRM (HubSpot / Salesforce)')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Connect CRM
                </CardTitle>
                <CardDescription>
                  HubSpot / Salesforce integration
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Ecommerce */}
            <Card 
              className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              onClick={() => handleComingSoon('Ecommerce (Shopify / Stripe)')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="w-5 h-5 text-purple-600" />
                  Connect Ecommerce
                </CardTitle>
                <CardDescription>
                  Shopify / Stripe integration
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Custom Integration */}
            <Card 
              className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              onClick={() => handleSourceSelect('custom-integration')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Code className="w-5 h-5 text-orange-600" />
                  Connect Custom Integration
                </CardTitle>
                <CardDescription>
                  Webhook or API integration
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Upload File */}
            <Card 
              className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all md:col-span-2"
              onClick={() => handleComingSoon('File Upload')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5 text-slate-600" />
                  Upload File
                </CardTitle>
                <CardDescription>
                  Upload CSV or Excel files directly
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : selectedSource === 'google-sheets' ? (
          <div className="mt-4 space-y-6">
            {!googleSheetsOnly && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedSource(null);
                setShowDatasetsView(false);
                setJustConnected(false);
              }}
              className="mb-4"
            >
              ← Back to Options
            </Button>
            )}

            {/* Show guided mapping for new connections (only for LinkedIn conversion value flow, not googleSheetsOnly) */}
            {showGuidedMapping && newConnectionInfo && !googleSheetsOnly ? (
              (() => {
                // Prefer explicit selected tab names for scoping column detection (most reliable when DB lacks sheet_name).
                // Use server-provided sheetNames; fall back to what we persisted at selection time.
                let effectiveSheetNames: string[] | undefined = newConnectionInfo.sheetNames;
                if (!effectiveSheetNames || effectiveSheetNames.length === 0) {
                  try {
                    const raw = localStorage.getItem(`mm:selectedSheetNames:${originalCampaignId}:${newConnectionInfo.spreadsheetId}`);
                    const parsed = raw ? JSON.parse(raw) : null;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      effectiveSheetNames = parsed;
                    }
                  } catch {
                    // ignore
                  }
                }

                return (
              <GuidedColumnMapping
                campaignId={originalCampaignId}
                connectionId={newConnectionInfo.connectionId}
                connectionIds={newConnectionInfo.connectionIds}
                spreadsheetId={newConnectionInfo.spreadsheetId}
                sheetNames={effectiveSheetNames}
                platform="linkedin"
                onMappingComplete={() => {
                  console.log('[UploadAdditionalDataModal] onMappingComplete called');
                  console.log('[UploadAdditionalDataModal] originalReturnUrl:', originalReturnUrl);
                  
                  setShowGuidedMapping(false);
                  setNewConnectionInfo(null);
                  
                  // Close modal immediately
                  onClose();
                  
                  // Ensure URL includes tab=overview for LinkedIn Analytics page
                  let targetUrl = originalReturnUrl;
                  if (targetUrl.includes('/linkedin-analytics') && !targetUrl.includes('tab=')) {
                    targetUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'tab=overview';
                  }
                  
                  console.log('[UploadAdditionalDataModal] 🔄 FULL PAGE RELOAD to:', targetUrl);
                  
                  // Do a FULL page reload to ensure fresh data from server
                  setTimeout(() => {
                    window.location.href = targetUrl;
                    // Force reload to bypass any cache
                    setTimeout(() => {
                      window.location.reload();
                    }, 100);
                  }, 300);
                }}
                onCancel={() => {
                  setShowGuidedMapping(false);
                  setNewConnectionInfo(null);
                  refetchConnections();
                  setShowDatasetsView(true);
                }}
              />
                );
              })()
            ) : showDatasetsView || (!justConnected && googleSheetsConnections.length > 0) ? (
              <>
                {/* Show connected datasets */}
                {googleSheetsConnections.length > 0 && (
                  <GoogleSheetsDatasetsView
                    campaignId={originalCampaignId}
                    connections={googleSheetsConnections}
                    onConnectionChange={() => {
                      refetchConnections();
                      if (onDataConnected) {
                        onDataConnected();
                      }
                    }}
                    platform="linkedin"
                    onNavigateBack={() => {
                      // Trigger data refresh BEFORE navigating back
                      if (onDataConnected) {
                        onDataConnected();
                      }
                      // Close modal
                      onClose();
                      // Wait for backend to process data, then do a FULL page reload to ensure fresh data
                      setTimeout(() => {
                        console.log('[UploadAdditionalDataModal] Reloading page:', originalReturnUrl);
                        window.location.href = originalReturnUrl;
                      }, 500);
                    }}
                  />
                )}

                {/* Google Sheets Connection Interface */}
                <SimpleGoogleSheetsAuth
                  campaignId={campaignId}
                  onSuccess={handleGoogleSheetsSuccess}
                  onError={handleGoogleSheetsError}
                />
              </>
            ) : (
              /* Show connection interface initially */
              <>
                {/* Google Sheets Connection Interface */}
                <SimpleGoogleSheetsAuth
                  campaignId={campaignId}
                  onSuccess={handleGoogleSheetsSuccess}
                  onError={handleGoogleSheetsError}
                />

                {/* Show "Next" button after successful connection */}
                {justConnected && !showDatasetsView && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => {
                        setShowDatasetsView(true);
                        setJustConnected(false);
                      }}
                      size="lg"
                      className="w-full max-w-md"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : selectedSource === 'custom-integration' ? (
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedSource(null)}
              className="mb-4"
            >
              ← Back to Options
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>Custom Integration</CardTitle>
                <CardDescription>
                  Set up webhook or API integration for your custom data source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Navigate to the campaign detail page to set up custom integrations via webhooks or API connections.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    window.location.href = `/campaigns/${campaignId}`;
                  }}
                >
                  Go to Campaign Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}


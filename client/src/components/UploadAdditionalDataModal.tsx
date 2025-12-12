import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Building2, ShoppingCart, Code, Upload, CheckCircle2, Map, Lightbulb, DollarSign } from "lucide-react";
import { SimpleGoogleSheetsAuth } from "./SimpleGoogleSheetsAuth";
import { GoogleSheetsDatasetsView } from "./GoogleSheetsDatasetsView";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface UploadAdditionalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onDataConnected?: () => void;
}

type DataSourceType = 'google-sheets' | 'crm' | 'ecommerce' | 'custom-integration' | 'upload-file' | null;

export function UploadAdditionalDataModal({
  isOpen,
  onClose,
  campaignId,
  onDataConnected
}: UploadAdditionalDataModalProps) {
  const [selectedSource, setSelectedSource] = useState<DataSourceType>(null);
  const [showDatasetsView, setShowDatasetsView] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const { toast } = useToast();

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

  const handleGoogleSheetsSuccess = () => {
    toast({
      title: "Google Sheets Connected!",
      description: "Your spreadsheet has been connected successfully.",
    });
    refetchConnections();
    if (onDataConnected) {
      onDataConnected();
    }
    // Show "Next" button after successful connection
    setJustConnected(true);
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
          <DialogTitle>Upload Additional Data</DialogTitle>
          <DialogDescription>
            Connect data sources to unlock revenue metrics including ROI, ROAS, Revenue, and Profit.
          </DialogDescription>
        </DialogHeader>

        {!selectedSource ? (
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

            {/* Show datasets view and connection interface after clicking Next or if already viewing */}
            {showDatasetsView || (!justConnected && googleSheetsConnections.length > 0) ? (
              <>
                {/* Conversion Value Calculation Info */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                      To calculate conversion value and unlock ROI, ROAS, Revenue, and Profit:
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-3 ml-4 list-disc">
                      <li>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                          Your Google Sheet should include:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default" className="bg-green-600">
                            ✓ Revenue column (required for conversion value)
                          </Badge>
                          <Badge variant="default" className="bg-green-600">
                            ✓ Campaign Name column (to match with LinkedIn campaigns)
                          </Badge>
                          <Badge variant="secondary">
                            Date column (optional, for time-based matching)
                          </Badge>
                        </div>
                      </li>
                      <li>Map a <strong>"Revenue"</strong> column (e.g., Deal Value, Sales, Total Revenue)</li>
                      <li>System will calculate: <strong>Conversion Value = Revenue ÷ Conversions</strong></li>
                    </ul>
                  </CardContent>
                </Card>
                
                {/* Show connected datasets */}
                {googleSheetsConnections.length > 0 && (
                  <GoogleSheetsDatasetsView
                    campaignId={campaignId}
                    connections={googleSheetsConnections}
                    onConnectionChange={() => {
                      refetchConnections();
                      if (onDataConnected) {
                        onDataConnected();
                      }
                    }}
                    platform="linkedin"
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
                {/* Conversion Value Calculation Info */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                      To calculate conversion value and unlock ROI, ROAS, Revenue, and Profit:
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-3 ml-4 list-disc">
                      <li>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                          Your Google Sheet should include:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default" className="bg-green-600">
                            ✓ Revenue column (required for conversion value)
                          </Badge>
                          <Badge variant="default" className="bg-green-600">
                            ✓ Campaign Name column (to match with LinkedIn campaigns)
                          </Badge>
                          <Badge variant="secondary">
                            Date column (optional, for time-based matching)
                          </Badge>
                        </div>
                      </li>
                      <li>Map a <strong>"Revenue"</strong> column (e.g., Deal Value, Sales, Total Revenue)</li>
                      <li>System will calculate: <strong>Conversion Value = Revenue ÷ Conversions</strong></li>
                    </ul>
                  </CardContent>
                </Card>

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


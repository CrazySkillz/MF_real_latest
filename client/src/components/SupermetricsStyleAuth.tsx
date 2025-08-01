import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";
import { CheckCircle, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SupermetricsStyleAuthProps {
  campaignId: string;
  propertyId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function SupermetricsStyleAuth({ campaignId, propertyId, onSuccess, onError }: SupermetricsStyleAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [currentPropertyId, setCurrentPropertyId] = useState(propertyId);
  const { toast } = useToast();

  // Service account email that users need to add to their GA4 property
  const serviceAccountEmail = "marketpulse-analytics@your-project.iam.gserviceaccount.com";

  const handleConnect = async () => {
    if (!currentPropertyId) {
      onError("Property ID is required");
      return;
    }

    setIsConnecting(true);

    try {
      const response = await apiRequest("POST", "/api/auth/google/service-account-connect", {
        campaignId,
        propertyId: currentPropertyId
      });

      const data = await response.json();

      if (data.success) {
        setHasConnection(true);
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected using service account authentication",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      console.error('Service account connection error:', error);
      if (error.message.includes("403") || error.message.includes("permission")) {
        setShowInstructions(true);
        onError("Access denied. Please follow the setup instructions below to grant access.");
      } else {
        onError(error.message || "Failed to connect to Google Analytics");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Service account email copied",
    });
  };

  if (hasConnection) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Google Analytics Connected</p>
              <p className="text-sm">Property: {currentPropertyId}</p>
              <p className="text-sm">Method: Service Account (Enterprise)</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setHasConnection(false);
              }}
            >
              Reconnect
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiGoogle className="w-5 h-5 text-blue-600" />
          Connect Google Analytics (Supermetrics Style)
        </CardTitle>
        <CardDescription>
          Enterprise-grade service account authentication - same method used by Supermetrics
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Professional Service Account Method</strong></p>
              <p>This method provides permanent access to your Google Analytics data without requiring your personal credentials.</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sa-property-id">GA4 Property ID</Label>
            <Input
              id="sa-property-id"
              placeholder="e.g., 123456789"
              value={currentPropertyId}
              onChange={(e) => setCurrentPropertyId(e.target.value)}
            />
            <div className="text-xs text-slate-500">
              Find this in Google Analytics → Admin → Property Settings
            </div>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={isConnecting || !currentPropertyId}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              "Connecting..."
            ) : (
              <>
                <SiGoogle className="w-4 h-4 mr-2" />
                Connect Google Analytics
              </>
            )}
          </Button>
        </div>

        {showInstructions && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="space-y-3">
                <p className="font-medium">Setup Required (One-time only)</p>
                <p>To complete the connection, add our service account to your GA4 property:</p>
                
                <div className="bg-white dark:bg-slate-800 p-3 rounded border">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono">{serviceAccountEmail}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(serviceAccountEmail)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="text-sm space-y-2">
                  <p><strong>Steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to Google Analytics → Admin → Property Access Management</li>
                    <li>Click "+" to add a user</li>
                    <li>Paste the service account email above</li>
                    <li>Select "Viewer" role</li>
                    <li>Click "Add"</li>
                    <li>Return here and click "Connect Google Analytics" again</li>
                  </ol>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://analytics.google.com/", "_blank")}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Google Analytics
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Why Service Account Authentication?</h4>
          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <li>• <strong>Enterprise Security:</strong> Same method used by Supermetrics, Funnel, and other professional platforms</li>
            <li>• <strong>No Personal Credentials:</strong> Never requires your Google password</li>
            <li>• <strong>Permanent Access:</strong> Never expires, no re-authentication needed</li>
            <li>• <strong>Real-time Data:</strong> Direct access to authentic Google Analytics metrics</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
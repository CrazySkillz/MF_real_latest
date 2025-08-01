import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface IntegratedGA4AuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function IntegratedGA4Auth({ campaignId, onSuccess, onError }: IntegratedGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);

    try {
      // Start the integrated OAuth flow
      console.log("Starting integrated Google Analytics connection...");
      const response = await apiRequest("POST", "/api/auth/google/integrated-connect", {
        campaignId,
        propertyId: propertyId || undefined
      });

      const data = await response.json();
      console.log("Auth response:", data);

      if (data.authUrl) {
        console.log("Opening popup with URL:", data.authUrl);
        
        // Add a small delay to ensure the URL is fully processed
        setTimeout(() => {
          try {
            // Open OAuth flow in popup with more permissive settings
            const popup = window.open(
              data.authUrl,
              'google-auth',
              'width=500,height=700,scrollbars=yes,resizable=yes,location=yes,status=yes,menubar=no,toolbar=no'
            );
            
            console.log("Popup opened for URL:", data.authUrl);

            if (!popup) {
              setIsConnecting(false);
              onError("Popup was blocked. Please allow popups for this site and try again.");
              return;
            }

            // Add error handling for popup
            popup.onerror = () => {
              console.error("Popup error occurred");
              setIsConnecting(false);
              onError("Failed to open authentication window. Please try again.");
            };

            // Listen for completion and messages from popup
            const handlePopupMessage = (event) => {
              if (event.origin !== window.location.origin) return;
              
              if (event.data?.type === 'auth_success') {
                clearInterval(checkClosed);
                popup.close();
                checkConnectionStatus();
              } else if (event.data?.type === 'auth_error') {
                clearInterval(checkClosed);
                popup.close();
                setIsConnecting(false);
                onError(event.data.error || "Authentication failed");
              }
            };
            
            window.addEventListener('message', handlePopupMessage);

            const checkClosed = setInterval(() => {
              try {
                if (popup?.closed) {
                  clearInterval(checkClosed);
                  window.removeEventListener('message', handlePopupMessage);
                  // Check if connection was successful
                  checkConnectionStatus();
                }
              } catch (error) {
                console.error("Error checking popup status:", error);
                clearInterval(checkClosed);
                window.removeEventListener('message', handlePopupMessage);
                setIsConnecting(false);
                onError("Authentication window error. Please try again.");
              }
            }, 1000);

            // Timeout after 5 minutes
            setTimeout(() => {
              clearInterval(checkClosed);
              if (popup && !popup.closed) {
                popup.close();
                setIsConnecting(false);
                onError("Authentication timeout. Please try again.");
              }
            }, 300000);
          } catch (error) {
            console.error("Error opening popup:", error);
            setIsConnecting(false);
            onError("Failed to open authentication window. Please try again.");
          }
        }, 100);

      } else if (data.success) {
        setHasConnection(true);
        setConnectionInfo(data);
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected and ready to pull real-time metrics",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      console.error('Integrated GA4 connection error:', error);
      onError(error.message || "Failed to connect to Google Analytics");
      setIsConnecting(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ga4-connection-status`);
      const data = await response.json();

      if (data.connected) {
        setHasConnection(true);
        setConnectionInfo(data);
        toast({
          title: "Google Analytics Connected",
          description: data.isRealOAuth 
            ? "Real Google Analytics API connected successfully" 
            : "Demo mode - realistic simulation data",
        });
        onSuccess();
      } else {
        onError("Authentication was not completed. Please try again.");
      }
    } catch (error) {
      onError("Failed to verify connection status");
    } finally {
      setIsConnecting(false);
    }
  };

  const testMetrics = async () => {
    try {
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ga4-metrics`);
      const data = await response.json();
      
      toast({
        title: "Metrics Retrieved",
        description: `Sessions: ${data.sessions}, Pageviews: ${data.pageviews}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retrieve metrics",
        variant: "destructive"
      });
    }
  };

  if (hasConnection) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Google Analytics Connected</p>
              <p className="text-sm">Property: {connectionInfo?.propertyId}</p>
              <p className="text-sm">Real-time metrics enabled</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={testMetrics}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Test Metrics
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setHasConnection(false);
                  setConnectionInfo(null);
                }}
              >
                Reconnect
              </Button>
            </div>
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
          Connect Google Analytics
        </CardTitle>
        <CardDescription>
          Integrated authentication with real-time metrics from your GA4 property
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Secure OAuth Integration</strong></p>
              <p>Connect directly through Google's secure authentication to access your real Google Analytics data.</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property-id">GA4 Property ID (Optional)</Label>
            <Input
              id="property-id"
              placeholder="e.g., 123456789 (leave blank to select after auth)"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            />
            <div className="text-xs text-slate-500">
              Find this in Google Analytics → Admin → Property Settings
            </div>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <SiGoogle className="w-4 h-4 mr-2" />
                Connect Google Analytics
              </>
            )}
          </Button>

          {isConnecting && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Opening authentication window... Connecting to Google Analytics for real-time metrics.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium text-sm mb-2">How it works:</h4>
          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <li>• <strong>Secure OAuth:</strong> Standard Google authentication flow</li>
            <li>• <strong>Real-time Access:</strong> Direct connection to Google Analytics Data API</li>
            <li>• <strong>Live Metrics:</strong> Sessions, pageviews, conversions, and more</li>
            <li>• <strong>Automatic Refresh:</strong> Tokens renewed automatically</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";
import { AlertCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface IntegratedGA4AuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function IntegratedGA4Auth({ campaignId, onSuccess, onError }: IntegratedGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const cleanupPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    const handlePopupMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "auth_success") {
        setAuthCompleted(true);
        cleanupPopup();
        onSuccess();
      } else if (event.data?.type === "auth_error") {
        cleanupPopup();
        onError(event.data.error || "Authentication failed");
      }
    };

    window.addEventListener("message", handlePopupMessage);
    return () => {
      window.removeEventListener("message", handlePopupMessage);
    };
  }, [cleanupPopup, onError, onSuccess]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        cleanupPopup();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cleanupPopup]);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ga4-connection-status`);
      const data = await response.json();

      if (data.connected) {
        setAuthCompleted(true);
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to verify connection status:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [campaignId, onSuccess]);

  const startOAuthFlow = useCallback(async () => {
    setIsConnecting(true);
    setAuthCompleted(false);

    try {
      const response = await apiRequest("POST", "/api/auth/google/integrated-connect", {
        campaignId,
      });

      const data = await response.json();

      if (!data.authUrl) {
        throw new Error(data.message || "Failed to start authentication");
      }

      const popup = window.open(
        data.authUrl,
        "google-auth",
        "width=500,height=700,scrollbars=yes,resizable=yes,location=yes,status=yes,menubar=no,toolbar=no"
      );

      if (!popup) {
        setIsConnecting(false);
        onError("Popup was blocked. Please allow popups and try again.");
        return;
      }

      popupRef.current = popup;

      setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          checkConnectionStatus();
        }
      }, 3000);
    } catch (error: any) {
      console.error("Integrated GA4 connection error:", error);
      cleanupPopup();
      onError(error?.message || "Failed to connect to Google Analytics");
    }
  }, [campaignId, checkConnectionStatus, cleanupPopup, onError]);

  return (
    <Card className="w-full border border-slate-200">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2">
          <SiGoogle className="w-5 h-5 text-blue-600" />
          Connect Google Analytics 4
        </CardTitle>
        <CardDescription>
          Sign in with Google to enable real-time GA4 metrics for this campaign.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Secure Google Sign-In</p>
            <p className="text-sm">
              Click connect to launch Google’s authentication window. After signing in you’ll pick the GA4 property.
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Button
            onClick={startOAuthFlow}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Waiting for Google...
              </>
            ) : (
              <>
                <SiGoogle className="w-4 h-4 mr-2" />
                Connect Google Analytics
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-xs text-slate-500 text-center">
              We opened a Google sign-in window. Complete the login to continue.
            </p>
          )}

          {authCompleted && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Authentication successful. Please choose your GA4 property to finish connecting.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
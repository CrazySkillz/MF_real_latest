import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiGoogleanalytics } from "react-icons/si";
import { AlertCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface IntegratedGA4AuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  connectionMode?: "oauth" | "service-account";
}

export function IntegratedGA4Auth({ campaignId, onSuccess, onError, connectionMode = "service-account" }: IntegratedGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isServiceAccountConnecting, setIsServiceAccountConnecting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [serviceAccountStatus, setServiceAccountStatus] = useState<{ enabled: boolean; email: string | null }>({ enabled: false, email: null });
  const [serviceAccountStatusLoaded, setServiceAccountStatusLoaded] = useState(false);
  const [showServiceAccountFlow, setShowServiceAccountFlow] = useState(false);
  const [serviceAccountPropertyId, setServiceAccountPropertyId] = useState("");
  const popupRef = useRef<Window | null>(null);

  const cleanupPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setIsConnecting(false);
  }, []);

  // IMPORTANT: define this before any useEffect dependency arrays reference it,
  // otherwise we can trigger a TDZ runtime error in production builds.
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

  useEffect(() => {
    if (!campaignId) return;
    setServiceAccountStatusLoaded(false);
    setShowServiceAccountFlow(false);
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/ga4-service-account/status`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => setServiceAccountStatus({ enabled: data?.enabled === true, email: data?.email || null }))
      .catch(() => setServiceAccountStatus({ enabled: false, email: null }))
      .finally(() => setServiceAccountStatusLoaded(true));
  }, [campaignId]);

  useEffect(() => {
    const handlePopupMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "ga4_auth_success" || event.data?.type === "auth_success") {
        setAuthCompleted(true);
        cleanupPopup();
        onSuccess();
      } else if (event.data?.type === "ga4_auth_error" || event.data?.type === "auth_error") {
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
        // If the popup was closed without a postMessage, do a final status check.
        // This preserves a fallback path while preventing the property selector from
        // appearing before the user actually finishes OAuth.
        popupRef.current = null;
        if (!authCompleted) {
          void checkConnectionStatus();
        } else {
          cleanupPopup();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cleanupPopup, checkConnectionStatus, authCompleted]);

  const startOAuthFlow = useCallback(async () => {
    setIsConnecting(true);
    setAuthCompleted(false);

    try {
      const response = await apiRequest("POST", "/api/auth/ga4/connect", {
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
      // Do not call checkConnectionStatus while the popup is still open.
      // We rely on postMessage for the happy path, and on the "popup closed" handler for fallback.
    } catch (error: any) {
      console.error("Integrated GA4 connection error:", error);
      cleanupPopup();
      onError(error?.message || "Failed to connect to Google Analytics");
    }
  }, [campaignId, checkConnectionStatus, cleanupPopup, onError]);

  const connectWithServiceAccount = useCallback(async () => {
    const propertyId = serviceAccountPropertyId.trim().replace(/^properties\//i, "");
    if (!/^\d+$/.test(propertyId)) {
      onError("Enter the numeric GA4 Property ID.");
      return;
    }
    setIsServiceAccountConnecting(true);
    try {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/ga4-service-account/connect`, {
        propertyId,
        lookbackDays: 30,
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) throw new Error(data?.message || "Google Analytics connection failed");
      onSuccess();
    } catch (error: any) {
      onError(error?.message || "Google Analytics connection failed");
    } finally {
      setIsServiceAccountConnecting(false);
    }
  }, [campaignId, onError, onSuccess, serviceAccountPropertyId]);

  return (
    <Card className="w-full border border-border">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2">
          <SiGoogleanalytics className="w-5 h-5 text-orange-500" />
          Connect Google Analytics
        </CardTitle>
        {connectionMode === "oauth" && (
          <CardDescription>Sign in with Google to connect your GA4 property.</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {connectionMode === "oauth" && (<>
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
                <SiGoogleanalytics className="w-4 h-4 mr-2" />
                Connect Google Analytics
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-xs text-muted-foreground text-center">
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
        </>)}

        {connectionMode === "service-account" && (!showServiceAccountFlow ? (
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!serviceAccountStatusLoaded}
            onClick={() => {
              if (!serviceAccountStatus.enabled) {
                onError("Google Analytics service connection is not available.");
                return;
              }
              setShowServiceAccountFlow(true);
            }}
          >
            <SiGoogleanalytics className="w-4 h-4 mr-2" />
            Connect Google Analytics
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add {serviceAccountStatus.email} as a Viewer in Google Analytics, then enter the numeric GA4 Property ID.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ga4-service-account-property">GA4 Property ID</Label>
              <Input
                id="ga4-service-account-property"
                inputMode="numeric"
                placeholder="123456789"
                value={serviceAccountPropertyId}
                onChange={(event) => setServiceAccountPropertyId(event.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={connectWithServiceAccount}
              disabled={isServiceAccountConnecting || !serviceAccountPropertyId.trim()}
            >
              {isServiceAccountConnecting ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Validating property...</>
              ) : "Connect Google Analytics"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

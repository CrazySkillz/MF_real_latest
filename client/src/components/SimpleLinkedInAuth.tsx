import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SiLinkedin } from "react-icons/si";
import { AlertCircle, RefreshCw, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SimpleLinkedInAuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

interface AdAccount {
  id: string;
  name: string;
}

export function SimpleLinkedInAuth({ campaignId, onSuccess, onError }: SimpleLinkedInAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const { toast } = useToast();

  const cleanupPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setIsConnecting(false);
  }, []);

  const fetchAdAccounts = useCallback(async (token: string) => {
    try {
      const response = await apiRequest("POST", `/api/linkedin/ad-accounts`, {
        accessToken: token,
      });
      const data = await response.json();
      if (data.adAccounts) {
        setAdAccounts(data.adAccounts);
        if (data.adAccounts.length > 0) {
          setSelectedAdAccount(data.adAccounts[0].id);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch ad accounts:", error);
      onError(error.message || "Failed to fetch ad accounts");
    }
  }, [onError]);

  useEffect(() => {
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "linkedin_auth_success") {
        const { accessToken: token } = event.data;
        setAccessToken(token);
        setAuthCompleted(true);
        cleanupPopup();
        await fetchAdAccounts(token);
      } else if (event.data?.type === "linkedin_auth_error") {
        cleanupPopup();
        onError(event.data.error || "Authentication failed");
      }
    };

    window.addEventListener("message", handlePopupMessage);
    return () => {
      window.removeEventListener("message", handlePopupMessage);
    };
  }, [cleanupPopup, onError, fetchAdAccounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        cleanupPopup();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cleanupPopup]);

  const startOAuthFlow = useCallback(async () => {
    setIsConnecting(true);
    setAuthCompleted(false);
    setAdAccounts([]);
    setSelectedAdAccount('');
    setAccessToken('');

    try {
      const response = await apiRequest("POST", "/api/auth/linkedin/connect", {
        campaignId,
      });

      const data = await response.json();

      if (!data.authUrl) {
        throw new Error(data.message || "Failed to start authentication");
      }

      const popup = window.open(
        data.authUrl,
        "linkedin-auth",
        "width=500,height=700,scrollbars=yes,resizable=yes,location=yes,status=yes,menubar=no,toolbar=no"
      );

      if (!popup) {
        setIsConnecting(false);
        onError("Popup was blocked. Please allow popups and try again.");
        return;
      }

      popupRef.current = popup;
    } catch (error: any) {
      console.error("Simple LinkedIn connection error:", error);
      cleanupPopup();
      onError(error?.message || "Failed to connect to LinkedIn");
    }
  }, [campaignId, cleanupPopup, onError]);

  const handleSelectAdAccount = useCallback(async () => {
    if (!selectedAdAccount) {
      onError("Please select an ad account.");
      return;
    }
    try {
      await apiRequest("POST", `/api/linkedin/${campaignId}/select-ad-account`, {
        adAccountId: selectedAdAccount,
        accessToken,
      });
      toast({
        title: "LinkedIn Connected!",
        description: "Your LinkedIn Ads account is now connected to this campaign."
      });
      onSuccess();
    } catch (error: any) {
      console.error("Failed to select ad account:", error);
      onError(error.message || "Failed to connect selected ad account");
    }
  }, [campaignId, selectedAdAccount, accessToken, onSuccess, onError, toast]);

  if (authCompleted && adAccounts.length > 0) {
    return (
      <Card className="w-full border border-slate-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Select LinkedIn Ad Account
          </CardTitle>
          <CardDescription>
            Choose which LinkedIn Ads account to connect for campaign data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Available Ad Accounts</Label>
            <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an ad account..." />
              </SelectTrigger>
              <SelectContent>
                {adAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSelectAdAccount} disabled={!selectedAdAccount} className="w-full" size="lg">
            Connect Ad Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (authCompleted && adAccounts.length === 0) {
    return (
      <Card className="w-full border border-slate-200">
        <CardContent className="text-center py-8">
          <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
          <p className="text-slate-600 dark:text-slate-400">No ad accounts found in your LinkedIn profile.</p>
          <Button variant="outline" onClick={startOAuthFlow} className="mt-4">
            Try Reconnecting
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border border-slate-200">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2">
          <SiLinkedin className="w-5 h-5 text-blue-600" />
          Connect LinkedIn Ads
        </CardTitle>
        <CardDescription>
          Sign in with LinkedIn to import campaign data and metrics from your LinkedIn Ads account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Secure LinkedIn Sign-In</p>
            <p className="text-sm">
              Click connect to launch LinkedIn's authentication window. After signing in you'll pick your ad account.
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
                Waiting for LinkedIn...
              </>
            ) : (
              <>
                <SiLinkedin className="w-4 h-4 mr-2" />
                Connect LinkedIn Ads
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-xs text-slate-500 text-center">
              We opened a LinkedIn sign-in window. Complete the login to continue.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


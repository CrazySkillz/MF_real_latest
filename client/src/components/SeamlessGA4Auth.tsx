import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SiGoogle } from "react-icons/si";
import { CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SeamlessGA4AuthProps {
  campaignId: string;
  propertyId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function SeamlessGA4Auth({ campaignId, propertyId, onSuccess, onError }: SeamlessGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const { toast } = useToast();

  const handleSeamlessAuth = async () => {
    if (!propertyId) {
      onError("Property ID is required");
      return;
    }

    setIsConnecting(true);

    try {
      // Check if Google OAuth is configured on the server
      const authUrlResponse = await apiRequest("GET", `/api/auth/google/url?campaignId=${campaignId}&propertyId=${propertyId}`);
      
      if (authUrlResponse.ok) {
        const { authUrl } = await authUrlResponse.json();
        
        // Redirect to Google OAuth - this will handle refresh tokens automatically
        window.location.href = authUrl;
      } else {
        // Fallback to manual token method if OAuth not configured
        setHasCredentials(false);
        onError("Server-side OAuth not configured. Please use manual token method.");
      }
    } catch (error) {
      console.error('Seamless auth error:', error);
      onError("Failed to initiate authentication. Please try manual method.");
    } finally {
      setIsConnecting(false);
    }
  };

  const checkExistingAuth = async () => {
    try {
      // Check if this campaign already has valid tokens
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ga4-metrics`);
      
      if (response.ok) {
        setHasCredentials(true);
        onSuccess();
        return true;
      }
    } catch (error) {
      // No existing auth, that's fine
    }
    return false;
  };

  // Check for existing auth on component mount
  useState(() => {
    checkExistingAuth();
  });

  if (hasCredentials) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <div className="flex items-center justify-between">
            <span>Google Analytics is connected and authenticated</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setHasCredentials(false);
                handleSeamlessAuth();
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
    <div className="space-y-4">
      <Alert>
        <SiGoogle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-3">
            <p><strong>Production-Ready Authentication</strong></p>
            <p>This method uses OAuth 2.0 with refresh tokens for seamless, long-term access to your Google Analytics data. No need to re-authenticate every hour!</p>
            
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p><strong>Benefits:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Automatic token refresh - never expires</li>
                <li>Secure server-side credential storage</li>
                <li>No manual token copying required</li>
                <li>Production-ready for real applications</li>
              </ul>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Button 
        onClick={handleSeamlessAuth} 
        disabled={isConnecting || !propertyId}
        className="w-full"
        size="lg"
      >
        {isConnecting ? (
          "Connecting..."
        ) : (
          <>
            <SiGoogle className="w-4 h-4 mr-2" />
            Connect with Google (Seamless Auth)
            <ExternalLink className="w-3 h-3 ml-2" />
          </>
        )}
      </Button>
      
      <div className="text-xs text-slate-500 text-center">
        You'll be redirected to Google to authorize access, then automatically returned here
      </div>
    </div>
  );
}
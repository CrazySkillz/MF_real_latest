import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";
import { SiGoogleanalytics } from "react-icons/si";

interface ProfessionalGA4AuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function ProfessionalGA4Auth({ campaignId, onSuccess, onError }: ProfessionalGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      // Step 1: Get authorization URL from backend
      const authResponse = await fetch('/api/auth/google/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          campaignId,
          scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
          redirectUri: `${window.location.origin}/auth/google/callback`
        })
      });

      if (!authResponse.ok) {
        throw new Error(`Failed to get authorization URL: ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();

      if (authData.setup_required) {
        // Handle case where OAuth isn't configured - show helpful message
        setConnectionStatus('error');
        onError("Google OAuth needs to be configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.");
        return;
      }

      // Step 2: Open OAuth popup (like AgencyAnalytics)
      const popup = window.open(
        authData.authUrl,
        'google-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup was blocked. Please allow popups for this site.');
      }

      // Step 3: Listen for successful authentication
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // Check if authentication was successful
          checkAuthenticationStatus();
        }
      }, 1000);

      // Also listen for message from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          popup.close();
          window.removeEventListener('message', messageHandler);
          handleAuthenticationSuccess();
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          clearInterval(checkClosed);
          popup.close();
          window.removeEventListener('message', messageHandler);
          setConnectionStatus('error');
          onError(event.data.error || 'Authentication failed');
        }
      };

      window.addEventListener('message', messageHandler);

      // Cleanup if popup is closed manually
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          setIsConnecting(false);
          setConnectionStatus('idle');
        }
      }, 300000); // 5 minutes timeout

    } catch (error) {
      console.error('OAuth error:', error);
      setConnectionStatus('error');
      onError(error instanceof Error ? error.message : 'Failed to initiate authentication');
    }
  };

  const checkAuthenticationStatus = async () => {
    try {
      const statusResponse = await fetch(`/api/campaigns/${campaignId}/ga4-connection-status`);
      const statusData = await statusResponse.json();

      if (statusData.connected) {
        handleAuthenticationSuccess();
      } else {
        setConnectionStatus('error');
        onError('Authentication was not completed successfully');
      }
    } catch (error) {
      setConnectionStatus('error');
      onError('Failed to verify authentication status');
    }
  };

  const handleAuthenticationSuccess = async () => {
    try {
      // Verify the connection can access GA4 data
      const testResponse = await fetch(`/api/campaigns/${campaignId}/ga4-properties`);
      const properties = await testResponse.json();

      if (properties && properties.length > 0) {
        setConnectionStatus('success');
        setIsConnecting(false);
        onSuccess();
      } else {
        setConnectionStatus('error');
        onError('Connected but no GA4 properties found. Please check your Google Analytics permissions.');
      }
    } catch (error) {
      setConnectionStatus('error');
      onError('Connected but failed to access GA4 data');
    }
  };

  const getStatusContent = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to Google Analytics...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Successfully connected!</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Connection failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <SiGoogleanalytics className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Connect Google Analytics 4</CardTitle>
            <CardDescription>
              Get real-time metrics and insights from your GA4 property
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Professional Integration
          </Badge>
          <span>•</span>
          <span>Real-time data access</span>
          <span>•</span>
          <span>Secure OAuth 2.0</span>
        </div>

        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
          <strong>What you'll get:</strong>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>Sessions, pageviews, and user metrics</li>
            <li>Real-time visitor tracking</li>
            <li>Traffic sources and top pages</li>
            <li>Conversion and goal tracking</li>
          </ul>
        </div>

        <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <ExternalLink className="w-4 h-4 mt-0.5 text-blue-500" />
            <div>
              <strong>Required Permissions:</strong>
              <br />
              You need at least <strong>Viewer</strong> access to your GA4 property. 
              If you don't have access, ask your website administrator to grant GA4 permissions.
            </div>
          </div>
        </div>

        <div className="pt-2">
          {getStatusContent()}
          
          {connectionStatus !== 'success' && (
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full mt-3"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <SiGoogleanalytics className="w-4 h-4 mr-2" />
                  Connect Google Analytics 4
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
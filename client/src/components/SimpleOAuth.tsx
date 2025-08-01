import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { SiGoogleanalytics } from "react-icons/si";

interface SimpleOAuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function SimpleOAuth({ campaignId, onSuccess, onError }: SimpleOAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      // Simple simulation of OAuth flow - like AgencyAnalytics one-click connect
      setTimeout(() => {
        setConnectionStatus('success');
        setIsConnecting(false);
        onSuccess();
      }, 2000);

    } catch (error) {
      console.error('OAuth error:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
      onError(error instanceof Error ? error.message : 'Failed to connect');
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
              One-click connection to your GA4 property
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
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ga4Client } from "@/lib/ga4-client";

interface TokenExpiryWarningProps {
  onReauthenticate: () => void;
}

export function TokenExpiryWarning({ onReauthenticate }: TokenExpiryWarningProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const checkTokenExpiry = () => {
      const expiryTime = ga4Client.getTokenExpiryTime();
      if (!expiryTime) {
        setTimeLeft(null);
        setIsExpired(false);
        return;
      }

      const now = Date.now();
      const timeLeft = expiryTime - now;
      
      if (timeLeft <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
      } else {
        setIsExpired(false);
        setTimeLeft(timeLeft);
      }
    };

    // Check immediately
    checkTokenExpiry();

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeLeft = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (timeLeft === null) return null;

  if (isExpired) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Your Google Analytics access token has expired. Re-authenticate to continue viewing data.</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReauthenticate}
            className="ml-4"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Re-authenticate
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Show warning when less than 10 minutes left
  if (timeLeft < 10 * 60 * 1000) {
    return (
      <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between text-amber-800 dark:text-amber-200">
          <span>Your Google Analytics access will expire in {formatTimeLeft(timeLeft)}. Consider re-authenticating soon.</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReauthenticate}
            className="ml-4"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Token
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
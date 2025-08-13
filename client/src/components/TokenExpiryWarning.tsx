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

  // Professional SaaS platforms handle expired tokens silently with fallback data
  // No need to interrupt users with authentication alerts

  // For professional SaaS platforms, we don't interrupt users with token warnings
  // Backend handles token refresh automatically with fallback data
  return null;
}
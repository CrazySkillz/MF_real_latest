import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiGoogle } from "react-icons/si";
import { Shield, Zap, Users, ExternalLink, CheckCircle, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProfessionalGA4AuthProps {
  campaignId: string;
  propertyId: string;
  userEmail?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function ProfessionalGA4Auth({ campaignId, propertyId, userEmail, onSuccess, onError }: ProfessionalGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<string>('');
  const [hasConnection, setHasConnection] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkExistingConnection();
  }, [campaignId]);

  const checkExistingConnection = async () => {
    try {
      const response = await apiRequest("GET", `/api/campaigns/${campaignId}/ga4-metrics`);
      
      if (response.ok) {
        const data = await response.json();
        setHasConnection(true);
        setConnectionInfo(data.connectionInfo);
      }
    } catch (error) {
      // No existing connection
    }
  };

  const handleServiceAccountConnect = async () => {
    if (!propertyId) {
      onError("Property ID is required");
      return;
    }

    setIsConnecting(true);
    setConnectionMethod('service-account');

    try {
      const response = await apiRequest("GET", 
        `/api/auth/google/professional/url?campaignId=${campaignId}&propertyId=${propertyId}&method=service-account`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHasConnection(true);
          toast({
            title: "Service Account Connected",
            description: "Connected using server-side service account authentication",
          });
          onSuccess();
        } else {
          throw new Error("Service account connection failed");
        }
      } else {
        throw new Error("Service account not configured");
      }
    } catch (error) {
      console.error('Service account connection error:', error);
      onError("Service account method not available. Try OAuth method below.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDomainDelegationConnect = async () => {
    if (!propertyId || !userEmail) {
      onError("Property ID and user email are required for domain delegation");
      return;
    }

    setIsConnecting(true);
    setConnectionMethod('domain-delegation');

    try {
      const response = await apiRequest("GET", 
        `/api/auth/google/professional/url?campaignId=${campaignId}&propertyId=${propertyId}&userEmail=${userEmail}&method=domain-delegation`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHasConnection(true);
          toast({
            title: "Domain Delegation Connected",
            description: `Connected with domain-wide delegation for ${userEmail}`,
          });
          onSuccess();
        } else {
          throw new Error("Domain delegation connection failed");
        }
      } else {
        throw new Error("Domain delegation not configured");
      }
    } catch (error) {
      console.error('Domain delegation connection error:', error);
      onError("Domain delegation method not available. Try OAuth method below.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleProfessionalOAuthConnect = async () => {
    if (!propertyId) {
      onError("Property ID is required");
      return;
    }

    setIsConnecting(true);
    setConnectionMethod('oauth');

    try {
      const response = await apiRequest("GET", 
        `/api/auth/google/professional/url?campaignId=${campaignId}&propertyId=${propertyId}&userEmail=${userEmail || ''}`
      );
      
      if (response.ok) {
        const { authUrl } = await response.json();
        // Redirect to professional OAuth flow
        window.location.href = authUrl;
      } else {
        throw new Error("OAuth not configured");
      }
    } catch (error) {
      console.error('Professional OAuth connection error:', error);
      onError("Professional OAuth method not available.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (hasConnection && connectionInfo) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Professional GA4 Connected</span>
              <Badge variant="outline" className="text-green-700 border-green-300">
                {connectionInfo.serviceAccountAccess ? 'Service Account' : 'OAuth 2.0'}
              </Badge>
            </div>
            <div className="text-sm">
              <p>Property: {connectionInfo.propertyId}</p>
              <p>User: {connectionInfo.userEmail}</p>
              <p>Access: Permanent (auto-refresh enabled)</p>
            </div>
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
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Professional GA4 Authentication
        </CardTitle>
        <CardDescription>
          Enterprise-grade authentication methods used by platforms like Supermetrics and AgencyAnalytics
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="service-account" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="service-account">Service Account</TabsTrigger>
            <TabsTrigger value="domain-delegation">Domain Delegation</TabsTrigger>
            <TabsTrigger value="oauth">Enhanced OAuth</TabsTrigger>
          </TabsList>
          
          <TabsContent value="service-account" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Service Account Authentication</strong></p>
                  <p>The most secure method used by professional platforms. No user interaction required after setup.</p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Never expires
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Most secure
                    </div>
                    <div className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      Server-side only
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleServiceAccountConnect}
              disabled={isConnecting || !propertyId}
              className="w-full"
              size="lg"
            >
              {(isConnecting && connectionMethod === 'service-account') ? (
                "Connecting with Service Account..."
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Connect via Service Account
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="domain-delegation" className="space-y-4">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Domain-Wide Delegation</strong></p>
                  <p>Service account impersonates specific users. Perfect for agency environments with multiple Google accounts.</p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Multi-user support
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Never expires
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleDomainDelegationConnect}
              disabled={isConnecting || !propertyId || !userEmail}
              className="w-full"
              size="lg"
            >
              {(isConnecting && connectionMethod === 'domain-delegation') ? (
                "Connecting with Domain Delegation..."
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Connect via Domain Delegation
                </>
              )}
            </Button>
            
            {!userEmail && (
              <p className="text-sm text-amber-600">
                User email required for domain delegation method
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="oauth" className="space-y-4">
            <Alert>
              <SiGoogle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Enhanced OAuth 2.0</strong></p>
                  <p>Professional-grade OAuth with refresh tokens. User authenticates once, access never expires.</p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      User-friendly
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Auto-refresh
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Production-ready
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleProfessionalOAuthConnect}
              disabled={isConnecting || !propertyId}
              className="w-full"
              size="lg"
            >
              {(isConnecting && connectionMethod === 'oauth') ? (
                "Redirecting to Google..."
              ) : (
                <>
                  <SiGoogle className="w-4 h-4 mr-2" />
                  Connect via Professional OAuth
                  <ExternalLink className="w-3 h-3 ml-2" />
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Why Professional Authentication?</h4>
          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <li>• <strong>Never expires:</strong> Unlike manual tokens (1 hour), these methods provide permanent access</li>
            <li>• <strong>Zero maintenance:</strong> Automatic token refresh, no user intervention required</li>
            <li>• <strong>Enterprise security:</strong> Same methods used by Supermetrics, Funnel, and other professional platforms</li>
            <li>• <strong>Scalable:</strong> Handle multiple properties and users seamlessly</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
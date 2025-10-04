import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { SiLinkedin } from "react-icons/si";
import { Briefcase, CheckCircle, AlertCircle, Key } from "lucide-react";

interface LinkedInConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess: () => void;
}

interface AdAccount {
  id: string;
  name: string;
}

export function LinkedInConnectionFlow({ campaignId, onConnectionSuccess }: LinkedInConnectionFlowProps) {
  const [step, setStep] = useState<'credentials' | 'connecting' | 'select-account' | 'manual-entry' | 'connected'>('credentials');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [manualAdAccountId, setManualAdAccountId] = useState<string>('');
  const [manualAccessToken, setManualAccessToken] = useState<string>('');
  const { toast } = useToast();

  const handleLinkedInOAuth = async () => {
    if (!clientId || !clientSecret) {
      setShowClientIdInput(true);
      toast({
        title: "OAuth Credentials Required",
        description: "Please enter both your LinkedIn OAuth Client ID and Client Secret to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    setStep('connecting');

    try {
      // Use current domain for redirect - works for both localhost and Replit domains
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const scope = 'r_ads_reporting rw_ads r_organization_admin';
      
      console.log('OAuth redirect URI:', redirectUri);
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=campaign_${campaignId}`;

      // Open popup for OAuth
      const popup = window.open(authUrl, 'linkedin-oauth', 'width=500,height=600');
      
      if (!popup) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive"
        });
        setStep('credentials');
        setIsConnecting(false);
        return;
      }
      
      console.log('OAuth popup opened successfully');
      
      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        console.log('Received message:', event.data, 'from origin:', event.origin);
        
        // Accept messages from same origin (more flexible for Replit domains)
        const currentOrigin = window.location.origin;
        if (event.origin !== currentOrigin) {
          console.log(`Rejecting message from ${event.origin}, expected ${currentOrigin}`);
          return;
        }
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          const authCode = event.data.code;
          
          try {
            // Exchange authorization code for tokens
            const response = await fetch('/api/linkedin/oauth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId,
                authCode,
                clientId,
                clientSecret,
                redirectUri
              })
            });

            const data = await response.json();
            
            if (data.success) {
              setAdAccounts(data.adAccounts || []);
              setStep('select-account');
              toast({
                title: "Connected to LinkedIn!",
                description: "Select an ad account to import campaign data from."
              });
            } else {
              throw new Error(data.error || 'OAuth exchange failed');
            }
          } catch (error: any) {
            console.error('LinkedIn OAuth error:', error);
            toast({
              title: "Connection Failed",
              description: error.message || "Failed to connect to LinkedIn",
              variant: "destructive"
            });
            setStep('credentials');
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          toast({
            title: "OAuth Error",
            description: event.data.error || "Authentication failed",
            variant: "destructive"
          });
          setStep('credentials');
        }
        
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) {
          popup.close();
        }
        setIsConnecting(false);
        clearInterval(checkClosed);
        clearTimeout(timeoutId);
      };

      window.addEventListener('message', handleMessage);
      
      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          setStep('credentials');
          clearTimeout(timeoutId);
        }
      }, 1000);
      
      // Set timeout for OAuth flow (5 minutes)
      const timeoutId = setTimeout(() => {
        console.log('OAuth flow timed out');
        toast({
          title: "Connection Timeout",
          description: "The connection process timed out. Please try again.",
          variant: "destructive"
        });
        setStep('credentials');
        cleanup();
      }, 5 * 60 * 1000);

    } catch (error: any) {
      console.error('LinkedIn connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start LinkedIn connection",
        variant: "destructive"
      });
      setIsConnecting(false);
      setStep('credentials');
    }
  };

  const handleAdAccountSelection = async () => {
    if (!selectedAdAccount) {
      toast({
        title: "Selection Required",
        description: "Please select an ad account to continue.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/linkedin/select-ad-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          adAccountId: selectedAdAccount
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setStep('connected');
        toast({
          title: "Ad Account Connected!",
          description: "Your LinkedIn ad account is now connected to this campaign."
        });
        onConnectionSuccess();
      } else {
        throw new Error(data.error || 'Failed to connect ad account');
      }
    } catch (error: any) {
      toast({
        title: "Selection Failed",
        description: error.message || "Failed to connect to selected ad account",
        variant: "destructive"
      });
    }
  };

  const handleManualTokenConnection = async () => {
    if (!manualAccessToken || !manualAdAccountId) {
      toast({
        title: "Missing Information",
        description: "Please provide both access token and ad account ID.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch('/api/linkedin/connect-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          accessToken: manualAccessToken,
          adAccountId: manualAdAccountId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setStep('connected');
        toast({
          title: "Ad Account Connected!",
          description: "Your LinkedIn ad account is now connected to this campaign."
        });
        onConnectionSuccess();
      } else {
        throw new Error(data.error || 'Failed to connect ad account');
      }
    } catch (error: any) {
      console.error('Manual token connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect with provided credentials",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (step === 'connected') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2" data-testid="text-connection-success">Connected!</h3>
          <p className="text-slate-500 dark:text-slate-400" data-testid="text-connection-message">
            Your LinkedIn ad account is now connected and will sync automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'select-account') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Select LinkedIn Ad Account
          </CardTitle>
          <CardDescription>
            Choose which LinkedIn ad account to connect for campaign data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {adAccounts.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ad-account-select">Available Ad Accounts</Label>
                <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                  <SelectTrigger id="ad-account-select" data-testid="select-ad-account">
                    <SelectValue placeholder="Select an ad account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {adAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id} data-testid={`option-ad-account-${account.id}`}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('credentials')} 
                  className="flex-1"
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleAdAccountSelection}
                  disabled={!selectedAdAccount}
                  className="flex-1"
                  data-testid="button-connect-account"
                >
                  Connect Ad Account
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
              <p className="text-slate-600 dark:text-slate-400" data-testid="text-no-accounts">No ad accounts found</p>
              <Button 
                variant="outline" 
                onClick={() => setStep('credentials')} 
                className="mt-4"
                data-testid="button-try-again"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiLinkedin className="w-5 h-5 text-blue-600" />
          Connect LinkedIn Ads
        </CardTitle>
        <CardDescription>
          Import campaign data and metrics from your LinkedIn ad account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="oauth" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth" data-testid="tab-oauth">
              <SiLinkedin className="w-4 h-4 mr-2" />
              LinkedIn OAuth
            </TabsTrigger>
            <TabsTrigger value="manual" data-testid="tab-manual">
              <Key className="w-4 h-4 mr-2" />
              Manual Token
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oauth" className="space-y-4 mt-4">
            {!showClientIdInput ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Connect Your Ad Account</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Access your LinkedIn Ads data to automatically import campaign metrics, budgets, and performance data.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowClientIdInput(true)} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-connect-oauth"
                >
                  <SiLinkedin className="w-4 h-4 mr-2" />
                  Connect with LinkedIn OAuth
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Badge variant="outline" className="mb-3">OAuth Setup Required</Badge>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    To connect LinkedIn Ads, provide your OAuth credentials from LinkedIn Developer Portal.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="linkedin-client-id">LinkedIn OAuth Client ID</Label>
                  <Input
                    id="linkedin-client-id"
                    type="text"
                    placeholder="Your LinkedIn OAuth Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    data-testid="input-client-id"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="linkedin-client-secret">LinkedIn OAuth Client Secret</Label>
                  <Input
                    id="linkedin-client-secret"
                    type="password"
                    placeholder="Your LinkedIn OAuth Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    data-testid="input-client-secret"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowClientIdInput(false)}
                    className="flex-1"
                    data-testid="button-cancel-oauth"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleLinkedInOAuth}
                    disabled={isConnecting || !clientId || !clientSecret}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-continue-oauth"
                  >
                    {isConnecting ? "Connecting..." : "Continue"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div>
              <Badge variant="outline" className="mb-3">Manual Connection</Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                If you have a LinkedIn access token and ad account ID, you can connect manually.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-access-token">LinkedIn Access Token</Label>
              <Input
                id="manual-access-token"
                type="password"
                placeholder="Your LinkedIn Access Token"
                value={manualAccessToken}
                onChange={(e) => setManualAccessToken(e.target.value)}
                data-testid="input-access-token"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-ad-account-id">Ad Account ID</Label>
              <Input
                id="manual-ad-account-id"
                type="text"
                placeholder="Your LinkedIn Ad Account ID"
                value={manualAdAccountId}
                onChange={(e) => setManualAdAccountId(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-ad-account-id"
              />
              <p className="text-xs text-slate-500">
                Find your ad account ID in LinkedIn Campaign Manager URL
              </p>
            </div>

            <Button 
              onClick={handleManualTokenConnection}
              disabled={isConnecting || !manualAccessToken || !manualAdAccountId}
              className="w-full bg-blue-600 hover:bg-blue-700"
              data-testid="button-connect-manual"
            >
              {isConnecting ? "Connecting..." : "Connect Ad Account"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

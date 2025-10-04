import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SiLinkedin } from "react-icons/si";
import { Briefcase, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface LinkedInConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess: () => void;
}

interface AdAccount {
  id: string;
  name: string;
}

export function LinkedInConnectionFlow({ campaignId, onConnectionSuccess }: LinkedInConnectionFlowProps) {
  // Check if OAuth credentials are configured at platform level
  const hasEnvCredentials = import.meta.env.VITE_LINKEDIN_CLIENT_ID && import.meta.env.VITE_LINKEDIN_CLIENT_SECRET;
  
  const [step, setStep] = useState<'credentials' | 'connecting' | 'select-account' | 'connected'>('credentials');
  const [clientId, setClientId] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_ID || '');
  const [clientSecret, setClientSecret] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
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

  if (step === 'connected') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Successfully Connected!</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Your LinkedIn ad account is now connected to this campaign. You can now access detailed analytics and campaign data.
              </p>
            </div>
            <Button 
              onClick={() => {
                setStep('credentials');
                onConnectionSuccess();
              }}
              variant="outline"
              className="w-full"
              data-testid="button-done"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'select-account') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiLinkedin className="w-5 h-5 text-blue-600" />
            Select Ad Account
          </CardTitle>
          <CardDescription>
            Choose which LinkedIn ad account to connect to this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {adAccounts.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ad-account">Ad Account</Label>
                <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                  <SelectTrigger id="ad-account" data-testid="select-ad-account">
                    <SelectValue placeholder="Select an ad account" />
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
              
              <Button 
                onClick={handleAdAccountSelection}
                disabled={!selectedAdAccount}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-account"
              >
                Connect Selected Account
              </Button>
            </>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No ad accounts found. Make sure you have admin access to at least one LinkedIn ad account.
              </p>
              <Button 
                onClick={() => setStep('credentials')} 
                variant="outline"
                data-testid="button-back-to-credentials"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'connecting') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center animate-pulse">
              <SiLinkedin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Connecting to LinkedIn...</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Please complete the authentication in the popup window
              </p>
            </div>
          </div>
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
          Securely connect your LinkedIn ad account using OAuth 2.0
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showClientIdInput && !hasEnvCredentials ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Connect Your Ad Account</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Access your LinkedIn Ads data to automatically import campaign metrics, budgets, and performance data using secure OAuth authentication.
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Need OAuth Credentials?</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Get your Client ID and Client Secret from the LinkedIn Developer Portal:
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://developer.linkedin.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">developer.linkedin.com</a></li>
                    <li>Create a new app or select an existing one</li>
                    <li>Go to the "Auth" tab to find your credentials</li>
                    <li>Add your redirect URL in OAuth 2.0 settings</li>
                  </ol>
                </div>
              </div>
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
        ) : hasEnvCredentials && !showClientIdInput ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <Badge variant="outline" className="mb-3">Platform Configured</Badge>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Ready to Connect</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                OAuth credentials are already configured. Click below to connect your LinkedIn ad account securely.
              </p>
            </div>
            
            <Button 
              onClick={handleLinkedInOAuth}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-700"
              data-testid="button-start-oauth"
            >
              <SiLinkedin className="w-4 h-4 mr-2" />
              {isConnecting ? "Connecting..." : "Connect with LinkedIn"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-3">OAuth Setup</Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Enter your LinkedIn OAuth credentials from the Developer Portal
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="linkedin-client-id">Client ID</Label>
              <Input
                id="linkedin-client-id"
                type="text"
                placeholder="Your LinkedIn OAuth Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-client-id"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="linkedin-client-secret">Client Secret</Label>
              <Input
                id="linkedin-client-secret"
                type="password"
                placeholder="Your LinkedIn OAuth Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="font-mono text-sm"
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
                Back
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
      </CardContent>
    </Card>
  );
}

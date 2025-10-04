import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { SiLinkedin } from "react-icons/si";
import { Briefcase, CheckCircle, AlertCircle, ExternalLink, FlaskConical, TrendingUp, MousePointerClick, DollarSign, Eye, Target, Percent } from "lucide-react";

interface LinkedInConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess: () => void;
}

interface AdAccount {
  id: string;
  name: string;
}

interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  selected?: boolean;
  selectedMetrics?: string[];
}

interface MetricOption {
  key: string;
  label: string;
  icon: any;
  getValue: (campaign: LinkedInCampaign) => string;
}

// Mock data for test mode
const MOCK_AD_ACCOUNTS: AdAccount[] = [
  { id: "urn:li:sponsoredAccount:123456789", name: "Marketing Department - Main Account" },
  { id: "urn:li:sponsoredAccount:987654321", name: "Product Launch Campaigns" }
];

const MOCK_CAMPAIGNS: LinkedInCampaign[] = [
  {
    id: "urn:li:sponsoredCampaign:001",
    name: "Brand Awareness Q1 2025",
    status: "active",
    impressions: 145230,
    clicks: 3845,
    spend: 4250.50,
    conversions: 127,
    ctr: 2.65,
    cpc: 1.11
  },
  {
    id: "urn:li:sponsoredCampaign:002",
    name: "Lead Generation - Tech Professionals",
    status: "active",
    impressions: 89420,
    clicks: 2156,
    spend: 3180.25,
    conversions: 89,
    ctr: 2.41,
    cpc: 1.47
  },
  {
    id: "urn:li:sponsoredCampaign:003",
    name: "Product Launch - Enterprise Software",
    status: "active",
    impressions: 203450,
    clicks: 5234,
    spend: 6890.75,
    conversions: 201,
    ctr: 2.57,
    cpc: 1.32
  },
  {
    id: "urn:li:sponsoredCampaign:004",
    name: "Recruitment Marketing Campaign",
    status: "paused",
    impressions: 45120,
    clicks: 892,
    spend: 1250.00,
    conversions: 34,
    ctr: 1.98,
    cpc: 1.40
  }
];

export function LinkedInConnectionFlow({ campaignId, onConnectionSuccess }: LinkedInConnectionFlowProps) {
  const hasEnvCredentials = import.meta.env.VITE_LINKEDIN_CLIENT_ID && import.meta.env.VITE_LINKEDIN_CLIENT_SECRET;
  
  const [step, setStep] = useState<'credentials' | 'connecting' | 'select-account' | 'select-campaigns' | 'connected'>('credentials');
  const [clientId, setClientId] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_ID || '');
  const [clientSecret, setClientSecret] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [campaigns, setCampaigns] = useState<LinkedInCampaign[]>([]);
  const { toast } = useToast();

  const handleTestModeConnection = () => {
    setIsConnecting(true);
    setStep('connecting');

    // Simulate API delay
    setTimeout(() => {
      setAdAccounts(MOCK_AD_ACCOUNTS);
      setStep('select-account');
      setIsConnecting(false);
      toast({
        title: "Test Mode Connected!",
        description: "Select an ad account to view available campaigns.",
      });
    }, 1500);
  };

  const handleLinkedInOAuth = async () => {
    if (isTestMode) {
      handleTestModeConnection();
      return;
    }

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
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const scope = 'r_ads_reporting rw_ads r_organization_admin';
      
      console.log('OAuth redirect URI:', redirectUri);
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=campaign_${campaignId}`;

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
      
      const handleMessage = async (event: MessageEvent) => {
        console.log('Received message:', event.data, 'from origin:', event.origin);
        
        const currentOrigin = window.location.origin;
        if (event.origin !== currentOrigin) {
          console.log(`Rejecting message from ${event.origin}, expected ${currentOrigin}`);
          return;
        }
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          const authCode = event.data.code;
          
          try {
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
      
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          setStep('credentials');
          clearTimeout(timeoutId);
        }
      }, 1000);
      
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

    if (isTestMode) {
      // Show campaign selection in test mode
      setCampaigns(MOCK_CAMPAIGNS.map(c => ({ ...c, selected: false })));
      setStep('select-campaigns');
      toast({
        title: "Ad Account Selected",
        description: "Choose which campaigns to import metrics from."
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

  const toggleCampaignSelection = (campaignId: string) => {
    setCampaigns(campaigns.map(c => 
      c.id === campaignId ? { ...c, selected: !c.selected } : c
    ));
  };

  const handleImportSelectedCampaigns = async () => {
    const selectedCampaigns = campaigns.filter(c => c.selected);
    
    if (selectedCampaigns.length === 0) {
      toast({
        title: "No Campaigns Selected",
        description: "Please select at least one campaign to import.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);

    try {
      // In test mode, simulate import
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStep('connected');
      toast({
        title: "Campaigns Imported!",
        description: `Successfully imported ${selectedCampaigns.length} campaign${selectedCampaigns.length > 1 ? 's' : ''} with metrics.`
      });
      onConnectionSuccess();
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import campaign metrics",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
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
                Your LinkedIn ad data is now connected to this campaign. You can now access detailed analytics and campaign metrics.
              </p>
              {isTestMode && (
                <Badge variant="outline" className="mt-3">
                  <FlaskConical className="w-3 h-3 mr-1" />
                  Test Mode
                </Badge>
              )}
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

  if (step === 'select-campaigns') {
    const selectedCount = campaigns.filter(c => c.selected).length;
    
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiLinkedin className="w-5 h-5 text-blue-600" />
            Select Campaigns to Import
          </CardTitle>
          <CardDescription>
            Choose which campaigns you want to import metrics from
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {campaigns.map((campaign) => (
              <div 
                key={campaign.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  campaign.selected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
                onClick={() => toggleCampaignSelection(campaign.id)}
                data-testid={`campaign-option-${campaign.id}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={campaign.selected}
                    onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                    className="mt-1"
                    data-testid={`checkbox-campaign-${campaign.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">{campaign.name}</h4>
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Impressions</p>
                          <p className="font-medium text-sm">{campaign.impressions.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Clicks</p>
                          <p className="font-medium text-sm">{campaign.clicks.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Spend</p>
                          <p className="font-medium text-sm">${campaign.spend.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">CTR</p>
                          <p className="font-medium text-sm">{campaign.ctr}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {selectedCount} campaign{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep('select-account')}
                data-testid="button-back-to-accounts"
              >
                Back
              </Button>
              <Button 
                onClick={handleImportSelectedCampaigns}
                disabled={selectedCount === 0 || isConnecting}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-import-campaigns"
              >
                {isConnecting ? "Importing..." : `Import ${selectedCount} Campaign${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
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
                {isTestMode ? 'View Campaigns' : 'Connect Selected Account'}
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
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {isTestMode ? 'Connecting in Test Mode...' : 'Connecting to LinkedIn...'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isTestMode 
                  ? 'Simulating OAuth connection with sample data' 
                  : 'Please complete the authentication in the popup window'}
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
        {/* Test Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <div>
              <Label htmlFor="test-mode" className="text-sm font-medium cursor-pointer">Test Mode</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">Use sample data for testing</p>
            </div>
          </div>
          <Switch
            id="test-mode"
            checked={isTestMode}
            onCheckedChange={setIsTestMode}
            data-testid="switch-test-mode"
          />
        </div>

        {!showClientIdInput && !hasEnvCredentials && !isTestMode ? (
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
        ) : isTestMode ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <Badge variant="outline" className="mb-3">
                <FlaskConical className="w-3 h-3 mr-1" />
                Test Mode Active
              </Badge>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Test with Sample Data</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Connect using simulated OAuth flow with realistic sample campaign data. Perfect for testing and development.
              </p>
            </div>
            
            <Button 
              onClick={handleLinkedInOAuth}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-700"
              data-testid="button-start-oauth"
            >
              <SiLinkedin className="w-4 h-4 mr-2" />
              {isConnecting ? "Connecting..." : "Start Test Connection"}
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

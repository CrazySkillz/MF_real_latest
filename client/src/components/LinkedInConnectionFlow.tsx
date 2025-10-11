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
import { Briefcase, CheckCircle, AlertCircle, ExternalLink, FlaskConical, TrendingUp, MousePointerClick, DollarSign, Eye, Target, Percent, UserPlus, Heart, MessageCircle, Share2, Activity, Users, Play, Repeat2 } from "lucide-react";

interface LinkedInConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess: () => void;
  mode?: 'new' | 'existing';
  onImportComplete?: () => void;
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
  leads: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagements: number;
  reach: number;
  videoViews: number;
  viralImpressions: number;
  ctr: number;
  cpc: number;
  selected?: boolean;
  selectedMetrics?: string[];
  conversionValue?: string;
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
    leads: 98,
    likes: 456,
    comments: 123,
    shares: 89,
    totalEngagements: 668,
    reach: 98450,
    videoViews: 12340,
    viralImpressions: 23450,
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
    leads: 156,
    likes: 234,
    comments: 67,
    shares: 45,
    totalEngagements: 346,
    reach: 67890,
    videoViews: 8920,
    viralImpressions: 15670,
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
    leads: 189,
    likes: 678,
    comments: 234,
    shares: 156,
    totalEngagements: 1068,
    reach: 145670,
    videoViews: 18920,
    viralImpressions: 34560,
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
    leads: 67,
    likes: 123,
    comments: 45,
    shares: 23,
    totalEngagements: 191,
    reach: 34560,
    videoViews: 4560,
    viralImpressions: 8920,
    ctr: 1.98,
    cpc: 1.40
  }
];

const AVAILABLE_METRICS: MetricOption[] = [
  {
    key: 'impressions',
    label: 'Impressions',
    icon: Eye,
    getValue: (campaign) => campaign.impressions.toLocaleString()
  },
  {
    key: 'reach',
    label: 'Reach',
    icon: Users,
    getValue: (campaign) => campaign.reach.toLocaleString()
  },
  {
    key: 'clicks',
    label: 'Clicks',
    icon: MousePointerClick,
    getValue: (campaign) => campaign.clicks.toLocaleString()
  },
  {
    key: 'engagements',
    label: 'Engagements',
    icon: Activity,
    getValue: (campaign) => campaign.totalEngagements.toLocaleString()
  },
  {
    key: 'spend',
    label: 'Spend',
    icon: DollarSign,
    getValue: (campaign) => `$${campaign.spend.toFixed(2)}`
  },
  {
    key: 'conversions',
    label: 'Conversions',
    icon: Target,
    getValue: (campaign) => campaign.conversions.toLocaleString()
  },
  {
    key: 'leads',
    label: 'Leads',
    icon: UserPlus,
    getValue: (campaign) => campaign.leads.toLocaleString()
  },
  {
    key: 'videoViews',
    label: 'Video Views',
    icon: Play,
    getValue: (campaign) => campaign.videoViews.toLocaleString()
  },
  {
    key: 'viralImpressions',
    label: 'Viral Impressions',
    icon: Repeat2,
    getValue: (campaign) => campaign.viralImpressions.toLocaleString()
  }
];

export function LinkedInConnectionFlow({ campaignId, onConnectionSuccess, mode = 'existing', onImportComplete }: LinkedInConnectionFlowProps) {
  const hasEnvCredentials = import.meta.env.VITE_LINKEDIN_CLIENT_ID && import.meta.env.VITE_LINKEDIN_CLIENT_SECRET;
  
  const [step, setStep] = useState<'credentials' | 'connecting' | 'select-account' | 'select-campaigns' | 'connected'>('credentials');
  const [clientId, setClientId] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_ID || '');
  const [clientSecret, setClientSecret] = useState(import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
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
              setAccessToken(data.accessToken);
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
      // Show campaign selection in test mode with all metrics selected by default
      setCampaigns(MOCK_CAMPAIGNS.map(c => ({ 
        ...c, 
        selected: false,
        selectedMetrics: AVAILABLE_METRICS.map(m => m.key)
      })));
      setStep('select-campaigns');
      toast({
        title: "Ad Account Selected",
        description: "Choose which campaigns and metrics to import."
      });
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch('/api/linkedin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          adAccountId: selectedAdAccount
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Map campaigns to include selection state
        const campaignsWithSelection = data.map((c: any) => ({
          ...c,
          selected: false,
          selectedMetrics: AVAILABLE_METRICS.map(m => m.key)
        }));
        
        setCampaigns(campaignsWithSelection);
        setStep('select-campaigns');
        setIsConnecting(false);
        toast({
          title: "Campaigns Loaded!",
          description: `Found ${data.length} campaigns. Select which ones to import.`
        });
      } else {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }
    } catch (error: any) {
      console.error('Campaign fetch error:', error);
      setIsConnecting(false);
      toast({
        title: "Failed to Load Campaigns",
        description: error.message || "Failed to fetch campaigns from LinkedIn",
        variant: "destructive"
      });
    }
  };

  const toggleCampaignSelection = (campaignId: string) => {
    setCampaigns(campaigns.map(c => 
      c.id === campaignId ? { ...c, selected: !c.selected } : c
    ));
  };

  const toggleMetricSelection = (campaignId: string, metricKey: string) => {
    setCampaigns(campaigns.map(c => {
      if (c.id === campaignId) {
        const currentMetrics = c.selectedMetrics || [];
        const newMetrics = currentMetrics.includes(metricKey)
          ? currentMetrics.filter(m => m !== metricKey)
          : [...currentMetrics, metricKey];
        return { ...c, selectedMetrics: newMetrics };
      }
      return c;
    }));
  };

  const toggleAllMetricsForCampaign = (campaignId: string, selectAll: boolean) => {
    setCampaigns(campaigns.map(c => 
      c.id === campaignId 
        ? { ...c, selectedMetrics: selectAll ? AVAILABLE_METRICS.map(m => m.key) : [] }
        : c
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
      // Call API to create import session
      const response = await fetch('/api/linkedin/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          adAccountId: selectedAdAccount,
          adAccountName: adAccounts.find(a => a.id === selectedAdAccount)?.name || '',
          accessToken: isTestMode ? undefined : accessToken,
          isTestMode,
          campaigns: selectedCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            selectedMetrics: c.selectedMetrics || [],
            conversionValue: c.conversionValue || null
          }))
        })
      });

      const data = await response.json();
      
      if (data.success && data.sessionId) {
        const totalMetrics = selectedCampaigns.reduce((sum, c) => sum + (c.selectedMetrics?.length || 0), 0);
        
        toast({
          title: "Campaigns Imported!",
          description: `Successfully imported ${selectedCampaigns.length} campaign${selectedCampaigns.length > 1 ? 's' : ''} with ${totalMetrics} total metrics.`
        });
        
        // For new campaigns, trigger both connection success and import complete callbacks
        // For existing campaigns, redirect to LinkedIn analytics page
        if (mode === 'new') {
          setIsConnecting(false);
          // Call onConnectionSuccess to update platform state
          onConnectionSuccess();
          // Call onImportComplete to show Create Campaign button
          if (onImportComplete) {
            onImportComplete();
          }
        } else {
          window.location.href = `/campaigns/${campaignId}/linkedin-analytics?session=${data.sessionId}`;
        }
      } else {
        throw new Error(data.error || 'Failed to create import session');
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import campaign metrics",
        variant: "destructive"
      });
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
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiLinkedin className="w-5 h-5 text-blue-600" />
            Select Campaigns and Metrics
          </CardTitle>
          <CardDescription>
            Choose which campaigns and metrics you want to import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {campaigns.map((campaign) => {
              return (
                <div 
                  key={campaign.id}
                  className={`border rounded-lg p-4 transition-all ${
                    campaign.selected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  data-testid={`campaign-option-${campaign.id}`}
                >
                  <div className="space-y-3">
                    {/* Campaign Header */}
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={campaign.selected}
                        onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                        className="mt-1"
                        data-testid={`checkbox-campaign-${campaign.id}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">{campaign.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                                {campaign.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                9 Core Metrics + 9 Derived Metrics
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Information */}
                    {campaign.selected && (
                      <div className="ml-9 space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                        {/* Core Metrics */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Core Metrics</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">These metrics will be imported automatically</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {AVAILABLE_METRICS.map((metric) => {
                              const Icon = metric.icon;
                              
                              return (
                                <div
                                  key={metric.key}
                                  className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                                  data-testid={`core-metric-${campaign.id}-${metric.key}`}
                                >
                                  <Icon className="w-4 h-4 text-blue-500" />
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{metric.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{metric.getValue(campaign)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Derived Metrics */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Derived Metrics</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Calculated from core metrics</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                              { key: 'ctr', label: 'Click-Through Rate (CTR)', icon: Percent },
                              { key: 'cpc', label: 'Cost Per Click (CPC)', icon: DollarSign },
                              { key: 'cpm', label: 'Cost Per Mille (CPM)', icon: DollarSign },
                              { key: 'cvr', label: 'Conversion Rate (CVR)', icon: Target },
                              { key: 'cpa', label: 'Cost per Acquisition (CPA)', icon: DollarSign },
                              { key: 'cpl', label: 'Cost per Lead (CPL)', icon: DollarSign },
                              { key: 'er', label: 'Engagement Rate (ER)', icon: Activity },
                              { key: 'roi', label: 'Return on Investment (ROI)', icon: TrendingUp },
                              { key: 'roas', label: 'Return on Ad Spend (ROAS)', icon: TrendingUp }
                            ].map((metric) => {
                              const Icon = metric.icon;
                              
                              return (
                                <div
                                  key={metric.key}
                                  className="flex items-center gap-2 p-2 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                                  data-testid={`derived-metric-${campaign.id}-${metric.key}`}
                                >
                                  <Icon className="w-4 h-4 text-green-600" />
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{metric.label}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Conversion Value Input */}
                        <div className="space-y-2">
                          <Label htmlFor={`conversion-value-${campaign.id}`} className="text-sm font-medium">
                            Conversion Value
                          </Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Enter the average value per conversion for ROI and ROAS calculations
                          </p>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-slate-500" />
                            <Input
                              id={`conversion-value-${campaign.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={campaign.conversionValue || ''}
                              onChange={(e) => {
                                setCampaigns(prev => prev.map(c => 
                                  c.id === campaign.id 
                                    ? { ...c, conversionValue: e.target.value }
                                    : c
                                ));
                              }}
                              className="flex-1"
                              data-testid={`input-conversion-value-${campaign.id}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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

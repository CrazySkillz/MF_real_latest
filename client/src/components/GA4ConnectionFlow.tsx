import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, MousePointer, TrendingUp, Key, Upload, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface GA4ConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess?: () => void;
}

interface GA4Property {
  id: string;
  name: string;
}

export function GA4ConnectionFlow({ campaignId, onConnectionSuccess }: GA4ConnectionFlowProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStep, setConnectionStep] = useState<'connect' | 'connected'>('connect');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [oauthProperties, setOauthProperties] = useState<GA4Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [showPropertySelection, setShowPropertySelection] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const { toast } = useToast();

  const handleTokenConnect = async () => {
    console.log('GA4 Connect button clicked!', { campaignId, accessToken: accessToken.substring(0, 10) + '...', propertyId });
    
    if (!accessToken || !propertyId) {
      toast({
        title: "Missing Information",
        description: "Please provide both access token and property ID.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      console.log('Making GA4 connection request...');
      const response = await fetch('/api/ga4/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          accessToken,
          refreshToken,
          propertyId
        })
      });
      
      console.log('GA4 response received:', response.status);
      const data = await response.json();
      console.log('GA4 response data:', data);

      if (data.success) {
        setConnectionStep('connected');
        onConnectionSuccess?.();
        toast({
          title: "GA4 Connected!",
          description: "Successfully connected! Your real Google Analytics data will now be available."
        });
        
        // Test the connection by fetching metrics
        try {
          const metricsResponse = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
          const metricsData = await metricsResponse.json();
          if (metricsData.success) {
            console.log('Real GA4 metrics:', metricsData.metrics);
          }
        } catch (error) {
          console.log('Metrics fetch will be available after page refresh');
        }
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect with provided credentials.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Token connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Google Analytics. Please check your credentials.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoogleOAuth = async () => {
    if (!clientId || !clientSecret) {
      setShowClientIdInput(true);
      toast({
        title: "OAuth Credentials Required",
        description: "Please enter both your Google OAuth Client ID and Client Secret to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsOAuthLoading(true);
    
    try {
      // Generate OAuth URL directly on client side
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const scope = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/analytics.edit';
      const responseType = 'code';
      const state = `campaign_${campaignId}`;
      
      // Debug: Log the redirect URI being used
      console.log('OAuth Debug - Redirect URI being used:', redirectUri);
      console.log('OAuth Debug - Client ID:', clientId);
      
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=${responseType}&` +
        `state=${encodeURIComponent(state)}&` +
        `access_type=offline&` +
        `prompt=consent`;
      
      console.log('OAuth Debug - Full OAuth URL:', oauthUrl);
      
      // Create OAuth callback handler
      const handleOAuthCallback = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          window.removeEventListener('message', handleOAuthCallback);
          setIsOAuthLoading(false);
          
          const { code } = event.data;
          exchangeCodeForTokens(code);
        } else if (event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', handleOAuthCallback);
          setIsOAuthLoading(false);
          
          toast({
            title: "OAuth Failed",
            description: event.data.error || "Authentication failed",
            variant: "destructive"
          });
        }
      };
      
      window.addEventListener('message', handleOAuthCallback);
      
      // Open OAuth in popup window
      const popup = window.open(
        oauthUrl,
        'google_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      // Check if popup was blocked
      if (!popup) {
        window.removeEventListener('message', handleOAuthCallback);
        setIsOAuthLoading(false);
        toast({
          title: "Popup Blocked",
          description: "Please allow popups and try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleOAuthCallback);
          setIsOAuthLoading(false);
        }
      }, 1000);
      
      toast({
        title: "Authenticate with Google",
        description: "Complete the authentication in the popup window.",
        duration: 3000,
      });
      
    } catch (error) {
      console.error('OAuth initiation error:', error);
      setIsOAuthLoading(false);
      toast({
        title: "OAuth Failed",
        description: error instanceof Error ? error.message : "Failed to start OAuth flow.",
        variant: "destructive"
      });
    }
  };
  
  const exchangeCodeForTokens = async (authCode: string) => {
    try {
      // Debug: Log what we're sending to backend
      const requestData = {
        campaignId,
        authCode,
        clientId,
        clientSecret,
        redirectUri: `${window.location.origin}/oauth-callback.html`
      };
      
      console.log('Frontend Debug - Sending to backend:', {
        campaignId: !!requestData.campaignId,
        authCode: !!requestData.authCode,
        clientId: !!requestData.clientId,
        clientSecret: !!requestData.clientSecret,
        clientSecretLength: requestData.clientSecret?.length || 0,
        redirectUri: !!requestData.redirectUri
      });
      
      // Exchange authorization code for tokens using backend
      const response = await fetch('/api/ga4/oauth-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (data.success && data.properties) {
        setOauthProperties(data.properties);
        setShowPropertySelection(true);
        toast({
          title: "Authentication Successful!",
          description: "Please select your GA4 property to complete the connection.",
        });
      } else {
        throw new Error(data.error || 'Failed to exchange authorization code');
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Failed to complete authentication.",
        variant: "destructive"
      });
    }
  };
  
  const checkOAuthSuccess = async () => {
    try {
      // Check if OAuth connection exists
      const response = await fetch(`/api/ga4/check-connection/${campaignId}`);
      const data = await response.json();
      
      if (data.connected && data.properties) {
        setOauthProperties(data.properties);
        setShowPropertySelection(true);
        toast({
          title: "Authentication Successful!",
          description: "Please select your GA4 property to complete the connection.",
        });
      }
    } catch (error) {
      console.error('OAuth check error:', error);
    }
  };
  
  const handlePropertySelection = async () => {
    if (!selectedProperty) {
      toast({
        title: "Property Required",
        description: "Please select a GA4 property.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch('/api/ga4/select-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          propertyId: selectedProperty
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStep('connected');
        onConnectionSuccess?.();
        toast({
          title: "GA4 Connected!",
          description: "Your Google Analytics is now connected with automatic token refresh."
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Property selection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect property. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleServiceAccountConnect = async () => {
    if (!serviceAccountKey || !propertyId) {
      toast({
        title: "Missing Information",
        description: "Please provide both service account key and property ID.",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/ga4/connect-service-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          serviceAccountKey,
          propertyId
        })
      });
      
      const data = await response.json();

      if (data.success) {
        setConnectionStep('connected');
        onConnectionSuccess?.();
        toast({
          title: "GA4 Connected!",
          description: "Successfully connected! Your real Google Analytics data will now be available."
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect with service account.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Service account connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Google Analytics. Please check your service account key.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };


  if (connectionStep === 'connected') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-green-600">GA4 Connected!</CardTitle>
          <CardDescription>
            Real-time metrics are now being pulled from your Google Analytics property
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Sessions & Users</span>
            </div>
            <div className="flex items-center gap-2">
              <MousePointer className="w-4 h-4" />
              <span>Page Views & Clicks</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Conversions & Goals</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle>Connect Google Analytics 4</CardTitle>
        <CardDescription>
          Connect your GA4 property to pull real-time metrics and performance data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="oauth" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Google OAuth
            </TabsTrigger>
            <TabsTrigger value="access-token" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Manual Token
            </TabsTrigger>
            <TabsTrigger value="service-account" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Service Account
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="oauth" className="space-y-4 mt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  One-Click Authentication
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Securely connect your Google Analytics with automatic token refresh. 
                  Perfect for marketing professionals who need constant access to their data.
                </p>
              </div>
              
              {!showPropertySelection ? (
                <div className="space-y-4">

                  
                  {showClientIdInput && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                      <div className="space-y-2">
                        <Label htmlFor="client-id">Google OAuth Client ID</Label>
                        <Input
                          id="client-id"
                          placeholder="123456789-abc123.apps.googleusercontent.com"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-secret">Google OAuth Client Secret</Label>
                        <Input
                          id="client-secret"
                          type="password"
                          placeholder="GOCSPX-abc123xyz789..."
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Get both credentials from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a> → APIs & Services → Credentials
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleGoogleOAuth}
                    disabled={isOAuthLoading || (!clientId || !clientSecret) && showClientIdInput}
                    size="lg"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isOAuthLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Connect with Google OAuth
                      </>
                    )}
                  </Button>
                  
                  {!showClientIdInput && (
                    <Button 
                      variant="outline"
                      onClick={() => setShowClientIdInput(true)}
                      className="w-full"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Enter OAuth Credentials
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-left">
                    <Label htmlFor="property-select">Select GA4 Property</Label>
                    <select 
                      id="property-select"
                      value={selectedProperty}
                      onChange={(e) => setSelectedProperty(e.target.value)}
                      className="w-full mt-2 p-2 border rounded-md bg-white dark:bg-slate-800"
                    >
                      <option value="">Choose a property...</option>
                      {oauthProperties.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name} (ID: {prop.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <Button 
                    onClick={handlePropertySelection}
                    className="w-full"
                    disabled={!selectedProperty}
                  >
                    Complete Connection
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="access-token" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property-id">GA4 Property ID *</Label>
                <Input
                  id="property-id"
                  placeholder="123456789"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Find this in GA4: Admin → Property Settings → Property ID
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token *</Label>
                <Textarea
                  id="access-token"
                  placeholder="ya29.a0..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  Get from Google Cloud Console or OAuth Playground
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="refresh-token">Refresh Token (Optional)</Label>
                <Input
                  id="refresh-token"
                  placeholder="1//04..."
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  <strong>Highly recommended:</strong> Enables automatic token renewal so connection never expires
                </p>
              </div>
              
              <Button 
                onClick={handleTokenConnect}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Connect with Access Token'}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="service-account" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sa-property-id">GA4 Property ID *</Label>
                <Input
                  id="sa-property-id"
                  placeholder="123456789"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="service-account">Service Account JSON *</Label>
                <Textarea
                  id="service-account"
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  value={serviceAccountKey}
                  onChange={(e) => setServiceAccountKey(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-gray-500">
                  Paste your service account JSON key from Google Cloud Console
                </p>
              </div>
              
              <Button 
                onClick={handleServiceAccountConnect}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Connect with Service Account'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, MousePointer, TrendingUp, Key, Upload } from 'lucide-react';
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
        <Tabs defaultValue="access-token" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="access-token" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Access Token
            </TabsTrigger>
            <TabsTrigger value="service-account" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Service Account
            </TabsTrigger>
          </TabsList>
          
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
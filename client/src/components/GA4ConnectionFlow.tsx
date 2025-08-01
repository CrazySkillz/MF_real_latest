import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, BarChart3, Users, MousePointer, TrendingUp } from 'lucide-react';
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
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [connectionStep, setConnectionStep] = useState<'connect' | 'select-property' | 'connected'>('connect');
  const { toast } = useToast();

  const handleConnectGA4 = async () => {
    setIsConnecting(true);
    
    try {
      // Start OAuth flow
      const response = await apiRequest(`/api/ga4/setup-oauth`, 'POST', {
        campaignId,
        returnUrl: window.location.href
      });

      if (response.authUrl) {
        // Open OAuth popup
        const popup = window.open(
          response.authUrl,
          'ga4-oauth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            checkOAuthResult();
          }
        }, 1000);

        // Listen for OAuth success message
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GA4_OAUTH_SUCCESS') {
            popup?.close();
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            handleOAuthSuccess(event.data.properties);
          } else if (event.data.type === 'GA4_OAUTH_ERROR') {
            popup?.close();
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            handleOAuthError(event.data.error);
          }
        };

        window.addEventListener('message', messageHandler);
      }
    } catch (error) {
      console.error('OAuth setup error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to start Google Analytics connection. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const checkOAuthResult = async () => {
    try {
      const response = await apiRequest(`/api/ga4/check-connection/${campaignId}`, 'GET');
      if (response.connected && response.properties) {
        handleOAuthSuccess(response.properties);
      }
    } catch (error) {
      console.error('Failed to check OAuth result:', error);
    }
  };

  const handleOAuthSuccess = (availableProperties: GA4Property[]) => {
    setProperties(availableProperties);
    setIsConnected(true);
    setConnectionStep('select-property');
    
    toast({
      title: "Google Analytics Connected!",
      description: "Please select a GA4 property to start pulling metrics."
    });
  };

  const handleOAuthError = (error: string) => {
    toast({
      title: "Connection Failed",
      description: error || "Failed to connect to Google Analytics",
      variant: "destructive"
    });
  };

  const handlePropertySelection = async () => {
    if (!selectedProperty) return;

    try {
      await apiRequest(`/api/ga4/select-property`, 'POST', {
        campaignId,
        propertyId: selectedProperty
      });

      setConnectionStep('connected');
      onConnectionSuccess?.();
      
      toast({
        title: "Property Connected!",
        description: "Starting to pull real-time metrics from your GA4 property."
      });
    } catch (error) {
      console.error('Property selection error:', error);
      toast({
        title: "Selection Failed",
        description: "Failed to connect to the selected property.",
        variant: "destructive"
      });
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

  if (connectionStep === 'select-property') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select GA4 Property</CardTitle>
          <CardDescription>
            Choose which Google Analytics property to connect for this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {properties.map((property) => (
              <label key={property.id} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="property"
                  value={property.id}
                  checked={selectedProperty === property.id}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="text-blue-600"
                />
                <div>
                  <div className="font-medium">{property.name}</div>
                  <div className="text-sm text-gray-500">ID: {property.id}</div>
                </div>
              </label>
            ))}
          </div>
          
          <Button 
            onClick={handlePropertySelection}
            disabled={!selectedProperty}
            className="w-full"
          >
            Connect Property
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle>Connect Google Analytics</CardTitle>
        <CardDescription>
          Connect your GA4 property to pull real-time metrics and performance data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Real-time
            </Badge>
            <span className="text-sm">Live sessions & pageviews</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Authentic
            </Badge>
            <span className="text-sm">Direct from Google Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              Secure
            </Badge>
            <span className="text-sm">OAuth 2.0 authentication</span>
          </div>
        </div>

        <Button 
          onClick={handleConnectGA4}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? 'Connecting...' : 'Connect Google Analytics'}
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          You'll be redirected to Google to authorize access to your Analytics data
        </p>
      </CardContent>
    </Card>
  );
}
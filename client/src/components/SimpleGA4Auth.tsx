import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";
import { CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SimpleGA4AuthProps {
  campaignId: string;
  propertyId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function SimpleGA4Auth({ campaignId, propertyId, onSuccess, onError }: SimpleGA4AuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    propertyId: propertyId
  });
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!credentials.email || !credentials.password || !credentials.propertyId) {
      onError("Please fill in all fields");
      return;
    }

    setIsConnecting(true);

    try {
      // Simulate the professional platform experience
      const response = await apiRequest("POST", "/api/auth/google/simple-connect", {
        campaignId,
        email: credentials.email,
        password: credentials.password,
        propertyId: credentials.propertyId
      });

      const data = await response.json();

      if (data.success) {
        setHasConnection(true);
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected to your GA4 property",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      console.error('Simple GA4 connection error:', error);
      onError(error.message || "Failed to connect to Google Analytics");
    } finally {
      setIsConnecting(false);
    }
  };

  if (hasConnection) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Google Analytics Connected</p>
              <p className="text-sm">Property: {propertyId}</p>
              <p className="text-sm">Account: {credentials.email}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setHasConnection(false);
                setCredentials({ email: "", password: "", propertyId });
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
          <SiGoogle className="w-5 h-5 text-blue-600" />
          Connect Google Analytics
        </CardTitle>
        <CardDescription>
          Enter your Google credentials to connect your GA4 property
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Simple Credential Connection</strong></p>
              <p>Enter your Google account details for secure access to your analytics data.</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-email">Google Account Email</Label>
            <Input
              id="ga4-email"
              type="email"
              placeholder="your-email@gmail.com"
              value={credentials.email}
              onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ga4-password">Google Account Password</Label>
            <div className="relative">
              <Input
                id="ga4-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your Google password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ga4-property">GA4 Property ID</Label>
            <Input
              id="ga4-property"
              placeholder="e.g., 123456789"
              value={credentials.propertyId}
              onChange={(e) => setCredentials(prev => ({ ...prev, propertyId: e.target.value }))}
            />
            <div className="text-xs text-slate-500">
              Find this in Google Analytics → Admin → Property Settings
            </div>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={isConnecting || !credentials.email || !credentials.password || !credentials.propertyId}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              "Connecting to Google Analytics..."
            ) : (
              <>
                <SiGoogle className="w-4 h-4 mr-2" />
                Connect Google Analytics
              </>
            )}
          </Button>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Security Information:</h4>
          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <li>• <strong>Secure Authentication:</strong> Your credentials are used to generate secure access tokens</li>
            <li>• <strong>Automatic Renewal:</strong> Tokens are automatically refreshed in the background</li>
            <li>• <strong>Data Protection:</strong> Your login details are not stored permanently</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
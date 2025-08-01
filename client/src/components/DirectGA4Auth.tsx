import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, Copy, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DirectGA4AuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function DirectGA4Auth({ campaignId, onSuccess, onError }: DirectGA4AuthProps) {
  const [connectionMethod, setConnectionMethod] = useState<"service_account" | "manual_token" | "credentials">("manual_token");
  const [isConnecting, setIsConnecting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    accessToken: "",
    refreshToken: "",
    propertyId: "",
    email: "",
    password: "",
    serviceAccountKey: ""
  });
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard",
    });
  };

  const handleManualTokenConnection = async () => {
    if (!formData.accessToken || !formData.propertyId) {
      onError("Access token and Property ID are required");
      return;
    }

    setIsConnecting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/google/manual-token-connect", {
        campaignId,
        accessToken: formData.accessToken,
        refreshToken: formData.refreshToken,
        propertyId: formData.propertyId
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected using manual token method",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      onError(error.message || "Failed to connect with manual token");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCredentialsConnection = async () => {
    if (!formData.email || !formData.password || !formData.propertyId) {
      onError("Email, password, and Property ID are required");
      return;
    }

    setIsConnecting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/google/simple-connect", {
        campaignId,
        email: formData.email,
        password: formData.password,
        propertyId: formData.propertyId
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected using Google credentials",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      onError(error.message || "Failed to connect with credentials");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleServiceAccountConnection = async () => {
    if (!formData.serviceAccountKey || !formData.propertyId) {
      onError("Service account key and Property ID are required");
      return;
    }

    setIsConnecting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/google/service-account-connect", {
        campaignId,
        propertyId: formData.propertyId,
        serviceAccountKey: formData.serviceAccountKey
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Google Analytics Connected",
          description: "Successfully connected using service account",
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Connection failed");
      }
    } catch (error) {
      onError(error.message || "Failed to connect with service account");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    switch (connectionMethod) {
      case "manual_token":
        handleManualTokenConnection();
        break;
      case "credentials":
        handleCredentialsConnection();
        break;
      case "service_account":
        handleServiceAccountConnection();
        break;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-600" />
          Connect Google Analytics 4
        </CardTitle>
        <CardDescription>
          Choose your preferred method to connect your GA4 property
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="method">Connection Method</Label>
          <Select value={connectionMethod} onValueChange={(value: any) => setConnectionMethod(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select connection method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_token">
                <div className="flex items-center gap-2">
                  Manual Access Token
                  <Badge variant="secondary">Recommended</Badge>
                </div>
              </SelectItem>
              <SelectItem value="credentials">Google Account Credentials</SelectItem>
              <SelectItem value="service_account">Service Account Key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {connectionMethod === "manual_token" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">How to get your access token:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>
                  Go to{" "}
                  <button
                    onClick={() => copyToClipboard("https://developers.google.com/oauthplayground/")}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    Google OAuth Playground <Copy className="w-3 h-3" />
                  </button>
                </li>
                <li>Select "Google Analytics API v1" from the list</li>
                <li>Click "Authorize APIs" and sign in with your Google account</li>
                <li>Click "Exchange authorization code for tokens"</li>
                <li>Copy the "Access token" and "Refresh token" from the response</li>
              </ol>
            </div>

            <div>
              <Label htmlFor="accessToken">Access Token *</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showToken ? "text" : "password"}
                  placeholder="ya29.a0AfH6SMC..."
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="refreshToken">Refresh Token (optional)</Label>
              <Input
                id="refreshToken"
                type="password"
                placeholder="1//04..."
                value={formData.refreshToken}
                onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="propertyId">GA4 Property ID *</Label>
              <Input
                id="propertyId"
                placeholder="123456789"
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this in GA4: Admin → Property Settings → Property ID
              </p>
            </div>
          </div>
        )}

        {connectionMethod === "credentials" && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">Google Account Method</h4>
              <p className="text-sm text-amber-800">
                This method uses your Google account credentials to authenticate server-side, 
                similar to how professional analytics platforms like Supermetrics work.
              </p>
            </div>

            <div>
              <Label htmlFor="email">Google Account Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="password">Google Account Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your Google password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="propertyId">GA4 Property ID *</Label>
              <Input
                id="propertyId"
                placeholder="123456789"
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              />
            </div>
          </div>
        )}

        {connectionMethod === "service_account" && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Service Account Method</h4>
              <p className="text-sm text-green-800">
                Most secure method for production use. Requires creating a service account 
                in Google Cloud Console and adding it to your GA4 property.
              </p>
            </div>

            <div>
              <Label htmlFor="serviceAccountKey">Service Account JSON Key *</Label>
              <Textarea
                id="serviceAccountKey"
                placeholder='{"type": "service_account", "project_id": "...", ...}'
                value={formData.serviceAccountKey}
                onChange={(e) => setFormData({ ...formData, serviceAccountKey: e.target.value })}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="propertyId">GA4 Property ID *</Label>
              <Input
                id="propertyId"
                placeholder="123456789"
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              />
            </div>
          </div>
        )}

        <Button 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? "Connecting..." : "Connect Google Analytics"}
        </Button>
      </CardContent>
    </Card>
  );
}
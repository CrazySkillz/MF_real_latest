import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { SiGoogleanalytics } from "react-icons/si";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { DirectGA4Auth } from "@/components/DirectGA4Auth";

export default function OAuthTest() {
  const [connectionMethod, setConnectionMethod] = useState<"oauth" | "direct" | null>(null);
  const [connectionResult, setConnectionResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOAuthSuccess = () => {
    setConnectionResult("OAuth connection successful!");
    toast({
      title: "OAuth Success",
      description: "Successfully connected to Google Analytics via OAuth flow",
    });
  };

  const handleOAuthError = (error: string) => {
    setConnectionResult(`OAuth error: ${error}`);
    toast({
      title: "OAuth Error",
      description: error,
      variant: "destructive"
    });
  };

  const handleDirectSuccess = () => {
    setConnectionResult("Direct connection successful!");
    toast({
      title: "Direct Connection Success",
      description: "Successfully connected to Google Analytics with direct credentials",
    });
  };

  const handleDirectError = (error: string) => {
    setConnectionResult(`Direct connection error: ${error}`);
    toast({
      title: "Direct Connection Error",
      description: error,
      variant: "destructive"
    });
  };

  if (connectionMethod === "oauth") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => setConnectionMethod(null)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Test Selection
            </Button>
            <h1 className="text-3xl font-bold">OAuth Flow Test</h1>
            <p className="text-gray-600 mt-2">
              Test the complete Google Analytics OAuth 2.0 integration
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <GA4ConnectionFlow 
              campaignId="test-oauth-campaign"
              onConnectionSuccess={handleOAuthSuccess}
            />
            
            {connectionResult && (
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    {connectionResult.includes("successful") ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={connectionResult.includes("successful") ? "text-green-600" : "text-red-600"}>
                      {connectionResult}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (connectionMethod === "direct") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => setConnectionMethod(null)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Test Selection
            </Button>
            <h1 className="text-3xl font-bold">Direct Authentication Test</h1>
            <p className="text-gray-600 mt-2">
              Test direct GA4 connection with manual tokens or credentials
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <DirectGA4Auth
              campaignId="test-direct-campaign"
              onSuccess={handleDirectSuccess}
              onError={handleDirectError}
            />
            
            {connectionResult && (
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    {connectionResult.includes("successful") ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={connectionResult.includes("successful") ? "text-green-600" : "text-red-600"}>
                      {connectionResult}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">OAuth Integration Test</h1>
          <p className="text-gray-600 mt-2">
            Test the complete Google Analytics OAuth 2.0 setup and authentication flows
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* OAuth Flow Test */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setConnectionMethod("oauth")}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ExternalLink className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>OAuth 2.0 Flow</CardTitle>
                  <CardDescription>
                    Test the complete OAuth popup flow
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Production Ready
                  </Badge>
                  <span className="text-sm">•</span>
                  <span className="text-sm text-gray-600">Full OAuth flow</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Tests:</strong>
                  <ul className="ml-4 list-disc space-y-1 mt-1">
                    <li>Google OAuth popup authentication</li>
                    <li>Property discovery and selection</li>
                    <li>Token exchange and storage</li>
                    <li>Connection persistence</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Direct Authentication Test */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setConnectionMethod("direct")}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <SiGoogleanalytics className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Direct Authentication</CardTitle>
                  <CardDescription>
                    Test manual token and credential methods
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    Developer Mode
                  </Badge>
                  <span className="text-sm">•</span>
                  <span className="text-sm text-gray-600">Manual setup</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Tests:</strong>
                  <ul className="ml-4 list-disc space-y-1 mt-1">
                    <li>Manual access token connection</li>
                    <li>Google credentials authentication</li>
                    <li>Service account setup</li>
                    <li>Real GA4 API integration</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Setup Requirements</CardTitle>
            <CardDescription>
              To test the full OAuth flow, you need Google OAuth credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">1. Get Google OAuth Credentials</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Create OAuth 2.0 credentials in Google Cloud Console:
                </p>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                  <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                  <li>Create OAuth 2.0 Client ID (Web application)</li>
                  <li>Add redirect URI: <code className="bg-gray-100 px-1 rounded">http://localhost:5000/auth/google/callback</code></li>
                  <li>Copy your Client ID and Client Secret</li>
                </ol>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Configure Environment Variables</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Add these secrets to your environment:
                </p>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                  <div>GOOGLE_CLIENT_ID=your_client_id_here</div>
                  <div>GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">3. Enable Required APIs</h4>
                <p className="text-sm text-gray-600">
                  Make sure these APIs are enabled in Google Cloud Console:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>Google Analytics Data API</li>
                  <li>Google Analytics Admin API</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SiFacebook } from "react-icons/si";
import { AlertCircle, RefreshCw, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SimpleMetaAuthProps {
  campaignId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

interface AdAccount {
  id: string;
  name: string;
}

// Test mode ad accounts for demo/testing
const TEST_AD_ACCOUNTS: AdAccount[] = [
  { id: "act_123456789", name: "E-commerce Store - Main Account" },
  { id: "act_987654321", name: "Brand Awareness Campaign Account" },
  { id: "act_555666777", name: "Product Launch Account" },
  { id: "act_111222333", name: "Retargeting Campaigns" },
];

export function SimpleMetaAuth({ campaignId, onSuccess, onError }: SimpleMetaAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [useTestMode, setUseTestMode] = useState(true); // Default to test mode
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const { toast } = useToast();

  const handleTestModeConnection = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAdAccounts(TEST_AD_ACCOUNTS);
      setSelectedAdAccount(TEST_AD_ACCOUNTS[0].id);
      
      toast({
        title: "Test Mode Activated",
        description: "Select a test ad account to continue with realistic demo data."
      });
    } catch (error: any) {
      console.error("Test mode connection error:", error);
      onError(error?.message || "Failed to initialize test mode");
    } finally {
      setIsConnecting(false);
    }
  }, [toast, onError]);

  const handleSelectAdAccount = useCallback(async () => {
    if (!selectedAdAccount) {
      onError("Please select an ad account.");
      return;
    }
    
    setIsConnecting(true);
    try {
      const selectedAccount = adAccounts.find(acc => acc.id === selectedAdAccount);
      
      await apiRequest("POST", `/api/meta/${campaignId}/connect-test`, {
        adAccountId: selectedAdAccount,
        adAccountName: selectedAccount?.name || "Test Ad Account",
      });
      
      toast({
        title: "Meta Ad Account Connected!",
        description: `Connected to ${selectedAccount?.name || "test account"} with realistic demo metrics.`
      });
      
      onSuccess();
    } catch (error: any) {
      console.error("Failed to connect ad account:", error);
      onError(error.message || "Failed to connect selected ad account");
    } finally {
      setIsConnecting(false);
    }
  }, [campaignId, selectedAdAccount, adAccounts, onSuccess, onError, toast]);

  // Show ad account selection if we have accounts
  if (adAccounts.length > 0) {
    return (
      <Card className="w-full border border-slate-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2 justify-center">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Select Meta Ad Account
          </CardTitle>
          <CardDescription>
            Choose which Meta/Facebook Ad Account to connect for campaign data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Available Ad Accounts</Label>
            <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an ad account..." />
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
            onClick={handleSelectAdAccount} 
            disabled={!selectedAdAccount || isConnecting} 
            className="w-full" 
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Ad Account"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial connection screen
  return (
    <Card className="w-full border border-slate-200">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2 justify-center">
          <SiFacebook className="w-5 h-5 text-blue-600" />
          Connect Meta/Facebook Ads
        </CardTitle>
        <CardDescription>
          Connect your Meta/Facebook Ads account to import campaign data and metrics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Test Mode Available</p>
            <p className="text-sm">
              For testing, you can use test mode with realistic demo data. For production, you'll need Meta App credentials.
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Button
            onClick={handleTestModeConnection}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <SiFacebook className="w-4 h-4 mr-2" />
                Connect Meta Ads (Test Mode)
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-xs text-slate-500 text-center">
              Loading test ad accounts with realistic metrics...
            </p>
          )}
          
          <div className="pt-4 border-t">
            <p className="text-xs text-slate-500 text-center">
              <strong>Production Setup:</strong> To connect a real Meta Ads account, add <code className="bg-slate-100 px-1 py-0.5 rounded">META_APP_ID</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">META_APP_SECRET</code> to your environment variables.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


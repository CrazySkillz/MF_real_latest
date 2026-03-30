import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SiFacebook } from "react-icons/si";
import { AlertCircle, RefreshCw, Briefcase, Loader2 } from "lucide-react";
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
  const [showCampaignSelection, setShowCampaignSelection] = useState(false);
  const [metaCampaigns, setMetaCampaigns] = useState<Array<{ id: string; name: string; status?: string; selected: boolean }>>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
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

      // Move to campaign selection
      setShowCampaignSelection(true);
      setLoadingCampaigns(true);
      try {
        const res = await fetch(`/api/meta/${campaignId}/campaigns`);
        const json = await res.json().catch(() => ({}));
        if (Array.isArray(json?.campaigns)) {
          setMetaCampaigns(json.campaigns.map((c: any) => ({ id: c.id, name: c.name, status: c.status, selected: true })));
        }
      } catch {
        // If can't load campaigns, still complete
        toast({ title: "Meta Connected!", description: "Campaign selection available later." });
        onSuccess();
        return;
      } finally {
        setLoadingCampaigns(false);
      }
    } catch (error: any) {
      console.error("Failed to connect ad account:", error);
      onError(error.message || "Failed to connect selected ad account");
    } finally {
      setIsConnecting(false);
    }
  }, [campaignId, selectedAdAccount, adAccounts, onSuccess, onError, toast]);

  // Campaign selection step
  if (showCampaignSelection) {
    const selectedCount = metaCampaigns.filter(c => c.selected).length;
    const handleSaveSelection = async () => {
      setSavingSelection(true);
      try {
        const selectedIds = metaCampaigns.filter(c => c.selected).map(c => c.id);
        const res = await fetch(`/api/meta/${campaignId}/selected-campaigns`, {
          method: 'PATCH', credentials: "include",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedCampaignIds: selectedIds }),
        });
        if (!res.ok) throw new Error('Failed to save selection');
        toast({ title: 'Meta Connected!', description: `${selectedCount} campaign${selectedCount !== 1 ? 's' : ''} selected.` });
        onSuccess();
      } catch (err: any) {
        toast({ title: 'Failed to save', description: err.message, variant: 'destructive' as const });
      } finally {
        setSavingSelection(false);
      }
    };

    return (
      <Card className="w-full border border-border">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2 justify-center">
            <SiFacebook className="w-5 h-5 text-blue-600" />
            Select Meta Campaigns
          </CardTitle>
          <CardDescription>
            Choose which campaigns to include in this MetricMind campaign. Only selected campaigns' metrics will be imported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCampaigns ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading campaigns...
            </div>
          ) : metaCampaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              <p>No campaigns found yet. Data will be available after the first import.</p>
              <Button className="mt-3" onClick={() => { toast({ title: 'Meta Connected!' }); onSuccess(); }}>
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={metaCampaigns.every(c => c.selected)}
                  onCheckedChange={(checked) => setMetaCampaigns(metaCampaigns.map(c => ({ ...c, selected: !!checked })))}
                />
                <Label className="text-sm font-medium">Select all ({metaCampaigns.length})</Label>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
                {metaCampaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted rounded">
                    <Checkbox
                      checked={c.selected}
                      onCheckedChange={(checked) => setMetaCampaigns(metaCampaigns.map(x => x.id === c.id ? { ...x, selected: !!checked } : x))}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                    </div>
                    {c.status && (
                      <span className="text-xs text-muted-foreground shrink-0">{c.status}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSelection} disabled={selectedCount === 0 || savingSelection}>
                  {savingSelection && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Connect {selectedCount} Campaign{selectedCount !== 1 ? 's' : ''}
                </Button>
                <Button variant="ghost" onClick={() => { toast({ title: 'Meta Connected!' }); onSuccess(); }}>
                  Skip (import all)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show ad account selection if we have accounts
  if (adAccounts.length > 0) {
    return (
      <Card className="w-full border border-border">
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
    <Card className="w-full border border-border">
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
            <p className="text-xs text-muted-foreground text-center">
              Loading test ad accounts with realistic metrics...
            </p>
          )}
          
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Production Setup:</strong> To connect a real Meta Ads account, add <code className="bg-muted px-1 py-0.5 rounded">META_APP_ID</code> and <code className="bg-muted px-1 py-0.5 rounded">META_APP_SECRET</code> to your environment variables.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


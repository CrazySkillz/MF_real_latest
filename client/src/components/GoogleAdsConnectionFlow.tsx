/**
 * Google Ads Connection Flow
 * OAuth-based connection to Google Ads API with test mode support
 * Only handles the connection setup (idle, connecting, select-customer).
 * Connected state display is handled by the platform card system in campaign-detail.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CustomerAccount {
  id: string;
  descriptiveName: string;
  manager: boolean;
}

interface GoogleAdsConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess?: () => void;
  onError?: (error: string) => void;
}

const MOCK_CUSTOMERS: CustomerAccount[] = [
  { id: '123-456-7890', descriptiveName: 'Test Google Ads Account', manager: false },
  { id: '987-654-3210', descriptiveName: 'Test MCC Account', manager: true },
];

export function GoogleAdsConnectionFlow({
  campaignId,
  onConnectionSuccess,
  onError,
}: GoogleAdsConnectionFlowProps) {
  const [step, setStep] = useState<'idle' | 'connecting' | 'select-customer'>('idle');
  const [isTestMode, setIsTestMode] = useState(false);
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [pendingTokens, setPendingTokens] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle OAuth popup messages
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const { type, tokens, customers: customerList, error } = event.data || {};

    if (type === 'google_ads_auth_success') {
      setPendingTokens(tokens);
      if (customerList && customerList.length > 0) {
        setCustomers(customerList);
        if (customerList.length === 1) {
          setSelectedCustomerId(customerList[0].id);
        }
        setStep('select-customer');
      } else {
        setCustomers([]);
        setStep('select-customer');
      }
    } else if (type === 'google_ads_auth_error') {
      setStep('idle');
      toast({ title: 'Connection Failed', description: error || 'OAuth error', variant: 'destructive' });
      onError?.(error || 'OAuth error');
    }
  }, [toast, onError]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Start OAuth flow
  const startOAuth = async () => {
    setStep('connecting');

    if (isTestMode) {
      await new Promise(r => setTimeout(r, 1000));
      setCustomers(MOCK_CUSTOMERS);
      setPendingTokens(null);
      setStep('select-customer');
      return;
    }

    try {
      const res = await fetch('/api/auth/google-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to start OAuth');
      }

      const { authUrl } = await res.json();

      const popup = window.open(authUrl, 'google_ads_oauth', 'width=500,height=600,scrollbars=yes');
      if (!popup) {
        toast({ title: 'Popup Blocked', description: 'Please allow popups for this site.', variant: 'destructive' });
        setStep('idle');
        return;
      }

      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          if (step === 'connecting') setStep('idle');
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        if (!popup.closed) popup.close();
        if (step === 'connecting') {
          setStep('idle');
          toast({ title: 'Connection Timeout', description: 'OAuth flow timed out.', variant: 'destructive' });
        }
      }, 300000);
    } catch (err: any) {
      setStep('idle');
      toast({ title: 'Connection Error', description: err.message, variant: 'destructive' });
    }
  };

  // Select customer mutation
  const selectCustomerMutation = useMutation({
    mutationFn: async () => {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (!selected) throw new Error('Select a customer account');

      if (isTestMode) {
        const res = await fetch(`/api/google-ads/${campaignId}/connect-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: selected.id,
            customerName: selected.descriptiveName,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to connect test account');
        }
        return res.json();
      }

      const res = await fetch(`/api/google-ads/${campaignId}/select-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selected.id,
          customerName: selected.descriptiveName,
          accessToken: pendingTokens?.accessToken,
          refreshToken: pendingTokens?.refreshToken,
          expiresIn: pendingTokens?.expiresIn,
          managerAccountId: selected.manager ? selected.id : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to connect account');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-ads', campaignId, 'connection'] });
      toast({ title: 'Google Ads Connected!', description: `Account connected successfully.` });
      onConnectionSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: 'Connection Failed', description: err.message, variant: 'destructive' });
    },
  });

  // Customer selection step
  if (step === 'select-customer') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <i className="fab fa-google text-yellow-600 text-lg" />
            <CardTitle className="text-base">Select Google Ads Account</CardTitle>
          </div>
          <CardDescription>Choose which customer account to connect</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length > 0 ? (
            <div className="space-y-3">
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.descriptiveName} ({c.id})
                      {c.manager && ' [Manager]'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={() => selectCustomerMutation.mutate()}
                  disabled={!selectedCustomerId || selectCustomerMutation.isPending}
                >
                  {selectCustomerMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Connect Account
                </Button>
                <Button variant="ghost" onClick={() => { setStep('idle'); setCustomers([]); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              <p>No accessible customer accounts found. Make sure your Google account has access to a Google Ads account.</p>
              <Button variant="ghost" className="mt-2" onClick={() => setStep('idle')}>Back</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Idle / connecting state
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <i className="fab fa-google text-yellow-600 text-lg" />
          <CardTitle className="text-base">Google Ads</CardTitle>
        </div>
        <CardDescription>
          Connect your Google Ads account to import campaign metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isTestMode}
              onCheckedChange={setIsTestMode}
              id="google-ads-test-mode"
            />
            <Label htmlFor="google-ads-test-mode" className="text-xs text-slate-500">
              Test Mode (use simulated data)
            </Label>
          </div>
          <Button
            onClick={startOAuth}
            disabled={step === 'connecting'}
            className="w-full"
          >
            {step === 'connecting' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <i className="fab fa-google mr-2" />
                {isTestMode ? 'Connect Test Account' : 'Connect with Google'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

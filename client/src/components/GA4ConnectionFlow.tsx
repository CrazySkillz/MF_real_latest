/**
 * GA4 Connection Flow
 * OAuth-based connection to Google Analytics 4 with test mode support.
 * Simplified single-button flow (like Google Ads) — no manual tokens or service accounts in the UI.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

interface GA4ConnectionFlowProps {
  campaignId: string;
  onConnectionSuccess?: () => void;
}

interface GA4Property {
  id: string;
  name: string;
  account?: string;
}

const MOCK_PROPERTIES: GA4Property[] = [
  { id: '123456789', name: 'Test GA4 Property', account: 'Test Account' },
  { id: '987654321', name: 'Test Staging Property', account: 'Test Account' },
];

export function GA4ConnectionFlow({ campaignId, onConnectionSuccess }: GA4ConnectionFlowProps) {
  const [step, setStep] = useState<'idle' | 'connecting' | 'select-property' | 'filter'>('idle');
  const [isTestMode, setIsTestMode] = useState(false);
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');

  // Campaign filter state (kept from original)
  const [ga4CampaignFilter, setGa4CampaignFilter] = useState<string[]>([]);
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<Array<{ name: string; users: number }>>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [didLoadCampaigns, setDidLoadCampaigns] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Prefill GA4 campaign filter with the campaign name
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}`);
        if (!resp.ok) return;
        const c = await resp.json().catch(() => null);
        if (!mounted || !c) return;
        const existing = String(c.ga4CampaignFilter || '').trim();
        const fallback = String(c.name || '').trim();
        const raw = existing || fallback;
        if (raw.startsWith('[') && raw.endsWith(']')) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setGa4CampaignFilter(parsed.map((v: any) => String(v || '').trim()).filter(Boolean));
              return;
            }
          } catch { /* fall through */ }
        }
        setGa4CampaignFilter(raw ? [raw] : []);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [campaignId]);

  // Load available GA4 campaigns when entering filter step
  const loadGa4CampaignValues = async () => {
    setIsLoadingCampaigns(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-campaign-values?dateRange=30days&limit=50`);
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) return;
      const rows = Array.isArray(json.campaigns) ? json.campaigns : [];
      setAvailableCampaigns(rows);
    } catch {
      // ignore
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (step !== 'filter') return;
    if (didLoadCampaigns) return;
    setDidLoadCampaigns(true);
    void loadGa4CampaignValues();
  }, [step, didLoadCampaigns]);

  const saveCampaignFilter = async () => {
    const values = ga4CampaignFilter.map(v => v.trim()).filter(Boolean);
    if (values.length === 0) {
      toast({
        title: "Campaign filter required",
        description: "Select at least one GA4 campaign name (typically your utm_campaign value).",
        variant: "destructive",
      });
      return;
    }

    setIsSavingFilter(true);
    try {
      const filterValue = values.length === 1 ? values[0] : JSON.stringify(values);
      await apiRequest("PATCH", `/api/campaigns/${campaignId}`, { ga4CampaignFilter: filterValue });
      toast({
        title: "GA4 campaign(s) selected",
        description: values.length === 1
          ? "MetricMind will now filter GA4 analytics to this campaign only."
          : `MetricMind will now filter GA4 analytics to ${values.length} campaigns.`,
      });
      onConnectionSuccess?.();
    } catch (e: any) {
      toast({
        title: "Failed to save filter",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingFilter(false);
    }
  };

  // Handle OAuth popup messages from server callback
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const { type, properties: propertyList, error } = event.data || {};

    if (type === 'ga4_auth_success') {
      if (propertyList && propertyList.length > 0) {
        setProperties(propertyList);
        if (propertyList.length === 1) {
          setSelectedProperty(propertyList[0].id);
        }
        setStep('select-property');
      } else {
        setProperties([]);
        setStep('select-property');
      }
      toast({ title: 'Authenticated!', description: 'Select your GA4 property to continue.' });
    } else if (type === 'ga4_auth_error') {
      setStep('idle');
      toast({ title: 'Connection Failed', description: error || 'OAuth error', variant: 'destructive' });
    }
  }, [toast, campaignId]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Start OAuth flow
  const startOAuth = async () => {
    setStep('connecting');

    if (isTestMode) {
      await new Promise(r => setTimeout(r, 1000));
      setProperties(MOCK_PROPERTIES);
      setStep('select-property');
      return;
    }

    try {
      const res = await fetch('/api/auth/ga4/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to start OAuth');
      }

      const { authUrl } = await res.json();

      const popup = window.open(authUrl, 'ga4_oauth', 'width=500,height=600,scrollbars=yes');
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

  // Select property and advance to campaign filter
  const handlePropertySelection = async () => {
    if (!selectedProperty) {
      toast({ title: 'Property Required', description: 'Please select a GA4 property.', variant: 'destructive' });
      return;
    }

    if (isTestMode) {
      // Skip server call in test mode, go directly to filter
      toast({ title: 'GA4 Connected!', description: 'Test property selected. Choose campaigns to track.' });
      setStep('filter');
      return;
    }

    try {
      const response = await fetch('/api/ga4/select-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, propertyId: selectedProperty }),
      });
      const data = await response.json();

      if (data.success) {
        toast({ title: 'GA4 Connected!', description: 'Property connected. Now select campaigns to track.' });
        setStep('filter');
      } else {
        throw new Error(data.error || 'Failed to connect property');
      }
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect property. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // ==================== FILTER STEP ====================
  if (step === 'filter') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Choose GA4 campaigns to track</CardTitle>
          <CardDescription>
            GA4 properties include many campaigns. Select one or more GA4 campaigns for MetricMind to track.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-campaign-filter">GA4 Campaign name(s) (utm_campaign)</Label>
            {availableCampaigns.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGa4CampaignFilter(availableCampaigns.map(c => c.name))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGa4CampaignFilter([])}
                  >
                    Clear
                  </Button>
                  <span className="text-xs text-slate-500 ml-auto">
                    {ga4CampaignFilter.length} of {availableCampaigns.length} selected
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {availableCampaigns.map((c) => {
                    const checked = ga4CampaignFilter.includes(c.name);
                    return (
                      <label
                        key={c.name}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setGa4CampaignFilter(prev => [...prev, c.name]);
                            } else {
                              setGa4CampaignFilter(prev => prev.filter(v => v !== c.name));
                            }
                          }}
                        />
                        <span className="text-sm flex-1">{c.name}</span>
                        <span className="text-xs text-slate-500">{c.users.toLocaleString()} users</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Input
                id="ga4-campaign-filter"
                value={ga4CampaignFilter[0] || ''}
                onChange={(e) => setGa4CampaignFilter(e.target.value ? [e.target.value] : [])}
                placeholder={isLoadingCampaigns ? "Loading campaigns\u2026" : "e.g., brand_awareness"}
              />
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tip: This usually matches the UTM campaign used in your links (e.g., <code className="px-1">utm_campaign</code>).
            </p>
          </div>
          <Button className="w-full" onClick={saveCampaignFilter} disabled={isSavingFilter || ga4CampaignFilter.length === 0}>
            {isSavingFilter ? "Saving..." : ga4CampaignFilter.length > 1 ? `Save ${ga4CampaignFilter.length} campaigns` : "Save and finish"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ==================== SELECT PROPERTY STEP ====================
  if (step === 'select-property') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base">Select GA4 Property</CardTitle>
          </div>
          <CardDescription>Choose which analytics property to connect</CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length > 0 ? (
            <div className="space-y-3">
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.id})
                      {p.account && ` — ${p.account}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={handlePropertySelection}
                  disabled={!selectedProperty}
                >
                  Connect Property
                </Button>
                <Button variant="ghost" onClick={() => { setStep('idle'); setProperties([]); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              <p>No GA4 properties found. Make sure your Google account has access to a GA4 property.</p>
              <Button variant="ghost" className="mt-2" onClick={() => setStep('idle')}>Back</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ==================== IDLE / CONNECTING STEP ====================
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-base">Google Analytics</CardTitle>
        </div>
        <CardDescription>
          Connect your GA4 property to import analytics and performance data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isTestMode}
              onCheckedChange={setIsTestMode}
              id="ga4-test-mode"
            />
            <Label htmlFor="ga4-test-mode" className="text-sm cursor-pointer">
              Test mode {isTestMode && <span className="text-xs text-slate-500">(mock data)</span>}
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
              'Connect with Google'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

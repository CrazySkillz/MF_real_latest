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

  // Lookback window — how many days of historical data to import
  const [lookbackDays, setLookbackDays] = useState<number>(90);

  // Campaign filter state (kept from original)
  const [ga4CampaignFilter, setGa4CampaignFilter] = useState<string[]>([]);
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<Array<{ name: string; users: number }>>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [didLoadCampaigns, setDidLoadCampaigns] = useState(false);
  const [manualCampaignInput, setManualCampaignInput] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // On mount, check if GA4 is already authenticated but needs property selection.
  // Only runs once on mount — do NOT add `step` to deps or it creates an infinite loop
  // when the user clicks "Back" from an empty property selector.
  useEffect(() => {
    let mounted = true;
    console.log('[GA4Flow] Mount effect running, campaignId:', campaignId);
    (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/ga4-connection-status`);
        if (!resp.ok) {
          console.log('[GA4Flow] Mount: ga4-connection-status returned', resp.status);
          return;
        }
        const data = await resp.json();
        console.log('[GA4Flow] Mount: ga4-connection-status =', JSON.stringify({ connected: data.connected, propertyId: data.propertyId, propertiesCount: (data.properties || []).length }));
        if (!mounted) return;
        // Already authenticated but no property selected — jump to property selector
        if (data.connected && !data.propertyId) {
          const validProps = (data.properties || []).filter((p: GA4Property) => p.id);
          console.log('[GA4Flow] Mount: connected but no propertyId, validProps:', validProps.length);
          if (validProps.length > 0) {
            setProperties(validProps);
            if (validProps.length === 1) {
              setSelectedProperty(validProps[0].id);
            }
            setStep('select-property');
          }
          // If no valid properties, stay in 'idle' so user can click "Connect" for a fresh OAuth flow
        }
      } catch (err) {
        console.error('[GA4Flow] Mount: error checking status:', err);
      }
    })();
    return () => { mounted = false; };
  }, [campaignId]);

  // Load existing GA4 campaign filter (only if previously saved — do NOT prefill with campaign name)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}`);
        if (!resp.ok) return;
        const c = await resp.json().catch(() => null);
        if (!mounted || !c) return;
        const existing = String(c.ga4CampaignFilter || '').trim();
        if (!existing) return; // No saved filter — leave empty so user picks from GA4 data
        if (existing.startsWith('[') && existing.endsWith(']')) {
          try {
            const parsed = JSON.parse(existing);
            if (Array.isArray(parsed)) {
              setGa4CampaignFilter(parsed.map((v: any) => String(v || '').trim()).filter(Boolean));
              return;
            }
          } catch { /* fall through */ }
        }
        setGa4CampaignFilter([existing]);
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
      const params = new URLSearchParams({ dateRange: '30days', limit: '50' });
      if (selectedProperty) params.set('propertyId', selectedProperty);
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-campaign-values?${params}`);
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) {
        console.warn('[GA4] Campaign values fetch failed:', json?.error || resp.status);
        return;
      }
      const rows = Array.isArray(json.campaigns) ? json.campaigns : [];
      setAvailableCampaigns(rows);
      // Clear any prefilled filter values that don't match actual GA4 campaigns
      if (rows.length > 0) {
        const validNames = new Set(rows.map((c: { name: string }) => c.name));
        setGa4CampaignFilter(prev => prev.filter(name => validNames.has(name)));
      }
    } catch (err) {
      console.warn('[GA4] Campaign values fetch error:', err);
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
      console.log('[GA4Flow] Saving campaign filter:', filterValue);
      await apiRequest("PATCH", `/api/campaigns/${campaignId}`, { ga4CampaignFilter: filterValue });
      console.log('[GA4Flow] Filter saved! Invalidating queries and calling onConnectionSuccess');
      // Invalidate all GA4-related queries so badge and analytics update
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'connected-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ga4/check-connection', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
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
    if (event.origin !== window.location.origin) {
      console.log('[GA4Flow] postMessage IGNORED: origin mismatch', event.origin, '!==', window.location.origin);
      return;
    }
    const { type, properties: propertyList, error } = event.data || {};
    console.log('[GA4Flow] postMessage received:', { type, propertiesCount: (propertyList || []).length, error });

    if (type === 'ga4_auth_success') {
      const validProperties = (propertyList || []).filter((p: GA4Property) => p.id);
      console.log('[GA4Flow] Auth success! validProperties:', validProperties.length, validProperties.map((p: GA4Property) => p.id));
      if (validProperties.length > 0) {
        setProperties(validProperties);
        if (validProperties.length === 1) {
          setSelectedProperty(validProperties[0].id);
        }
        setStep('select-property');
      } else {
        console.log('[GA4Flow] Auth success but NO valid properties — showing empty property selector');
        setProperties([]);
        setStep('select-property');
      }
      toast({ title: 'Authenticated!', description: 'Select your GA4 property to continue.' });
    } else if (type === 'ga4_auth_error') {
      console.log('[GA4Flow] Auth error:', error);
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
    console.log('[GA4Flow] startOAuth called, campaignId:', campaignId, 'isTestMode:', isTestMode);
    setStep('connecting');

    if (isTestMode) {
      await new Promise(r => setTimeout(r, 1000));
      setProperties(MOCK_PROPERTIES);
      setStep('select-property');
      return;
    }

    try {
      const res = await fetch('/api/auth/ga4/connect', {
        method: 'POST', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      console.log('[GA4Flow] /api/auth/ga4/connect response:', res.status);

      if (!res.ok) {
        const data = await res.json();
        console.error('[GA4Flow] Connect endpoint failed:', data);
        throw new Error(data.message || 'Failed to start OAuth');
      }

      const { authUrl } = await res.json();
      console.log('[GA4Flow] Got authUrl, opening popup...');

      const popup = window.open(authUrl, 'ga4_oauth', 'width=500,height=600,scrollbars=yes');
      if (!popup) {
        console.error('[GA4Flow] Popup was BLOCKED');
        toast({ title: 'Popup Blocked', description: 'Please allow popups for this site.', variant: 'destructive' });
        setStep('idle');
        return;
      }
      console.log('[GA4Flow] Popup opened successfully, waiting for postMessage...');

      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          // Use functional update to read CURRENT state — the closure captures a stale value
          setStep(current => {
            console.log('[GA4Flow] Popup closed, current step:', current, current === 'connecting' ? '→ resetting to idle' : '→ keeping current step');
            return current === 'connecting' ? 'idle' : current;
          });
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        if (!popup.closed) popup.close();
        setStep(current => {
          if (current === 'connecting') {
            console.log('[GA4Flow] 5min timeout hit, resetting to idle');
            toast({ title: 'Connection Timeout', description: 'OAuth flow timed out.', variant: 'destructive' });
            return 'idle';
          }
          return current;
        });
      }, 300000);
    } catch (err: any) {
      console.error('[GA4Flow] startOAuth error:', err);
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
      console.log('[GA4Flow] Selecting property:', selectedProperty, 'for campaign:', campaignId);
      const response = await fetch('/api/ga4/select-property', {
        method: 'POST', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ campaignId, propertyId: selectedProperty, lookbackDays }),
      });
      const data = await response.json();
      console.log('[GA4Flow] select-property response:', JSON.stringify(data));

      if (data.success) {
        console.log('[GA4Flow] Property selected! Invalidating queries and advancing to filter step');
        // Invalidate so badge updates to "Connected" immediately
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'connected-platforms'] });
        queryClient.invalidateQueries({ queryKey: ['/api/ga4/check-connection', campaignId] });
        toast({ title: 'GA4 Connected!', description: 'Property connected. Now select campaigns to track.' });
        setStep('filter');
      } else {
        console.error('[GA4Flow] select-property FAILED:', data);
        throw new Error(data.error || 'Failed to connect property');
      }
    } catch (error: any) {
      console.error('[GA4Flow] handlePropertySelection error:', error);
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
          <CardTitle>Select campaigns to import</CardTitle>
          <CardDescription>
            Select one or more GA4 campaigns to import metrics for. These typically match your utm_campaign values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-campaign-filter">GA4 Campaign name(s)</Label>
            {isLoadingCampaigns ? (
              <div className="flex items-center justify-center py-8 border rounded-md">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-muted-foreground">Loading campaigns from GA4...</span>
              </div>
            ) : availableCampaigns.length > 0 ? (
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
                  <span className="text-xs text-muted-foreground ml-auto">
                    {ga4CampaignFilter.length} of {availableCampaigns.length} selected
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {availableCampaigns.map((c) => {
                    const checked = ga4CampaignFilter.includes(c.name);
                    return (
                      <label
                        key={c.name}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
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
                        <span className="text-xs text-muted-foreground">{c.users.toLocaleString()} users</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No UTM campaigns found in this GA4 property for the last 30 days. You can retry or add campaign names manually.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDidLoadCampaigns(false);
                    setAvailableCampaigns([]);
                  }}
                >
                  Retry
                </Button>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="ga4-campaign-filter"
                      value={manualCampaignInput}
                      onChange={(e) => setManualCampaignInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualCampaignInput.trim()) {
                          e.preventDefault();
                          const name = manualCampaignInput.trim();
                          if (!ga4CampaignFilter.includes(name)) {
                            setGa4CampaignFilter(prev => [...prev, name]);
                          }
                          setManualCampaignInput('');
                        }
                      }}
                      placeholder="e.g., brand_awareness"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const name = manualCampaignInput.trim();
                        if (name && !ga4CampaignFilter.includes(name)) {
                          setGa4CampaignFilter(prev => [...prev, name]);
                        }
                        setManualCampaignInput('');
                      }}
                      disabled={!manualCampaignInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  {ga4CampaignFilter.length > 0 && (
                    <div className="border rounded-md p-2 space-y-1">
                      {ga4CampaignFilter.map((name) => (
                        <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted">
                          <Checkbox
                            checked={true}
                            onCheckedChange={() => setGa4CampaignFilter(prev => prev.filter(v => v !== name))}
                          />
                          <span className="text-sm flex-1">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={saveCampaignFilter} disabled={isSavingFilter || isLoadingCampaigns || ga4CampaignFilter.length === 0}>
              {isSavingFilter ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : ga4CampaignFilter.length > 1 ? (
                `Import ${ga4CampaignFilter.length} campaigns`
              ) : (
                'Import metrics'
              )}
            </Button>
            <Button variant="ghost" onClick={() => setStep('select-property')}>
              Back
            </Button>
          </div>
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
                  {properties.filter(p => p.id).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.id})
                      {p.account && ` — ${p.account}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Label className="text-sm">Import historical data</Label>
                <div className="flex gap-2">
                  {[30, 60, 90].map((days) => (
                    <Button
                      key={days}
                      variant={lookbackDays === days ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLookbackDays(days)}
                    >
                      {days} days
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">How far back to fetch GA4 data. Default: 90 days.</p>
              </div>
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
            <div className="text-sm text-muted-foreground">
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
              Test mode {isTestMode && <span className="text-xs text-muted-foreground">(mock data)</span>}
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

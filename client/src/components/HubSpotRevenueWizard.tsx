import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

type HubSpotProperty = {
  name: string;
  label: string;
  type: string;
  fieldType: string;
};

type UniqueValue = {
  value: string;
  count: number;
};

export function HubSpotRevenueWizard(props: {
  campaignId: string;
  onBack?: () => void;
  onSuccess?: (result: any) => void;
}) {
  const { campaignId, onBack, onSuccess } = props;
  const { toast } = useToast();

  const [step, setStep] = useState<"connect" | "configure" | "crosswalk" | "review">("connect");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [portalName, setPortalName] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);

  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [campaignProperty, setCampaignProperty] = useState<string>("");
  const [revenueProperty, setRevenueProperty] = useState<string>("amount");
  const [days, setDays] = useState<number>(90);

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);

  const connectStatusLabel = useMemo(() => {
    if (portalName) return portalName;
    if (portalId) return portalId;
    return null;
  }, [portalName, portalId]);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/hubspot/${campaignId}/status`);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to check HubSpot connection");
    if (json?.connected) {
      setPortalName(json?.portalName || null);
      setPortalId(json?.portalId || null);
      return true;
    }
    return false;
  };

  const fetchProperties = async () => {
    const resp = await fetch(`/api/hubspot/${campaignId}/deals/properties`);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to load deal properties");
    const props = Array.isArray(json?.properties) ? json.properties : [];
    setProperties(props);
    return props as HubSpotProperty[];
  };

  const fetchUniqueValues = async (propertyName: string) => {
    setValuesLoading(true);
    try {
      const resp = await fetch(
        `/api/hubspot/${campaignId}/deals/unique-values?property=${encodeURIComponent(propertyName)}&days=${encodeURIComponent(
          String(days)
        )}&limit=300`
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load values");
      const vals = Array.isArray(json?.values) ? json.values : [];
      setUniqueValues(vals);
      // Keep only selections that still exist
      const allowed = new Set(vals.map((v: any) => String(v.value)));
      setSelectedValues((prev) => prev.filter((v) => allowed.has(v)));
    } finally {
      setValuesLoading(false);
    }
  };

  const openOAuthWindow = async () => {
    setIsConnecting(true);
    try {
      const resp = await fetch("/api/auth/hubspot/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || "Failed to start HubSpot OAuth");
      const authUrl = json?.authUrl;
      if (!authUrl) throw new Error("No auth URL returned");

      const w = window.open(authUrl, "hubspot_oauth", "width=520,height=680");
      if (!w) throw new Error("Popup blocked. Please allow popups and try again.");

      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data: any = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "hubspot_auth_success") {
          window.removeEventListener("message", onMessage);
          await fetchStatus();
          toast({
            title: "HubSpot Connected",
            description: "Now select the HubSpot field used to attribute deals to this campaign.",
          });
          setStep("configure");
        } else if (data.type === "hubspot_auth_error") {
          window.removeEventListener("message", onMessage);
          toast({
            title: "HubSpot Connection Failed",
            description: data.error || "Please try again.",
            variant: "destructive",
          });
        }
      };

      window.addEventListener("message", onMessage);
    } catch (err: any) {
      toast({
        title: "HubSpot Connection Failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // On mount: if already connected, jump to configure
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const connected = await fetchStatus();
        if (!mounted) return;
        if (connected) setStep("configure");
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  // When entering configure step, load properties once
  useEffect(() => {
    if (step !== "configure") return;
    if (properties.length > 0) return;
    (async () => {
      try {
        await fetchProperties();
      } catch (err: any) {
        toast({
          title: "Failed to Load HubSpot Fields",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    })();
  }, [step, properties.length, toast]);

  const campaignPropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === campaignProperty);
    return p?.label || campaignProperty || "Campaign field";
  }, [properties, campaignProperty]);

  const save = async () => {
    setIsSaving(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/hubspot/save-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignProperty,
          selectedValues,
          revenueProperty,
          days,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to save mappings");

      toast({
        title: "HubSpot Mappings Saved",
        description: `Conversion value calculated: $${json?.conversionValue || "0"} per conversion.`,
      });
      onSuccess?.(json);
    } catch (err: any) {
      toast({
        title: "Failed to Save HubSpot Mappings",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === "connect" && (
        <Card>
          <CardHeader>
            <CardTitle>Connect HubSpot</CardTitle>
            <CardDescription>
              Connect your HubSpot account so MetricMind can read Deals and calculate revenue metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button onClick={() => void openOAuthWindow()} disabled={isConnecting}>
              {isConnecting ? "Connecting…" : "Connect HubSpot"}
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack} disabled={isConnecting}>
                Back
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Deal Attribution</CardTitle>
            <CardDescription>
              {connectStatusLabel ? `Connected: ${connectStatusLabel}. ` : ""}Select the HubSpot Deal field that contains your LinkedIn campaign
              identifier (or any field you want to use to attribute deals to this MetricMind campaign).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>HubSpot field used to attribute deals to this campaign</Label>
                <Select value={campaignProperty} onValueChange={(v) => setCampaignProperty(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a HubSpot deal field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.label} ({p.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Revenue field</Label>
                <Select value={revenueProperty} onValueChange={(v) => setRevenueProperty(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties
                      .filter((p) => p.type === "number" || p.name === "amount")
                      .map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.label} ({p.name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500">Default: Deal amount.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lookback window (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(Math.min(Math.max(parseInt(e.target.value || "90", 10) || 90, 1), 3650))}
                />
                <div className="text-xs text-slate-500">Default: last 90 days (Closed Won).</div>
              </div>
              <div className="text-xs text-slate-500 self-end">
                Currency default: one currency per campaign. If mixed currencies are detected, we’ll ask you to filter in HubSpot.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  if (!campaignProperty) {
                    toast({ title: "Select a field", description: "Choose the HubSpot field used for attribution first.", variant: "destructive" });
                    return;
                  }
                  await fetchUniqueValues(campaignProperty);
                  setStep("crosswalk");
                }}
                disabled={!campaignProperty}
              >
                Continue
              </Button>
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Back
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "crosswalk" && (
        <Card>
          <CardHeader>
            <CardTitle>Crosswalk (Multi-select)</CardTitle>
            <CardDescription>
              Choose the value(s) from <strong>{campaignPropertyLabel}</strong> that should map to this MetricMind campaign. This does not need to match
              the MetricMind campaign name.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-slate-600">
                Selected: <strong>{selectedValues.length}</strong>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues(campaignProperty)} disabled={valuesLoading}>
                {valuesLoading ? "Refreshing…" : "Refresh values"}
              </Button>
            </div>

            <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
              {valuesLoading ? (
                <div className="text-sm text-slate-500">Loading values…</div>
              ) : uniqueValues.length === 0 ? (
                <div className="text-sm text-slate-500">No values found. Try increasing the lookback window.</div>
              ) : (
                <div className="space-y-2">
                  {uniqueValues.map((v) => {
                    const value = String(v.value);
                    const checked = selectedValues.includes(value);
                    return (
                      <div key={value} className="flex items-start gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            setSelectedValues((prev) => {
                              if (next) return Array.from(new Set([...prev, value]));
                              return prev.filter((x) => x !== value);
                            });
                          }}
                        />
                        <div className="flex-1">
                          <div className="text-sm">{value}</div>
                          <div className="text-xs text-slate-500">{v.count} deal(s)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (selectedValues.length === 0) {
                    toast({
                      title: "Select at least one value",
                      description: "Pick the HubSpot value(s) that should map to this campaign.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setStep("review");
                }}
                disabled={valuesLoading}
              >
                Continue
              </Button>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Save</CardTitle>
            <CardDescription>
              We’ll sum revenue from HubSpot deals that match your selections, then compute conversion value as Revenue ÷ LinkedIn Conversions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <div>
                <span className="text-slate-500">Attribution field:</span> <strong>{campaignPropertyLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500">Mapped values:</span> <strong>{selectedValues.length}</strong>
              </div>
              <div>
                <span className="text-slate-500">Revenue field:</span> <strong>{revenueProperty}</strong>
              </div>
              <div>
                <span className="text-slate-500">Lookback:</span> <strong>{days} days</strong>
              </div>
              <div className="text-xs text-slate-500">Default deal filter: Closed Won (best-effort across pipelines).</div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => void save()} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Mappings"}
              </Button>
              <Button variant="outline" onClick={() => setStep("crosswalk")} disabled={isSaving}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, DollarSign, Target, Link2, ClipboardCheck } from "lucide-react";

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
  onClose?: () => void;
}) {
  const { campaignId, onBack, onSuccess, onClose } = props;
  const { toast } = useToast();

  type Step = "campaign-field" | "crosswalk" | "revenue" | "review" | "complete";
  // UX: avoid an intermediate "Connect HubSpot" screen; start at Campaign field.
  const [step, setStep] = useState<Step>("campaign-field");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [portalName, setPortalName] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);

  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [campaignProperty, setCampaignProperty] = useState<string>("");
  const [revenueProperty, setRevenueProperty] = useState<string>("amount");
  // Default to offsite since the user is explicitly importing revenue in this flow.
  // Keep as an Advanced toggle to prevent double-counting when GA4 revenue is also present.
  const [revenueClassification, setRevenueClassification] = useState<"onsite_in_ga4" | "offsite_not_in_ga4">("offsite_not_in_ga4");
  const [days, setDays] = useState<number>(90);

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const steps = useMemo(
    () => [
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    []
  );

  const currentStepIndex = useMemo(() => {
    const idx = steps.findIndex((s) => s.id === step);
    if (idx >= 0) return idx;
    // complete step: treat as end
    return steps.length;
  }, [steps, step]);

  const connectStatusLabel = useMemo(() => {
    // UI requirement: show account name (not numeric portal ID)
    return portalName || null;
  }, [portalName]);

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
            description: "Now select the HubSpot deal field used to attribute deals to this campaign.",
          });
          setStep("campaign-field");
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
        if (connected) setStep("campaign-field");
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
    if (step !== "campaign-field" && step !== "revenue") return;
    if (!portalId) return; // don't fetch fields until connected
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
  }, [step, portalId, properties.length, toast]);

  const campaignPropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === campaignProperty);
    return p?.label || campaignProperty || "Campaign field";
  }, [properties, campaignProperty]);

  const revenuePropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === revenueProperty);
    return p?.label || revenueProperty || "Revenue field";
  }, [properties, revenueProperty]);

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
          revenueClassification,
          days,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to save mappings");

      toast({
        title: "HubSpot Mappings Saved",
        description: `Revenue connected: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      });
      setLastSaveResult(json);
      onSuccess?.(json);
      setStep("complete");
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

  const handleNext = async () => {
    if (step === "campaign-field") {
      if (!portalId) {
        toast({
          title: "Connect HubSpot",
          description: "Please connect HubSpot before selecting deal fields.",
          variant: "destructive",
        });
        return;
      }
      if (!campaignProperty) {
        toast({
          title: "Select a field",
          description: "Choose the HubSpot deal field used to attribute deals to this campaign.",
          variant: "destructive",
        });
        return;
      }
      await fetchUniqueValues(campaignProperty);
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      if (selectedValues.length === 0) {
        toast({
          title: "Select at least one value",
          description: "Pick the HubSpot value(s) that should map to this campaign.",
          variant: "destructive",
        });
        return;
      }
      setStep("revenue");
      return;
    }
    if (step === "revenue") {
      if (!revenueProperty) {
        toast({
          title: "Select a revenue field",
          description: "Choose the HubSpot field that represents revenue (usually Deal amount).",
          variant: "destructive",
        });
        return;
      }
      setStep("review");
      return;
    }
    if (step === "review") {
      await save();
    }
  };

  const handleBackStep = () => {
    if (step === "campaign-field") {
      onBack?.();
      if (!onBack) onClose?.();
      return;
    }
    if (step === "crosswalk") return setStep("campaign-field");
    if (step === "revenue") return setStep("crosswalk");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator (similar to GuidedColumnMapping) */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const isActive = s.id === step;
          const isCompleted = index < currentStepIndex;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p
                  className={`text-xs mt-2 text-center ${
                    isActive ? "text-blue-600 font-medium" : isCompleted ? "text-green-600" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-green-600" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {step === "campaign-field" && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Select Campaign Identifier Field
              </>
            )}
            {step === "crosswalk" && (
              <>
                <Link2 className="w-5 h-5 text-blue-600" />
                Link Campaign to HubSpot Value(s)
              </>
            )}
            {step === "revenue" && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                Select Revenue Field
              </>
            )}
            {step === "review" && (
              <>
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Save Mappings
              </>
            )}
            {step === "complete" && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Completed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {step === "campaign-field" &&
              `${connectStatusLabel ? `Connected: ${connectStatusLabel}. ` : "HubSpot is connected. "}Select the HubSpot deal field that identifies which deals belong to this MetricMind campaign.`}
            {step === "crosswalk" &&
              `Select the value(s) from “${campaignPropertyLabel}” that should map to this MetricMind campaign. (The value does not need to match the MetricMind campaign name.)`}
            {step === "revenue" && "Select the HubSpot field that represents revenue (usually Deal amount) and a lookback window."}
            {step === "review" && ""}
            {step === "complete" && "Conversion value is saved. Revenue metrics should now be unlocked in Overview."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "campaign-field" && (
            <div className="space-y-3">
              {!portalId && (
                <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900/30">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Connect HubSpot to continue
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    HubSpot must be connected before we can load Deal properties.
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button onClick={() => void openOAuthWindow()} disabled={isConnecting}>
                      {isConnecting ? "Connecting…" : "Connect HubSpot"}
                    </Button>
                    {onBack && (
                      <Button variant="outline" onClick={onBack} disabled={isConnecting}>
                        Back
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>HubSpot deal field used to attribute deals to this campaign</Label>
                <Select value={campaignProperty} onValueChange={(v) => setCampaignProperty(v)} disabled={!portalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a HubSpot deal field…" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {properties.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.label} ({p.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500">
                  Tip: pick the HubSpot property your team uses for “LinkedIn campaign” or “UTM campaign”.
                </div>
              </div>
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchUniqueValues(campaignProperty)}
                  disabled={valuesLoading}
                >
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

              <div className="text-xs text-slate-500">
                Default filter: Closed Won deals (best-effort across pipelines) within the last {days} days.
              </div>
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Revenue field</Label>
                <Select value={revenueProperty} onValueChange={(v) => setRevenueProperty(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
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

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Currency default: one currency per campaign. If mixed currencies are detected, we’ll ask you to filter in HubSpot.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded p-3">
                  <div className="space-y-2">
                    <Label>Lookback window (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={days}
                      onChange={(e) =>
                        setDays(Math.min(Math.max(parseInt(e.target.value || "90", 10) || 90, 1), 3650))
                      }
                    />
                    <div className="text-xs text-slate-500">
                      Default: last 90 days. This helps keep revenue mapping aligned to the time period you’re analyzing.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Revenue classification</Label>
                    <Select value={revenueClassification} onValueChange={(v: any) => setRevenueClassification(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="offsite_not_in_ga4">Offsite (NOT tracked in GA4)</SelectItem>
                        <SelectItem value="onsite_in_ga4">Onsite (also tracked in GA4)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-slate-500">
                      Default is Offsite. Change only if this HubSpot revenue is already included in GA4 to avoid double counting in campaign totals.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div />
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">
                Revenue connected:{" "}
                <strong>
                  ${Number(lastSaveResult?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    onClose?.();
                  }}
                >
                  Back to Campaign Overview
                </Button>
                <Button variant="outline" onClick={() => setStep("review")}>
                  View settings
                </Button>
              </div>
            </div>
          )}

          {/* Footer nav (hide on connect/complete) */}
          {step !== "connect" && step !== "complete" && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button onClick={() => void handleNext()} disabled={valuesLoading || isSaving}>
                {step === "review" ? (isSaving ? "Saving…" : "Save Mappings") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  mode?: "connect" | "edit";
  initialMappingConfig?: {
    campaignProperty?: string;
    selectedValues?: string[];
    revenueProperty?: string;
    conversionValueProperty?: string;
    valueSource?: string;
    days?: number;
    revenueClassification?: string;
    pipelineEnabled?: boolean;
    pipelineStageId?: string;
    pipelineStageLabel?: string;
  } | null;
  onBack?: () => void;
  onSuccess?: (result: any) => void;
  onClose?: () => void;
  /**
   * Used to prevent cross-platform leakage of revenue metrics.
   * Example: GA4 revenue sources must not unlock LinkedIn revenue metrics.
   */
  platformContext?: "ga4" | "linkedin";
}) {
  const { campaignId, mode = "connect", initialMappingConfig = null, onBack, onSuccess, onClose, platformContext = "ga4" } = props;
  const { toast } = useToast();
  const isLinkedIn = platformContext === "linkedin";

  type Step = "value-source" | "campaign-field" | "crosswalk" | "pipeline" | "revenue" | "review" | "complete";
  // UX: avoid an intermediate "Connect HubSpot" screen; start at Campaign field.
  const [step, setStep] = useState<Step>(isLinkedIn ? "value-source" : "campaign-field");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const [portalName, setPortalName] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);

  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [campaignProperty, setCampaignProperty] = useState<string>("");
  const [revenueProperty, setRevenueProperty] = useState<string>("amount");
  const [conversionValueProperty, setConversionValueProperty] = useState<string>(""); // retained for backward-compat (legacy saved configs)
  const [valueSource, setValueSource] = useState<"revenue" | "conversion_value">("revenue");
  const [pipelineEnabled, setPipelineEnabled] = useState<boolean>(false);
  const [pipelineStageId, setPipelineStageId] = useState<string>("");
  const [pipelineStageLabel, setPipelineStageLabel] = useState<string>("");
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  // Default to offsite since the user is explicitly importing revenue in this flow.
  // Keep as an Advanced toggle to prevent double-counting when GA4 revenue is also present.
  const [revenueClassification, setRevenueClassification] = useState<"onsite_in_ga4" | "offsite_not_in_ga4">("offsite_not_in_ga4");
  // Revenue is treated as revenue-to-date (campaign lifetime). Use a large lookback to avoid
  // forcing users to reason about windowing/date ranges in this flow.
  const [days] = useState<number>(3650);

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Edit mode: prefill from the saved mappingConfig and always start at Source (LinkedIn) for consistency.
  useEffect(() => {
    if (mode !== "edit") return;
    const cfg: any = initialMappingConfig || {};
    const nextCampaignProperty = cfg.campaignProperty ? String(cfg.campaignProperty) : "";
    const nextSelectedValues = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v: any) => String(v)) : [];
    const nextRevenueProperty = cfg.revenueProperty ? String(cfg.revenueProperty) : "amount";
    const nextConversionValueProperty = cfg.conversionValueProperty ? String(cfg.conversionValueProperty) : "";
    const nextValueSource: "revenue" | "conversion_value" =
      String(cfg.valueSource || "").trim().toLowerCase() === "conversion_value" ? "conversion_value" : "revenue";
    const nextRevenueClassification: any = cfg.revenueClassification ? String(cfg.revenueClassification) : null;
    const nextPipelineEnabled = cfg.pipelineEnabled === true;
    const nextPipelineStageId = cfg.pipelineStageId ? String(cfg.pipelineStageId) : "";
    const nextPipelineStageLabel = cfg.pipelineStageLabel ? String(cfg.pipelineStageLabel) : "";

    setStep(isLinkedIn ? "value-source" : "campaign-field");
    setCampaignProperty(nextCampaignProperty);
    setSelectedValues(nextSelectedValues);
    setRevenueProperty(nextRevenueProperty);
    setConversionValueProperty(nextConversionValueProperty);
    setValueSource(nextValueSource);
    setPipelineEnabled(nextPipelineEnabled);
    setPipelineStageId(nextPipelineStageId);
    setPipelineStageLabel(nextPipelineStageLabel);
    if (nextRevenueClassification === "onsite_in_ga4" || nextRevenueClassification === "offsite_not_in_ga4") {
      setRevenueClassification(nextRevenueClassification);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, mode, initialMappingConfig, isLinkedIn]);

  const steps = useMemo(
    () => [
      ...(isLinkedIn ? [{ id: "value-source" as const, label: "Source", icon: DollarSign }] : []),
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      { id: "pipeline" as const, label: "Pipeline (optional)", icon: Target },
      // Keep the stepper label stable to avoid layout shift (exec-grade UI polish).
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    [isLinkedIn]
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
      setIsConnected(true);
      return true;
    }
    setPortalName(null);
    setPortalId(null);
    setIsConnected(false);
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

  const fetchPipelines = async () => {
    setPipelinesLoading(true);
    try {
      const resp = await fetch(`/api/hubspot/${campaignId}/deals/pipelines`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load pipelines");
      const p = Array.isArray(json?.pipelines) ? json.pipelines : [];
      setPipelines(p);
      return p as any[];
    } finally {
      setPipelinesLoading(false);
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
          // Clear cached fields/values so the user sees fresh HubSpot data immediately (exec expectation).
          setProperties([]);
          setUniqueValues([]);
          setPipelines([]);
          toast({
            title: "HubSpot Connected",
            description: "Now select the HubSpot deal field used to attribute deals to this campaign.",
          });
          // Mode-first UX: do not skip the source-of-truth selection for LinkedIn.
          setStep(isLinkedIn ? "value-source" : "campaign-field");
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
        setStatusLoading(true);
        const connected = await fetchStatus();
        if (!mounted) return;
        // Mode-first UX: keep the user on the source-of-truth step for LinkedIn, even if already connected.
        if (connected && !isLinkedIn) setStep("campaign-field");
      } catch {
        // ignore
      } finally {
        if (!mounted) return;
        setStatusLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  // When entering configure step, load properties once
  useEffect(() => {
    if (step !== "campaign-field" && step !== "revenue") return;
    if (!isConnected) return; // don't fetch fields until connected
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

  // When entering pipeline step, load pipelines once (LinkedIn-only).
  useEffect(() => {
    if (step !== "pipeline") return;
    if (!isConnected) return;
    if (pipelines.length > 0) return;
    void (async () => {
      try {
        await fetchPipelines();
      } catch (err: any) {
        toast({
          title: "Failed to Load HubSpot Pipelines",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isConnected, pipelines.length, campaignId]);

  const campaignPropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === campaignProperty);
    return p?.label || campaignProperty || "Campaign field";
  }, [properties, campaignProperty]);

  const revenuePropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === revenueProperty);
    return p?.label || revenueProperty || "Revenue field";
  }, [properties, revenueProperty]);

  const conversionValuePropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === conversionValueProperty);
    return p?.label || conversionValueProperty || "Conversion value field";
  }, [properties, conversionValueProperty]);

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
          conversionValueProperty: isLinkedIn ? conversionValueProperty : null,
          valueSource: isLinkedIn ? valueSource : "revenue",
          revenueClassification,
          days,
          pipelineEnabled: isLinkedIn ? pipelineEnabled : false,
          pipelineStageId: isLinkedIn && pipelineEnabled ? pipelineStageId : null,
          pipelineStageLabel: isLinkedIn && pipelineEnabled ? (pipelineStageLabel || null) : null,
          platformContext,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to save mappings");

      toast({
        title: "HubSpot Mappings Saved",
        description:
          isLinkedIn && valueSource === "conversion_value"
            ? `Conversion value connected: ${Number(json?.conversionValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            : `Revenue connected: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
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
    if (step === "value-source") {
      // Keep selections mutually exclusive to reduce confusion.
      if (valueSource === "revenue") setConversionValueProperty("");
      setStep("campaign-field");
      return;
    }
    if (step === "campaign-field") {
      if (!isConnected) {
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
      setStep("pipeline");
      return;
    }
    if (step === "pipeline") {
      if (pipelineEnabled && !pipelineStageId) {
        toast({
          title: "Select a pipeline stage",
          description: "Choose the HubSpot stage that should count as “pipeline created”.",
          variant: "destructive",
        });
        return;
      }
      setStep("revenue");
      return;
    }
    if (step === "revenue") {
      if (isLinkedIn && valueSource === "conversion_value") {
        if (!conversionValueProperty) {
          toast({
            title: "Select a conversion value field",
            description: "Choose the HubSpot field that represents conversion value per conversion.",
            variant: "destructive",
          });
          return;
        }
      } else if (!revenueProperty) {
        toast({
          title: "Select a revenue field",
          description: "Choose the HubSpot field that represents deal amount.",
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
    if (step === "value-source") {
      onBack?.();
      if (!onBack) onClose?.();
      return;
    }
    if (step === "campaign-field") {
      if (isLinkedIn) return setStep("value-source");
      onBack?.();
      if (!onBack) onClose?.();
      return;
    }
    if (step === "crosswalk") return setStep("campaign-field");
    if (step === "pipeline") return setStep("crosswalk");
    if (step === "revenue") return setStep("pipeline");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Step Indicator (similar to GuidedColumnMapping) */}
      <div className="flex items-center justify-between shrink-0 mb-6">
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
                  className={`text-xs mt-2 text-center whitespace-nowrap ${
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
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {step === "value-source" && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                What should HubSpot provide?
              </>
            )}
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
            {step === "pipeline" && (
              <>
                <Target className="w-5 h-5 text-blue-600" />
                Pipeline (Optional)
              </>
            )}
            {step === "revenue" && (
              <>
                <DollarSign className="w-5 h-5 text-green-600" />
                {isLinkedIn && valueSource === "conversion_value" ? "Select Conversion Value Field" : "Select Revenue Field"}
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
            {step === "value-source" &&
              (isLinkedIn
                ? "Choose whether HubSpot should provide Total Revenue (to date) or Conversion Value (estimated value per conversion)."
                : "")}
            {step === "campaign-field" &&
              (statusLoading
                ? "Checking HubSpot connection…"
                : isConnected
                ? `${connectStatusLabel ? `Connected: ${connectStatusLabel}. ` : ""}Select the HubSpot deal field that identifies which deals belong to this MetricMind campaign.`
                : "Connect HubSpot to load Deal fields and map revenue to this campaign.")}
            {step === "crosswalk" &&
              `Select the value(s) from “${campaignPropertyLabel}” that should map to this MetricMind campaign. (The value does not need to match the MetricMind campaign name.)`}
            {step === "pipeline" &&
              "Optional: enable a pipeline proxy (deals entering a stage like SQL/Opportunity) as an early signal alongside daily spend. Your primary value source is still based on the selection above."}
            {step === "revenue" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Select the HubSpot field that represents conversion value per conversion."
                : "Select the HubSpot field that represents deal amount.")}
            {step === "review" && "Review the settings below, then save mappings."}
            {step === "complete" &&
              (isLinkedIn
                ? "HubSpot is connected. Your selected revenue input will be used to compute LinkedIn financial metrics."
                : "Revenue is connected. It will be used when GA4 revenue is missing.")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Scrollable step body to keep footer always visible */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible px-1 space-y-4">
          {step === "value-source" && isLinkedIn && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-white dark:bg-slate-950 p-4 space-y-2">
                <div className="text-sm font-medium">What do you want MetricMind to pull from HubSpot?</div>
                <div className="flex items-start justify-between gap-3">
                  <RadioGroup
                    value={valueSource}
                    onValueChange={(v: any) => {
                      setValueSource(v);
                      if (String(v) === "revenue") setConversionValueProperty("");
                    }}
                    className="space-y-2 flex-1"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="hs-mode-revenue" value="revenue" className="mt-0.5" />
                      <label htmlFor="hs-mode-revenue" className="cursor-pointer">
                        <div className="text-sm font-medium leading-snug">Total Revenue (Opportunities, SQL, MQL, etc)</div>
                        <div className="text-xs text-slate-500 leading-snug">Updates daily, but lags daily spend (deals close later).</div>
                      </label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="hs-mode-cv" value="conversion_value" className="mt-0.5" />
                      <label htmlFor="hs-mode-cv" className="cursor-pointer">
                        <div className="text-sm font-medium leading-snug">Conversion Value (per conversion)</div>
                        <div className="text-xs text-slate-500 leading-snug">
                          Advanced. Requires a consistent numeric HubSpot field (e.g., Expected Value / ACV / LTV per conversion).
                        </div>
                      </label>
                    </div>
                  </RadioGroup>

                  {isConnected && (
                    <Button type="button" variant="link" className="px-0 h-auto" onClick={() => void openOAuthWindow()} disabled={isConnecting}>
                      {isConnecting ? "Reconnecting…" : "Reconnect"}
                    </Button>
                  )}
                </div>

                <div className="text-xs text-slate-500">
                  To align a daily signal with daily spend, enable the optional Pipeline proxy step later.
                </div>
              </div>
            </div>
          )}
          {step === "campaign-field" && (
            <div className="space-y-3">
              {!statusLoading && !isConnected ? (
                <div className="rounded-lg border bg-white dark:bg-slate-950 p-4">
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
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>HubSpot deal field used to attribute deals to this campaign</Label>
                    <div className="w-4 h-4">{/* reserved space to avoid layout shift */}</div>
                  </div>
                  <Select
                    value={campaignProperty}
                    onValueChange={(v) => setCampaignProperty(v)}
                    disabled={!isConnected || statusLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={statusLoading ? "Loading…" : "Select a HubSpot deal field…"} />
                    </SelectTrigger>
                    <SelectContent
                      className="z-[10000]"
                      side="bottom"
                      align="start"
                      sideOffset={4}
                      avoidCollisions={false}
                    >
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
              )}
            </div>
          )}

          {step === "crosswalk" && (
            <div className="flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="text-sm text-slate-600">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchUniqueValues(campaignProperty)}
                    disabled={valuesLoading}
                  >
                    {valuesLoading ? "Refreshing…" : "Refresh values"}
                  </Button>
                  {isConnected && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => void openOAuthWindow()}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Reconnecting…" : "Reconnect"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border rounded p-3 flex-1 min-h-0 overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-slate-500">Loading values…</div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-slate-500">No values found.</div>
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

              <div className="text-xs text-slate-500 shrink-0">
                Tip: after you update deals in HubSpot, use “Refresh values” to reload this list.
              </div>
            </div>
          )}

          {step === "pipeline" && isLinkedIn && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-white dark:bg-slate-950 p-4 space-y-3">
                <div className="text-sm font-medium">Optional: pipeline created (daily signal)</div>
                <div className="text-xs text-slate-500">
                  Pipeline is <span className="font-medium">not</span> Closed Won revenue. It’s an early indicator (deals entering a stage like SQL/Opportunity).
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={pipelineEnabled}
                    onCheckedChange={(v) => {
                      const enabled = !!v;
                      setPipelineEnabled(enabled);
                      if (!enabled) {
                        setPipelineStageId("");
                        setPipelineStageLabel("");
                      }
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium">Enable pipeline proxy</div>
                    <div className="text-xs text-slate-500">Adds “Pipeline created (to date)” to Overview as a daily proxy next to spend.</div>
                  </div>
                </div>

                {pipelineEnabled && (
                  <div className="space-y-2">
                    <Label>Stage that counts as “pipeline created”</Label>
                    <Select
                      value={pipelineStageId}
                      onValueChange={(v) => {
                        setPipelineStageId(v);
                        // best-effort label lookup
                        const flat: Array<{ id: string; label: string }> = [];
                        for (const p of pipelines || []) {
                          const stages = Array.isArray((p as any)?.stages) ? (p as any).stages : [];
                          const pLabel = String((p as any)?.label || (p as any)?.name || "Pipeline");
                          for (const s of stages) {
                            const id = String((s as any)?.id || "");
                            const label = String((s as any)?.label || (s as any)?.name || id);
                            if (id) flat.push({ id, label: `${pLabel} — ${label}` });
                          }
                        }
                        const hit = flat.find((x) => x.id === v);
                        setPipelineStageLabel(hit?.label || "");
                      }}
                      disabled={pipelinesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={pipelinesLoading ? "Loading…" : "Select a stage…"} />
                      </SelectTrigger>
                      <SelectContent className="z-[10000] max-h-[320px]">
                        {(pipelines || []).flatMap((p: any) => {
                          const stages = Array.isArray(p?.stages) ? p.stages : [];
                          const pLabel = String(p?.label || p?.name || "Pipeline");
                          return stages.map((s: any) => {
                            const id = String(s?.id || "");
                            const label = String(s?.label || s?.name || id);
                            return (
                              <SelectItem key={`${pLabel}-${id}`} value={id}>
                                {pLabel} — {label}
                              </SelectItem>
                            );
                          });
                        })}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-slate-500">
                      MetricMind will sum Deal Amounts for deals that entered this stage (cumulative to date).
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {isLinkedIn && valueSource === "conversion_value" ? "Conversion value field" : "Revenue field"}
                </Label>
                <Select
                  value={isLinkedIn && valueSource === "conversion_value" ? conversionValueProperty : revenueProperty}
                  onValueChange={(v) => {
                    if (isLinkedIn && valueSource === "conversion_value") setConversionValueProperty(v);
                    else setRevenueProperty(v);
                  }}
                >
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
                <div className="text-xs text-slate-500">
                  {isLinkedIn && valueSource === "conversion_value"
                    ? "Choose the numeric field that represents value per conversion (estimated value)."
                    : "Default (recommended): Deal amount."}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Currency default: one currency per campaign. If mixed currencies are detected, we’ll ask you to filter in HubSpot.
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded p-3">
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
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isLinkedIn ? "Review HubSpot revenue / conversion value settings" : "Review HubSpot revenue settings"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Confirm these details before saving.
                  {isLinkedIn ? (
                    <>
                      {" "}
                      Source of truth: <span className="font-medium">{valueSource === "conversion_value" ? "Conversion Value" : "Revenue (to date)"}</span>.
                    </>
                  ) : (
                    <>
                      {" "}
                      Revenue will be treated as <span className="font-medium">revenue-to-date</span> for this campaign.
                    </>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">HubSpot account</div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {portalName ? portalName : portalId ? `Portal ${portalId}` : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isLinkedIn ? (valueSource === "conversion_value" ? "Conversion value field" : "Revenue field") : "Revenue field"}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {isLinkedIn && valueSource === "conversion_value" ? conversionValuePropertyLabel : revenuePropertyLabel}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Campaign identifier field</div>
                    <div className="font-medium text-slate-900 dark:text-white">{campaignPropertyLabel}</div>
                  </div>

                  {isLinkedIn && (
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Pipeline proxy</div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {pipelineEnabled ? (pipelineStageLabel || pipelineStageId || "Enabled") : "Off"}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Selected value(s)</div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {selectedValues.length.toLocaleString()}
                    </div>
                    {selectedValues.length > 0 ? (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {selectedValues.slice(0, 6).join(", ")}
                        {selectedValues.length > 6 ? `, +${selectedValues.length - 6} more` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">
                {isLinkedIn && valueSource === "conversion_value" ? (
                  <>
                    Conversion value connected:{" "}
                    <strong>
                      {Number(lastSaveResult?.conversionValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </>
                ) : (
                  <>
                    Revenue connected:{" "}
                    <strong>
                      ${Number(lastSaveResult?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </>
                )}
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
          </div>

          {/* Footer nav (hide on connect/complete) */}
          {step !== "connect" && step !== "complete" && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button
                onClick={() => void handleNext()}
                disabled={
                  valuesLoading ||
                  isSaving ||
                  statusLoading ||
                  (step === "campaign-field" ? (!isConnected || !campaignProperty) :
                   step === "crosswalk" ? (selectedValues.length === 0) :
                   step === "pipeline" ? (pipelineEnabled && !pipelineStageId) :
                   step === "revenue" ? (isLinkedIn && valueSource === "conversion_value" ? (!conversionValueProperty) : (!revenueProperty)) :
                   false)
                }
              >
                {step === "review" ? (isSaving ? "Saving…" : "Save Mappings") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



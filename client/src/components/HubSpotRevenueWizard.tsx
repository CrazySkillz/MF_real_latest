import { useEffect, useMemo, useRef, useState } from "react";
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
    lastTotalRevenue?: number;
    dateField?: string;
  } | null;
  onBack?: () => void;
  onSuccess?: (result: any) => void;
  onClose?: () => void;
  /**
   * Optional: lets the parent modal header Back button step backwards inside this wizard.
   * Increment the nonce to request a single back navigation.
   */
  externalBackNonce?: number;
  /**
   * Used to prevent cross-platform leakage of revenue metrics.
   * Example: GA4 revenue sources must not unlock LinkedIn revenue metrics.
   */
  platformContext?: "ga4" | "linkedin";
}) {
  const { campaignId, mode = "connect", initialMappingConfig = null, onBack, onSuccess, onClose, externalBackNonce, platformContext = "ga4" } =
    props;
  const { toast } = useToast();
  const isLinkedIn = platformContext === "linkedin";

  type Step = "value-source" | "campaign-field" | "crosswalk" | "pipeline" | "revenue" | "review" | "complete";
  // Start at the value-source step so the user can choose Revenue-only vs Revenue+Pipeline.
  const [step, setStep] = useState<Step>("value-source");
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
  // LinkedIn exec flow: HubSpot provides revenue-to-date from deal Amount. Conversion Value is intentionally not offered here.
  const [valueSource, setValueSource] = useState<"revenue">("revenue");
  // Pipeline proxy can be enabled for an exec "early signal" (useful for long sales cycles on any platform).
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
  // Which HubSpot date field to use for revenue dating (close date vs last modified vs created)
  const [dateField, setDateField] = useState<string>(
    (initialMappingConfig as any)?.dateField || (isLinkedIn ? "hs_lastmodifieddate" : "closedate")
  );

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);
  const [reviewPreviewRevenue, setReviewPreviewRevenue] = useState<number | null>(null);

  // Revenue amount for the review step: prefer saved result, then live preview, then stored config
  const reviewRevenue = useMemo(() => {
    if (lastSaveResult?.totalRevenue != null) return Number(lastSaveResult.totalRevenue);
    if (reviewPreviewRevenue != null) return Number(reviewPreviewRevenue);
    const stored = Number(initialMappingConfig?.lastTotalRevenue);
    if (Number.isFinite(stored) && stored >= 0) return stored;
    return null;
  }, [lastSaveResult, reviewPreviewRevenue, initialMappingConfig]);

  // Per-LinkedIn-campaign mapping (crosswalk enhancement)
  const [linkedinCampaigns, setLinkedinCampaigns] = useState<Array<{ urn: string; name: string; status: string }>>([]);
  const [campaignMappings, setCampaignMappings] = useState<Array<{ crmValue: string; linkedinCampaignUrn: string; linkedinCampaignName: string }>>([]);

  // Fetch LinkedIn campaigns when in linkedin context
  useEffect(() => {
    if (!isLinkedIn || !campaignId) return;
    fetch(`/api/campaigns/${campaignId}/linkedin-campaigns`)
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(data => setLinkedinCampaigns(data.campaigns || []))
      .catch(() => setLinkedinCampaigns([]));
  }, [isLinkedIn, campaignId]);
  // Advanced options intentionally hidden for exec flow simplicity.
  // Revenue classification hardcoded to offsite — users should not add HubSpot revenue that's already in GA4

  // Edit mode: prefill from the saved mappingConfig and always start at Source (LinkedIn) for consistency.
  useEffect(() => {
    if (mode !== "edit") return;
    const cfg: any = initialMappingConfig || {};
    const nextCampaignProperty = cfg.campaignProperty ? String(cfg.campaignProperty) : "";
    const nextSelectedValues = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v: any) => String(v)) : [];
    const nextRevenueProperty = cfg.revenueProperty ? String(cfg.revenueProperty) : "amount";
    const nextConversionValueProperty = cfg.conversionValueProperty ? String(cfg.conversionValueProperty) : "";
    const nextValueSource: "revenue" = "revenue";
    const nextRevenueClassification: any = cfg.revenueClassification ? String(cfg.revenueClassification) : null;
    const nextPipelineEnabled = cfg.pipelineEnabled === true;
    const nextPipelineStageId = cfg.pipelineStageId ? String(cfg.pipelineStageId) : "";
    const nextPipelineStageLabel = cfg.pipelineStageLabel ? String(cfg.pipelineStageLabel) : "";

    setCampaignProperty(nextCampaignProperty);
    setSelectedValues(nextSelectedValues);
    setRevenueProperty(nextRevenueProperty);
    // Deprecated: Conversion Value mode. Keep reading it (for display/debug) but do not keep the wizard in CV mode.
    setConversionValueProperty("");
    setValueSource(nextValueSource);
    setPipelineEnabled(nextPipelineEnabled);
    setPipelineStageId(nextPipelineStageId);
    setPipelineStageLabel(nextPipelineStageLabel);
    if (cfg.dateField) setDateField(String(cfg.dateField));
    // Edit mode: jump to review so user sees current settings at a glance
    setStep("review");
    if (nextRevenueClassification === "onsite_in_ga4" || nextRevenueClassification === "offsite_not_in_ga4") {
      setRevenueClassification(nextRevenueClassification);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, mode, initialMappingConfig, isLinkedIn]);

  const steps = useMemo(() => {
    return [
      { id: "value-source" as const, label: "Source", icon: DollarSign },
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      // Always render the Pipeline step in the stepper to prevent it from "jumping"
      // when toggling between Revenue-only vs Revenue+Pipeline.
      { id: "pipeline" as const, label: "Pipeline", icon: Target },
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ];
  }, []);

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
    const resp = await fetch(`/api/hubspot/${campaignId}/status`, { credentials: "include" });
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
    const resp = await fetch(`/api/hubspot/${campaignId}/deals/properties`, { credentials: "include" });
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
        )}&limit=300`,
        { credentials: "include" }
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
      const resp = await fetch(`/api/hubspot/${campaignId}/deals/pipelines`, { credentials: "include" });
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
        credentials: "include",
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
          setStep("value-source");
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
        // Mode-first UX: keep the user on the value-source step so they can choose Revenue vs Pipeline.
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
  // Fetch properties when entering campaign-field or revenue steps (for dropdown options).
  // Fetch properties when entering campaign-field or revenue steps.
  // In edit mode: still attempt fetch so dropdowns have full list. Suppress error if fallback exists.
  useEffect(() => {
    if (step !== "campaign-field" && step !== "revenue") return;
    if (!isConnected) return;
    if (properties.length > 0) return;
    (async () => {
      try {
        await fetchProperties();
      } catch (err: any) {
        // Only show error if no fallback value exists in the dropdown
        if (!campaignProperty && !revenueProperty) {
          toast({
            title: "Failed to Load HubSpot Fields",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();
  }, [step, portalId, properties.length, toast, mode, campaignProperty, revenueProperty]);

  // When entering crosswalk step, load unique values.
  // In edit mode: synthesize immediately, then fetch real values in background.
  const crosswalkFetchedRef = useRef(false);
  useEffect(() => {
    if (step !== "crosswalk") return;
    if (uniqueValues.length === 0 && selectedValues.length > 0) {
      setUniqueValues(selectedValues.map(v => ({ value: v, count: 0 })));
    }
    if (crosswalkFetchedRef.current) return;
    if (!isConnected || !campaignProperty) return;
    crosswalkFetchedRef.current = true;
    void (async () => {
      try {
        await fetchUniqueValues(campaignProperty);
      } catch {
        // ignore — user can retry via Refresh button
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isConnected, campaignProperty]);

  // When entering pipeline step, load pipelines.
  const pipelinesFetchedRef = useRef(false);
  useEffect(() => {
    if (step !== "pipeline") return;
    if (!isConnected) return;
    if (pipelinesFetchedRef.current || pipelines.length > 0) return;
    pipelinesFetchedRef.current = true;
    void (async () => {
      try {
        await fetchPipelines();
      } catch (err: any) {
        if (!pipelineStageId) {
          toast({
            title: "Failed to Load HubSpot Pipelines",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isConnected, pipelines.length, campaignId]);

  // Common HubSpot property name → human label (fallback when API unavailable in edit mode)
  const hubspotPropertyFallback = (name: string): string => {
    const map: Record<string, string> = {
      dealname: "Deal Name", amount: "Amount", closedate: "Close Date",
      hs_lastmodifieddate: "Last Modified Date", createdate: "Created Date",
      dealstage: "Deal Stage", pipeline: "Pipeline", hubspot_owner_id: "Owner",
    };
    return map[name] || name;
  };

  const campaignPropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === campaignProperty);
    return p?.label || hubspotPropertyFallback(campaignProperty) || "Campaign field";
  }, [properties, campaignProperty]);

  const revenuePropertyLabel = useMemo(() => {
    const p = properties.find((x) => x.name === revenueProperty);
    return p?.label || hubspotPropertyFallback(revenueProperty) || "Revenue field";
  }, [properties, revenueProperty]);

  const hubspotSourceMode = useMemo(() => {
    return pipelineEnabled ? ("revenue_plus_pipeline" as const) : ("revenue_only" as const);
  }, [pipelineEnabled]);

  const reviewPreviewFiredRef = useRef(false);
  useEffect(() => {
    reviewPreviewFiredRef.current = false;
    setReviewPreviewRevenue(null);
  }, [campaignProperty, selectedValues, revenueProperty, revenueClassification, days, dateField, pipelineEnabled, pipelineStageId, pipelineStageLabel, platformContext, isLinkedIn, campaignMappings]);

  useEffect(() => {
    if (step !== "review") return;
    if (reviewPreviewFiredRef.current) return;
    if (!isConnected || !campaignProperty || selectedValues.length === 0 || !revenueProperty) return;
    reviewPreviewFiredRef.current = true;
    void (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/hubspot/save-mappings`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignProperty,
            selectedValues,
            revenueProperty,
            conversionValueProperty: null,
            previewOnly: true,
            valueSource: "revenue",
            revenueClassification,
            days,
            dateField,
            pipelineEnabled,
            pipelineStageId: pipelineEnabled ? pipelineStageId : null,
            pipelineStageLabel: pipelineEnabled ? (pipelineStageLabel || null) : null,
            platformContext,
            ...(isLinkedIn && campaignMappings.length > 0 ? { campaignMappings } : {}),
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Failed to preview HubSpot revenue");
        setReviewPreviewRevenue(Number(json?.totalRevenue || 0));
      } catch {
        // Keep the review usable even if preview fails.
      }
    })();
  }, [step, isConnected, campaignId, campaignProperty, selectedValues, revenueProperty, revenueClassification, days, dateField, pipelineEnabled, pipelineStageId, pipelineStageLabel, platformContext, isLinkedIn, campaignMappings]);

  const save = async () => {
    setIsSaving(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/hubspot/save-mappings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignProperty,
          selectedValues,
          revenueProperty,
          conversionValueProperty: null,
          valueSource: "revenue",
          revenueClassification,
          days,
          dateField,
          pipelineEnabled,
          pipelineStageId: pipelineEnabled ? pipelineStageId : null,
          pipelineStageLabel: pipelineEnabled ? (pipelineStageLabel || null) : null,
          platformContext,
          ...(isLinkedIn && campaignMappings.length > 0 ? { campaignMappings } : {}),
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
    if (step === "value-source") {
      // Revenue-only wizard: ensure conversion value stays cleared.
      setConversionValueProperty("");
      setStep("campaign-field");
      return;
    }
    if (step === "campaign-field") {
      if (!isConnected && mode !== "edit" && !initialMappingConfig) {
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
      if (!((mode === "edit" || initialMappingConfig) && selectedValues.length > 0)) {
        await fetchUniqueValues(campaignProperty);
      }
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
      setStep(pipelineEnabled ? "pipeline" : "revenue");
      return;
    }
    if (step === "pipeline") {
      if (!pipelineStageId) {
        toast({
          title: "Select a pipeline stage",
          description: "Choose the HubSpot stage that should count as 'pipeline created'.",
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
      return setStep("value-source");
    }
    if (step === "crosswalk") return setStep("campaign-field");
    if (step === "pipeline") return setStep("crosswalk");
    if (step === "revenue") return setStep(pipelineEnabled ? "pipeline" : "crosswalk");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
  };

  // Allow parent header Back button to drive internal wizard back navigation.
  const lastExternalBackNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (externalBackNonce == null) return;
    // Avoid firing on first mount (parent passes 0 by default).
    if (lastExternalBackNonceRef.current == null) {
      lastExternalBackNonceRef.current = externalBackNonce;
      return;
    }
    if (lastExternalBackNonceRef.current === externalBackNonce) return;
    lastExternalBackNonceRef.current = externalBackNonce;
    handleBackStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalBackNonce]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Step Indicator (similar to GuidedColumnMapping) */}
      <div className="flex items-center justify-between shrink-0 mb-6">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const isPipelineStep = s.id === "pipeline";
          const isDisabled = isPipelineStep && !pipelineEnabled;
          const isActive = !isDisabled && s.id === step;
          // Don't mark disabled optional steps as "completed"
          const isCompleted = !isDisabled && index < currentStepIndex;
          // But keep the connector progress accurate so the bar doesn't look "broken"
          const isConnectorCompleted = index < currentStepIndex;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isDisabled
                      ? "bg-muted border-border text-muted-foreground/70"
                      : isActive
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isCompleted
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-muted border-border dark:border-slate-600 text-muted-foreground/70"
                    }`}
                >
                  {!isDisabled && isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p
                  className={`text-xs mt-2 text-center whitespace-nowrap ${isDisabled ? "text-muted-foreground/70" : isActive ? "text-blue-600 font-medium" : isCompleted ? "text-green-600" : "text-muted-foreground/70"
                    }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${isConnectorCompleted ? "bg-green-600" : "bg-muted"}`}
                />
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
                Pipeline
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
            {step === "value-source" &&
              "Choose what HubSpot should provide: Total Revenue only, or Total Revenue + Pipeline (Proxy) for an early signal on long sales cycles."}
            {step === "campaign-field" &&
              (statusLoading
                ? "Checking HubSpot connection…"
                : isConnected
                  ? `${connectStatusLabel ? `Connected: ${connectStatusLabel}. ` : ""}Select the HubSpot deal field that identifies which deals belong to this MetricMind campaign.`
                  : "Connect HubSpot to load Deal fields and map revenue to this campaign.")}
            {step === "crosswalk" &&
              `Select the value(s) from "${campaignPropertyLabel}" that should map to this MetricMind campaign. (The value does not need to match the MetricMind campaign name.)`}
            {step === "pipeline" &&
              "Choose the HubSpot stage that should count as 'pipeline created'. This provides a daily signal alongside daily spend."}
            {step === "revenue" &&
              "Select the HubSpot field that represents deal amount."}
            {step === "review" && "Review the settings below, then save mappings."}
	            {step === "complete" &&
	              "HubSpot is connected. Your selected revenue input will be used to compute financial metrics."}
	          </CardDescription>
	          {step === "value-source" && (
	            <div className="flex justify-end min-h-8">
	              {statusLoading ? (
	                <div className="h-8 w-24" />
	              ) : isConnected ? (
	                <Button
	                  type="button"
	                  variant="link"
	                  className="px-0 h-auto self-start"
	                  onClick={() => void openOAuthWindow()}
	                  disabled={isConnecting}
	                >
	                  {isConnecting ? "Reconnecting…" : "Reconnect"}
	                </Button>
	              ) : null}
	            </div>
	          )}
	        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Scrollable step body to keep footer always visible */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible px-1 space-y-4">
		            {step === "value-source" && (
			              <div className="space-y-3">
			                <div className="rounded-lg border bg-card p-4 space-y-2">
		                  <div className="text-sm font-medium">What do you want MetricMind to pull from HubSpot?</div>
		                  <div className="text-xs text-muted-foreground/70 mb-2">
		                    <strong>Note:</strong> For long sales cycles, Pipeline Proxy provides an early indicator before deals close.
	                  </div>
	                  <div>
	                    <RadioGroup
	                      value={hubspotSourceMode}
	                      onValueChange={(v: any) => {
                        const next = String(v || "");
                        // Revenue modes
                        setValueSource("revenue");
                        setConversionValueProperty("");
                        if (next === "revenue_plus_pipeline") {
                          setPipelineEnabled(true);
                        } else {
                          setPipelineEnabled(false);
                          setPipelineStageId("");
                          setPipelineStageLabel("");
                        }
                      }}
                      className="space-y-2 flex-1"
                    >
                      <div className="flex items-start gap-2">
                        <RadioGroupItem id="hs-mode-revenue-pipeline" value="revenue_plus_pipeline" className="mt-0.5" />
                        <label htmlFor="hs-mode-revenue-pipeline" className="cursor-pointer">
                          <div className="text-sm font-medium leading-snug">Total Revenue + Pipeline (Proxy)</div>
                          <div className="text-xs text-muted-foreground leading-snug">
                            Total Revenue comes from mapped deal Amounts (to date). Adds a Pipeline (Proxy) card using a stage like SQL as an early signal.
                          </div>
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem id="hs-mode-revenue-only" value="revenue_only" className="mt-0.5" />
                        <label htmlFor="hs-mode-revenue-only" className="cursor-pointer">
                          <div className="text-sm font-medium leading-snug">Total Revenue only (no Pipeline card)</div>
                          <div className="text-xs text-muted-foreground leading-snug">
                            Imports revenue-to-date from mapped deal Amounts. No Pipeline (Proxy) section in Overview.
                          </div>
	                        </label>
	                      </div>
	                    </RadioGroup>
	                  </div>

                  <div className="text-xs text-muted-foreground">
                    {hubspotSourceMode === "revenue_plus_pipeline"
                      ? "Next, you’ll choose which Pipeline stage should count as 'pipeline created'."
                      : "Next, you’ll map HubSpot deals to this campaign."}
                  </div>
                </div>
              </div>
            )}
            {step === "campaign-field" && (
              <div className="space-y-3">
                {!statusLoading && !isConnected ? (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Connect HubSpot to continue
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
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
                        {properties.length > 0
                        ? properties.map((p) => (
                            <SelectItem key={p.name} value={p.name}>
                              {p.label} ({p.name})
                            </SelectItem>
                          ))
                        : campaignProperty
                          ? (<SelectItem value={campaignProperty}>{campaignPropertyLabel}</SelectItem>)
                          : null}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      Tip: pick the HubSpot property your team uses for "LinkedIn campaign" or "UTM campaign".
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === "crosswalk" && (
              <div className="flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div className="text-sm text-muted-foreground">
                    {isLinkedIn && linkedinCampaigns.length > 0
                      ? <>Mapped: <strong>{campaignMappings.length}</strong> of {uniqueValues.length} values</>
                      : <>Selected: <strong>{selectedValues.length}</strong></>}
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
                  </div>
                </div>

                <div className="border rounded p-3 flex-1 min-h-0 overflow-y-auto">
                  {valuesLoading ? (
                    <div className="text-sm text-muted-foreground">Loading values…</div>
                  ) : uniqueValues.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No values found.</div>
                  ) : isLinkedIn && linkedinCampaigns.length > 0 ? (
                    /* LinkedIn campaign mapping mode */
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground mb-2">
                        Map each HubSpot value to a LinkedIn campaign. Unmapped values will be skipped.
                      </div>
                      {uniqueValues.map((v) => {
                        const value = String(v.value);
                        const existing = campaignMappings.find(m => m.crmValue === value);
                        return (
                          <div key={value} className="flex items-center gap-3 p-2 rounded border border-slate-100">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{value}</div>
                              <div className="text-xs text-muted-foreground">{v.count} deal(s)</div>
                            </div>
                            <Select
                              value={existing?.linkedinCampaignUrn || "__none__"}
                              onValueChange={(urn) => {
                                setCampaignMappings(prev => {
                                  const filtered = prev.filter(m => m.crmValue !== value);
                                  if (urn === "__none__") return filtered;
                                  const campaign = linkedinCampaigns.find(c => c.urn === urn);
                                  return [...filtered, {
                                    crmValue: value,
                                    linkedinCampaignUrn: urn,
                                    linkedinCampaignName: campaign?.name || urn,
                                  }];
                                });
                                // Also maintain selectedValues for backward compat
                                setSelectedValues(prev => {
                                  if (urn === "__none__") return prev.filter(x => x !== value);
                                  return Array.from(new Set([...prev, value]));
                                });
                              }}
                            >
                              <SelectTrigger className="w-[200px] text-xs">
                                <SelectValue placeholder="Select campaign…" />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                <SelectItem value="__none__">— Skip —</SelectItem>
                                {linkedinCampaigns.map(c => (
                                  <SelectItem key={c.urn} value={c.urn}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Standard checkbox mode */
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
                              <div className="text-xs text-muted-foreground">{v.count} deal(s)</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground shrink-0">
                  Tip: after you update deals in HubSpot, use "Refresh values" to reload this list.
                </div>
              </div>
            )}

            {step === "pipeline" && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="text-sm font-medium">Pipeline stage total (daily signal)</div>
                  <div className="text-xs text-muted-foreground">
                    Pipeline (Proxy) is <span className="font-medium">not</span> Closed Won revenue. It’s an early indicator (deals currently in a stage like SQL/Opportunity).
                  </div>

                  <div className="space-y-2">
                    <Label>Stage that counts as 'pipeline created'</Label>
                    <Select
                      value={pipelineStageId}
                      onValueChange={(v) => {
                        setPipelineStageId(v);
                        // best-effort label lookup
                        const flat: Array<{ id: string; label: string }> = [];
                        for (const p of pipelines || []) {
                          const stages = Array.isArray((p as any)?.stages) ? (p as any).stages : [];
                          for (const s of stages) {
                            const id = String((s as any)?.id || "");
                            const label = String((s as any)?.label || (s as any)?.name || id);
                            if (id) flat.push({ id, label });
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
                        {(() => {
                          const allStages = (pipelines || []).flatMap((p: any) => {
                            const stages = Array.isArray(p?.stages) ? p.stages : [];
                            const pLabel = String(p?.label || p?.name || "Pipeline");
                            return stages.map((s: any) => ({
                              id: String(s?.id || ""),
                              label: `${pLabel} — ${String(s?.label || s?.name || s?.id || "")}`,
                            }));
                          }).filter(s => !!s.id);
                          if (allStages.length > 0) {
                            return allStages.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ));
                          }
                          return pipelineStageId
                            ? (<SelectItem value={pipelineStageId}>{pipelineStageLabel || pipelineStageId}</SelectItem>)
                            : null;
                        })()}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      MetricMind will sum Deal Amounts for deals currently in this stage (stage subset).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === "revenue" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    Revenue field
                  </Label>
                  <Select
                    value={revenueProperty}
                    onValueChange={(v) => {
                      setRevenueProperty(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {(() => {
                        const numericProps = properties.filter((p) => p.type === "number" || p.name === "amount");
                        if (numericProps.length > 0) {
                          return numericProps.map((p) => (
                            <SelectItem key={p.name} value={p.name}>
                              {p.label} ({p.name})
                            </SelectItem>
                          ));
                        }
                        return revenueProperty
                          ? (<SelectItem value={revenueProperty}>{revenuePropertyLabel} ({revenueProperty})</SelectItem>)
                          : null;
                      })()}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Default (recommended): Deal amount.
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Currency default: one currency per campaign. If mixed currencies are detected, we’ll ask you to filter in HubSpot.
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Only add HubSpot revenue if these deals are <strong>NOT</strong> already tracked as GA4 ecommerce transactions. Adding the same revenue from both sources will double-count your total.
                  </p>
                </div>

	                <div className="space-y-2 border-t pt-3">
	                  <Label className="text-muted-foreground">Date field</Label>
	                  <Select value={dateField} onValueChange={setDateField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="closedate">Close Date — when the deal was won</SelectItem>
                      <SelectItem value="hs_lastmodifieddate">Last Modified Date — when the deal was last updated</SelectItem>
                      <SelectItem value="createdate">Created Date — when the deal was first entered</SelectItem>
                    </SelectContent>
	                  </Select>
	                  <div className="text-xs text-muted-foreground">
	                    Controls which HubSpot date property is used to decide which deals are included in this revenue total. Default: Close Date.
	                    Use Close Date for won-revenue reporting, Last Modified Date for recently updated deals, or Created Date for newly created deals.
	                  </div>
	                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-sm font-semibold text-foreground">
                    Review HubSpot revenue settings
                  </div>
                  <div className="text-sm text-muted-foreground/70 mt-1">
                    Confirm these details before saving.
                    {isLinkedIn ? (
                      <>
                        {" "}
                        Source of truth: <span className="font-medium">Revenue (to date)</span>.
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
                      <div className="text-xs text-muted-foreground/70">HubSpot account</div>
                      <div className="font-medium text-foreground">
                        {portalName ? portalName : portalId ? `Portal ${portalId}` : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground/70">
                        Revenue field
                      </div>
                      <div className="font-medium text-foreground">
                        {revenuePropertyLabel}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground/70">Campaign identifier field</div>
                      <div className="font-medium text-foreground">{campaignPropertyLabel}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground/70">Total Revenue (to date)</div>
                      <div className="font-medium text-foreground text-green-700 dark:text-green-400">
                        {reviewRevenue != null
                          ? `$${Number(reviewRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </div>
                    </div>

                    {pipelineEnabled && (
                      <div>
                        <div className="text-xs text-muted-foreground/70">Pipeline proxy</div>
                        <div className="font-medium text-foreground">
                          {pipelineStageLabel || pipelineStageId || "—"}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-muted-foreground/70">Selected value(s)</div>
                      <div className="font-medium text-foreground">
                        {selectedValues.length.toLocaleString()}
                      </div>
                      {selectedValues.length > 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground/70">
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
                <div className="text-sm text-foreground/80">
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
          </div>

          {/* Footer nav (hide on connect/complete) */}
          {step !== "connect" && step !== "complete" && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border shrink-0">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button
                onClick={() => void handleNext()}
                disabled={
                  valuesLoading ||
                  isSaving ||
                  statusLoading ||
                  (step === "campaign-field" ? ((!isConnected && mode !== "edit" && !initialMappingConfig) || !campaignProperty) :
                    step === "crosswalk" ? (isLinkedIn && linkedinCampaigns.length > 0 ? campaignMappings.length === 0 : selectedValues.length === 0) :
                      step === "pipeline" ? (!pipelineStageId) :
                        step === "revenue" ? (!revenueProperty) :
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

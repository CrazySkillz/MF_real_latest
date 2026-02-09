import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, DollarSign, Target, Link2, ClipboardCheck } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type SalesforceField = {
  name: string;
  label: string;
  type: string;
};

type UniqueValue = {
  value: string;
  count: number;
};

export function SalesforceRevenueWizard(props: {
  campaignId: string;
  mode?: "connect" | "edit";
  initialMappingConfig?: {
    campaignField?: string;
    selectedValues?: string[];
    revenueField?: string;
    conversionValueField?: string;
    valueSource?: "revenue" | "conversion_value" | string;
    days?: number;
    pipelineEnabled?: boolean;
    pipelineStageName?: string;
    pipelineStageLabel?: string;
  } | null;
  connectOnly?: boolean;
  /**
   * If true, auto-launches the Salesforce OAuth popup once when the wizard opens and no connection exists.
   * Falls back to the manual "Connect Salesforce" button if popups are blocked.
   */
  autoStartOAuth?: boolean;
  onConnected?: () => void;
  onBack?: () => void;
  onSuccess?: (result: any) => void;
  onClose?: () => void;
  /**
   * Used to prevent cross-platform leakage of revenue metrics.
   * Example: GA4 revenue sources must not unlock LinkedIn revenue metrics.
   */
  platformContext?: "ga4" | "linkedin";
  /**
   * Optional: lets the parent modal header Back button step backwards inside this wizard.
   * Increment the nonce to request a single back navigation.
   */
  externalBackNonce?: number;
}) {
  const {
    campaignId,
    mode = "connect",
    initialMappingConfig = null,
    connectOnly = false,
    autoStartOAuth = false,
    onConnected,
    onBack,
    onSuccess,
    onClose,
    platformContext = "ga4",
    externalBackNonce,
  } = props;
  const { toast } = useToast();
  const isLinkedIn = platformContext === "linkedin";

  type Step = "value-source" | "connect" | "campaign-field" | "crosswalk" | "pipeline" | "revenue" | "review" | "complete";
  // UX: OAuth happens before this wizard opens (from the Connect Additional Data flow),
  // so start at Campaign field (no separate Connect step).
  const [step, setStep] = useState<Step>(isLinkedIn ? "value-source" : "campaign-field");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const isConnected = !!orgId;
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [fields, setFields] = useState<SalesforceField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  // Default to Opportunity "Name" (Opportunity Name) for linking deals to campaigns.
  // This is the most universally available field and matches the desired default behavior.
  const [campaignField, setCampaignField] = useState<string>("Name");
  const [revenueField, setRevenueField] = useState<string>("Amount");
  const [conversionValueField, setConversionValueField] = useState<string>("");
  const [valueSource, setValueSource] = useState<"revenue" | "conversion_value">("revenue");
  // LinkedIn: pipeline proxy can be enabled for an exec "early signal" (minimize lag).
  const [pipelineEnabled, setPipelineEnabled] = useState<boolean>(isLinkedIn);
  const [pipelineStageName, setPipelineStageName] = useState<string>("");
  const [pipelineStageLabel, setPipelineStageLabel] = useState<string>("");
  const [stages, setStages] = useState<Array<{ value: string; label: string }>>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  // Internal flag used to avoid double-counting GA4 revenue in campaign totals.
  // We no longer expose this choice in the Salesforce wizard UI; default based on context.
  const [revenueClassification] = useState<"onsite_in_ga4" | "offsite_not_in_ga4">(
    platformContext === "ga4" ? "onsite_in_ga4" : "offsite_not_in_ga4"
  );
  // Fixed lookback to match HubSpot (no UI); new campaigns have limited records.
  const [days, setDays] = useState<number>(3650);

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesError, setValuesError] = useState<string | null>(null);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [pipelinePreviewError, setPipelinePreviewError] = useState<string | null>(null);
  const [pipelinePreviewHeaders, setPipelinePreviewHeaders] = useState<string[]>([]);
  const [pipelinePreviewRows, setPipelinePreviewRows] = useState<string[][]>([]);
  const [previewCampaignCurrency, setPreviewCampaignCurrency] = useState<string | null>(null);
  const [previewDetectedCurrency, setPreviewDetectedCurrency] = useState<string | null>(null);
  const [previewCurrencyMismatch, setPreviewCurrencyMismatch] = useState<boolean>(false);
  const [previewCurrencyDebugSteps, setPreviewCurrencyDebugSteps] = useState<any[] | null>(null);
  const [previewBuild, setPreviewBuild] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      ...(isLinkedIn ? [{ id: "value-source" as const, label: "Source", icon: DollarSign }] : []),
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      ...(isLinkedIn ? [{ id: "pipeline" as const, label: "Pipeline", icon: Target }] : []),
      // Keep the stepper label stable to avoid layout shift (exec-grade UI polish).
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    [isLinkedIn]
  );

  const currentStepIndex = useMemo(() => {
    const idx = steps.findIndex((s) => s.id === step);
    return idx >= 0 ? idx : steps.length;
  }, [steps, step]);

  const connectedLabel = useMemo(() => orgName || null, [orgName]);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/salesforce/${campaignId}/status`);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || "Failed to check Salesforce connection");
    if (json?.connected) {
      setOrgName(json?.orgName || null);
      setOrgId(json?.orgId || null);
      return true;
    }
    setOrgName(null);
    setOrgId(null);
    return false;
  };

  // IMPORTANT UX:
  // - connect mode: start fresh on "Campaign field" (no Connect step) with no pre-populated org/settings.
  // - edit mode: prefill from saved mappingConfig and start at campaign-field.
  useEffect(() => {
    if (mode === "connect") {
      setStep(isLinkedIn ? "value-source" : "campaign-field");
      setOrgName(null);
      setOrgId(null);
      setFields([]);
      setFieldsError(null);
      setCampaignField("Name");
      setRevenueField("Amount");
      setConversionValueField("");
      setValueSource("revenue");
      setPipelineEnabled(isLinkedIn);
      setPipelineStageName("");
      setPipelineStageLabel("");
      setStages([]);
      setUniqueValues([]);
      setSelectedValues([]);
      setLastSaveResult(null);
      return;
    }

    // edit mode: prefill mapping and jump into guided steps
    const cfg = initialMappingConfig || {};
    const nextCampaignField = cfg.campaignField ? String(cfg.campaignField) : "Name";
    const nextRevenueField = cfg.revenueField ? String(cfg.revenueField) : "Amount";
    const nextConversionValueField = cfg.conversionValueField ? String(cfg.conversionValueField) : "";
    const nextSelectedValues = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v) => String(v)) : [];
    const nextDays = Number.isFinite(Number(cfg.days)) ? Math.min(Math.max(Number(cfg.days), 1), 3650) : 3650;
    const nextValueSource: "revenue" | "conversion_value" =
      String(cfg.valueSource || "").trim().toLowerCase() === "conversion_value" ? "conversion_value" : "revenue";
    const nextPipelineEnabled = cfg.pipelineEnabled === true;
    const nextPipelineStageName = cfg.pipelineStageName ? String(cfg.pipelineStageName) : "";
    const nextPipelineStageLabel = cfg.pipelineStageLabel ? String(cfg.pipelineStageLabel) : "";

    // Always start at the first step for LinkedIn so edits and source switching are consistent.
    setStep(isLinkedIn ? "value-source" : "campaign-field");
    setFields([]);
    setFieldsError(null);
    setCampaignField(nextCampaignField);
    setRevenueField(nextRevenueField);
    setConversionValueField(nextConversionValueField);
    setValueSource(nextValueSource);
    setPipelineEnabled(nextPipelineEnabled);
    setPipelineStageName(nextPipelineStageName);
    setPipelineStageLabel(nextPipelineStageLabel);
    setSelectedValues(nextSelectedValues);
    setUniqueValues([]);
    setDays(nextDays); // persisted value when editing; no setter exposed in UI
    setLastSaveResult(null);
  }, [campaignId, mode, initialMappingConfig]);

  // Best-effort: fetch connection status so we can show the connected org name on the first step,
  // or show an inline Connect CTA if the user somehow gets here without a connection.
  useEffect(() => {
    void (async () => {
      try {
        setStatusLoading(true);
        await fetchStatus();
      } catch {
        // ignore (wizard can still load fields if backend allows; otherwise user can connect)
      } finally {
        setStatusLoading(false);
      }
    })();
  }, [campaignId]);

  const fetchFields = async () => {
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/fields`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load Opportunity fields");
      const f = Array.isArray(json?.fields) ? (json.fields as SalesforceField[]) : [];

      // Ensure Opportunity Name is always present (even if API omits it for any reason).
      const hasName = f.some((x) => String(x?.name || "").toLowerCase() === "name");
      const withName: SalesforceField[] = hasName
        ? f
        : [{ name: "Name", label: "Opportunity Name", type: "string" }, ...f];

      // Normalize display label for Salesforce's standard "Name" field so the UI always shows "Opportunity Name".
      const normalized: SalesforceField[] = withName.map((field) => {
        const apiName = String((field as any)?.name || "");
        if (apiName.toLowerCase() === "name") {
          return { ...field, name: "Name", label: "Opportunity Name", type: field.type || "string" };
        }
        return field;
      });

      setFields(normalized);

      // Default campaign field to Opportunity Name if it's available and nothing else is selected.
      if (!campaignField || !normalized.some((x) => x.name === campaignField)) {
        setCampaignField("Name");
      }

      if (normalized.length === 0) {
        setFieldsError("No Opportunity fields were returned. Please try again.");
      }
      return normalized;
    } finally {
      setFieldsLoading(false);
    }
  };

  const fetchUniqueValues = async (fieldName: string) => {
    setValuesLoading(true);
    setValuesError(null);
    try {
      const resp = await fetch(
        `/api/salesforce/${campaignId}/opportunities/unique-values?field=${encodeURIComponent(fieldName)}&days=${encodeURIComponent(
          String(days)
        )}&limit=300`
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load values");
      const vals = Array.isArray(json?.values) ? json.values : [];
      const allowed = new Set(vals.map((v: any) => String(v.value)));
      if (mode === "edit") {
        // Preserve previously-saved selections even if they don't appear in the current lookback window.
        // Add them to the list with count=0 so they remain visible + checked.
        const missing = selectedValues.filter((v) => v && !allowed.has(String(v)));
        const merged = [
          ...vals,
          ...missing.map((v) => ({ value: String(v), count: 0 })),
        ];
        setUniqueValues(merged);
        setSelectedValues((prev) => prev);
      } else {
        setUniqueValues(vals);
        setSelectedValues((prev) => prev.filter((v) => allowed.has(v)));
      }
      return vals;
    } catch (err: any) {
      const msg = err?.message || "Failed to load values";
      setUniqueValues([]);
      setValuesError(msg);
      toast({ title: "Failed to Load Values", description: msg, variant: "destructive" });
      return [];
    } finally {
      setValuesLoading(false);
    }
  };

  const openOAuthWindow = async () => {
    setIsConnecting(true);
    setOauthError(null);
    try {
      const resp = await fetch("/api/auth/salesforce/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const text = await resp.text().catch(() => "");
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      if (!resp.ok) {
        const msg =
          json?.message ||
          json?.error ||
          (text && text.length < 300 ? text : "") ||
          `Failed to start Salesforce OAuth (HTTP ${resp.status})`;
        throw new Error(msg);
      }
      const authUrl = json?.authUrl;
      if (!authUrl) throw new Error("No auth URL returned");

      const w = window.open(authUrl, "salesforce_oauth", "width=520,height=680");
      if (!w) throw new Error("Popup blocked. Please allow popups and try again.");

      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        window.removeEventListener("message", onWindowMessage);
        try {
          bc?.removeEventListener("message", onBcMessage as any);
          bc?.close();
        } catch {}
        if (pollTimer) window.clearInterval(pollTimer);
        if (pollTimeout) window.clearTimeout(pollTimeout);
      };

      const handleAuthSuccess = async () => {
        cleanup();
        setStatusLoading(true);
        await fetchStatus();
        setStatusLoading(false);
        toast({
          title: "Salesforce Connected",
          description: connectOnly
            ? "Connection saved. You can now view Salesforce data in MetricMind."
            : "Now select the Opportunity field used to attribute deals to this campaign.",
        });
        if (connectOnly) {
          onConnected?.();
          onClose?.();
          return;
        }
        setStep("campaign-field");
      };

      const handleAuthError = (msg?: string) => {
        cleanup();
        toast({
          title: "Salesforce Connection Failed",
          description: msg || "Please try again.",
          variant: "destructive",
        });
      };

      const onWindowMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data: any = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "salesforce_auth_success") {
          await handleAuthSuccess();
        } else if (data.type === "salesforce_auth_error") {
          handleAuthError(data.error);
        }
      };

      // BroadcastChannel fallback (Salesforce pages can set COOP which breaks window.opener messaging)
      let bc: BroadcastChannel | null = null;
      const onBcMessage = async (event: MessageEvent) => {
        const data: any = (event as any)?.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "salesforce_auth_success") await handleAuthSuccess();
        if (data.type === "salesforce_auth_error") handleAuthError(data.error);
      };
      try {
        bc = new BroadcastChannel("metricmind_oauth");
        bc.addEventListener("message", onBcMessage as any);
      } catch {
        bc = null;
      }

      // As a final fallback, poll status briefly in case popup messaging is blocked.
      let pollTimer: number | null = null;
      let pollTimeout: number | null = null;
      pollTimer = window.setInterval(async () => {
        try {
          const resp = await fetch(`/api/salesforce/${campaignId}/status`);
          const json = await resp.json().catch(() => ({}));
          if (json?.connected) {
            await handleAuthSuccess();
          }
        } catch {
          // ignore
        }
      }, 1200);
      pollTimeout = window.setTimeout(() => cleanup(), 60_000);

      window.addEventListener("message", onWindowMessage);
    } catch (err: any) {
      setOauthError(err?.message || "Failed to open Salesforce OAuth.");
      toast({
        title: "Salesforce Connection Failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Optional: auto-prompt OAuth when opened from "Add revenue source" so the flow matches HubSpot UX expectations.
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  useEffect(() => {
    if (!autoStartOAuth) return;
    if (autoStartAttempted) return;
    if (mode !== "connect") return;
    if (connectOnly) return;
    if (statusLoading) return;
    if (isConnected) return;
    // Mark attempted first to avoid loops if the popup is blocked and state doesn't change.
    setAutoStartAttempted(true);
    void openOAuthWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartOAuth, autoStartAttempted, mode, connectOnly, statusLoading, isConnected, campaignId]);

  useEffect(() => {
    if (step !== "campaign-field" && step !== "revenue") return;
    if (fields.length > 0) return;
    // Match HubSpot UX: don't fetch fields until connected.
    if (statusLoading || !isConnected) return;
    (async () => {
      try {
        await fetchFields();
      } catch (err: any) {
        setFieldsError(err?.message || "Failed to load Opportunity fields.");
        toast({
          title: "Failed to Load Salesforce Fields",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    })();
  }, [step, fields.length, toast, statusLoading, isConnected, campaignId]);

  useEffect(() => {
    if (step !== "pipeline") return;
    if (!isConnected) return;
    if (stages.length > 0) return;
    void (async () => {
      setStagesLoading(true);
      try {
        const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/stages`);
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Failed to load Opportunity stages");
        const s = Array.isArray(json?.stages) ? json.stages : [];
        setStages(s);
      } catch (err: any) {
        setStages([]);
        toast({ title: "Failed to Load Stages", description: err?.message || "Please try again.", variant: "destructive" });
      } finally {
        setStagesLoading(false);
      }
    })();
  }, [step, isConnected, stages.length, campaignId, toast]);

  const salesforceSourceMode = useMemo(() => {
    if (!isLinkedIn) return "revenue_only" as const;
    return pipelineEnabled ? ("revenue_plus_pipeline" as const) : ("revenue_only" as const);
  }, [isLinkedIn, pipelineEnabled]);

  const isLegacyConversionValueConfig = useMemo(() => {
    if (mode !== "edit") return false;
    const raw = String((initialMappingConfig as any)?.valueSource || "").trim().toLowerCase();
    return raw === "conversion_value";
  }, [mode, initialMappingConfig]);

  const campaignFieldLabel = useMemo(() => {
    const f = fields.find((x) => x.name === campaignField);
    return f?.label || campaignField || "Campaign field";
  }, [fields, campaignField]);

  const campaignFieldDisplay = useMemo(() => {
    if (fieldsLoading) return "Loading fields…";
    // If we're defaulted to Salesforce API field "Name", always display the friendly label.
    if (String(campaignField || "").toLowerCase() === "name") return "Opportunity Name";
    const f = fields.find((x) => x.name === campaignField);
    return f?.label || "Select an Opportunity field…";
  }, [campaignField, fields, fieldsLoading]);

  const revenueFieldLabel = useMemo(() => {
    const f = fields.find((x) => x.name === revenueField);
    return f?.label || revenueField || "Revenue field";
  }, [fields, revenueField]);

  const preview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPipelinePreviewError(null);
    try {
      const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignField,
          selectedValues,
          revenueField,
          days,
          limit: 25,
          pipelineEnabled: isLinkedIn ? pipelineEnabled : false,
          pipelineStageName: isLinkedIn && pipelineEnabled ? pipelineStageName : null,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to load preview");
      setPreviewHeaders(Array.isArray(json?.headers) ? json.headers : []);
      setPreviewRows(Array.isArray(json?.rows) ? json.rows : []);
      const pp = json?.pipelinePreview || null;
      if (pp?.error) {
        setPipelinePreviewError(String(pp.error));
        setPipelinePreviewHeaders([]);
        setPipelinePreviewRows([]);
      } else if (pp && Array.isArray(pp?.headers) && Array.isArray(pp?.rows)) {
        setPipelinePreviewError(null);
        setPipelinePreviewHeaders(pp.headers);
        setPipelinePreviewRows(pp.rows);
      } else {
        setPipelinePreviewError(null);
        setPipelinePreviewHeaders([]);
        setPipelinePreviewRows([]);
      }
      setPreviewCampaignCurrency(json?.campaignCurrency ? String(json.campaignCurrency) : null);
      setPreviewDetectedCurrency(json?.detectedCurrency ? String(json.detectedCurrency) : null);
      setPreviewCurrencyMismatch(!!json?.currencyMismatch);
      setPreviewCurrencyDebugSteps(Array.isArray(json?.currencyDetectionDebug?.steps) ? json.currencyDetectionDebug.steps : null);
      setPreviewBuild(json?.build ? String(json.build) : null);
    } catch (err: any) {
      setPreviewError(err?.message || "Failed to load preview");
      setPreviewHeaders([]);
      setPreviewRows([]);
      setPipelinePreviewError(null);
      setPipelinePreviewHeaders([]);
      setPipelinePreviewRows([]);
      setPreviewCampaignCurrency(null);
      setPreviewDetectedCurrency(null);
      setPreviewCurrencyMismatch(false);
      setPreviewCurrencyDebugSteps(null);
      setPreviewBuild(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const effectiveSalesforceCurrency = useMemo(() => {
    return (previewDetectedCurrency || "").trim().toUpperCase() || null;
  }, [previewDetectedCurrency]);

  const effectiveCurrencyMismatch = useMemo(() => {
    if (!previewCampaignCurrency) return false;
    if (!effectiveSalesforceCurrency) return false;
    return String(previewCampaignCurrency).toUpperCase() !== String(effectiveSalesforceCurrency).toUpperCase();
  }, [previewCampaignCurrency, effectiveSalesforceCurrency]);

  const save = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/salesforce/save-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignField,
          selectedValues,
          revenueField,
          conversionValueField: isLinkedIn ? conversionValueField : null,
          valueSource: isLinkedIn ? valueSource : "revenue",
          revenueClassification,
          days,
          pipelineEnabled: isLinkedIn ? pipelineEnabled : false,
          pipelineStageName: isLinkedIn && pipelineEnabled ? (pipelineStageName || null) : null,
          pipelineStageLabel: isLinkedIn && pipelineEnabled ? (pipelineStageLabel || null) : null,
          platformContext,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Failed to save mappings");
      setLastSaveResult(json);
      toast({
        title: "Revenue Metrics Processed",
        description:
          isLinkedIn && valueSource === "conversion_value"
            ? `Conversion value saved: $${json?.conversionValue || "0"} per conversion.`
            : `Total Revenue processed: $${Number(json?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      });
      onSuccess?.(json);
      setStep("complete");
    } catch (err: any) {
      setSaveError(err?.message || "Please try again.");
      toast({
        title: "Failed to Process Revenue Metrics",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === "value-source") {
      // Mode-first UX: pick source of truth before mapping fields.
      // Exec flow: Revenue is the source of truth. Conversion Value is no longer offered here.
      setValueSource("revenue");
      setConversionValueField("");
      setStep("campaign-field");
      return;
    }
    if (step === "campaign-field") {
      if (!isConnected) {
        toast({ title: "Connect Salesforce", description: "Connect Salesforce before continuing.", variant: "destructive" });
        return;
      }
      if (!campaignField) {
        toast({
          title: "Select a field",
          description: "Choose the Opportunity field used to attribute deals to this campaign.",
          variant: "destructive",
        });
        return;
      }
      await fetchUniqueValues(campaignField);
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      if (selectedValues.length === 0) {
        toast({
          title: "Select at least one value",
          description: "Pick the Salesforce value(s) that should map to this campaign.",
          variant: "destructive",
        });
        return;
      }
      setStep(isLinkedIn && pipelineEnabled ? "pipeline" : "revenue");
      return;
    }
    if (step === "pipeline") {
      if (!pipelineStageName) {
        toast({
          title: "Select a pipeline stage",
          description: "Choose the Opportunity stage that should count as “pipeline created”.",
          variant: "destructive",
        });
        return;
      }
      setStep("revenue");
      return;
    }
    if (step === "revenue") {
      if (isLinkedIn && valueSource === "conversion_value") {
        if (!conversionValueField) {
          toast({
            title: "Select a conversion value field",
            description: "Choose the Opportunity field that represents conversion value per conversion (estimated value).",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!revenueField) {
          toast({
            title: "Select a revenue field",
            description: "Choose the Opportunity field that represents revenue (usually Amount).",
            variant: "destructive",
          });
          return;
        }
      }
      setStep("review");
      // Best-effort preview on entry so users can sanity-check before processing.
      // Don't block navigation if preview fails.
      void preview();
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
    if (step === "revenue") return setStep(isLinkedIn && pipelineEnabled ? "pipeline" : "crosswalk");
    if (step === "review") return setStep("revenue");
    if (step === "complete") return setStep("review");
  };

  // Allow parent header Back button to drive internal wizard back navigation.
  const [lastExternalBackNonce, setLastExternalBackNonce] = useState<number | null>(null);
  useEffect(() => {
    if (externalBackNonce == null) return;
    // Avoid firing on first mount (parent passes 0 by default).
    if (lastExternalBackNonce == null) {
      setLastExternalBackNonce(externalBackNonce);
      return;
    }
    if (lastExternalBackNonce === externalBackNonce) return;
    setLastExternalBackNonce(externalBackNonce);
    handleBackStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalBackNonce]);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const isPipelineStep = isLinkedIn && s.id === "pipeline";
          const isDisabled = isPipelineStep && !pipelineEnabled;
          const isActive = !isDisabled && s.id === step;
          // Don't mark disabled optional steps as completed
          const isCompleted = !isDisabled && index < currentStepIndex;
          // Keep connector progress accurate so the bar doesn't look broken
          const isConnectorCompleted = index < currentStepIndex;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isDisabled
                      ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                      : isActive
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
                  }`}
                >
                  {!isDisabled && isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p
                  className={`text-xs mt-2 text-center whitespace-nowrap ${
                    isDisabled
                      ? "text-slate-400"
                      : isActive
                      ? "text-blue-600 font-medium"
                      : isCompleted
                      ? "text-green-600"
                      : "text-slate-400"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isConnectorCompleted ? "bg-green-600" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              {step === "value-source" && (
                <>
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Choose source of truth
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
                  Link Campaign to Salesforce Value(s)
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
                  {isLinkedIn && valueSource === "conversion_value" ? "Select Conversion Value Field" : "Select Revenue Field"}
                </>
              )}
              {step === "review" && (
                <>
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  Process Revenue Metrics
                </>
              )}
              {step === "complete" && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Completed
                </>
              )}
            </CardTitle>

            {/* Subtle reconnect affordance (keeps first-step layout clean, matches HubSpot-style UX). */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void openOAuthWindow()}
              disabled={isConnecting || statusLoading || !isConnected || step === "complete"}
              className={`${!statusLoading && isConnected && step !== "complete" ? "" : "opacity-0 pointer-events-none"} min-w-[116px]`}
            >
              {isConnecting ? "Reconnecting…" : "Reconnect"}
            </Button>
          </div>
          <CardDescription>
            {/* Reserve space for connection label to avoid layout shift when async status arrives */}
            <div className="text-xs text-slate-500 mb-1 min-h-[16px] flex items-center gap-1">
              {!statusLoading && isConnected && connectedLabel ? (
                <>
                  <span className="whitespace-nowrap">Connected to:</span>
                  <strong className="min-w-0 flex-1 truncate">{connectedLabel}</strong>
                </>
              ) : (
                <span className="opacity-0 whitespace-nowrap">Connected to: Placeholder</span>
              )}
            </div>
            {step === "value-source" &&
              isLinkedIn &&
              (isLegacyConversionValueConfig
                ? "Choose what Salesforce should provide for this LinkedIn campaign."
                : "Choose whether Salesforce should provide Total Revenue only, or Total Revenue + Pipeline (Proxy).")}
            {step === "campaign-field" &&
              "Select the Salesforce Opportunity field that identifies which deals belong to this MetricMind campaign."}
            {step === "crosswalk" &&
              `Select the value(s) from “${campaignFieldLabel}” that should map to this MetricMind campaign.`}
            {step === "pipeline" &&
              "Choose the Opportunity stage that should count as “pipeline created”. This provides a daily signal alongside daily spend."}
            {step === "revenue" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Select the Opportunity field that represents conversion value per conversion (estimated value)."
                : "Select the Opportunity field that represents revenue (usually Amount).")}
            {step === "review" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Confirm your selections. We'll compute and save conversion value to unlock LinkedIn revenue metrics."
                : "Confirm your selections. We'll pull won Opportunities and compute revenue-derived metrics for this campaign.")}
            {step === "complete" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Conversion value is saved. Revenue metrics should now be unlocked in Overview."
                : "Revenue is saved. Revenue metrics should now be unlocked in Overview.")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "value-source" && isLinkedIn && (
            <div className="rounded-lg border bg-white dark:bg-slate-950 p-4 space-y-2">
              <div className="text-sm font-medium">What do you want MetricMind to pull from Salesforce?</div>
              <RadioGroup
                value={salesforceSourceMode}
                onValueChange={(v: any) => {
                  const next = String(v || "");
                  setValueSource("revenue");
                  setConversionValueField("");
                  if (next === "revenue_plus_pipeline") {
                    setPipelineEnabled(true);
                  } else {
                    setPipelineEnabled(false);
                    setPipelineStageName("");
                    setPipelineStageLabel("");
                  }
                }}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="sf-mode-revenue-pipeline" value="revenue_plus_pipeline" className="mt-0.5" />
                  <label htmlFor="sf-mode-revenue-pipeline" className="cursor-pointer">
                    <div className="text-sm font-medium leading-snug">Total Revenue + Pipeline (Proxy)</div>
                    <div className="text-xs text-slate-500 leading-snug">
                      Total Revenue comes from mapped Opportunity Amounts (to date). Adds a Pipeline (Proxy) card using a stage like Proposal as an early signal.
                    </div>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="sf-mode-revenue-only" value="revenue_only" className="mt-0.5" />
                  <label htmlFor="sf-mode-revenue-only" className="cursor-pointer">
                    <div className="text-sm font-medium leading-snug">Total Revenue only (no Pipeline card)</div>
                    <div className="text-xs text-slate-500 leading-snug">
                      Imports revenue-to-date from mapped Opportunity Amounts. No Pipeline (Proxy) section in Overview.
                    </div>
                  </label>
                </div>
              </RadioGroup>
              <div className="text-xs text-slate-500">
                {salesforceSourceMode === "revenue_plus_pipeline"
                  ? "Next, you’ll choose which Opportunity stage should count as “pipeline created”."
                  : "Next, you’ll map Salesforce Opportunities to this campaign."}
              </div>
            </div>
          )}
          {step === "campaign-field" && (
            <div className="space-y-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Salesforce Opportunity field used to attribute deals to this campaign</Label>
                  {!statusLoading && !isConnected ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => void openOAuthWindow()} disabled={isConnecting}>
                      {isConnecting ? "Connecting…" : "Connect Salesforce"}
                    </Button>
                  ) : (
                    <div className="w-4 h-4">{/* reserved space (matches HubSpot layout) */}</div>
                  )}
                </div>

                <Select
                  value={campaignField}
                  onValueChange={(v) => setCampaignField(v)}
                  disabled={!isConnected || statusLoading || fieldsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        statusLoading
                          ? "Checking connection…"
                          : !isConnected
                          ? "Connect Salesforce to load fields…"
                          : "Select a Salesforce Opportunity field…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
                    {fields
                      .slice()
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-slate-500">
                  Tip: this is usually a field like <strong>LinkedIn Campaign</strong> / <strong>UTM Campaign</strong>.{" "}
                  <strong>Opportunity Name</strong> can work only if your opportunity naming convention contains the campaign value you want to map.
                </div>
                <div className="text-xs text-slate-500">
                  Note: this mapping step uses <strong>Closed Won</strong> opportunities (<code>IsWon = true</code>) to calculate{" "}
                  <strong>Total Revenue</strong>. If you enabled <strong>Pipeline (Proxy)</strong>, deals currently in stages like{" "}
                  <strong>Proposal</strong> will appear later under the <strong>Pipeline</strong> step and the Overview “Pipeline (Proxy)” card.
                </div>

                {oauthError && (
                  <div className="text-sm text-red-600">
                    {oauthError}{" "}
                    <button className="underline" onClick={() => void openOAuthWindow()}>
                      Retry
                    </button>
                  </div>
                )}

                {isConnected && fieldsError && (
                  <div className="text-sm text-red-600">
                    {fieldsError}{" "}
                    <button className="underline" onClick={() => void fetchFields()}>
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "crosswalk" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Values shown are <strong>Closed Won</strong> only (<code>IsWon = true</code>)—they contribute to <strong>Total Revenue</strong> (confirmed). On the next step, <strong>Pipeline (Proxy)</strong> lets you add anticipated revenue from open opportunities.
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  Selected: <strong>{selectedValues.length}</strong>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues(campaignField)} disabled={valuesLoading}>
                  {valuesLoading ? "Refreshing…" : "Refresh values"}
                </Button>
              </div>
              <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-slate-500">Loading values…</div>
                ) : valuesError ? (
                  <div className="text-sm text-red-600">
                    {valuesError}{" "}
                    <button className="underline" onClick={() => void fetchUniqueValues(campaignField)}>
                      Retry
                    </button>
                  </div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No values found. Try increasing the lookback window, or confirm you’re connected to the correct Salesforce org/user.
                  </div>
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
                            <div className="text-xs text-slate-500">{v.count} opportunity(ies)</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "pipeline" && isLinkedIn && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-white dark:bg-slate-950 p-4 space-y-3">
                <div className="text-sm font-medium">Pipeline stage total (daily signal)</div>
                <div className="text-xs text-slate-500">
                  Pipeline (Proxy) is <span className="font-medium">not</span> Closed Won revenue. It’s an early indicator (Opportunities currently in a stage like Proposal/Negotiation).
                </div>
                <div className="space-y-2">
                  <Label>Stage that counts as “pipeline created”</Label>
                  <Select
                    value={pipelineStageName}
                    onValueChange={(v) => {
                      setPipelineStageName(v);
                      const hit = stages.find((s) => s.value === v);
                      setPipelineStageLabel(hit?.label || v);
                    }}
                    disabled={stagesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={stagesLoading ? "Loading…" : "Select a stage…"} />
                    </SelectTrigger>
                    <SelectContent className="z-[10000] max-h-[320px]">
                      {stages.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-slate-500">
                    MetricMind will sum Opportunity Amounts for Opportunities currently in this stage (stage subset).
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "revenue" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isLinkedIn && valueSource === "conversion_value" ? "Conversion value field" : "Revenue field"}</Label>
                <Select
                  value={isLinkedIn && valueSource === "conversion_value" ? conversionValueField : revenueField}
                  onValueChange={(v) => {
                    if (isLinkedIn && valueSource === "conversion_value") setConversionValueField(v);
                    else setRevenueField(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {fields
                      .filter((f) => f.type === "currency" || f.type === "double" || f.type === "int" || f.name === "Amount")
                      .map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.label} ({f.name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-slate-500">
                  {isLinkedIn && valueSource === "conversion_value" ? "Choose a numeric field representing value per conversion." : "Default: Amount."}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Currency default: one currency per campaign. If mixed currencies are detected, you’ll be asked to filter to one.
              </div>
            </div>
          )}

          {step === "review" && <div />}

          {step === "review" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">
                Preview the Opportunities that will be used to compute <strong>Total Revenue</strong> for this campaign (<strong>Closed Won</strong> only).
                {isLinkedIn && pipelineEnabled ? (
                  <>
                    {" "}
                    Deals currently in pipeline stages (e.g., Proposal) are tracked separately under <strong>Pipeline (Proxy)</strong>.
                  </>
                ) : null}
              </div>

              {previewCampaignCurrency && (
                <div className={`text-xs ${previewCurrencyMismatch ? "text-amber-700" : "text-slate-500"}`}>
                  Currency: campaign <strong>{previewCampaignCurrency}</strong>
                  {effectiveSalesforceCurrency ? (
                    <>
                      {" "}· Salesforce <strong>{effectiveSalesforceCurrency}</strong>
                    </>
                  ) : (
                    <>
                      {" "}· Salesforce <strong>unknown</strong>
                    </>
                  )}
                  {effectiveCurrencyMismatch && (
                    <>
                      {" "}— please align currencies before saving.
                    </>
                  )}
                </div>
              )}

              {/* When currency is unknown, show immediate diagnostics (no DevTools required). */}
              {!effectiveSalesforceCurrency && (
                <div className="text-xs text-slate-500 space-y-1">
                  <div>
                    We couldn’t read Salesforce currency via API. Click <strong>Reconnect</strong> and try again.
                    {previewBuild ? (
                      <>
                        {" "}Build: <strong>{previewBuild}</strong>
                      </>
                    ) : null}
                  </div>
                  {Array.isArray(previewCurrencyDebugSteps) && previewCurrencyDebugSteps.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer underline">Why is it unknown?</summary>
                      <pre className="mt-2 max-h-[220px] overflow-auto rounded border bg-slate-50 p-2 text-[11px] leading-snug">
                        {JSON.stringify(previewCurrencyDebugSteps, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  Matching on <strong>{campaignFieldDisplay}</strong> · Revenue field <strong>{revenueFieldLabel}</strong> · Selected values{" "}
                  <strong>{selectedValues.length}</strong>
                </div>
              </div>

              {isLinkedIn && pipelineEnabled && pipelineStageLabel && (
                <div className="text-xs text-slate-500">
                  Pipeline proxy: <strong>{pipelineStageLabel}</strong>
                </div>
              )}

              {previewError && <div className="text-sm text-red-600">{previewError}</div>}
              {saveError && <div className="text-sm text-red-600">{saveError}</div>}

              {!previewError && previewHeaders.length > 0 && (
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewHeaders
                          .filter((h) => String(h).toLowerCase() !== "id")
                          .map((h) => (
                          <TableHead key={h} className="whitespace-nowrap">
                            {h.toLowerCase() === "name" ? "Opportunity Name" : h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={previewHeaders.filter((h) => String(h).toLowerCase() !== "id").length}
                            className="text-sm text-slate-500"
                          >
                            No matching Opportunities found for the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        previewRows.map((row, idx) => (
                          <TableRow key={idx}>
                            {row
                              .filter((_, j) => String(previewHeaders[j] || "").toLowerCase() !== "id")
                              .map((cell, j) => (
                                <TableCell key={j} className="max-w-[320px] truncate">
                                  {cell}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pipeline (Proxy) preview: stage subset (not Closed Won) */}
              {isLinkedIn && pipelineEnabled && (
                <div className="space-y-2 pt-2">
                  <div className="text-sm text-slate-700">
                    Preview for <strong>Pipeline (Proxy — stage subset)</strong> (Opportunities currently in{" "}
                    <strong>{pipelineStageLabel || pipelineStageName || "selected stage"}</strong>).
                  </div>
                  {pipelinePreviewError && <div className="text-sm text-red-600">{pipelinePreviewError}</div>}
                  {!pipelinePreviewError && pipelinePreviewHeaders.length > 0 && (
                    <div className="border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {pipelinePreviewHeaders
                              .filter((h) => String(h).toLowerCase() !== "id")
                              .map((h) => (
                                <TableHead key={h} className="whitespace-nowrap">
                                  {h.toLowerCase() === "name" ? "Opportunity Name" : h}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pipelinePreviewRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={pipelinePreviewHeaders.filter((h) => String(h).toLowerCase() !== "id").length}
                                className="text-sm text-slate-500"
                              >
                                No matching Opportunities found for the pipeline stage subset.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pipelinePreviewRows.map((row, idx) => (
                              <TableRow key={idx}>
                                {row
                                  .filter((_, j) => String(pipelinePreviewHeaders[j] || "").toLowerCase() !== "id")
                                  .map((cell, j) => (
                                    <TableCell key={j} className="max-w-[320px] truncate">
                                      {cell}
                                    </TableCell>
                                  ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-700">
                Saved conversion value: <strong>${String(lastSaveResult?.conversionValue ?? "0")}</strong> per conversion.
              </div>
              <div className="text-sm text-slate-700">
                Revenue metrics have been processed and are now available in the <strong>Overview</strong> tab.
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => onClose?.()}>Back to Campaign Overview</Button>
                <Button variant="outline" onClick={() => setStep("review")}>
                  View settings
                </Button>
              </div>
            </div>
          )}

          {step !== "connect" && step !== "complete" && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBackStep} disabled={valuesLoading || isSaving}>
                Back
              </Button>
              <Button
                onClick={() => void handleNext()}
                disabled={
                  valuesLoading ||
                  isSaving ||
                  stagesLoading ||
                  (step === "campaign-field" && (statusLoading || !isConnected || fieldsLoading || fields.length === 0 || !campaignField)) ||
                  (step === "crosswalk" && selectedValues.length === 0) ||
                  (step === "pipeline" && !pipelineStageName) ||
                  // Enterprise accuracy: don't allow saving when currency mismatch is known, or when currency is unknown.
                  (step === "review" && effectiveCurrencyMismatch)
                }
              >
                {step === "review" ? (isSaving ? "Processing…" : "Process Revenue Metrics") : "Continue"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



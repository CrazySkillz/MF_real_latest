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
  const [step, setStep] = useState<Step>("value-source");
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
  // Pipeline proxy can be enabled for an exec "early signal" (minimize lag). Available for all contexts.
  const [pipelineEnabled, setPipelineEnabled] = useState<boolean>(false);
  const [pipelineStageName, setPipelineStageName] = useState<string>("");
  const [pipelineStageLabel, setPipelineStageLabel] = useState<string>("");
  const [stages, setStages] = useState<Array<{ value: string; label: string }>>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  // Revenue classification hardcoded to offsite — users should not add Salesforce revenue that's already in GA4
  const [revenueClassification] = useState<"offsite_not_in_ga4">("offsite_not_in_ga4");
  // Fixed lookback to match HubSpot (no UI); new campaigns have limited records.
  const [days, setDays] = useState<number>(3650);
  // Which Salesforce date field to use for revenue dating
  const [dateField, setDateField] = useState<string>(
    (initialMappingConfig as any)?.dateField || "CloseDate"
  );

  const [uniqueValues, setUniqueValues] = useState<UniqueValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesError, setValuesError] = useState<string | null>(null);
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);

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
      { id: "value-source" as const, label: "Source", icon: DollarSign },
      { id: "campaign-field" as const, label: "Campaign field", icon: Target },
      { id: "crosswalk" as const, label: "Crosswalk", icon: Link2 },
      // Always include Pipeline in stepper to prevent layout shift when toggling.
      { id: "pipeline" as const, label: "Pipeline", icon: Target },
      { id: "revenue" as const, label: "Revenue", icon: DollarSign },
      { id: "review" as const, label: "Save", icon: ClipboardCheck },
    ],
    []
  );

  const currentStepIndex = useMemo(() => {
    const idx = steps.findIndex((s) => s.id === step);
    return idx >= 0 ? idx : steps.length;
  }, [steps, step]);

  const connectedLabel = useMemo(() => orgName || null, [orgName]);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/salesforce/${campaignId}/status`, { credentials: "include" });
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
      setStep("value-source");
      setOrgName(null);
      setOrgId(null);
      setFields([]);
      setFieldsError(null);
      setCampaignField("Name");
      setRevenueField("Amount");
      setConversionValueField("");
      setValueSource("revenue");
      setPipelineEnabled(false);
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
    if ((cfg as any).dateField) setDateField(String((cfg as any).dateField));
    setLastSaveResult(null);
    // Edit mode: jump to review so user sees current settings with preview
    setStep("review");
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
      const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/fields`, { credentials: "include" });
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
        )}&limit=300`,
        { credentials: "include" }
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
    setFieldsError(null);
    setValuesError(null);
    try {
      const resp = await fetch("/api/auth/salesforce/connect", {
        method: "POST",
        credentials: "include",
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
        } catch { }
        if (pollTimer) window.clearInterval(pollTimer);
        if (pollTimeout) window.clearTimeout(pollTimeout);
      };

      const handleAuthSuccess = async () => {
        cleanup();
        setStatusLoading(true);
        await fetchStatus();
        setStatusLoading(false);
        setIsConnecting(false);
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
        // Explicitly fetch fields with the fresh token — don't rely on useEffect
        // which has edit-mode guards that block re-fetching
        setFieldsError(null);
        try {
          await fetchFields();
        } catch {
          // non-fatal — user can retry
        }
        setStep("campaign-field");
      };

      const handleAuthError = (msg?: string) => {
        cleanup();
        setIsConnecting(false);
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
          const resp = await fetch(`/api/salesforce/${campaignId}/status`, { credentials: "include" });
          const json = await resp.json().catch(() => ({}));
          if (json?.connected) {
            await handleAuthSuccess();
          }
        } catch {
          // ignore
        }
      }, 1200);
      pollTimeout = window.setTimeout(() => { cleanup(); setIsConnecting(false); }, 60_000);

      window.addEventListener("message", onWindowMessage);
    } catch (err: any) {
      setIsConnecting(false); // Only on immediate failure (popup blocked, no auth URL)
      setOauthError(err?.message || "Failed to open Salesforce OAuth.");
      toast({
        title: "Salesforce Connection Failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
    // NOTE: Do NOT set isConnecting=false here — it stays true until handleAuthSuccess/handleAuthError
    // runs after the popup completes. This prevents the fields useEffect from firing with expired tokens.
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

  // Fetch fields when entering campaign-field or revenue steps (for dropdown options).
  // Skip if fields already loaded or if OAuth is in progress.
  // In edit mode: still attempt to fetch for dropdown options — if it fails (expired token),
  // the dropdown falls back to showing the raw prefilled field name, and the user can Reconnect.
  useEffect(() => {
    if (step !== "campaign-field" && step !== "revenue") return;
    if (fields.length > 0) return;
    if (isConnecting) return; // OAuth in progress — don't fetch with potentially expired token
    if (statusLoading || !isConnected) return;
    (async () => {
      try {
        await fetchFields();
      } catch (err: any) {
        // In edit mode, this is non-fatal — the dropdown shows the raw field name
        // and the user can click Reconnect to get a fresh token
        if (mode !== "edit" && !initialMappingConfig) {
          setFieldsError(err?.message || "Failed to load Opportunity fields.");
        }
      }
    })();
  }, [step, fields.length, statusLoading, isConnected, isConnecting, campaignId]);

  // When entering crosswalk step, load unique values if needed.
  // In edit mode with prefilled selectedValues, synthesize uniqueValues so checkboxes render.
  useEffect(() => {
    if (step !== "crosswalk") return;
    // If we have selectedValues but no uniqueValues (edit mode prefill), create synthetic entries
    if (uniqueValues.length === 0 && selectedValues.length > 0) {
      setUniqueValues(selectedValues.map(v => ({ value: v, count: 0 })));
      return;
    }
    if (!isConnected || !campaignField) return;
    if (uniqueValues.length > 0) return;
    void (async () => {
      try {
        await fetchUniqueValues(campaignField);
      } catch {
        // ignore — user can retry via Refresh button on the crosswalk step
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isConnected, campaignField, uniqueValues.length, selectedValues.length]);

  // Fetch pipeline stages when entering pipeline step.
  // Skip if stage is already prefilled from edit mode — prevents expired token errors.
  useEffect(() => {
    if (step !== "pipeline") return;
    if (!isConnected) return;
    if (stages.length > 0 || pipelineStageName) return;
    void (async () => {
      setStagesLoading(true);
      try {
        const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/stages`, { credentials: "include" });
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
  }, [step, isConnected, stages.length, pipelineStageName, campaignId, toast]);

  const salesforceSourceMode = useMemo(() => {
    return pipelineEnabled ? ("revenue_plus_pipeline" as const) : ("revenue_only" as const);
  }, [pipelineEnabled]);

  const isLegacyConversionValueConfig = useMemo(() => {
    if (mode !== "edit") return false;
    const raw = String((initialMappingConfig as any)?.valueSource || "").trim().toLowerCase();
    return raw === "conversion_value";
  }, [mode, initialMappingConfig]);

  // Revenue amount for the review step: prefer save result, then stored config, then preview data
  // Returns a number (including 0) when data is available, null when no data yet
  const reviewRevenue = useMemo(() => {
    if (lastSaveResult?.totalRevenue != null) return Number(lastSaveResult.totalRevenue);
    const stored = Number((initialMappingConfig as any)?.lastTotalRevenue);
    if (Number.isFinite(stored)) return stored;
    // Preview completed (headers set) — compute from rows even if 0
    if (previewHeaders.length > 0) {
      const amtIdx = previewHeaders.findIndex((h) => h.toLowerCase() === "amount" || h === revenueField);
      if (amtIdx >= 0) {
        return previewRows.reduce((acc, row) => acc + (Number(row[amtIdx]) || 0), 0);
      }
      return 0;
    }
    return null;
  }, [lastSaveResult, initialMappingConfig, previewRows, previewHeaders, revenueField]);

  const campaignFieldLabel = useMemo(() => {
    const f = fields.find((x) => x.name === campaignField);
    return f?.label || campaignField || "Campaign field";
  }, [fields, campaignField]);

  const campaignFieldDisplay = useMemo(() => {
    if (fieldsLoading) return "Loading fields…";
    // If we're defaulted to Salesforce API field "Name", always display the friendly label.
    if (String(campaignField || "").toLowerCase() === "name") return "Opportunity Name";
    const f = fields.find((x) => x.name === campaignField);
    return f?.label || campaignField || "Select an Opportunity field…";
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignField,
          selectedValues,
          revenueField,
          days,
          limit: 25,
          pipelineEnabled,
          pipelineStageName: pipelineEnabled ? pipelineStageName : null,
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignField,
          selectedValues,
          revenueField,
          ...(isLinkedIn && conversionValueField ? { conversionValueField } : {}),
          valueSource: isLinkedIn ? valueSource : "revenue",
          revenueClassification,
          days,
          dateField,
          pipelineEnabled,
          pipelineStageName: pipelineEnabled ? (pipelineStageName || null) : null,
          pipelineStageLabel: pipelineEnabled ? (pipelineStageLabel || null) : null,
          platformContext,
          ...(isLinkedIn && campaignMappings.length > 0 ? { campaignMappings } : {}),
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
      if (!isConnected && mode !== "edit" && !initialMappingConfig) {
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
      // In edit mode with prefilled values, skip the API fetch — crosswalk useEffect will synthesize from selectedValues
      if (!((mode === "edit" || initialMappingConfig) && selectedValues.length > 0)) {
        await fetchUniqueValues(campaignField);
      }
      setStep("crosswalk");
      return;
    }
    if (step === "crosswalk") {
      const crosswalkEmpty = isLinkedIn && linkedinCampaigns.length > 0
        ? campaignMappings.length === 0
        : selectedValues.length === 0;
      if (crosswalkEmpty) {
        toast({
          title: "Select at least one value",
          description: "Pick the Salesforce value(s) that should map to this campaign.",
          variant: "destructive",
        });
        return;
      }
      setStep(pipelineEnabled ? "pipeline" : "revenue");
      return;
    }
    if (step === "pipeline") {
      if (!pipelineStageName) {
        toast({
          title: "Select a pipeline stage",
          description: "Choose the Opportunity stage that should count as 'pipeline created'.",
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
      // Fire preview in background to populate revenue total — non-blocking, fails silently
      if (isConnected && !isConnecting && selectedValues.length > 0 && previewRows.length === 0) {
        void preview().catch(() => {});
      }
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
          const isPipelineStep = s.id === "pipeline";
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
                  className={`text-xs mt-2 text-center whitespace-nowrap ${isDisabled
                      ? "text-muted-foreground/70"
                      : isActive
                        ? "text-blue-600 font-medium"
                        : isCompleted
                          ? "text-green-600"
                          : "text-muted-foreground/70"
                    }`}
                >
                  {s.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isConnectorCompleted ? "bg-green-600" : "bg-muted"}`} />
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

            {/* Reconnect only on campaign-field step — other steps don't need it */}
            {step === "campaign-field" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void openOAuthWindow()}
                disabled={isConnecting || statusLoading || !isConnected}
                className={`${!statusLoading && isConnected ? "" : "opacity-0 pointer-events-none"} min-w-[116px]`}
              >
                {isConnecting ? "Reconnecting…" : "Reconnect"}
              </Button>
            ) : (
              <div className="min-w-[116px]" />
            )}
          </div>
          <CardDescription>
            {/* Reserve space for connection label to avoid layout shift when async status arrives */}
            <div className="text-xs text-muted-foreground mb-1 min-h-[16px] flex items-center gap-1">
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
              (isLegacyConversionValueConfig
                ? "Choose what Salesforce should provide for this campaign."
                : "Choose whether Salesforce should provide Total Revenue only, or Total Revenue + Pipeline (Proxy).")}
            {step === "campaign-field" &&
              "Select the Salesforce Opportunity field that identifies which deals belong to this MetricMind campaign."}
            {step === "crosswalk" &&
              `Select the value(s) from "${campaignFieldLabel}" that should map to this MetricMind campaign.`}
            {step === "pipeline" &&
              "Choose the Opportunity stage that should count as 'pipeline created'. This provides a daily signal alongside daily spend."}
            {step === "revenue" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Select the Opportunity field that represents conversion value per conversion (estimated value)."
                : "Select the Opportunity field that represents revenue (usually Amount).")}
            {step === "review" && "Review the settings below, then save mappings."}
            {step === "complete" &&
              (isLinkedIn && valueSource === "conversion_value"
                ? "Conversion value is saved. Revenue metrics should now be unlocked in Overview."
                : "Revenue is saved. Revenue metrics should now be unlocked in Overview.")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "value-source" && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="text-sm font-medium">What do you want MetricMind to pull from Salesforce?</div>
              <div className="text-xs text-muted-foreground/70 mb-2">
                <strong>Note:</strong> For long sales cycles, Pipeline Proxy provides an early indicator before deals close.
              </div>
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
                    <div className="text-xs text-muted-foreground leading-snug">
                      Total Revenue comes from mapped Opportunity Amounts (to date). Adds a Pipeline (Proxy) card using a stage like Proposal as an early signal.
                    </div>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="sf-mode-revenue-only" value="revenue_only" className="mt-0.5" />
                  <label htmlFor="sf-mode-revenue-only" className="cursor-pointer">
                    <div className="text-sm font-medium leading-snug">Total Revenue only (no Pipeline card)</div>
                    <div className="text-xs text-muted-foreground leading-snug">
                      Imports revenue-to-date from mapped Opportunity Amounts. No Pipeline (Proxy) section in Overview.
                    </div>
                  </label>
                </div>
              </RadioGroup>
              <div className="text-xs text-muted-foreground">
                {salesforceSourceMode === "revenue_plus_pipeline"
                  ? "Next, you’ll choose which Opportunity stage should count as 'pipeline created'."
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
                    {fields.length > 0
                      ? fields
                          .slice()
                          .sort((a, b) => a.label.localeCompare(b.label))
                          .map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.label}
                            </SelectItem>
                          ))
                      : campaignField
                        ? (<SelectItem value={campaignField}>{campaignFieldDisplay}</SelectItem>)
                        : null}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">
                  Tip: this is usually a field like <strong>LinkedIn Campaign</strong> / <strong>UTM Campaign</strong>.{" "}
                  <strong>Opportunity Name</strong> can work only if your opportunity naming convention contains the campaign value you want to map.
                </div>
                {pipelineEnabled ? (
                  <div className="text-xs text-muted-foreground">
                    Note: this mapping step uses <strong>Closed Won</strong> opportunities (<code>IsWon = true</code>) to calculate{" "}
                    <strong>Total Revenue</strong>. If you enabled <strong>Pipeline (Proxy)</strong>, deals currently in stages like{" "}
                    <strong>Proposal</strong> will appear later under the <strong>Pipeline</strong> step and the Overview Pipeline (Proxy) card.
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Note: this mapping step uses <strong>Closed Won</strong> opportunities (<code>IsWon = true</code>) to calculate{" "}
                    <strong>Total Revenue</strong>.
                  </div>
                )}

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
              <div className="text-xs text-muted-foreground">
                Values shown are <strong>Closed Won</strong> only — they contribute to <strong>Total Revenue</strong> (confirmed).
                {pipelineEnabled && (
                  <> On the next step, <strong>Pipeline (Proxy)</strong> lets you add anticipated revenue from open opportunities.</>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {isLinkedIn && linkedinCampaigns.length > 0
                    ? <>Mapped: <strong>{campaignMappings.length}</strong> of {uniqueValues.length} values</>
                    : <>Selected: <strong>{selectedValues.length}</strong></>}
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchUniqueValues(campaignField)} disabled={valuesLoading}>
                  {valuesLoading ? "Refreshing…" : "Refresh values"}
                </Button>
              </div>
              <div className="border rounded p-3 max-h-[280px] overflow-y-auto">
                {valuesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading values…</div>
                ) : valuesError ? (
                  <div className="text-sm text-red-600">
                    {valuesError}{" "}
                    <button className="underline" onClick={() => void fetchUniqueValues(campaignField)}>
                      Retry
                    </button>
                  </div>
                ) : uniqueValues.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No values found. Try increasing the lookback window, or confirm you're connected to the correct Salesforce org/user.
                  </div>
                ) : isLinkedIn && linkedinCampaigns.length > 0 ? (
                  /* LinkedIn campaign mapping mode */
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground mb-2">
                      Map each Salesforce value to a LinkedIn campaign. Unmapped values will be skipped.
                    </div>
                    {uniqueValues.map((v) => {
                      const value = String(v.value);
                      const existing = campaignMappings.find(m => m.crmValue === value);
                      return (
                        <div key={value} className="flex items-center gap-3 p-2 rounded border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{value}</div>
                            <div className="text-xs text-muted-foreground">{v.count} opportunity(ies)</div>
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
                            <div className="text-xs text-muted-foreground">{v.count} opportunity(ies)</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "pipeline" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="text-sm font-medium">Pipeline stage total (daily signal)</div>
                <div className="text-xs text-muted-foreground">
                  Pipeline (Proxy) is <span className="font-medium">not</span> Closed Won revenue. It’s an early indicator (Opportunities currently in a stage like Proposal/Negotiation).
                </div>
                <div className="space-y-2">
                  <Label>Stage that counts as 'pipeline created'</Label>
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
                      {stages.length > 0
                        ? stages.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))
                        : pipelineStageName
                          ? (<SelectItem value={pipelineStageName}>{pipelineStageLabel || pipelineStageName}</SelectItem>)
                          : null}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
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
                    {(() => {
                      const numericFields = fields.filter((f) => f.type === "currency" || f.type === "double" || f.type === "int" || f.name === "Amount");
                      if (numericFields.length > 0) {
                        return numericFields.map((f) => (
                          <SelectItem key={f.name} value={f.name}>
                            {f.label} ({f.name})
                          </SelectItem>
                        ));
                      }
                      // Fallback: show prefilled value when fields haven't loaded
                      const currentVal = isLinkedIn && valueSource === "conversion_value" ? conversionValueField : revenueField;
                      return currentVal ? <SelectItem value={currentVal}>{revenueFieldLabel} ({currentVal})</SelectItem> : null;
                    })()}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  {isLinkedIn && valueSource === "conversion_value" ? "Choose a numeric field representing value per conversion." : "Default: Amount."}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Currency default: one currency per campaign. If mixed currencies are detected, you’ll be asked to filter to one.
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Only add Salesforce revenue if these opportunities are <strong>NOT</strong> already tracked as GA4 ecommerce transactions. Adding the same revenue from both sources will double-count your total.
                </p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label className="text-muted-foreground">Date field <span className="text-xs font-normal">(advanced)</span></Label>
                <Select value={dateField} onValueChange={setDateField}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="CloseDate">Close Date — when the deal was won</SelectItem>
                    <SelectItem value="CreatedDate">Created Date — when the opportunity was created</SelectItem>
                    <SelectItem value="LastModifiedDate">Last Modified Date — when the record was last updated</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Controls which date revenue is reported under. Default: Close Date.
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Review Salesforce revenue settings
                </div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                  Confirm these details before saving.
                  {" "}Revenue will be treated as <span className="font-medium">revenue-to-date</span> for this campaign.
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground/70">Salesforce account</div>
                    <div className="font-medium text-foreground">
                      {connectedLabel || orgName || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground/70">Revenue field</div>
                    <div className="font-medium text-foreground">{revenueFieldLabel}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground/70">Campaign identifier field</div>
                    <div className="font-medium text-foreground">{campaignFieldDisplay}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground/70">Total Revenue (to date)</div>
                    <div className="font-medium text-foreground text-green-700 dark:text-green-400">
                      {reviewRevenue != null
                        ? `$${Number(reviewRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : previewLoading
                          ? "Loading..."
                          : "—"}
                    </div>
                  </div>

                  {pipelineEnabled && (
                    <div>
                      <div className="text-xs text-muted-foreground/70">Pipeline proxy</div>
                      <div className="font-medium text-foreground">
                        {pipelineStageLabel || pipelineStageName || "---"}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-muted-foreground/70">Date field</div>
                    <div className="font-medium text-foreground">
                      {dateField === "CloseDate" ? "Close Date" : dateField === "LastModifiedDate" ? "Last Modified Date" : dateField === "CreatedDate" ? "Created Date" : dateField}
                    </div>
                  </div>

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

              {previewCampaignCurrency && effectiveCurrencyMismatch && (
                <div className="text-xs text-amber-700">
                  Currency mismatch: campaign <strong>{previewCampaignCurrency}</strong> · Salesforce <strong>{effectiveSalesforceCurrency}</strong> — please align currencies before saving.
                </div>
              )}

              {previewError && <div className="text-sm text-red-600">{previewError}</div>}
              {saveError && <div className="text-sm text-red-600">{saveError}</div>}
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3">
              <div className="text-sm text-foreground/80">
                Saved conversion value: <strong>${String(lastSaveResult?.conversionValue ?? "0")}</strong> per conversion.
              </div>
              <div className="text-sm text-foreground/80">
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
                  (step === "campaign-field" && (statusLoading || (!isConnected && mode !== "edit" && !initialMappingConfig) || fieldsLoading || (fields.length === 0 && mode !== "edit" && !initialMappingConfig) || !campaignField)) ||
                  (step === "crosswalk" && (isLinkedIn && linkedinCampaigns.length > 0 ? campaignMappings.length === 0 : selectedValues.length === 0)) ||
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



import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, FileSpreadsheet, ShoppingCart, Upload, ArrowLeft, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HubSpotRevenueWizard } from "@/components/HubSpotRevenueWizard";
import { SalesforceRevenueWizard } from "@/components/SalesforceRevenueWizard";
import { ShopifyRevenueWizard } from "@/components/ShopifyRevenueWizard";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import { useQueryClient } from "@tanstack/react-query";

type Step = "select" | "manual" | "csv" | "csv_map" | "sheets_choose" | "sheets_map" | "hubspot" | "salesforce" | "shopify";
const SELECT_NONE = "__none__";

type Preview = {
  fileName?: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
};

export function AddRevenueWizardModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  currency: string;
  dateRange: string;
  initialSource?: any;
  onSuccess?: () => void;
  platformContext?: 'ga4' | 'linkedin' | 'meta';
  initialStep?: Step;
  hideCrmSources?: boolean;
  connectedPlatforms?: Array<{ label: string; value: string }>;
}) {
  const { open, onOpenChange, campaignId, currency, dateRange, onSuccess, initialSource, platformContext = 'ga4', initialStep, hideCrmSources = false, connectedPlatforms = [] } = props;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateAfterRevenueChange = () => {
    // Force refetch ALL campaign queries so revenue changes propagate immediately
    void queryClient.refetchQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key.some((k) => typeof k === "string" && k.includes(String(campaignId)));
      },
      type: "active",
    });

    if (platformContext === 'linkedin') {
      // LinkedIn revenue totals must always be scoped (never fall back to GA4 totals).
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date?platformContext=linkedin`], exact: false });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=linkedin`], exact: false });
      // LinkedIn-specific caches (some pages use array-shaped keys).
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "linkedin"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/linkedin/metrics", campaignId], exact: false });
      // LinkedIn Overview tab consumes session-scoped aggregates: refresh any open session views.
      void queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"], exact: false });

      // LinkedIn KPI tab caches (ROI/ROAS/etc). Revenue changes must refresh these immediately.
      // NOTE: LinkedIn KPIs are refreshed server-side on fetch (`GET /api/platforms/linkedin/kpis?campaignId=...`),
      // so the critical piece is to force a refetch by invalidating the query keys used by the UI.
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/kpis"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });

      // Optional HubSpot/Salesforce pipeline proxy (exec daily signal) - must invalidate both so correct one refetches
      void queryClient.invalidateQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
    }

    if (platformContext === 'meta') {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date?platformContext=meta`], exact: false });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=meta`], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/meta", campaignId], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/meta/kpis"], exact: false });
    }

    // GA4 KPI tab caches (revenue-to-date affects financial KPIs when GA4 revenue is missing).
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/kpis"], exact: false });
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/kpis", campaignId], exact: false });

    // Best-effort immediate refresh when mounted (keeps Overview feeling instant).
    void queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
    void queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"], exact: false });

    if (platformContext === 'linkedin') {
      void queryClient.refetchQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });
      void queryClient.refetchQueries({ queryKey: ["/api/hubspot", campaignId, "pipeline-proxy"], exact: false });
      void queryClient.refetchQueries({ queryKey: ["/api/salesforce", campaignId, "pipeline-proxy"], exact: false });
    } else if (platformContext === 'meta') {
      void queryClient.refetchQueries({ queryKey: ["/api/meta", campaignId], exact: false });
    } else {
      void queryClient.refetchQueries({ queryKey: ["/api/platforms/google_analytics/kpis", campaignId], exact: false });
    }

    // Also refresh unified data-sources tab
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/all-data-sources`], exact: false });
  };

  const [step, setStep] = useState<Step>("select");
  const isEditing = !!initialSource;
  const sheetsPurpose = platformContext === 'linkedin' ? 'linkedin_revenue' : platformContext === 'meta' ? 'meta_revenue' : 'revenue';
  const [salesforceInitialMappingConfig, setSalesforceInitialMappingConfig] = useState<null | {
    campaignField?: string;
    selectedValues?: string[];
    revenueField?: string;
    conversionValueField?: string;
    valueSource?: string;
    days?: number;
    pipelineEnabled?: boolean;
    pipelineStageName?: string;
    pipelineStageLabel?: string;
  }>(null);
  const [hubspotInitialMappingConfig, setHubspotInitialMappingConfig] = useState<null | {
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
  }>(null);

  // Manual
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualConversionValue, setManualConversionValue] = useState<string>("");
  const [manualValueSource, setManualValueSource] = useState<'revenue' | 'conversion_value'>('revenue');
  const [manualSpendAmount, setManualSpendAmount] = useState<string>("");
  const [manualPlatform, setManualPlatform] = useState<string>(platformContext || 'ga4');
  const [manualSubCampaign, setManualSubCampaign] = useState<string>("");
  const [platformCampaigns, setPlatformCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [platformCampaignsLoading, setPlatformCampaignsLoading] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const formatCurrencyWhileTyping = (raw: string) => {
    const s = String(raw ?? "");
    // allow digits + one decimal point
    const cleaned = s.replace(/[^\d.]/g, "");
    const [intRaw, decRaw = ""] = cleaned.split(".");
    const intDigits = (intRaw || "").replace(/^0+(?=\d)/, "") || (intRaw ? "0" : "");
    const intWithCommas = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = decRaw.slice(0, 2); // currency: 2 decimals max
    return cleaned.includes(".") ? `${intWithCommas}.${dec}` : intWithCommas;
  };
  const formatCurrencyOnBlur = (raw: string) => {
    const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Preview | null>(null);
  const [csvRevenueCol, setCsvRevenueCol] = useState<string>("");
  const [csvConversionValueCol, setCsvConversionValueCol] = useState<string>("");
  const [csvCampaignCol, setCsvCampaignCol] = useState<string>("");
  const [csvCampaignQuery, setCsvCampaignQuery] = useState<string>("");
  const [csvCampaignValues, setCsvCampaignValues] = useState<string[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvPreviewing, setCsvPreviewing] = useState(false);
  const [csvPrefill, setCsvPrefill] = useState<null | {
    revenueColumn?: string;
    conversionValueColumn?: string;
    campaignColumn?: string;
    campaignValues?: string[];
  }>(null);
  const [csvValueSource, setCsvValueSource] = useState<'revenue' | 'conversion_value'>('revenue');

  // Sheets
  const [sheetsConnections, setSheetsConnections] = useState<any[]>([]);
  const [sheetsConnectionsLoading, setSheetsConnectionsLoading] = useState(false);
  const [sheetsConnectionId, setSheetsConnectionId] = useState<string>("");
  const [showSheetsConnect, setShowSheetsConnect] = useState(false);
  const [sheetsRemoving, setSheetsRemoving] = useState(false);
  const [sheetsPreview, setSheetsPreview] = useState<Preview | null>(null);
  const [sheetsRevenueCol, setSheetsRevenueCol] = useState<string>("");
  const [sheetsConversionValueCol, setSheetsConversionValueCol] = useState<string>("");
  const [sheetsCampaignCol, setSheetsCampaignCol] = useState<string>("");
  const [sheetsCampaignQuery, setSheetsCampaignQuery] = useState<string>("");
  const [sheetsCampaignValues, setSheetsCampaignValues] = useState<string[]>([]);
  const [sheetsProcessing, setSheetsProcessing] = useState(false);
  const [sheetsValueSource, setSheetsValueSource] = useState<'revenue' | 'conversion_value'>('revenue');

  // Embedded wizard navigation helpers (outer modal Back button should behave like the wizard back).
  const [shopifyWizardStep, setShopifyWizardStep] = useState<any>("campaign-field");
  const [shopifyExternalStep, setShopifyExternalStep] = useState<any>(null);
  const [shopifyExternalNonce, setShopifyExternalNonce] = useState(0);
  const [hubspotBackNonce, setHubspotBackNonce] = useState(0);
  const [salesforceBackNonce, setSalesforceBackNonce] = useState(0);

  // Connection status for CRM/ecommerce sources (used for badges in source picker)
  const [crmStatus, setCrmStatus] = useState<{ hubspot: boolean; salesforce: boolean; shopify: boolean }>({ hubspot: false, salesforce: false, shopify: false });
  const [crmConnecting, setCrmConnecting] = useState<string | null>(null);
  useEffect(() => {
    if (!open || hideCrmSources) return;
    let cancelled = false;
    (async () => {
      const checks = await Promise.all([
        fetch(`/api/hubspot/${campaignId}/status`).then(r => r.json()).then(j => !!j?.connected).catch(() => false),
        fetch(`/api/salesforce/${campaignId}/status`).then(r => r.json()).then(j => !!j?.connected).catch(() => false),
        fetch(`/api/shopify/${campaignId}/status`).then(r => r.json()).then(j => !!j?.connected).catch(() => false),
      ]);
      if (!cancelled) setCrmStatus({ hubspot: checks[0], salesforce: checks[1], shopify: checks[2] });
    })();
    return () => { cancelled = true; };
  }, [open, campaignId, hideCrmSources]);

  // OAuth gate: connect platform first, then proceed to wizard
  const handleCrmSourceClick = async (platform: "hubspot" | "salesforce" | "shopify") => {
    // Already connected — go straight to wizard
    if (crmStatus[platform]) {
      setStep(platform);
      return;
    }
    // Not connected — trigger OAuth popup
    setCrmConnecting(platform);
    try {
      const endpoint = platform === "hubspot" ? "/api/auth/hubspot/connect"
        : platform === "salesforce" ? "/api/auth/salesforce/connect"
        : "/api/auth/shopify/connect";
      const resp = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.authUrl) {
        toast({ title: `Failed to start ${platform} connection`, description: json?.message || "Please try again.", variant: "destructive" });
        setCrmConnecting(null);
        return;
      }
      const windowName = `${platform}_oauth`;
      const popup = window.open(json.authUrl, windowName, "width=520,height=680");

      // Listen for OAuth completion via postMessage
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;
        if (data.type === `${platform}_auth_success`) {
          window.removeEventListener("message", onMessage);
          setCrmStatus(prev => ({ ...prev, [platform]: true }));
          setCrmConnecting(null);
          toast({ title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected`, description: "Now configure revenue attribution." });
          setStep(platform);
        } else if (data.type === `${platform}_auth_error`) {
          window.removeEventListener("message", onMessage);
          setCrmConnecting(null);
          toast({ title: "Connection failed", description: data.error || "OAuth was cancelled or failed.", variant: "destructive" });
        }
      };
      window.addEventListener("message", onMessage);

      // Salesforce also uses BroadcastChannel as fallback
      let bc: BroadcastChannel | null = null;
      if (platform === "salesforce" && typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("metricmind_oauth");
        bc.addEventListener("message", ((event: MessageEvent) => {
          const data = event.data;
          if (!data || typeof data !== "object") return;
          if (data.type === "salesforce_auth_success") {
            window.removeEventListener("message", onMessage);
            bc?.close();
            setCrmStatus(prev => ({ ...prev, salesforce: true }));
            setCrmConnecting(null);
            toast({ title: "Salesforce connected", description: "Now configure revenue attribution." });
            setStep("salesforce");
          } else if (data.type === "salesforce_auth_error") {
            window.removeEventListener("message", onMessage);
            bc?.close();
            setCrmConnecting(null);
            toast({ title: "Connection failed", description: data.error || "OAuth was cancelled or failed.", variant: "destructive" });
          }
        }) as EventListener);
      }

      // Fallback: poll popup closed
      const interval = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(interval);
          // Give postMessage a moment to arrive
          setTimeout(() => {
            setCrmConnecting(prev => {
              if (prev === platform) {
                window.removeEventListener("message", onMessage);
                bc?.close();
                return null;
              }
              return prev;
            });
          }, 1500);
        }
      }, 1000);
    } catch (err: any) {
      setCrmConnecting(null);
      toast({ title: "Connection error", description: err?.message || "Failed to open OAuth.", variant: "destructive" });
    }
  };

  const [crmDisconnecting, setCrmDisconnecting] = useState<string | null>(null);
  const handleCrmDisconnect = async (platform: "hubspot" | "salesforce" | "shopify") => {
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    setCrmDisconnecting(platform);
    try {
      // Delete any active revenue source for this platform
      const dsResp = await fetch(`/api/campaigns/${campaignId}/all-data-sources`, { credentials: "include" });
      const dsJson = await dsResp.json().catch(() => ({}));
      const revSources = Array.isArray(dsJson?.revenueSources) ? dsJson.revenueSources : [];
      const entry = revSources.find((s: any) => s?.sourceType === platform && s?.isActive !== false);
      if (entry?.id) {
        await apiRequest('DELETE', `/api/campaigns/${campaignId}/revenue-sources/${entry.id}`);
      }
      // Delete the OAuth connection
      await apiRequest('DELETE', `/api/${platform}/${campaignId}/connection`);
      setCrmStatus(prev => ({ ...prev, [platform]: false }));
      invalidateAfterRevenueChange();
      toast({ title: `${label} disconnected`, description: "Revenue source and connection removed." });
    } catch (err: any) {
      toast({ title: "Disconnect failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCrmDisconnecting(null);
    }
  };

  const resetAll = () => {
    setStep(initialStep || "select");
    setManualAmount("");
    setManualConversionValue("");
    setManualValueSource('revenue');
    setManualSpendAmount("");
    setManualPlatform(platformContext || 'ga4');
    setManualSubCampaign("");
    setPlatformCampaigns([]);
    setSavingManual(false);
    setCsvFile(null);
    setCsvPreview(null);
    setCsvRevenueCol("");
    setCsvConversionValueCol("");
    setCsvCampaignCol("");
    setCsvCampaignQuery("");
    setCsvCampaignValues([]);
    setCsvProcessing(false);
    setCsvPreviewing(false);
    setCsvPrefill(null);
    setCsvValueSource('revenue');
    setSheetsConnectionId("");
    setSheetsConnectionsLoading(false);
    setShowSheetsConnect(false);
    setSheetsRemoving(false);
    setSheetsPreview(null);
    setSheetsRevenueCol("");
    setSheetsConversionValueCol("");
    setSheetsCampaignCol("");
    setSheetsCampaignQuery("");
    setSheetsCampaignValues([]);
    setSheetsProcessing(false);
    setSheetsValueSource('revenue');
    setShopifyWizardStep("campaign-field");
    setShopifyExternalStep(null);
    setShopifyExternalNonce(0);
    setHubspotBackNonce(0);
    setSalesforceBackNonce(0);
    setHubspotInitialMappingConfig(null);
    setSalesforceInitialMappingConfig(null);
    setCrmConnecting(null);
  };

  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!initialStep) return;
    // Only apply on first open to avoid stomping user navigation.
    setStep(initialStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch platform campaigns when manual platform selection changes
  useEffect(() => {
    if (!open || step !== 'manual') return;
    if (manualPlatform === 'ga4') {
      setPlatformCampaigns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPlatformCampaignsLoading(true);
      setPlatformCampaigns([]);
      setManualSubCampaign("");
      try {
        if (manualPlatform === 'linkedin') {
          const resp = await fetch(`/api/campaigns/${campaignId}/linkedin-campaigns`, { credentials: "include" });
          const json = await resp.json().catch(() => ({}));
          if (!cancelled && Array.isArray(json?.campaigns)) {
            setPlatformCampaigns(json.campaigns.map((c: any) => ({ id: c.campaignUrn || c.id || c.name, name: c.name || c.campaignUrn || 'Unknown' })));
          }
        } else if (manualPlatform === 'meta') {
          const resp = await fetch(`/api/meta/${campaignId}/campaigns`, { credentials: "include" });
          const json = await resp.json().catch(() => ({}));
          if (!cancelled && Array.isArray(json?.campaigns)) {
            setPlatformCampaigns(json.campaigns.map((c: any) => ({ id: c.id || c.name, name: c.name || c.id || 'Unknown' })));
          }
        } else if (manualPlatform === 'google-ads') {
          const resp = await fetch(`/api/google-ads/${campaignId}/daily-metrics`, { credentials: "include" });
          const json = await resp.json().catch(() => ({}));
          if (!cancelled && Array.isArray(json?.metrics)) {
            const seen = new Map<string, string>();
            for (const m of json.metrics) {
              if (m.googleCampaignId && !seen.has(m.googleCampaignId)) {
                seen.set(m.googleCampaignId, m.googleCampaignName || m.googleCampaignId);
              }
            }
            setPlatformCampaigns(Array.from(seen, ([id, name]) => ({ id, name })));
          }
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (!cancelled) setPlatformCampaignsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, manualPlatform, campaignId]);

  // Prefill edit mode from an existing revenue source (manual + sheets supported; CSV requires re-upload).
  useEffect(() => {
    if (!open) return;
    if (!initialSource) return;

    let config: any = {};
    try {
      config = initialSource?.mappingConfig ? JSON.parse(String(initialSource.mappingConfig)) : {};
    } catch {
      config = {};
    }

    const type = String(initialSource?.sourceType || "").toLowerCase();
    if (type === "manual") {
      const amt = config?.amount;
      const cv = config?.conversionValue;
      const vsRaw = String(config?.valueSource || "").trim().toLowerCase();
      const vs: 'revenue' | 'conversion_value' = vsRaw === 'conversion_value' ? 'conversion_value' : 'revenue';
      setStep("manual");
      setManualAmount(amt === 0 || amt ? formatCurrencyOnBlur(String(amt)) : "");
      setManualConversionValue(cv === 0 || cv ? formatCurrencyOnBlur(String(cv)) : "");
      setManualValueSource(vs);
      return;
    }

    if (type === "google_sheets") {
      const connId = String(config?.connectionId || initialSource?.connectionId || "");
      const vsRaw = String(config?.valueSource || config?.mode || "").trim().toLowerCase();
      const vs: 'revenue' | 'conversion_value' = vsRaw === 'conversion_value' ? 'conversion_value' : 'revenue';
      setStep("sheets_map");
      if (connId) setSheetsConnectionId(connId);
      // We'll fetch preview in the mapping step; after preview loads we re-apply mappings below.
      setSheetsRevenueCol(String(config?.revenueColumn || ""));
      setSheetsConversionValueCol(String(config?.conversionValueColumn || ""));
      setSheetsValueSource(vs);
      setSheetsCampaignCol(String(config?.campaignColumn || ""));
      setSheetsCampaignValues(Array.isArray(config?.campaignValues) ? config.campaignValues.map(String) : []);
      return;
    }

    if (type === "csv") {
      const vsRaw = String(config?.valueSource || config?.mode || "").trim().toLowerCase();
      const vs: 'revenue' | 'conversion_value' = vsRaw === 'conversion_value' ? 'conversion_value' : 'revenue';
      setStep("csv");
      setCsvPrefill({
        revenueColumn: String(config?.revenueColumn || ""),
        conversionValueColumn: String(config?.conversionValueColumn || ""),
        campaignColumn: String(config?.campaignColumn || ""),
        campaignValues: Array.isArray(config?.campaignValues) ? config.campaignValues.map(String) : [],
      });
      setCsvConversionValueCol(String(config?.conversionValueColumn || ""));
      setCsvValueSource(vs);
      return;
    }

    if (type === "salesforce") {
      const next = {
        campaignField: config?.campaignField ? String(config.campaignField) : undefined,
        selectedValues: Array.isArray(config?.selectedValues) ? config.selectedValues.map(String) : undefined,
        revenueField: config?.revenueField ? String(config.revenueField) : undefined,
        conversionValueField: config?.conversionValueField ? String(config.conversionValueField) : undefined,
        valueSource: config?.valueSource ? String(config.valueSource) : undefined,
        days: Number.isFinite(Number(config?.days)) ? Number(config.days) : undefined,
        pipelineEnabled: config?.pipelineEnabled === true,
        pipelineStageName: config?.pipelineStageName ? String(config.pipelineStageName) : undefined,
        pipelineStageLabel: config?.pipelineStageLabel ? String(config.pipelineStageLabel) : undefined,
      };
      setSalesforceInitialMappingConfig(next);
      setStep("salesforce");
      return;
    }

    if (type === "hubspot") {
      const next = {
        campaignProperty: config?.campaignProperty ? String(config.campaignProperty) : undefined,
        selectedValues: Array.isArray(config?.selectedValues) ? config.selectedValues.map(String) : undefined,
        revenueProperty: config?.revenueProperty ? String(config.revenueProperty) : undefined,
        conversionValueProperty: config?.conversionValueProperty ? String(config.conversionValueProperty) : undefined,
        valueSource: config?.valueSource ? String(config.valueSource) : undefined,
        days: Number.isFinite(Number(config?.days)) ? Number(config.days) : undefined,
        revenueClassification: config?.revenueClassification ? String(config.revenueClassification) : undefined,
        pipelineEnabled: config?.pipelineEnabled === true,
        pipelineStageId: config?.pipelineStageId ? String(config.pipelineStageId) : undefined,
        pipelineStageLabel: config?.pipelineStageLabel ? String(config.pipelineStageLabel) : undefined,
      };
      setHubspotInitialMappingConfig(next);
      setStep("hubspot");
      return;
    }

    // Fallback: open selector
    setStep("select");
  }, [open, initialSource]);

  // Load sheets connections only when needed.
  // When editing, also try a purpose-agnostic fetch so connections with a different purpose still appear.
  useEffect(() => {
    let mounted = true;
    if (!open) return;
    if (step !== "sheets_choose" && step !== "sheets_map") return;
    (async () => {
      setSheetsConnectionsLoading(true);
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=${encodeURIComponent(sheetsPurpose)}`, { credentials: "include" });
        const json = await resp.json().catch(() => ({}));
        let conns = Array.isArray(json?.connections) ? json.connections : [];
        // If no connections found with the revenue purpose and we're editing, try without purpose filter
        if (conns.length === 0 && isEditing) {
          const resp2 = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`, { credentials: "include" });
          const json2 = await resp2.json().catch(() => ({}));
          conns = Array.isArray(json2?.connections) ? json2.connections : [];
        }
        if (!mounted) return;
        setSheetsConnections(conns);
        // Auto-select: if no connectionId set, or stored connectionId doesn't match any available connection
        const currentIdValid = sheetsConnectionId && conns.some((c: any) => String(c.id) === sheetsConnectionId);
        if (!currentIdValid && conns.length > 0) setSheetsConnectionId(String(conns[0]?.id || ""));
      } catch {
        if (!mounted) return;
        setSheetsConnections([]);
      } finally {
        if (!mounted) return;
        setSheetsConnectionsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, step, campaignId, sheetsPurpose, isEditing]);

  const refreshSheetsConnections = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=${encodeURIComponent(sheetsPurpose)}`, { credentials: "include" });
      const json = await resp.json().catch(() => ({}));
      let conns = Array.isArray(json?.connections) ? json.connections : Array.isArray(json) ? json : [];
      if (conns.length === 0 && isEditing) {
        const resp2 = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`, { credentials: "include" });
        const json2 = await resp2.json().catch(() => ({}));
        conns = Array.isArray(json2?.connections) ? json2.connections : Array.isArray(json2) ? json2 : [];
      }
      const filtered = conns.filter((c: any) => c && c.isActive !== false);
      setSheetsConnections(filtered);
      return filtered;
    } catch {
      setSheetsConnections([]);
      return null;
    }
  };

  const removeSelectedSheetConnection = async () => {
    if (!sheetsConnectionId) return;
    setSheetsRemoving(true);
    try {
      const resp = await fetch(
        `/api/google-sheets/${encodeURIComponent(campaignId)}/connection?connectionId=${encodeURIComponent(sheetsConnectionId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to remove Google Sheets connection");
      }
      const filtered = await refreshSheetsConnections();
      setSheetsConnectionId("");
      setSheetsPreview(null);
      setSheetsRevenueCol("");
      setSheetsCampaignCol("");
      setSheetsCampaignQuery("");
      setSheetsCampaignValues([]);
      if (!filtered || filtered.length === 0) setShowSheetsConnect(false);
      toast({ title: "Google Sheet removed", description: "You can now connect a different sheet/tab." });
    } catch (e: any) {
      toast({ title: "Remove failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSheetsRemoving(false);
    }
  };

  const csvHeaders = useMemo(() => csvPreview?.headers || [], [csvPreview]);
  const sheetsHeaders = useMemo(() => sheetsPreview?.headers || [], [sheetsPreview]);

  const filteredCsvPreviewRows = useMemo(() => {
    const rows = Array.isArray(csvPreview?.sampleRows) ? csvPreview!.sampleRows : [];
    if (!csvCampaignCol) return rows;
    if (!Array.isArray(csvCampaignValues) || csvCampaignValues.length === 0) return rows;
    const set = new Set(csvCampaignValues.map((v) => String(v ?? "").trim()).filter(Boolean));
    if (set.size === 0) return rows;
    return rows.filter((r: any) => set.has(String(r?.[csvCampaignCol] ?? "").trim()));
  }, [csvPreview, csvCampaignCol, csvCampaignValues]);

  const filteredSheetsPreviewRows = useMemo(() => {
    const rows = Array.isArray(sheetsPreview?.sampleRows) ? sheetsPreview!.sampleRows : [];
    if (!sheetsCampaignCol) return rows;
    if (!Array.isArray(sheetsCampaignValues) || sheetsCampaignValues.length === 0) return rows;
    const set = new Set(sheetsCampaignValues.map((v) => String(v ?? "").trim()).filter(Boolean));
    if (set.size === 0) return rows;
    return rows.filter((r: any) => set.has(String(r?.[sheetsCampaignCol] ?? "").trim()));
  }, [sheetsPreview, sheetsCampaignCol, sheetsCampaignValues]);

  const uniqueValuesFromPreview = (preview: Preview | null, col: string) => {
    if (!preview || !col) return [];
    const vals = new Map<string, number>();
    for (const r of preview.sampleRows || []) {
      const v = String((r as any)?.[col] ?? "").trim();
      if (!v) continue;
      vals.set(v, (vals.get(v) || 0) + 1);
    }
    return Array.from(vals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value);
  };

  const handleBack = () => {
    if (step === "select") return;
    if (step === "csv_map") return setStep("csv");
    if (step === "sheets_map") return setStep("sheets_choose");
    if (step === "hubspot") {
      setHubspotBackNonce((n) => n + 1);
      return;
    }
    if (step === "salesforce") {
      setSalesforceBackNonce((n) => n + 1);
      return;
    }
    // Embedded Shopify wizard: go back inside the Shopify flow first (campaign-field),
    // then exit to source selection if already at the first screen.
    if (step === "shopify") {
      if (shopifyWizardStep && shopifyWizardStep !== "campaign-field") {
        setShopifyExternalStep("campaign-field");
        setShopifyExternalNonce((n) => n + 1);
        return;
      }
      setStep("select");
      return;
    }
    setStep("select");
  };

  const handleManualSave = async () => {
    const clean = String(manualAmount || "").replace(/,/g, "").trim();
    const amt = Number(clean);
    const cvClean = String(manualConversionValue || "").replace(/,/g, "").trim();
    const cv = Number(cvClean);
    const spendClean = String(manualSpendAmount || "").replace(/,/g, "").trim();
    const spendAmt = Number(spendClean);

    const hasRevenue = Number.isFinite(amt) && amt > 0;
    const hasSpend = Number.isFinite(spendAmt) && spendAmt > 0;
    const hasCv = Number.isFinite(cv) && cv > 0;
    const effectivePlatform = manualPlatform || platformContext || 'ga4';
    const subCampaignUrn = manualSubCampaign || undefined;

    if (effectivePlatform === 'linkedin') {
      if (manualValueSource === 'revenue' && !hasRevenue && !hasSpend) {
        toast({ title: "Enter a value", description: "Enter at least a revenue or spend amount.", variant: "destructive" });
        return;
      }
      if (manualValueSource === 'conversion_value' && !hasCv && !hasSpend) {
        toast({ title: "Enter a value", description: "Enter at least a conversion value or spend amount.", variant: "destructive" });
        return;
      }
      if (hasRevenue && hasCv) {
        toast({ title: "Enter only one value", description: "Choose Revenue or Conversion Value (not both).", variant: "destructive" });
        return;
      }
    } else {
      if (!hasRevenue) {
        toast({ title: "Enter a value", description: "Enter a revenue amount.", variant: "destructive" });
        return;
      }
    }

    setSavingManual(true);
    try {
      // Save revenue if provided
      if (hasRevenue || hasCv) {
        const valueSource: 'revenue' | 'conversion_value' = effectivePlatform === 'linkedin' ? manualValueSource : 'revenue';
        const resp = await fetch(`/api/campaigns/${campaignId}/revenue/process/manual`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: effectivePlatform === 'linkedin' ? (valueSource === 'revenue' && hasRevenue ? amt : null) : (hasRevenue ? amt : null),
            conversionValue: effectivePlatform === 'linkedin' ? (valueSource === 'conversion_value' && hasCv ? cv : null) : null,
            valueSource,
            currency,
            dateRange,
            platformContext: effectivePlatform,
            subCampaignUrn,
            ...(isEditing && initialSource?.id ? { sourceId: String(initialSource.id) } : {}),
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save revenue");
      }

      // Save spend if provided
      if (hasSpend) {
        const resp = await fetch(`/api/campaigns/${campaignId}/spend/process/manual`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: spendAmt,
            currency,
            platformContext: effectivePlatform,
            subCampaignUrn,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save spend");
      }

      const saved = [];
      if (hasRevenue || hasCv) saved.push("revenue");
      if (hasSpend) saved.push("spend");
      toast({ title: `${saved.join(" & ")} saved`, description: `Manual ${saved.join(" & ")} assigned to ${effectivePlatform.toUpperCase()}.` });
      invalidateAfterRevenueChange();
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  };

  const handleCsvPreview = async (file: File) => {
    setCsvPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/csv/preview`, { method: "POST", credentials: "include", body: fd });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview CSV");
      setCsvPreview({ fileName: json.fileName, headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      // best-effort default pick
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guessRevenue = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      const guessCv = headers.find((h) => /conversion.?value|value.?per.?conversion|aov|order.?value/i.test(h)) || "";
      if (platformContext !== 'linkedin') {
        setCsvRevenueCol(guessRevenue);
      } else {
        // LinkedIn: mapping depends on chosen source-of-truth
        if (csvValueSource === 'conversion_value') {
          setCsvConversionValueCol(guessCv);
          setCsvRevenueCol("");
        } else {
          setCsvRevenueCol(guessRevenue);
          setCsvConversionValueCol("");
        }
      }
      setCsvCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
      setCsvCampaignValues([]);
      setCsvCampaignQuery("");
      setStep("csv_map");

      // If editing, apply prefilled mapping after preview (CSV requires re-upload).
      if (csvPrefill) {
        const pickIfExists = (v?: string) => (v && headers.includes(v) ? v : "");
        const rc = pickIfExists(csvPrefill.revenueColumn);
        const cvc = pickIfExists(csvPrefill.conversionValueColumn);
        const cc = pickIfExists(csvPrefill.campaignColumn);
        if (rc) setCsvRevenueCol(rc);
        if (cvc) setCsvConversionValueCol(cvc);
        if (cc) setCsvCampaignCol(cc);
        if (Array.isArray(csvPrefill.campaignValues) && csvPrefill.campaignValues.length > 0) {
          setCsvCampaignValues(csvPrefill.campaignValues.map(String));
        }
        setCsvPrefill(null);
      }
    } catch (e: any) {
      toast({ title: "CSV preview failed", description: e?.message || "Please try again.", variant: "destructive" });
      setCsvPreview(null);
    } finally {
      setCsvPreviewing(false);
    }
  };

  const handleCsvProcess = async () => {
    if (!csvFile) return;
    if (!csvCampaignCol) {
      toast({ title: "Select a campaign column", description: "Campaign is required for revenue imports.", variant: "destructive" });
      return;
    }
    if (!Array.isArray(csvCampaignValues) || csvCampaignValues.length === 0) {
      toast({ title: "Select at least 1 campaign value", description: "Choose which campaign rows to import.", variant: "destructive" });
      return;
    }
    if (platformContext !== 'linkedin') {
      if (!csvRevenueCol) {
        toast({ title: "Select a revenue column", variant: "destructive" });
        return;
      }
    } else {
      // LinkedIn: user must choose ONE source of truth and map the corresponding column.
      if (csvValueSource === 'conversion_value') {
        if (!csvConversionValueCol) {
          toast({ title: "Select a conversion value column", description: "Conversion Value is required for this mode.", variant: "destructive" });
          return;
        }
      } else {
        if (!csvRevenueCol) {
          toast({ title: "Select a revenue column", description: "Revenue is required for this mode.", variant: "destructive" });
          return;
        }
      }
    }
    setCsvProcessing(true);
    try {
      const valueSource: 'revenue' | 'conversion_value' = platformContext === 'linkedin' ? csvValueSource : 'revenue';
      const mapping = {
        revenueColumn: (platformContext === 'linkedin' ? (valueSource === 'revenue' ? (csvRevenueCol || null) : null) : (csvRevenueCol || null)),
        conversionValueColumn: platformContext === 'linkedin' ? (valueSource === 'conversion_value' ? (csvConversionValueCol || null) : null) : null,
        valueSource,
        campaignColumn: csvCampaignCol,
        campaignValue: csvCampaignValues.length === 1 ? csvCampaignValues[0] : null,
        campaignValues: csvCampaignValues,
        currency,
        displayName: csvFile.name,
        mode: "revenue_to_date",
        ...(isEditing && initialSource?.id ? { sourceId: String(initialSource.id) } : {}),
      };
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("platformContext", platformContext);
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/csv/process`, { method: "POST", credentials: "include", body: fd });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process CSV");
      if (platformContext === 'linkedin' && json?.mode === 'conversion_value') {
        toast({
          title: "Conversion value imported",
          description: `Conversion Value set to ${Number(json.conversionValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency} per conversion.`,
        });
      } else {
        toast({
          title: "Revenue imported",
          description: `Imported ${Number(json.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}.`,
        });
      }
      invalidateAfterRevenueChange();
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "CSV import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCsvProcessing(false);
    }
  };

  const handleSheetsPreview = async (connectionIdOverride?: string, opts?: { preserveExisting?: boolean }): Promise<boolean> => {
    const cid = String(connectionIdOverride || sheetsConnectionId || "").trim();
    if (!cid) return false;
    setSheetsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: cid, platformContext }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview sheet");
      setSheetsPreview({ headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guess = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      const guessCv = headers.find((h) => /conversion.?value|value.?per.?conversion|aov|order.?value/i.test(h)) || "";
      const preserve = !!opts?.preserveExisting;
      if (!preserve) {
        if (platformContext !== 'linkedin') {
          setSheetsRevenueCol(guess);
        } else {
          // LinkedIn: mapping depends on chosen source-of-truth
          if (sheetsValueSource === 'conversion_value') {
            setSheetsConversionValueCol(guessCv);
            setSheetsRevenueCol("");
          } else {
            setSheetsRevenueCol(guess);
            setSheetsConversionValueCol("");
          }
        }
        setSheetsCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
        setSheetsCampaignValues([]);
        setSheetsCampaignQuery("");
      } else {
        // keep existing selections; only fill gaps
        if (platformContext !== 'linkedin') {
          if (!sheetsRevenueCol) setSheetsRevenueCol(guess);
        } else {
          if (sheetsValueSource === 'conversion_value') {
            if (!sheetsConversionValueCol) setSheetsConversionValueCol(guessCv);
          } else {
            if (!sheetsRevenueCol) setSheetsRevenueCol(guess);
          }
        }
        if (!sheetsCampaignCol) setSheetsCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
      }
      return true;
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message || "Please try again.", variant: "destructive" });
      setSheetsPreview(null);
      return false;
    } finally {
      setSheetsProcessing(false);
    }
  };

  // If opened in edit mode for Sheets, auto-load preview so the user can update mappings immediately.
  // If the connection no longer exists, fall back to the connection chooser step.
  useEffect(() => {
    if (!open) return;
    if (!isEditing) return;
    const type = String(initialSource?.sourceType || "").toLowerCase();
    if (type !== "google_sheets") return;
    if (step === "sheets_map") {
      if (!sheetsConnectionId) { setStep("sheets_choose"); return; }
      if (sheetsPreview) return;
      void (async () => {
        const ok = await handleSheetsPreview(sheetsConnectionId, { preserveExisting: true });
        if (!ok) setStep("sheets_choose");
      })();
      return;
    }
    // After falling back to sheets_choose, auto-advance once connections load and stored ID matches
    if (step === "sheets_choose" && sheetsConnectionId && sheetsConnections.length > 0) {
      const match = sheetsConnections.find((c: any) => String(c.id) === sheetsConnectionId);
      if (match) {
        setStep("sheets_map");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, step, sheetsConnectionId, sheetsPreview, initialSource, sheetsConnections]);

  const handleSheetsProcess = async () => {
    if (!sheetsConnectionId) return;
    if (platformContext !== 'linkedin') {
      if (!sheetsRevenueCol) {
        toast({ title: "Select a revenue column", variant: "destructive" });
        return;
      }
    } else {
      // LinkedIn: user must choose ONE source of truth and map the corresponding column.
      if (sheetsValueSource === 'conversion_value') {
        if (!sheetsConversionValueCol) {
          toast({ title: "Select a conversion value column", description: "Conversion Value is required for this mode.", variant: "destructive" });
          return;
        }
      } else {
        if (!sheetsRevenueCol) {
          toast({ title: "Select a revenue column", description: "Revenue is required for this mode.", variant: "destructive" });
          return;
        }
      }
    }
    setSheetsProcessing(true);
    try {
      const hasCampaignScope = !!sheetsCampaignCol && sheetsCampaignValues.length > 0;
      const valueSource: 'revenue' | 'conversion_value' = platformContext === 'linkedin' ? sheetsValueSource : 'revenue';
      const mapping = {
        revenueColumn: (platformContext === 'linkedin' ? (valueSource === 'revenue' ? (sheetsRevenueCol || null) : null) : (sheetsRevenueCol || null)),
        conversionValueColumn: platformContext === 'linkedin' ? (valueSource === 'conversion_value' ? (sheetsConversionValueCol || null) : null) : null,
        valueSource,
        campaignColumn: hasCampaignScope ? sheetsCampaignCol : null,
        campaignValue: hasCampaignScope && sheetsCampaignValues.length === 1 ? sheetsCampaignValues[0] : null,
        campaignValues: hasCampaignScope ? sheetsCampaignValues : null,
        currency,
        displayName: "Google Sheets revenue",
        mode: "revenue_to_date",
      };
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/process`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnectionId, mapping, platformContext }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process sheet");

      if (platformContext === 'linkedin' && String(json?.mode || '') === 'conversion_value') {
        toast({
          title: "Conversion value imported",
          description: `Conversion Value set to ${Number(json?.conversionValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency} per conversion.`,
        });
      } else {
        toast({
          title: "Revenue imported",
          description: `Imported ${Number(json?.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}.`,
        });
      }
      invalidateAfterRevenueChange();
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSheetsProcessing(false);
    }
  };

  const title = step === "select" ? "Add revenue source" :
    step === "manual" ? (isEditing ? "Edit manual revenue" : "Manual revenue") :
      step === "csv" ? (isEditing ? "Edit CSV revenue" : "Upload CSV") :
        step === "csv_map" ? (isEditing ? "Edit CSV revenue" : "Upload CSV") :
          step === "sheets_choose" ? (isEditing ? "Edit Google Sheets revenue" : "Google Sheets") :
            step === "sheets_map" ? (isEditing ? "Edit Google Sheets revenue" : "Google Sheets") :
              step === "hubspot" ? "HubSpot revenue" :
                step === "salesforce" ? "Salesforce revenue" :
                  step === "shopify" ? "Shopify revenue" :
                    "Add revenue source";

  const description = step === "select"
    ? "Choose where your revenue data comes from."
    : `Currency: ${currency} • Revenue is treated as “to date” (campaign lifetime)`;

  const isEmbeddedWizardStep = step === "hubspot" || step === "salesforce" || step === "shopify";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[980px] max-w-[95vw] h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="truncate">{title}</DialogTitle>
                <DialogDescription className="mt-1">{description}</DialogDescription>
              </div>
              {step !== "select" && !initialStep && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
          </DialogHeader>

          <div
            className={`px-6 py-5 flex-1 min-h-0 flex flex-col ${
              // Embedded wizards manage their own internal scroll, but we still allow
              // parent scrolling as a safety net to avoid clipped footers on smaller viewports.
              isEmbeddedWizardStep ? "overflow-y-auto" : "overflow-y-auto"
              }`}
          >
            {step === "select" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!hideCrmSources && (
                  <Card className={`cursor-pointer hover:border-blue-500 transition-colors ${crmConnecting === "shopify" || crmDisconnecting === "shopify" ? "opacity-60 pointer-events-none" : ""}`} onClick={() => handleCrmSourceClick("shopify")}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Shopify (Ecommerce)
                        {crmConnecting === "shopify" ? (
                          <span className="ml-auto text-xs font-normal text-blue-600 dark:text-blue-400">Connecting…</span>
                        ) : crmStatus.shopify ? (
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-xs font-normal text-green-600 dark:text-green-400">Connected</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Disconnect Shopify" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect Shopify</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove the revenue source and OAuth connection. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleCrmDisconnect("shopify")}>Disconnect</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        ) : (
                          <span className="ml-auto text-xs font-normal text-muted-foreground/70">Not connected</span>
                        )}
                      </CardTitle>
                      <CardDescription>{crmStatus.shopify ? "Attribute order revenue to this campaign." : "Connect Shopify to import order revenue."}</CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {!hideCrmSources && (
                  <Card className={`cursor-pointer hover:border-blue-500 transition-colors ${crmConnecting === "hubspot" || crmDisconnecting === "hubspot" ? "opacity-60 pointer-events-none" : ""}`} onClick={() => handleCrmSourceClick("hubspot")}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        HubSpot (CRM)
                        {crmConnecting === "hubspot" ? (
                          <span className="ml-auto text-xs font-normal text-blue-600 dark:text-blue-400">Connecting…</span>
                        ) : crmStatus.hubspot ? (
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-xs font-normal text-green-600 dark:text-green-400">Connected</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Disconnect HubSpot" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect HubSpot</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove the revenue source and OAuth connection. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleCrmDisconnect("hubspot")}>Disconnect</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        ) : (
                          <span className="ml-auto text-xs font-normal text-muted-foreground/70">Not connected</span>
                        )}
                      </CardTitle>
                      <CardDescription>{crmStatus.hubspot ? "Attribute deal revenue to this campaign." : "Connect HubSpot to import deal revenue."}</CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {!hideCrmSources && (
                  <Card className={`cursor-pointer hover:border-blue-500 transition-colors ${crmConnecting === "salesforce" || crmDisconnecting === "salesforce" ? "opacity-60 pointer-events-none" : ""}`} onClick={() => handleCrmSourceClick("salesforce")}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Salesforce (CRM)
                        {crmConnecting === "salesforce" ? (
                          <span className="ml-auto text-xs font-normal text-blue-600 dark:text-blue-400">Connecting…</span>
                        ) : crmStatus.salesforce ? (
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-xs font-normal text-green-600 dark:text-green-400">Connected</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Disconnect Salesforce" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect Salesforce</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove the revenue source and OAuth connection. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleCrmDisconnect("salesforce")}>Disconnect</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        ) : (
                          <span className="ml-auto text-xs font-normal text-muted-foreground/70">Not connected</span>
                        )}
                      </CardTitle>
                      <CardDescription>{crmStatus.salesforce ? "Attribute opportunity revenue to this campaign." : "Connect Salesforce to import opportunity revenue."}</CardDescription>
                    </CardHeader>
                  </Card>
                )}

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("sheets_choose")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Google Sheets
                    </CardTitle>
                    <CardDescription>Import revenue from a connected Google Sheet tab.</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("csv")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload CSV
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-500 font-medium">⚠️</span>
                        <span>Import revenue from a CSV. Requires manual re-upload to update.</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("manual")}>
                  <CardHeader>
                    <CardTitle className="text-lg">Manual</CardTitle>
                    <CardDescription>
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-500 font-medium">⚠️</span>
                        <span>Enter revenue manually. Requires manual updates (best for testing only).</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}

            {step === "manual" && (
              <div className="space-y-4">
                {/* Platform & Campaign Assignment */}
                {connectedPlatforms.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Assign to platform</CardTitle>
                      <CardDescription>Choose which platform and campaign to attribute this revenue/spend to.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Platform</Label>
                          <Select value={manualPlatform} onValueChange={(v) => { setManualPlatform(v); setManualSubCampaign(""); }}>
                            <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                            <SelectContent>
                              {connectedPlatforms.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {manualPlatform !== 'ga4' && (
                          <div className="space-y-1">
                            <Label>Campaign {platformCampaignsLoading ? '(loading...)' : '(optional)'}</Label>
                            <Select value={manualSubCampaign || "__all__"} onValueChange={(v) => setManualSubCampaign(v === "__all__" ? "" : v)} disabled={platformCampaignsLoading || platformCampaigns.length === 0}>
                              <SelectTrigger><SelectValue placeholder={platformCampaigns.length === 0 && !platformCampaignsLoading ? "No campaigns found" : "All campaigns"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">All campaigns</SelectItem>
                                {platformCampaigns.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Revenue Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Revenue</CardTitle>
                    <CardDescription>Revenue to date (lifetime).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {manualPlatform === 'linkedin' ? (
                        <>
                          <div className="space-y-2 md:col-span-2">
                            <div className="text-sm font-medium">What do you have?</div>
                            <RadioGroup
                              value={manualValueSource}
                              onValueChange={(v) => {
                                const next = v as 'revenue' | 'conversion_value';
                                setManualValueSource(next);
                                if (next === 'revenue') setManualConversionValue("");
                                if (next === 'conversion_value') setManualAmount("");
                              }}
                              className="flex flex-col md:flex-row gap-3"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="revenue" id="manual-mode-revenue" />
                                <Label htmlFor="manual-mode-revenue">Total revenue to date</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="conversion_value" id="manual-mode-cv" />
                                <Label htmlFor="manual-mode-cv">Conversion value (per conversion)</Label>
                              </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground/70">
                              Enter <strong>one</strong> value only. This prevents ambiguous financial reporting.
                            </p>
                          </div>
                          {manualValueSource === 'revenue' ? (
                            <div className="space-y-1 md:col-span-2">
                              <Label>Revenue to date ({currency})</Label>
                              <Input
                                value={manualAmount}
                                onChange={(e) => setManualAmount(formatCurrencyWhileTyping(e.target.value))}
                                onBlur={(e) => setManualAmount(formatCurrencyOnBlur(e.target.value))}
                                placeholder="0.00"
                                inputMode="decimal"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1 md:col-span-2">
                              <Label>Conversion value ({currency})</Label>
                              <Input
                                value={manualConversionValue}
                                onChange={(e) => setManualConversionValue(formatCurrencyWhileTyping(e.target.value))}
                                onBlur={(e) => setManualConversionValue(formatCurrencyOnBlur(e.target.value))}
                                placeholder="0.00"
                                inputMode="decimal"
                              />
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                Revenue metrics will be calculated as Conversions x Conversion Value.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-1 md:col-span-2">
                          <Label>Revenue to date ({currency})</Label>
                          <Input
                            value={manualAmount}
                            onChange={(e) => setManualAmount(formatCurrencyWhileTyping(e.target.value))}
                            onBlur={(e) => setManualAmount(formatCurrencyOnBlur(e.target.value))}
                            placeholder="0.00"
                            inputMode="decimal"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button onClick={handleManualSave} disabled={savingManual}>
                    {savingManual ? "Saving..." : isEditing ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {step === "csv" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    {isEditing && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-100">
                        {initialSource?.displayName && (
                          <p className="font-medium mb-1">Previously uploaded: {initialSource.displayName}</p>
                        )}
                        <p className="text-xs">Select the file below to update. Your previous column mapping will be reused automatically.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {platformContext === 'linkedin' && (
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="text-sm font-medium">What do you want to import?</div>
                          <div className="text-xs text-muted-foreground/70">
                            Choose one source of truth. This keeps ROI/ROAS calculations unambiguous.
                          </div>
                          <div className="flex items-center gap-4 pt-1">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="li-csv-value-source"
                                checked={csvValueSource === 'revenue'}
                                onChange={() => {
                                  setCsvValueSource('revenue');
                                  setCsvConversionValueCol("");
                                }}
                              />
                              Total Revenue (to date)
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="li-csv-value-source"
                                checked={csvValueSource === 'conversion_value'}
                                onChange={() => {
                                  setCsvValueSource('conversion_value');
                                  setCsvRevenueCol("");
                                }}
                              />
                              Conversion Value (per conversion)
                            </label>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>Upload file (CSV)</Label>
                      </div>
                      <Input
                        type="file"
                        accept=".csv,text/csv"
                        className="cursor-pointer file:cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setCsvFile(f);
                          setCsvPreview(null);
                          setCsvRevenueCol("");
                          setCsvConversionValueCol("");
                          setCsvDateCol("");
                          setCsvCampaignCol("");
                          setCsvCampaignValues([]);
                          setCsvCampaignQuery("");
                          setCsvValueSource('revenue');
                        }}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!csvFile) {
                            toast({ title: "Choose a CSV file", variant: "destructive" });
                            return;
                          }
                          await handleCsvPreview(csvFile);
                        }}
                        disabled={!csvFile || csvPreviewing}
                      >
                        {csvPreviewing ? "Previewing…" : "Next"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "csv_map" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    {!csvPreview ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground/80/60">
                        No preview loaded yet. Go back and click Next.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label>Campaign column</Label>
                            <Select
                              value={csvCampaignCol || ""}
                              onValueChange={(v) => {
                                setCsvCampaignCol(v);
                                setCsvCampaignValues([]);
                                setCsvCampaignQuery("");
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select campaign column" />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                {csvHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label>
                              {platformContext === 'linkedin'
                                ? (csvValueSource === 'conversion_value' ? 'Revenue column (disabled)' : 'Revenue column')
                                : 'Revenue column'}
                            </Label>
                            <Select
                              value={(csvRevenueCol || (platformContext === 'linkedin' ? SELECT_NONE : '')) as any}
                              onValueChange={(v) => setCsvRevenueCol(v === SELECT_NONE ? "" : v)}
                              disabled={platformContext === 'linkedin' && csvValueSource === 'conversion_value'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={platformContext === 'linkedin' && csvValueSource === 'conversion_value' ? 'Disabled' : (platformContext === 'linkedin' ? 'Select revenue column' : 'Select revenue column')} />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                {platformContext === 'linkedin' && <SelectItem value={SELECT_NONE}>None</SelectItem>}
                                {csvHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Date column removed: revenue imports are treated as revenue-to-date (lifetime). */}

                          {platformContext === 'linkedin' && (
                            <div className="space-y-1">
                              <Label>{csvValueSource === 'revenue' ? 'Conversion value column (disabled)' : 'Conversion value column'}</Label>
                              <Select
                                value={(csvConversionValueCol || SELECT_NONE) as any}
                                onValueChange={(v) => setCsvConversionValueCol(v === SELECT_NONE ? "" : v)}
                                disabled={csvValueSource === 'revenue'}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={csvValueSource === 'revenue' ? 'Disabled' : 'Select conversion value column'} />
                                </SelectTrigger>
                                <SelectContent className="z-[10000]">
                                  <SelectItem value={SELECT_NONE}>None</SelectItem>
                                  {csvHeaders.map((h) => (
                                    <SelectItem key={h} value={h}>
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {platformContext === 'linkedin' && (
                          <div className="text-xs text-muted-foreground/70">
                            Mode: <span className="font-medium">{csvValueSource === 'conversion_value' ? 'Conversion Value' : 'Total Revenue'}</span>
                          </div>
                        )}

                        {csvCampaignCol ? (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Campaign value(s)</div>
                              <div className="text-xs text-muted-foreground/70">
                                Selected: <span className="font-medium">{csvCampaignValues.length}</span>
                              </div>
                            </div>
                            <Input value={csvCampaignQuery} onChange={(e) => setCsvCampaignQuery(e.target.value)} placeholder="Search values…" />
                            <div className="max-h-[220px] overflow-y-auto space-y-2">
                              {uniqueValuesFromPreview(csvPreview, csvCampaignCol)
                                .filter((v) => v.toLowerCase().includes(csvCampaignQuery.toLowerCase()))
                                .slice(0, 300)
                                .map((v) => {
                                  const checked = csvCampaignValues.includes(v);
                                  return (
                                    <label key={v} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(next) => {
                                          const isOn = !!next;
                                          setCsvCampaignValues((prev) => {
                                            if (isOn) return prev.includes(v) ? prev : [...prev, v];
                                            return prev.filter((x) => x !== v);
                                          });
                                        }}
                                      />
                                      <span className="truncate">{v}</span>
                                    </label>
                                  );
                                })}
                              {uniqueValuesFromPreview(csvPreview, csvCampaignCol).length === 0 && (
                                <div className="text-sm text-muted-foreground/70">No campaign values found in sample rows.</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground/70">Select a campaign column to choose campaign values.</div>
                        )}

                        {/* Preview table */}
                        <div className="rounded-md border overflow-hidden">
                          <div className="px-3 py-2 text-xs font-medium text-foreground/80/60 bg-muted/40 border-b">
                            Preview (first {Math.min(8, filteredCsvPreviewRows.length)} row{Math.min(8, filteredCsvPreviewRows.length) === 1 ? "" : "s"})
                          </div>
                          <div className="overflow-auto">
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-card">
                                <tr>
                                  {(csvPreview.headers || []).slice(0, 8).map((h) => (
                                    <th key={h} className="text-left p-2 border-b text-xs font-medium text-muted-foreground/70 truncate">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(filteredCsvPreviewRows || []).slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(csvPreview.headers || []).slice(0, 8).map((h) => (
                                      <td key={h} className="p-2 text-xs text-foreground/80 dark:text-slate-200 truncate">
                                        {String((row as any)?.[h] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(filteredCsvPreviewRows || []).length === 0 && (
                                  <tr>
                                    <td className="p-3 text-sm text-muted-foreground/70" colSpan={8}>
                                      No rows match the current filter.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleCsvProcess} disabled={!csvPreview || csvProcessing}>
                        {csvProcessing ? "Processing…" : isEditing ? "Update revenue" : "Import revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "sheets_choose" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Google Sheets</CardTitle>
                    <CardDescription>Choose the Google Sheet tab that contains your revenue data.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {platformContext === 'linkedin' && (
                      <div className="rounded-md border p-3 space-y-2">
                        <div className="text-sm font-medium">What do you want to import?</div>
                        <div className="text-xs text-muted-foreground/70">
                          Choose one source of truth before connecting a sheet. This keeps ROI/ROAS calculations unambiguous.
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="li-sheets-value-source"
                              checked={sheetsValueSource === 'revenue'}
                              onChange={() => {
                                setSheetsValueSource('revenue');
                                setSheetsConversionValueCol("");
                              }}
                            />
                            Total Revenue (to date)
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="li-sheets-value-source"
                              checked={sheetsValueSource === 'conversion_value'}
                              onChange={() => {
                                setSheetsValueSource('conversion_value');
                                setSheetsRevenueCol("");
                              }}
                            />
                            Conversion Value (per conversion)
                          </label>
                        </div>
                      </div>
                    )}
                    {sheetsConnectionsLoading ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="text-sm text-foreground/80/60">Loading your connected Google Sheets…</div>
                      </div>
                    ) : sheetsConnections.length === 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Connect Google Sheets</div>
                        <p className="text-xs text-muted-foreground/70">
                          Connect a Google Sheet and select the tab that contains your revenue data.
                        </p>
                        <SimpleGoogleSheetsAuth
                          campaignId={campaignId}
                          selectionMode="append"
                          purpose={sheetsPurpose}
                          onSuccess={async (info) => {
                            setShowSheetsConnect(false);
                            const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                            if (preferredId) {
                              setSheetsConnectionId(preferredId);
                              await refreshSheetsConnections();
                              // No "Next" in this flow: go straight to mapping.
                              await handleSheetsPreview(preferredId);
                              setStep("sheets_map");
                              toast({ title: "Google Sheets connected", description: "Loading preview…" });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Select a tab to continue." });
                            }
                          }}
                          onError={(err) => toast({ title: "Google Sheets connect failed", description: err, variant: "destructive" })}
                        />
                      </div>
                    ) : showSheetsConnect ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Change sheet/tab</div>
                        <p className="text-xs text-muted-foreground/70">
                          Connect a different spreadsheet or tab (you can select multiple tabs).
                        </p>
                        <SimpleGoogleSheetsAuth
                          campaignId={campaignId}
                          selectionMode="append"
                          purpose={sheetsPurpose}
                          onSuccess={async (info) => {
                            setShowSheetsConnect(false);
                            const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                            if (preferredId) {
                              setSheetsConnectionId(preferredId);
                              await refreshSheetsConnections();
                              // No "Next" in this flow: go straight to mapping.
                              await handleSheetsPreview(preferredId);
                              setStep("sheets_map");
                              toast({ title: "Google Sheets connected", description: "Loading preview…" });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Select a tab to continue." });
                            }
                          }}
                          onError={(err) => toast({ title: "Google Sheets connect failed", description: err, variant: "destructive" })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>Choose Google Sheet tab</Label>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setShowSheetsConnect(true)}>
                              Change sheet/tab
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeSelectedSheetConnection}
                              disabled={!sheetsConnectionId || sheetsRemoving}
                            >
                              {sheetsRemoving ? "Removing…" : "Remove"}
                            </Button>
                          </div>
                        </div>
                        <Select
                          value={sheetsConnectionId}
                          onValueChange={(v) => {
                            setSheetsConnectionId(v);
                            setSheetsPreview(null);
                            setSheetsRevenueCol("");
                            setSheetsConversionValueCol("");
                            setSheetsCampaignCol("");
                            setSheetsCampaignQuery("");
                            setSheetsCampaignValues([]);
                            // Auto-advance: selecting a tab should preview and move to mapping (no redundant Next button).
                            void (async () => {
                              await handleSheetsPreview(v);
                              setStep("sheets_map");
                            })();
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a sheet tab" />
                          </SelectTrigger>
                          <SelectContent className="z-[10000]">
                            {sheetsConnections.map((c: any) => (
                              <SelectItem key={String(c.id)} value={String(c.id)}>
                                {String(c.spreadsheetName || c.spreadsheetId || "Google Sheet")}
                                {c.sheetName ? ` — ${c.sheetName}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "sheets_map" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="space-y-4">
                    {!sheetsPreview ? (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground/70">
                        No preview loaded yet. Go back and select a Google Sheet tab.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label>Campaign column (optional)</Label>
                            <Select
                              value={sheetsCampaignCol || SELECT_NONE}
                              onValueChange={(v) => {
                                setSheetsCampaignCol(v === SELECT_NONE ? "" : v);
                                setSheetsCampaignValues([]);
                                setSheetsCampaignQuery("");
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                <SelectItem value={SELECT_NONE}>None</SelectItem>
                                {sheetsHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              If your sheet contains multiple campaigns, filter it to the campaign value(s) you want.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label>
                              {platformContext === 'linkedin'
                                ? (sheetsValueSource === 'conversion_value' ? 'Revenue column (disabled)' : 'Revenue column')
                                : 'Revenue column'}
                            </Label>
                            <Select
                              value={(sheetsRevenueCol || (platformContext === 'linkedin' ? SELECT_NONE : '')) as any}
                              onValueChange={(v) => setSheetsRevenueCol(v === SELECT_NONE ? "" : v)}
                              disabled={platformContext === 'linkedin' && sheetsValueSource === 'conversion_value'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={platformContext === 'linkedin' && sheetsValueSource === 'conversion_value' ? 'Disabled' : (platformContext === 'linkedin' ? 'Select revenue column' : 'Select revenue column')} />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                {platformContext === 'linkedin' && <SelectItem value={SELECT_NONE}>None</SelectItem>}
                                {sheetsHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Date column removed: revenue imports are treated as revenue-to-date (lifetime). */}

                          {platformContext === 'linkedin' && (
                            <div className="space-y-1">
                              <Label>{sheetsValueSource === 'revenue' ? 'Conversion value column (disabled)' : 'Conversion value column'}</Label>
                              <Select
                                value={(sheetsConversionValueCol || SELECT_NONE) as any}
                                onValueChange={(v) => setSheetsConversionValueCol(v === SELECT_NONE ? "" : v)}
                                disabled={sheetsValueSource === 'revenue'}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={sheetsValueSource === 'revenue' ? 'Disabled' : 'Select conversion value column'} />
                                </SelectTrigger>
                                <SelectContent className="z-[10000]">
                                  <SelectItem value={SELECT_NONE}>None</SelectItem>
                                  {sheetsHeaders.map((h) => (
                                    <SelectItem key={h} value={h}>
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                Optional: import value per conversion directly (used for ROI/ROAS when revenue is not available).
                              </p>
                            </div>
                          )}
                        </div>

                        {platformContext === 'linkedin' && (
                          <div className="text-xs text-muted-foreground/70">
                            Mode: <span className="font-medium">{sheetsValueSource === 'conversion_value' ? 'Conversion Value' : 'Total Revenue'}</span>
                          </div>
                        )}

                        {sheetsCampaignCol && (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Campaign value(s)</div>
                              <div className="text-xs text-muted-foreground/70">
                                Selected: <span className="font-medium">{sheetsCampaignValues.length}</span>
                              </div>
                            </div>
                            <Input value={sheetsCampaignQuery} onChange={(e) => setSheetsCampaignQuery(e.target.value)} placeholder="Search values…" />
                            <div className="max-h-[220px] overflow-y-auto space-y-2">
                              {uniqueValuesFromPreview(sheetsPreview, sheetsCampaignCol)
                                .filter((v) => v.toLowerCase().includes(sheetsCampaignQuery.toLowerCase()))
                                .slice(0, 300)
                                .map((v) => {
                                  const checked = sheetsCampaignValues.includes(v);
                                  return (
                                    <label key={v} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(next) => {
                                          const isOn = !!next;
                                          setSheetsCampaignValues((prev) => {
                                            if (isOn) return prev.includes(v) ? prev : [...prev, v];
                                            return prev.filter((x) => x !== v);
                                          });
                                        }}
                                      />
                                      <span className="truncate">{v}</span>
                                    </label>
                                  );
                                })}
                              {uniqueValuesFromPreview(sheetsPreview, sheetsCampaignCol).length === 0 && (
                                <div className="text-sm text-muted-foreground/70">No campaign values found in sample rows.</div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground/70">
                            Rows detected: <span className="font-medium">{sheetsPreview.rowCount.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Preview table */}
                        <div className="rounded-md border overflow-hidden">
                          <div className="px-3 py-2 text-xs font-medium text-foreground/80/60 bg-muted/40 border-b">
                            Preview (first {Math.min(8, filteredSheetsPreviewRows.length)} row{Math.min(8, filteredSheetsPreviewRows.length) === 1 ? "" : "s"})
                          </div>
                          <div className="overflow-auto">
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-card">
                                <tr>
                                  {(sheetsPreview.headers || []).slice(0, 8).map((h) => (
                                    <th key={h} className="text-left p-2 border-b text-xs font-medium text-muted-foreground/70 truncate">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(filteredSheetsPreviewRows || []).slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(sheetsPreview.headers || []).slice(0, 8).map((h) => (
                                      <td key={h} className="p-2 text-xs text-foreground/80 dark:text-slate-200 truncate">
                                        {String((row as any)?.[h] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(filteredSheetsPreviewRows || []).length === 0 && (
                                  <tr>
                                    <td className="p-3 text-sm text-muted-foreground/70" colSpan={8}>
                                      No rows match the current filter.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSheetsProcess}
                        disabled={
                          !sheetsPreview ||
                          sheetsProcessing ||
                          (platformContext !== 'linkedin' && !sheetsRevenueCol) ||
                          (platformContext === 'linkedin' && ((sheetsValueSource === 'revenue' && !sheetsRevenueCol) || (sheetsValueSource === 'conversion_value' && !sheetsConversionValueCol)))
                        }
                      >
                        {sheetsProcessing ? "Processing…" : isEditing ? "Update revenue" : "Import revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "hubspot" && (
              <div className="w-full flex-1 min-h-0 flex flex-col">
                <HubSpotRevenueWizard
                  campaignId={campaignId}
                  platformContext={platformContext}
                  mode={isEditing && String(initialSource?.sourceType || "").toLowerCase() === "hubspot" ? "edit" : "connect"}
                  externalBackNonce={hubspotBackNonce}
                  initialMappingConfig={
                    isEditing && String(initialSource?.sourceType || "").toLowerCase() === "hubspot"
                      ? (hubspotInitialMappingConfig || null)
                      : null
                  }
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
                    invalidateAfterRevenueChange();
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}

            {step === "salesforce" && (
              <div className="w-full flex-1 min-h-0 flex flex-col">
                <SalesforceRevenueWizard
                  campaignId={campaignId}
                  platformContext={platformContext}
                  autoStartOAuth={!isEditing}
                  mode={isEditing && String(initialSource?.sourceType || "").toLowerCase() === "salesforce" ? "edit" : "connect"}
                  externalBackNonce={salesforceBackNonce}
                  initialMappingConfig={
                    isEditing && String(initialSource?.sourceType || "").toLowerCase() === "salesforce"
                      ? (salesforceInitialMappingConfig || null)
                      : null
                  }
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
                    invalidateAfterRevenueChange();
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}

            {step === "shopify" && (
              <div className="w-full flex-1 min-h-0 flex flex-col">
                <ShopifyRevenueWizard
                  campaignId={campaignId}
                  platformContext={platformContext}
                  onStepChange={(s) => setShopifyWizardStep(s as any)}
                  externalStep={shopifyExternalStep as any}
                  externalNavNonce={shopifyExternalNonce}
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
                    invalidateAfterRevenueChange();
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



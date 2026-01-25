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
import { Building2, FileSpreadsheet, ShoppingCart, Upload, ArrowLeft } from "lucide-react";
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
  platformContext?: 'ga4' | 'linkedin';
  initialStep?: Step;
}) {
  const { open, onOpenChange, campaignId, currency, dateRange, onSuccess, initialSource, platformContext = 'ga4', initialStep } = props;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateAfterRevenueChange = () => {
    // Always refresh campaign-level rollups and connection badges.
    void queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId], exact: false });
    void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"], exact: false });
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });

    // Revenue-derived endpoints used across GA4 + LinkedIn screens.
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-sources`], exact: false });
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-to-date`], exact: false });
    void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });

    if (platformContext === 'linkedin') {
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
    }

    // GA4 KPI tab caches (revenue-to-date affects financial KPIs when GA4 revenue is missing).
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/kpis"], exact: false });
    void queryClient.invalidateQueries({ queryKey: ["/api/platforms/google_analytics/kpis", campaignId], exact: false });

    // Best-effort immediate refresh when mounted (keeps Overview feeling instant).
    void queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
    void queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"], exact: false });

    if (platformContext === 'linkedin') {
      void queryClient.refetchQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });
    } else {
      void queryClient.refetchQueries({ queryKey: ["/api/platforms/google_analytics/kpis", campaignId], exact: false });
    }
  };

  const [step, setStep] = useState<Step>("select");
  const isEditing = !!initialSource;
  const sheetsPurpose = platformContext === 'linkedin' ? 'linkedin_revenue' : 'revenue';
  const [salesforceInitialMappingConfig, setSalesforceInitialMappingConfig] = useState<null | {
    campaignField?: string;
    selectedValues?: string[];
    revenueField?: string;
    days?: number;
  }>(null);

  // Manual
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualConversionValue, setManualConversionValue] = useState<string>("");
  const [manualValueSource, setManualValueSource] = useState<'revenue' | 'conversion_value'>('revenue');
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

  const resetAll = () => {
    setStep(initialStep || "select");
    setManualAmount("");
    setManualConversionValue("");
    setManualValueSource('revenue');
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
    setSalesforceInitialMappingConfig(null);
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
      setManualAmount(amt === 0 || amt ? String(amt) : "");
      setManualConversionValue(cv === 0 || cv ? String(cv) : "");
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
        days: Number.isFinite(Number(config?.days)) ? Number(config.days) : undefined,
      };
      setSalesforceInitialMappingConfig(next);
      setStep("salesforce");
      return;
    }

    // Fallback: open selector
    setStep("select");
  }, [open, initialSource]);

  // Load sheets connections only when needed
  useEffect(() => {
    let mounted = true;
    if (!open) return;
    if (step !== "sheets_choose" && step !== "sheets_map") return;
    (async () => {
      setSheetsConnectionsLoading(true);
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=${encodeURIComponent(sheetsPurpose)}`);
        const json = await resp.json().catch(() => ({}));
        const conns = Array.isArray(json?.connections) ? json.connections : [];
        if (!mounted) return;
        setSheetsConnections(conns);
        if (!sheetsConnectionId && conns.length > 0) setSheetsConnectionId(String(conns[0]?.id || ""));
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
  }, [open, step, campaignId, sheetsPurpose]);

  const refreshSheetsConnections = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=${encodeURIComponent(sheetsPurpose)}`);
      const json = await resp.json().catch(() => ({}));
      const conns = Array.isArray(json?.connections) ? json.connections : Array.isArray(json) ? json : [];
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
        { method: "DELETE" }
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

    if (platformContext !== 'linkedin') {
      if (!Number.isFinite(amt) || !(amt > 0)) {
        toast({ title: "Enter a valid amount", description: "Revenue must be > 0.", variant: "destructive" });
        return;
      }
    } else {
      // Enterprise-grade correctness: manual LinkedIn entry must be unambiguous.
      // Users must provide EITHER revenue-to-date OR conversion value, never both.
      const hasAmt = Number.isFinite(amt) && amt > 0;
      const hasCv = Number.isFinite(cv) && cv > 0;
      if (manualValueSource === 'revenue' && !hasAmt) {
        toast({ title: "Enter revenue", description: "Revenue must be > 0.", variant: "destructive" });
        return;
      }
      if (manualValueSource === 'conversion_value' && !hasCv) {
        toast({ title: "Enter conversion value", description: "Conversion value must be > 0.", variant: "destructive" });
        return;
      }
      if (hasAmt && hasCv) {
        toast({ title: "Enter only one value", description: "Choose Revenue or Conversion Value (not both).", variant: "destructive" });
        return;
      }
    }
    setSavingManual(true);
    try {
      const hasAmt = Number.isFinite(amt) && amt > 0;
      const hasCv = Number.isFinite(cv) && cv > 0;
      const valueSource: 'revenue' | 'conversion_value' = platformContext === 'linkedin' ? manualValueSource : 'revenue';
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/process/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: platformContext === 'linkedin' ? (valueSource === 'revenue' && hasAmt ? amt : null) : (Number.isFinite(amt) ? amt : null),
          conversionValue: platformContext === 'linkedin' ? (valueSource === 'conversion_value' && hasCv ? cv : null) : null,
          valueSource,
          currency,
          dateRange,
          platformContext
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save revenue");
      if (platformContext === 'linkedin' && json?.mode === 'conversion_value') {
        toast({ title: isEditing ? "Conversion value updated" : "Conversion value saved", description: "Conversion value will be used to calculate revenue metrics for LinkedIn." });
      } else {
        toast({ title: isEditing ? "Revenue updated" : "Revenue saved", description: platformContext === 'linkedin' ? "Revenue will be used to calculate LinkedIn financial metrics." : "Revenue will now be used when GA4 revenue is missing." });
      }
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
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/csv/preview`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview CSV");
      setCsvPreview({ fileName: json.fileName, headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      // best-effort default pick
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guess = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      setCsvRevenueCol(guess);
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
      if (!csvRevenueCol && !csvConversionValueCol) {
        toast({ title: "Select Revenue or Conversion Value", description: "For LinkedIn, choose at least one value column.", variant: "destructive" });
        return;
      }
    }
    setCsvProcessing(true);
    try {
      const valueSource: 'revenue' | 'conversion_value' =
        platformContext === 'linkedin'
          ? (csvRevenueCol && csvConversionValueCol ? csvValueSource : (csvConversionValueCol ? 'conversion_value' : 'revenue'))
          : 'revenue';
      const mapping = {
        revenueColumn: csvRevenueCol || null,
        conversionValueColumn: platformContext === 'linkedin' ? (csvConversionValueCol || null) : null,
        valueSource,
        campaignColumn: csvCampaignCol,
        campaignValue: csvCampaignValues.length === 1 ? csvCampaignValues[0] : null,
        campaignValues: csvCampaignValues,
        currency,
        displayName: csvFile.name,
        mode: "revenue_to_date",
      };
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("platformContext", platformContext);
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/csv/process`, { method: "POST", body: fd });
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

  const handleSheetsPreview = async (connectionIdOverride?: string, opts?: { preserveExisting?: boolean }) => {
    const cid = String(connectionIdOverride || sheetsConnectionId || "").trim();
    if (!cid) return;
    setSheetsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: cid, platformContext }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview sheet");
      setSheetsPreview({ headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guess = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      const preserve = !!opts?.preserveExisting;
      if (!preserve) {
        setSheetsRevenueCol(guess);
        setSheetsCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
        setSheetsCampaignValues([]);
        setSheetsCampaignQuery("");
      } else {
        // keep existing selections; only fill gaps
        if (!sheetsRevenueCol) setSheetsRevenueCol(guess);
        if (!sheetsCampaignCol) setSheetsCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
      }
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message || "Please try again.", variant: "destructive" });
      setSheetsPreview(null);
    } finally {
      setSheetsProcessing(false);
    }
  };

  // If opened in edit mode for Sheets, auto-load preview so the user can update mappings immediately.
  useEffect(() => {
    if (!open) return;
    if (!isEditing) return;
    const type = String(initialSource?.sourceType || "").toLowerCase();
    if (type !== "google_sheets") return;
    if (step !== "sheets_map") return;
    if (!sheetsConnectionId) return;
    if (sheetsPreview) return;
    void handleSheetsPreview(sheetsConnectionId, { preserveExisting: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, step, sheetsConnectionId, sheetsPreview, initialSource]);

  const handleSheetsProcess = async () => {
    if (!sheetsConnectionId) return;
    if (platformContext !== 'linkedin') {
      if (!sheetsRevenueCol) {
        toast({ title: "Select a revenue column", variant: "destructive" });
        return;
      }
    } else {
      if (!sheetsRevenueCol && !sheetsConversionValueCol) {
        toast({ title: "Select Revenue or Conversion Value", description: "For LinkedIn, choose at least one value column.", variant: "destructive" });
        return;
      }
    }
    setSheetsProcessing(true);
    try {
      const hasCampaignScope = !!sheetsCampaignCol && sheetsCampaignValues.length > 0;
      const valueSource: 'revenue' | 'conversion_value' =
        platformContext === 'linkedin'
          ? (sheetsRevenueCol && sheetsConversionValueCol ? sheetsValueSource : (sheetsConversionValueCol ? 'conversion_value' : 'revenue'))
          : 'revenue';
      const mapping = {
        revenueColumn: sheetsRevenueCol || null,
        conversionValueColumn: platformContext === 'linkedin' ? (sheetsConversionValueCol || null) : null,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnectionId, mapping, platformContext }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process sheet");
      toast({ title: "Revenue imported", description: `Imported ${Number(json.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}.` });
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
    ? "Choose where your revenue data comes from. This is used when GA4 revenue is missing."
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
              {step !== "select" && (
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
                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("manual")}>
                  <CardHeader>
                    <CardTitle className="text-lg">Manual</CardTitle>
                    <CardDescription>Enter revenue to date (campaign lifetime).</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("csv")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload CSV
                    </CardTitle>
                    <CardDescription>Import revenue from a CSV (date column optional).</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("sheets_choose")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Google Sheets
                    </CardTitle>
                    <CardDescription>Import revenue from a connected Google Sheet tab.</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("hubspot")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      HubSpot (CRM)
                    </CardTitle>
                    <CardDescription>Attribute deal revenue to this campaign.</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("salesforce")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Salesforce (CRM)
                    </CardTitle>
                    <CardDescription>Attribute opportunity revenue to this campaign.</CardDescription>
                  </CardHeader>
                </Card>

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("shopify")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Shopify (Ecommerce)
                    </CardTitle>
                    <CardDescription>Attribute order revenue to this campaign.</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}

            {step === "manual" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Enter revenue</CardTitle>
                    <CardDescription>Revenue to date for this campaign (lifetime). You can update it any time.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {platformContext === 'linkedin' ? (
                        <>
                          <div className="space-y-2 md:col-span-2">
                            <div className="text-sm font-medium">What do you have?</div>
                            <RadioGroup
                              value={manualValueSource}
                              onValueChange={(v) => {
                                const next = v as 'revenue' | 'conversion_value';
                                setManualValueSource(next);
                                // Enforce mutual exclusivity for enterprise-grade correctness.
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
                            <p className="text-xs text-slate-600 dark:text-slate-400">
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
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                Revenue metrics will be calculated as Conversions × Conversion Value.
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleManualSave} disabled={savingManual}>
                        {savingManual ? "Saving…" : isEditing ? "Update revenue" : "Save revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "csv" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    {isEditing && (
                      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm text-slate-700 dark:text-slate-300">
                        To update this revenue source, re-upload the CSV. We’ll reuse your previous column mapping when possible.
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Upload file (CSV)</Label>
                        {csvFile && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCsvFile(null);
                              setCsvPreview(null);
                              setCsvRevenueCol("");
                              setCsvConversionValueCol("");
                              setCsvDateCol("");
                              setCsvCampaignCol("");
                              setCsvCampaignValues([]);
                              setCsvCampaignQuery("");
                              setCsvValueSource('revenue');
                            }}
                          >
                            Remove file
                          </Button>
                        )}
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
                      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm text-slate-700 dark:text-slate-300">
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
                            <Label>{platformContext === 'linkedin' ? 'Revenue column (optional)' : 'Revenue column'}</Label>
                            <Select
                              value={(csvRevenueCol || (platformContext === 'linkedin' ? SELECT_NONE : '')) as any}
                              onValueChange={(v) => setCsvRevenueCol(v === SELECT_NONE ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={platformContext === 'linkedin' ? 'None' : 'Select revenue column'} />
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
                              <Label>Conversion value column (optional)</Label>
                              <Select
                                value={(csvConversionValueCol || SELECT_NONE) as any}
                                onValueChange={(v) => setCsvConversionValueCol(v === SELECT_NONE ? "" : v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="None" />
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

                        {platformContext === 'linkedin' && csvRevenueCol && csvConversionValueCol && (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="text-sm font-medium">Source of truth</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              You selected both Revenue and Conversion Value. Choose which one MetricMind should use.
                            </div>
                            <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="li-csv-value-source"
                                  checked={csvValueSource === 'revenue'}
                                  onChange={() => setCsvValueSource('revenue')}
                                />
                                Use Revenue (derive Conversion Value)
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="li-csv-value-source"
                                  checked={csvValueSource === 'conversion_value'}
                                  onChange={() => setCsvValueSource('conversion_value')}
                                />
                                Use Conversion Value (ignore Revenue)
                              </label>
                            </div>
                          </div>
                        )}

                        {csvCampaignCol ? (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Campaign value(s)</div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
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
                                <div className="text-sm text-slate-500 dark:text-slate-400">No campaign values found in sample rows.</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600 dark:text-slate-400">Select a campaign column to choose campaign values.</div>
                        )}

                        {/* Preview table */}
                        <div className="rounded-md border overflow-hidden">
                          <div className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border-b">
                            Preview (first {Math.min(8, filteredCsvPreviewRows.length)} row{Math.min(8, filteredCsvPreviewRows.length) === 1 ? "" : "s"})
                          </div>
                          <div className="overflow-auto">
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-white dark:bg-slate-950">
                                <tr>
                                  {(csvPreview.headers || []).slice(0, 8).map((h) => (
                                    <th key={h} className="text-left p-2 border-b text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(filteredCsvPreviewRows || []).slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(csvPreview.headers || []).slice(0, 8).map((h) => (
                                      <td key={h} className="p-2 text-xs text-slate-700 dark:text-slate-200 truncate">
                                        {String((row as any)?.[h] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(filteredCsvPreviewRows || []).length === 0 && (
                                  <tr>
                                    <td className="p-3 text-sm text-slate-500 dark:text-slate-400" colSpan={8}>
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
                    {sheetsConnectionsLoading ? (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                        <div className="text-sm text-slate-700 dark:text-slate-300">Loading your connected Google Sheets…</div>
                      </div>
                    ) : sheetsConnections.length === 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Connect Google Sheets</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
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
                              toast({ title: "Google Sheets connected", description: "Click Next to preview and map your columns." });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Now select a tab and click Next." });
                            }
                          }}
                          onError={(err) => toast({ title: "Google Sheets connect failed", description: err, variant: "destructive" })}
                        />
                      </div>
                    ) : showSheetsConnect ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Change sheet/tab</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
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
                              toast({ title: "Google Sheets connected", description: "Click Next to preview and map your columns." });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Now select a tab and click Next." });
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
                      <Button
                        onClick={async () => {
                          if (!sheetsConnectionId) return;
                          await handleSheetsPreview(sheetsConnectionId);
                          setStep("sheets_map");
                        }}
                        disabled={!sheetsConnectionId || sheetsProcessing}
                      >
                        {sheetsProcessing ? "Loading…" : "Next"}
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
                      <div className="rounded-md border p-3 text-sm text-slate-600 dark:text-slate-400">
                        No preview loaded yet. Go back and click Next.
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
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              If your sheet contains multiple campaigns, filter it to the campaign value(s) you want.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label>{platformContext === 'linkedin' ? 'Revenue column (optional)' : 'Revenue column'}</Label>
                            <Select
                              value={(sheetsRevenueCol || (platformContext === 'linkedin' ? SELECT_NONE : '')) as any}
                              onValueChange={(v) => setSheetsRevenueCol(v === SELECT_NONE ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={platformContext === 'linkedin' ? 'None' : 'Select revenue column'} />
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
                              <Label>Conversion value column (optional)</Label>
                              <Select
                                value={(sheetsConversionValueCol || SELECT_NONE) as any}
                                onValueChange={(v) => setSheetsConversionValueCol(v === SELECT_NONE ? "" : v)}
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
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                Optional: import value per conversion directly (used for ROI/ROAS when revenue is not available).
                              </p>
                            </div>
                          )}
                        </div>

                        {platformContext === 'linkedin' && sheetsRevenueCol && sheetsConversionValueCol && (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="text-sm font-medium">Source of truth</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              You selected both Revenue and Conversion Value. Choose which one MetricMind should use.
                            </div>
                            <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="li-value-source"
                                  checked={sheetsValueSource === 'revenue'}
                                  onChange={() => setSheetsValueSource('revenue')}
                                />
                                Use Revenue (derive Conversion Value)
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="li-value-source"
                                  checked={sheetsValueSource === 'conversion_value'}
                                  onChange={() => setSheetsValueSource('conversion_value')}
                                />
                                Use Conversion Value (ignore Revenue)
                              </label>
                            </div>
                          </div>
                        )}

                        {sheetsCampaignCol && (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Campaign value(s)</div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
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
                                <div className="text-sm text-slate-500 dark:text-slate-400">No campaign values found in sample rows.</div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Rows detected: <span className="font-medium">{sheetsPreview.rowCount.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Preview table */}
                        <div className="rounded-md border overflow-hidden">
                          <div className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border-b">
                            Preview (first {Math.min(8, filteredSheetsPreviewRows.length)} row{Math.min(8, filteredSheetsPreviewRows.length) === 1 ? "" : "s"})
                          </div>
                          <div className="overflow-auto">
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-white dark:bg-slate-950">
                                <tr>
                                  {(sheetsPreview.headers || []).slice(0, 8).map((h) => (
                                    <th key={h} className="text-left p-2 border-b text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(filteredSheetsPreviewRows || []).slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(sheetsPreview.headers || []).slice(0, 8).map((h) => (
                                      <td key={h} className="p-2 text-xs text-slate-700 dark:text-slate-200 truncate">
                                        {String((row as any)?.[h] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(filteredSheetsPreviewRows || []).length === 0 && (
                                  <tr>
                                    <td className="p-3 text-sm text-slate-500 dark:text-slate-400" colSpan={8}>
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
                          (platformContext === 'linkedin' && !sheetsRevenueCol && !sheetsConversionValueCol)
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
                  mode={isEditing ? "edit" : "connect"}
                  initialMappingConfig={isEditing ? (salesforceInitialMappingConfig || null) : null}
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



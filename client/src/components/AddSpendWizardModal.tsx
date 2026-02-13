import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import {
  Loader2, AlertCircle, ExternalLink, CheckCircle2, Clock,
  ArrowLeft, Upload, FileSpreadsheet, ClipboardPaste, DollarSign, Zap,
} from "lucide-react";

type Step =
  | "select"
  | "ad_platform"
  | "csv"
  | "csv_map"
  | "paste"
  | "sheets_choose"
  | "sheets_map"
  | "manual";

type AdPlatform = "linkedin" | "meta" | "google_ads";

type LinkedInSpendCampaign = {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
};

type CsvPreview = {
  success: boolean;
  fileName?: string;
  headers?: string[];
  sampleRows?: Array<Record<string, string>>;
  rowCount?: number;
  error?: string;
};

export function AddSpendWizardModal(props: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  dateRange?: string; // spend is always distributed across this period (date-agnostic import)
  initialSource?: { id?: string; sourceType?: string; mappingConfig?: string | null; displayName?: string | null };
  onProcessed?: () => void;
}) {
  const { toast } = useToast();
  const isEditing = Boolean(props.initialSource?.id);
  const [step, setStep] = useState<Step>("select");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [isCsvPreviewing, setIsCsvPreviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvInputKey, setCsvInputKey] = useState(0);
  const [pasteText, setPasteText] = useState<string>("");
  const [showSheetsConnect, setShowSheetsConnect] = useState(false);

  const [spendColumn, setSpendColumn] = useState<string>("");
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  const [campaignKeyColumn, setCampaignKeyColumn] = useState<string>("");
  const [campaignKeyValues, setCampaignKeyValues] = useState<string[]>([]);
  const [campaignKeySearch, setCampaignKeySearch] = useState<string>("");

  const CAMPAIGN_COL_NONE = "__none__";

  const [manualAmount, setManualAmount] = useState<string>("");

  const [sheetsConnections, setSheetsConnections] = useState<Array<any>>([]);
  const [selectedSheetConnectionId, setSelectedSheetConnectionId] = useState<string>("");
  const [sheetsPreview, setSheetsPreview] = useState<any>(null);
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);
  const [isRemovingSheet, setIsRemovingSheet] = useState(false);

  // Ad platform state
  const [selectedPlatform, setSelectedPlatform] = useState<AdPlatform | null>(null);
  const [linkedInPreview, setLinkedInPreview] = useState<{
    adAccountId?: string;
    adAccountName?: string;
    campaigns: LinkedInSpendCampaign[];
    totalSpend: number;
    currency: string;
    dateRange?: string;
  } | null>(null);
  const [selectedLinkedInCampaignIds, setSelectedLinkedInCampaignIds] = useState<string[]>([]);
  const [isLinkedInLoading, setIsLinkedInLoading] = useState(false);
  const [linkedInConnectionStatus, setLinkedInConnectionStatus] = useState<{ connected: boolean; adAccountName?: string } | null>(null);
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; testMode?: boolean; message?: string } | null>(null);

  const prefillKeyRef = useRef<string | null>(null);
  const suppressCampaignResetRef = useRef(false);
  const campaignKeyTouchedRef = useRef(false);
  const autoDateDecisionRef = useRef<string | null>(null);
  const [autoPreviewSheetOnOpen, setAutoPreviewSheetOnOpen] = useState(false);
  const [isEditPrefillLoading, setIsEditPrefillLoading] = useState(false);
  const [csvPrefillMapping, setCsvPrefillMapping] = useState<any>(null);
  const [csvEditNotice, setCsvEditNotice] = useState<string>("");

  useEffect(() => {
    if (!props.open) {
      prefillKeyRef.current = null;
      autoDateDecisionRef.current = null;
      setStep("select");
      setCsvFile(null);
      setCsvPreview(null);
      setCsvInputKey((k) => k + 1);
      setIsCsvPreviewing(false);
      setIsProcessing(false);
      setSpendColumn("");
      setShowColumnMapping(false);
      setCampaignKeyColumn("");
      setCampaignKeyValues([]);
      setCampaignKeySearch("");
      setManualAmount("");
      setPasteText("");
      setShowSheetsConnect(false);
      setSheetsConnections([]);
      setSelectedSheetConnectionId("");
      setSheetsPreview(null);
      setIsSheetsLoading(false);
      setAutoPreviewSheetOnOpen(false);
      setCsvPrefillMapping(null);
      setCsvEditNotice("");
      setSelectedPlatform(null);
      setLinkedInPreview(null);
      setSelectedLinkedInCampaignIds([]);
      setIsLinkedInLoading(false);
      setLinkedInConnectionStatus(null);
      setMetaStatus(null);
    }
  }, [props.open]);

  // Prefill when editing an existing spend source (e.g., after ROAS/ROI are computed).
  useEffect(() => {
    if (!props.open) return;
    if (!props.initialSource) return;

    const src = props.initialSource as any;
    const key = String(src?.id || "") + "|" + String(src?.sourceType || "") + "|" + String(src?.mappingConfig || "");
    if (prefillKeyRef.current === key) return;
    prefillKeyRef.current = key;

    let mapping: any = null;
    try {
      mapping = src?.mappingConfig ? JSON.parse(String(src.mappingConfig)) : null;
    } catch {
      mapping = null;
    }

    const sourceType = String(src?.sourceType || "").toLowerCase();
    const mapSpend = mapping?.spendColumn ? String(mapping.spendColumn) : "";
    const mapCampaignCol = mapping?.campaignColumn ? String(mapping.campaignColumn) : "";
    const mapCampaignVals = Array.isArray(mapping?.campaignValues)
      ? mapping.campaignValues.map((v: any) => String(v ?? "").trim()).filter((v: string) => !!v)
      : (mapping?.campaignValue ? [String(mapping.campaignValue).trim()] : []);

    if (sourceType === "google_sheets") {
      setStep("sheets_map");
      if (mapSpend) setSpendColumn(mapSpend);
      if (mapCampaignCol) {
        // Prevent the "campaign column changed" effect from wiping prefilled values.
        suppressCampaignResetRef.current = true;
        setCampaignKeyColumn(mapCampaignCol);
      }
      if (mapCampaignVals.length) setCampaignKeyValues(mapCampaignVals);

      const connectionId = String(mapping?.connectionId || "").trim();
      if (connectionId) {
        setSelectedSheetConnectionId(connectionId);
        setIsEditPrefillLoading(true);
        setAutoPreviewSheetOnOpen(true);
      }
      return;
    }

    if (sourceType === "csv") {
      setStep("csv_map");
      setCsvFile(null);
      setCsvPrefillMapping(mapping);
      setCsvEditNotice("To edit a CSV import, please re-upload the same (or updated) file. We'll re-process spend using your updated mappings after preview.");
      // If we saved preview metadata (headers + sample rows) in mappingConfig, hydrate it so the mapping UI renders immediately.
      const savedHeaders = Array.isArray(mapping?.csvHeaders) ? mapping.csvHeaders.map((h: any) => String(h ?? "")).filter(Boolean) : [];
      const savedSampleRows = Array.isArray(mapping?.csvSampleRows) ? mapping.csvSampleRows : [];
      const savedRowCount = Number.isFinite(mapping?.csvRowCount) ? Number(mapping.csvRowCount) : undefined;
      if (savedHeaders.length) {
        setCsvPreview({
          success: true,
          fileName: mapping?.displayName || src?.displayName || "CSV spend",
          headers: savedHeaders,
          sampleRows: savedSampleRows,
          rowCount: savedRowCount,
        });
      } else {
        setCsvPreview(null);
      }
      if (mapCampaignCol) {
        suppressCampaignResetRef.current = true;
        setCampaignKeyColumn(mapCampaignCol);
      }
      if (mapCampaignVals.length) setCampaignKeyValues(mapCampaignVals);
      if (mapSpend) setSpendColumn(mapSpend);
      return;
    }

    if (sourceType === "linkedin_api") {
      setStep("ad_platform");
      setSelectedPlatform("linkedin");
      return;
    }

    if (sourceType === "manual") {
      setStep("manual");
      const savedAmount =
        (mapping && typeof (mapping as any).amount === "number") ? Number((mapping as any).amount) :
          (mapping && typeof (mapping as any).amount === "string") ? parseFloat(String((mapping as any).amount)) :
            null;
      if (savedAmount && Number.isFinite(savedAmount)) {
        setManualAmount(String(savedAmount));
      }
      return;
    }
  }, [props.open, props.initialSource]);

  useEffect(() => {
    if (!props.open) return;
    if (step !== "sheets_choose" && step !== "sheets_map") return;
    let mounted = true;
    (async () => {
      try {
        // Only load Spend-purpose connections for this modal (avoid pre-filling from Revenue connections).
        const resp = await fetch(`/api/campaigns/${props.campaignId}/google-sheets-connections?purpose=spend`);
        if (!resp.ok) return;
        const json = await resp.json().catch(() => null);
        const conns = Array.isArray(json?.connections) ? json.connections : Array.isArray(json) ? json : [];
        if (!mounted) return;
        setSheetsConnections(conns.filter((c: any) => c && c.isActive !== false));
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [props.open, props.campaignId, step]);

  const headers = csvPreview?.headers || [];
  const sampleRows = csvPreview?.sampleRows || [];

  const inferredSpendColumn = useMemo(() => {
    if (!headers.length) return "";
    const lc = headers.map((h) => ({ h, l: h.toLowerCase() }));
    return lc.find((x) => x.l === "spend" || x.l.includes("spend") || x.l.includes("cost") || x.l.includes("amount"))?.h || "";
  }, [headers]);

  const inferredCampaignColumn = useMemo(() => {
    if (!headers.length) return "";
    const lc = headers.map((h) => ({ h, l: h.toLowerCase() }));
    // Prefer explicit id, then name, then generic "campaign"
    return (
      lc.find((x) => x.l === "campaign id" || x.l === "campaign_id" || x.l.includes("campaign id") || x.l.includes("campaign_id"))?.h ||
      lc.find((x) => x.l === "campaign name" || x.l === "campaign_name" || x.l.includes("campaign name") || x.l.includes("campaign_name"))?.h ||
      lc.find((x) => x.l === "campaign" || x.l.includes("campaign"))?.h ||
      ""
    );
  }, [headers]);

  const effectiveCampaignColumn = useMemo(
    () => campaignKeyColumn || inferredCampaignColumn || "",
    [campaignKeyColumn, inferredCampaignColumn]
  );

  useEffect(() => {
    if (!csvPreview?.success) return;
    if (!spendColumn && inferredSpendColumn) setSpendColumn(inferredSpendColumn);
    // If a campaign identifier column is present (e.g. "Campaign") and the user hasn't explicitly picked/cleared it,
    // auto-select it so the UI reflects the detected identifier.
    if (!campaignKeyColumn && inferredCampaignColumn && !campaignKeyTouchedRef.current) {
      setCampaignKeyColumn(inferredCampaignColumn);
    }
  }, [csvPreview, inferredSpendColumn, spendColumn, campaignKeyColumn, inferredCampaignColumn]);

  const uniqueCampaignKeyValues = useMemo(() => {
    if (!effectiveCampaignColumn) return [];
    const set = new Set<string>();
    for (const r of sampleRows) {
      const v = String((r as any)[effectiveCampaignColumn] ?? "").trim();
      if (v) set.add(v);
    }
    const all = Array.from(set);
    const q = campaignKeySearch.trim().toLowerCase();
    const filtered = q ? all.filter((x) => x.toLowerCase().includes(q)) : all;
    return filtered.slice(0, 200);
  }, [effectiveCampaignColumn, sampleRows, campaignKeySearch]);

  const previewRows = useMemo(() => {
    if (!Array.isArray(sampleRows) || sampleRows.length === 0) return [];
    if (campaignKeyValues.length === 0) return sampleRows;
    if (!effectiveCampaignColumn) return sampleRows;
    const set = new Set(campaignKeyValues);
    return sampleRows.filter((r: any) => set.has(String(r?.[effectiveCampaignColumn] ?? "").trim()));
  }, [sampleRows, campaignKeyValues, effectiveCampaignColumn]);

  // If we are editing a CSV spend source and the user re-uploads a file, try to apply the saved mapping.
  useEffect(() => {
    if (!csvPreview?.success) return;
    if (!csvPrefillMapping) return;
    const mapSpend = csvPrefillMapping?.spendColumn ? String(csvPrefillMapping.spendColumn) : "";
    const mapCampaignCol = csvPrefillMapping?.campaignColumn ? String(csvPrefillMapping.campaignColumn) : "";
    if (mapSpend && headers.includes(mapSpend)) setSpendColumn(mapSpend);
    if (mapCampaignCol && headers.includes(mapCampaignCol)) setCampaignKeyColumn(mapCampaignCol);
  }, [csvPreview?.success, csvPrefillMapping, headers]);

  // Reset selected campaign values when the identifier column changes.
  useEffect(() => {
    if (suppressCampaignResetRef.current) {
      suppressCampaignResetRef.current = false;
      return;
    }
    setCampaignKeyValues([]);
    setCampaignKeySearch("");
  }, [campaignKeyColumn]);

  const previewCsv = async () => {
    if (!csvFile) return;
    setIsCsvPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/csv/preview`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || "Failed to preview CSV");
      }
      setCsvPreview(json);
      setStep("csv_map");
    } catch (e: any) {
      toast({ title: "CSV preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsCsvPreviewing(false);
    }
  };

  const clearCsvFile = () => {
    setCsvFile(null);
    setCsvPreview(null);
    setCsvPrefillMapping(null);
    setCsvEditNotice("");
    setCsvInputKey((k) => k + 1); // forces <input type="file"> to reset
  };

  const parsePastedTable = (raw: string) => {
    const text = String(raw || "").replace(/\r\n/g, "\n").trim();
    if (!text) return null;
    const lines = text.split("\n").filter(Boolean);
    if (!lines.length) return null;

    // Prefer tab-delimited (common when copying from Excel/Sheets), otherwise fallback to comma.
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const split = (line: string) => line.split(delim).map((c) => String(c ?? "").trim());

    const headers = split(lines[0]).filter((h) => !!h);
    if (!headers.length) return null;

    const sampleRows: Array<Record<string, string>> = [];
    for (const line of lines.slice(1, 1 + 25)) {
      const cells = split(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = String(cells[idx] ?? "");
      });
      sampleRows.push(row);
    }

    // Build a CSV file to reuse the existing server-side CSV pipeline.
    const escapeCsv = (v: string) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csvLines: string[] = [];
    csvLines.push(headers.map(escapeCsv).join(","));
    for (const r of sampleRows) {
      csvLines.push(headers.map((h) => escapeCsv(String((r as any)[h] ?? ""))).join(","));
    }
    const csvText = csvLines.join("\n");
    const file = new File([csvText], "pasted_spend.csv", { type: "text/csv" });

    return { headers, sampleRows, rowCount: Math.max(lines.length - 1, 0), file };
  };

  const previewPaste = async () => {
    setIsCsvPreviewing(true);
    try {
      const parsed = parsePastedTable(pasteText);
      if (!parsed) throw new Error("Paste a table with a header row (Date, Spend, optional Campaign).");
      setCsvFile(parsed.file);
      setCsvPreview({ success: true, fileName: "Pasted table", headers: parsed.headers, sampleRows: parsed.sampleRows, rowCount: parsed.rowCount });
      setStep("csv_map");
    } catch (e: any) {
      toast({ title: "Paste preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsCsvPreviewing(false);
    }
  };

  const previewSheet = async () => {
    if (!selectedSheetConnectionId) return;
    setIsSheetsLoading(true);
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/sheets/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedSheetConnectionId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) {
        if (json?.requiresReauthorization || String(json?.error || "").includes("UNAUTHENTICATED")) {
          throw new Error("Google Sheets needs to be reconnected. Click “Change sheet/tab” to reconnect.");
        }
        throw new Error(json?.error || "Failed to preview sheet");
      }
      setSheetsPreview(json);
      setCsvPreview({ success: true, fileName: `${json.spreadsheetName || "Google Sheet"}`, headers: json.headers, sampleRows: json.sampleRows, rowCount: json.rowCount });
      setStep("sheets_map");
    } catch (e: any) {
      toast({ title: "Sheet preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const refreshSheetsConnections = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/google-sheets-connections?purpose=spend`);
      const json = await resp.json().catch(() => null);
      const conns = Array.isArray(json?.connections) ? json.connections : Array.isArray(json) ? json : [];
      const filtered = conns.filter((c: any) => c && c.isActive !== false);
      setSheetsConnections(filtered);
      return filtered;
    } catch {
      return null;
    }
  };

  const removeSelectedSheetConnection = async () => {
    if (!selectedSheetConnectionId) return;
    setIsRemovingSheet(true);
    try {
      const resp = await fetch(
        `/api/google-sheets/${encodeURIComponent(props.campaignId)}/connection?connectionId=${encodeURIComponent(selectedSheetConnectionId)}`,
        { method: "DELETE" }
      );
      const json = await resp.json().catch(() => null);
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to remove Google Sheets connection");
      }
      // Refresh list and reset selection
      const filtered = await refreshSheetsConnections();
      setSelectedSheetConnectionId("");
      setSheetsPreview(null);
      setCsvPreview(null);
      // Stay on the sheets_choose view
      if (!filtered || filtered.length === 0) setShowSheetsConnect(false);
      toast({ title: "Google Sheet removed", description: "You can now connect a different sheet." });
    } catch (e: any) {
      toast({ title: "Remove failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsRemovingSheet(false);
    }
  };

  // When editing a Google Sheets spend source, auto-preview to jump directly to mapping.
  useEffect(() => {
    if (!props.open) return;
    if (!autoPreviewSheetOnOpen) return;
    if (step !== "sheets_map") return;
    if (!selectedSheetConnectionId) return;
    setAutoPreviewSheetOnOpen(false);
    // Fire and forget; it will set step to sheets_map.
    previewSheet().finally(() => setIsEditPrefillLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, autoPreviewSheetOnOpen, step, selectedSheetConnectionId]);

  const processCsv = async () => {
    if (!csvFile) return;
    if (!spendColumn) {
      toast({ title: "Missing mappings", description: "Select a Spend column.", variant: "destructive" });
      return;
    }
    if (campaignKeyValues.length > 0 && !effectiveCampaignColumn) {
      toast({ title: "Campaign mapping incomplete", description: "Select a campaign identifier column (or clear campaign values).", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const hasCampaignScope = !!effectiveCampaignColumn && campaignKeyValues.length > 0;
      const mapping = {
        displayName: csvFile.name,
        dateColumn: null, // date-agnostic: always distribute spend across the selected period
        spendColumn,
        campaignColumn: hasCampaignScope ? effectiveCampaignColumn : null,
        campaignValue: hasCampaignScope && campaignKeyValues.length === 1 ? campaignKeyValues[0] : null,
        campaignValues: hasCampaignScope ? campaignKeyValues : null,
        currency: props.currency || "USD",
        dateRange: props.dateRange || "30days",
        // Persist lightweight preview metadata so "Edit" can reopen directly into a pre-filled mapping UI.
        // This is NOT used for processing (the user must re-upload to reprocess); it's purely for UX.
        csvHeaders: Array.isArray(csvPreview?.headers) ? csvPreview?.headers : undefined,
        csvSampleRows: Array.isArray(csvPreview?.sampleRows) ? csvPreview?.sampleRows : undefined,
        csvRowCount: typeof csvPreview?.rowCount === "number" ? csvPreview?.rowCount : undefined,
      };
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(mapping));
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/csv/process`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process spend");

      toast({
        title: isEditing ? "Spend updated" : "Spend imported",
        description: `Imported ${json.days} day(s), total ${props.currency || "USD"} ${json.totalSpend}.`,
      });
      props.onProcessed?.();
      props.onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Processing failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processSheets = async () => {
    if (!selectedSheetConnectionId) return;
    if (!spendColumn) {
      toast({ title: "Missing mappings", description: "Select a Spend column.", variant: "destructive" });
      return;
    }
    if (campaignKeyValues.length > 0 && !effectiveCampaignColumn) {
      toast({ title: "Campaign mapping incomplete", description: "Select a campaign identifier column (or clear campaign values).", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const hasCampaignScope = !!effectiveCampaignColumn && campaignKeyValues.length > 0;
      const mapping = {
        displayName: (sheetsPreview?.spreadsheetName ? `${sheetsPreview.spreadsheetName}${sheetsPreview.sheetName ? ` (${sheetsPreview.sheetName})` : ""}` : "Google Sheets spend"),
        dateColumn: null, // date-agnostic: always distribute spend across the selected period
        spendColumn,
        campaignColumn: hasCampaignScope ? effectiveCampaignColumn : null,
        campaignValue: hasCampaignScope && campaignKeyValues.length === 1 ? campaignKeyValues[0] : null,
        campaignValues: hasCampaignScope ? campaignKeyValues : null,
        currency: props.currency || "USD",
        dateRange: props.dateRange || "30days",
      };
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/sheets/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedSheetConnectionId, mapping }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process spend");
      toast({
        title: isEditing ? "Spend updated" : "Spend imported",
        description: `Imported ${json.days} day(s), total ${props.currency || "USD"} ${json.totalSpend}.`,
      });
      props.onProcessed?.();
      props.onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Processing failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Ad Platform: LinkedIn spend preview ──
  const previewLinkedInSpend = async () => {
    setIsLinkedInLoading(true);
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/linkedin/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch LinkedIn spend data");
      }
      setLinkedInPreview({
        adAccountId: json.adAccountId,
        adAccountName: json.adAccountName,
        campaigns: json.campaigns || [],
        totalSpend: json.totalSpend || 0,
        currency: json.currency || props.currency || "USD",
        dateRange: json.dateRange,
      });
      // Auto-select all campaigns
      setSelectedLinkedInCampaignIds((json.campaigns || []).map((c: any) => c.id));
    } catch (e: any) {
      toast({ title: "LinkedIn preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsLinkedInLoading(false);
    }
  };

  const processLinkedInSpend = async () => {
    if (!linkedInPreview || selectedLinkedInCampaignIds.length === 0) {
      toast({ title: "No campaigns selected", description: "Select at least one LinkedIn campaign to import spend from.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/linkedin/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignIds: selectedLinkedInCampaignIds,
          currency: props.currency || "USD",
        }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to import LinkedIn spend");
      toast({
        title: isEditing ? "Spend updated" : "Spend imported",
        description: `Imported ${props.currency || "USD"} ${json.totalSpend} from ${json.campaignCount} LinkedIn campaign(s).`,
      });
      props.onProcessed?.();
      props.onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Ad Platform: Check LinkedIn connection status ──
  const checkLinkedInConnection = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/connected-platforms`);
      const json = await resp.json().catch(() => null);
      const platforms = json?.platforms || json?.statuses || [];
      const li = platforms.find((p: any) => p.id === "linkedin");
      setLinkedInConnectionStatus(li ? { connected: !!li.connected, adAccountName: li.adAccountName } : { connected: false });
      const meta = platforms.find((p: any) => p.id === "facebook");
      if (meta) {
        setMetaStatus({ connected: !!meta.connected, message: meta.connected ? "Connected" : undefined });
      }
    } catch {
      setLinkedInConnectionStatus({ connected: false });
    }
  };

  // ── Ad Platform: Check Meta status ──
  const checkMetaStatus = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/meta/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await resp.json().catch(() => null);
      if (json?.success) {
        setMetaStatus({ connected: json.connected, testMode: json.testMode, message: json.message });
      }
    } catch { /* ignore */ }
  };

  // Load platform connection statuses when ad_platform step is entered
  useEffect(() => {
    if (!props.open || step !== "ad_platform") return;
    checkLinkedInConnection();
    checkMetaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, step]);

  const processManual = async () => {
    const amount = parseFloat(String(manualAmount || "").replace(/[$,]/g, "").trim());
    if (!Number.isFinite(amount) || !(amount > 0)) {
      toast({ title: "Invalid amount", description: "Enter a spend amount greater than 0.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/process/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency: props.currency || "USD", dateRange: props.dateRange || "30days" }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save manual spend");
      toast({ title: "Spend saved", description: "Manual spend is now available for financial metrics." });
      props.onProcessed?.();
      props.onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Navigation ──
  const handleBack = () => {
    if (step === "select") return;
    if (step === "csv_map") return setStep("csv");
    if (step === "sheets_map") return setStep("sheets_choose");
    setStep("select");
  };

  // ── Dynamic title / description ──
  const title =
    step === "select" ? "Add spend source" :
    step === "ad_platform" ? "Ad platform spend" :
    step === "csv" ? (isEditing ? "Edit CSV spend" : "Upload CSV") :
    step === "csv_map" ? (isEditing ? "Edit CSV spend" : "Map CSV columns") :
    step === "paste" ? "Paste table" :
    step === "sheets_choose" ? (isEditing ? "Edit Google Sheets spend" : "Google Sheets") :
    step === "sheets_map" ? (isEditing ? "Edit Google Sheets spend" : "Map sheet columns") :
    step === "manual" ? (isEditing ? "Edit manual spend" : "Manual spend") :
    "Add spend source";

  const description =
    step === "select"
      ? "Choose where your spend data comes from."
      : `Currency: ${props.currency || "USD"} • Spend is treated as "to date" (campaign lifetime)`;

  // ── Column mapping UI (shared between CSV map and Sheets map) ──
  const renderColumnMapping = () => (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Columns</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Spend: <span className="font-medium">{spendColumn || "—"}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We'll treat imported spend as a total and distribute it evenly across the current GA4 window ({props.dateRange || "30days"}).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowColumnMapping((v) => !v)}>
          {showColumnMapping ? "Hide" : "Edit"} columns
        </Button>
      </div>

      {showColumnMapping && (
        <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
          <div className="space-y-2">
            <Label>Spend column</Label>
            <Select value={spendColumn} onValueChange={setSpendColumn}>
              <SelectTrigger><SelectValue placeholder="Select spend column" /></SelectTrigger>
              <SelectContent className="z-[10000]">
                {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="pt-2 border-t space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">Campaign mapping (only if this dataset includes multiple campaigns)</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If this file/tab is already scoped to this campaign, leave these blank. Otherwise select the identifier column and the value(s) for this campaign.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Campaign identifier column</Label>
            <Select
              value={campaignKeyColumn || CAMPAIGN_COL_NONE}
              onValueChange={(v) => {
                campaignKeyTouchedRef.current = true;
                setCampaignKeyColumn(v === CAMPAIGN_COL_NONE ? "" : v);
              }}
            >
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent className="z-[10000]">
                <SelectItem value={CAMPAIGN_COL_NONE}>None</SelectItem>
                {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Campaign value(s)</Label>
            <Input
              value={campaignKeySearch}
              onChange={(e) => setCampaignKeySearch(e.target.value)}
              placeholder="Search values…"
              disabled={!effectiveCampaignColumn}
            />
            <div className="rounded-md border max-h-48 overflow-y-auto p-2 space-y-2">
              {!effectiveCampaignColumn ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">Upload/preview data to see campaign values.</div>
              ) : uniqueCampaignKeyValues.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">No values found in the preview.</div>
              ) : (
                uniqueCampaignKeyValues.map((val) => (
                  <div key={val} className="flex items-start gap-2">
                    <Checkbox
                      checked={campaignKeyValues.includes(val)}
                      onCheckedChange={(checked) => {
                        setCampaignKeyValues((prev) =>
                          checked ? (prev.includes(val) ? prev : [...prev, val]) : prev.filter((x) => x !== val)
                        );
                      }}
                    />
                    <div className="text-sm text-slate-700 dark:text-slate-300">{val}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderPreviewTable = () => {
    if (previewRows.length === 0) return null;
    return (
      <div className="rounded-lg border p-4 mt-4">
        <div className="text-sm font-medium mb-3">Preview (first {Math.min(previewRows.length, 5)} rows)</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {headers.slice(0, 6).map((h) => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 5).map((r, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  {headers.slice(0, 6).map((h) => (
                    <td key={h} className="py-2 pr-4 text-slate-700 dark:text-slate-300">{String((r as any)[h] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Processing will automatically sum spend by day, so unaggregated rows are OK.
        </p>
      </div>
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[980px] max-w-[95vw] h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* ── Header ── */}
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

          {/* ── Body ── */}
          <div className="px-6 py-5 flex-1 min-h-0 overflow-y-auto">

        {isEditPrefillLoading && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your sheet preview…
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP: SELECT SOURCE ═══════════════════ */}
        {!isEditPrefillLoading && step === "select" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("ad_platform")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Ad platforms
                </CardTitle>
                <CardDescription>Pull spend directly from LinkedIn Ads, Meta, or Google Ads.</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("sheets_choose")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Google Sheets
                </CardTitle>
                <CardDescription>Import spend from a connected Google Sheet tab.</CardDescription>
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
                    <span>Import spend from a CSV. Requires manual re-upload to update.</span>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("paste")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4" />
                  Paste table
                </CardTitle>
                <CardDescription>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-500 font-medium">⚠️</span>
                    <span>Paste from Excel / Google Sheets. Requires manual re-paste to update.</span>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("manual")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Manual
                </CardTitle>
                <CardDescription>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-500 font-medium">⚠️</span>
                    <span>Enter spend manually. Requires manual updates (best for testing only).</span>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

            {/* ── AD PLATFORM STEP ── */}
            {step === "ad_platform" && (
              <div className="space-y-4">
                {/* Platform picker */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* LinkedIn */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform("linkedin")}
                    className={`relative rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${selectedPlatform === "linkedin"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔗</span>
                      <span className="font-medium text-sm">LinkedIn Ads</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pull spend via LinkedIn Marketing API
                    </p>
                    {linkedInConnectionStatus?.connected ? (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                        Setup required
                      </Badge>
                    )}
                  </button>

                  {/* Meta/Facebook */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform("meta")}
                    className={`relative rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${selectedPlatform === "meta"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📘</span>
                      <span className="font-medium text-sm">Meta / Facebook</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pull spend via Meta Marketing API
                    </p>
                    <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                      <Clock className="w-3 h-3 mr-1" /> Coming soon
                    </Badge>
                  </button>

                  {/* Google Ads */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform("google_ads")}
                    className={`relative rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${selectedPlatform === "google_ads"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📊</span>
                      <span className="font-medium text-sm">Google Ads</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pull spend via Google Ads API
                    </p>
                    <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                      <Clock className="w-3 h-3 mr-1" /> Coming soon
                    </Badge>
                  </button>
                </div>

                {/* ── LinkedIn panel ── */}
                {selectedPlatform === "linkedin" && (
                  <div className="rounded-lg border p-4 space-y-4">
                    {!linkedInConnectionStatus?.connected ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">LinkedIn Ads — Not connected</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          You need to connect your LinkedIn Ads account first. Go to your campaign settings to connect via OAuth.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(`/campaigns/${props.campaignId}`, "_blank");
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Connect LinkedIn Ads
                        </Button>
                      </div>
                    ) : !linkedInPreview ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">LinkedIn Ads — Connected</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {linkedInConnectionStatus.adAccountName
                            ? `Ad account: ${linkedInConnectionStatus.adAccountName}`
                            : "Your LinkedIn Ads account is connected."}
                          {" "}We'll fetch the last 90 days of campaign spend.
                        </p>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={previewLinkedInSpend}
                          disabled={isLinkedInLoading}
                        >
                          {isLinkedInLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Fetching spend data…
                            </>
                          ) : "Fetch LinkedIn spend"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">LinkedIn Ads spend</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {linkedInPreview.adAccountName || "Ad account"} · {linkedInPreview.dateRange || "Last 90 days"}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {linkedInPreview.currency} {(() => {
                                const selectedSpend = linkedInPreview.campaigns
                                  .filter((c) => selectedLinkedInCampaignIds.includes(c.id))
                                  .reduce((sum, c) => sum + c.spend, 0);
                                return selectedSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </div>
                            <div className="text-xs text-slate-500">{selectedLinkedInCampaignIds.length} of {linkedInPreview.campaigns.length} campaigns selected</div>
                          </div>
                        </div>

                        {linkedInPreview.campaigns.length === 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            No campaigns with spend found in the last 90 days.
                          </div>
                        ) : (
                          <div className="rounded-md border max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-white dark:bg-slate-950">
                                <tr className="border-b">
                                  <th className="text-left py-2 px-3 w-8">
                                    <Checkbox
                                      checked={selectedLinkedInCampaignIds.length === linkedInPreview.campaigns.length}
                                      onCheckedChange={(checked) => {
                                        setSelectedLinkedInCampaignIds(
                                          checked ? linkedInPreview.campaigns.map((c) => c.id) : []
                                        );
                                      }}
                                    />
                                  </th>
                                  <th className="text-left py-2 px-3 font-medium">Campaign</th>
                                  <th className="text-right py-2 px-3 font-medium">Spend</th>
                                  <th className="text-right py-2 px-3 font-medium">Impressions</th>
                                  <th className="text-right py-2 px-3 font-medium">Clicks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linkedInPreview.campaigns.map((c) => (
                                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <td className="py-2 px-3">
                                      <Checkbox
                                        checked={selectedLinkedInCampaignIds.includes(c.id)}
                                        onCheckedChange={(checked) => {
                                          setSelectedLinkedInCampaignIds((prev) =>
                                            checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                                          );
                                        }}
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="font-medium text-xs">{c.name}</div>
                                      <div className="text-[10px] text-slate-400">{c.status}</div>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{c.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{c.impressions.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{c.clicks.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Meta panel ── */}
                {selectedPlatform === "meta" && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="text-sm font-medium">Meta / Facebook Ads</div>
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 dark:text-amber-300">
                          <strong>Coming soon.</strong> Direct Meta Marketing API integration for spend import is under development.
                          {metaStatus?.connected && metaStatus.testMode && (
                            <span className="block mt-1">Your Meta account is connected in test mode.</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      In the meantime, you can export your Meta Ads spend as a CSV and import it using the <strong>Upload file</strong> or <strong>Paste table</strong> options above.
                    </p>
                  </div>
                )}

                {/* ── Google Ads panel ── */}
                {selectedPlatform === "google_ads" && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="text-sm font-medium">Google Ads</div>
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 dark:text-amber-300">
                          <strong>Coming soon.</strong> Direct Google Ads API integration for spend import is under development.
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      In the meantime, you can export your Google Ads spend as a CSV and import it using the <strong>Upload file</strong> or <strong>Paste table</strong> options above.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                {selectedPlatform === "linkedin" && linkedInPreview && (
                  <div className="flex justify-end">
                    <Button
                      onClick={processLinkedInSpend}
                      disabled={isProcessing || selectedLinkedInCampaignIds.length === 0}
                    >
                      {isProcessing ? "Importing..." : (isEditing ? "Update spend" : "Import spend")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === "sheets_choose" && (
              <div className="rounded-lg border p-4 space-y-4">
                {sheetsConnections.length === 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Google Sheets</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No Sheets are connected to this campaign yet.
                    </p>
                    {!showSheetsConnect ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowSheetsConnect(true)}>
                        Connect Google Sheets
                      </Button>
                    ) : (
                      <SimpleGoogleSheetsAuth
                        campaignId={props.campaignId}
                        selectionMode="append"
                        purpose="spend"
                        onSuccess={async (info) => {
                          setShowSheetsConnect(false);
                          const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                          if (preferredId) {
                            setSelectedSheetConnectionId(preferredId);
                            setSheetsConnections((prev) => {
                              const exists = prev.some((c: any) => String(c?.id) === preferredId);
                              if (exists) return prev;
                              const optimistic = {
                                id: preferredId,
                                spreadsheetId: info?.spreadsheetId || "",
                                spreadsheetName: info?.spreadsheetId || "Google Sheet",
                                sheetName: Array.isArray(info?.sheetNames) ? info?.sheetNames?.[0] : undefined,
                                isActive: true,
                              };
                              return [optimistic, ...prev];
                            });
                          }
                          await refreshSheetsConnections();
                          toast({ title: "Google Sheets connected", description: "Now pick the sheet you want to use for spend." });
                        }}
                        onError={(err) => toast({ title: "Google Sheets connect failed", description: err, variant: "destructive" })}
                      />
                    )}
                  </div>
                ) : showSheetsConnect ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Connect Google Sheets</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No Sheets are connected to this campaign yet. Connect once, then we’ll let you pick a sheet/tab.
                    </p>
                    <SimpleGoogleSheetsAuth
                      campaignId={props.campaignId}
                      selectionMode="append"
                      purpose="spend"
                      onSuccess={async (info) => {
                        setShowSheetsConnect(false);
                        const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                        // Optimistically select the just-created connection so the field immediately shows a value
                        // (even before we finish refreshing the connections list).
                        if (preferredId) {
                          setSelectedSheetConnectionId(preferredId);
                          setSheetsConnections((prev) => {
                            const exists = prev.some((c: any) => String(c?.id) === preferredId);
                            if (exists) return prev;
                            const optimistic = {
                              id: preferredId,
                              spreadsheetId: info?.spreadsheetId || "",
                              spreadsheetName: info?.spreadsheetId || "Google Sheet",
                              sheetName: Array.isArray(info?.sheetNames) ? info?.sheetNames?.[0] : undefined,
                              isActive: true,
                            };
                            return [optimistic, ...prev];
                          });
                        }
                        try {
                          const filtered = await refreshSheetsConnections();
                          // If we don't have a selection yet, auto-select when there's only one option.
                          if (!preferredId && !selectedSheetConnectionId && filtered && filtered.length === 1) {
                            setSelectedSheetConnectionId(String(filtered[0].id));
                          }
                          toast({ title: "Google Sheets connected", description: "Now pick the sheet you want to use for spend." });
                        } catch {
                          // ignore
                        }
                      }}
                      onError={(err) => toast({ title: "Google Sheets connect failed", description: err, variant: "destructive" })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Choose Google Sheet</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowSheetsConnect(true)}>
                          Change sheet/tab
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeSelectedSheetConnection}
                          disabled={!selectedSheetConnectionId || isRemovingSheet}
                        >
                          {isRemovingSheet ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </div>
                    <Select value={selectedSheetConnectionId} onValueChange={setSelectedSheetConnectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder={"Select a connected sheet"} />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {sheetsConnections.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.spreadsheetName || c.spreadsheetId}{c.sheetName ? ` — ${c.sheetName}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      This uses your Google Sheets connection for this campaign.
                    </p>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={previewSheet} disabled={!selectedSheetConnectionId || isSheetsLoading}>
                    {isSheetsLoading ? "Loading..." : "Next"}
                  </Button>
                </div>
              </div>
            )}

            {step === "csv" && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>CSV data won't auto-update.</strong> Consider using Google Sheets for automatic daily refreshes.
                    </div>
                  </div>
                </div>
                {csvEditNotice && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {csvEditNotice}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="csv-file">Upload file (CSV)</Label>
                    {csvFile && (
                      <Button type="button" variant="outline" size="sm" onClick={clearCsvFile}>
                        Remove file
                      </Button>
                    )}
                  </div>
                  <Input
                    key={`csv-file-${csvInputKey}`}
                    id="csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    className="cursor-pointer file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100 dark:hover:file:bg-slate-700"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Required columns: Spend. Optional: Date + Campaign (for multi-campaign files).
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={previewCsv} disabled={!csvFile || isCsvPreviewing}>
                    {isCsvPreviewing ? "Previewing..." : "Next"}
                  </Button>
                </div>
              </div>
            )}

            {step === "paste" && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>Pasted data won't auto-update.</strong> Consider using Google Sheets for automatic daily refreshes.
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paste-table">Paste table</Label>
                  <Textarea
                    id="paste-table"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Paste from Excel/Google Sheets with a header row.\nExample:\nDate\tSpend\tCampaign\n2026-01-01\t125.50\tbrand_awareness"}
                    className="min-h-[140px] font-mono text-xs"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Works with tab-delimited (copy/paste) or comma-delimited text. We’ll preview it before processing.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={previewPaste} disabled={!pasteText.trim() || isCsvPreviewing}>
                    {isCsvPreviewing ? "Previewing..." : "Next"}
                  </Button>
                </div>
              </div>
            )}

        {/* ═══════════════════ STEP: MANUAL ═══════════════════ */}
        {!isEditPrefillLoading && step === "manual" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Manual spend
              </CardTitle>
              <CardDescription>Enter a fixed spend amount for this campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Manual spend won't auto-update.</strong> You'll need to edit this value when it changes.
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-spend">Total spend amount</Label>
                <Input
                  id="manual-spend"
                  type="text"
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 1500.00"
                  className="max-w-xs"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We'll distribute this evenly across the current GA4 window ({props.dateRange || "30days"}).
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={processManual}
                  disabled={isProcessing || !manualAmount || isNaN(parseFloat(String(manualAmount).replace(/[$,]/g, "")))}
                >
                  {isProcessing ? "Saving..." : (isEditing ? "Update spend" : "Save spend")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(step === "csv_map" || step === "sheets_map") && (
          <div className="space-y-6">
            {step === "csv_map" && !csvPreview?.success ? (
              <div className="rounded-lg border p-4 space-y-4">
                {csvEditNotice && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {csvEditNotice}
                  </div>
                )}
                {(spendColumn || campaignKeyColumn || campaignKeyValues.length > 0) && (
                  <div className="rounded-md bg-slate-50 dark:bg-slate-900 border p-3">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Current mapping</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Spend: <span className="font-medium">{spendColumn || "—"}</span>
                      {campaignKeyColumn ? (
                        <>
                          {" "}· Campaign: <span className="font-medium">{campaignKeyColumn}</span>
                        </>
                      ) : null}
                    </div>
                    {campaignKeyValues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {campaignKeyValues.slice(0, 6).map((v) => (
                          <span key={v} className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300">
                            {v}
                          </span>
                        ))}
                        {campaignKeyValues.length > 6 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border text-slate-500 dark:text-slate-400">
                            +{campaignKeyValues.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="csv-file-remap">Upload file (CSV)</Label>
                    {csvFile && (
                      <Button type="button" variant="outline" size="sm" onClick={clearCsvFile}>
                        Remove file
                      </Button>
                    )}
                  </div>
                  <Input
                    key={`csv-file-remap-${csvInputKey}`}
                    id="csv-file-remap"
                    type="file"
                    accept=".csv,text/csv"
                    className="cursor-pointer file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100 dark:hover:file:bg-slate-700"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Re-upload the CSV to preview rows, adjust columns, and re-process spend.
                  </p>
                </div>
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
                    <Button onClick={previewCsv} disabled={!csvFile || isCsvPreviewing}>
                      {isCsvPreviewing ? "Previewing..." : "Preview"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Columns</div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Spend: <span className="font-medium">{spendColumn || "—"}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      We’ll treat imported spend as a total and distribute it evenly across the current GA4 window ({props.dateRange || "30days"}).
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setShowColumnMapping((v) => !v)}>
                    {showColumnMapping ? "Hide" : "Edit"} columns
                  </Button>
                </div>

                {showColumnMapping && (
                  <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Spend column</Label>
                      <Select value={spendColumn} onValueChange={setSpendColumn}>
                        <SelectTrigger><SelectValue placeholder="Select spend column" /></SelectTrigger>
                        <SelectContent className="z-[10000]">
                          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Campaign mapping (only if this dataset includes multiple campaigns)</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      If this file/tab is already scoped to this campaign, leave these blank. Otherwise select the identifier column (Campaign ID or Campaign Name) and the value(s) for this campaign.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Campaign identifier for multi-campaign datasets</Label>
                      <Select
                        value={campaignKeyColumn || CAMPAIGN_COL_NONE}
                        onValueChange={(v) => {
                          campaignKeyTouchedRef.current = true;
                          setCampaignKeyColumn(v === CAMPAIGN_COL_NONE ? "" : v);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Search values..." /></SelectTrigger>
                        <SelectContent className="z-[10000]">
                          <SelectItem value={CAMPAIGN_COL_NONE}>Search values...</SelectItem>
                          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Campaign value(s)</Label>
                      <Input
                        value={campaignKeySearch}
                        onChange={(e) => setCampaignKeySearch(e.target.value)}
                        placeholder="Search values…"
                        disabled={!effectiveCampaignColumn}
                      />
                      <div className="rounded-md border max-h-48 overflow-y-auto p-2 space-y-2">
                        {!effectiveCampaignColumn ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">Upload/preview data to see campaign values.</div>
                        ) : uniqueCampaignKeyValues.length === 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">No values found in the preview.</div>
                        ) : (
                          uniqueCampaignKeyValues.map((val) => (
                            <div key={val} className="flex items-start gap-2">
                              <Checkbox
                                checked={campaignKeyValues.includes(val)}
                                onCheckedChange={(checked) => {
                                  const next = Boolean(checked);
                                  setCampaignKeyValues((prev) => {
                                    if (next) return prev.includes(val) ? prev : [...prev, val];
                                    return prev.filter((x) => x !== val);
                                  });
                                }}
                              />
                              <div className="text-sm text-slate-700 dark:text-slate-300">{val}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium mb-3">Preview (first {Math.min(previewRows.length, 5)} rows)</div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {headers.slice(0, 6).map((h) => (
                          <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 5).map((r, idx) => (
                        <tr key={idx} className="border-b last:border-b-0">
                          {headers.slice(0, 6).map((h) => (
                            <td key={h} className="py-2 pr-4 text-slate-700 dark:text-slate-300">{String((r as any)[h] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Processing will automatically **sum spend by day**, so unaggregated rows are OK.
                </p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("select")} disabled={isProcessing}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
                <Button onClick={step === "csv_map" ? processCsv : processSheets} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : (isEditing ? "Update spend" : "Import spend")}
                </Button>
              </div>
            </div>
          </div>
        )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



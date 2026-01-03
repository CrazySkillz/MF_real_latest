import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import { Loader2 } from "lucide-react";

type SpendSourceMode = "google_sheets" | "upload" | "paste" | "manual";

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
  initialSource?: { id?: string; sourceType?: string; mappingConfig?: string | null; displayName?: string | null };
  onProcessed?: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"choose" | "csv_map" | "sheets_pick" | "sheets_map">("choose");
  const [mode, setMode] = useState<SpendSourceMode>("upload");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [isCsvPreviewing, setIsCsvPreviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pasteText, setPasteText] = useState<string>("");
  const [showSheetsConnect, setShowSheetsConnect] = useState(false);

  const [dateColumn, setDateColumn] = useState<string>("");
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

  const prefillKeyRef = useRef<string | null>(null);
  const suppressCampaignResetRef = useRef(false);
  const [autoPreviewSheetOnOpen, setAutoPreviewSheetOnOpen] = useState(false);
  const [isEditPrefillLoading, setIsEditPrefillLoading] = useState(false);
  const [csvPrefillMapping, setCsvPrefillMapping] = useState<any>(null);
  const [csvEditNotice, setCsvEditNotice] = useState<string>("");

  useEffect(() => {
    if (!props.open) {
      prefillKeyRef.current = null;
      setStep("choose");
      setMode("upload");
      setCsvFile(null);
      setCsvPreview(null);
      setIsCsvPreviewing(false);
      setIsProcessing(false);
      setDateColumn("");
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
    const mapDate = mapping?.dateColumn ? String(mapping.dateColumn) : "";
    const mapSpend = mapping?.spendColumn ? String(mapping.spendColumn) : "";
    const mapCampaignCol = mapping?.campaignColumn ? String(mapping.campaignColumn) : "";
    const mapCampaignVals = Array.isArray(mapping?.campaignValues)
      ? mapping.campaignValues.map((v: any) => String(v ?? "").trim()).filter((v: string) => !!v)
      : (mapping?.campaignValue ? [String(mapping.campaignValue).trim()] : []);

    if (sourceType === "google_sheets") {
      setMode("google_sheets");
      setStep("choose");
      if (mapDate) setDateColumn(mapDate);
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
      } else {
        // If we don't know the connection id, user can re-select in the sheet picker.
        setShowSheetsConnect(false);
      }
      return;
    }

    if (sourceType === "csv") {
      // CSV cannot be reprocessed without re-uploading the file. Prefill mappings after upload/preview.
      setMode("upload");
      setStep("choose");
      setCsvPrefillMapping(mapping);
      setCsvEditNotice("To edit a CSV import, please re-upload the same (or updated) file. We'll prefill the mappings once it’s previewed.");
      if (mapCampaignCol) {
        suppressCampaignResetRef.current = true;
        setCampaignKeyColumn(mapCampaignCol);
      }
      if (mapCampaignVals.length) setCampaignKeyValues(mapCampaignVals);
      if (mapDate) setDateColumn(mapDate);
      if (mapSpend) setSpendColumn(mapSpend);
      return;
    }

    if (sourceType === "manual") {
      setMode("manual");
      setStep("choose");
      return;
    }
  }, [props.open, props.initialSource]);

  useEffect(() => {
    if (!props.open) return;
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${props.campaignId}/google-sheets-connections`);
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
  }, [props.open, props.campaignId]);

  const headers = csvPreview?.headers || [];
  const sampleRows = csvPreview?.sampleRows || [];

  const uniqueCampaignKeyValues = useMemo(() => {
    if (!campaignKeyColumn) return [];
    const set = new Set<string>();
    for (const r of sampleRows) {
      const v = String((r as any)[campaignKeyColumn] ?? "").trim();
      if (v) set.add(v);
    }
    const all = Array.from(set);
    const q = campaignKeySearch.trim().toLowerCase();
    const filtered = q ? all.filter((x) => x.toLowerCase().includes(q)) : all;
    return filtered.slice(0, 200);
  }, [campaignKeyColumn, sampleRows, campaignKeySearch]);

  const inferredDateColumn = useMemo(() => {
    if (!headers.length) return "";
    const lc = headers.map((h) => ({ h, l: h.toLowerCase() }));
    return lc.find((x) => x.l === "date" || x.l.includes("date"))?.h || "";
  }, [headers]);

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

  useEffect(() => {
    if (!csvPreview?.success) return;
    if (!dateColumn && inferredDateColumn) setDateColumn(inferredDateColumn);
    if (!spendColumn && inferredSpendColumn) setSpendColumn(inferredSpendColumn);
    // Auto-suggest campaign identifier column so values are immediately visible/selectable (no selection required).
    if (!campaignKeyColumn && inferredCampaignColumn) setCampaignKeyColumn(inferredCampaignColumn);
  }, [csvPreview, inferredDateColumn, inferredSpendColumn, dateColumn, spendColumn]);

  // If we are editing a CSV spend source and the user re-uploads a file, try to apply the saved mapping.
  useEffect(() => {
    if (!csvPreview?.success) return;
    if (!csvPrefillMapping) return;
    const mapDate = csvPrefillMapping?.dateColumn ? String(csvPrefillMapping.dateColumn) : "";
    const mapSpend = csvPrefillMapping?.spendColumn ? String(csvPrefillMapping.spendColumn) : "";
    const mapCampaignCol = csvPrefillMapping?.campaignColumn ? String(csvPrefillMapping.campaignColumn) : "";
    if (mapDate && headers.includes(mapDate)) setDateColumn(mapDate);
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
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview sheet");
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
      const resp = await fetch(`/api/campaigns/${props.campaignId}/google-sheets-connections`);
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
      setStep("choose");
      // Stay on the Google Sheets view, but don't force the connect flow open.
      // We'll show a lightweight empty state with a Connect button instead.
      if (!filtered || filtered.length === 0) setShowSheetsConnect(false);
      toast({ title: "Google Sheet removed", description: "You can now upload a CSV or connect a different sheet." });
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
    if (mode !== "google_sheets") return;
    if (!selectedSheetConnectionId) return;
    setAutoPreviewSheetOnOpen(false);
    // Fire and forget; it will set step to sheets_map.
    previewSheet().finally(() => setIsEditPrefillLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, autoPreviewSheetOnOpen, mode, selectedSheetConnectionId]);

  const processCsv = async () => {
    if (!csvFile) return;
    if (!dateColumn || !spendColumn) {
      toast({ title: "Missing mappings", description: "Select both Date and Spend columns.", variant: "destructive" });
      return;
    }
    if ((campaignKeyColumn && campaignKeyValues.length === 0) || (!campaignKeyColumn && campaignKeyValues.length > 0)) {
      toast({ title: "Campaign mapping incomplete", description: "Select a campaign identifier column and at least one value (or leave both empty).", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const hasCampaignScope = !!campaignKeyColumn && campaignKeyValues.length > 0;
      const mapping = {
        displayName: csvFile.name,
        dateColumn,
        spendColumn,
        campaignColumn: hasCampaignScope ? campaignKeyColumn : null,
        campaignValue: hasCampaignScope && campaignKeyValues.length === 1 ? campaignKeyValues[0] : null,
        campaignValues: hasCampaignScope ? campaignKeyValues : null,
        currency: props.currency || "USD",
      };
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(mapping));
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/csv/process`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process spend");

      toast({
        title: "Spend processed",
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
    if (!dateColumn || !spendColumn) {
      toast({ title: "Missing mappings", description: "Select both Date and Spend columns.", variant: "destructive" });
      return;
    }
    if ((campaignKeyColumn && campaignKeyValues.length === 0) || (!campaignKeyColumn && campaignKeyValues.length > 0)) {
      toast({ title: "Campaign mapping incomplete", description: "Select a campaign identifier column and at least one value (or leave both empty).", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const hasCampaignScope = !!campaignKeyColumn && campaignKeyValues.length > 0;
      const mapping = {
        displayName: (sheetsPreview?.spreadsheetName ? `${sheetsPreview.spreadsheetName}${sheetsPreview.sheetName ? ` (${sheetsPreview.sheetName})` : ""}` : "Google Sheets spend"),
        dateColumn,
        spendColumn,
        campaignColumn: hasCampaignScope ? campaignKeyColumn : null,
        campaignValue: hasCampaignScope && campaignKeyValues.length === 1 ? campaignKeyValues[0] : null,
        campaignValues: hasCampaignScope ? campaignKeyValues : null,
        currency: props.currency || "USD",
      };
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/sheets/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedSheetConnectionId, mapping }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process spend");
      toast({
        title: "Spend processed",
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
        body: JSON.stringify({ amount, currency: props.currency || "USD" }),
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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add spend</DialogTitle>
          <DialogDescription>
            Import spend for this MetricMind campaign. If your dataset includes multiple campaigns, you can filter it to the right one.
          </DialogDescription>
        </DialogHeader>

        {isEditPrefillLoading ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your sheet preview…
            </div>
          </div>
        ) : null}

        {!isEditPrefillLoading && step === "choose" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Import spend dataset (recommended)</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={mode === "paste" ? "default" : "outline"} onClick={() => setMode("paste")}>
                  Paste table (Excel / Sheets)
                </Button>
                <Button type="button" variant={mode === "google_sheets" ? "default" : "outline"} onClick={() => setMode("google_sheets")}>
                  Google Sheets
                </Button>
                <Button type="button" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}>
                  Upload file (CSV)
                </Button>
                <Button type="button" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
                  Manual
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These options work for spend exports from any platform (Google Ads, TikTok, X, DV360, Amazon, etc.).
              </p>
            </div>
            {mode === "google_sheets" && (
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
              </div>
            )}

            {mode === "upload" && (
              <div className="rounded-lg border p-4 space-y-4">
                {csvEditNotice && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {csvEditNotice}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Upload file (CSV)</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Required columns: Date + Spend. Optional: Campaign (for multi-campaign files).
                  </p>
                </div>
              </div>
            )}

            {mode === "paste" && (
              <div className="rounded-lg border p-4 space-y-4">
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
              </div>
            )}

            {mode === "manual" && (
              <div className="rounded-lg border p-4 space-y-2">
                <Label htmlFor="manual-amount">Spend amount ({props.currency || "USD"})</Label>
                <Input
                  id="manual-amount"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g., 2500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This saves a spend record for today. (Best for quick testing; CSV is best for daily spend.)
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              {mode === "upload" && (
                <Button onClick={previewCsv} disabled={!csvFile || isCsvPreviewing}>
                  {isCsvPreviewing ? "Previewing..." : "Next"}
                </Button>
              )}
              {mode === "paste" && (
                <Button onClick={previewPaste} disabled={!pasteText.trim() || isCsvPreviewing}>
                  {isCsvPreviewing ? "Previewing..." : "Next"}
                </Button>
              )}
              {mode === "google_sheets" && (
                <Button onClick={previewSheet} disabled={!selectedSheetConnectionId || isSheetsLoading}>
                  {isSheetsLoading ? "Loading..." : "Next"}
                </Button>
              )}
              {mode === "manual" && (
                <Button onClick={processManual} disabled={isProcessing}>
                  {isProcessing ? "Saving..." : "Process spend"}
                </Button>
              )}
            </div>
          </div>
        )}

        {(step === "csv_map" || step === "sheets_map") && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Columns</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    Date: <span className="font-medium">{dateColumn || "—"}</span> · Spend: <span className="font-medium">{spendColumn || "—"}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    We’ll automatically sum spend by day.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setShowColumnMapping((v) => !v)}>
                  {showColumnMapping ? "Hide" : "Edit"} columns
                </Button>
              </div>

              {showColumnMapping && (
                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Date column</Label>
                    <Select value={dateColumn} onValueChange={setDateColumn}>
                      <SelectTrigger><SelectValue placeholder="Select date column" /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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
                      onValueChange={(v) => setCampaignKeyColumn(v === CAMPAIGN_COL_NONE ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Leave blank if not needed" /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value={CAMPAIGN_COL_NONE}>(leave blank)</SelectItem>
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
                      disabled={!campaignKeyColumn}
                    />
                    <div className="rounded-md border max-h-48 overflow-y-auto p-2 space-y-2">
                      {!campaignKeyColumn ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">Select an identifier column to see values.</div>
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
                    {campaignKeyValues.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Selected {campaignKeyValues.length} value{campaignKeyValues.length === 1 ? "" : "s"}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {sampleRows.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium mb-3">Preview (first {Math.min(sampleRows.length, 5)} rows)</div>
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
                      {sampleRows.slice(0, 5).map((r, idx) => (
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
              <Button variant="outline" onClick={() => setStep("choose")} disabled={isProcessing}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
                <Button onClick={step === "csv_map" ? processCsv : processSheets} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Process spend"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



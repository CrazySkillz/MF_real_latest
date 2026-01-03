import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import { LinkedInConnectionFlow } from "@/components/LinkedInConnectionFlow";
import { SimpleMetaAuth } from "@/components/SimpleMetaAuth";

type SpendSourceMode = "ad_platforms" | "google_sheets" | "upload" | "paste" | "manual";

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
  // Optional ad-platform spend values (already fetched by parent)
  platformSpend?: {
    linkedin?: number;
    meta?: number;
    custom?: number;
    total?: number;
  };
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
  const [showPlatformConnect, setShowPlatformConnect] = useState<null | "linkedin" | "meta">(null);

  const [dateColumn, setDateColumn] = useState<string>("");
  const [spendColumn, setSpendColumn] = useState<string>("");
  const [campaignColumn, setCampaignColumn] = useState<string>("");
  const [campaignValue, setCampaignValue] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  const [manualAmount, setManualAmount] = useState<string>("");

  const [sheetsConnections, setSheetsConnections] = useState<Array<any>>([]);
  const [selectedSheetConnectionId, setSelectedSheetConnectionId] = useState<string>("");
  const [sheetsPreview, setSheetsPreview] = useState<any>(null);
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);

  useEffect(() => {
    if (!props.open) {
      setStep("choose");
      setMode("upload");
      setCsvFile(null);
      setCsvPreview(null);
      setIsCsvPreviewing(false);
      setIsProcessing(false);
      setDateColumn("");
      setSpendColumn("");
      setCampaignColumn("");
      setCampaignValue("");
      setDisplayName("");
      setManualAmount("");
      setPasteText("");
      setShowSheetsConnect(false);
      setShowPlatformConnect(null);
      setSheetsConnections([]);
      setSelectedSheetConnectionId("");
      setSheetsPreview(null);
      setIsSheetsLoading(false);
    }
  }, [props.open]);

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

  const uniqueCampaignValues = useMemo(() => {
    if (!campaignColumn) return [];
    const set = new Set<string>();
    for (const r of sampleRows) {
      const v = String((r as any)[campaignColumn] ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).slice(0, 50);
  }, [campaignColumn, sampleRows]);

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

  useEffect(() => {
    if (!csvPreview?.success) return;
    if (!dateColumn && inferredDateColumn) setDateColumn(inferredDateColumn);
    if (!spendColumn && inferredSpendColumn) setSpendColumn(inferredSpendColumn);
    if (!displayName && csvPreview.fileName) setDisplayName(csvPreview.fileName);
  }, [csvPreview, inferredDateColumn, inferredSpendColumn, dateColumn, spendColumn, displayName]);

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

  const processCsv = async () => {
    if (!csvFile) return;
    if (!dateColumn || !spendColumn) {
      toast({ title: "Missing mappings", description: "Select both Date and Spend columns.", variant: "destructive" });
      return;
    }
    if (campaignColumn && !campaignValue) {
      toast({ title: "Campaign value required", description: "Pick which campaign value to use for this MetricMind campaign.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const mapping = {
        displayName: displayName || csvFile.name,
        dateColumn,
        spendColumn,
        campaignColumn: campaignColumn || null,
        campaignValue: campaignValue || null,
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
    if (campaignColumn && !campaignValue) {
      toast({ title: "Campaign value required", description: "Pick which campaign value to use for this MetricMind campaign.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const mapping = {
        displayName: displayName || (sheetsPreview?.spreadsheetName ? `${sheetsPreview.spreadsheetName}${sheetsPreview.sheetName ? ` (${sheetsPreview.sheetName})` : ""}` : "Google Sheets spend"),
        dateColumn,
        spendColumn,
        campaignColumn: campaignColumn || null,
        campaignValue: campaignValue || null,
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

  const processAdPlatforms = async () => {
    const total = props.platformSpend?.total ?? 0;
    if (!(total > 0)) {
      toast({ title: "No platform spend detected", description: "Connect a platform or import spend via CSV/Manual.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const breakdown = {
        linkedin: props.platformSpend?.linkedin || 0,
        meta: props.platformSpend?.meta || 0,
        custom: props.platformSpend?.custom || 0,
      };
      const resp = await fetch(`/api/campaigns/${props.campaignId}/spend/process/ad-platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, currency: props.currency || "USD", breakdown }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save platform spend");
      toast({ title: "Spend saved", description: "Platform spend is now available for financial metrics." });
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add spend</DialogTitle>
          <DialogDescription>
            Import spend for this MetricMind campaign. If your dataset includes multiple campaigns, you can filter it to the right one.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Spend connectors (optional)</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connectors are optional. You can import spend from <span className="font-medium">any source</span> using Paste/Upload/Sheets below.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={processAdPlatforms}
                  disabled={isProcessing || !((props.platformSpend?.total ?? 0) > 0)}
                >
                  {isProcessing ? "Saving..." : "Use detected connector spend"}
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="text-sm">
                  LinkedIn: <span className="font-medium">{props.currency || "USD"} {(props.platformSpend?.linkedin || 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  Meta: <span className="font-medium">{props.currency || "USD"} {(props.platformSpend?.meta || 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  Custom connector: <span className="font-medium">{props.currency || "USD"} {(props.platformSpend?.custom || 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  Total: <span className="font-semibold">{props.currency || "USD"} {(props.platformSpend?.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setShowPlatformConnect("meta")}>
                  Connect Meta (test mode)
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowPlatformConnect("linkedin")}>
                  Connect LinkedIn
                </Button>
                <div className="text-xs text-slate-500 dark:text-slate-400 self-center">
                  More connectors can be added later; import works for any platform/export today.
                </div>
              </div>

              {showPlatformConnect === "meta" && (
                <div className="rounded-md border p-3">
                  <SimpleMetaAuth
                    campaignId={props.campaignId}
                    onSuccess={() => {
                      toast({ title: "Meta connected", description: "Re-open Add spend to use detected spend." });
                      props.onProcessed?.();
                      setShowPlatformConnect(null);
                    }}
                    onError={(err) => toast({ title: "Meta connect failed", description: err, variant: "destructive" })}
                  />
                </div>
              )}
              {showPlatformConnect === "linkedin" && (
                <div className="rounded-md border p-3">
                  <LinkedInConnectionFlow
                    campaignId={props.campaignId}
                    mode="new"
                    onConnectionSuccess={() => {
                      toast({ title: "LinkedIn connected", description: "Import a LinkedIn campaign to populate detected spend." });
                      props.onProcessed?.();
                      setShowPlatformConnect(null);
                    }}
                    onImportComplete={() => {
                      props.onProcessed?.();
                    }}
                  />
                </div>
              )}
            </div>

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
                {sheetsConnections.length === 0 || showSheetsConnect ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Connect Google Sheets</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No Sheets are connected to this campaign yet. Connect once, then we’ll let you pick a sheet/tab.
                    </p>
                    <SimpleGoogleSheetsAuth
                      campaignId={props.campaignId}
                      selectionMode="append"
                      onSuccess={async () => {
                        setShowSheetsConnect(false);
                        try {
                          const resp = await fetch(`/api/campaigns/${props.campaignId}/google-sheets-connections`);
                          const json = await resp.json().catch(() => null);
                          const conns = Array.isArray(json?.connections) ? json.connections : Array.isArray(json) ? json : [];
                          setSheetsConnections(conns.filter((c: any) => c && c.isActive !== false));
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
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowSheetsConnect(true)}>
                        Connect another
                      </Button>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g., Q1 Spend Export" />
                </div>
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
                <div className="space-y-2">
                  <Label>Campaign column (optional)</Label>
                  <Select value={campaignColumn} onValueChange={(v) => { setCampaignColumn(v); setCampaignValue(""); }}>
                    <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="">(none)</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {campaignColumn && (
                <div className="space-y-2">
                  <Label>Use rows where {campaignColumn} =</Label>
                  <Select value={campaignValue} onValueChange={setCampaignValue}>
                    <SelectTrigger><SelectValue placeholder="Select campaign value" /></SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {uniqueCampaignValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This is how multi-campaign files get scoped to this MetricMind campaign.
                  </p>
                </div>
              )}
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



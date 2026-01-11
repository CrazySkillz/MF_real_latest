import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, FileSpreadsheet, ShoppingCart, Upload, ArrowLeft } from "lucide-react";
import { HubSpotRevenueWizard } from "@/components/HubSpotRevenueWizard";
import { SalesforceRevenueWizard } from "@/components/SalesforceRevenueWizard";
import { ShopifyRevenueWizard } from "@/components/ShopifyRevenueWizard";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";

type Step = "select" | "manual" | "csv" | "sheets" | "hubspot" | "salesforce" | "shopify";
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
  onSuccess?: () => void;
}) {
  const { open, onOpenChange, campaignId, currency, dateRange, onSuccess } = props;
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select");

  // Manual
  const [manualAmount, setManualAmount] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Preview | null>(null);
  const [csvRevenueCol, setCsvRevenueCol] = useState<string>("");
  const [csvDateCol, setCsvDateCol] = useState<string>("");
  const [csvCampaignCol, setCsvCampaignCol] = useState<string>("");
  const [csvCampaignQuery, setCsvCampaignQuery] = useState<string>("");
  const [csvCampaignValues, setCsvCampaignValues] = useState<string[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);

  // Sheets
  const [sheetsConnections, setSheetsConnections] = useState<any[]>([]);
  const [sheetsConnectionId, setSheetsConnectionId] = useState<string>("");
  const [showSheetsConnect, setShowSheetsConnect] = useState(false);
  const [sheetsRemoving, setSheetsRemoving] = useState(false);
  const [sheetsPreview, setSheetsPreview] = useState<Preview | null>(null);
  const [sheetsRevenueCol, setSheetsRevenueCol] = useState<string>("");
  const [sheetsDateCol, setSheetsDateCol] = useState<string>("");
  const [sheetsCampaignCol, setSheetsCampaignCol] = useState<string>("");
  const [sheetsCampaignQuery, setSheetsCampaignQuery] = useState<string>("");
  const [sheetsCampaignValues, setSheetsCampaignValues] = useState<string[]>([]);
  const [sheetsProcessing, setSheetsProcessing] = useState(false);
  const [autoPreviewedSheetsConnectionId, setAutoPreviewedSheetsConnectionId] = useState<string>("");

  const resetAll = () => {
    setStep("select");
    setManualAmount("");
    setSavingManual(false);
    setCsvFile(null);
    setCsvPreview(null);
    setCsvRevenueCol("");
    setCsvDateCol("");
    setCsvCampaignCol("");
    setCsvCampaignQuery("");
    setCsvCampaignValues([]);
    setCsvProcessing(false);
    setSheetsConnectionId("");
    setShowSheetsConnect(false);
    setSheetsRemoving(false);
    setSheetsPreview(null);
    setSheetsRevenueCol("");
    setSheetsDateCol("");
    setSheetsCampaignCol("");
    setSheetsCampaignQuery("");
    setSheetsCampaignValues([]);
    setSheetsProcessing(false);
    setAutoPreviewedSheetsConnectionId("");
  };

  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load sheets connections only when needed
  useEffect(() => {
    let mounted = true;
    if (!open) return;
    if (step !== "sheets") return;
    (async () => {
      try {
        const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=revenue`);
        const json = await resp.json().catch(() => ({}));
        const conns = Array.isArray(json?.connections) ? json.connections : [];
        if (!mounted) return;
        setSheetsConnections(conns);
        if (!sheetsConnectionId && conns.length > 0) setSheetsConnectionId(String(conns[0]?.id || ""));
      } catch {
        if (!mounted) return;
        setSheetsConnections([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, step, campaignId, sheetsConnectionId]);

  // When entering the Sheets step (or when a default connection is auto-selected),
  // auto-load the preview so the flow feels continuous like Add Spend.
  useEffect(() => {
    if (!open) return;
    if (step !== "sheets") return;
    if (!sheetsConnectionId) return;
    if (sheetsPreview) return;
    if (sheetsProcessing) return;
    if (autoPreviewedSheetsConnectionId === sheetsConnectionId) return;
    setAutoPreviewedSheetsConnectionId(sheetsConnectionId);
    void handleSheetsPreview(sheetsConnectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, sheetsConnectionId, sheetsPreview, sheetsProcessing, autoPreviewedSheetsConnectionId]);

  const refreshSheetsConnections = async () => {
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections?purpose=revenue`);
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
      setSheetsDateCol("");
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
    setStep("select");
  };

  const handleManualSave = async () => {
    const clean = String(manualAmount || "").replace(/,/g, "").trim();
    const amt = Number(clean);
    if (!Number.isFinite(amt) || !(amt > 0)) {
      toast({ title: "Enter a valid amount", description: "Revenue must be > 0.", variant: "destructive" });
      return;
    }
    setSavingManual(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/process/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, currency, dateRange }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to save revenue");
      toast({ title: "Revenue saved", description: "Revenue will now be used when GA4 revenue is missing." });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  };

  const handleCsvPreview = async (file: File) => {
    setCsvProcessing(true);
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
      setCsvDateCol(headers.find((h) => /date/i.test(h)) || "");
      setCsvCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
      setCsvCampaignValues([]);
      setCsvCampaignQuery("");
    } catch (e: any) {
      toast({ title: "CSV preview failed", description: e?.message || "Please try again.", variant: "destructive" });
      setCsvPreview(null);
    } finally {
      setCsvProcessing(false);
    }
  };

  const handleCsvProcess = async () => {
    if (!csvFile) return;
    if (!csvRevenueCol) {
      toast({ title: "Select a revenue column", variant: "destructive" });
      return;
    }
    setCsvProcessing(true);
    try {
      const hasCampaignScope = !!csvCampaignCol && csvCampaignValues.length > 0;
      const mapping = {
        revenueColumn: csvRevenueCol,
        dateColumn: csvDateCol || null,
        campaignColumn: hasCampaignScope ? csvCampaignCol : null,
        campaignValue: hasCampaignScope && csvCampaignValues.length === 1 ? csvCampaignValues[0] : null,
        campaignValues: hasCampaignScope ? csvCampaignValues : null,
        currency,
        dateRange,
        displayName: csvFile.name,
      };
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(mapping));
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/csv/process`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process CSV");
      toast({ title: "Revenue imported", description: `Imported ${Number(json.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}.` });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "CSV import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCsvProcessing(false);
    }
  };

  const handleSheetsPreview = async (connectionIdOverride?: string) => {
    const cid = String(connectionIdOverride || sheetsConnectionId || "").trim();
    if (!cid) return;
    setSheetsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: cid }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview sheet");
      setSheetsPreview({ headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guess = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      setSheetsRevenueCol(guess);
      setSheetsDateCol(headers.find((h) => /date/i.test(h)) || "");
      setSheetsCampaignCol(headers.find((h) => /campaign/i.test(h)) || "");
      setSheetsCampaignValues([]);
      setSheetsCampaignQuery("");
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message || "Please try again.", variant: "destructive" });
      setSheetsPreview(null);
    } finally {
      setSheetsProcessing(false);
    }
  };

  const handleSheetsProcess = async () => {
    if (!sheetsConnectionId) return;
    if (!sheetsRevenueCol) {
      toast({ title: "Select a revenue column", variant: "destructive" });
      return;
    }
    setSheetsProcessing(true);
    try {
      const hasCampaignScope = !!sheetsCampaignCol && sheetsCampaignValues.length > 0;
      const mapping = {
        revenueColumn: sheetsRevenueCol,
        dateColumn: sheetsDateCol || null,
        campaignColumn: hasCampaignScope ? sheetsCampaignCol : null,
        campaignValue: hasCampaignScope && sheetsCampaignValues.length === 1 ? sheetsCampaignValues[0] : null,
        campaignValues: hasCampaignScope ? sheetsCampaignValues : null,
        currency,
        dateRange,
        displayName: "Google Sheets revenue",
      };
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnectionId, mapping }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to process sheet");
      toast({ title: "Revenue imported", description: `Imported ${Number(json.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}.` });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSheetsProcessing(false);
    }
  };

  const title = step === "select" ? "Add revenue source" :
    step === "manual" ? "Manual revenue" :
    step === "csv" ? "Upload CSV" :
    step === "sheets" ? "Google Sheets" :
    step === "hubspot" ? "HubSpot revenue" :
    step === "salesforce" ? "Salesforce revenue" :
    step === "shopify" ? "Shopify revenue" :
    "Add revenue source";

  const description = step === "select"
    ? "Choose where your revenue data comes from. This is used when GA4 revenue is missing."
    : `Currency: ${currency} • Date range: ${dateRange}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[980px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col">
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

          <div className="px-6 py-5">
            {step === "select" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("manual")}>
                  <CardHeader>
                    <CardTitle className="text-lg">Manual</CardTitle>
                    <CardDescription>Enter a total revenue amount for the selected date range.</CardDescription>
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

                <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setStep("sheets")}>
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
              <div className="max-w-xl space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Enter revenue</CardTitle>
                    <CardDescription>Total revenue for the selected date range (we distribute it across days).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Amount ({currency})</Label>
                      <Input
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleManualSave} disabled={savingManual}>
                        {savingManual ? "Saving…" : "Save revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "csv" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upload CSV</CardTitle>
                    <CardDescription>Choose a revenue column; date is optional.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setCsvFile(f);
                        setCsvPreview(null);
                        setCsvRevenueCol("");
                        setCsvDateCol("");
                        if (f) void handleCsvPreview(f);
                      }}
                    />

                    {csvPreview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Campaign column (optional)</Label>
                            <Select
                              value={csvCampaignCol || SELECT_NONE}
                              onValueChange={(v) => {
                                setCsvCampaignCol(v === SELECT_NONE ? "" : v);
                                setCsvCampaignValues([]);
                                setCsvCampaignQuery("");
                              }}
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
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              If your CSV contains multiple campaigns, select the campaign column and choose the value(s) to include.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label>Revenue column</Label>
                            <Select value={csvRevenueCol} onValueChange={setCsvRevenueCol}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select revenue column" />
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
                            <Label>Date column (optional)</Label>
                            <Select value={csvDateCol || SELECT_NONE} onValueChange={(v) => setCsvDateCol(v === SELECT_NONE ? "" : v)}>
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
                        </div>

                        {csvCampaignCol && (
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
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Leave empty to import revenue for all rows (no campaign filtering).
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleCsvProcess} disabled={!csvFile || csvProcessing}>
                        {csvProcessing ? "Processing…" : "Import revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "sheets" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Google Sheets</CardTitle>
                    <CardDescription>Pick a connected sheet and map the revenue column.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sheetsConnections.length === 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Connect Google Sheets</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Connect a Google Sheet and select the tab that contains your revenue data.
                        </p>
                        <SimpleGoogleSheetsAuth
                          campaignId={campaignId}
                          selectionMode="append"
                          purpose="revenue"
                          onSuccess={async (info) => {
                            setShowSheetsConnect(false);
                            const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                            if (preferredId) {
                              setSheetsConnectionId(preferredId);
                              // Match Add Spend flow: go straight into preview -> mapping after selecting sheet/tab(s)
                              await refreshSheetsConnections();
                              await handleSheetsPreview(preferredId);
                              toast({ title: "Google Sheets connected", description: "Now map your columns and import revenue." });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Now select a tab and preview it to map columns." });
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
                          purpose="revenue"
                          onSuccess={async (info) => {
                            setShowSheetsConnect(false);
                            const preferredId = String(info?.connectionId || info?.connectionIds?.[0] || "");
                            if (preferredId) {
                              setSheetsConnectionId(preferredId);
                              await refreshSheetsConnections();
                              await handleSheetsPreview(preferredId);
                              toast({ title: "Google Sheets connected", description: "Now map your columns and import revenue." });
                            } else {
                              await refreshSheetsConnections();
                              toast({ title: "Google Sheets connected", description: "Now select a tab and preview it to map columns." });
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
                            setSheetsDateCol("");
                            setSheetsCampaignCol("");
                            setSheetsCampaignQuery("");
                            setSheetsCampaignValues([]);
                            setAutoPreviewedSheetsConnectionId("");
                            // Match Add Spend flow: selecting a tab should immediately load preview/mapping.
                            void handleSheetsPreview(v);
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

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleSheetsPreview()}
                        disabled={!sheetsConnectionId || sheetsProcessing}
                      >
                        {sheetsProcessing ? "Loading…" : (sheetsPreview ? "Refresh preview" : "Preview")}
                      </Button>
                    </div>

                    {sheetsPreview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                            <Label>Revenue column</Label>
                            <Select value={sheetsRevenueCol} onValueChange={setSheetsRevenueCol}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select revenue column" />
                              </SelectTrigger>
                              <SelectContent className="z-[10000]">
                                {sheetsHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label>Date column (optional)</Label>
                          <Select value={sheetsDateCol || SELECT_NONE} onValueChange={(v) => setSheetsDateCol(v === SELECT_NONE ? "" : v)}>
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
                          </div>
                        </div>

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
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Leave empty to import revenue for all rows (no campaign filtering).
                            </p>
                          </div>
                        )}

                        {/* Preview table (same idea as Add Spend) */}
                        <div className="rounded-md border overflow-hidden">
                          <div className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border-b">
                            Preview (first {Math.min(8, sheetsPreview.sampleRows.length)} row{Math.min(8, sheetsPreview.sampleRows.length) === 1 ? "" : "s"})
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
                                {(sheetsPreview.sampleRows || []).slice(0, 8).map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0">
                                    {(sheetsPreview.headers || []).slice(0, 8).map((h) => (
                                      <td key={h} className="p-2 text-xs text-slate-700 dark:text-slate-200 truncate">
                                        {String((row as any)?.[h] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(sheetsPreview.sampleRows || []).length === 0 && (
                                  <tr>
                                    <td className="p-3 text-sm text-slate-500 dark:text-slate-400" colSpan={8}>
                                      No rows found in this sheet/tab.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleSheetsProcess} disabled={!sheetsPreview || sheetsProcessing || !sheetsRevenueCol}>
                        {sheetsProcessing ? "Processing…" : "Import revenue"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "hubspot" && (
              <div className="max-w-4xl">
                <HubSpotRevenueWizard
                  campaignId={campaignId}
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}

            {step === "salesforce" && (
              <div className="max-w-4xl">
                <SalesforceRevenueWizard
                  campaignId={campaignId}
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}

            {step === "shopify" && (
              <div className="max-w-4xl">
                <ShopifyRevenueWizard
                  campaignId={campaignId}
                  onBack={() => setStep("select")}
                  onClose={() => setStep("select")}
                  onSuccess={() => {
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



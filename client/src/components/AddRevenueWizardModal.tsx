import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, FileSpreadsheet, ShoppingCart, Upload, ArrowLeft } from "lucide-react";
import { HubSpotRevenueWizard } from "@/components/HubSpotRevenueWizard";
import { SalesforceRevenueWizard } from "@/components/SalesforceRevenueWizard";
import { ShopifyRevenueWizard } from "@/components/ShopifyRevenueWizard";

type Step = "select" | "manual" | "csv" | "sheets" | "hubspot" | "salesforce" | "shopify";

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
  const [csvProcessing, setCsvProcessing] = useState(false);

  // Sheets
  const [sheetsConnections, setSheetsConnections] = useState<any[]>([]);
  const [sheetsConnectionId, setSheetsConnectionId] = useState<string>("");
  const [sheetsPreview, setSheetsPreview] = useState<Preview | null>(null);
  const [sheetsRevenueCol, setSheetsRevenueCol] = useState<string>("");
  const [sheetsDateCol, setSheetsDateCol] = useState<string>("");
  const [sheetsProcessing, setSheetsProcessing] = useState(false);

  const resetAll = () => {
    setStep("select");
    setManualAmount("");
    setSavingManual(false);
    setCsvFile(null);
    setCsvPreview(null);
    setCsvRevenueCol("");
    setCsvDateCol("");
    setCsvProcessing(false);
    setSheetsConnectionId("");
    setSheetsPreview(null);
    setSheetsRevenueCol("");
    setSheetsDateCol("");
    setSheetsProcessing(false);
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
        const resp = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`);
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

  const csvHeaders = useMemo(() => csvPreview?.headers || [], [csvPreview]);
  const sheetsHeaders = useMemo(() => sheetsPreview?.headers || [], [sheetsPreview]);

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
      const mapping = {
        revenueColumn: csvRevenueCol,
        dateColumn: csvDateCol || null,
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

  const handleSheetsPreview = async () => {
    if (!sheetsConnectionId) return;
    setSheetsProcessing(true);
    try {
      const resp = await fetch(`/api/campaigns/${campaignId}/revenue/sheets/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnectionId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.error || "Failed to preview sheet");
      setSheetsPreview({ headers: json.headers || [], sampleRows: json.sampleRows || [], rowCount: json.rowCount || 0 });
      const headers: string[] = Array.isArray(json.headers) ? json.headers : [];
      const guess = headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "";
      setSheetsRevenueCol(guess);
      setSheetsDateCol(headers.find((h) => /date/i.test(h)) || "");
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
      const mapping = {
        revenueColumn: sheetsRevenueCol,
        dateColumn: sheetsDateCol || null,
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
      <DialogContent className="w-[980px] max-w-[95vw] h-[80vh] max-h-[80vh] overflow-hidden p-0">
        <div className="flex h-full flex-col">
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

          <div className="flex-1 overflow-y-auto px-6 py-5">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Revenue column</Label>
                          <Select value={csvRevenueCol} onValueChange={setCsvRevenueCol}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select revenue column" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              {csvHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Date column (optional)</Label>
                          <Select value={csvDateCol} onValueChange={setCsvDateCol}>
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              <SelectItem value="">None</SelectItem>
                              {csvHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                    <div className="space-y-1">
                      <Label>Sheet connection</Label>
                      <Select value={sheetsConnectionId} onValueChange={(v) => {
                        setSheetsConnectionId(v);
                        setSheetsPreview(null);
                        setSheetsRevenueCol("");
                        setSheetsDateCol("");
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a sheet" />
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
                      {sheetsConnections.length === 0 && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          No Google Sheets connections found for this campaign.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => void handleSheetsPreview()} disabled={!sheetsConnectionId || sheetsProcessing}>
                        {sheetsProcessing ? "Loading…" : "Preview"}
                      </Button>
                    </div>

                    {sheetsPreview && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Revenue column</Label>
                          <Select value={sheetsRevenueCol} onValueChange={setSheetsRevenueCol}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select revenue column" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              {sheetsHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Date column (optional)</Label>
                          <Select value={sheetsDateCol} onValueChange={setSheetsDateCol}>
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              <SelectItem value="">None</SelectItem>
                              {sheetsHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setStep("select")}>
                        Cancel
                      </Button>
                      <Button onClick={handleSheetsProcess} disabled={!sheetsPreview || sheetsProcessing}>
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



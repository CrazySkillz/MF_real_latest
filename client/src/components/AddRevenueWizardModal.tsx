import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet } from "lucide-react";

type DateRange = "7days" | "30days" | "90days";

type CsvPreview = {
  fileName: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
};

export function AddRevenueWizardModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignCurrency: string;
  dateRange: DateRange;
  googleSheetsConnections?: Array<{ id: string; spreadsheetName?: string | null; sheetName?: string | null }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<"manual" | "csv" | "sheets">("manual");

  // Manual
  const [manualAmount, setManualAmount] = useState<string>("");

  // CSV
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvRevenueColumn, setCsvRevenueColumn] = useState<string>("");
  const [csvDateColumn, setCsvDateColumn] = useState<string>("");
  const [csvDisplayName, setCsvDisplayName] = useState<string>("");
  const [csvIsLoading, setCsvIsLoading] = useState<boolean>(false);
  const csvHeaders = csvPreview?.headers || [];

  // Sheets
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [sheetPreview, setSheetPreview] = useState<CsvPreview | null>(null);
  const [sheetRevenueColumn, setSheetRevenueColumn] = useState<string>("");
  const [sheetDateColumn, setSheetDateColumn] = useState<string>("");
  const [sheetDisplayName, setSheetDisplayName] = useState<string>("");
  const [sheetIsLoading, setSheetIsLoading] = useState<boolean>(false);
  const sheetHeaders = sheetPreview?.headers || [];

  const closeAndReset = () => {
    setActiveTab("manual");
    setManualAmount("");

    setCsvPreview(null);
    setCsvRevenueColumn("");
    setCsvDateColumn("");
    setCsvDisplayName("");
    setCsvIsLoading(false);

    setSelectedConnectionId("");
    setSheetPreview(null);
    setSheetRevenueColumn("");
    setSheetDateColumn("");
    setSheetDisplayName("");
    setSheetIsLoading(false);

    props.onOpenChange(false);
  };

  const currency = props.campaignCurrency || "USD";

  const hasSheetsConnections = (props.googleSheetsConnections || []).length > 0;
  const sheetsLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of props.googleSheetsConnections || []) {
      const label = `${c.spreadsheetName || "Google Sheet"}${c.sheetName ? ` (${c.sheetName})` : ""}`;
      map.set(String(c.id), label);
    }
    return map;
  }, [props.googleSheetsConnections]);

  const refreshRevenue = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", props.campaignId, "revenue-totals"], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", props.campaignId, "revenue-sources"], exact: false }),
    ]);
  };

  const onSaveManual = async () => {
    const amt = Number(String(manualAmount || "").replace(/,/g, "").trim());
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter revenue amount", description: "Amount must be greater than 0.", variant: "destructive" });
      return;
    }
    const resp = await fetch(`/api/campaigns/${props.campaignId}/revenue/process/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, currency, dateRange: props.dateRange }),
    });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok || json?.success === false) {
      toast({ title: "Failed to save revenue", description: json?.error || "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Revenue added", description: "Manual revenue was saved for the selected date range." });
    await refreshRevenue();
    closeAndReset();
  };

  const onPickCsv = () => fileRef.current?.click();

  const onPreviewCsv = async (file: File) => {
    try {
      setCsvIsLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/campaigns/${props.campaignId}/revenue/csv/preview`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Failed to preview CSV");
      setCsvPreview({
        fileName: String(json.fileName || file.name),
        headers: Array.isArray(json.headers) ? json.headers : [],
        sampleRows: Array.isArray(json.sampleRows) ? json.sampleRows : [],
        rowCount: Number(json.rowCount || 0),
      });
      setCsvDisplayName(String(json.fileName || file.name));
      setCsvRevenueColumn("");
      setCsvDateColumn("");
    } catch (e: any) {
      toast({ title: "CSV preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCsvIsLoading(false);
    }
  };

  const onProcessCsv = async () => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file || !csvPreview) {
      toast({ title: "Upload a CSV", description: "Please choose a CSV file first.", variant: "destructive" });
      return;
    }
    if (!csvRevenueColumn) {
      toast({ title: "Select Revenue column", description: "Choose which column contains revenue values.", variant: "destructive" });
      return;
    }

    try {
      setCsvIsLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "mapping",
        JSON.stringify({
          revenueColumn: csvRevenueColumn,
          dateColumn: csvDateColumn || null,
          displayName: csvDisplayName || csvPreview.fileName,
          currency,
          dateRange: props.dateRange,
        })
      );
      const resp = await fetch(`/api/campaigns/${props.campaignId}/revenue/csv/process`, { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Failed to process CSV");
      toast({ title: "Revenue imported", description: `Imported ${currency} ${Number(json.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` });
      await refreshRevenue();
      closeAndReset();
    } catch (e: any) {
      toast({ title: "CSV import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCsvIsLoading(false);
    }
  };

  const onPreviewSheet = async () => {
    if (!selectedConnectionId) {
      toast({ title: "Select a Google Sheet", description: "Choose which connected sheet to use.", variant: "destructive" });
      return;
    }
    try {
      setSheetIsLoading(true);
      const resp = await fetch(`/api/campaigns/${props.campaignId}/revenue/sheets/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedConnectionId }),
      });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Failed to preview sheet");
      setSheetPreview({
        fileName: sheetsLabelById.get(selectedConnectionId) || "Google Sheet",
        headers: Array.isArray(json.headers) ? json.headers : [],
        sampleRows: Array.isArray(json.sampleRows) ? json.sampleRows : [],
        rowCount: Number(json.rowCount || 0),
      });
      setSheetDisplayName(sheetsLabelById.get(selectedConnectionId) || "Google Sheet");
      setSheetRevenueColumn("");
      setSheetDateColumn("");
    } catch (e: any) {
      toast({ title: "Sheet preview failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSheetIsLoading(false);
    }
  };

  const onProcessSheet = async () => {
    if (!selectedConnectionId || !sheetPreview) {
      toast({ title: "Preview your sheet first", description: "Select a sheet and click Preview.", variant: "destructive" });
      return;
    }
    if (!sheetRevenueColumn) {
      toast({ title: "Select Revenue column", description: "Choose which column contains revenue values.", variant: "destructive" });
      return;
    }
    try {
      setSheetIsLoading(true);
      const resp = await fetch(`/api/campaigns/${props.campaignId}/revenue/sheets/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          mapping: {
            revenueColumn: sheetRevenueColumn,
            dateColumn: sheetDateColumn || null,
            displayName: sheetDisplayName || sheetPreview.fileName,
            currency,
            dateRange: props.dateRange,
          },
        }),
      });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.success === false) throw new Error(json?.error || "Failed to process sheet");
      toast({ title: "Revenue imported", description: `Imported ${currency} ${Number(json.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` });
      await refreshRevenue();
      closeAndReset();
    } catch (e: any) {
      toast({ title: "Sheet import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSheetIsLoading(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => (o ? props.onOpenChange(true) : closeAndReset())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle>Add Revenue Source</DialogTitle>
          <DialogDescription>
            Use this when GA4 revenue is missing. Revenue will be summed for the selected date range ({props.dateRange}).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-2">
                  <Label>Revenue total ({currency})</Label>
                  <Input
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="Enter total revenue for the selected date range"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Note: manual revenue is allocated evenly across the selected date range so totals match the window.
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => closeAndReset()}>
                    Cancel
                  </Button>
                  <Button onClick={onSaveManual}>Save revenue</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv">
            <Card>
              <CardContent className="p-6 space-y-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPreviewCsv(f);
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Upload a CSV with at least a revenue column (and ideally a date column).
                  </div>
                  <Button variant="outline" onClick={onPickCsv} disabled={csvIsLoading}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose CSV
                  </Button>
                </div>

                {csvPreview ? (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Display name</Label>
                      <Input value={csvDisplayName} onChange={(e) => setCsvDisplayName(e.target.value)} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Revenue column</Label>
                        <Select value={csvRevenueColumn} onValueChange={setCsvRevenueColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {csvHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Date column (optional)</Label>
                        <Select value={csvDateColumn} onValueChange={setCsvDateColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select column (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No date column</SelectItem>
                            {csvHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          If you omit a date column, we allocate revenue evenly across the selected date range.
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCsvPreview(null)} disabled={csvIsLoading}>
                        Remove file
                      </Button>
                      <Button onClick={onProcessCsv} disabled={csvIsLoading}>
                        Import revenue
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No CSV selected.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sheets">
            <Card>
              <CardContent className="p-6 space-y-4">
                {!hasSheetsConnections ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    No Google Sheets connections found for this campaign. Connect Google Sheets first.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label>Connected sheet</Label>
                      <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a connected sheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {(props.googleSheetsConnections || []).map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>
                              {sheetsLabelById.get(String(c.id)) || String(c.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="outline" onClick={onPreviewSheet} disabled={sheetIsLoading || !selectedConnectionId}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                    </div>

                    {sheetPreview ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>Display name</Label>
                          <Input value={sheetDisplayName} onChange={(e) => setSheetDisplayName(e.target.value)} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Revenue column</Label>
                            <Select value={sheetRevenueColumn} onValueChange={setSheetRevenueColumn}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                {sheetHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>Date column (optional)</Label>
                            <Select value={sheetDateColumn} onValueChange={setSheetDateColumn}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select column (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">No date column</SelectItem>
                                {sheetHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              If you omit a date column, we allocate revenue evenly across the selected date range.
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setSheetPreview(null)} disabled={sheetIsLoading}>
                            Clear preview
                          </Button>
                          <Button onClick={onProcessSheet} disabled={sheetIsLoading}>
                            Import revenue
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}



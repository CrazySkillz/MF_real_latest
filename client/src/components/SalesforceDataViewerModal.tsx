import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type SalesforceField = { name: string; label?: string };

export function SalesforceDataViewerModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  sourceId: string | null;
}) {
  const { open, onOpenChange, campaignId, sourceId } = props;
  const [search, setSearch] = useState("");
  const [columns, setColumns] = useState<string[]>(["Name", "StageName", "CloseDate", "Amount"]);

  const { data: fieldsData, isLoading: fieldsLoading, error: fieldsError } = useQuery({
    queryKey: ["/api/salesforce", campaignId, "opportunities", "fields"],
    enabled: open && !!campaignId,
    queryFn: async () => {
      const resp = await fetch(`/api/salesforce/${campaignId}/opportunities/fields`);
      if (!resp.ok) throw new Error(`Failed to load Salesforce fields (HTTP ${resp.status})`);
      return await resp.json();
    },
  });

  const fields: SalesforceField[] = useMemo(() => {
    const raw = Array.isArray((fieldsData as any)?.fields) ? (fieldsData as any).fields : [];
    return raw
      .map((f: any) => ({ name: String(f?.name || ""), label: f?.label ? String(f.label) : undefined }))
      .filter((f: SalesforceField) => !!f.name);
  }, [fieldsData]);

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = fields.slice().sort((a, b) => String(a.label || a.name).localeCompare(String(b.label || b.name)));
    if (!q) return list;
    return list.filter((f) => (f.label || f.name).toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  }, [fields, search]);

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "connected-data-sources", sourceId, "preview", columns.join(",")],
    enabled: open && !!campaignId && !!sourceId,
    queryFn: async () => {
      const columnsParam = columns.length > 0 ? `&columns=${encodeURIComponent(columns.join(","))}` : "";
      const resp = await fetch(`/api/campaigns/${campaignId}/connected-data-sources/${sourceId}/preview?limit=50${columnsParam}`);
      if (!resp.ok) throw new Error(`Failed to load Salesforce preview (HTTP ${resp.status})`);
      return await resp.json();
    },
  });

  const headers: string[] = useMemo(() => (Array.isArray((preview as any)?.headers) ? (preview as any).headers : []), [preview]);
  const rows: any[][] = useMemo(() => (Array.isArray((preview as any)?.rows) ? (preview as any).rows : []), [preview]);

  const selectedLabels = useMemo(() => {
    const map = new Map(fields.map((f) => [f.name, f.label || f.name]));
    return columns.map((c) => ({ name: c, label: map.get(c) || c }));
  }, [columns, fields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Salesforce Opportunities</DialogTitle>
          <DialogDescription>
            Choose fields to display, then review a sample (first 50 rows). This view is read-only and separate from revenue mapping.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4 h-[calc(90vh-140px)]">
          {/* Left: column chooser */}
          <div className="border rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Columns</div>
              <div className="text-xs text-slate-500">
                Selected: <span className="font-medium">{columns.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const names = fields.map((f) => f.name).slice(0, 30);
                  setColumns(names);
                }}
                disabled={fields.length === 0}
              >
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setColumns([])}>
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColumns(["Name", "StageName", "CloseDate", "Amount"])}
              >
                Reset
              </Button>
            </div>

            <Input
              className="mt-3"
              placeholder="Search fields…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {fieldsError ? (
              <div className="mt-3 text-sm text-red-600">{(fieldsError as any)?.message || "Failed to load fields."}</div>
            ) : (
              <ScrollArea className="mt-3 border rounded p-2 min-h-0 flex-1">
                {fieldsLoading ? (
                  <div className="text-sm text-slate-500">Loading fields…</div>
                ) : filteredFields.length === 0 ? (
                  <div className="text-sm text-slate-500">No fields match your search.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredFields.map((f) => {
                      const checked = columns.includes(f.name);
                      return (
                        <label key={f.name} className="flex items-start gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              setColumns((prev) => {
                                const set = new Set(prev);
                                if (next) set.add(f.name);
                                else set.delete(f.name);
                                return Array.from(set);
                              });
                            }}
                          />
                          <span className="flex-1">
                            <span className="font-medium">{f.label || f.name}</span>
                            <span className="text-slate-400"> ({f.name})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Right: preview (card/record layout to avoid horizontal scrolling) */}
          <div className="border rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Preview</div>
                <div className="text-xs text-slate-500">
                  No horizontal scrolling: each row is shown as a vertical record with your selected fields.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>

            {selectedLabels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedLabels.slice(0, 12).map((c) => (
                  <Badge key={c.name} variant="secondary" className="flex items-center gap-1">
                    <span>{c.label}</span>
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() => setColumns((prev) => prev.filter((p) => p !== c.name))}
                      aria-label={`Remove ${c.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedLabels.length > 12 && (
                  <span className="text-xs text-slate-500 self-center">+{selectedLabels.length - 12} more</span>
                )}
              </div>
            )}

            <ScrollArea className="mt-3 min-h-0 flex-1">
              {previewLoading ? (
                <div className="py-10 text-center text-slate-500">Loading preview…</div>
              ) : previewError ? (
                <div className="py-10 text-center text-red-600">{(previewError as any)?.message || "Failed to load preview."}</div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-slate-500">No preview rows found.</div>
              ) : (
                <div className="space-y-3 pr-2">
                  {rows.map((row, idx) => {
                    const record: Record<string, any> = {};
                    headers.forEach((h, i) => (record[h] = (row || [])[i]));
                    const name = record["Name"] ?? record["Opportunity Name"] ?? record["Id"] ?? `Row ${idx + 1}`;
                    return (
                      <div key={idx} className="border rounded-lg p-3 bg-white/50 dark:bg-slate-950/20">
                        <div className="font-medium text-sm mb-2 truncate">{String(name)}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                          {headers
                            .filter((h) => h !== "Name")
                            .map((h) => (
                              <div key={h} className="min-w-0">
                                <div className="text-[11px] text-slate-500 truncate">{h}</div>
                                <div className="text-sm break-words">{String(record[h] ?? "")}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



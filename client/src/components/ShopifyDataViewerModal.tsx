import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_COLUMNS = ["Order", "Created At", "Total Price", "Currency", "UTM Campaign"];

export function ShopifyDataViewerModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}) {
  const { open, onOpenChange, campaignId } = props;
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);

  const availableColumns = useMemo(
    () => [
      "Order",
      "Created At",
      "Total Price",
      "Currency",
      "Discount Codes",
      "Landing Site",
      "Referring Site",
      "UTM Campaign",
      "UTM Source",
      "UTM Medium",
    ],
    []
  );

  const filteredColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableColumns;
    return availableColumns.filter((c) => c.toLowerCase().includes(q));
  }, [availableColumns, search]);

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ["/api/shopify", campaignId, "orders", "preview", columns.join(",")],
    enabled: open && !!campaignId,
    queryFn: async () => {
      const resp = await fetch(
        `/api/shopify/${campaignId}/orders/preview?limit=50&columns=${encodeURIComponent(columns.join(","))}`
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || `Failed to load Shopify preview (HTTP ${resp.status})`);
      return json;
    },
  });

  const headers: string[] = useMemo(() => (Array.isArray((preview as any)?.headers) ? (preview as any).headers : []), [preview]);
  const rows: any[][] = useMemo(() => (Array.isArray((preview as any)?.rows) ? (preview as any).rows : []), [preview]);

  const selectedBadges = useMemo(() => columns.map((c) => ({ name: c, label: c })), [columns]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Shopify Orders</DialogTitle>
          <DialogDescription>Choose fields to display, then review a sample (first 50 rows). Read-only.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4 h-[calc(90vh-200px)]">
          {/* Left: column chooser */}
          <div className="border rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Columns</div>
              <div className="text-xs text-slate-500">
                Selected: <span className="font-medium">{columns.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setColumns(availableColumns)}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setColumns([])}>
                Clear
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setColumns(DEFAULT_COLUMNS)}>
                Reset
              </Button>
            </div>

            <Input className="mt-3" placeholder="Search columns…" value={search} onChange={(e) => setSearch(e.target.value)} />

            <ScrollArea className="mt-3 border rounded p-2 min-h-0 flex-1">
              <div className="space-y-2">
                {filteredColumns.map((c) => {
                  const checked = columns.includes(c);
                  return (
                    <label key={c} className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          setColumns((prev) => {
                            const set = new Set(prev);
                            if (next) set.add(c);
                            else set.delete(c);
                            return Array.from(set);
                          });
                        }}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{c}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: preview */}
          <div className="border rounded-lg p-3 flex flex-col min-h-0">
            {selectedBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedBadges.slice(0, 12).map((c) => (
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
                {selectedBadges.length > 12 && (
                  <span className="text-xs text-slate-500 self-center">+{selectedBadges.length - 12} more</span>
                )}
              </div>
            )}

            <ScrollArea className="mt-3 min-h-0 flex-1">
              {isLoading ? (
                <div className="py-10 text-center text-slate-500">Loading preview…</div>
              ) : error ? (
                <div className="py-10 text-center text-red-600">{(error as any)?.message || "Failed to load preview."}</div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-slate-500">No preview rows found.</div>
              ) : (
                <div className="space-y-3 pr-2">
                  {rows.map((row, idx) => {
                    const record: Record<string, any> = {};
                    headers.forEach((h, i) => (record[h] = (row || [])[i]));
                    const title = record["Order"] || `Order ${idx + 1}`;
                    return (
                      <div key={idx} className="border rounded-lg p-3 bg-white/50 dark:bg-slate-950/20">
                        <div className="font-medium text-sm mb-2 truncate">{String(title)}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                          {headers
                            .filter((h) => h !== "Order")
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

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500">Tip: reopen via Connected Data Sources (Shopify) once we add the card.</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast({ title: "Shopify dataset ready", description: "Available in Connected Data Sources." });
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



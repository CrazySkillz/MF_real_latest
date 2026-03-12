// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Benchmark creation/editing modal for Google Sheets analytics.
 * Unlike the LinkedIn version, metrics are dynamic (from detectedColumns)
 * and only supports custom benchmarks (no industry standard lookup).
 */
export function GoogleSheetsBenchmarkModal(props: any) {
  const {
    isOpen,
    setIsOpen,
    editing,
    setEditing,
    form,
    setForm,
    detectedColumns,
    metrics,
    toast,
    handleCreate,
  } = props;

  const DESC_MAX = 500;

  const formatNumberAsYouType = (val: string): string => {
    const cleaned = val.replace(/[^0-9.,\-]/g, '');
    return cleaned;
  };

  const getUnitForColumn = (col: any): string => {
    if (!col) return '';
    if (col.type === 'currency') return '$';
    if (col.type === 'decimal') return '';
    return '';
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setEditing(null);
          setForm({
            name: "",
            unit: "",
            description: "",
            metric: "",
            benchmarkValue: "",
            currentValue: "",
            alertsEnabled: false,
            emailNotifications: false,
            alertFrequency: "daily",
            alertThreshold: "",
            alertCondition: "below",
            emailRecipients: "",
          });
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Benchmark" : "Create New Benchmark"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the benchmark details below. The current value is auto-populated from your Google Sheets data."
              : "Define a custom benchmark for your Google Sheets data. Compare your actual metrics against target values."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gs-bm-name">Benchmark Name *</Label>
            <Input
              id="gs-bm-name"
              placeholder="e.g., CTR Benchmark"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gs-bm-metric">Metric Source</Label>
              <Select
                value={form.metric || undefined}
                onValueChange={(value) => {
                  const col = (detectedColumns || []).find((c: any) => c.name === value);
                  const currentValue = metrics?.[value] != null ? String(metrics[value]) : "";
                  const unit = getUnitForColumn(col);
                  setForm({
                    ...form,
                    metric: value,
                    currentValue: currentValue,
                    unit: unit || form.unit,
                  });
                }}
              >
                <SelectTrigger id="gs-bm-metric">
                  <SelectValue placeholder="Select metric to benchmark" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(detectedColumns || [])
                    .filter((col: any) => !/^(date|week|day|time|timestamp|period|month|year)/i.test(col.name))
                    .map((col: any) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gs-bm-description">Description</Label>
            <Textarea
              id="gs-bm-description"
              placeholder="Describe this benchmark and why it's important"
              value={form.description}
              maxLength={DESC_MAX}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, DESC_MAX) })}
              rows={3}
            />
            <div className="text-xs text-muted-foreground/70 text-right">
              {form.description.length}/{DESC_MAX}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gs-bm-current">Current Value</Label>
              <Input
                id="gs-bm-current"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={form.currentValue}
                onChange={(e) => setForm({ ...form, currentValue: formatNumberAsYouType(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-bm-value">Benchmark Value *</Label>
              <Input
                id="gs-bm-value"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={form.benchmarkValue}
                onChange={(e) => setForm({ ...form, benchmarkValue: formatNumberAsYouType(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-bm-unit">Unit</Label>
              <Input
                id="gs-bm-unit"
                placeholder="%, $, etc."
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
          </div>

          {/* Alert Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="gs-bm-alerts-enabled"
                checked={form.alertsEnabled}
                onCheckedChange={(checked) => setForm({ ...form, alertsEnabled: checked as boolean })}
              />
              <Label htmlFor="gs-bm-alerts-enabled" className="text-base cursor-pointer font-semibold">
                Enable alerts for this Benchmark
              </Label>
            </div>

            {form.alertsEnabled && (
              <div className="space-y-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gs-bm-alert-threshold">Alert Threshold *</Label>
                    <Input
                      id="gs-bm-alert-threshold"
                      type="text"
                      placeholder="e.g., 80"
                      inputMode="decimal"
                      value={form.alertThreshold}
                      onChange={(e) => setForm({ ...form, alertThreshold: formatNumberAsYouType(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground/70">Value at which to trigger the alert</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-bm-alert-condition">Alert When</Label>
                    <Select value={form.alertCondition} onValueChange={(value) => setForm({ ...form, alertCondition: value })}>
                      <SelectTrigger id="gs-bm-alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Value Goes Below</SelectItem>
                        <SelectItem value="above">Value Goes Above</SelectItem>
                        <SelectItem value="equals">Value Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gs-bm-alert-frequency">Alert Frequency</Label>
                    <Select
                      value={form.alertFrequency || "daily"}
                      onValueChange={(value) => setForm({ ...form, alertFrequency: value })}
                    >
                      <SelectTrigger id="gs-bm-alert-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id="gs-bm-email-notifications"
                        checked={!!form.emailNotifications}
                        onCheckedChange={(checked) => setForm({ ...form, emailNotifications: checked as boolean })}
                      />
                      <Label htmlFor="gs-bm-email-notifications" className="cursor-pointer font-medium">
                        Send email notifications
                      </Label>
                    </div>
                    {form.emailNotifications && (
                      <div className="space-y-2">
                        <Label htmlFor="gs-bm-email-recipients">Email addresses *</Label>
                        <Input
                          id="gs-bm-email-recipients"
                          type="text"
                          placeholder="email1@example.com, email2@example.com"
                          value={form.emailRecipients}
                          onChange={(e) => setForm({ ...form, emailRecipients: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground/70">Comma-separated email addresses</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.benchmarkValue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editing ? "Update Benchmark" : "Create Benchmark"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

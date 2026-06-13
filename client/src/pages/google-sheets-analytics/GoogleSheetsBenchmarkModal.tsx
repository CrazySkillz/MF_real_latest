// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Benchmark creation/editing modal for Google Sheets analytics.
 * Metrics are dynamic, but current values must come from the source-backed
 * Google Sheets Benchmark adapter instead of user-entered numbers.
 */
export function GoogleSheetsBenchmarkModal(props: any) {
  const {
    isOpen,
    setIsOpen,
    editing,
    setEditing,
    form,
    setForm,
    metricOptions = [],
    handleCreate,
  } = props;

  const DESC_MAX = 200;
  const overviewMetrics = (metricOptions || []).filter((metric: any) => metric.sourceKind === "confirmed_financial");
  const sheetMetrics = (metricOptions || []).filter((metric: any) => metric.sourceKind !== "confirmed_financial");

  const formatNumberAsYouType = (val: string): string => {
    const cleaned = val.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === "-") return cleaned;
    const negative = cleaned.startsWith("-");
    const unsigned = cleaned.replace(/-/g, '');
    const [integerPart, ...decimalParts] = unsigned.split('.');
    const normalizedInteger = (integerPart || "0").replace(/^0+(?=\d)/, '');
    const groupedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decimal = decimalParts.length > 0 ? `.${decimalParts.join('')}` : '';
    return `${negative ? '-' : ''}${groupedInteger}${decimal}`;
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
            alertFrequency: "immediate",
            alertThreshold: "",
            alertCondition: "below",
            emailRecipients: "",
          });
        }
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Benchmark" : "Create New Benchmark"}</DialogTitle>
          <DialogDescription>
            Set up a performance benchmark for Google Sheets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-4 p-4 bg-muted rounded-lg" data-google-sheets-benchmark-source-adapter="source-backed">
            <div>
              <h4 className="font-medium text-foreground">Select Benchmark Template</h4>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Choose a mapped Google Sheets metric with a current source-backed value.
              </p>
            </div>
            {[
              { title: "Overview metrics", metrics: overviewMetrics },
              { title: "Sheet column metrics", metrics: sheetMetrics },
            ].map((group) => group.metrics.length > 0 && (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground/70">{group.title}</p>
                <div className="grid grid-cols-2 gap-3">
                  {group.metrics.map((metric: any) => {
                    const selected = form.metric === metric.key;
                    const disabled = metric.available !== true;
                    return (
                      <button
                        key={metric.key}
                        type="button"
                        disabled={disabled}
                        className={`text-left p-3 border-2 rounded-lg transition-all ${
                          disabled
                            ? "opacity-50 cursor-not-allowed border-border"
                            : selected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-border hover:border-blue-300"
                        }`}
                        onClick={() => {
                          if (disabled) return;
                          setForm({
                            ...form,
                            name: editing ? form.name || metric.label : metric.label,
                            metric: metric.key,
                            currentValue: String(metric.currentValue ?? ""),
                            unit: metric.unit || "",
                            description: form.description,
                          });
                        }}
                      >
                        <div className="font-medium text-sm text-foreground">{metric.label}</div>
                        <div className="text-xs text-muted-foreground/70 mt-1">
                          {metric.sourceKind === "confirmed_financial" ? "Overview metric" : `Sheet column${metric.sourceLabel ? `: ${metric.sourceLabel}` : ""}`}
                        </div>
                        {disabled && (
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            {metric.reason}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {(metricOptions || []).length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                No mapped Benchmark metrics are available from the selected Google Sheets source.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gs-bm-name">Benchmark Name *</Label>
            <Input
              id="gs-bm-name"
              placeholder="e.g., Target sessions for this campaign"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
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
                value={formatNumberAsYouType(form.currentValue || "")}
                readOnly
                className="bg-muted cursor-not-allowed"
                data-source-backed-current-value="google_sheets_benchmark"
              />
              <p className="text-xs text-muted-foreground/70">Read from the selected mapped Google Sheets metric.</p>
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
                onBlur={(e) => setForm({ ...form, benchmarkValue: formatNumberAsYouType(e.target.value) })}
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
            <div className="space-y-2">
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
              <p className="text-sm text-muted-foreground/70 pl-6">
                Receive notifications when this benchmark crosses a threshold you define.
              </p>
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
                      value={form.alertFrequency || "immediate"}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.metric || !form.benchmarkValue}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {editing ? "Update Benchmark" : "Create Benchmark"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

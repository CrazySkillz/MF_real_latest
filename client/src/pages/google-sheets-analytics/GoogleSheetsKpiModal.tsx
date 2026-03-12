// @ts-nocheck
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * KPI creation/editing modal for Google Sheets analytics.
 * Unlike the LinkedIn version, metrics are dynamic (from detectedColumns)
 * and there is no campaign scoping or revenue gating.
 */
export function GoogleSheetsKpiModal(props: any) {
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

  const KPI_DESC_MAX = 500;

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
            targetValue: "",
            currentValue: "",
            priority: "high",
            status: "active",
            timeframe: "monthly",
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
          <DialogTitle>{editing ? "Edit KPI" : "Create New KPI"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the KPI details below. The current value is auto-populated from your Google Sheets data."
              : "Define a new KPI for your Google Sheets data. Select a metric and set your target value."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-name">KPI Name *</Label>
              <Input
                id="gs-kpi-name"
                placeholder="e.g., Monthly Spend Target"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-metric">Metric Source</Label>
              <Select
                value={form.metric || ""}
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
                <SelectTrigger id="gs-kpi-metric">
                  <SelectValue placeholder="Select metric to track" />
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
            <Label htmlFor="gs-kpi-description">Description</Label>
            <Textarea
              id="gs-kpi-description"
              placeholder="Describe what this KPI measures and why it's important"
              value={form.description}
              maxLength={KPI_DESC_MAX}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, KPI_DESC_MAX) })}
              rows={3}
            />
            <div className="text-xs text-muted-foreground/70 text-right">
              {form.description.length}/{KPI_DESC_MAX}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-current">Current Value</Label>
              <Input
                id="gs-kpi-current"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={form.currentValue || ""}
                onChange={(e) => setForm({ ...form, currentValue: formatNumberAsYouType(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-target">Target Value *</Label>
              <Input
                id="gs-kpi-target"
                type="text"
                placeholder="0"
                inputMode="decimal"
                value={form.targetValue}
                onChange={(e) => setForm({ ...form, targetValue: formatNumberAsYouType(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-unit">Unit</Label>
              <Input
                id="gs-kpi-unit"
                placeholder="%, $, etc."
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-priority">Priority</Label>
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                <SelectTrigger id="gs-kpi-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gs-kpi-timeframe">Timeframe</Label>
              <Select value={form.timeframe || "monthly"} onValueChange={(value) => setForm({ ...form, timeframe: value })}>
                <SelectTrigger id="gs-kpi-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Alert Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gs-kpi-alerts-enabled"
                  checked={form.alertsEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, alertsEnabled: checked as boolean })}
                />
                <Label htmlFor="gs-kpi-alerts-enabled" className="text-base cursor-pointer font-semibold">
                  Enable alerts for this KPI
                </Label>
              </div>
              <p className="text-sm text-muted-foreground/70 pl-6">
                Receive notifications when this KPI crosses your alert threshold
              </p>
            </div>

            {form.alertsEnabled && (
              <div className="space-y-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gs-kpi-alert-threshold">Alert Threshold *</Label>
                    <Input
                      id="gs-kpi-alert-threshold"
                      type="text"
                      placeholder="e.g., 80"
                      inputMode="decimal"
                      value={form.alertThreshold}
                      onChange={(e) => setForm({ ...form, alertThreshold: formatNumberAsYouType(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground/70">Value at which to trigger the alert</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gs-kpi-alert-condition">Alert When</Label>
                    <Select value={form.alertCondition} onValueChange={(value) => setForm({ ...form, alertCondition: value })}>
                      <SelectTrigger id="gs-kpi-alert-condition">
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
                    <Label htmlFor="gs-kpi-alert-frequency">Alert Frequency</Label>
                    <Select
                      value={form.alertFrequency || "daily"}
                      onValueChange={(value) => setForm({ ...form, alertFrequency: value })}
                    >
                      <SelectTrigger id="gs-kpi-alert-frequency">
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
                        id="gs-kpi-email-notifications"
                        checked={!!form.emailNotifications}
                        onCheckedChange={(checked) => setForm({ ...form, emailNotifications: checked as boolean })}
                      />
                      <Label htmlFor="gs-kpi-email-notifications" className="cursor-pointer font-medium">
                        Send email notifications
                      </Label>
                    </div>
                    {form.emailNotifications && (
                      <div className="space-y-2">
                        <Label htmlFor="gs-kpi-email-recipients">Email addresses *</Label>
                        <Input
                          id="gs-kpi-email-recipients"
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
            <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700">
              {editing ? "Update KPI" : "Create KPI"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download, FileText, Info, Settings, Target, Trophy } from "lucide-react";

const getOrdinalSuffix = (day: number) => {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

/**
 * Report creation/editing modal for Google Sheets analytics.
 * Simplified vs LinkedIn: no Ad Comparison template, metrics are dynamic from detectedColumns.
 */
export function GoogleSheetsReportModal(props: any) {
  const {
    isOpen,
    setIsOpen,
    modalStep,
    setModalStep,
    editingId,
    setEditingId,
    form,
    setForm,
    formErrors,
    setFormErrors,
    customConfig,
    setCustomConfig,
    detectedColumns,
    kpisData,
    benchmarksData,
    handleTypeSelect,
    handleCreate,
    handleUpdate,
    handleCustom,
    createMutation,
    updateMutation,
  } = props;

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const getTimeZoneDisplay = () => {
    try {
      const offset = new Date().getTimezoneOffset();
      const absOffset = Math.abs(offset);
      const h = Math.floor(absOffset / 60);
      const m = absOffset % 60;
      const sign = offset <= 0 ? '+' : '-';
      return `${userTimeZone} (UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''})`;
    } catch { return userTimeZone; }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setEditingId(null);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Two Main Sections */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                modalStep === "standard"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => setModalStep("standard")}
            >
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Templates</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Pre-built professional report templates
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                modalStep === "custom"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => {
                setModalStep("custom");
                if (!form.reportType || form.reportType !== "custom") {
                  handleTypeSelect("custom");
                } else if (!String(form.name || "").trim()) {
                  setForm({ ...form, name: "Custom Report" });
                }
              }}
            >
              <div className="flex items-start gap-3">
                <Settings className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Report</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Build your own customized report
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Standard Templates Content */}
          {modalStep === "standard" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose Template</h3>
                <div className="space-y-4">
                  {/* Overview Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      form.reportType === "overview"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleTypeSelect("overview")}
                  >
                    <div className="flex items-start gap-3">
                      <BarChart3 className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Overview</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Comprehensive overview of Google Sheets performance data
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Summary</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Metrics</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPIs Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      form.reportType === "kpis"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleTypeSelect("kpis")}
                  >
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">KPIs</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Key performance indicators and progress tracking
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Targets</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Progress</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benchmarks Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      form.reportType === "benchmarks"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleTypeSelect("benchmarks")}
                  >
                    <div className="flex items-start gap-3">
                      <Trophy className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Benchmarks</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Performance benchmarks and comparisons
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Custom</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Goals</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insights Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      form.reportType === "insights"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleTypeSelect("insights")}
                  >
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Insights</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Data quality, trends, anomalies, and recommendations
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Trends</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Anomalies</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Actions</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Section */}
                  <div className="pt-4 border-t mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Checkbox
                        id="gs-schedule-reports"
                        checked={form.scheduleEnabled}
                        onCheckedChange={(checked) => {
                          setForm({ ...form, scheduleEnabled: checked as boolean });
                          if (!checked) setFormErrors({});
                        }}
                      />
                      <Label htmlFor="gs-schedule-reports" className="text-base font-semibold cursor-pointer">
                        Schedule Automated Reports
                      </Label>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="gs-report-name">Report Name</Label>
                        <Input
                          id="gs-report-name"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Enter report name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gs-report-description">Description (Optional)</Label>
                        <Textarea
                          id="gs-report-description"
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Add a description for this report"
                          rows={3}
                        />
                      </div>
                    </div>

                    {form.scheduleEnabled && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select value={form.scheduleFrequency} onValueChange={(v) => setForm({ ...form, scheduleFrequency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {form.scheduleFrequency === "weekly" && (
                          <div className="space-y-2">
                            <Label>Day of Week</Label>
                            <Select value={form.scheduleDayOfWeek} onValueChange={(v) => setForm({ ...form, scheduleDayOfWeek: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monday">Monday</SelectItem>
                                <SelectItem value="tuesday">Tuesday</SelectItem>
                                <SelectItem value="wednesday">Wednesday</SelectItem>
                                <SelectItem value="thursday">Thursday</SelectItem>
                                <SelectItem value="friday">Friday</SelectItem>
                                <SelectItem value="saturday">Saturday</SelectItem>
                                <SelectItem value="sunday">Sunday</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {form.scheduleFrequency === "quarterly" && (
                          <div className="space-y-2">
                            <Label>Quarter Timing</Label>
                            <Select value={form.quarterTiming} onValueChange={(v) => setForm({ ...form, quarterTiming: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                                <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {(form.scheduleFrequency === "monthly" || form.scheduleFrequency === "quarterly") && (
                          <div className="space-y-2">
                            <Label>Day of Month</Label>
                            <Select value={form.scheduleDayOfMonth} onValueChange={(v) => setForm({ ...form, scheduleDayOfMonth: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="first">1st (First day of month)</SelectItem>
                                <SelectItem value="last">Last day of month</SelectItem>
                                <SelectItem value="15">15th (Mid-month)</SelectItem>
                                {form.scheduleFrequency !== "quarterly" && (
                                  <>
                                    <div className="border-t my-1" />
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Specific Days</div>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                      <SelectItem key={day} value={day.toString()}>
                                        {day}{getOrdinalSuffix(day)}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Select value={form.scheduleTime} onValueChange={(v) => setForm({ ...form, scheduleTime: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            All times are in your time zone: {getTimeZoneDisplay()}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Email Recipients{form.scheduleEnabled ? " *" : ""}</Label>
                          <Input
                            value={form.emailRecipients}
                            onChange={(e) => {
                              setForm({ ...form, emailRecipients: e.target.value });
                              if (formErrors.emailRecipients && e.target.value.trim()) {
                                setFormErrors({ ...formErrors, emailRecipients: undefined });
                              }
                            }}
                            placeholder="Enter email addresses (comma-separated)"
                            className={formErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined}
                          />
                          {formErrors.emailRecipients ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{formErrors.emailRecipients}</p>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Reports will be automatically generated and sent to these email addresses
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Report Content */}
          {modalStep === "custom" && (
            <div className="space-y-6">
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Metrics</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose which metrics from your Google Sheets data to include in the report.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(detectedColumns || []).map((col: any) => (
                    <div key={col.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`gs-metric-${col.name}`}
                        checked={(customConfig.selectedMetrics || []).includes(col.name)}
                        onCheckedChange={(checked) => {
                          const current = customConfig.selectedMetrics || [];
                          const next = checked
                            ? [...current, col.name]
                            : current.filter((m: string) => m !== col.name);
                          setCustomConfig({ ...customConfig, selectedMetrics: next });
                        }}
                      />
                      <Label htmlFor={`gs-metric-${col.name}`} className="text-sm cursor-pointer">
                        {col.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              {kpisData && Array.isArray(kpisData) && kpisData.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Include KPIs</h4>
                  <div className="space-y-2">
                    {kpisData.map((kpi: any) => (
                      <div key={kpi.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`gs-report-kpi-${kpi.id}`}
                          checked={(customConfig.kpis || []).includes(kpi.id)}
                          onCheckedChange={(checked) => {
                            const current = customConfig.kpis || [];
                            const next = checked
                              ? [...current, kpi.id]
                              : current.filter((id: string) => id !== kpi.id);
                            setCustomConfig({ ...customConfig, kpis: next });
                          }}
                        />
                        <Label htmlFor={`gs-report-kpi-${kpi.id}`} className="text-sm cursor-pointer">
                          {kpi.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benchmarks */}
              {benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Include Benchmarks</h4>
                  <div className="space-y-2">
                    {benchmarksData.map((bm: any) => (
                      <div key={bm.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`gs-report-bm-${bm.id}`}
                          checked={(customConfig.benchmarks || []).includes(bm.id)}
                          onCheckedChange={(checked) => {
                            const current = customConfig.benchmarks || [];
                            const next = checked
                              ? [...current, bm.id]
                              : current.filter((id: string) => id !== bm.id);
                            setCustomConfig({ ...customConfig, benchmarks: next });
                          }}
                        />
                        <Label htmlFor={`gs-report-bm-${bm.id}`} className="text-sm cursor-pointer">
                          {bm.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Section for Custom */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gs-custom-schedule"
                    checked={form.scheduleEnabled}
                    onCheckedChange={(checked) => {
                      setForm({ ...form, scheduleEnabled: checked as boolean });
                      if (!checked) setFormErrors({});
                    }}
                  />
                  <Label htmlFor="gs-custom-schedule" className="text-base cursor-pointer font-semibold">
                    Schedule Automated Reports
                  </Label>
                </div>

                <div className="space-y-4 pl-6">
                  <div className="space-y-2">
                    <Label>Report Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Enter report name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Add a description for this report"
                      rows={2}
                    />
                  </div>

                  {form.scheduleEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select value={form.scheduleFrequency} onValueChange={(v) => setForm({ ...form, scheduleFrequency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.scheduleFrequency === "weekly" && (
                        <div className="space-y-2">
                          <Label>Day of Week</Label>
                          <Select value={form.scheduleDayOfWeek} onValueChange={(v) => setForm({ ...form, scheduleDayOfWeek: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(d => (
                                <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(form.scheduleFrequency === "monthly" || form.scheduleFrequency === "quarterly") && (
                        <div className="space-y-2">
                          <Label>Day of Month</Label>
                          <Select value={form.scheduleDayOfMonth} onValueChange={(v) => setForm({ ...form, scheduleDayOfMonth: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="first">1st (First day of month)</SelectItem>
                              <SelectItem value="last">Last day of month</SelectItem>
                              <SelectItem value="15">15th (Mid-month)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Select value={form.scheduleTime} onValueChange={(v) => setForm({ ...form, scheduleTime: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          All times are in your time zone: {getTimeZoneDisplay()}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Email Recipients *</Label>
                        <Input
                          value={form.emailRecipients}
                          onChange={(e) => {
                            setForm({ ...form, emailRecipients: e.target.value });
                            if (formErrors.emailRecipients && e.target.value.trim()) {
                              setFormErrors({ ...formErrors, emailRecipients: undefined });
                            }
                          }}
                          placeholder="Enter email addresses (comma-separated)"
                          className={formErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined}
                        />
                        {formErrors.emailRecipients ? (
                          <p className="text-sm text-red-600 dark:text-red-400">{formErrors.emailRecipients}</p>
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Reports will be sent to these email addresses on schedule
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setModalStep("standard");
                setEditingId(null);
                setForm({
                  name: "",
                  description: "",
                  reportType: "",
                  scheduleEnabled: false,
                  scheduleFrequency: "weekly",
                  scheduleDayOfWeek: "monday",
                  scheduleDayOfMonth: "first",
                  quarterTiming: "end",
                  scheduleTime: "9:00 AM",
                  emailRecipients: "",
                  status: "draft",
                });
              }}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {modalStep === "standard" && form.reportType && form.reportType !== "custom" && (
                <Button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={!form.name || createMutation?.isPending || updateMutation?.isPending}
                  className="gap-2"
                >
                  {createMutation?.isPending || updateMutation?.isPending ? (
                    editingId ? "Updating..." : "Creating..."
                  ) : editingId ? (
                    "Update Report"
                  ) : form.scheduleEnabled ? (
                    "Schedule Report"
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate & Download Report
                    </>
                  )}
                </Button>
              )}

              {modalStep === "custom" && (
                <Button
                  onClick={editingId ? handleUpdate : handleCustom}
                  disabled={!form.name || createMutation?.isPending || updateMutation?.isPending}
                  className="gap-2"
                >
                  {createMutation?.isPending || updateMutation?.isPending ? (
                    editingId ? "Updating..." : "Creating..."
                  ) : editingId ? (
                    "Update Report"
                  ) : form.scheduleEnabled ? (
                    "Schedule Report"
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate & Download Report
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

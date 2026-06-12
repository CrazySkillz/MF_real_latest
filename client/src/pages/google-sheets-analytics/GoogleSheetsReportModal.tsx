// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, BarChart3, ChevronDown, ChevronRight, Download, FileText, Info, Settings, Target, Trophy } from "lucide-react";

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
 * Follows the connected-platform Reports template while keeping source-specific unavailable states explicit.
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
    expandedSections,
    setExpandedSections,
    detectedColumns,
    kpisData,
    benchmarksData,
    handleTypeSelect,
    handleCreate,
    handleUpdate,
    handleCustom,
    hasChanges,
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

  const normalizeConfig = (cfg: any = {}) => ({
    sections: { overview: false, kpis: false, benchmarks: false, ads: false, insights: false, ...(cfg.sections || {}) },
    subsections: {
      overview: { metrics: false, ...(cfg.subsections?.overview || {}) },
      kpis: { items: false, ...(cfg.subsections?.kpis || {}) },
      benchmarks: { items: false, ...(cfg.subsections?.benchmarks || {}) },
      ads: { unavailable: false, ...(cfg.subsections?.ads || {}) },
      insights: { summary: false, ...(cfg.subsections?.insights || {}) },
    },
    selectedMetrics: Array.isArray(cfg.selectedMetrics) ? cfg.selectedMetrics : [],
    kpis: Array.isArray(cfg.kpis) ? cfg.kpis : [],
    benchmarks: Array.isArray(cfg.benchmarks) ? cfg.benchmarks : [],
    selectedKpiIds: Array.isArray(cfg.selectedKpiIds) ? cfg.selectedKpiIds : [],
    selectedBenchmarkIds: Array.isArray(cfg.selectedBenchmarkIds) ? cfg.selectedBenchmarkIds : [],
  });

  const normalizedConfig = normalizeConfig(customConfig);
  const selectedKpiIds = new Set([...(normalizedConfig.kpis || []), ...(normalizedConfig.selectedKpiIds || [])].map(String));
  const selectedBenchmarkIds = new Set([...(normalizedConfig.benchmarks || []), ...(normalizedConfig.selectedBenchmarkIds || [])].map(String));
  const hasCustomSelection =
    (normalizedConfig.selectedMetrics || []).length > 0 ||
    selectedKpiIds.size > 0 ||
    selectedBenchmarkIds.size > 0 ||
    !!normalizedConfig.sections?.insights;

  const setSectionExpanded = (section: string) => {
    setExpandedSections((prev: any) => ({ ...(prev || {}), [section]: !(prev || {})[section] }));
  };

  const updateConfig = (next: any) => {
    setCustomConfig(normalizeConfig(next));
  };

  const setSectionChecked = (section: string, checked: boolean) => {
    const next = normalizeConfig(customConfig);
    next.sections[section] = checked;
    if (section === "overview") next.subsections.overview.metrics = checked;
    if (section === "kpis") next.subsections.kpis.items = checked;
    if (section === "benchmarks") next.subsections.benchmarks.items = checked;
    if (section === "insights") next.subsections.insights.summary = checked;
    updateConfig(next);
  };

  const standardTemplates = [
    { key: "overview", title: "Overview", desc: "Comprehensive overview of Google Sheets performance data", Icon: BarChart3, chips: ["Summary", "Metrics", "Insights"] },
    { key: "kpis", title: "KPIs", desc: "Key performance indicators and progress tracking", Icon: Target, chips: ["Targets", "Progress"] },
    { key: "benchmarks", title: "Benchmarks", desc: "Performance benchmarks and comparisons", Icon: Trophy, chips: ["Custom", "Goals"] },
    { key: "ads", title: "Ad Comparison", desc: "Unavailable for Google Sheets because this source has sheet rows, not ad-level entities.", Icon: Activity, chips: ["Unavailable"], disabled: true },
    { key: "insights", title: "Insights", desc: "Data quality, trends, anomalies, and recommendations", Icon: Info, chips: ["Trends", "Anomalies", "Actions"] },
  ];

  const submitDisabled =
    !form.name ||
    (modalStep === "standard" && (!form.reportType || form.reportType === "ads")) ||
    (modalStep === "custom" && !hasCustomSelection) ||
    (form.scheduleEnabled && !String(form.emailRecipients || "").trim()) ||
    (!!editingId && !hasChanges) ||
    createMutation?.isPending ||
    updateMutation?.isPending;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setEditingId(null);
          setFormErrors({});
        }
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
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
                  : "border-border"
              }`}
              onClick={() => {
                setModalStep("standard");
                if (form.reportType === "custom") {
                  setForm({ ...form, reportType: "", name: "" });
                }
              }}
            >
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">Standard Templates</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Pre-built professional report templates
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                modalStep === "custom"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-border"
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
                  <h3 className="text-lg font-bold text-foreground">Custom Report</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
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
                <h3 className="text-lg font-bold text-foreground mb-4">Choose Template</h3>
                <div className="space-y-4">
                  {standardTemplates.map((template) => {
                    const selected = form.reportType === template.key;
                    return (
                      <div
                        key={template.key}
                        className={`border rounded-lg p-4 transition-all ${
                          template.disabled
                            ? "border-border bg-muted/30 opacity-70"
                            : `cursor-pointer hover:border-blue-500 ${selected ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-border"}`
                        }`}
                        onClick={() => {
                          if (!template.disabled) handleTypeSelect(template.key);
                        }}
                        aria-disabled={template.disabled ? "true" : "false"}
                      >
                        <div className="flex items-start gap-3">
                          <template.Icon className="w-5 h-5 text-foreground mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{template.title}</h4>
                            <p className="text-sm text-muted-foreground/70 mt-1">{template.desc}</p>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {template.chips.map((chip) => (
                                <span key={chip} className="text-xs px-2 py-1 bg-muted rounded">{chip}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

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
                      <div className="bg-muted/50 rounded-lg p-4 space-y-4 mt-4">
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
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/70">Specific Days</div>
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
                          <p className="text-sm text-muted-foreground/70">
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
                            <p className="text-sm text-muted-foreground/70">
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
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Custom Report</h3>
                  <p className="text-sm text-muted-foreground/70">
                    Choose Google Sheets sections and rows to include in your PDF.
                  </p>
                </div>

                <div className="border rounded-lg p-4 border-border">
                  <div className="text-sm font-medium text-foreground/80 mb-3">Sections</div>
                  <div className="space-y-4 text-sm">
                    {[
                      { key: "overview", label: "Overview" },
                      { key: "kpis", label: "KPIs" },
                      { key: "benchmarks", label: "Benchmarks" },
                      { key: "ads", label: "Ad Comparison" },
                      { key: "insights", label: "Insights" },
                    ].map((section) => {
                      const checked = !!normalizedConfig.sections?.[section.key];
                      const expanded = !!(expandedSections || {})[section.key];
                      return (
                        <div key={section.key} className="rounded-md border border-border p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setSectionExpanded(section.key)}
                              aria-label={`${expanded ? "Collapse" : "Expand"} ${section.label}`}
                            >
                              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <Checkbox
                              id={`gs-report-section-${section.key}`}
                              checked={checked}
                              disabled={section.key === "ads"}
                              onCheckedChange={(value) => setSectionChecked(section.key, value as boolean)}
                            />
                            <Label
                              htmlFor={`gs-report-section-${section.key}`}
                              className={`font-medium ${section.key === "ads" ? "text-muted-foreground" : "cursor-pointer text-foreground"}`}
                            >
                              {section.label}
                            </Label>
                          </div>

                          {expanded && (
                            <div className="pl-8 space-y-3">
                              {section.key === "overview" && (
                                <div className="grid grid-cols-2 gap-2">
                                  {(detectedColumns || []).map((col: any) => (
                                    <div key={col.name} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`gs-metric-${col.name}`}
                                        checked={(normalizedConfig.selectedMetrics || []).includes(col.name)}
                                        onCheckedChange={(checkedValue) => {
                                          const next = normalizeConfig(customConfig);
                                          const current = next.selectedMetrics || [];
                                          next.selectedMetrics = checkedValue
                                            ? Array.from(new Set([...current, col.name]))
                                            : current.filter((metric: string) => metric !== col.name);
                                          next.sections.overview = next.selectedMetrics.length > 0;
                                          next.subsections.overview.metrics = next.selectedMetrics.length > 0;
                                          updateConfig(next);
                                        }}
                                      />
                                      <Label htmlFor={`gs-metric-${col.name}`} className="text-sm cursor-pointer">
                                        {col.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {(detectedColumns || []).length === 0 && (
                                    <p className="text-sm text-muted-foreground/70">No mapped Google Sheets metrics are available.</p>
                                  )}
                                </div>
                              )}

                              {section.key === "kpis" && (
                                <div className="grid grid-cols-2 gap-2">
                                  {(Array.isArray(kpisData) ? kpisData : []).map((kpi: any) => (
                                    <div key={kpi.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`gs-report-kpi-${kpi.id}`}
                                        checked={selectedKpiIds.has(String(kpi.id))}
                                        onCheckedChange={(checkedValue) => {
                                          const next = normalizeConfig(customConfig);
                                          const ids = new Set([...(next.kpis || []), ...(next.selectedKpiIds || [])].map(String));
                                          if (checkedValue) ids.add(String(kpi.id)); else ids.delete(String(kpi.id));
                                          next.kpis = Array.from(ids);
                                          next.selectedKpiIds = Array.from(ids);
                                          next.sections.kpis = ids.size > 0;
                                          next.subsections.kpis.items = ids.size > 0;
                                          updateConfig(next);
                                        }}
                                      />
                                      <Label htmlFor={`gs-report-kpi-${kpi.id}`} className="text-sm cursor-pointer">
                                        {kpi.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {(Array.isArray(kpisData) ? kpisData : []).length === 0 && (
                                    <p className="text-sm text-muted-foreground/70">No Google Sheets KPI rows are available.</p>
                                  )}
                                </div>
                              )}

                              {section.key === "benchmarks" && (
                                <div className="grid grid-cols-2 gap-2">
                                  {(Array.isArray(benchmarksData) ? benchmarksData : []).map((bm: any) => (
                                    <div key={bm.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`gs-report-bm-${bm.id}`}
                                        checked={selectedBenchmarkIds.has(String(bm.id))}
                                        onCheckedChange={(checkedValue) => {
                                          const next = normalizeConfig(customConfig);
                                          const ids = new Set([...(next.benchmarks || []), ...(next.selectedBenchmarkIds || [])].map(String));
                                          if (checkedValue) ids.add(String(bm.id)); else ids.delete(String(bm.id));
                                          next.benchmarks = Array.from(ids);
                                          next.selectedBenchmarkIds = Array.from(ids);
                                          next.sections.benchmarks = ids.size > 0;
                                          next.subsections.benchmarks.items = ids.size > 0;
                                          updateConfig(next);
                                        }}
                                      />
                                      <Label htmlFor={`gs-report-bm-${bm.id}`} className="text-sm cursor-pointer">
                                        {bm.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {(Array.isArray(benchmarksData) ? benchmarksData : []).length === 0 && (
                                    <p className="text-sm text-muted-foreground/70">No Google Sheets Benchmark rows are available.</p>
                                  )}
                                </div>
                              )}

                              {section.key === "ads" && (
                                <p className="text-sm text-muted-foreground/70">
                                  Google Sheets does not expose ad-level rows for this source. Use a paid-media source for Ad Comparison reports.
                                </p>
                              )}

                              {section.key === "insights" && (
                                <p className="text-sm text-muted-foreground/70">
                                  Insights will use current Google Sheets source-backed metrics and unavailable reasons.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

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
                        <p className="text-sm text-muted-foreground/70">
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
                          <p className="text-sm text-muted-foreground/70">
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
                  scheduleFrequency: "daily",
                  scheduleDayOfWeek: "monday",
                  scheduleDayOfMonth: "first",
                  quarterTiming: "end",
                  scheduleTime: "9:00 AM",
                  emailRecipients: "",
                  status: "active",
                });
                setCustomConfig(normalizeConfig({}));
                setExpandedSections({});
              }}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {modalStep === "standard" && (
                <Button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={submitDisabled}
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
                  disabled={submitDisabled}
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

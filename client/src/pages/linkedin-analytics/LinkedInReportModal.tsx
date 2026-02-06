// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Activity, BarChart3, Download, FileText, Info, Settings, Target, Trophy } from "lucide-react";

type Props = {
  isReportModalOpen: boolean;
  setIsReportModalOpen: (open: boolean) => void;
  reportModalStep: "standard" | "custom" | "type" | "configuration";
  setReportModalStep: (step: any) => void;
  editingReportId: string | null;
  setEditingReportId: (id: string | null) => void;
  reportForm: any;
  setReportForm: (next: any) => void;
  reportFormErrors: any;
  setReportFormErrors: (next: any) => void;
  customReportConfig: any;
  setCustomReportConfig: (next: any) => void;
  aggregated: any;
  metrics: any;
  kpisData: any;
  benchmarksData: any;
  handleReportTypeSelect: (type: string) => void;
  handleCreateReport: () => void;
  handleUpdateReport: () => void;
  handleCustomReport: () => void;
  createReportMutation: any;
  updateReportMutation: any;
  userTimeZone: string;
  getTimeZoneDisplay: () => string;
};

// Helper function for ordinal suffixes (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (day: number) => {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export function LinkedInReportModal(props: Props) {
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    reportModalStep,
    setReportModalStep,
    editingReportId,
    setEditingReportId,
    reportForm,
    setReportForm,
    reportFormErrors,
    setReportFormErrors,
    customReportConfig,
    setCustomReportConfig,
    aggregated,
    metrics,
    kpisData,
    benchmarksData,
    handleReportTypeSelect,
    handleCreateReport,
    handleUpdateReport,
    handleCustomReport,
    createReportMutation,
    updateReportMutation,
    userTimeZone,
    getTimeZoneDisplay,
  } = props;

  return (
    <Dialog
      open={isReportModalOpen}
      onOpenChange={(open) => {
        setIsReportModalOpen(open);
        if (!open) {
          setEditingReportId(null);
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Report Type</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Two Main Sections */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Standard Templates Section */}
            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                reportModalStep === "standard"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => setReportModalStep("standard")}
              data-testid="section-standard-templates"
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

            {/* Custom Report Section */}
            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                reportModalStep === "custom"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => {
                setReportModalStep("custom");
                // Mirror Standard Templates behavior: selecting a type populates a default name.
                if (!reportForm.reportType || reportForm.reportType !== "custom") {
                  handleReportTypeSelect("custom");
                } else if (!String(reportForm.name || "").trim()) {
                  setReportForm({ ...reportForm, name: "Custom Report" });
                }
              }}
              data-testid="section-custom-report"
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
          {reportModalStep === "standard" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose Template</h3>

                <div className="space-y-4">
                  {/* Overview Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      reportForm.reportType === "overview"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleReportTypeSelect("overview")}
                    data-testid="template-overview"
                  >
                    <div className="flex items-start gap-3">
                      <BarChart3 className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Overview</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Comprehensive overview of campaign performance metrics
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Overview</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Metrics</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPIs Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      reportForm.reportType === "kpis"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleReportTypeSelect("kpis")}
                    data-testid="template-kpis"
                  >
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">KPIs</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Key performance indicators and progress tracking
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Metrics</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Targets</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Progress</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benchmarks Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      reportForm.reportType === "benchmarks"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleReportTypeSelect("benchmarks")}
                    data-testid="template-benchmarks"
                  >
                    <div className="flex items-start gap-3">
                      <Trophy className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Benchmarks</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Performance benchmarks and comparisons
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Industry</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Historical</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Goals</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ad Comparison Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      reportForm.reportType === "ads"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleReportTypeSelect("ads")}
                    data-testid="template-ad-comparison"
                  >
                    <div className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Ad Comparison</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Detailed ad-level performance analysis
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Performance</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Ranking</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Insights</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insights Template */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
                      reportForm.reportType === "insights"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => handleReportTypeSelect("insights")}
                    data-testid="template-insights"
                  >
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Insights</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Executive financials, trends, and “what changed / what to do next”
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Executive</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Trends</span>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Actions</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Automated Reports */}
                  <div className="pt-4 border-t mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Checkbox
                        id="schedule-reports"
                        checked={reportForm.scheduleEnabled}
                        onCheckedChange={(checked) => {
                          const enabled = checked as boolean;
                          setReportForm({ ...reportForm, scheduleEnabled: enabled });
                          if (!enabled) setReportFormErrors({});
                        }}
                        data-testid="checkbox-schedule-reports"
                      />
                      <Label htmlFor="schedule-reports" className="text-base font-semibold cursor-pointer">
                        Schedule Automated Reports
                      </Label>
                    </div>

                    {reportForm.scheduleEnabled && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-4">
                        {/* Frequency */}
                        <div className="space-y-2">
                          <Label htmlFor="schedule-frequency">Frequency</Label>
                          <Select
                            value={reportForm.scheduleFrequency}
                            onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                          >
                            <SelectTrigger id="schedule-frequency" data-testid="select-frequency">
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

                        {/* Day of Week - Only for Weekly */}
                        {reportForm.scheduleFrequency === "weekly" && (
                          <div className="space-y-2">
                            <Label htmlFor="schedule-day">Day of Week</Label>
                            <Select
                              value={reportForm.scheduleDayOfWeek}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                            >
                              <SelectTrigger id="schedule-day" data-testid="select-day">
                                <SelectValue />
                              </SelectTrigger>
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

                        {/* Quarter Timing - Only for Quarterly */}
                        {reportForm.scheduleFrequency === "quarterly" && (
                          <div className="space-y-2">
                            <Label htmlFor="quarter-timing">Quarter Timing</Label>
                            <Select
                              value={reportForm.quarterTiming}
                              onValueChange={(value) => setReportForm({ ...reportForm, quarterTiming: value })}
                            >
                              <SelectTrigger id="quarter-timing" data-testid="select-quarter-timing">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                                <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Choose whether to run reports at the start or end of each quarter
                            </p>
                          </div>
                        )}

                        {/* Day of Month - Only for Monthly and Quarterly */}
                        {(reportForm.scheduleFrequency === "monthly" ||
                          reportForm.scheduleFrequency === "quarterly") && (
                          <div className="space-y-2">
                            <Label htmlFor="schedule-day-month">Day of Month</Label>
                            <Select
                              value={reportForm.scheduleDayOfMonth}
                              onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfMonth: value })}
                            >
                              <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {reportForm.scheduleFrequency === "quarterly" ? (
                                  <>
                                    <SelectItem value="first">First day of month</SelectItem>
                                    <SelectItem value="last">Last day of month</SelectItem>
                                    <SelectItem value="15">Mid-month (15th)</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="first">1st (First day of month)</SelectItem>
                                    <SelectItem value="last">Last day of month</SelectItem>
                                    <SelectItem value="15">15th (Mid-month)</SelectItem>

                                    <div className="border-t my-1"></div>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      Specific Days
                                    </div>

                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                      const suffix = getOrdinalSuffix(day);
                                      const isCommon = [1, 5, 10, 15, 20, 25].includes(day);
                                      return (
                                        <SelectItem
                                          key={day}
                                          value={day.toString()}
                                          className={isCommon ? "font-medium" : ""}
                                        >
                                          {day}
                                          {suffix} {isCommon && "⭐"}
                                        </SelectItem>
                                      );
                                    })}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {reportForm.scheduleFrequency === "quarterly"
                                ? "Quarterly reports typically run at the start, end, or middle of the quarter month"
                                : "For months with fewer days, the report will run on the last available day"}
                            </p>
                          </div>
                        )}

                        {/* Time */}
                        <div className="space-y-2">
                          <Label htmlFor="schedule-time">Time</Label>
                          <Select
                            value={reportForm.scheduleTime}
                            onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                          >
                            <SelectTrigger id="schedule-time" data-testid="select-time">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                              <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                              <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                              <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                              <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                              <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                              <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                              <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                              <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                              <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                              <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                              <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                              <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                            </SelectContent>
                          </Select>
                          {userTimeZone && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              All times are in your time zone: {getTimeZoneDisplay()}
                            </p>
                          )}
                        </div>

                        {/* Email Recipients */}
                        <div className="space-y-2">
                          <Label htmlFor="email-recipients">
                            Email Recipients{reportForm.scheduleEnabled ? " *" : ""}
                          </Label>
                          <Input
                            id="email-recipients"
                            value={reportForm.emailRecipients}
                            onChange={(e) => {
                              const v = e.target.value;
                              setReportForm({ ...reportForm, emailRecipients: v });
                              if (reportFormErrors.emailRecipients && String(v || "").trim()) {
                                setReportFormErrors((prev) => ({ ...prev, emailRecipients: undefined }));
                              }
                            }}
                            placeholder="Enter email addresses (comma-separated)"
                            className={
                              reportFormErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined
                            }
                            data-testid="input-email-recipients"
                          />
                          {reportFormErrors.emailRecipients ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{reportFormErrors.emailRecipients}</p>
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

                {/* Report Configuration */}
                {reportForm.reportType && reportForm.reportType !== "custom" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="report-name">Report Name</Label>
                      <Input
                        id="report-name"
                        value={reportForm.name}
                        onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                        placeholder="Enter report name"
                        data-testid="input-report-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="report-description">Description (Optional)</Label>
                      <Textarea
                        id="report-description"
                        value={reportForm.description}
                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                        placeholder="Add a description for this report"
                        rows={3}
                        data-testid="input-report-description"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Report Content */}
          {reportModalStep === "custom" && (
            <div className="space-y-6">
              {/* Report Name and Description */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-report-name">Report Name</Label>
                  <Input
                    id="custom-report-name"
                    value={reportForm.name}
                    onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                    placeholder="Enter report name"
                    data-testid="input-custom-report-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-report-description">Description (Optional)</Label>
                  <Textarea
                    id="custom-report-description"
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder="Add a description for this report"
                    rows={2}
                    data-testid="input-custom-report-description"
                  />
                </div>
              </div>

              {/* Metrics Selection */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Metrics</h3>

                <Accordion type="multiple" className="w-full">
                  {/* LinkedIn Core Metrics */}
                  <AccordionItem value="linkedin-core-metrics">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      LinkedIn Core Metrics
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {[
                          "impressions",
                          "reach",
                          "clicks",
                          "engagements",
                          "spend",
                          "conversions",
                          "leads",
                          "videoviews",
                          "viralimpressions",
                        ].map((metric) => {
                          const labels: Record<string, string> = {
                            impressions: "Impressions",
                            reach: "Reach",
                            clicks: "Clicks",
                            engagements: "Engagements",
                            spend: "Spend",
                            conversions: "Conversions",
                            leads: "Leads",
                            videoviews: "Video Views",
                            viralimpressions: "Viral Impressions",
                          };
                          return (
                            <div key={metric} className="flex items-center space-x-2">
                              <Checkbox
                                id={`core-${metric}`}
                                checked={customReportConfig.coreMetrics.includes(metric)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      coreMetrics: [...customReportConfig.coreMetrics, metric],
                                    });
                                  } else {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      coreMetrics: customReportConfig.coreMetrics.filter((m: any) => m !== metric),
                                    });
                                  }
                                }}
                                data-testid={`checkbox-core-${metric}`}
                              />
                              <Label htmlFor={`core-${metric}`} className="text-sm cursor-pointer">
                                {labels[metric]}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* LinkedIn Derived Metrics */}
                  <AccordionItem value="linkedin-derived-metrics">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      LinkedIn Derived Metrics
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {["ctr", "cpc", "cpm", "cvr", "cpa", "cpl", "er"].map((metric) => {
                          const labels: Record<string, string> = {
                            ctr: "CTR (Click-Through Rate)",
                            cpc: "CPC (Cost Per Click)",
                            cpm: "CPM (Cost Per Mille)",
                            cvr: "CVR (Conversion Rate)",
                            cpa: "CPA (Cost Per Acquisition)",
                            cpl: "CPL (Cost Per Lead)",
                            er: "ER (Engagement Rate)",
                          };
                          return (
                            <div key={metric} className="flex items-center space-x-2">
                              <Checkbox
                                id={`derived-${metric}`}
                                checked={customReportConfig.derivedMetrics.includes(metric)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      derivedMetrics: [...customReportConfig.derivedMetrics, metric],
                                    });
                                  } else {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      derivedMetrics: customReportConfig.derivedMetrics.filter((m: any) => m !== metric),
                                    });
                                  }
                                }}
                                data-testid={`checkbox-derived-${metric}`}
                              />
                              <Label htmlFor={`derived-${metric}`} className="text-sm cursor-pointer">
                                {labels[metric]}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* LinkedIn Revenue Metrics - Only shown if conversion value is set */}
                  {aggregated?.hasRevenueTracking === 1 && (
                    <AccordionItem value="linkedin-revenue-metrics">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn Revenue Metrics
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {["totalrevenue", "roas", "roi", "profit", "profitmargin", "revenueperlead"].map((metric) => {
                            const labels: Record<string, string> = {
                              totalrevenue: "Total Revenue",
                              roas: "ROAS (Return on Ad Spend)",
                              roi: "ROI (Return on Investment)",
                              profit: "Profit",
                              profitmargin: "Profit Margin",
                              revenueperlead: "Revenue Per Lead",
                            };
                            return (
                              <div key={metric} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`revenue-${metric}`}
                                  checked={customReportConfig.derivedMetrics.includes(metric)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: [...customReportConfig.derivedMetrics, metric],
                                      });
                                    } else {
                                      setCustomReportConfig({
                                        ...customReportConfig,
                                        derivedMetrics: customReportConfig.derivedMetrics.filter((m: any) => m !== metric),
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-revenue-${metric}`}
                                />
                                <Label htmlFor={`revenue-${metric}`} className="text-sm cursor-pointer">
                                  {labels[metric]}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Campaign Breakdown (per-campaign) */}
                  <AccordionItem value="campaign-breakdown">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Campaign Breakdown
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {(() => {
                          const campaigns = Array.from(
                            new Map(
                              (Array.isArray(metrics) ? metrics : []).map((m: any) => [
                                String(m?.campaignUrn || ""),
                                { urn: String(m?.campaignUrn || ""), name: String(m?.campaignName || "Campaign") },
                              ])
                            ).values()
                          ).filter((c: any) => !!c.urn);

                          if (campaigns.length === 0) {
                            return <p className="text-sm text-slate-500">No campaigns available.</p>;
                          }

                          const selected = Array.isArray((customReportConfig as any).campaignBreakdownCampaigns)
                            ? (customReportConfig as any).campaignBreakdownCampaigns
                            : [];

                          return (
                            <div className="space-y-2">
                              {campaigns.map((c: any) => {
                                const checked = selected.includes(c.urn);
                                return (
                                  <div key={c.urn} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`cbd-campaign-${c.urn}`}
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        const next = new Set<string>(selected);
                                        if (v) next.add(c.urn);
                                        else next.delete(c.urn);
                                        const arr = Array.from(next);
                                        setCustomReportConfig({
                                          ...customReportConfig,
                                          campaignBreakdownCampaigns: arr,
                                          includeCampaignBreakdown: arr.length > 0,
                                        } as any);
                                      }}
                                      data-testid={`checkbox-campaign-breakdown-campaign-${c.urn}`}
                                    />
                                    <Label htmlFor={`cbd-campaign-${c.urn}`} className="text-sm cursor-pointer">
                                      {c.name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Select which campaigns to include in the Campaign Breakdown section of the PDF.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  {/* KPIs */}
                  <AccordionItem value="kpis">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      KPIs
                    </AccordionTrigger>
                    <AccordionContent>
                      {kpisData && Array.isArray(kpisData) && kpisData.length > 0 ? (
                        <div className="space-y-2 pt-2">
                          {kpisData.map((kpi: any) => (
                            <div key={kpi.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`kpi-${kpi.id}`}
                                checked={customReportConfig.kpis.includes(kpi.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      kpis: [...customReportConfig.kpis, kpi.id],
                                    });
                                  } else {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      kpis: customReportConfig.kpis.filter((id: any) => id !== kpi.id),
                                    });
                                  }
                                }}
                                data-testid={`checkbox-kpi-${kpi.id}`}
                              />
                              <Label htmlFor={`kpi-${kpi.id}`} className="text-sm cursor-pointer">
                                {kpi.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 pt-2">No KPIs created yet</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Benchmarks */}
                  <AccordionItem value="benchmarks">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Benchmarks
                    </AccordionTrigger>
                    <AccordionContent>
                      {benchmarksData && Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                        <div className="space-y-2 pt-2">
                          {benchmarksData.map((benchmark: any) => (
                            <div key={benchmark.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`benchmark-${benchmark.id}`}
                                checked={customReportConfig.benchmarks.includes(benchmark.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      benchmarks: [...customReportConfig.benchmarks, benchmark.id],
                                    });
                                  } else {
                                    setCustomReportConfig({
                                      ...customReportConfig,
                                      benchmarks: customReportConfig.benchmarks.filter((id: any) => id !== benchmark.id),
                                    });
                                  }
                                }}
                                data-testid={`checkbox-benchmark-${benchmark.id}`}
                              />
                              <Label htmlFor={`benchmark-${benchmark.id}`} className="text-sm cursor-pointer">
                                {benchmark.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 pt-2">No benchmarks created yet</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Insights */}
                  <AccordionItem value="insights">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Insights
                    </AccordionTrigger>
                    <AccordionContent>
                      {(() => {
                        const selected = Array.isArray((customReportConfig as any).insightsSections)
                          ? (customReportConfig as any).insightsSections
                          : [];

                        const toggle = (key: string, enabled: boolean) => {
                          const next = new Set<string>(selected);
                          if (enabled) next.add(key);
                          else next.delete(key);
                          setCustomReportConfig({ ...customReportConfig, insightsSections: Array.from(next) } as any);
                        };

                        const items: Array<{ key: string; label: string }> = [
                          { key: "executive_financials", label: "Executive financials" },
                          { key: "trends", label: "Trends" },
                          { key: "what_changed", label: "What changed, what to do next" },
                        ];

                        return (
                          <div className="space-y-3 pt-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Choose which Insights sections to include in the PDF.
                            </p>
                            <div className="space-y-2">
                              {items.map((i) => (
                                <div key={i.key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`insights-${i.key}`}
                                    checked={selected.includes(i.key)}
                                    onCheckedChange={(v) => toggle(i.key, !!v)}
                                    data-testid={`checkbox-insights-${i.key}`}
                                  />
                                  <Label htmlFor={`insights-${i.key}`} className="text-sm cursor-pointer">
                                    {i.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Ad Comparison */}
                  <AccordionItem value="ad-comparison">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Ad Comparison
                    </AccordionTrigger>
                    <AccordionContent>
                      {(() => {
                        const hasAdLevelRevenue =
                          aggregated?.hasRevenueTracking === 1 && Number(aggregated?.conversionValue || 0) > 0;

                        const options: Array<{ key: string; label: string; gated?: boolean }> = [
                          { key: "impressions", label: "Impressions" },
                          { key: "reach", label: "Reach" },
                          { key: "clicks", label: "Clicks" },
                          { key: "engagements", label: "Engagements" },
                          { key: "spend", label: "Spend" },
                          { key: "conversions", label: "Conversions" },
                          { key: "leads", label: "Leads" },
                          { key: "ctr", label: "CTR" },
                          { key: "cpc", label: "CPC" },
                          { key: "cpm", label: "CPM" },
                          { key: "cvr", label: "CVR" },
                          { key: "cpa", label: "CPA" },
                          { key: "cpl", label: "CPL" },
                          { key: "er", label: "ER" },
                          { key: "revenue", label: "Revenue", gated: true },
                          { key: "roas", label: "ROAS", gated: true },
                          { key: "roi", label: "ROI", gated: true },
                          { key: "profit", label: "Profit", gated: true },
                          { key: "profitMargin", label: "Profit Margin", gated: true },
                          { key: "revenuePerLead", label: "Rev/Lead", gated: true },
                        ];

                        const selected = Array.isArray((customReportConfig as any).adComparisonMetrics)
                          ? (customReportConfig as any).adComparisonMetrics
                          : [];

                        const toggle = (k: string, enabled: boolean) => {
                          const next = new Set<string>(selected);
                          if (enabled) next.add(k);
                          else next.delete(k);
                          const arr = Array.from(next);
                          setCustomReportConfig({
                            ...customReportConfig,
                            adComparisonMetrics: arr,
                            includeAdComparison: arr.length > 0,
                          } as any);
                        };

                        return (
                          <div className="space-y-3 pt-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Select which ad metrics to include. If none are selected, Ad Comparison will be excluded
                              from the PDF.
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                              {options
                                .filter((o) => (o.gated ? hasAdLevelRevenue : true))
                                .map((o) => (
                                  <div key={o.key} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`adcomp-metric-${o.key}`}
                                      checked={selected.includes(o.key)}
                                      onCheckedChange={(v) => toggle(o.key, !!v)}
                                      data-testid={`checkbox-adcomp-metric-${o.key}`}
                                    />
                                    <Label htmlFor={`adcomp-metric-${o.key}`} className="text-sm cursor-pointer">
                                      {o.label}
                                    </Label>
                                  </div>
                                ))}
                            </div>

                            {!hasAdLevelRevenue ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Revenue metrics are hidden until a conversion value is connected.
                              </p>
                            ) : null}
                          </div>
                        );
                      })()}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Schedule Automated Reports Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="schedule-reports"
                    checked={reportForm.scheduleEnabled}
                    onCheckedChange={(checked) => {
                      const enabled = checked as boolean;
                      setReportForm({
                        ...reportForm,
                        scheduleEnabled: enabled,
                      });
                      if (!enabled) setReportFormErrors({});
                    }}
                    data-testid="checkbox-schedule-reports"
                  />
                  <Label htmlFor="schedule-reports" className="text-base cursor-pointer font-semibold">
                    Schedule Automated Reports
                  </Label>
                </div>

                {reportForm.scheduleEnabled && (
                  <div className="space-y-4 pl-6">
                    {/* Frequency */}
                    <div className="space-y-2">
                      <Label htmlFor="schedule-frequency">Frequency</Label>
                      <Select
                        value={reportForm.scheduleFrequency}
                        onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                      >
                        <SelectTrigger id="schedule-frequency" data-testid="select-frequency">
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

                    {/* Day of Week - Only for Weekly */}
                    {reportForm.scheduleFrequency === "weekly" && (
                      <div className="space-y-2">
                        <Label htmlFor="schedule-day">Day of Week</Label>
                        <Select
                          value={reportForm.scheduleDayOfWeek}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfWeek: value })}
                        >
                          <SelectTrigger id="schedule-day" data-testid="select-day">
                            <SelectValue />
                          </SelectTrigger>
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

                    {/* Quarter Timing - Only for Quarterly */}
                    {reportForm.scheduleFrequency === "quarterly" && (
                      <div className="space-y-2">
                        <Label htmlFor="quarter-timing">Quarter Timing</Label>
                        <Select
                          value={reportForm.quarterTiming}
                          onValueChange={(value) => setReportForm({ ...reportForm, quarterTiming: value })}
                        >
                          <SelectTrigger id="quarter-timing" data-testid="select-quarter-timing">
                            <SelectValue placeholder="End of Quarter" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="end">End of Quarter (Mar, Jun, Sep, Dec)</SelectItem>
                            <SelectItem value="start">Start of Quarter (Jan, Apr, Jul, Oct)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Choose whether to run reports at the start or end of each quarter
                        </p>
                      </div>
                    )}

                    {/* Day of Month - Only for Monthly and Quarterly */}
                    {(reportForm.scheduleFrequency === "monthly" ||
                      reportForm.scheduleFrequency === "quarterly") && (
                      <div className="space-y-2">
                        <Label htmlFor="schedule-day-month">Day of Month</Label>
                        <Select
                          value={reportForm.scheduleDayOfMonth}
                          onValueChange={(value) => setReportForm({ ...reportForm, scheduleDayOfMonth: value })}
                        >
                          <SelectTrigger id="schedule-day-month" data-testid="select-day-month">
                            <SelectValue placeholder="1st (First day of month)" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {reportForm.scheduleFrequency === "quarterly" ? (
                              <>
                                <SelectItem value="first">First day of month</SelectItem>
                                <SelectItem value="last">Last day of month</SelectItem>
                                <SelectItem value="15">Mid-month (15th)</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="first">1st (First day of month)</SelectItem>
                                <SelectItem value="last">Last day of month</SelectItem>
                                <SelectItem value="15">15th (Mid-month)</SelectItem>

                                <div className="border-t my-1"></div>
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  Specific Days
                                </div>

                                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                  const suffix = getOrdinalSuffix(day);
                                  const isCommon = [1, 5, 10, 15, 20, 25].includes(day);
                                  return (
                                    <SelectItem
                                      key={day}
                                      value={day.toString()}
                                      className={isCommon ? "font-medium" : ""}
                                    >
                                      {day}
                                      {suffix} {isCommon && "⭐"}
                                    </SelectItem>
                                  );
                                })}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {reportForm.scheduleFrequency === "quarterly"
                            ? "Quarterly reports typically run at the start, end, or middle of the quarter month"
                            : "For months with fewer days, the report will run on the last available day"}
                        </p>
                      </div>
                    )}

                    {/* Time */}
                    <div className="space-y-2">
                      <Label htmlFor="schedule-time">Time</Label>
                      <Select
                        value={reportForm.scheduleTime}
                        onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                      >
                        <SelectTrigger id="schedule-time" data-testid="select-time">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                          <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                          <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                          <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                          <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                          <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                          <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                          <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                          <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                          <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                          <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                          <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                          <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                      {userTimeZone && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          All times are in your time zone: {getTimeZoneDisplay()}
                        </p>
                      )}
                    </div>

                    {/* Email Recipients */}
                    <div className="space-y-2">
                      <Label htmlFor="email-recipients">
                        Email Recipients{reportForm.scheduleEnabled ? " *" : ""}
                      </Label>
                      <Input
                        id="email-recipients"
                        value={reportForm.emailRecipients}
                        onChange={(e) => {
                          const v = e.target.value;
                          setReportForm({ ...reportForm, emailRecipients: v });
                          if (reportFormErrors.emailRecipients && String(v || "").trim()) {
                            setReportFormErrors((prev: any) => ({ ...prev, emailRecipients: undefined }));
                          }
                        }}
                        placeholder="Enter email addresses (comma-separated)"
                        className={
                          reportFormErrors.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined
                        }
                        data-testid="input-email-recipients"
                      />
                      {reportFormErrors.emailRecipients ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{reportFormErrors.emailRecipients}</p>
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
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsReportModalOpen(false);
                setReportModalStep("standard");
                setEditingReportId(null);
                setReportForm({
                  name: "",
                  description: "",
                  reportType: "",
                  configuration: null,
                  scheduleEnabled: false,
                  scheduleFrequency: "weekly",
                  scheduleDayOfWeek: "monday",
                  scheduleTime: "9:00 AM",
                  emailRecipients: "",
                  status: "draft",
                });
              }}
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {reportModalStep === "standard" && reportForm.reportType && reportForm.reportType !== "custom" && (
                <Button
                  onClick={editingReportId ? handleUpdateReport : handleCreateReport}
                  disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                  data-testid={editingReportId ? "button-update-report" : "button-create-report-submit"}
                  className="gap-2"
                >
                  {createReportMutation.isPending || updateReportMutation.isPending ? (
                    editingReportId ? (
                      "Updating..."
                    ) : (
                      "Creating..."
                    )
                  ) : editingReportId ? (
                    "Update Report"
                  ) : reportForm.scheduleEnabled ? (
                    "Schedule Report"
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate & Download Report
                    </>
                  )}
                </Button>
              )}

              {reportModalStep === "custom" && (
                <Button
                  onClick={editingReportId ? handleUpdateReport : handleCustomReport}
                  disabled={!reportForm.name || createReportMutation.isPending || updateReportMutation.isPending}
                  data-testid={editingReportId ? "button-update-custom-report" : "button-create-custom-report"}
                  className="gap-2"
                >
                  {createReportMutation.isPending || updateReportMutation.isPending ? (
                    editingReportId ? (
                      "Updating..."
                    ) : (
                      "Creating..."
                    )
                  ) : editingReportId ? (
                    "Update Report"
                  ) : reportForm.scheduleEnabled ? (
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

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Activity, BarChart3, Download, FileText, Settings, Target, Trophy } from "lucide-react";

type LegacyProps = {
  isReportModalOpen: boolean;
  setIsReportModalOpen: (open: boolean) => void;
  reportModalStep: "standard" | "custom" | "type" | "configuration";
  setReportModalStep: (step: any) => void;
  editingReportId: string | null;
  setEditingReportId: (id: string | null) => void;
  reportForm: any;
  setReportForm: (next: any) => void;
  reportFormErrors: { emailRecipients?: string } | any;
  setReportFormErrors: (next: any) => void;
  customReportConfig: any;
  setCustomReportConfig: (next: any) => void;
  handleReportTypeSelect: (type: string) => void;
  handleCreateReport: () => void;
  handleUpdateReport: () => void;
  handleCustomReport: () => void;
  createReportMutation: any;
  updateReportMutation: any;
  userTimeZone?: string;
  getTimeZoneDisplay?: () => string;
};

const CORE_METRICS: Array<{ key: string; label: string }> = [
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "clicks", label: "Clicks" },
  { key: "engagements", label: "Engagements" },
  { key: "spend", label: "Spend" },
  { key: "conversions", label: "Conversions" },
  { key: "leads", label: "Leads" },
  { key: "videoviews", label: "Video Views" },
  { key: "viralimpressions", label: "Viral Impressions" },
];

const DERIVED_METRICS: Array<{ key: string; label: string }> = [
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "cvr", label: "CVR" },
  { key: "cpa", label: "CPA" },
  { key: "cpl", label: "CPL" },
  { key: "er", label: "ER (Engagement Rate)" },
  { key: "roi", label: "ROI" },
  { key: "roas", label: "ROAS" },
];

function LegacyLinkedInReportModal(props: LegacyProps) {
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    reportModalStep,
    setReportModalStep,
    editingReportId,
    setEditingReportId,
    reportForm,
    setReportForm,
    reportFormErrors,
    setReportFormErrors,
    customReportConfig,
    setCustomReportConfig,
    handleReportTypeSelect,
    handleCreateReport,
    handleUpdateReport,
    handleCustomReport,
    createReportMutation,
    updateReportMutation,
    userTimeZone,
    getTimeZoneDisplay,
  } = props;

  const isCustom = reportModalStep === "custom" || reportForm?.reportType === "custom";
  const isStandard = !isCustom;

  const canSubmit = useMemo(() => {
    const nameOk = !!String(reportForm?.name || "").trim();
    const pending = !!createReportMutation?.isPending || !!updateReportMutation?.isPending;
    return nameOk && !pending;
  }, [reportForm?.name, createReportMutation?.isPending, updateReportMutation?.isPending]);

  const submitLabel = useMemo(() => {
    const pending = !!createReportMutation?.isPending || !!updateReportMutation?.isPending;
    if (pending) return editingReportId ? "Updating..." : "Creating...";
    if (editingReportId) return "Update Report";
    if (reportForm?.scheduleEnabled) return "Schedule Report";
    return "Generate & Download Report";
  }, [createReportMutation?.isPending, updateReportMutation?.isPending, editingReportId, reportForm?.scheduleEnabled]);

  return (
    <Dialog
      open={isReportModalOpen}
      onOpenChange={(open) => {
        setIsReportModalOpen(open);
        if (!open) setEditingReportId(null);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create Report</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                reportModalStep === "standard" ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => setReportModalStep("standard")}
              data-testid="section-standard-templates"
            >
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Templates</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pre-built professional report templates</p>
                </div>
              </div>
            </div>

            <div
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                reportModalStep === "custom" ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"
              }`}
              onClick={() => {
                setReportModalStep("custom");
                if (!reportForm?.reportType || reportForm?.reportType !== "custom") {
                  handleReportTypeSelect("custom");
                } else if (!String(reportForm?.name || "").trim()) {
                  setReportForm({ ...reportForm, name: "Custom Report" });
                }
              }}
              data-testid="section-custom-report"
            >
              <div className="flex items-start gap-3">
                <Settings className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Report</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Build your own customized report</p>
                </div>
              </div>
            </div>
          </div>

          {/* Standard */}
          {reportModalStep === "standard" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Choose Template</h3>

              <div className="space-y-3">
                <TemplateRow
                  active={reportForm?.reportType === "overview"}
                  icon={<BarChart3 className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />}
                  title="Overview"
                  description="Comprehensive overview of campaign performance metrics"
                  onClick={() => handleReportTypeSelect("overview")}
                  testId="template-overview"
                />
                <TemplateRow
                  active={reportForm?.reportType === "kpis"}
                  icon={<Target className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />}
                  title="KPIs"
                  description="Key performance indicators and progress tracking"
                  onClick={() => handleReportTypeSelect("kpis")}
                  testId="template-kpis"
                />
                <TemplateRow
                  active={reportForm?.reportType === "benchmarks"}
                  icon={<Trophy className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />}
                  title="Benchmarks"
                  description="Performance benchmarks and comparisons"
                  onClick={() => handleReportTypeSelect("benchmarks")}
                  testId="template-benchmarks"
                />
                <TemplateRow
                  active={reportForm?.reportType === "ads"}
                  icon={<Activity className="w-5 h-5 text-slate-900 dark:text-white mt-0.5" />}
                  title="Ad Comparison"
                  description="Detailed ad-level performance analysis"
                  onClick={() => handleReportTypeSelect("ads")}
                  testId="template-ad-comparison"
                />
              </div>
            </div>
          )}

          {/* Custom */}
          {reportModalStep === "custom" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-report-name">Report Name</Label>
                  <Input
                    id="custom-report-name"
                    value={reportForm?.name || ""}
                    onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                    placeholder="Enter report name"
                    data-testid="input-custom-report-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-report-description">Description (Optional)</Label>
                  <Textarea
                    id="custom-report-description"
                    value={reportForm?.description || ""}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder="Add a description for this report"
                    rows={2}
                    data-testid="input-custom-report-description"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Metrics</h3>
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="linkedin-core-metrics">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">LinkedIn Core Metrics</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {CORE_METRICS.map((m) => (
                          <MetricCheckbox
                            key={m.key}
                            id={`core-${m.key}`}
                            label={m.label}
                            checked={Array.isArray(customReportConfig?.coreMetrics) && customReportConfig.coreMetrics.includes(m.key)}
                            onCheckedChange={(checked) => {
                              const current = Array.isArray(customReportConfig?.coreMetrics) ? customReportConfig.coreMetrics : [];
                              setCustomReportConfig({
                                ...customReportConfig,
                                coreMetrics: checked ? [...current, m.key] : current.filter((x: string) => x !== m.key),
                              });
                            }}
                            testId={`checkbox-core-${m.key}`}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="linkedin-derived-metrics">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 dark:text-slate-300">LinkedIn Derived Metrics</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {DERIVED_METRICS.map((m) => (
                          <MetricCheckbox
                            key={m.key}
                            id={`derived-${m.key}`}
                            label={m.label}
                            checked={Array.isArray(customReportConfig?.derivedMetrics) && customReportConfig.derivedMetrics.includes(m.key)}
                            onCheckedChange={(checked) => {
                              const current = Array.isArray(customReportConfig?.derivedMetrics) ? customReportConfig.derivedMetrics : [];
                              setCustomReportConfig({
                                ...customReportConfig,
                                derivedMetrics: checked ? [...current, m.key] : current.filter((x: string) => x !== m.key),
                              });
                            }}
                            testId={`checkbox-derived-${m.key}`}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          )}

          {/* Shared fields */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                value={reportForm?.name || ""}
                onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                placeholder="Enter report name"
                data-testid="input-report-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">Description (Optional)</Label>
              <Textarea
                id="report-description"
                value={reportForm?.description || ""}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                placeholder="Add a description for this report"
                rows={3}
                data-testid="input-report-description"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-enabled"
                checked={!!reportForm?.scheduleEnabled}
                onCheckedChange={(checked) => {
                  const enabled = !!checked;
                  setReportForm({ ...reportForm, scheduleEnabled: enabled });
                  if (!enabled) setReportFormErrors({});
                }}
                data-testid="checkbox-schedule-enabled"
              />
              <Label htmlFor="schedule-enabled" className="cursor-pointer">
                Enable schedule
              </Label>
            </div>

            {reportForm?.scheduleEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-frequency">Frequency</Label>
                  <Select
                    value={reportForm?.scheduleFrequency || "daily"}
                    onValueChange={(value) => setReportForm({ ...reportForm, scheduleFrequency: value })}
                  >
                    <SelectTrigger id="schedule-frequency" data-testid="select-frequency">
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

                <div className="space-y-2">
                  <Label htmlFor="schedule-time">Time</Label>
                  <Select
                    value={reportForm?.scheduleTime || "9:00 AM"}
                    onValueChange={(value) => setReportForm({ ...reportForm, scheduleTime: value })}
                  >
                    <SelectTrigger id="schedule-time" data-testid="select-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                      <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                      <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                      <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                      <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                      <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                      <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                      <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                      <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                      <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                      <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                      <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                      <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                  {userTimeZone && getTimeZoneDisplay && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      All times are in your time zone: {getTimeZoneDisplay()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-recipients">Email Recipients{reportForm?.scheduleEnabled ? " *" : ""}</Label>
                  <Input
                    id="email-recipients"
                    value={reportForm?.emailRecipients || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setReportForm({ ...reportForm, emailRecipients: v });
                      if (reportFormErrors?.emailRecipients && String(v || "").trim()) {
                        setReportFormErrors((prev: any) => ({ ...prev, emailRecipients: undefined }));
                      }
                    }}
                    placeholder="Enter email addresses (comma-separated)"
                    className={reportFormErrors?.emailRecipients ? "border-red-500 focus-visible:ring-red-500" : undefined}
                    data-testid="input-email-recipients"
                  />
                  {reportFormErrors?.emailRecipients ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{reportFormErrors.emailRecipients}</p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Reports will be automatically generated and sent to these email addresses</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setIsReportModalOpen(false)}
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>

            <Button
              onClick={() => {
                if (isStandard && reportForm?.reportType && reportForm.reportType !== "custom") {
                  (editingReportId ? handleUpdateReport : handleCreateReport)();
                  return;
                }
                if (isCustom) {
                  (editingReportId ? handleUpdateReport : handleCustomReport)();
                  return;
                }
                // fallback: behave like standard create
                (editingReportId ? handleUpdateReport : handleCreateReport)();
              }}
              disabled={!canSubmit}
              data-testid={editingReportId ? "button-update-report" : isCustom ? "button-create-custom-report" : "button-create-report-submit"}
              className="gap-2"
            >
              {!reportForm?.scheduleEnabled && !editingReportId && (
                <Download className="w-4 h-4" />
              )}
              {submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateRow(props: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-500 ${
        props.active ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"
      }`}
      onClick={props.onClick}
      data-testid={props.testId}
    >
      <div className="flex items-start gap-3">
        {props.icon}
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-white">{props.title}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{props.description}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCheckbox(props: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={props.id}
        checked={props.checked}
        onCheckedChange={(v) => props.onCheckedChange(!!v)}
        data-testid={props.testId}
      />
      <Label htmlFor={props.id} className="text-sm cursor-pointer">
        {props.label}
      </Label>
    </div>
  );
}


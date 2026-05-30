import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft,
  FileText, 
  Calendar, 
  Clock,
  Mail,
  Download,
  Plus,
  Trash2,
  Pause,
  Play,
  Edit,
  Search,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { reportStorage, type StoredReport } from "@/lib/reportStorage";

const customReportMetricGroups = [
  { title: "Web analytics", keys: ["users", "sessions", "cvr"] },
  { title: "Outcomes", keys: ["conversions", "revenue"] },
  { title: "Paid media", keys: ["impressions", "clicks", "spend", "ctr", "cpc", "cpm", "cpa", "roas", "roi", "leads"] },
];

const customReportPaidMetricKeys = new Set(["impressions", "clicks", "spend", "ctr", "cpc", "cpm", "cpa", "roas", "roi", "leads"]);
const CAMPAIGN_DEEPDIVE_REPORT_PLATFORM = "campaign_deepdive";

const customReportSections = [
  { key: "metrics", label: "Selected metrics" },
  { key: "kpis", label: "Campaign KPIs" },
  { key: "benchmarks", label: "Campaign Benchmarks" },
];

const REPORT_DESCRIPTION_MAX_LENGTH = 160;
const limitReportDescription = (value: string) => value.slice(0, REPORT_DESCRIPTION_MAX_LENGTH);

const campaignDeepDiveReportTypes = [
  {
    key: "performance-summary",
    label: "Performance Summary",
    tabs: [
      { key: "performance-summary:overview", label: "Overview" },
      { key: "performance-summary:health", label: "Campaign Health" },
      { key: "performance-summary:changes", label: "What's Changed" },
      { key: "performance-summary:insights", label: "Insights" },
    ],
  },
  {
    key: "financial-analysis",
    label: "Budget & Financial Analysis",
    tabs: [
      { key: "financial-analysis:overview", label: "Overview" },
      { key: "financial-analysis:roi-roas", label: "ROI & ROAS" },
      { key: "financial-analysis:costs", label: "Cost Analysis" },
      { key: "financial-analysis:budget", label: "Budget Allocation" },
      { key: "financial-analysis:insights", label: "Insights" },
    ],
  },
  {
    key: "platform-comparison",
    label: "Platform Comparison",
    tabs: [
      { key: "platform-comparison:overview", label: "Overview" },
      { key: "platform-comparison:performance", label: "Performance Metrics" },
      { key: "platform-comparison:cost-analysis", label: "Financial Comparison" },
      { key: "platform-comparison:insights", label: "Insights" },
    ],
  },
  {
    key: "trend-analysis",
    label: "Trend Analysis",
    tabs: [
      { key: "trend-analysis:overview", label: "Overview" },
      { key: "trend-analysis:efficiency", label: "Efficiency Metrics" },
      { key: "trend-analysis:funnel", label: "Conversion Funnel" },
      { key: "trend-analysis:platforms", label: "Platform Breakdown" },
      { key: "trend-analysis:insights", label: "Insights" },
    ],
  },
  {
    key: "executive-summary",
    label: "Executive Summary",
    tabs: [
      { key: "executive-summary:overview", label: "Executive Overview" },
      { key: "executive-summary:recommendations", label: "Strategic Recommendations" },
    ],
  },
];

const getCampaignReportTabs = (type: string) =>
  campaignDeepDiveReportTypes.find((reportType) => reportType.key === type)?.tabs || [];

const getReportTabLabel = (type: string, key: string) =>
  getCampaignReportTabs(type).find((tab) => tab.key === key)?.label
    || customReportSections.find((section) => section.key === key)?.label
    || key;

const getReportSelectedTabSummary = (report: StoredReport) => {
  const selectedSections = Array.isArray(report.selectedSections) ? report.selectedSections : [];
  return selectedSections.length > 0
    ? selectedSections.map((section) => getReportTabLabel(report.type, section)).join(", ")
    : "No tabs selected";
};

const reportTypeLabels: Record<string, string> = {
  performance: "Performance Summary",
  financial: "Financial Analysis",
  kpi: "KPI Tracking",
  custom: "Custom Report",
};

const getReportTypeLabel = (type: string) =>
  campaignDeepDiveReportTypes.find((reportType) => reportType.key === type)?.label
    || reportTypeLabels[type]
    || type;


const customReportMetricLabels: Record<string, string> = {
  users: "Users",
  sessions: "Sessions",
  conversions: "Conversions",
  revenue: "Revenue",
  cvr: "Conversion rate",
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
  ctr: "Click-through rate",
  cpc: "Cost per click",
  cpm: "Cost per thousand impressions",
  cpa: "Cost per acquisition",
  roas: "ROAS",
  roi: "ROI",
  leads: "Leads",
};

const customReportMetricAliases: Record<string, string> = {
  totalusers: "users",
  users: "users",
  user: "users",
  totalsessions: "sessions",
  sessions: "sessions",
  totalrevenue: "revenue",
  revenue: "revenue",
  totalconversions: "conversions",
  conversions: "conversions",
  totalspend: "spend",
  spend: "spend",
  totalclicks: "clicks",
  clicks: "clicks",
  totalimpressions: "impressions",
  impressions: "impressions",
  roas: "roas",
  roi: "roi",
  ctr: "ctr",
  cvr: "cvr",
  conversionrate: "cvr",
  cpa: "cpa",
  cpc: "cpc",
  cpm: "cpm",
};

const formatCustomReportMetricValue = (key: string, value: unknown): string => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return "Unavailable";
  if (["revenue", "spend", "cpc", "cpa", "cpm"].includes(key)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(numericValue);
  }
  if (["ctr", "cvr", "roi"].includes(key)) return `${numericValue.toFixed(1)}%`;
  if (key === "roas") return `${numericValue.toFixed(1)}x`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numericValue);
};

const customReportNormalizeMetricKey = (value: unknown): string =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const formatRecommendationText = (text: string): string =>
  text ? text.replace(/([+-]?)\$(\d+)(?!\.\d)/g, (_match, sign, number) => `${sign}$${parseInt(number).toLocaleString("en-US")}`) : text;

const normalizeReportRecipients = (value: string): string[] =>
  value.split(',').map(email => email.trim()).filter(email => email);

const scheduleDayOfWeekToInt = (value: string) => ({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}[value.toLowerCase()] ?? 1);

const getDefaultScheduleDayForFrequency = (frequency: string) => {
  if (frequency === "weekly") return "monday";
  if (frequency === "monthly") return "1";
  if (frequency === "quarterly") return "end";
  return "monday";
};

const getReportFormSignature = (values: {
  name: string;
  description: string;
  type: string;
  selectedCampaigns: string[];
  scheduleEnabled: boolean;
  scheduleFrequency: string;
  scheduleDay: string;
  scheduleTime: string;
  recipients: string;
  selectedReportMetrics: string[];
  selectedReportSections: string[];
}) => JSON.stringify({
  ...values,
  name: values.name.trim(),
  description: values.description.trim(),
  selectedCampaigns: [...values.selectedCampaigns].sort(),
  recipients: normalizeReportRecipients(values.recipients),
  selectedReportMetrics: [...values.selectedReportMetrics].sort(),
  selectedReportSections: [...values.selectedReportSections].sort(),
});

export default function Reports() {
  const campaignContextId = (() => {
    try {
      return new URLSearchParams(window.location.search).get("campaignId") || "";
    } catch {
      return "";
    }
  })();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(() => campaignContextId ? [campaignContextId] : []);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("daily");
  const [scheduleDay, setScheduleDay] = useState("monday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [recipients, setRecipients] = useState("");
  const [allStoredReports, setAllStoredReports] = useState<StoredReport[]>([]);
  const [selectedReportMetrics, setSelectedReportMetrics] = useState<string[]>([]);
  const [selectedReportSections, setSelectedReportSections] = useState<string[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [originalReportFormSignature, setOriginalReportFormSignature] = useState("");
  const [reportPendingDelete, setReportPendingDelete] = useState<StoredReport | null>(null);
  const [reportSaveError, setReportSaveError] = useState("");
  
  // Filter states for All Reports tab
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const { data: campaignOutcomeTotals, isLoading: campaignOutcomeTotalsLoading, refetch: refetchCampaignOutcomeTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignContextId}/outcome-totals`, "90days"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignContextId}/outcome-totals?dateRange=90days`, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignContextId,
    refetchOnWindowFocus: true,
  });

  const { data: liveCampaignExecutiveSummary, refetch: refetchCampaignExecutiveSummary } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignContextId}/executive-summary`, "reports"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignContextId}/executive-summary`, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignContextId,
    refetchOnWindowFocus: true,
  });

  const { data: liveCampaignFinancialContext, refetch: refetchCampaignFinancialContext } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignContextId],
    enabled: !!campaignContextId,
    refetchOnWindowFocus: true,
  });

  const { data: liveCampaignKpis = [], refetch: refetchCampaignKpis } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignContextId}/kpis`],
    enabled: !!campaignContextId,
  });

  const { data: liveCampaignBenchmarks = [], refetch: refetchCampaignBenchmarks } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignContextId}/benchmarks`],
    enabled: !!campaignContextId,
  });

  const campaignExecutiveSummary = liveCampaignExecutiveSummary;
  const campaignFinancialContext = liveCampaignFinancialContext;
  const campaignKpis = liveCampaignKpis;
  const campaignBenchmarks = liveCampaignBenchmarks;
  const customReportPerformanceSummary = campaignOutcomeTotals?.performanceSummary;
  const customReportAllSources = Array.isArray(customReportPerformanceSummary?.sources) ? customReportPerformanceSummary.sources : [];
  const customReportSources = customReportAllSources.filter((source: any) => source?.connected === true && source?.category !== "financial");
  const customReportAvailableMetricKeys = Object.entries(customReportPerformanceSummary?.totals || {})
    .filter(([, metric]: [string, any]) => metric?.available === true)
    .map(([key]) => key);
  const hasCustomReportPaidMediaSource = customReportSources.some((source: any) => {
    const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics : [];
    return source?.category === "paid_media" && includedMetrics.some((metric: string) => customReportPaidMetricKeys.has(metric));
  });
  const customReportSelectableMetricKeys = customReportAvailableMetricKeys
    .filter((key) => !customReportPaidMetricKeys.has(key) || hasCustomReportPaidMediaSource);
  const customReportSelectableMetricSet = new Set(customReportSelectableMetricKeys);
  const campaignReportTabs = campaignContextId ? getCampaignReportTabs(reportType) : [];

  // Load reports from storage
  useEffect(() => {
    const loadReports = () => {
      const allReports = reportStorage.getReports();
      
      // Add mock data if no reports exist
      if (allReports.length === 0) {
        const mockReports = [
          // Generated Reports
          {
            name: "Q3 Performance Analysis",
            type: "Performance",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 10, 14, 30),
            format: 'PDF',
            size: '2.4 MB',
            campaignName: "Digital Marketing Q3",
            includeKPIs: true,
            includeBenchmarks: false
          },
          {
            name: "Weekly Social Media Report",
            type: "Social Media",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 8, 9, 15),
            format: 'PDF',
            size: '1.8 MB',
            campaignName: "Social Media Campaign",
            includeKPIs: false,
            includeBenchmarks: true
          },
          {
            name: "August ROI Dashboard",
            type: "Financial",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 5, 16, 45),
            format: 'Excel',
            size: '856 KB',
            campaignName: "Brand Awareness",
            includeKPIs: true,
            includeBenchmarks: true
          },
          {
            name: "Lead Generation Summary",
            type: "Lead Generation",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 7, 2, 11, 20),
            format: 'PDF',
            size: '3.1 MB',
            campaignName: "Q3 Lead Generation",
            includeKPIs: true,
            includeBenchmarks: false
          },
          {
            name: "Campaign Comparison Analysis",
            type: "Comparative",
            status: 'Generated' as const,
            generatedAt: new Date(2025, 6, 28, 13, 10),
            format: 'PDF',
            size: '4.2 MB',
            campaignName: "All Campaigns",
            includeKPIs: true,
            includeBenchmarks: true
          },
          
          // Scheduled Reports
          {
            name: "Daily KPI Monitor",
            type: "KPI Tracking",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 11, 10, 0),
            format: 'PDF',
            campaignName: "Digital Marketing Q3",
            includeKPIs: true,
            includeBenchmarks: false,
            schedule: {
              frequency: "Daily",
              day: "monday",
              time: "08:00",
              recipients: ["team@company.com", "manager@company.com"]
            }
          },
          {
            name: "Weekly Performance Digest",
            type: "Performance",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 9, 15, 30),
            format: 'PDF',
            campaignName: "Social Media Campaign",
            includeKPIs: false,
            includeBenchmarks: true,
            schedule: {
              frequency: "Weekly",
              day: "monday",
              time: "09:00",
              recipients: ["sarah.johnson@company.com", "marketing@company.com"]
            }
          },
          {
            name: "Monthly Executive Summary",
            type: "Executive",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 7, 12, 0),
            format: 'PDF',
            campaignName: "All Campaigns",
            includeKPIs: true,
            includeBenchmarks: true,
            schedule: {
              frequency: "Monthly",
              day: "1",
              time: "15:00",
              recipients: ["ceo@company.com", "cfo@company.com", "marketing-lead@company.com"]
            }
          },
          {
            name: "Bi-weekly ROI Tracker",
            type: "Financial",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 6, 14, 15),
            format: 'Excel',
            campaignName: "Brand Awareness",
            includeKPIs: true,
            includeBenchmarks: false,
            schedule: {
              frequency: "Bi-weekly",
              day: "monday",
              time: "14:00",
              recipients: ["finance@company.com", "marketing-budget@company.com"]
            }
          },
          {
            name: "Platform Performance Review",
            type: "Platform Analysis",
            status: 'Scheduled' as const,
            generatedAt: new Date(2025, 7, 4, 11, 45),
            format: 'PDF',
            campaignName: "Q3 Lead Generation",
            includeKPIs: false,
            includeBenchmarks: true,
            schedule: {
              frequency: "Weekly",
              day: "friday",
              time: "11:00",
              recipients: ["platform-team@company.com"]
            }
          }
        ];

        // Add each mock report to storage
        mockReports.forEach(report => {
          reportStorage.addReport(report);
        });
        
        // Reload after adding mock data
        const updatedReports = reportStorage.getReports();
        setAllStoredReports(updatedReports);
        return;
      }
      
      setAllStoredReports(allReports);
    };
    
    loadReports();
    
    // Listen for storage changes (when reports are added from other components)
    const handleStorageChange = () => loadReports();
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events from same page
    window.addEventListener('reportAdded', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('reportAdded', handleStorageChange);
    };
  }, []);

  const resetForm = () => {
    setReportName("");
    setReportDescription("");
    setReportType("");
    setSelectedCampaigns(campaignContextId ? [campaignContextId] : []);
    setSelectedReportMetrics([]);
    setSelectedReportSections([]);
    setEditingReportId(null);
    setOriginalReportFormSignature("");
    setReportSaveError("");
    setScheduleEnabled(false);
    setScheduleFrequency("daily");
    setScheduleDay("monday");
    setScheduleTime("09:00");
    setRecipients("");
  };

  const reportFormSignature = getReportFormSignature({
    name: reportName,
    description: reportDescription,
    type: reportType,
    selectedCampaigns,
    scheduleEnabled,
    scheduleFrequency,
    scheduleDay,
    scheduleTime,
    recipients,
    selectedReportMetrics,
    selectedReportSections,
  });
  const isReportFormChanged = !editingReportId || reportFormSignature !== originalReportFormSignature;
  const isReportFormValid = !!reportName.trim()
    && !!reportType
    && (!scheduleEnabled || !!recipients.trim())
    && (!campaignContextId
      || (selectedReportSections.length > 0
        && (reportType !== "custom" || !selectedReportSections.includes("metrics") || selectedReportMetrics.length > 0)));

  const buildReportPayload = (status: StoredReport["status"]): Omit<StoredReport, "id" | "generatedAt"> => {
    const activeCampaignId = campaignContextId || selectedCampaigns[0] || "";
    return {
      name: reportName,
      type: reportType,
      description: reportDescription.trim() || undefined,
      status,
      campaignId: activeCampaignId || undefined,
      format: 'PDF',
      includeKPIs: reportType === "custom" && selectedReportSections.includes("kpis"),
      includeBenchmarks: reportType === "custom" && selectedReportSections.includes("benchmarks"),
      selectedMetrics: reportType === "custom" && activeCampaignId ? selectedReportMetrics : undefined,
      selectedSections: activeCampaignId ? selectedReportSections : undefined,
      schedule: status === "Scheduled" ? {
        frequency: scheduleFrequency,
        day: scheduleDay,
        time: scheduleTime,
        recipients: normalizeReportRecipients(recipients)
      } : null
    };
  };

  const buildBackendScheduledReportPayload = (reportPayload: Omit<StoredReport, "id" | "generatedAt">) => {
    const schedule = reportPayload.schedule;
    const frequency = String(schedule?.frequency || "daily").toLowerCase();
    const payload: Record<string, any> = {
      campaignId: reportPayload.campaignId,
      name: reportPayload.name,
      description: reportPayload.description || null,
      reportType: "custom",
      configuration: {
        reportType: reportPayload.type,
        selectedSections: reportPayload.selectedSections || [],
        selectedMetrics: reportPayload.selectedMetrics || [],
        createdFrom: "campaign-deepdive-custom-report",
      },
      status: "active",
      scheduleEnabled: true,
      scheduleFrequency: frequency,
      scheduleTime: schedule?.time || "09:00",
      scheduleTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      scheduleRecipients: schedule?.recipients || [],
    };

    if (frequency === "weekly") payload.scheduleDayOfWeek = scheduleDayOfWeekToInt(schedule?.day || "monday");
    if (frequency === "monthly") {
      payload.scheduleDayOfMonth = schedule?.day === "last" ? 0 : Number(schedule?.day) || 1;
    }
    if (frequency === "quarterly") {
      payload.scheduleDayOfMonth = schedule?.day === "start" ? 1 : 0;
      payload.quarterTiming = schedule?.day === "start" ? "start" : "end";
    }

    return payload;
  };

  const saveBackendScheduledReport = async (reportPayload: Omit<StoredReport, "id" | "generatedAt">, backendReportId?: string) => {
    const response = await fetch(`/api/platforms/${CAMPAIGN_DEEPDIVE_REPORT_PLATFORM}/reports${backendReportId ? `/${encodeURIComponent(backendReportId)}` : ""}`, {
      method: backendReportId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBackendScheduledReportPayload(reportPayload)),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || "Failed to save scheduled report");
    }
    return response.json();
  };

  const disableBackendScheduledReport = async (backendReportId: string, backendPlatformType = CAMPAIGN_DEEPDIVE_REPORT_PLATFORM) => {
    const response = await fetch(`/api/platforms/${backendPlatformType}/reports/${encodeURIComponent(backendReportId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleEnabled: false, status: "paused" }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || "Failed to pause scheduled report");
    }
  };

  const openEditReport = (report: StoredReport) => {
    const nextSelectedCampaigns = report.campaignId ? [report.campaignId] : (campaignContextId ? [campaignContextId] : []);
    const nextSelectedSections = Array.isArray(report.selectedSections)
      ? report.selectedSections
      : [
          ...(Array.isArray(report.selectedMetrics) && report.selectedMetrics.length > 0 ? ["metrics"] : []),
          ...(report.includeKPIs ? ["kpis"] : []),
          ...(report.includeBenchmarks ? ["benchmarks"] : []),
        ];
    const nextValues = {
      name: report.name || "",
      description: limitReportDescription(report.description || ""),
      type: report.type || "performance",
      selectedCampaigns: nextSelectedCampaigns,
      scheduleEnabled: !!report.schedule,
      scheduleFrequency: report.schedule?.frequency || "daily",
      scheduleDay: report.schedule?.day || "monday",
      scheduleTime: report.schedule?.time || "09:00",
      recipients: report.schedule?.recipients?.join(", ") || "",
      selectedReportMetrics: Array.isArray(report.selectedMetrics) ? report.selectedMetrics : [],
      selectedReportSections: nextSelectedSections.length > 0 ? nextSelectedSections : ["metrics"],
    };

    setEditingReportId(report.id);
    setReportName(nextValues.name);
    setReportDescription(nextValues.description);
    setReportType(nextValues.type);
    setSelectedCampaigns(nextValues.selectedCampaigns);
    setScheduleEnabled(nextValues.scheduleEnabled);
    setScheduleFrequency(nextValues.scheduleFrequency);
    setScheduleDay(nextValues.scheduleDay);
    setScheduleTime(nextValues.scheduleTime);
    setRecipients(nextValues.recipients);
    setSelectedReportMetrics(nextValues.selectedReportMetrics);
    setSelectedReportSections(nextValues.selectedReportSections);
    setOriginalReportFormSignature(getReportFormSignature(nextValues));
    setShowCreateDialog(true);
  };

  const openCreateReport = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const saveReport = async () => {
    setReportSaveError("");
    const reportPayload = buildReportPayload(scheduleEnabled ? "Scheduled" : "Generated");

    try {
      const existingReport = editingReportId
        ? allStoredReports.find((report) => report.id === editingReportId)
        : undefined;
      const backendReportId = existingReport?.backendReportId;
      const backendPlatformType = existingReport?.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM;

      if (editingReportId) {
        if (scheduleEnabled) {
          const backendReport = await saveBackendScheduledReport(reportPayload, backendReportId);
          reportStorage.updateReport(editingReportId, {
            ...reportPayload,
            backendReportId: String(backendReport?.id || backendReportId || ""),
            backendPlatformType,
          });
        } else {
          if (backendReportId) await disableBackendScheduledReport(backendReportId, backendPlatformType);
          reportStorage.updateReport(editingReportId, reportPayload);
        }
      } else if (scheduleEnabled) {
        const backendReport = await saveBackendScheduledReport(reportPayload);
        reportStorage.addReport({
          ...reportPayload,
          backendReportId: String(backendReport?.id || ""),
          backendPlatformType: CAMPAIGN_DEEPDIVE_REPORT_PLATFORM,
          generatedAt: new Date(),
        });
      } else {
        const savedReport = reportStorage.addReport({
          ...reportPayload,
          generatedAt: new Date(),
        });
        await downloadReportPdf(savedReport);
      }
    } catch (error: any) {
      setReportSaveError(error?.message || "Failed to save report");
      return;
    }
    
    // Refresh the reports list
    const allReports = reportStorage.getReports();
    setAllStoredReports(allReports);
    
    setShowCreateDialog(false);
    resetForm();
  };

  const deletePendingReport = async () => {
    if (!reportPendingDelete) return;
    try {
      if (reportPendingDelete.backendReportId) {
        const response = await fetch(`/api/platforms/${reportPendingDelete.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM}/reports/${encodeURIComponent(reportPendingDelete.backendReportId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to delete scheduled report");
      }
      reportStorage.deleteReport(reportPendingDelete.id);
      setAllStoredReports(reportStorage.getReports());
      setReportPendingDelete(null);
    } catch (error: any) {
      setReportSaveError(error?.message || "Failed to delete report");
    }
  };

  const pauseScheduledReport = async (report: StoredReport) => {
    setReportSaveError("");
    try {
      if (report.backendReportId) await disableBackendScheduledReport(report.backendReportId, report.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM);
      reportStorage.updateReport(report.id, { status: "Paused" });
      setAllStoredReports(reportStorage.getReports());
    } catch (error: any) {
      setReportSaveError(error?.message || "Failed to pause scheduled report");
    }
  };

  const resumeScheduledReport = async (report: StoredReport) => {
    setReportSaveError("");
    if (!report.schedule) {
      setReportSaveError("Cannot resume report because schedule details are missing.");
      return;
    }
    try {
      const reportPayload: Omit<StoredReport, "id" | "generatedAt"> = {
        name: report.name,
        type: report.type,
        description: report.description,
        status: "Scheduled",
        campaignId: report.campaignId,
        campaignName: report.campaignName,
        format: report.format,
        size: report.size,
        includeKPIs: report.includeKPIs,
        includeBenchmarks: report.includeBenchmarks,
        selectedMetrics: report.selectedMetrics,
        selectedSections: report.selectedSections,
        backendReportId: report.backendReportId,
        backendPlatformType: report.backendPlatformType,
        schedule: report.schedule,
        downloadUrl: report.downloadUrl,
      };
      const backendReport = await saveBackendScheduledReport(reportPayload, report.backendReportId);
      reportStorage.updateReport(report.id, {
        status: "Scheduled",
        backendReportId: String(backendReport?.id || report.backendReportId || ""),
        backendPlatformType: report.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM,
      });
      setAllStoredReports(reportStorage.getReports());
    } catch (error: any) {
      setReportSaveError(error?.message || "Failed to resume scheduled report");
    }
  };

  // Filter reports for All Reports tab
  const filteredReports = allStoredReports.filter(report => {
    // Search query filter
    if (searchQuery && !report.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !report.campaignName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Type filter
    if (typeFilter !== "all" && report.type !== typeFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const reportDate = new Date(report.generatedAt);
      const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today":
          if (daysDiff !== 0) return false;
          break;
        case "week":
          if (daysDiff > 7) return false;
          break;
        case "month":
          if (daysDiff > 30) return false;
          break;
        case "quarter":
          if (daysDiff > 90) return false;
          break;
      }
    }

    return true;
  });
  const standardReports = allStoredReports.filter(report => report.status === 'Generated');
  const storedScheduledReports = allStoredReports.filter(report => (report.status === 'Scheduled' || report.status === 'Paused') && report.schedule);

  // Get unique report types for filter dropdown
  const uniqueTypes = Array.from(new Set(
    allStoredReports.map(r => r.type).filter(Boolean)
  ));

  const resolveCustomReportAggregateMetric = (record: any): string | null => {
    for (const candidate of [record?.metricKey, record?.metric, record?.metricType, record?.name]) {
      const metricName = customReportMetricAliases[customReportNormalizeMetricKey(candidate)];
      if (metricName && customReportPerformanceSummary?.totals?.[metricName]?.available === true) return metricName;
    }
    return null;
  };

  const renderCustomReportMetricOutput = (report: StoredReport) => {
    const selectedMetrics = Array.isArray(report.selectedMetrics) ? report.selectedMetrics : [];
    const selectedSections = Array.isArray(report.selectedSections) ? report.selectedSections : ["metrics"];
    if (!selectedSections.includes("metrics") || !campaignContextId || report.campaignId !== campaignContextId || report.type !== "custom" || selectedMetrics.length === 0) return null;
    if (!customReportPerformanceSummary) {
      return (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          Connected-source report values are unavailable until the campaign aggregate loads.
        </div>
      );
    }

    return (
      <div className="rounded-md border p-3 text-sm">
        <div className="font-medium text-foreground mb-2">Connected-source report values</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {selectedMetrics.map((key) => {
            const metric = customReportPerformanceSummary?.totals?.[key];
            const available = metric?.available === true;
            const reason = Array.isArray(metric?.unavailableReasons) ? metric.unavailableReasons[0] : "";
            return (
              <div key={key}>
                <span className="text-muted-foreground">{customReportMetricLabels[key] || key}: </span>
                <span className={available ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {available ? formatCustomReportMetricValue(key, metric?.value) : `Unavailable${reason ? ` - ${reason}` : ""}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomReportKpiBenchmarkOutput = (report: StoredReport) => {
    const selectedSections = Array.isArray(report.selectedSections) ? report.selectedSections : [];
    if (!campaignContextId || report.campaignId !== campaignContextId || report.type !== "custom") return null;
    if (!selectedSections.includes("kpis") && !selectedSections.includes("benchmarks")) return null;
    if (!customReportPerformanceSummary) {
      return (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          KPI and Benchmark report values are unavailable until the campaign aggregate loads.
        </div>
      );
    }

    const renderRows = (records: any[], targetField: "targetValue" | "benchmarkValue") => records.map((record) => {
      const metricKey = resolveCustomReportAggregateMetric(record);
      const metric = metricKey ? customReportPerformanceSummary?.totals?.[metricKey] : null;
      return (
        <div key={record.id || record.name} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <span>{record.name || record.metric || "Untitled"}</span>
          <span>Current: {metric?.available === true ? formatCustomReportMetricValue(metricKey!, metric.value) : "Unavailable"}</span>
          <span>Target: {formatCustomReportMetricValue(metricKey || "", record?.[targetField])}</span>
        </div>
      );
    });

    return (
      <div className="rounded-md border p-3 text-sm space-y-3">
        {selectedSections.includes("kpis") && (
          <div>
            <div className="font-medium text-foreground mb-2">Campaign KPI rows</div>
            {campaignKpis.length > 0 ? renderRows(campaignKpis, "targetValue") : <div className="text-muted-foreground">No campaign KPI rows configured.</div>}
          </div>
        )}
        {selectedSections.includes("benchmarks") && (
          <div>
            <div className="font-medium text-foreground mb-2">Campaign Benchmark rows</div>
            {campaignBenchmarks.length > 0 ? renderRows(campaignBenchmarks, "benchmarkValue") : <div className="text-muted-foreground">No campaign Benchmark rows configured.</div>}
          </div>
        )}
      </div>
    );
  };

  const downloadReportPdf = async (report: StoredReport) => {
    const fetchReportJson = async (url: string) => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    };
    const reportCampaignId = report.campaignId || campaignContextId;
    const encodedReportCampaignId = encodeURIComponent(reportCampaignId);
    const shouldRefreshCurrentCampaignContext = !!reportCampaignId && reportCampaignId === campaignContextId;
    const [
      latestOutcomeTotalsResult,
      latestExecutiveSummaryResult,
      latestFinancialContextResult,
      latestKpisResult,
      latestBenchmarksResult,
    ] = shouldRefreshCurrentCampaignContext
      ? await Promise.all([
          refetchCampaignOutcomeTotals(),
          refetchCampaignExecutiveSummary(),
          refetchCampaignFinancialContext(),
          refetchCampaignKpis(),
          refetchCampaignBenchmarks(),
        ])
      : reportCampaignId
        ? await Promise.all([
            fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/outcome-totals?dateRange=90days`).then((data) => ({ data })),
            fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/executive-summary`).then((data) => ({ data })),
            fetchReportJson(`/api/campaigns/${encodedReportCampaignId}`).then((data) => ({ data })),
            fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/kpis`).then((data) => ({ data })),
            fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/benchmarks`).then((data) => ({ data })),
          ])
      : [];
    const latestCampaignOutcomeTotals = latestOutcomeTotalsResult?.data ?? campaignOutcomeTotals;
    const customReportPerformanceSummary = latestCampaignOutcomeTotals?.performanceSummary;
    const customReportAllSources = Array.isArray(customReportPerformanceSummary?.sources) ? customReportPerformanceSummary.sources : [];
    const customReportSources = customReportAllSources.filter((source: any) => source?.connected === true && source?.category !== "financial");
    const campaignExecutiveSummary = latestExecutiveSummaryResult?.data ?? liveCampaignExecutiveSummary;
    const campaignFinancialContext = latestFinancialContextResult?.data ?? liveCampaignFinancialContext;
    const campaignKpis: any[] = Array.isArray(latestKpisResult?.data) ? latestKpisResult.data : liveCampaignKpis;
    const campaignBenchmarks: any[] = Array.isArray(latestBenchmarksResult?.data) ? latestBenchmarksResult.data : liveCampaignBenchmarks;
    const selectedReportSections = Array.isArray(report.selectedSections) ? report.selectedSections.map(String) : [];
    const needsTrendAnalysis = selectedReportSections.some((section) => section.startsWith("trend-analysis:"));
    const latestTrendAnalysis = needsTrendAnalysis && reportCampaignId
      ? await fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/trend-analysis?dateRange=90days&days=180`)
      : null;
    const campaignTrendAnalysis = latestTrendAnalysis?.trendAnalysis;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const margin = 18;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = margin;

    const addText = (text: string, options: { size?: number; bold?: boolean; indent?: number } = {}) => {
      const indent = options.indent || 0;
      doc.setFontSize(options.size || 10);
      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin + indent, yPosition);
        yPosition += options.size && options.size >= 14 ? 8 : 6;
      });
    };

    const metricValue = (key: string) => {
      const metric = customReportPerformanceSummary?.totals?.[key];
      if (metric?.available === true) return formatCustomReportMetricValue(key, metric.value);
      const reason = Array.isArray(metric?.unavailableReasons) ? metric.unavailableReasons[0] : "";
      return `Unavailable${reason ? ` - ${reason}` : ""}`;
    };
    const metricAvailable = (key: string) => customReportPerformanceSummary?.totals?.[key]?.available === true;
    const metricNumber = (key: string) => {
      const metric = customReportPerformanceSummary?.totals?.[key];
      return metric?.available === true ? Number(metric.value) || 0 : 0;
    };
    const lowerIsBetterMetrics = new Set(["cpa", "cpc", "cpm"]);
    const progressPct = (current: number, target: number, metricKey: string) => {
      if (target <= 0) return 0;
      const ratio = lowerIsBetterMetrics.has(metricKey) ? (current > 0 ? target / current : 1) : current / target;
      return ratio * 100;
    };
    const executiveKpiRows = Array.isArray(campaignExecutiveSummary?.kpiProgress)
      ? campaignExecutiveSummary.kpiProgress
        .map((kpi: any) => ({ ...kpi, aggregateMetric: resolveCustomReportAggregateMetric(kpi) }))
        .filter((kpi: any) => kpi.aggregateMetric)
      : [];
    const executiveBenchmarkRows = Array.isArray(campaignExecutiveSummary?.benchmarkComparison)
      ? campaignExecutiveSummary.benchmarkComparison
        .map((bm: any) => ({ ...bm, aggregateMetric: resolveCustomReportAggregateMetric(bm) }))
        .filter((bm: any) => bm.aggregateMetric)
      : [];
    const performanceKpiRows = campaignKpis
      .map((kpi: any) => ({ ...kpi, aggregateMetric: resolveCustomReportAggregateMetric(kpi) }))
      .filter((kpi: any) => kpi.aggregateMetric);
    const performanceBenchmarkRows = campaignBenchmarks
      .map((bm: any) => ({ ...bm, aggregateMetric: resolveCustomReportAggregateMetric(bm) }))
      .filter((bm: any) => bm.aggregateMetric);
    const kpiTargetValue = (kpi: any) => Number(kpi.targetValue ?? kpi.target) || 0;
    const benchmarkTargetValue = (benchmark: any) => Number(benchmark.benchmarkValue ?? benchmark.benchmark) || 0;
    const kpiStatus = (kpi: any) => {
      const current = metricNumber(kpi.aggregateMetric);
      const target = kpiTargetValue(kpi);
      const pct = progressPct(current, target, kpi.aggregateMetric);
      return pct > 105 ? "Above Target" : pct >= 95 ? "On Track" : "Below Target";
    };
    const benchmarkStatus = (benchmark: any) => {
      const pct = progressPct(metricNumber(benchmark.aggregateMetric), benchmarkTargetValue(benchmark), benchmark.aggregateMetric);
      return pct >= 90 ? "On Track" : pct >= 70 ? "Needs Attention" : "Below Target";
    };
    const performanceHealthScore = () => {
      const total = performanceKpiRows.length + performanceBenchmarkRows.length;
      if (total === 0) return null;
      const onTrack = performanceKpiRows.filter((kpi: any) => kpiStatus(kpi) !== "Below Target").length
        + performanceBenchmarkRows.filter((benchmark: any) => benchmarkStatus(benchmark) === "On Track").length;
      return { total, onTrack, score: Math.round((onTrack / total) * 100) };
    };
    const addPerformanceSummaryContent = (section: string) => {
      const health = performanceHealthScore();
      if (section === "performance-summary:overview") {
        addText("Campaign Health", { bold: true, indent: 4 });
        addText(health ? `${health.score}% - ${health.onTrack} of ${health.total} metrics on track` : "Set up KPIs and Benchmarks to see campaign health.", { indent: 8 });
        addText("Top Priority Action", { bold: true, indent: 4 });
        const priorityKpi = performanceKpiRows.find((kpi: any) => kpiStatus(kpi) === "Below Target");
        const priorityBenchmark = performanceBenchmarkRows.find((bm: any) => benchmarkStatus(bm) !== "On Track");
        if (priorityKpi) {
          addText(`KPI below target: ${priorityKpi.name} - Current ${metricValue(priorityKpi.aggregateMetric)}, Target ${formatCustomReportMetricValue(priorityKpi.aggregateMetric, kpiTargetValue(priorityKpi))}`, { indent: 8 });
        } else if (priorityBenchmark) {
          addText(`Benchmark needs attention: ${priorityBenchmark.name || priorityBenchmark.metric} - Current ${metricValue(priorityBenchmark.aggregateMetric)}, Benchmark ${formatCustomReportMetricValue(priorityBenchmark.aggregateMetric, benchmarkTargetValue(priorityBenchmark))}`, { indent: 8 });
        } else {
          addText("All mapped KPIs and Benchmarks are on track.", { indent: 8 });
        }
        addText("Aggregated Metrics Snapshot", { bold: true, indent: 4 });
        addMetricList(["impressions", "sessions", "conversions", "spend"]);
      } else if (section === "performance-summary:health") {
        addText("Overall Health Summary", { bold: true, indent: 4 });
        addText(health ? `${health.score}% - ${health.onTrack} of ${health.total} mapped metrics on track` : "No KPIs or Benchmarks configured.", { indent: 8 });
        addText("KPIs On Track or Above", { bold: true, indent: 4 });
        addText(`${performanceKpiRows.filter((kpi: any) => kpiStatus(kpi) !== "Below Target").length} of ${performanceKpiRows.length}`, { indent: 8 });
        addText("Benchmarks On Track", { bold: true, indent: 4 });
        addText(`${performanceBenchmarkRows.filter((bm: any) => benchmarkStatus(bm) === "On Track").length} of ${performanceBenchmarkRows.length}`, { indent: 8 });
        addText("Key Performance Indicators (KPIs)", { bold: true, indent: 4 });
        if (performanceKpiRows.length === 0) addText("- No mapped KPI rows available.", { indent: 8 });
        performanceKpiRows.forEach((kpi: any) => addText(`- ${kpi.name}: ${metricValue(kpi.aggregateMetric)} / ${formatCustomReportMetricValue(kpi.aggregateMetric, kpiTargetValue(kpi))} - ${kpiStatus(kpi)}`, { indent: 8 }));
        addText("Benchmarks", { bold: true, indent: 4 });
        if (performanceBenchmarkRows.length === 0) addText("- No mapped Benchmark rows available.", { indent: 8 });
        performanceBenchmarkRows.forEach((benchmark: any) => addText(`- ${benchmark.name || benchmark.metric}: ${metricValue(benchmark.aggregateMetric)} / ${formatCustomReportMetricValue(benchmark.aggregateMetric, benchmarkTargetValue(benchmark))} - ${benchmarkStatus(benchmark)}`, { indent: 8 }));
        addText("Data Sources", { bold: true, indent: 4 });
        addSourceList();
      } else if (section === "performance-summary:changes") {
        addText("What's Changed", { bold: true, indent: 4 });
        addText("Current connected-source aggregate values are included below. Change comparisons require compatible historical aggregate snapshots.", { indent: 8 });
        addMetricList(["impressions", "sessions", "conversions", "spend", "revenue", "cvr"]);
        addText("Metric Trends", { bold: true, indent: 4 });
        addText("Metric trends appear after at least two compatible aggregate snapshots are available.", { indent: 8 });
      } else if (section === "performance-summary:insights") {
        addText("Data-Driven Insights & Recommendations", { bold: true, indent: 4 });
        addText("Top Priority Action", { bold: true, indent: 8 });
        const priorityKpi = performanceKpiRows.find((kpi: any) => kpiStatus(kpi) === "Below Target");
        if (priorityKpi) {
          addText(`- Improve ${priorityKpi.name}: current ${metricValue(priorityKpi.aggregateMetric)}, target ${formatCustomReportMetricValue(priorityKpi.aggregateMetric, kpiTargetValue(priorityKpi))}`, { indent: 12 });
        } else {
          addText("- Continue monitoring mapped KPIs and Benchmarks.", { indent: 12 });
        }
        addText("Performance Analysis", { bold: true, indent: 8 });
        addMetricList(["sessions", "conversions", "revenue", "spend", "cvr", "roas", "roi"]);
      }
    };
    const addFinancialAnalysisContent = (section: string) => {
      const campaignBudget = Number(String(campaignFinancialContext?.budget ?? "").replace(/,/g, "")) || 0;
      const campaignStartDate = campaignFinancialContext?.startDate ? new Date(campaignFinancialContext.startDate) : null;
      const campaignEndDate = campaignFinancialContext?.endDate ? new Date(campaignFinancialContext.endDate) : null;
      const hasCampaignDateRange = !!campaignStartDate && !!campaignEndDate && campaignEndDate.getTime() >= campaignStartDate.getTime();
      const today = new Date();
      const effectiveElapsedEnd = campaignEndDate && campaignEndDate.getTime() < today.getTime() ? campaignEndDate : today;
      const campaignElapsedDays = campaignStartDate
        ? Math.max(0, Math.floor((effectiveElapsedEnd.getTime() - campaignStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
        : 0;
      const campaignTotalDays = hasCampaignDateRange
        ? Math.max(1, Math.floor((campaignEndDate!.getTime() - campaignStartDate!.getTime()) / (24 * 60 * 60 * 1000)) + 1)
        : 0;
      const spend = metricNumber("spend");
      const revenue = metricNumber("revenue");
      const conversions = metricNumber("conversions");
      const budgetUtilization = campaignBudget > 0 && metricAvailable("spend") ? (spend / campaignBudget) * 100 : null;
      const remainingBudget = campaignBudget - spend;
      const dailyBurnRate = campaignElapsedDays > 0 && metricAvailable("spend") ? spend / campaignElapsedDays : null;
      const targetDailySpend = campaignTotalDays > 0 && campaignBudget > 0 ? campaignBudget / campaignTotalDays : null;
      const pacingPercentage = dailyBurnRate !== null && targetDailySpend !== null && targetDailySpend > 0
        ? (dailyBurnRate / targetDailySpend) * 100
        : null;
      const pacingStatus = pacingPercentage === null ? "Unavailable" : pacingPercentage > 115 ? `${(pacingPercentage - 100).toFixed(1)}% Over` : pacingPercentage < 85 ? `${(100 - pacingPercentage).toFixed(1)}% Under` : "On Track";
      const projectedExhaustionDays = dailyBurnRate !== null && dailyBurnRate > 0 && remainingBudget > 0 ? remainingBudget / dailyBurnRate : null;
      const sourceIncludesMetric = (source: any, metricName: string) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
      const sourceMetricNumber = (source: any, metricName: string) => {
        const value = metricName === "revenue"
          ? source?.metrics?.attributedRevenue ?? source?.metrics?.revenue
          : source?.metrics?.[metricName];
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
      };
      const sourceRoas = (source: any) => {
        const explicitRoas = Number(source?.metrics?.roas);
        if (Number.isFinite(explicitRoas)) return explicitRoas;
        const sourceSpend = sourceMetricNumber(source, "spend");
        return sourceSpend > 0 ? sourceMetricNumber(source, "revenue") / sourceSpend : null;
      };
      const sourceRoi = (source: any) => {
        const explicitRoi = Number(source?.metrics?.roi);
        if (Number.isFinite(explicitRoi)) return explicitRoi;
        const sourceSpend = sourceMetricNumber(source, "spend");
        return sourceSpend > 0 ? ((sourceMetricNumber(source, "revenue") - sourceSpend) / sourceSpend) * 100 : null;
      };
      const financialMainSources = customReportSources.filter((source: any) =>
        ["revenue", "spend", "conversions"].some((metricName) => sourceIncludesMetric(source, metricName))
      );
      const financialInputSources = customReportAllSources.filter((source: any) => source?.connected === true && source?.category === "financial");
      const spendCapableSources = customReportSources.filter((source: any) => {
        const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics : [];
        return source?.category === "paid_media" && includedMetrics.includes("spend");
      });
      const allocationSpend = spendCapableSources.reduce((sum: number, source: any) => sum + sourceMetricNumber(source, "spend"), 0);
      const highPerformance = spendCapableSources.filter((source: any) => (sourceRoas(source) ?? 0) >= 3);
      const mediumPerformance = spendCapableSources.filter((source: any) => {
        const roas = sourceRoas(source);
        return roas !== null && roas >= 1 && roas < 3;
      });
      const lowPerformance = spendCapableSources.filter((source: any) => {
        const roas = sourceRoas(source);
        return roas !== null && roas < 1;
      });
      const sourceWithBestRoas = spendCapableSources
        .filter((source: any) => sourceMetricNumber(source, "spend") > 0 && sourceRoas(source) !== null)
        .sort((a: any, b: any) => (sourceRoas(b) ?? 0) - (sourceRoas(a) ?? 0))[0];
      const sourceWithWeakestRoas = spendCapableSources
        .filter((source: any) => sourceMetricNumber(source, "spend") > 0 && sourceRoas(source) !== null)
        .sort((a: any, b: any) => (sourceRoas(a) ?? 0) - (sourceRoas(b) ?? 0))[0];
      const formatDate = (date: Date | null) => date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "Unavailable";
      const addRow = (label: string, value: string, indent = 8) => addText(`- ${label}: ${value}`, { indent });
      const addFinancialMetricRow = (label: string, key: string, indent = 8) => addRow(label, metricValue(key), indent);
      const addSourceRows = (sources: any[], indent = 8) => {
        if (sources.length === 0) {
          addText("- No matching connected source rows available.", { indent });
          return;
        }
        sources.forEach((source: any) => {
          const sourceSpend = sourceMetricNumber(source, "spend");
          const sourceRevenue = sourceMetricNumber(source, "revenue");
          const sourceConversions = sourceMetricNumber(source, "conversions");
          const roas = sourceRoas(source);
          const roi = sourceRoi(source);
          addText(`- ${source?.label || source?.id}: Spend ${formatCustomReportMetricValue("spend", sourceSpend)}, Conversions ${formatCustomReportMetricValue("conversions", sourceConversions)}, Revenue ${formatCustomReportMetricValue("revenue", sourceRevenue)}, ROAS ${roas === null ? "Unavailable" : formatCustomReportMetricValue("roas", roas)}, ROI ${roi === null ? "Unavailable" : formatCustomReportMetricValue("roi", roi)}`, { indent });
        });
      };
      const addFinancialInputRows = () => {
        const revenueInputs = financialInputSources.filter((source: any) => sourceMetricNumber(source, "revenue") > 0);
        const spendInputs = financialInputSources.filter((source: any) => sourceMetricNumber(source, "spend") > 0);
        addText("Revenue", { bold: true, indent: 12 });
        revenueInputs.length > 0
          ? revenueInputs.forEach((source: any) => addRow(source?.label || source?.id, formatCustomReportMetricValue("revenue", sourceMetricNumber(source, "revenue")), 16))
          : addText("- No financial revenue input rows available.", { indent: 16 });
        addText("Spend", { bold: true, indent: 12 });
        spendInputs.length > 0
          ? spendInputs.forEach((source: any) => addRow(source?.label || source?.id, formatCustomReportMetricValue("spend", sourceMetricNumber(source, "spend")), 16))
          : addText("- No financial spend input rows available.", { indent: 16 });
      };
      const budgetHealthStatus = budgetUtilization === null ? "Unavailable" : budgetUtilization <= 80 ? "excellent" : budgetUtilization <= 95 ? "good" : budgetUtilization <= 100 ? "warning" : "critical";
      const pacingDeviation = pacingPercentage === null ? null : Math.abs(pacingPercentage - 100);
      const pacingHealthStatus = pacingDeviation === null ? "Unavailable" : pacingDeviation <= 15 ? "excellent" : pacingDeviation <= 30 ? "good" : pacingDeviation <= 50 ? "warning" : "critical";
      const roiStatus = !metricAvailable("roi") ? "Unavailable" : metricNumber("roi") >= 100 ? "excellent" : metricNumber("roi") >= 50 ? "good" : metricNumber("roi") >= 0 ? "warning" : "critical";
      const roasStatus = !metricAvailable("roas") ? "Unavailable" : metricNumber("roas") >= 3 ? "excellent" : metricNumber("roas") >= 1.5 ? "good" : metricNumber("roas") >= 1 ? "warning" : "critical";
      const budgetScore = budgetUtilization === null ? 0 : budgetUtilization <= 80 ? 25 : budgetUtilization <= 95 ? 15 : budgetUtilization <= 100 ? 10 : 0;
      const pacingScore = pacingDeviation === null ? 0 : pacingDeviation <= 15 ? 25 : pacingDeviation <= 30 ? 15 : pacingDeviation <= 50 ? 10 : 0;
      const roiScore = !metricAvailable("roi") ? 0 : metricNumber("roi") >= 100 ? 25 : metricNumber("roi") >= 50 ? 15 : metricNumber("roi") >= 0 ? 10 : 0;
      const roasScore = !metricAvailable("roas") ? 0 : metricNumber("roas") >= 3 ? 25 : metricNumber("roas") >= 1.5 ? 15 : metricNumber("roas") >= 1 ? 10 : 0;
      const availableHealthMetricCount = [budgetUtilization !== null, pacingPercentage !== null, metricAvailable("roi"), metricAvailable("roas")].filter(Boolean).length;
      const displayHealthScore = availableHealthMetricCount > 0 ? Math.round(((budgetScore + pacingScore + roiScore + roasScore) / (availableHealthMetricCount * 25)) * 100) : null;
      const healthRating = displayHealthScore === null ? "Unavailable" : displayHealthScore >= 80 ? "Excellent" : displayHealthScore >= 60 ? "Good" : displayHealthScore >= 40 ? "Fair" : "Needs Attention";

      if (section === "financial-analysis:overview") {
        if (!metricAvailable("revenue")) {
          addText("Conversion Value Not Configured", { bold: true, indent: 4 });
          addText("Revenue, ROI, and ROAS calculations require conversion value configuration.", { indent: 8 });
        }
        addText("Campaign Health Score", { bold: true, indent: 4 });
        addRow("Score", displayHealthScore === null ? "Unavailable" : `${displayHealthScore} out of 100 (${availableHealthMetricCount}/4 inputs)`);
        addRow("Rating", healthRating);
        addRow("Budget Utilization", `${budgetUtilization === null ? "Unavailable" : `${budgetUtilization.toFixed(1)}%`} - ${budgetHealthStatus}`);
        addRow("Pacing Status", `${pacingPercentage === null ? "Unavailable" : `${pacingPercentage.toFixed(1)}%`} - ${pacingHealthStatus}`);
        addRow("Campaign ROI", `${metricValue("roi")} - ${roiStatus}`);
        addRow("Campaign ROAS", `${metricValue("roas")} - ${roasStatus}`);
        addText("Key Financial Metrics", { bold: true, indent: 4 });
        addFinancialMetricRow("Total Spend", "spend");
        addFinancialMetricRow("Conversions", "conversions");
        addText("Budget Utilization", { bold: true, indent: 4 });
        addRow("Budget Used", `${metricValue("spend")} of ${campaignBudget > 0 ? formatCustomReportMetricValue("spend", campaignBudget) : "Unavailable"}`);
        addRow("Utilized", budgetUtilization === null ? "Unavailable" : `${budgetUtilization.toFixed(1)}% utilized`);
        addRow("Remaining", campaignBudget > 0 && metricAvailable("spend") ? formatCustomReportMetricValue("spend", remainingBudget) : "Unavailable");
        addText("Budget Pacing & Burn Rate", { bold: true, indent: 4 });
        addRow("Daily Burn Rate", dailyBurnRate === null ? "Unavailable" : formatCustomReportMetricValue("spend", dailyBurnRate));
        addRow("Daily Burn Rate Basis", campaignElapsedDays > 0 ? `Based on ${campaignElapsedDays} elapsed campaign ${campaignElapsedDays === 1 ? "day" : "days"}` : "Requires campaign spend and start date");
        addRow("Target Daily Spend", targetDailySpend === null ? "Unavailable" : formatCustomReportMetricValue("spend", targetDailySpend));
        addRow("Pacing Status", pacingStatus);
        addRow("Campaign Budget", campaignBudget > 0 ? formatCustomReportMetricValue("spend", campaignBudget) : "Unavailable");
        addRow("Start Date", formatDate(campaignStartDate));
        addRow("End Date", formatDate(campaignEndDate));
        if (remainingBudget < 0 && campaignBudget > 0 && metricAvailable("spend")) {
          addRow("Budget exceeded by", formatCustomReportMetricValue("spend", Math.abs(remainingBudget)));
        }
        if (projectedExhaustionDays !== null) {
          addRow("Projected Exhaustion", `At current rate, budget will be exhausted in ${Math.ceil(projectedExhaustionDays)} days`);
        }
        addText("Cost Efficiency Metrics", { bold: true, indent: 4 });
        addFinancialMetricRow("Cost Per Click", "cpc");
        addFinancialMetricRow("Cost Per Acquisition", "cpa");
        addFinancialMetricRow("Conversion Rate", "cvr");
      } else if (section === "financial-analysis:roi-roas") {
        addText("ROI & ROAS Analysis", { bold: true, indent: 4 });
        addText("Return on Ad Spend (ROAS)", { bold: true, indent: 8 });
        addRow("ROAS", metricValue("roas"), 12);
        addRow("Explanation", metricAvailable("roas") ? `For every $1 spent on advertising, campaign revenue is ${metricValue("roas")}.` : "ROAS requires available revenue and spend.", 12);
        addRow("Total Ad Spend", metricValue("spend"), 12);
        addRow("Total Revenue", metricValue("revenue"), 12);
        addText("Return on Investment (ROI)", { bold: true, indent: 8 });
        addRow("ROI", metricValue("roi"), 12);
        addRow("Return Status", metricAvailable("roi") ? `${metricNumber("roi") >= 0 ? "Positive" : "Negative"} return on advertising investment` : "ROI requires available revenue and spend", 12);
        addRow("Net Profit", metricAvailable("revenue") && metricAvailable("spend") ? formatCustomReportMetricValue("revenue", revenue - spend) : "Unavailable", 12);
        addRow("Investment", metricValue("spend"), 12);
        addText("Source ROAS Performance", { bold: true, indent: 8 });
        addSourceRows(financialMainSources, 12);
        addText("Source ROI Performance", { bold: true, indent: 8 });
        addSourceRows(financialMainSources, 12);
        addText("Financial Inputs", { bold: true, indent: 8 });
        addText("These child inputs feed aggregate revenue and spend through their parent connected platform and are not separate main Connected Platforms.", { indent: 12 });
        addFinancialInputRows();
      } else if (section === "financial-analysis:costs") {
        addText("Cost Analysis Breakdown", { bold: true, indent: 4 });
        addText("Cost Metrics", { bold: true, indent: 8 });
        addFinancialMetricRow("Cost Per Click (CPC)", "cpc", 12);
        addFinancialMetricRow("Cost Per Acquisition (CPA)", "cpa", 12);
        addFinancialMetricRow("Cost Per Thousand Impressions (CPM)", "cpm", 12);
        addText("Efficiency Indicators", { bold: true, indent: 8 });
        addFinancialMetricRow("Click-through Rate (CTR)", "ctr", 12);
        addFinancialMetricRow("Conversion Rate (CVR)", "cvr", 12);
        addText("Sources", { bold: true, indent: 8 });
        addSourceRows(financialMainSources, 12);
      } else if (section === "financial-analysis:budget") {
        addText("Performance-Based Budget Allocation", { bold: true, indent: 4 });
        addText("Imported spend labels inside GA4 feed total spend, ROI, and ROAS but are not connected ad platforms. Budget Allocation only shows sources after a spend-capable ad platform is connected in Connected Platforms.", { indent: 8 });
        addText("Performance Tiers", { bold: true, indent: 4 });
        addRow("High Performance", `${formatCustomReportMetricValue("spend", highPerformance.reduce((sum: number, source: any) => sum + sourceMetricNumber(source, "spend"), 0))}; Sources with ROAS >= 3.0x`);
        addRow("Medium Performance", `${formatCustomReportMetricValue("spend", mediumPerformance.reduce((sum: number, source: any) => sum + sourceMetricNumber(source, "spend"), 0))}; Sources with ROAS 1.0-3.0x`);
        addRow("Low Performance", `${formatCustomReportMetricValue("spend", lowPerformance.reduce((sum: number, source: any) => sum + sourceMetricNumber(source, "spend"), 0))}; Sources with ROAS < 1.0x`);
        addText("Source Budget Analysis", { bold: true, indent: 4 });
        if (spendCapableSources.length === 0) {
          addText("No spend-capable connected source is available for budget allocation yet.", { indent: 8 });
        } else if (spendCapableSources.length === 1) {
          addText("One spend-capable connected source is available. Budget reallocation recommendations require at least two spend-capable sources.", { indent: 8 });
        }
        if (spendCapableSources.length > 0) {
          spendCapableSources.forEach((source: any) => {
            const sourceSpend = Number(source?.metrics?.spend);
            const spendText = Number.isFinite(sourceSpend) ? formatCustomReportMetricValue("spend", sourceSpend) : "Spend included in connected-source aggregate";
            const budgetShare = allocationSpend > 0 ? (sourceMetricNumber(source, "spend") / allocationSpend) * 100 : 0;
            addText(`- ${source?.label || source?.id}: Spend ${spendText}, Conversions ${formatCustomReportMetricValue("conversions", sourceMetricNumber(source, "conversions"))}, Revenue ${formatCustomReportMetricValue("revenue", sourceMetricNumber(source, "revenue"))}, Budget Share ${budgetShare.toFixed(1)}%, ROAS ${sourceRoas(source) === null ? "Unavailable" : formatCustomReportMetricValue("roas", sourceRoas(source))}`, { indent: 8 });
          });
        }
        addText("Allocation Guidance", { bold: true, indent: 4 });
        addText(spendCapableSources.length > 1 ? "Review spend from lower-performing sources for possible reallocation to higher-performing spend-capable sources." : "Reallocation guidance requires at least two spend-capable connected sources.", { indent: 8 });
      } else if (section === "financial-analysis:insights") {
        addText("Financial Performance Insights", { bold: true, indent: 4 });
        addText("Performance Summary", { bold: true, indent: 8 });
        addText(metricAvailable("roas") && metricAvailable("roi") ? `Campaign is generating ${metricValue("roas")} ROAS with ${metricValue("roi")} ROI.` : "ROAS and ROI require available revenue and spend.", { indent: 12 });
        addText("Cost Efficiency", { bold: true, indent: 8 });
        addText(metricAvailable("cpa") ? `CPA is ${metricValue("cpa")}. ${metricNumber("cpa") < 25 ? "Acquisition costs are well controlled." : "Review conversion efficiency before increasing spend."}` : "CPA requires available spend and conversions.", { indent: 12 });
        addText("Budget Management", { bold: true, indent: 8 });
        addText(budgetUtilization === null ? "Budget management requires available spend and campaign budget." : `Campaign has utilized ${budgetUtilization.toFixed(1)}% of budget. ${budgetUtilization > 100 ? "Campaign spend is over budget." : budgetUtilization < 50 ? "Budget is underutilized relative to the total campaign budget." : budgetUtilization > 85 ? "Monitor remaining budget closely." : "Budget usage is currently within range."}`, { indent: 12 });
        addText("Source Performance Insights", { bold: true, indent: 4 });
        if (spendCapableSources.length === 0) {
          addText("No spend-capable connected ad platform is available. Financial totals can still use GA4 child spend inputs, but paid-media optimization insights require a connected ad platform.", { indent: 8 });
        } else {
          if (sourceWithBestRoas) addText(`- ${spendCapableSources.length > 1 ? "Strongest Source" : "Source Performance"}: ${sourceWithBestRoas.label || sourceWithBestRoas.id} generating ${formatCustomReportMetricValue("roas", sourceRoas(sourceWithBestRoas))} ROAS with ${formatCustomReportMetricValue("spend", sourceMetricNumber(sourceWithBestRoas, "spend"))} spend`, { indent: 8 });
          if (sourceWithWeakestRoas && sourceWithWeakestRoas !== sourceWithBestRoas) addText(`- Needs Attention: ${sourceWithWeakestRoas.label || sourceWithWeakestRoas.id} generating ${formatCustomReportMetricValue("roas", sourceRoas(sourceWithWeakestRoas))} ROAS`, { indent: 8 });
          if (spendCapableSources.length === 1) addText("- Source Data Status: Reallocation insights require at least two spend-capable sources.", { indent: 8 });
        }
        addText("Key Opportunities", { bold: true, indent: 4 });
        if (budgetUtilization !== null && budgetUtilization < 50 && metricAvailable("roas") && metricNumber("roas") > 2) addText(`- Budget Underutilized: Only ${budgetUtilization.toFixed(1)}% of budget is utilized while ROAS is ${metricValue("roas")}.`, { indent: 8 });
        if (metricAvailable("cvr") && metricNumber("cvr") < 5 && metricAvailable("conversions") && conversions > 10) addText(`- Conversion Rate Optimization: Current CVR of ${metricValue("cvr")} has room for improvement.`, { indent: 8 });
        if (metricAvailable("ctr") && metricNumber("ctr") < 2) addText(`- Improve Ad Engagement: CTR of ${metricValue("ctr")} is low.`, { indent: 8 });
        if (budgetUtilization !== null && budgetUtilization > 85 && budgetUtilization <= 100 && metricAvailable("roas") && metricNumber("roas") > 2) addText(`- Budget Capacity: ${budgetUtilization.toFixed(1)}% budget utilized with positive ROAS.`, { indent: 8 });
        if (spendCapableSources.length === 0) addText("- No spend-capable connected ad platform is available for paid-media optimization opportunities.", { indent: 8 });
        addText("Budget Optimization Recommendations", { bold: true, indent: 4 });
        if (spendCapableSources.length > 1 && highPerformance.length > 0) addText(`- Scale High-Performing Sources: ${highPerformance.map((source: any) => source.label || source.id).join(", ")} generating ROAS >= 3.0x.`, { indent: 8 });
        if (spendCapableSources.length > 1 && lowPerformance.length > 0) addText(`- Optimize Underperforming Sources: ${lowPerformance.map((source: any) => source.label || source.id).join(", ")} showing ROAS below 1.0x.`, { indent: 8 });
        if (spendCapableSources.length > 1 && highPerformance.length > 0 && lowPerformance.length > 0) addText("- Budget Reallocation Opportunity: Lower-performing spend could be reviewed for possible reallocation.", { indent: 8 });
        if (spendCapableSources.length <= 1) addText("Budget optimization recommendations require multiple spend-capable connected sources.", { indent: 8 });
        addText("Cost Optimization Insights", { bold: true, indent: 4 });
        const costInsights = [
          metricAvailable("ctr") && metricNumber("ctr") < 1 ? "Click-through rate below 1% - test new ad creative and messaging on connected paid-media sources" : "",
          metricAvailable("ctr") && metricNumber("ctr") >= 3 ? `Strong click-through rate of ${metricValue("ctr")} - paid-media engagement is performing well` : "",
          metricAvailable("cvr") && metricNumber("cvr") < 2 ? "Conversion rate below 2% - review landing page experience and offer relevance" : "",
          metricAvailable("cvr") && metricNumber("cvr") >= 10 ? `Excellent conversion rate of ${metricValue("cvr")} - landing page appears effective` : "",
          metricAvailable("cpc") && metricNumber("cpc") > 10 ? `CPC of ${metricValue("cpc")} above average - refine audience targeting to reduce costs` : "",
          metricAvailable("cpc") && metricNumber("cpc") < 2 ? `Low CPC of ${metricValue("cpc")} indicates efficient paid-media targeting` : "",
          metricAvailable("cpm") && metricNumber("cpm") < 5 ? `CPM of ${metricValue("cpm")} is cost-efficient - strong reach per dollar spent` : "",
          metricAvailable("cpm") && metricNumber("cpm") > 30 ? `CPM of ${metricValue("cpm")} above average - consider broadening paid-media audiences` : "",
          metricAvailable("cpa") && metricNumber("cpa") > 100 ? `CPA of ${metricValue("cpa")} is high - review conversion funnel for drop-off points` : "",
          metricAvailable("cpa") && metricNumber("cpa") < 15 ? `CPA of ${metricValue("cpa")} is excellent - acquisition costs are well controlled` : "",
        ].filter(Boolean);
        costInsights.length > 0
          ? costInsights.forEach((insight) => addText(`- ${insight}`, { indent: 8 }))
          : addText("- No cost optimization insight is available from current connected-source inputs.", { indent: 8 });
      }
    };
    const addPlatformComparisonContent = (section: string) => {
      const sourceIncludesMetric = (source: any, metricName: string) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
      const sourceMetricNumber = (source: any, metricName: string) => {
        const value = metricName === "revenue"
          ? source?.metrics?.attributedRevenue ?? source?.metrics?.revenue
          : source?.metrics?.[metricName];
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
      };
      const platformRows = customReportSources.map((source: any) => {
        const spend = sourceIncludesMetric(source, "spend") ? sourceMetricNumber(source, "spend") : 0;
        const impressions = sourceIncludesMetric(source, "impressions") ? sourceMetricNumber(source, "impressions") : 0;
        const clicks = sourceIncludesMetric(source, "clicks") ? sourceMetricNumber(source, "clicks") : 0;
        const conversions = sourceIncludesMetric(source, "conversions") ? sourceMetricNumber(source, "conversions") : 0;
        const revenue = source?.id === "ga4" && Number(latestCampaignOutcomeTotals?.revenue?.totalRevenue || 0) > 0
          ? Number(latestCampaignOutcomeTotals.revenue.totalRevenue)
          : (sourceIncludesMetric(source, "revenue") || sourceIncludesMetric(source, "attributedRevenue")) ? sourceMetricNumber(source, "revenue") : 0;
        const sessions = sourceIncludesMetric(source, "sessions") ? sourceMetricNumber(source, "sessions") : 0;
        const users = sourceIncludesMetric(source, "users") ? sourceMetricNumber(source, "users") : 0;
        return {
          label: source?.label || source?.id || "Connected Source",
          category: source?.category,
          includedMetrics: Array.isArray(source?.includedMetrics) ? source.includedMetrics : [],
          spend,
          impressions,
          clicks,
          conversions,
          revenue,
          sessions,
          users,
          ctr: impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 && spend > 0 ? spend / clicks : 0,
          conversionRate: conversions > 0 && (clicks > 0 || sessions > 0) ? (conversions / (clicks || sessions)) * 100 : 0,
          roas: spend > 0 && revenue > 0 ? revenue / spend : 0,
          roi: spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : 0,
        };
      });
      const spendCapableRows = platformRows.filter((row: any) => row.category === "paid_media" && row.includedMetrics.includes("spend"));
      const revenueSourceRows = customReportAllSources.filter((source: any) => source?.connected === true && source?.category === "financial" && sourceMetricNumber(source, "revenue") > 0);
      const addPlatformRows = (rows: any[], indent = 8) => {
        if (rows.length === 0) {
          addText("- No connected platform rows available.", { indent });
          return;
        }
        rows.forEach((row: any) => addText(`- ${row.label}: Users ${formatCustomReportMetricValue("users", row.users)}, Sessions ${formatCustomReportMetricValue("sessions", row.sessions)}, Impressions ${row.impressions > 0 ? formatCustomReportMetricValue("impressions", row.impressions) : "Unavailable"}, Clicks ${row.clicks > 0 ? formatCustomReportMetricValue("clicks", row.clicks) : "Unavailable"}, Conversions ${formatCustomReportMetricValue("conversions", row.conversions)}, Revenue ${formatCustomReportMetricValue("revenue", row.revenue)}, Spend ${row.spend > 0 ? formatCustomReportMetricValue("spend", row.spend) : "Unavailable"}, ROAS ${row.roas > 0 ? formatCustomReportMetricValue("roas", row.roas) : "Unavailable"}, ROI ${row.spend > 0 ? formatCustomReportMetricValue("roi", row.roi) : "Unavailable"}`, { indent }));
      };

      if (section === "platform-comparison:overview") {
        addText("Platform Performance Summary Cards", { bold: true, indent: 4 });
        addPlatformRows(platformRows);
        addText("Channel Performance Overview", { bold: true, indent: 4 });
        addPlatformRows(platformRows);
        addText("Revenue Tracking Platforms", { bold: true, indent: 4 });
        revenueSourceRows.length > 0
          ? revenueSourceRows.forEach((source: any) => addText(`- ${source?.label || source?.id}: Total Revenue ${formatCustomReportMetricValue("revenue", sourceMetricNumber(source, "revenue"))}`, { indent: 8 }))
          : addText("- No separate revenue tracking platform rows available.", { indent: 8 });
        addText(`Total Revenue (All Tracking Sources): ${formatCustomReportMetricValue("revenue", revenueSourceRows.reduce((sum: number, source: any) => sum + sourceMetricNumber(source, "revenue"), 0))}`, { indent: 8 });
      } else if (section === "platform-comparison:performance") {
        addText("Detailed Performance Metrics", { bold: true, indent: 4 });
        addPlatformRows(platformRows);
        addText("Efficiency Comparison", { bold: true, indent: 4 });
        spendCapableRows.length > 0
          ? spendCapableRows.forEach((row: any) => addText(`- ${row.label}: ROAS ${row.roas > 0 ? formatCustomReportMetricValue("roas", row.roas) : "Unavailable"}, ROI ${row.spend > 0 ? formatCustomReportMetricValue("roi", row.roi) : "Unavailable"}, CPA ${row.spend > 0 && row.conversions > 0 ? formatCustomReportMetricValue("cpa", row.spend / row.conversions) : "Unavailable"}, Conversions ${formatCustomReportMetricValue("conversions", row.conversions)}`, { indent: 8 }))
          : addText("No spend-based efficiency comparison is available. ROAS, ROI, and CPA require connected sources with spend plus revenue or conversions.", { indent: 8 });
        addText("Volume Comparison", { bold: true, indent: 4 });
        platformRows.forEach((row: any) => addText(`- ${row.label}: Impressions ${row.impressions > 0 ? formatCustomReportMetricValue("impressions", row.impressions) : "Unavailable"}, ${row.clicks > 0 ? "Clicks" : row.sessions > 0 ? "Sessions" : "Engagement"} ${formatCustomReportMetricValue(row.clicks > 0 ? "clicks" : "sessions", row.clicks || row.sessions)}`, { indent: 8 }));
      } else if (section === "platform-comparison:cost-analysis") {
        if (spendCapableRows.length === 0) {
          addText("No paid-media platform connected", { bold: true, indent: 4 });
          addText("Google Analytics can contribute analytics metrics, but source-level spend, CPA, ROI, and ROAS comparisons require a connected paid-media platform.", { indent: 8 });
          return;
        }
        addText("Cost per Conversion", { bold: true, indent: 4 });
        spendCapableRows.forEach((row: any) => addText(`- ${row.label}: ${row.spend > 0 && row.conversions > 0 ? formatCustomReportMetricValue("cpa", row.spend / row.conversions) : "Unavailable"}`, { indent: 8 }));
        addText("Budget Allocation", { bold: true, indent: 4 });
        const totalSpend = spendCapableRows.reduce((sum: number, row: any) => sum + row.spend, 0);
        spendCapableRows.forEach((row: any) => addText(`- ${row.label}: ${formatCustomReportMetricValue("spend", row.spend)} (${totalSpend > 0 ? ((row.spend / totalSpend) * 100).toFixed(1) : "0.0"}%)`, { indent: 8 }));
        addText("Return on Investment (ROI) & Return on Ad Spend (ROAS)", { bold: true, indent: 4 });
        spendCapableRows.forEach((row: any) => addText(`- ${row.label}: ROI ${row.spend > 0 ? formatCustomReportMetricValue("roi", row.roi) : "Unavailable"}, ROAS ${row.roas > 0 ? formatCustomReportMetricValue("roas", row.roas) : "Unavailable"}, Total Spend ${formatCustomReportMetricValue("spend", row.spend)}, Conversions ${formatCustomReportMetricValue("conversions", row.conversions)}`, { indent: 8 }));
      } else if (section === "platform-comparison:insights") {
        addText("Platform Performance Insights", { bold: true, indent: 4 });
        if (platformRows.length === 0) {
          addText("No connected platform data available yet. Connect a platform in Connected Platforms to see insights and recommendations.", { indent: 8 });
          return;
        }
        if (spendCapableRows.length === 0) {
          addText("Platform Summary", { bold: true, indent: 8 });
          addText(`${platformRows.map((row: any) => row.label).join(", ")} ${platformRows.length === 1 ? "is" : "are"} connected, so this tab shows only metrics those sources provide.`, { indent: 12 });
          addText("Available Source Metrics", { bold: true, indent: 8 });
          addPlatformRows(platformRows, 12);
          addText("Paid-Media Comparison Unavailable", { bold: true, indent: 8 });
          addText("Paid-media comparison and budget recommendations require a main paid-media platform with source-level ad spend.", { indent: 12 });
        } else {
          addText("Data Source Analysis", { bold: true, indent: 8 });
          addText(`Included in recommendations: ${spendCapableRows.map((row: any) => row.label).join(", ")}`, { indent: 12 });
          addText("Top Performer", { bold: true, indent: 8 });
          addText("Shown when at least two paid-media sources can be compared by ROAS.", { indent: 12 });
          addText("Volume Leader", { bold: true, indent: 8 });
          addText("Shown when at least two paid-media sources can be compared by conversion volume.", { indent: 12 });
          addText("Highest Engagement", { bold: true, indent: 8 });
          addText("Shown when at least two paid-media sources can be compared by CTR.", { indent: 12 });
          addText("Optimization Opportunity", { bold: true, indent: 8 });
          addText("Shown when a paid-media source materially trails the strongest comparable source.", { indent: 12 });
          addText("Strategic Recommendations", { bold: true, indent: 8 });
          addText(spendCapableRows.length > 1 ? "Compare paid-media ROAS, ROI, CPA, conversion volume, and engagement before reallocating budget." : "Connect at least one more main paid-media platform with source-level spend to generate comparison-based recommendations.", { indent: 12 });
        }
      }
    };
    const recommendationImpactItems = (rec: any) => {
      if (rec?.category !== "Website Outcomes") return [formatRecommendationText(rec?.expectedImpact || "")].filter(Boolean);
      const webMetrics: string[] = [];
      if (metricAvailable("users")) webMetrics.push(`${Math.round(metricNumber("users")).toLocaleString()} users`);
      if (metricAvailable("sessions")) webMetrics.push(`${Math.round(metricNumber("sessions")).toLocaleString()} sessions`);
      if (metricAvailable("conversions")) webMetrics.push(`${Math.round(metricNumber("conversions")).toLocaleString()} conversions`);
      if (metricAvailable("revenue")) webMetrics.push(metricValue("revenue"));
      if (metricAvailable("cvr")) webMetrics.push(`${metricNumber("cvr").toFixed(1)}% conversion rate`);
      return [
        webMetrics.length > 0 ? `Available data: ${webMetrics.join(", ")}.` : "",
        metricAvailable("revenue") && metricAvailable("conversions") ? `Revenue is ${metricValue("revenue")} from ${Math.round(metricNumber("conversions")).toLocaleString()} conversions.` : "",
        metricAvailable("cvr") ? `Conversion rate is ${metricNumber("cvr").toFixed(1)}%.` : "",
        formatRecommendationText(rec?.expectedImpact || ""),
      ].filter(Boolean);
    };
    const addExecutiveOverviewContent = () => {
      const trajectory = campaignExecutiveSummary?.health?.trajectory;
      const trendPct = Number(campaignExecutiveSummary?.health?.trendPercentage) || 0;
      const freshnessWarnings = Array.isArray(campaignExecutiveSummary?.dataFreshness?.warnings) ? campaignExecutiveSummary.dataFreshness.warnings : [];
      const kpiMissCount = executiveKpiRows.filter((kpi: any) => progressPct(metricNumber(kpi.aggregateMetric), Number(kpi.target) || 0, kpi.aggregateMetric) < 70).length;
      const benchmarkMissCount = executiveBenchmarkRows.filter((bm: any) => progressPct(metricNumber(bm.aggregateMetric), Number(bm.benchmark) || 0, bm.aggregateMetric) < 70).length;
      const aggregateSources = Array.isArray(customReportPerformanceSummary?.sources) ? customReportPerformanceSummary.sources : [];
      const paidSources = aggregateSources.filter((source: any) =>
        source?.connected === true &&
        source?.category !== "financial" &&
        source?.category !== "web_analytics" &&
        Array.isArray(source?.includedMetrics) &&
        ["spend", "revenue", "conversions"].some((metricName) => source.includedMetrics.includes(metricName))
      );
      const paidSpendTotal = paidSources.reduce((sum: number, source: any) => sum + (Number(source?.metrics?.spend) || 0), 0);
      const topSpendShare = paidSpendTotal > 0
        ? Math.max(...paidSources.map((source: any) => ((Number(source?.metrics?.spend) || 0) / paidSpendTotal) * 100))
        : 0;
      const paidConcentrationRisk = paidSources.length === 1 || topSpendShare > 70;
      const roiRoasRisk = (metricAvailable("roi") && metricNumber("roi") < 0) || (metricAvailable("roas") && metricNumber("roas") < 1);
      const trendRisk = trajectory === "declining" && trendPct < -15;
      const displayedRiskLevel = (metricAvailable("roi") && metricNumber("roi") < 0) || freshnessWarnings.some((warning: any) => warning.severity === "high")
        ? "high"
        : (roiRoasRisk || trendRisk || paidConcentrationRisk || kpiMissCount > 0 || benchmarkMissCount > 0 || freshnessWarnings.length > 0) ? "medium" : "low";
      const metricSummary = [metricAvailable("roi") ? `ROI is ${metricValue("roi")}` : "", metricAvailable("roas") ? `ROAS is ${metricValue("roas")}` : ""].filter(Boolean);
      const riskInputRows = [
        { label: "KPI Risk", status: kpiMissCount > 0 ? "Risk" : executiveKpiRows.length > 0 ? "No Risk" : "Not Applicable", detail: kpiMissCount > 0 ? `${kpiMissCount} KPI${kpiMissCount === 1 ? " is" : "s are"} below 70% of target` : executiveKpiRows.length > 0 ? "Mapped KPIs are at or above 70% of target" : "No mapped campaign KPIs available" },
        { label: "Benchmark Risk", status: benchmarkMissCount > 0 ? "Risk" : executiveBenchmarkRows.length > 0 ? "No Risk" : "Not Applicable", detail: benchmarkMissCount > 0 ? `${benchmarkMissCount} benchmark${benchmarkMissCount === 1 ? " is" : "s are"} below 70% of benchmark` : executiveBenchmarkRows.length > 0 ? "Mapped benchmarks are at or above 70% of benchmark" : "No mapped campaign benchmarks available" },
        { label: "Data Freshness", status: freshnessWarnings.length > 0 ? "Risk" : "No Risk", detail: freshnessWarnings.length > 0 ? `${freshnessWarnings.length} stale source warning${freshnessWarnings.length === 1 ? "" : "s"}` : "No stale connected-source warnings" },
        { label: "ROI / ROAS Risk", status: roiRoasRisk ? "Risk" : metricAvailable("roi") || metricAvailable("roas") ? "No Risk" : "Not Applicable", detail: metricAvailable("roi") || metricAvailable("roas") ? [metricAvailable("roi") ? `ROI ${metricValue("roi")}` : "", metricAvailable("roas") ? `ROAS ${metricValue("roas")}` : ""].filter(Boolean).join(", ") : "ROI and ROAS unavailable from connected sources" },
        { label: "7-Day Trend Risk", status: trendRisk ? "Risk" : trajectory ? "No Risk" : "Not Enough History", detail: trajectory ? `${trajectory}${trendPct ? ` (${trendPct.toFixed(1)}%)` : ""}` : "Not enough compatible aggregate snapshot history" },
        { label: "Paid Platform Concentration Risk", status: paidSources.length === 0 ? "Not Applicable" : paidConcentrationRisk ? "Risk" : "No Risk", detail: paidSources.length === 0 ? "No connected paid-media source" : paidConcentrationRisk ? (paidSources.length === 1 ? "Only one paid platform connected" : `${topSpendShare.toFixed(0)}% of paid spend is concentrated`) : "Paid source mix is not concentrated" },
      ];

      addText(`7-Day Snapshot Trajectory: ${trajectory ? `${trajectory}${trendPct ? ` (${trendPct.toFixed(1)}%)` : ""}` : "Not enough history"}`, { bold: true, indent: 4 });
      addText(`Risk Level: ${displayedRiskLevel.toUpperCase()}`, { bold: true, indent: 4 });
      addText("Executive Summary", { bold: true, indent: 4 });
      addText(`${report.campaignName || "Campaign"}: ${metricSummary.length > 0 ? `Current connected-source metrics show ${metricSummary.join(" and ")}.` : "Current connected-source metrics do not include enough spend and revenue to calculate ROI or ROAS."} Risk level is ${displayedRiskLevel}. ${trajectory ? `7-day snapshot trajectory is ${trajectory}.` : "7-day snapshot trajectory does not have enough compatible history yet."}`, { indent: 8 });
      addText("Marketing Funnel Performance", { bold: true, indent: 4 });
      addMetricList(["users", "sessions", "conversions", "revenue", "cvr", "roas", "roi"]);
      addText("KPI Progress", { bold: true, indent: 4 });
      if (executiveKpiRows.length === 0) addText("- No mapped campaign KPI rows available.", { indent: 8 });
      executiveKpiRows.forEach((kpi: any) => {
        const current = metricNumber(kpi.aggregateMetric);
        const target = Number(kpi.target) || 0;
        addText(`- ${kpi.name}: ${formatCustomReportMetricValue(kpi.aggregateMetric, current)} / ${formatCustomReportMetricValue(kpi.aggregateMetric, target)} (${progressPct(current, target, kpi.aggregateMetric).toFixed(1)}%)`, { indent: 8 });
      });
      addText("Benchmark Comparison", { bold: true, indent: 4 });
      if (executiveBenchmarkRows.length === 0) addText("- No mapped campaign Benchmark rows available.", { indent: 8 });
      executiveBenchmarkRows.forEach((bm: any) => {
        const current = metricNumber(bm.aggregateMetric);
        const benchmark = Number(bm.benchmark) || 0;
        addText(`- ${bm.metric || bm.name}: Yours ${formatCustomReportMetricValue(bm.aggregateMetric, current)}; Benchmark ${formatCustomReportMetricValue(bm.aggregateMetric, benchmark)} (${progressPct(current, benchmark, bm.aggregateMetric).toFixed(1)}%)`, { indent: 8 });
      });
      addText("Risk Assessment", { bold: true, indent: 4 });
      riskInputRows.forEach((row) => addText(`- ${row.label}: ${row.status} - ${row.detail}`, { indent: 8 }));
    };
    const addExecutiveRecommendationsContent = () => {
      const excludedPlatforms = Array.isArray(campaignExecutiveSummary?.metadata?.dataAccuracy?.platformsExcludedFromRecommendations)
        ? campaignExecutiveSummary.metadata.dataAccuracy.platformsExcludedFromRecommendations
        : [];
      const freshnessWarnings = Array.isArray(campaignExecutiveSummary?.dataFreshness?.warnings) ? campaignExecutiveSummary.dataFreshness.warnings : [];
      const recommendations = Array.isArray(campaignExecutiveSummary?.recommendations) ? campaignExecutiveSummary.recommendations : [];

      if (excludedPlatforms.length > 0) {
        addText("Data Accuracy Notice", { bold: true, indent: 4 });
        addText(`Note: ${excludedPlatforms.join(", ")} ${excludedPlatforms.length === 1 ? "is" : "are"} not a connected paid-media source, so paid-media recommendations are unavailable. Available web analytics and outcome metrics can still feed website recommendations and risk inputs.`, { indent: 8 });
      }
      if (freshnessWarnings.length > 0) {
        addText("Data Freshness Alert", { bold: true, indent: 4 });
        freshnessWarnings.forEach((warning: any) => addText(`- ${warning.source}: ${warning.message}`, { indent: 8 }));
      }
      if (campaignExecutiveSummary?.metadata?.disclaimer) {
        addText("Enterprise Disclaimer", { bold: true, indent: 4 });
        addText(campaignExecutiveSummary.metadata.disclaimer, { indent: 8 });
      }
      if (recommendations.length === 0) {
        addText("No Recommendations Available", { bold: true, indent: 4 });
        addText("Campaign is performing well. Continue monitoring for optimization opportunities.", { indent: 8 });
        return;
      }

      recommendations.forEach((rec: any, index: number) => {
        addText(`Recommendation ${index + 1}: ${formatRecommendationText(rec.action || "")}`, { bold: true, indent: 4 });
        addText(`Category: ${rec.category || "Uncategorized"}`, { indent: 8 });
        if (rec.priority) addText(`Priority: ${rec.priority}`, { indent: 8 });
        if (rec.confidence) addText(`Confidence: ${rec.confidence}`, { indent: 8 });
        addText("Expected Impact", { bold: true, indent: 8 });
        recommendationImpactItems(rec).forEach((item) => addText(`- ${item}`, { indent: 12 }));
        addText(`Timeframe: ${rec.timeline || "Not specified"}`, { bold: true, indent: 8 });
        addText(`Investment Required: ${formatRecommendationText(rec.investmentRequired || "Not specified")}`, { bold: true, indent: 8 });
        if (rec.scenarios) {
          addText("Projected Scenarios", { bold: true, indent: 8 });
          addText(`- Best Case: ${formatRecommendationText(rec.scenarios.bestCase || "")}`, { indent: 12 });
          addText(`- Expected: ${formatRecommendationText(rec.scenarios.expected || "")}`, { indent: 12 });
          addText(`- Worst Case: ${formatRecommendationText(rec.scenarios.worstCase || "")}`, { indent: 12 });
        }
        if (Array.isArray(rec.assumptions) && rec.assumptions.length > 0) {
          addText("Key Assumptions", { bold: true, indent: 8 });
          rec.assumptions.forEach((assumption: string) => addText(`- ${assumption}`, { indent: 12 }));
        }
        if (rec.disclaimer) {
          addText("Recommendation Disclaimer", { bold: true, indent: 8 });
          addText(rec.disclaimer, { indent: 12 });
        }
      });
    };
    const addMetricList = (keys: string[]) => {
      if (!customReportPerformanceSummary) {
        addText("Connected-source aggregate values are unavailable.", { indent: 4 });
        return;
      }
      keys.forEach((key) => addText(`- ${customReportMetricLabels[key] || key}: ${metricValue(key)}`, { indent: 4 }));
    };
    const addSourceList = () => {
      if (customReportSources.length === 0) {
        addText("- No connected main sources available.", { indent: 4 });
        return;
      }
      customReportSources.forEach((source: any) => {
        const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics.join(", ") : "none";
        addText(`- ${source?.label || source?.id}: ${includedMetrics}`, { indent: 4 });
      });
    };
    const addTrendAnalysisContent = (section: string) => {
      const trendRows = Array.isArray(campaignTrendAnalysis?.dailyTotals) ? campaignTrendAnalysis.dailyTotals : [];
      const trendSources = Array.isArray(campaignTrendAnalysis?.sources) ? campaignTrendAnalysis.sources : [];
      const currentWindowDays = Math.max(1, Math.ceil(trendRows.length / 2));
      const currentRows = trendRows.slice(-currentWindowDays);
      const previousRows = trendRows.slice(-currentWindowDays * 2, -currentWindowDays);
      const sumRows = (rows: any[], metricName: string) =>
        rows.reduce((sum: number, row: any) => sum + (Number(row?.metrics?.[metricName]) || 0), 0);
      const aggregateMetric = (rows: any[], metricName: string): number | null => {
        if (rows.length === 0) return null;
        if (["users", "sessions", "conversions", "revenue", "spend", "impressions", "clicks"].includes(metricName)) {
          const value = sumRows(rows, metricName);
          return value > 0 ? value : null;
        }
        const spend = sumRows(rows, "spend");
        const revenue = sumRows(rows, "revenue");
        const conversions = sumRows(rows, "conversions");
        const sessions = sumRows(rows, "sessions");
        const impressions = sumRows(rows, "impressions");
        const clicks = sumRows(rows, "clicks");
        if (metricName === "ctr") return impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null;
        if (metricName === "cvr") return conversions > 0 && (sessions > 0 || clicks > 0) ? (conversions / (sessions > 0 ? sessions : clicks)) * 100 : null;
        if (metricName === "cpc") return spend > 0 && clicks > 0 ? spend / clicks : null;
        if (metricName === "cpm") return spend > 0 && impressions > 0 ? (spend / impressions) * 1000 : null;
        if (metricName === "cpa") return spend > 0 && conversions > 0 ? spend / conversions : null;
        if (metricName === "roas") return spend > 0 && revenue > 0 ? revenue / spend : null;
        if (metricName === "roi") return spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null;
        return null;
      };
      const trendMetricValue = (metricName: string) => {
        const value = aggregateMetric(currentRows, metricName);
        return value === null ? "Unavailable" : formatCustomReportMetricValue(metricName, value);
      };
      const trendChange = (metricName: string) => {
        const current = aggregateMetric(currentRows, metricName);
        const previous = aggregateMetric(previousRows, metricName);
        if (current === null || previous === null || previous === 0) return "No comparable previous window";
        const pct = ((current - previous) / Math.abs(previous)) * 100;
        return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs previous window`;
      };
      const addTrendMetricRows = (metrics: string[], indent = 8) => {
        metrics.forEach((metricName) => {
          addText(`- ${customReportMetricLabels[metricName] || metricName}: ${trendMetricValue(metricName)} (${trendChange(metricName)})`, { indent });
        });
      };
      const sourceMetricValue = (source: any, metricName: string) => {
        const rows = Array.isArray(source?.dailyRows) ? source.dailyRows.slice(-currentWindowDays) : [];
        const value = aggregateMetric(rows, metricName);
        return value === null ? "Unavailable" : formatCustomReportMetricValue(metricName, value);
      };

      if (!campaignTrendAnalysis || trendRows.length === 0) {
        addText("No connected source trend data available. Refresh a connected platform to populate source-aware trend history.", { indent: 4 });
        return;
      }

      if (section === "trend-analysis:overview") {
        addText("Cross-Platform Performance", { bold: true, indent: 4 });
        addText(`Trend window: ${campaignTrendAnalysis.startDate || "Unavailable"} to ${campaignTrendAnalysis.endDate || "Unavailable"}`, { indent: 8 });
        addText(`Current comparable days: ${currentRows.length}; previous comparable days: ${previousRows.length}`, { indent: 8 });
        addText("Summary Metrics", { bold: true, indent: 4 });
        addTrendMetricRows(["sessions", "users", "conversions", "revenue", "cvr", "spend", "roas", "cpa", "ctr"]);
        addText("Anomaly Detection", { bold: true, indent: 4 });
        addText("Anomaly flags require compatible historical daily trend rows. Review major movement in the metric changes above.", { indent: 8 });
      } else if (section === "trend-analysis:efficiency") {
        addText("ROAS & ROI Trend", { bold: true, indent: 4 });
        addTrendMetricRows(["roas", "roi"], 8);
        addText("Cost Efficiency Trend", { bold: true, indent: 4 });
        addTrendMetricRows(["cpa", "cpc", "cpm"], 8);
        addText("Engagement Efficiency", { bold: true, indent: 4 });
        addTrendMetricRows(["ctr", "cvr"], 8);
      } else if (section === "trend-analysis:funnel") {
        addText("Website Conversion Funnel", { bold: true, indent: 4 });
        addTrendMetricRows(["users", "sessions", "conversions", "revenue", "cvr"], 8);
        addText("Paid-Media Funnel", { bold: true, indent: 4 });
        addTrendMetricRows(["impressions", "clicks", "ctr", "spend", "cpa"], 8);
        addText("Paid-media funnel metrics appear only when a connected paid-media source provides impressions or clicks.", { indent: 8 });
      } else if (section === "trend-analysis:platforms") {
        addText("Platform Performance Comparison", { bold: true, indent: 4 });
        if (trendSources.length === 0) {
          addText("- No connected source trend rows available.", { indent: 8 });
        }
        trendSources.forEach((source: any) => {
          const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics : [];
          const sourceMetrics = ["users", "sessions", "spend", "impressions", "clicks", "conversions", "revenue"]
            .filter((metricName) => includedMetrics.includes(metricName))
            .map((metricName) => `${customReportMetricLabels[metricName] || metricName} ${sourceMetricValue(source, metricName)}`);
          addText(`- ${source?.label || source?.id}: ${sourceMetrics.length > 0 ? sourceMetrics.join("; ") : "No comparable metrics available"}`, { indent: 8 });
        });
        addText("Spend Distribution", { bold: true, indent: 4 });
        addText("Spend distribution is available when connected main sources provide source-level spend.", { indent: 8 });
        addText("Efficiency Comparison", { bold: true, indent: 4 });
        addText("CPA and CPC require source-level spend plus conversions or clicks.", { indent: 8 });
      } else if (section === "trend-analysis:insights") {
        addText("Trend Performance Insights", { bold: true, indent: 4 });
        addText(`Connected trend sources: ${trendSources.length > 0 ? trendSources.map((source: any) => source?.label || source?.id).join(", ") : "None"}`, { indent: 8 });
        addText(`Current trend rows available: ${currentRows.length}`, { indent: 8 });
        addText("Recommendation Basis", { bold: true, indent: 4 });
        addTrendMetricRows(["sessions", "users", "conversions", "revenue", "cvr", "spend", "roas", "roi"], 8);
        addText("Next action: compare unfavorable trend movement against campaign KPIs and Benchmarks before changing spend.", { indent: 8 });
      }
    };
    const addDeepDiveSectionContent = (section: string) => {
      addText(getReportTabLabel(report.type, section), { size: 14, bold: true });
      if (section === "executive-summary:overview") {
        addExecutiveOverviewContent();
      } else if (section === "executive-summary:recommendations") {
        addExecutiveRecommendationsContent();
      } else if (section.startsWith("performance-summary:")) {
        addPerformanceSummaryContent(section);
      } else if (section.startsWith("financial-analysis:")) {
        addFinancialAnalysisContent(section);
      } else if (section.startsWith("platform-comparison:")) {
        addPlatformComparisonContent(section);
      } else if (section.startsWith("trend-analysis:")) {
        addTrendAnalysisContent(section);
      } else if (section.endsWith(":overview")) {
        addText("Connected-source summary", { bold: true, indent: 4 });
        addMetricList(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);
      } else if (section.includes(":recommendations") || section.endsWith(":insights")) {
        addText("Recommendation basis", { bold: true, indent: 4 });
        addMetricList(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);
        addText("Next action: compare unavailable or under-target metrics against campaign KPIs and Benchmarks before changing spend.", { indent: 4 });
      } else if (section.includes(":roi-roas")) {
        addMetricList(["revenue", "spend", "roas", "roi"]);
      } else if (section.includes(":cost")) {
        addMetricList(["spend", "cpc", "cpa", "cpm", "roas", "roi"]);
      } else if (section.includes(":budget")) {
        addText("Budget pacing requires connected spend and campaign budget context.", { indent: 4 });
        addMetricList(["spend", "revenue", "roas", "roi"]);
      } else if (section.includes(":performance") || section.includes(":health")) {
        addMetricList(["impressions", "clicks", "users", "sessions", "conversions", "revenue", "cvr"]);
      } else if (section.includes(":changes")) {
        addText("Change analysis requires comparable historical snapshots; this export includes the current connected-source aggregate.", { indent: 4 });
        addMetricList(["users", "sessions", "conversions", "revenue", "cvr"]);
      } else if (section.includes(":efficiency")) {
        addMetricList(["ctr", "cvr", "cpc", "cpa", "roas", "roi"]);
      } else if (section.includes(":funnel")) {
        addMetricList(["users", "sessions", "clicks", "conversions", "revenue", "cvr"]);
      } else if (section.includes(":platforms")) {
        addText("Connected platform inputs", { bold: true, indent: 4 });
        addSourceList();
      } else {
        addMetricList(["impressions", "clicks", "users", "sessions", "conversions", "revenue", "spend", "roas", "roi"]);
      }
      yPosition += 4;
    };

    const selectedSections = Array.isArray(report.selectedSections) ? report.selectedSections : [];
    addText(report.name, { size: 18, bold: true });
    addText(`Report Type: ${getReportTypeLabel(report.type)}`);
    addText(`Generated: ${new Date().toLocaleString()}`);
    yPosition += 4;

    addText("Included sections", { size: 14, bold: true });
    if (selectedSections.length === 0) {
      addText("No sections selected.", { indent: 4 });
    } else {
      selectedSections.forEach((section) => addText(`- ${getReportTabLabel(report.type, section)}`, { indent: 4 }));
    }
    yPosition += 4;

    if (report.type !== "custom") {
      selectedSections.forEach(addDeepDiveSectionContent);
    }

    if (report.type === "custom" && selectedSections.includes("metrics")) {
      addText("Selected metrics", { size: 14, bold: true });
      const selectedMetrics = Array.isArray(report.selectedMetrics) ? report.selectedMetrics : [];
      if (!customReportPerformanceSummary || selectedMetrics.length === 0) {
        addText("No connected-source metrics selected or available.", { indent: 4 });
      } else {
        selectedMetrics.forEach((key) => {
          const metric = customReportPerformanceSummary?.totals?.[key];
          const value = metric?.available === true ? formatCustomReportMetricValue(key, metric.value) : "Unavailable";
          addText(`- ${customReportMetricLabels[key] || key}: ${value}`, { indent: 4 });
        });
      }
      yPosition += 4;
    }

    if (report.type === "custom" && selectedSections.includes("kpis")) {
      addText("Campaign KPIs", { size: 14, bold: true });
      if (campaignKpis.length === 0) {
        addText("No campaign KPI rows configured.", { indent: 4 });
      } else {
        campaignKpis.forEach((record) => {
          const metricKey = resolveCustomReportAggregateMetric(record);
          const metric = metricKey ? customReportPerformanceSummary?.totals?.[metricKey] : null;
          const current = metric?.available === true ? formatCustomReportMetricValue(metricKey!, metric.value) : "Unavailable";
          addText(`- ${record.name || record.metric || "Untitled"}: Current ${current}; Target ${formatCustomReportMetricValue(metricKey || "", record?.targetValue)}`, { indent: 4 });
        });
      }
      yPosition += 4;
    }

    if (report.type === "custom" && selectedSections.includes("benchmarks")) {
      addText("Campaign Benchmarks", { size: 14, bold: true });
      if (campaignBenchmarks.length === 0) {
        addText("No campaign Benchmark rows configured.", { indent: 4 });
      } else {
        campaignBenchmarks.forEach((record) => {
          const metricKey = resolveCustomReportAggregateMetric(record);
          const metric = metricKey ? customReportPerformanceSummary?.totals?.[metricKey] : null;
          const current = metric?.available === true ? formatCustomReportMetricValue(metricKey!, metric.value) : "Unavailable";
          addText(`- ${record.name || record.metric || "Untitled"}: Current ${current}; Benchmark ${formatCustomReportMetricValue(metricKey || "", record?.benchmarkValue)}`, { indent: 4 });
        });
      }
    }

    const safeName = report.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "campaign_report";
    doc.save(`${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                {campaignContextId && (
                  <Link href={`/campaigns/${encodeURIComponent(campaignContextId)}`}>
                    <Button variant="ghost" size="sm" className="mb-2 -ml-3">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to main Campaign Overview
                    </Button>
                  </Link>
                )}
                <h1 className="text-3xl font-bold text-foreground">Reports</h1>
                <p className="text-muted-foreground/70 mt-1">
                  Manage scheduled reports and download historical data
                </p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (!open) resetForm();
              }}>
                <Button onClick={openCreateReport}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
                <DialogContent
                  className="max-w-2xl max-h-[80vh] overflow-y-auto"
                  onOpenAutoFocus={(event) => {
                    if (editingReportId) event.preventDefault();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{editingReportId ? "Edit Report" : "Create Scheduled Report"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Report Name</Label>
                        <Input
                          placeholder="e.g., Weekly Performance Summary"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select
                          value={reportType}
                          onValueChange={(value) => {
                            setReportType(value);
                            setSelectedReportSections([]);
                            setSelectedReportMetrics([]);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select report type" />
                          </SelectTrigger>
                          <SelectContent>
                            {campaignContextId ? (
                              campaignDeepDiveReportTypes.map((type) => (
                                <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="performance">Performance Summary</SelectItem>
                                <SelectItem value="financial">Financial Analysis</SelectItem>
                                <SelectItem value="kpi">KPI Tracking</SelectItem>
                                <SelectItem value="custom">Custom Report</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Input
                          placeholder="Brief description of what this report covers"
                          value={reportDescription}
                          maxLength={REPORT_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) => setReportDescription(limitReportDescription(e.target.value))}
                        />
                        <div className="text-xs text-muted-foreground text-right">
                          {reportDescription.length}/{REPORT_DESCRIPTION_MAX_LENGTH}
                        </div>
                      </div>

                      {campaignContextId && (
                        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                          <div className="font-medium text-foreground">Campaign connected-source data</div>
                          {campaignOutcomeTotalsLoading ? (
                            <div>Checking available connected-source metrics...</div>
                          ) : customReportPerformanceSummary ? (
                            customReportSources.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-5">
                                {customReportSources.map((source: any) => (
                                  <li key={source.id || source.label}>{source.label || source.id}</li>
                                ))}
                              </ul>
                            ) : (
                              <div>No connected sources are available for this campaign yet.</div>
                            )
                          ) : (
                            <div>No connected-source aggregate is available for this campaign yet.</div>
                          )}
                        </div>
                      )}

                      {campaignContextId && reportType !== "custom" && campaignReportTabs.length > 0 && (
                        <div className="space-y-3 rounded-md border p-3">
                          <div>
                            <Label>Tabs to include</Label>
                            <div className="text-sm text-muted-foreground">
                              Select the tabs from this Campaign DeepDive subsection to include in the report.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {campaignReportTabs.map((tab) => (
                                <label key={tab.key} className="flex items-center space-x-2 text-sm">
                                  <Checkbox
                                    checked={selectedReportSections.includes(tab.key)}
                                    onCheckedChange={(checked) => {
                                      setSelectedReportSections((current) => checked
                                        ? Array.from(new Set([...current, tab.key]))
                                        : current.filter((key) => key !== tab.key));
                                    }}
                                  />
                                  <span>{tab.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {campaignContextId && reportType === "custom" && (
                        <div className="space-y-3 rounded-md border p-3">
                          <div>
                            <Label>Tabs to include</Label>
                            <div className="text-sm text-muted-foreground">
                              Select the Custom Report tabs to include in the report.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {customReportSections.map((section) => (
                                <label key={section.key} className="flex items-center space-x-2 text-sm">
                                  <Checkbox
                                    checked={selectedReportSections.includes(section.key)}
                                    onCheckedChange={(checked) => {
                                      setSelectedReportSections((current) => checked
                                        ? Array.from(new Set([...current, section.key]))
                                        : current.filter((key) => key !== section.key));
                                    }}
                                  />
                                  <span>{section.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Metrics</Label>
                            <div className="text-sm text-muted-foreground">
                              Only metrics available from this campaign's connected sources are selectable.
                            </div>
                          </div>
                          {customReportSelectableMetricKeys.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              No connected-source metrics are available for this campaign yet.
                            </div>
                          ) : (
                            customReportMetricGroups.map((group) => {
                              const visibleKeys = group.keys.filter((key) => customReportSelectableMetricSet.has(key));
                              if (visibleKeys.length === 0) return null;
                              return (
                                <div key={group.title} className="space-y-2">
                                  <div className="text-sm font-medium">{group.title}</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {visibleKeys.map((key) => (
                                      <label key={key} className="flex items-center space-x-2 text-sm">
                                        <Checkbox
                                          checked={selectedReportMetrics.includes(key)}
                                          onCheckedChange={(checked) => {
                                            setSelectedReportMetrics((current) => checked
                                              ? Array.from(new Set([...current, key]))
                                              : current.filter((metric) => metric !== key));
                                          }}
                                        />
                                        <span>{customReportMetricLabels[key] || key}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div className="text-xs text-muted-foreground">
                            Unavailable paid-media metrics are hidden until a connected source provides them.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Scheduling */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="enable-schedule"
                          checked={scheduleEnabled}
                          onCheckedChange={(checked) => setScheduleEnabled(checked as boolean)}
                        />
                        <Label htmlFor="enable-schedule" className="text-base font-medium">
                          Schedule Automated Report
                        </Label>
                      </div>
                      
                      {scheduleEnabled && (
                        <div className="ml-6 space-y-4 p-4 border rounded-lg bg-muted">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Frequency</Label>
                              <Select value={scheduleFrequency} onValueChange={(value) => {
                                setScheduleFrequency(value);
                                setScheduleDay(getDefaultScheduleDayForFrequency(value));
                              }}>
                                <SelectTrigger>
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
                            
                            {scheduleFrequency === "weekly" && (
                              <div className="space-y-2">
                                <Label>Day of Week</Label>
                                <Select value={scheduleDay} onValueChange={setScheduleDay}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="monday">Monday</SelectItem>
                                    <SelectItem value="tuesday">Tuesday</SelectItem>
                                    <SelectItem value="wednesday">Wednesday</SelectItem>
                                    <SelectItem value="thursday">Thursday</SelectItem>
                                    <SelectItem value="friday">Friday</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {scheduleFrequency === "monthly" && (
                              <div className="space-y-2">
                                <Label>Day of Month</Label>
                                <Select value={["1", "15", "last"].includes(scheduleDay) ? scheduleDay : "1"} onValueChange={setScheduleDay}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1st day of month</SelectItem>
                                    <SelectItem value="15">15th day of month</SelectItem>
                                    <SelectItem value="last">Last day of month</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {scheduleFrequency === "quarterly" && (
                              <div className="space-y-2">
                                <Label>Quarter Timing</Label>
                                <Select value={["start", "end"].includes(scheduleDay) ? scheduleDay : "end"} onValueChange={setScheduleDay}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="start">Start of quarter</SelectItem>
                                    <SelectItem value="end">End of quarter</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              <Label>Time</Label>
                              <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="06:00">6:00 AM</SelectItem>
                                  <SelectItem value="09:00">9:00 AM</SelectItem>
                                  <SelectItem value="12:00">12:00 PM</SelectItem>
                                  <SelectItem value="15:00">3:00 PM</SelectItem>
                                  <SelectItem value="18:00">6:00 PM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Email Recipients</Label>
                            <Input
                              placeholder="Enter email addresses (comma-separated)"
                              value={recipients}
                              onChange={(e) => setRecipients(e.target.value)}
                            />
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                              Scheduled reports are sent by email using the saved recipients and your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {reportSaveError && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {reportSaveError}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <div className="flex items-center space-x-3">
                        <Button 
                          onClick={saveReport}
                          disabled={!isReportFormValid || !isReportFormChanged}
                        >
                          {editingReportId ? "Update Report" : scheduleEnabled ? "Schedule Report" : "Download Report"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Reports Tabs */}
            <Tabs defaultValue="standard" className="space-y-6">
              <TabsList>
                <TabsTrigger value="standard">Standard Reports</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
                <TabsTrigger value="all">All Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="scheduled" className="space-y-6">
                <div className="grid gap-6">
                  {storedScheduledReports.length === 0 ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-muted-foreground/70">
                          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No scheduled reports yet</p>
                          <p>Use Schedule Report to create an automated report.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    storedScheduledReports.map((report) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{report.name}</CardTitle>
                            {report.description && (
                              <p className="text-sm text-muted-foreground">{report.description}</p>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground/70">
                              <div className="flex items-center space-x-1">
                                <FileText className="w-4 h-4" />
                                <span>{getReportTypeLabel(report.type)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{report.schedule?.frequency || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Mail className="w-4 h-4" />
                                <span>{report.schedule?.recipients.length || 0} recipient(s)</span>
                              </div>
                              {report.campaignName && (
                                <div className="flex items-center space-x-1">
                                  <span>Campaign: {report.campaignName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-foreground">Created:</span>
                              <div className="text-muted-foreground/70">
                                {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Schedule:</span>
                              <div className="text-muted-foreground/70">
                                {report.schedule ? `${report.schedule.frequency} at ${report.schedule.time}` : 'Not scheduled'}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Data Included:</span>
                              <div className="text-muted-foreground/70">
                                {getReportSelectedTabSummary(report)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => downloadReportPdf(report)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download latest report
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openEditReport(report)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => report.status === "Paused" ? resumeScheduledReport(report) : pauseScheduledReport(report)}>
                                {report.status === "Paused" ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                                {report.status === "Paused" ? "Resume" : "Pause"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setReportPendingDelete(report)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="all">
                <div className="space-y-6">
                  {/* Filters */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filter Reports
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="space-y-2">
                          <Label>Search</Label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground/70" />
                            <Input
                              placeholder="Search reports or campaigns..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        {/* Type Filter */}
                        <div className="space-y-2">
                          <Label>Report Type</Label>
                          <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              {uniqueTypes.map((type) => (
                                <SelectItem key={type} value={type}>{getReportTypeLabel(type)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date Filter */}
                        <div className="space-y-2">
                          <Label>Date Range</Label>
                          <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Dates</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="week">Last 7 days</SelectItem>
                              <SelectItem value="month">Last 30 days</SelectItem>
                              <SelectItem value="quarter">Last 90 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Results */}
                  <div className="space-y-4">
                    {filteredReports.length === 0 ? (
                      <Card>
                        <CardContent className="py-12">
                          <div className="text-center text-muted-foreground/70">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No reports found</p>
                            <p>Try adjusting your filters or create a new report from a campaign page.</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground/70">
                            Showing {filteredReports.length} of {allStoredReports.length} reports
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSearchQuery("");
                              setTypeFilter("all");
                              setDateFilter("all");
                            }}
                          >
                            Clear Filters
                          </Button>
                        </div>

                        <div className="grid gap-4">
                          {filteredReports.map((report) => (
                            <Card key={report.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                      <h3 className="font-semibold text-lg">{report.name}</h3>
                                      {report.status !== 'Generated' && (
                                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                          {report.status}
                                        </Badge>
                                      )}
                                    </div>
                                    {report.description && (
                                      <p className="text-sm text-muted-foreground">{report.description}</p>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-foreground">Type:</span>
                                        <div className="text-muted-foreground/70">{getReportTypeLabel(report.type)}</div>
                                      </div>
                                      
                                      {report.campaignName && (
                                        <div>
                                          <span className="font-medium text-foreground">Campaign:</span>
                                          <div className="text-muted-foreground/70">{report.campaignName}</div>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <span className="font-medium text-foreground">
                                          {report.status === 'Scheduled' ? 'Created:' : 'Generated:'}
                                        </span>
                                        <div className="text-muted-foreground/70">
                                          {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                                        </div>
                                      </div>
                                    </div>

                                    {report.schedule && (
                                      <div className="text-sm">
                                        <span className="font-medium text-foreground">Schedule:</span>
                                        <span className="text-muted-foreground/70 ml-2">
                                          {report.schedule.frequency} at {report.schedule.time}
                                          {report.schedule.recipients.length > 0 && 
                                            ` • ${report.schedule.recipients.length} recipient(s)`
                                          }
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditReport(report)}
                                      aria-label={`Edit ${report.name}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => downloadReportPdf(report)}>
                                      <Download className="w-4 h-4 mr-2" />
                                      Download latest report
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => setReportPendingDelete(report)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="standard">
                <div className="space-y-4">
                  {standardReports.length === 0 ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-muted-foreground/70">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No standard reports yet</p>
                          <p>Use Download Report to create a standard downloadable report.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    standardReports.map((report) => (
                      <Card key={report.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <h3 className="font-semibold text-lg">{report.name}</h3>
                              {report.description && (
                                <p className="text-sm text-muted-foreground">{report.description}</p>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Type:</span>
                                  <div className="text-muted-foreground/70">{getReportTypeLabel(report.type)}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Generated:</span>
                                  <div className="text-muted-foreground/70">
                                    {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditReport(report)}
                                aria-label={`Edit ${report.name}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => downloadReportPdf(report)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download latest report
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setReportPendingDelete(report)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <AlertDialog open={!!reportPendingDelete} onOpenChange={(open) => !open && setReportPendingDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete report?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{reportPendingDelete?.name || "this report"}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deletePendingReport} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </main>
      </div>
    </div>
  );
}

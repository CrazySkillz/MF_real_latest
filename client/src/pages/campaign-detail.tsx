import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, BarChart3, Users, MousePointer, DollarSign, FileSpreadsheet, ChevronDown, Settings, Target, Download, FileText, Calendar, PieChart, TrendingUp, TrendingDown, Copy, Share2, Filter, CheckCircle2, Clock, AlertCircle, GitCompare, Briefcase, Send, MessageCircle, Bot, User, Award, Plus, Edit2, Trash2, Pencil, Star, X } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ColumnMappingInterface } from "@/components/ColumnMappingInterface";
import { GuidedColumnMapping } from "@/components/GuidedColumnMapping";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiGoogle, SiFacebook, SiLinkedin, SiX } from "react-icons/si";
import { format } from "date-fns";
import { reportStorage } from "@/lib/reportStorage";
import { exportCampaignKPIsToPDF, exportCampaignBenchmarksToPDF } from "@/lib/pdfExport";
import { GA4ConnectionFlow } from "@/components/GA4ConnectionFlow";
import { SimpleGoogleSheetsAuth } from "@/components/SimpleGoogleSheetsAuth";
import { LinkedInConnectionFlow } from "@/components/LinkedInConnectionFlow";
import { SimpleMetaAuth } from "@/components/SimpleMetaAuth";
import { WebhookTester } from "@/components/WebhookTester";
import { DataSourcesTab } from "@/components/DataSourcesTab";
interface Campaign {
  id: string;
  name: string;
  clientWebsite?: string;
  label?: string;
  budget?: string;
  type?: string;
  platform?: string;
  impressions: number;
  clicks: number;
  spend: string;
  status: string;
  createdAt: string;
}

interface ConnectedPlatformStatus {
  conversionValue?: string | null;
  id: string;
  name: string;
  connected: boolean;
  connectedCampaignLevel?: boolean;
  analyticsPath?: string | null;
  lastConnectedAt?: string | null;
}

interface PlatformMetrics {
  platform: string;
  connected: boolean;
  requiresImport?: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  ctr: string;
  cpc: string;
  analyticsPath?: string | null;
}

const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

const devError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

// Benchmark Interface
interface Benchmark {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  category: string;
  industry: string;
  period: string;
  status: 'above' | 'below' | 'meeting';
  improvement: number;
  createdAt: Date;
}

// Helper function to format numbers with commas
const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// Helper function to format input numbers with commas (preserves user input)
const formatInputNumber = (value: string): string => {
  // Remove all non-digit and non-decimal characters
  const cleaned = value.replace(/[^\d.]/g, '');
  // Split on decimal point
  const parts = cleaned.split('.');
  // Format integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Return formatted value (with decimal if present)
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
};

// Helper function to parse formatted number (removes commas)
const parseFormattedNumber = (value: string): number => {
  const cleaned = value.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

// Scheduled Reports Section Component
function ScheduledReportsSection({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpi-reports`],
    enabled: !!campaignId,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formFrequency, setFormFrequency] = useState('weekly');
  const [formDay, setFormDay] = useState('1'); // day of week (0-6) or day of month
  const [formTime, setFormTime] = useState('09:00');
  const [formRecipients, setFormRecipients] = useState('');
  const [formSections, setFormSections] = useState<string[]>(['kpis', 'benchmarks', 'overview']);

  const resetForm = () => {
    setFormName('');
    setFormFrequency('weekly');
    setFormDay('1');
    setFormTime('09:00');
    setFormRecipients('');
    setFormSections(['kpis', 'benchmarks', 'overview']);
    setEditingReport(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (report: any) => {
    setEditingReport(report);
    setFormName(report.name || '');
    setFormFrequency(report.scheduleFrequency || 'weekly');
    setFormDay(String(report.scheduleDayOfWeek ?? report.scheduleDayOfMonth ?? '1'));
    setFormTime(report.scheduleTime || '09:00');
    setFormRecipients(Array.isArray(report.scheduleRecipients) ? report.scheduleRecipients.join(', ') : '');
    setFormSections(report.sections || ['kpis', 'benchmarks', 'overview']);
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', `/api/campaigns/${campaignId}/kpi-reports`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpi-reports`] });
      toast({ title: "Report Created", description: "Scheduled report has been created." });
      setShowForm(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create report.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest('PATCH', `/api/campaigns/${campaignId}/kpi-reports/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpi-reports`] });
      toast({ title: "Report Updated", description: "Scheduled report has been updated." });
      setShowForm(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update report.", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest('DELETE', `/api/campaigns/${campaignId}/kpi-reports/${reportId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpi-reports`] });
      toast({ title: "Report Deleted", description: "Scheduled report has been removed." });
    },
  });

  const handleSubmit = () => {
    const recipients = formRecipients.split(',').map(e => e.trim()).filter(Boolean);
    const payload: any = {
      name: formName || 'KPI Report',
      scheduleFrequency: formFrequency,
      scheduleTime: formTime,
      scheduleRecipients: recipients,
      sections: formSections,
    };
    if (formFrequency === 'weekly') {
      payload.scheduleDayOfWeek = parseInt(formDay);
    } else if (formFrequency === 'monthly' || formFrequency === 'quarterly') {
      payload.scheduleDayOfMonth = parseInt(formDay);
    }
    if (editingReport) {
      updateMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const formatScheduleDetails = (report: any) => {
    const parts = [];
    if (report.scheduleFrequency) {
      parts.push(report.scheduleFrequency.charAt(0).toUpperCase() + report.scheduleFrequency.slice(1));
    }
    if (report.scheduleFrequency === 'weekly' && report.scheduleDayOfWeek !== null) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      parts.push(`on ${days[report.scheduleDayOfWeek]}`);
    }
    if ((report.scheduleFrequency === 'monthly' || report.scheduleFrequency === 'quarterly') && report.scheduleDayOfMonth) {
      parts.push(`on day ${report.scheduleDayOfMonth}`);
    }
    if (report.scheduleTime) {
      parts.push(`at ${report.scheduleTime}`);
    }
    return parts.join(' ');
  };

  const toggleSection = (section: string) => {
    setFormSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-600 dark:text-slate-400">
            Loading scheduled reports...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Scheduled Reports
        </h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingReport ? 'Edit Report' : 'Create Scheduled Report'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Report Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., Weekly KPI Summary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formFrequency === 'weekly' && (
                <div>
                  <Label>Day of Week</Label>
                  <Select value={formDay} onValueChange={setFormDay}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formFrequency === 'monthly' || formFrequency === 'quarterly') && (
                <div>
                  <Label>Day of Month</Label>
                  <Input type="number" min="1" max="28" value={formDay} onChange={e => setFormDay(e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <Label>Send Time</Label>
              <Input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
            </div>
            <div>
              <Label>Recipients (comma-separated emails)</Label>
              <Input value={formRecipients} onChange={e => setFormRecipients(e.target.value)} placeholder="email@example.com, team@example.com" />
            </div>
            <div>
              <Label className="mb-2 block">Include Sections</Label>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'overview', label: 'Overview Metrics' },
                  { id: 'kpis', label: 'KPIs' },
                  { id: 'benchmarks', label: 'Benchmarks' },
                ].map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={formSections.includes(s.id)} onCheckedChange={() => toggleSection(s.id)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingReport ? 'Update' : 'Create'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      {reports.length === 0 && !showForm ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No Scheduled Reports
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Schedule automated reports to have them delivered to your inbox on a regular basis.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {report.name || 'KPI Report'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {formatScheduleDetails(report)}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {report.scheduleRecipients && Array.isArray(report.scheduleRecipients)
                        ? `${report.scheduleRecipients.length} recipient(s): ${report.scheduleRecipients.slice(0, 2).join(', ')}${report.scheduleRecipients.length > 2 ? '...' : ''}`
                        : 'No recipients'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(report)}>
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteReportMutation.mutate(report.id)}
                    data-testid={`button-delete-report-${report.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// Campaign KPIs Component
function CampaignKPIs({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  const { data: kpis = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/kpis`],
    enabled: !!campaign.id,
  });

  // Outcome-centric campaign totals (dynamic: GA4 outcomes + unified spend + all connected platform inputs)
  const { data: outcomeTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/outcome-totals`, "30days"],
    enabled: !!campaign.id,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaign.id}/outcome-totals?dateRange=30days`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'download' | 'schedule'>('download');
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiCalculationConfig, setKpiCalculationConfig] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'monthly',
    recipients: '',
    timeOfDay: '09:00',
    dayOfWeek: 'monday',
    dayOfMonth: '1',
  });
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    metric: '',
    currentValue: '',
    targetValue: '',
    unit: '',
    category: '',
    timeframe: 'Monthly',
    targetDate: '',
    alertEnabled: false,
    alertThreshold: '',
    alertCondition: 'below' as 'below' | 'above' | 'equals',
    alertEmails: '',
  });

  const parseNumSafe = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  type CalcInputKey =
    | 'revenue'
    | 'spend'
    | 'conversions'
    | 'sessions'
    | 'users'
    | 'clicks'
    | 'impressions'
    | 'leads';

  type CalcConfig = {
    metric: string;
    definition?: 'website' | 'click';
    inputs: Partial<Record<CalcInputKey, string[]>>;
  };

  const getMetricDisplayName = (metric: string): string => {
    switch (String(metric || '')) {
      case 'roas':
        return 'ROAS';
      case 'roi':
        return 'ROI';
      case 'cpa':
        return 'CPA';
      case 'ctr':
        return 'CTR';
      case 'revenue':
        return 'Revenue';
      case 'spend':
        return 'Spend';
      case 'conversions':
        return 'Conversions';
      case 'conversion-rate-website':
        return 'Conversion Rate (website)';
      case 'conversion-rate-click':
        return 'Conversion Rate (click-based)';
      case 'users':
        return 'Users';
      case 'sessions':
        return 'Sessions';
      default:
        return String(metric || '');
    }
  };

  const normalizeCalcConfig = (raw: any): CalcConfig | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw as CalcConfig;
  };

  const getConnectedPlatformFlags = () => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    return {
      ga4: Boolean(ot?.ga4?.connected),
      customIntegration: Boolean(platforms?.customIntegration?.connected),
      linkedin: Boolean(platforms?.linkedin?.connected),
      meta: Boolean(platforms?.meta?.connected),
      shopify: Boolean((ot?.revenueSources || []).some((s: any) => s?.type === 'shopify' && s?.connected)),
      hubspot: Boolean((ot?.revenueSources || []).some((s: any) => s?.type === 'hubspot' && s?.connected)),
      salesforce: Boolean((ot?.revenueSources || []).some((s: any) => s?.type === 'salesforce' && s?.connected)),
    };
  };

  const getRevenueSourceValue = (sourceId: string): number => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const revenueSources = ot?.revenueSources || [];
    if (sourceId === 'ga4') return parseNumSafe(ot?.ga4?.revenue);
    if (sourceId === 'custom_integration') return parseNumSafe(platforms?.customIntegration?.revenue);
    if (sourceId === 'linkedin') return parseNumSafe(platforms?.linkedin?.attributedRevenue);
    if (sourceId === 'shopify' || sourceId === 'hubspot' || sourceId === 'salesforce') {
      const match = (revenueSources || []).find((s: any) => String(s?.type) === sourceId);
      return parseNumSafe(match?.lastTotalRevenue);
    }
    return 0;
  };

  const getMetricSourceValue = (inputKey: CalcInputKey, sourceId: string): number => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};

    // Spend sources
    if (inputKey === 'spend') {
      if (sourceId === 'imported_spend') return parseNumSafe(ot?.spend?.persistedSpend);
      if (sourceId === 'linkedin') return parseNumSafe(platforms?.linkedin?.spend);
      if (sourceId === 'meta') return parseNumSafe(platforms?.meta?.spend);
      if (sourceId === 'custom_integration') return parseNumSafe(platforms?.customIntegration?.spend);
      return 0;
    }

    // Revenue sources
    if (inputKey === 'revenue') return getRevenueSourceValue(sourceId);

    // Website analytics-style metrics (GA4 or Custom Integration)
    if (sourceId === 'ga4') {
      if (inputKey === 'conversions') return parseNumSafe(ot?.ga4?.conversions);
      if (inputKey === 'sessions') return parseNumSafe(ot?.ga4?.sessions);
      if (inputKey === 'users') return parseNumSafe(ot?.ga4?.users);
    }
    if (sourceId === 'custom_integration') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.customIntegration?.conversions);
      if (inputKey === 'sessions') return parseNumSafe(platforms?.customIntegration?.sessions);
      if (inputKey === 'users') return parseNumSafe(platforms?.customIntegration?.users);
    }

    // Ad platform-style metrics
    if (sourceId === 'linkedin') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.linkedin?.conversions);
      if (inputKey === 'clicks') return parseNumSafe(platforms?.linkedin?.clicks);
      if (inputKey === 'impressions') return parseNumSafe(platforms?.linkedin?.impressions);
      if (inputKey === 'leads') return parseNumSafe(platforms?.linkedin?.leads);
    }
    if (sourceId === 'meta') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.meta?.conversions);
      if (inputKey === 'clicks') return parseNumSafe(platforms?.meta?.clicks);
      if (inputKey === 'impressions') return parseNumSafe(platforms?.meta?.impressions);
      // leads not available in current meta shape
    }

    return 0;
  };

  const sumSelected = (inputKey: CalcInputKey, sourceIds: string[] = []) => {
    return (sourceIds || []).reduce((sum, id) => sum + getMetricSourceValue(inputKey, id), 0);
  };

  const computeCurrentFromConfig = (rawConfig: any): { value: number | null; unit: string } => {
    const cfg = normalizeCalcConfig(rawConfig);
    if (!cfg || !cfg.metric) return { value: null, unit: '' };

    const metric = String(cfg.metric);

    if (metric === 'revenue') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      return { value: revenue, unit: '$' };
    }
    if (metric === 'spend') {
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      return { value: spend, unit: '$' };
    }
    if (metric === 'conversions') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      return { value: conv, unit: '' };
    }
    if (metric === 'users') {
      const users = sumSelected('users', cfg.inputs?.users || []);
      return { value: users, unit: '' };
    }
    if (metric === 'sessions') {
      const sessions = sumSelected('sessions', cfg.inputs?.sessions || []);
      return { value: sessions, unit: '' };
    }
    if (metric === 'leads') {
      const leads = sumSelected('leads', cfg.inputs?.leads || []);
      return { value: leads, unit: '' };
    }
    if (metric === 'ctr') {
      const clicks = sumSelected('clicks', cfg.inputs?.clicks || []);
      const impressions = sumSelected('impressions', cfg.inputs?.impressions || []);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return { value: ctr, unit: '%' };
    }
    if (metric === 'conversion-rate-website') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const sessions = sumSelected('sessions', cfg.inputs?.sessions || []);
      const rate = sessions > 0 ? (conv / sessions) * 100 : 0;
      return { value: rate, unit: '%' };
    }
    if (metric === 'conversion-rate-click') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const clicks = sumSelected('clicks', cfg.inputs?.clicks || []);
      const rate = clicks > 0 ? (conv / clicks) * 100 : 0;
      return { value: rate, unit: '%' };
    }

    // Derived efficiency metrics (blended)
    if (metric === 'roas') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const roasPct = spend > 0 ? (revenue / spend) * 100 : 0;
      return { value: roasPct, unit: '%' };
    }
    if (metric === 'roi') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      return { value: roi, unit: '%' };
    }
    if (metric === 'cpa') {
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const cpa = conv > 0 ? spend / conv : 0;
      return { value: cpa, unit: '$' };
    }
    if (metric === 'cpl') {
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const leads = sumSelected('leads', cfg.inputs?.leads || []);
      const cpl = leads > 0 ? spend / leads : 0;
      return { value: cpl, unit: '$' };
    }

    return { value: null, unit: '' };
  };

  const getInputOptions = (inputKey: CalcInputKey) => {
    const connected = getConnectedPlatformFlags();
    const platforms = (outcomeTotals || {})?.platforms || {};
    const revenueSources = (outcomeTotals || {})?.revenueSources || [];

    const base: Array<{ id: string; label: string; enabled: boolean; reason?: string; value?: number }> = [];

    if (inputKey === 'revenue') {
      // GA4 (website analytics)
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: true, value: getRevenueSourceValue('ga4') });
      // Custom integration revenue
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: getRevenueSourceValue('custom_integration') });
      // Revenue connectors
      if (connected.shopify) {
        base.push({ id: 'shopify', label: 'Shopify', enabled: true, value: getRevenueSourceValue('shopify') });
      }
      if (connected.hubspot) {
        base.push({ id: 'hubspot', label: 'HubSpot', enabled: true, value: getRevenueSourceValue('hubspot') });
      }
      if (connected.salesforce) {
        base.push({ id: 'salesforce', label: 'Salesforce', enabled: true, value: getRevenueSourceValue('salesforce') });
      }

      // Show connected ad platforms (disabled for revenue unless present)
      if (connected.linkedin) {
        const has = platforms?.linkedin?.attributedRevenue !== undefined && platforms?.linkedin?.attributedRevenue !== null;
        base.push({
          id: 'linkedin',
          label: 'LinkedIn',
          enabled: Boolean(has && parseNumSafe(platforms?.linkedin?.attributedRevenue) > 0),
          reason: 'Revenue not connected for this platform',
          value: getRevenueSourceValue('linkedin'),
        });
      }
      if (connected.meta) {
        base.push({ id: 'meta', label: 'Meta', enabled: false, reason: 'Revenue not connected for this platform' });
      }

      return base;
    }

    if (inputKey === 'spend') {
      const imported = parseNumSafe((outcomeTotals || {})?.spend?.persistedSpend) > 0;
      base.push({ id: 'imported_spend', label: 'Imported Spend', enabled: imported, reason: imported ? undefined : 'No imported spend connected', value: parseNumSafe((outcomeTotals || {})?.spend?.persistedSpend) });
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: true, value: parseNumSafe(platforms?.linkedin?.spend) });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: true, value: parseNumSafe(platforms?.meta?.spend) });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: parseNumSafe(platforms?.customIntegration?.spend) });
      return base;
    }

    if (inputKey === 'conversions') {
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: true, value: parseNumSafe((outcomeTotals || {})?.ga4?.conversions) });
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: true, value: parseNumSafe(platforms?.linkedin?.conversions) });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: true, value: parseNumSafe(platforms?.meta?.conversions) });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: parseNumSafe(platforms?.customIntegration?.conversions) });
      return base;
    }

    if (inputKey === 'sessions') {
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: true, value: parseNumSafe((outcomeTotals || {})?.ga4?.sessions) });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: parseNumSafe(platforms?.customIntegration?.sessions) });
      // Show ad platforms as connected but disabled for sessions
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: false, reason: 'Sessions not available for this platform' });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: false, reason: 'Sessions not available for this platform' });
      return base;
    }

    if (inputKey === 'users') {
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: true, value: parseNumSafe((outcomeTotals || {})?.ga4?.users) });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: parseNumSafe(platforms?.customIntegration?.users) });
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: false, reason: 'Users not available for this platform' });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: false, reason: 'Users not available for this platform' });
      return base;
    }

    if (inputKey === 'clicks') {
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: true, value: parseNumSafe(platforms?.linkedin?.clicks) });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: true, value: parseNumSafe(platforms?.meta?.clicks) });
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: false, reason: 'Clicks not available for this source' });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: false, reason: 'Clicks not available for this source' });
      return base;
    }

    if (inputKey === 'impressions') {
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: true, value: parseNumSafe(platforms?.linkedin?.impressions) });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: true, value: parseNumSafe(platforms?.meta?.impressions) });
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: false, reason: 'Impressions not available for this source' });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: false, reason: 'Impressions not available for this source' });
      return base;
    }

    if (inputKey === 'leads') {
      if (connected.linkedin) base.push({ id: 'linkedin', label: 'LinkedIn', enabled: true, value: parseNumSafe(platforms?.linkedin?.leads) });
      if (connected.meta) base.push({ id: 'meta', label: 'Meta', enabled: false, reason: 'Leads not available for this platform' });
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: false, reason: 'Leads not available for this source' });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: false, reason: 'Leads not available for this source' });
      return base;
    }

    return base;
  };

  const getRequiredInputsForMetric = (metric: string): CalcInputKey[] => {
    const m = String(metric || '');
    if (m === 'revenue') return ['revenue'];
    if (m === 'spend') return ['spend'];
    if (m === 'conversions') return ['conversions'];
    if (m === 'users') return ['users'];
    if (m === 'sessions') return ['sessions'];
    if (m === 'leads') return ['leads'];
    if (m === 'ctr') return ['clicks', 'impressions'];
    if (m === 'conversion-rate-website') return ['conversions', 'sessions'];
    if (m === 'conversion-rate-click') return ['conversions', 'clicks'];
    if (m === 'roi' || m === 'roas') return ['revenue', 'spend'];
    if (m === 'cpa') return ['spend', 'conversions'];
    if (m === 'cpl') return ['spend', 'leads'];
    return [];
  };

  const getMetricDisplayUnit = (metric: string): string => {
    const m = String(metric || '');
    if (m === 'revenue' || m === 'spend' || m === 'cpa' || m === 'cpl') return '$';
    if (m === 'roi' || m === 'ctr' || m === 'conversion-rate-website' || m === 'conversion-rate-click' || m === 'roas') return '%';
    return '';
  };

  const isTileMetric = (metric: string): boolean => {
    return [
      'revenue',
      'roas',
      'roi',
      'spend',
      'conversions',
      'conversion-rate-website',
      'conversion-rate-click',
      'cpa',
      'users',
      'ctr',
    ].includes(String(metric || ''));
  };

  const getTileDisabledReason = (metric: string): string | null => {
    const m = String(metric || '');
    const required = getRequiredInputsForMetric(m);
    if (!required.length) return null;

    for (const input of required) {
      const hasAny = getInputOptions(input).some(o => o.enabled);
      if (!hasAny) return 'Required inputs not connected';
    }
    return null;
  };

  const formatSourceLabel = (id: string): string => {
    switch (String(id || '')) {
      case 'ga4':
        return 'GA4';
      case 'linkedin':
        return 'LinkedIn';
      case 'meta':
        return 'Meta';
      case 'custom_integration':
        return 'Custom Integration';
      case 'imported_spend':
        return 'Imported Spend';
      case 'shopify':
        return 'Shopify';
      case 'hubspot':
        return 'HubSpot';
      case 'salesforce':
        return 'Salesforce';
      default:
        return String(id || '');
    }
  };

  const formatSourcesSelected = (rawConfig: any): string => {
    const cfg = normalizeCalcConfig(rawConfig) as any;
    if (!cfg || !cfg.inputs) return '';

    const parts: string[] = [];
    const push = (label: string, ids: string[] | undefined) => {
      const uniq = Array.from(new Set((ids || []).filter(Boolean)));
      if (!uniq.length) return;
      parts.push(`${label}(${uniq.map(formatSourceLabel).join('+')})`);
    };

    const metric = String(cfg.metric || '');
    if (metric === 'conversion-rate-website') {
      parts.push('Website CR');
      push('Conv', cfg.inputs.conversions);
      push('Sessions', cfg.inputs.sessions);
      return parts.join(' • ');
    }
    if (metric === 'conversion-rate-click') {
      parts.push('Click CR');
      push('Conv', cfg.inputs.conversions);
      push('Clicks', cfg.inputs.clicks);
      return parts.join(' • ');
    }

    push('Rev', cfg.inputs.revenue);
    push('Spend', cfg.inputs.spend);
    push('Conv', cfg.inputs.conversions);
    push('Leads', cfg.inputs.leads);
    push('Users', cfg.inputs.users);
    push('Sessions', cfg.inputs.sessions);
    push('Clicks', cfg.inputs.clicks);
    push('Impr', cfg.inputs.impressions);

    // Keep it short for cards
    return parts.slice(0, 3).join(' • ') + (parts.length > 3 ? ' • …' : '');
  };

  const formatValueWithUnit = (value: number, unit: string): string => {
    const u = String(unit || '').trim();
    const fixed2 = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const integer = (n: number) =>
      n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (u === '$') return `$${fixed2(value)}`;
    if (u === '%') return `${fixed2(value)}%`;
    if (u === 'x') return `${fixed2(value)}x`;

    // Default: counts / whole-number metrics
    return integer(value);
  };

  const isConfigCompleteForMetric = (metric: string, rawConfig: any): boolean => {
    if (!isTileMetric(metric)) return true;
    const cfg = normalizeCalcConfig(rawConfig);
    if (!cfg) return false;
    const m = String(metric || '');
    const requiredInputs = getRequiredInputsForMetric(m);
    return requiredInputs.every((k) => (cfg.inputs?.[k] || []).length > 0);
  };

  // Keep Current Value in sync with selected sources (no defaults; computed preview becomes the stored currentValue snapshot).
  useEffect(() => {
    if (!isTileMetric(kpiForm.metric)) return;
    const computed = computeCurrentFromConfig(kpiCalculationConfig);
    const unit = getMetricDisplayUnit(kpiForm.metric);
    setKpiForm((prev) => ({
      ...prev,
      unit,
      currentValue: computed.value === null ? '' : formatNumber(computed.value),
    }));
  }, [kpiCalculationConfig, kpiForm.metric]);

  const getUnifiedConversions = (): number => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const platforms = ot?.platforms || {};
    const webConnected = Boolean(web?.connected);
    const webConv = parseNumSafe(web?.conversions);
    if (webConnected) return webConv;
    const li = platforms?.linkedin || {};
    const meta = platforms?.meta || {};
    const ci = platforms?.customIntegration || {};
    return (
      parseNumSafe(li?.conversions) +
      parseNumSafe(meta?.conversions) +
      parseNumSafe(ci?.conversions)
    );
  };

  const getLiveCampaignMetric = (key: string): { value: string; unit: string; category: string } => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const spend = ot?.spend || {};
    const rev = ot?.revenue || {};
    const unifiedSpend = parseNumSafe(spend?.unifiedSpend);
    const onsiteRevenue = parseNumSafe(rev?.onsiteRevenue ?? web?.revenue);
    const offsiteRevenue = parseNumSafe(rev?.offsiteRevenue);
    const totalRevenue = parseNumSafe(rev?.totalRevenue);
    const conversions = parseNumSafe(web?.conversions);
    const totalConversions = getUnifiedConversions();
    const sessions = parseNumSafe(web?.sessions);
    const users = parseNumSafe(web?.users);

    const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
    const roas = unifiedSpend > 0 ? (totalRevenue / unifiedSpend) : 0;
    const roi = unifiedSpend > 0 ? (((totalRevenue - unifiedSpend) / unifiedSpend) * 100) : 0;
    const cpa = totalConversions > 0 ? (unifiedSpend / totalConversions) : 0;

    switch (String(key || '')) {
      case 'total-conversions':
        return { value: formatNumber(totalConversions), unit: '', category: 'Performance' };
      case 'ga4-revenue':
        return { value: formatNumber(onsiteRevenue), unit: '$', category: 'Revenue' };
      case 'offsite-revenue':
        return { value: formatNumber(offsiteRevenue), unit: '$', category: 'Revenue' };
      case 'total-revenue':
        return { value: formatNumber(totalRevenue), unit: '$', category: 'Revenue' };
      case 'ga4-conversions':
        return { value: formatNumber(conversions), unit: '', category: 'Performance' };
      case 'ga4-conversion-rate':
        return { value: formatNumber(conversionRate), unit: '%', category: 'Performance' };
      case 'total-spend':
        return { value: formatNumber(unifiedSpend), unit: '$', category: 'Cost Efficiency' };
      case 'roas':
        return { value: formatNumber(roas), unit: 'x', category: 'Performance' };
      case 'roi':
        return { value: formatNumber(roi), unit: '%', category: 'Performance' };
      case 'cpa':
        return { value: formatNumber(cpa), unit: '$', category: 'Cost Efficiency' };
      case 'ga4-users':
        return { value: formatNumber(users), unit: '', category: 'Engagement' };
      case 'ga4-sessions':
        return { value: formatNumber(sessions), unit: '', category: 'Engagement' };
      default:
        return { value: '', unit: '', category: '' };
    }
  };

  const getLiveCampaignMetricNumber = (key: string): number | null => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const spend = ot?.spend || {};
    const rev = ot?.revenue || {};
    const unifiedSpend = parseNumSafe(spend?.unifiedSpend);
    const onsiteRevenue = parseNumSafe(rev?.onsiteRevenue ?? web?.revenue);
    const offsiteRevenue = parseNumSafe(rev?.offsiteRevenue);
    const totalRevenue = parseNumSafe(rev?.totalRevenue);
    const conversions = parseNumSafe(web?.conversions);
    const totalConversions = getUnifiedConversions();
    const sessions = parseNumSafe(web?.sessions);
    const users = parseNumSafe(web?.users);

    const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
    const roas = unifiedSpend > 0 ? totalRevenue / unifiedSpend : 0;
    const roi = unifiedSpend > 0 ? ((totalRevenue - unifiedSpend) / unifiedSpend) * 100 : 0;
    const cpa = totalConversions > 0 ? unifiedSpend / totalConversions : 0;

    switch (String(key || '')) {
      case 'total-conversions':
        return totalConversions;
      case 'ga4-revenue':
        return onsiteRevenue;
      case 'offsite-revenue':
        return offsiteRevenue;
      case 'total-revenue':
        return totalRevenue;
      case 'ga4-conversions':
        return conversions;
      case 'ga4-conversion-rate':
        return conversionRate;
      case 'total-spend':
        return unifiedSpend;
      case 'roas':
        return roas;
      case 'roi':
        return roi;
      case 'cpa':
        return cpa;
      case 'ga4-users':
        return users;
      case 'ga4-sessions':
        return sessions;
      default:
        return null;
    }
  };

  const isLowerBetterMetric = (metricKey: string) => {
    const m = String(metricKey || '').toLowerCase();
    // Lower-is-better metrics: hitting a smaller value than target is good.
    return m === 'cpa' || m === 'cpl';
  };

  const getKpiCurrentNumber = (kpi: any): number => {
    const cfg = normalizeCalcConfig(kpi?.calculationConfig);
    if (cfg) {
      const computed = computeCurrentFromConfig(cfg);
      if (typeof computed.value === 'number' && Number.isFinite(computed.value)) return computed.value;
    }
    const m = String(kpi?.metric || '');
    const live = getLiveCampaignMetricNumber(m);
    if (typeof live === 'number' && Number.isFinite(live)) return live;
    return parseNumSafe(kpi?.currentValue);
  };

  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/kpis`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/kpis`] });
      setShowCreateDialog(false);
      setKpiCalculationConfig(null);
      setKpiForm({
        name: '',
        description: '',
        metric: '',
        currentValue: '',
        targetValue: '',
        unit: '',
        category: '',
        timeframe: 'Monthly',
        targetDate: '',
        alertEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        alertEmails: '',
      });
      toast({
        title: "Success",
        description: "KPI created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create KPI",
        variant: "destructive",
      });
    },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      await apiRequest('DELETE', `/api/campaigns/${campaign.id}/kpis/${kpiId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/kpis`] });
      toast({
        title: "KPI Deleted",
        description: "The KPI has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete KPI",
        description: error.message || "An error occurred while deleting the KPI.",
        variant: "destructive",
      });
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      const res = await apiRequest('PATCH', `/api/campaigns/${campaign.id}/kpis/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/kpis`] });
      setShowEditDialog(false);
      setEditingKPI(null);
      setKpiCalculationConfig(null);
      setKpiForm({
        name: '',
        description: '',
        metric: '',
        currentValue: '',
        targetValue: '',
        unit: '',
        category: '',
        timeframe: 'Monthly',
        targetDate: '',
        alertEnabled: false,
        alertThreshold: '',
        alertCondition: 'below',
        alertEmails: '',
      });
      toast({
        title: "Success",
        description: "KPI updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update KPI",
        variant: "destructive",
      });
    },
  });

  const handleCreateKPI = () => {
    if (!kpiForm.name || !kpiForm.targetValue) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (Name, Target Value)",
        variant: "destructive",
      });
      return;
    }

    if (isTileMetric(kpiForm.metric)) {
      const cfg = normalizeCalcConfig(kpiCalculationConfig);
      if (!cfg) {
        toast({
          title: "Select Sources",
          description: "Choose which connected sources to use for the Current Value before creating this KPI.",
          variant: "destructive",
        });
        return;
      }

      const metric = String(cfg.metric || '');
      const requiredInputs = getRequiredInputsForMetric(metric);
      const ok = requiredInputs.every((k) => (cfg.inputs?.[k] || []).length > 0);
      if (!ok) {
        toast({
          title: "Select Sources",
          description: "Select the required sources to compute the Current Value for this KPI.",
          variant: "destructive",
        });
        return;
      }
    }

    const computed = isTileMetric(kpiForm.metric) ? computeCurrentFromConfig(kpiCalculationConfig) : { value: null, unit: '' };
    const currentValueNumber = isTileMetric(kpiForm.metric)
      ? (typeof computed.value === 'number' && Number.isFinite(computed.value) ? computed.value : 0)
      : parseFormattedNumber(kpiForm.currentValue);

    createKpiMutation.mutate({
      campaignId: campaign.id,
      platformType: null, // Campaign-level KPI
      ...kpiForm,
      calculationConfig: isTileMetric(kpiForm.metric) ? normalizeCalcConfig(kpiCalculationConfig) : null,
      currentValue: currentValueNumber,
      targetValue: parseFormattedNumber(kpiForm.targetValue),
      alertThreshold: kpiForm.alertEnabled ? parseFormattedNumber(kpiForm.alertThreshold) : null,
      alertEmails: kpiForm.alertEnabled && kpiForm.alertEmails ? kpiForm.alertEmails.split(',').map(e => e.trim()) : null,
    });
  };

  const handleEditKPI = (kpi: any) => {
    setEditingKPI(kpi);
    const cfg = normalizeCalcConfig(kpi?.calculationConfig);
    setKpiCalculationConfig(cfg);
    const computed = cfg ? computeCurrentFromConfig(cfg) : { value: null, unit: '' };
    const live = kpi?.metric ? getLiveCampaignMetric(String(kpi.metric)) : { value: '', unit: '', category: '' };
    setKpiForm({
      name: kpi.name,
      description: kpi.description || '',
      metric: kpi.metric || '',
      currentValue: cfg
        ? (computed.value === null ? '' : formatInputNumber(String(computed.value)))
        : (live.value ? formatInputNumber(live.value) : (kpi.currentValue ? formatInputNumber(kpi.currentValue.toString()) : '')),
      targetValue: kpi.targetValue ? formatInputNumber(kpi.targetValue.toString()) : '',
      unit: live.unit || kpi.unit || '',
      category: live.category || kpi.category || '',
      timeframe: kpi.timeframe || 'Monthly',
      targetDate: kpi.targetDate ? new Date(kpi.targetDate).toISOString().split('T')[0] : '',
      alertEnabled: kpi.emailNotifications || false,
      alertThreshold: kpi.alertThreshold ? formatInputNumber(kpi.alertThreshold.toString()) : '',
      alertCondition: kpi.alertCondition || 'below',
      alertEmails: kpi.emailRecipients || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateKPI = () => {
    if (!editingKPI) {
      toast({
        title: "Error",
        description: "No KPI selected for editing",
        variant: "destructive",
      });
      return;
    }

    if (!kpiForm.name || !kpiForm.targetValue) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (Name, Target Value)",
        variant: "destructive",
      });
      return;
    }

    updateKpiMutation.mutate({
      id: editingKPI.id,
      campaignId: campaign.id,
      platformType: null,
      ...kpiForm,
      calculationConfig: isTileMetric(kpiForm.metric) ? normalizeCalcConfig(kpiCalculationConfig) : null,
      currentValue: isTileMetric(kpiForm.metric)
        ? (typeof computeCurrentFromConfig(kpiCalculationConfig).value === 'number' ? computeCurrentFromConfig(kpiCalculationConfig).value : 0)
        : parseFormattedNumber(kpiForm.currentValue),
      targetValue: parseFormattedNumber(kpiForm.targetValue),
      alertThreshold: kpiForm.alertEnabled ? parseFormattedNumber(kpiForm.alertThreshold) : null,
      emailRecipients: kpiForm.alertEnabled && kpiForm.alertEmails ? kpiForm.alertEmails : null,
      emailNotifications: kpiForm.alertEnabled,
    });
  };

  const handleExportReport = () => {
    if (exportMode === 'download') {
      exportCampaignKPIsToPDF({
        id: campaign.id,
        name: campaign.name,
        kpis: kpis.map((kpi: any) => ({
          id: kpi.id,
          name: kpi.name,
          aggregatedMetric: kpi.metric || 'N/A',
          currentValue: kpi.currentValue?.toString() || '0',
          targetValue: kpi.targetValue?.toString() || '0',
          frequency: kpi.timeframe,
          targetDate: kpi.targetDate,
        })),
        exportDate: new Date(),
      });
      setShowExportDialog(false);
      toast({
        title: "Success",
        description: "KPI report exported successfully",
      });
    } else {
      handleScheduleReport();
    }
  };

  const scheduleReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/kpi-reports`, data);
      return res.json();
    },
    onSuccess: () => {
      setShowExportDialog(false);
      setScheduleForm({ 
        frequency: 'monthly', 
        recipients: '', 
        timeOfDay: '09:00',
        dayOfWeek: 'monday',
        dayOfMonth: '1',
      });
      setExportMode('download');
      toast({
        title: "Success",
        description: "Report scheduled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule report",
        variant: "destructive",
      });
    },
  });

  const handleScheduleReport = () => {
    if (!scheduleForm.recipients) {
      toast({
        title: "Validation Error",
        description: "Please provide at least one email recipient",
        variant: "destructive",
      });
      return;
    }

    // Convert day of week string to number (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeekMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    scheduleReportMutation.mutate({
      name: `${campaign.name} - Scheduled KPI Report`,
      scheduleEnabled: true,
      scheduleFrequency: scheduleForm.frequency,
      scheduleRecipients: scheduleForm.recipients.split(',').map(e => e.trim()),
      scheduleTime: scheduleForm.timeOfDay,
      scheduleDayOfWeek: scheduleForm.frequency === 'weekly' ? dayOfWeekMap[scheduleForm.dayOfWeek] : null,
      scheduleDayOfMonth: (scheduleForm.frequency === 'monthly' || scheduleForm.frequency === 'quarterly') ? parseInt(scheduleForm.dayOfMonth) : null,
    });
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Exceeding':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'On Track':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'At Risk':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Behind':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Low':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      default:
        return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <ArrowLeft className="w-4 h-4 text-red-600 transform rotate-45" />;
      case 'stable':
        return <Target className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Cost Efficiency':
        return <DollarSign className="w-5 h-5 text-red-500" />;
      case 'Revenue':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'Engagement':
        return <MousePointer className="w-5 h-5 text-blue-500" />;
      case 'Performance':
        return <BarChart3 className="w-5 h-5 text-purple-500" />;
      case 'Brand':
        return <Award className="w-5 h-5 text-orange-500" />;
      default:
        return <Target className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign KPIs</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track key performance indicators and monitor campaign success metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-kpi">
            <Plus className="w-4 h-4 mr-2" />
            Create KPI
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {kpis.length === 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total KPIs', value: '0', icon: <Award className="w-8 h-8 text-blue-500" />, desc: '' },
              { label: 'On Track', value: '0', icon: <CheckCircle2 className="w-8 h-8 text-green-500" />, desc: 'meeting or exceeding target', color: 'text-green-600' },
              { label: 'Needs Attention', value: '0', icon: <AlertCircle className="w-8 h-8 text-amber-500" />, desc: 'within 70–90% of target', color: 'text-amber-600' },
              { label: 'Behind', value: '0', icon: <TrendingDown className="w-8 h-8 text-red-500" />, desc: 'below 70% of target', color: 'text-red-600' },
              { label: 'Avg. Progress', value: '0.0%', icon: <TrendingUp className="w-8 h-8 text-purple-500" />, desc: 'across all KPIs' },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color || 'text-slate-900 dark:text-white'}`}>{s.value}</p>
                      {s.desc && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{s.desc}</p>}
                    </div>
                    {s.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* KPI Summary Panel */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-total-kpis">
                      {kpis.length}
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-kpis-above-target">
                      {kpis.filter(k => {
                        const current = getKpiCurrentNumber(k);
                        const target = parseNumSafe(k?.targetValue) || 0;
                        const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                        if (target <= 0) return false;
                        const ratio = lowerBetter ? (current > 0 ? target / current : 0) : (current / target);
                        const pct = ratio * 100;
                        return pct >= 90;
                      }).length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">meeting or exceeding target</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p>
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-kpis-below-target">
                      {kpis.filter(k => {
                        const current = getKpiCurrentNumber(k);
                        const target = parseNumSafe(k?.targetValue) || 0;
                        const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                        if (target <= 0) return false;
                        const ratio = lowerBetter ? (current > 0 ? target / current : 0) : (current / target);
                        const pct = ratio * 100;
                        return pct >= 70 && pct < 90;
                      }).length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">within 70–90% of target</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Behind</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-kpis-behind">
                      {kpis.filter(k => {
                        const current = getKpiCurrentNumber(k);
                        const target = parseNumSafe(k?.targetValue) || 0;
                        const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                        if (target <= 0) return false;
                        const ratio = lowerBetter ? (current > 0 ? target / current : 0) : (current / target);
                        const pct = ratio * 100;
                        return pct < 70;
                      }).length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">below 70% of target</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-avg-progress">
                      {kpis.length > 0
                        ? (
                            kpis.reduce((sum, k) => {
                              const current = getKpiCurrentNumber(k);
                              const target = parseNumSafe(k?.targetValue) || 0;
                              if (!(target > 0)) return sum;
                              const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                              const ratio = lowerBetter ? (current > 0 ? target / current : 0) : (current / target);
                              return sum + (ratio * 100);
                            }, 0) / kpis.length
                          ).toFixed(1)
                        : '0.0'}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">across all KPIs</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPIs Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {kpis.map((kpi) => {
              const current = getKpiCurrentNumber(kpi);
              const target = parseNumSafe(kpi.targetValue) || 0;
              const metricKey = String(kpi?.metric || '');
              const displayUnit = isTileMetric(metricKey) ? getMetricDisplayUnit(metricKey) : String(kpi?.unit || '');
              const lowerBetter = isLowerBetterMetric(metricKey);
              const ratio = target > 0 ? (lowerBetter ? (current > 0 ? target / current : 0) : (current / target)) : 0;
              const progressPercentRaw = Math.max(0, Math.min(ratio * 100, 100));
              const progressPercentLabel = progressPercentRaw.toFixed(1);
              const liveDisplay = formatValueWithUnit(current, displayUnit);
              const sourcesSelectedRaw = formatSourcesSelected(kpi?.calculationConfig);
              const shouldShowSources = isTileMetric(String(kpi?.metric || '')) || Boolean(kpi?.calculationConfig);
              const sourcesSelected = sourcesSelectedRaw || (shouldShowSources ? '—' : '');
              const targetDisplay = formatValueWithUnit(target, displayUnit);
              
              return (
          <Card key={kpi.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {getCategoryIcon(kpi.category)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{kpi.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {kpi.description}
                    </CardDescription>
                    {shouldShowSources && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400" data-testid={`text-kpi-sources-${kpi.id}`}>
                        <span className="font-medium">Sources selected:</span> {sourcesSelected}
                      </div>
                    )}
                    {(kpi.metric || kpi.alertsEnabled || kpi.priority) && (
                      <div className="mt-2 flex items-center flex-wrap gap-2">
                        {kpi.metric && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            data-testid={`badge-metric-${kpi.id}`}
                          >
                            <BarChart3 className="w-3 h-3 mr-1" />
                            {kpi.metric.toUpperCase()}
                          </Badge>
                        )}
                        {kpi.priority && (
                          <Badge variant="outline" className={`text-xs font-normal ${getPriorityColor(kpi.priority)}`}>
                            {kpi.priority}
                          </Badge>
                        )}
                        {kpi.alertsEnabled && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            {(() => {
                              const threshold = parseNumSafe(kpi.alertThreshold);
                              const condition = kpi.alertCondition || 'below';
                              if (threshold > 0) {
                                const breached = condition === 'below' ? current < threshold : condition === 'above' ? current > threshold : current === threshold;
                                if (breached) return <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>;
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditKPI(kpi)}
                    data-testid={`button-edit-kpi-${kpi.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-kpi-${kpi.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{kpi.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteKpiMutation.mutate(kpi.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current vs Target Values */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {liveDisplay}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Target</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {targetDisplay}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                  <span className="font-medium">{progressPercentLabel}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      progressPercentRaw >= 100 ? 'bg-green-600' :
                      progressPercentRaw >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${progressPercentRaw}%` }}
                  />
                </div>
                {target > 0 && (() => {
                  const deltaPct = lowerBetter
                    ? ((target - current) / target) * 100
                    : ((current - target) / target) * 100;
                  if (Math.abs(deltaPct) < 1) return <p className="text-xs text-green-600 font-medium">At target</p>;
                  return deltaPct > 0
                    ? <p className="text-xs text-green-600 font-medium">{deltaPct.toFixed(1)}% above target</p>
                    : <p className="text-xs text-red-600 font-medium">{Math.abs(deltaPct).toFixed(1)}% below target</p>;
                })()}
              </div>
            </CardContent>
          </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Create KPI Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          // Reset form when closing the dialog
          setKpiCalculationConfig(null);
          setKpiForm({
            name: '',
            description: '',
            metric: '',
            currentValue: '',
            targetValue: '',
            unit: '',
            category: '',
            timeframe: 'Monthly',
            targetDate: '',
            alertEnabled: false,
            alertThreshold: '',
            alertCondition: 'below',
            alertEmails: '',
          });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign KPI</DialogTitle>
            <DialogDescription>
              Pick a KPI, choose which connected sources to use for the Current Value, then set a target.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* KPI Template Selection (tiles) */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Choose a KPI</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No defaults: you control which connected sources are used to calculate Current Value.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "ROAS", metric: "roas", category: "Performance", description: "Revenue ÷ Spend" },
                  { name: "ROI", metric: "roi", category: "Performance", description: "(Revenue − Spend) ÷ Spend × 100" },
                  { name: "CPA", metric: "cpa", category: "Cost Efficiency", description: "Spend ÷ Conversions" },
                  { name: "Revenue", metric: "revenue", category: "Revenue", description: "Total revenue (selected sources)" },
                  { name: "Conversions", metric: "conversions", category: "Performance", description: "Total conversions (selected sources)" },
                  { name: "Users", metric: "users", category: "Engagement", description: "Total users (selected sources)" },
                  { name: "Spend", metric: "spend", category: "Cost Efficiency", description: "Total spend (selected sources)" },
                  { name: "CTR", metric: "ctr", category: "Performance", description: "Clicks ÷ Impressions × 100" },
                  { name: "Conversion Rate (website)", metric: "conversion-rate-website", category: "Performance", description: "Conversions ÷ Sessions × 100" },
                  { name: "Conversion Rate (click-based)", metric: "conversion-rate-click", category: "Performance", description: "Conversions ÷ Clicks × 100" },
                ].map((template) => {
                  const reason = getTileDisabledReason(template.metric);
                  const disabled = Boolean(reason);
                  const isSelected = String(kpiForm.metric || '') === String(template.metric);

                  return (
                    <div
                      key={template.metric}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      } ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}
                      onClick={() => {
                        if (disabled) return;
                        setKpiCalculationConfig({
                          metric: template.metric,
                          inputs: {},
                        });
                        setKpiForm((prev) => ({
                          ...prev,
                          name: template.name,
                          metric: template.metric,
                          currentValue: '',
                          unit: getMetricDisplayUnit(template.metric),
                          category: template.category,
                        }));
                      }}
                      data-testid={`campaign-kpi-template-${template.metric}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-slate-900 dark:text-white">{template.name}</div>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {disabled ? reason : template.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source selection (no defaults) */}
            {isTileMetric(kpiForm.metric) && (
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">Sources used for Current Value</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Select the sources you want included. Current Value will update once required inputs are selected.
                    </div>
                  </div>
                </div>

                {/* Required inputs */}
                {(() => {
                  const cfg = normalizeCalcConfig(kpiCalculationConfig);
                  const metric = String(kpiForm.metric || '');
                  const required = getRequiredInputsForMetric(metric);
                  const requiredWithDenom = required;

                  const computed = computeCurrentFromConfig(kpiCalculationConfig);
                  const preview = computed.value === null ? '—' : formatNumber(computed.value);

                  const toggle = (inputKey: CalcInputKey, sourceId: string) => {
                    setKpiCalculationConfig((prev: any) => {
                      const next = normalizeCalcConfig(prev) || { metric: metric, inputs: {} };
                      const current = Array.isArray(next.inputs?.[inputKey]) ? (next.inputs as any)[inputKey] : [];
                      const exists = current.includes(sourceId);
                      const updated = exists ? current.filter((x: string) => x !== sourceId) : [...current, sourceId];
                      return {
                        ...next,
                        metric,
                        inputs: {
                          ...(next.inputs || {}),
                          [inputKey]: updated,
                        },
                      };
                    });
                  };

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="text-xs text-slate-600 dark:text-slate-400">Current Value (preview)</div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white">{preview}</div>
                        </div>
                        <div className="text-xs text-slate-500 self-end">
                          Required inputs must be selected before you can create this KPI.
                        </div>
                      </div>

                      {requiredWithDenom.map((inputKey: any) => {
                        const key = inputKey as CalcInputKey;
                        const options = getInputOptions(key);
                        return (
                          <div key={key} className="space-y-2">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {key === 'revenue'
                                ? 'Revenue sources'
                                : key === 'spend'
                                ? 'Spend sources'
                                : key === 'conversions'
                                ? 'Conversion sources'
                                : key === 'sessions'
                                ? 'Session sources'
                                : key === 'users'
                                ? 'User sources'
                                : key === 'clicks'
                                ? 'Click sources'
                                : key === 'impressions'
                                ? 'Impression sources'
                                : 'Lead sources'}{' '}
                              <span className="text-red-500">*</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {options.map((opt) => {
                                const cfg2 = normalizeCalcConfig(kpiCalculationConfig) as any;
                                const selected = (cfg2?.inputs?.[key] || []).includes(opt.id);
                                const isDisabled = !opt.enabled;
                                return (
                                  <label
                                    key={opt.id}
                                    className={`flex items-start gap-2 p-2 border rounded-md ${
                                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={() => {
                                        if (isDisabled) return;
                                        toggle(key, opt.id);
                                      }}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-slate-900 dark:text-white">{opt.label}</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">
                                        {isDisabled ? opt.reason || 'Not available' : (opt.value !== undefined ? `Value: ${formatNumber(opt.value)}` : 'Available')}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-name">KPI Name *</Label>
                <Input
                  id="kpi-name"
                  placeholder="e.g., Overall Campaign CTR"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  data-testid="input-campaign-kpi-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-metric">Aggregated Metric</Label>
                <Select
                  value={kpiForm.metric || ''}
                  onValueChange={(value) => {
                    setKpiCalculationConfig(isTileMetric(value) ? { metric: value, inputs: {} } : null);
                    const unit = isTileMetric(value) ? getMetricDisplayUnit(value) : '';
                    setKpiForm({ ...kpiForm, name: getMetricDisplayName(value), metric: value, currentValue: '', unit });
                  }}
                >
                  <SelectTrigger id="kpi-metric" data-testid="select-campaign-kpi-metric">
                    <SelectValue placeholder="Select metric or enter custom" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {/* Aggregated Campaign Metrics - Always visible */}
                    <SelectGroup>
                      <SelectLabel>📊 Campaign KPIs</SelectLabel>
                      <SelectItem value="roas">ROAS</SelectItem>
                      <SelectItem value="roi">ROI</SelectItem>
                      <SelectItem value="cpa">CPA</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="conversions">Conversions</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="spend">Spend</SelectItem>
                      <SelectItem value="ctr">CTR</SelectItem>
                      <SelectItem value="conversion-rate-website">Conversion Rate (website)</SelectItem>
                      <SelectItem value="conversion-rate-click">Conversion Rate (click-based)</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    
                    <SelectGroup>
                      <SelectLabel>✏️ Manual Entry</SelectLabel>
                      <SelectItem value="custom">Custom Value</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-description">Description</Label>
              <Textarea
                id="kpi-description"
                placeholder="Describe what this KPI measures and why it's important"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                rows={3}
                data-testid="input-campaign-kpi-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-current">Current Value</Label>
                <Input
                  id="kpi-current"
                  type="text"
                  placeholder="0"
                  value={kpiForm.currentValue}
                  onChange={(e) => {
                    // For tile KPIs, Current Value is computed from selected sources (no manual overrides here)
                    if (isTileMetric(kpiForm.metric)) return;
                    setKpiForm({ ...kpiForm, currentValue: formatInputNumber(e.target.value) });
                  }}
                  readOnly={isTileMetric(kpiForm.metric)}
                  data-testid="input-campaign-kpi-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target Value *</Label>
                <Input
                  id="kpi-target"
                  type="text"
                  placeholder="0"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: formatInputNumber(e.target.value) })}
                  data-testid="input-campaign-kpi-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-unit">Unit</Label>
                <Input
                  id="kpi-unit"
                  placeholder="%, $, etc."
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  data-testid="input-campaign-kpi-unit"
                />
              </div>
            </div>

            {/* Email Alerts Section */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="alert-enabled"
                  checked={kpiForm.alertEnabled}
                  onChange={(e) => setKpiForm({ ...kpiForm, alertEnabled: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-campaign-kpi-alert-enabled"
                />
                <Label htmlFor="alert-enabled" className="font-medium">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.alertEnabled && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Threshold</Label>
                    <Input
                      id="alert-threshold"
                      type="text"
                      placeholder="e.g., 50"
                      value={kpiForm.alertThreshold}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertThreshold: formatInputNumber(e.target.value) })}
                      data-testid="input-campaign-kpi-alert-threshold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-condition">Condition</Label>
                    <Select
                      value={kpiForm.alertCondition}
                      onValueChange={(value: 'below' | 'above' | 'equals') => 
                        setKpiForm({ ...kpiForm, alertCondition: value })
                      }
                    >
                      <SelectTrigger id="alert-condition" data-testid="select-campaign-kpi-alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-3">
                    <Label htmlFor="alert-emails">Email Recipients (comma-separated)</Label>
                    <Input
                      id="alert-emails"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={kpiForm.alertEmails}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertEmails: e.target.value })}
                      data-testid="input-campaign-kpi-alert-emails"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-campaign-kpi-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateKPI} 
              disabled={
                createKpiMutation.isPending ||
                !kpiForm.name ||
                !kpiForm.targetValue ||
                !isConfigCompleteForMetric(String(kpiForm.metric || ''), kpiCalculationConfig)
              }
              data-testid="button-campaign-kpi-create"
            >
              {createKpiMutation.isPending ? 'Creating...' : 'Create KPI'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit KPI Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setEditingKPI(null);
          setKpiCalculationConfig(null);
          setKpiForm({
            name: '',
            description: '',
            metric: '',
            currentValue: '',
            targetValue: '',
            unit: '',
            category: '',
            timeframe: 'Monthly',
            targetDate: '',
            alertEnabled: false,
            alertThreshold: '',
            alertCondition: 'below',
            alertEmails: '',
          });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign KPI</DialogTitle>
            <DialogDescription>
              Update the KPI settings and targets for this campaign metric.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-name">KPI Name *</Label>
              <Input
                id="edit-kpi-name"
                placeholder="e.g., Overall Campaign CTR"
                value={kpiForm.name}
                onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                data-testid="input-edit-campaign-kpi-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-kpi-metric">Aggregated Metric</Label>
              <Select
                value={kpiForm.metric}
                onValueChange={(value) => {
                  setKpiCalculationConfig(isTileMetric(value) ? { metric: value, inputs: {} } : null);
                  const unit = isTileMetric(value) ? getMetricDisplayUnit(value) : '';
                  setKpiForm({ ...kpiForm, name: getMetricDisplayName(value), metric: value, currentValue: '', unit });
                }}
              >
                <SelectTrigger id="edit-kpi-metric" data-testid="select-edit-campaign-kpi-metric">
                  <SelectValue placeholder="Select metric or enter custom" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectGroup>
                    <SelectLabel>📊 Campaign KPIs</SelectLabel>
                    <SelectItem value="roas">ROAS</SelectItem>
                    <SelectItem value="roi">ROI</SelectItem>
                    <SelectItem value="cpa">CPA</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="conversions">Conversions</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="spend">Spend</SelectItem>
                    <SelectItem value="ctr">CTR</SelectItem>
                    <SelectItem value="conversion-rate-website">Conversion Rate (website)</SelectItem>
                    <SelectItem value="conversion-rate-click">Conversion Rate (click-based)</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  
                  <SelectGroup>
                    <SelectLabel>✏️ Manual Entry</SelectLabel>
                    <SelectItem value="custom">Custom Value</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Source selection (no defaults) */}
            {isTileMetric(kpiForm.metric) && (
              <div className="space-y-3 p-4 border rounded-lg">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Sources used for Current Value</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Update the sources included in this KPI. Current Value will update when required inputs are selected.
                  </div>
                </div>

                {(() => {
                  const cfg = normalizeCalcConfig(kpiCalculationConfig);
                  const metric = String(kpiForm.metric || '');
                  const required = getRequiredInputsForMetric(metric);
                  const requiredWithDenom = required;

                  const toggle = (inputKey: CalcInputKey, sourceId: string) => {
                    setKpiCalculationConfig((prev: any) => {
                      const next = normalizeCalcConfig(prev) || { metric: metric, inputs: {} };
                      const current = Array.isArray(next.inputs?.[inputKey]) ? (next.inputs as any)[inputKey] : [];
                      const exists = current.includes(sourceId);
                      const updated = exists ? current.filter((x: string) => x !== sourceId) : [...current, sourceId];
                      return {
                        ...next,
                        metric,
                        inputs: {
                          ...(next.inputs || {}),
                          [inputKey]: updated,
                        },
                      };
                    });
                  };

                  return (
                    <div className="space-y-4">
                      {requiredWithDenom.map((inputKey: any) => {
                        const key = inputKey as CalcInputKey;
                        const options = getInputOptions(key);
                        return (
                          <div key={key} className="space-y-2">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {key === 'revenue'
                                ? 'Revenue sources'
                                : key === 'spend'
                                ? 'Spend sources'
                                : key === 'conversions'
                                ? 'Conversion sources'
                                : key === 'sessions'
                                ? 'Session sources'
                                : key === 'users'
                                ? 'User sources'
                                : key === 'clicks'
                                ? 'Click sources'
                                : key === 'impressions'
                                ? 'Impression sources'
                                : 'Lead sources'}{' '}
                              <span className="text-red-500">*</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {options.map((opt) => {
                                const cfg2 = normalizeCalcConfig(kpiCalculationConfig) as any;
                                const selected = (cfg2?.inputs?.[key] || []).includes(opt.id);
                                const isDisabled = !opt.enabled;
                                return (
                                  <label
                                    key={opt.id}
                                    className={`flex items-start gap-2 p-2 border rounded-md ${
                                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={() => {
                                        if (isDisabled) return;
                                        toggle(key, opt.id);
                                      }}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-slate-900 dark:text-white">{opt.label}</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400">
                                        {isDisabled ? opt.reason || 'Not available' : (opt.value !== undefined ? `Value: ${formatNumber(opt.value)}` : 'Available')}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-kpi-description">Description</Label>
              <Textarea
                id="edit-kpi-description"
                placeholder="Describe what this KPI measures and why it's important"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                rows={3}
                data-testid="input-edit-campaign-kpi-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-kpi-current">Current Value</Label>
                <Input
                  id="edit-kpi-current"
                  type="text"
                  placeholder="0"
                  value={kpiForm.currentValue}
                  onChange={(e) => {
                    if (isTileMetric(kpiForm.metric)) return;
                    setKpiForm({ ...kpiForm, currentValue: formatInputNumber(e.target.value) });
                  }}
                  readOnly={isTileMetric(kpiForm.metric)}
                  data-testid="input-edit-campaign-kpi-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kpi-target">Target Value *</Label>
                <Input
                  id="edit-kpi-target"
                  type="text"
                  placeholder="0"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: formatInputNumber(e.target.value) })}
                  data-testid="input-edit-campaign-kpi-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kpi-unit">Unit</Label>
                <Input
                  id="edit-kpi-unit"
                  placeholder="%, $, etc."
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  data-testid="input-edit-campaign-kpi-unit"
                />
              </div>
            </div>

            {/* Email Alerts Section */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-alert-enabled"
                  checked={kpiForm.alertEnabled}
                  onChange={(e) => setKpiForm({ ...kpiForm, alertEnabled: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-edit-campaign-kpi-alert-enabled"
                />
                <Label htmlFor="edit-alert-enabled" className="font-medium">
                  Enable Email Alerts
                </Label>
              </div>

              {kpiForm.alertEnabled && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-alert-threshold">Alert Threshold</Label>
                    <Input
                      id="edit-alert-threshold"
                      type="text"
                      placeholder="e.g., 50"
                      value={kpiForm.alertThreshold}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertThreshold: formatInputNumber(e.target.value) })}
                      data-testid="input-edit-campaign-kpi-alert-threshold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-alert-condition">Condition</Label>
                    <Select
                      value={kpiForm.alertCondition}
                      onValueChange={(value: 'below' | 'above' | 'equals') => 
                        setKpiForm({ ...kpiForm, alertCondition: value })
                      }
                    >
                      <SelectTrigger id="edit-alert-condition" data-testid="select-edit-campaign-kpi-alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-3">
                    <Label htmlFor="edit-alert-emails">Email Recipients (comma-separated)</Label>
                    <Input
                      id="edit-alert-emails"
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={kpiForm.alertEmails}
                      onChange={(e) => setKpiForm({ ...kpiForm, alertEmails: e.target.value })}
                      data-testid="input-edit-campaign-kpi-alert-emails"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-edit-campaign-kpi-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateKPI} 
              disabled={
                updateKpiMutation.isPending ||
                !kpiForm.name ||
                !kpiForm.targetValue ||
                !isConfigCompleteForMetric(String(kpiForm.metric || ''), kpiCalculationConfig)
              }
              data-testid="button-edit-campaign-kpi-save"
            >
              {updateKpiMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export KPIs Report Dialog */}
      <Dialog open={showExportDialog} onOpenChange={(open) => {
        setShowExportDialog(open);
        if (!open) {
          setExportMode('download');
          setScheduleForm({ 
            frequency: 'monthly', 
            recipients: '', 
            timeOfDay: '09:00',
            dayOfWeek: 'monday',
            dayOfMonth: '1',
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export KPIs Report</DialogTitle>
            <DialogDescription>
              Generate and download your KPI report or schedule automated email delivery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Export Mode Selection */}
            <div className="space-y-3">
              <Label>Report Action</Label>
              <div className="space-y-2">
                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    exportMode === 'download' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setExportMode('download')}
                  data-testid="option-download-report"
                >
                  <Checkbox 
                    checked={exportMode === 'download'}
                    onCheckedChange={() => setExportMode('download')}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Download className="w-4 h-4" />
                      <span className="font-medium">Download Report Now</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Generate and download PDF report immediately
                    </p>
                  </div>
                </div>

                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    exportMode === 'schedule' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setExportMode('schedule')}
                  data-testid="option-schedule-report"
                >
                  <Checkbox 
                    checked={exportMode === 'schedule'}
                    onCheckedChange={() => setExportMode('schedule')}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">Schedule Automated Reports</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Set up recurring email delivery
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Options (only shown when schedule mode is selected) */}
            {exportMode === 'schedule' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schedule-frequency">Frequency</Label>
                  <Select 
                    value={scheduleForm.frequency}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, frequency: value })}
                  >
                    <SelectTrigger id="schedule-frequency" data-testid="select-schedule-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Time of Day</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduleForm.timeOfDay}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, timeOfDay: e.target.value })}
                      data-testid="input-schedule-time"
                    />
                  </div>

                  {scheduleForm.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label htmlFor="schedule-day-week">Day of Week</Label>
                      <Select 
                        value={scheduleForm.dayOfWeek}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, dayOfWeek: value })}
                      >
                        <SelectTrigger id="schedule-day-week" data-testid="select-schedule-day-week">
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

                  {(scheduleForm.frequency === 'monthly' || scheduleForm.frequency === 'quarterly') && (
                    <div className="space-y-2">
                      <Label htmlFor="schedule-day-month">Day of Month</Label>
                      <Select 
                        value={scheduleForm.dayOfMonth}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, dayOfMonth: value })}
                      >
                        <SelectTrigger id="schedule-day-month" data-testid="select-schedule-day-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-recipients">Email Recipients</Label>
                  <Input
                    id="schedule-recipients"
                    type="text"
                    placeholder="email1@example.com, email2@example.com"
                    value={scheduleForm.recipients}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                    data-testid="input-schedule-recipients"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Separate multiple emails with commas
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowExportDialog(false)}
              data-testid="button-export-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExportReport}
              disabled={scheduleReportMutation.isPending}
              data-testid="button-export-confirm"
            >
              {exportMode === 'download' 
                ? 'Download Report' 
                : scheduleReportMutation.isPending 
                  ? 'Scheduling...' 
                  : 'Schedule Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Campaign Benchmarks Component
function CampaignBenchmarks({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  
  // Fetch campaign-level benchmarks
  const { data: benchmarks = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/benchmarks`],
    enabled: !!campaign.id,
  });

  // Use the same normalized campaign totals as the Campaign KPIs tab so numbers never disagree.
  const { data: outcomeTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/outcome-totals`, "30days"],
    enabled: !!campaign.id,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaign.id}/outcome-totals?dateRange=30days`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'download' | 'schedule'>('download');
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [selectedBenchmarkTemplate, setSelectedBenchmarkTemplate] = useState<any>(null);
  const [benchmarkCalculationConfig, setBenchmarkCalculationConfig] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'monthly',
    recipients: '',
    timeOfDay: '09:00',
    dayOfWeek: 'monday',
    dayOfMonth: '1',
  });
  const [benchmarkForm, setBenchmarkForm] = useState({
    metric: '',
    name: '',
    category: 'performance',
    unit: '',
    benchmarkValue: '',
    currentValue: '',
    benchmarkType: 'industry' as 'industry' | 'custom',
    industry: '',
    description: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below' as 'below' | 'above' | 'equals',
    emailRecipients: ''
  });

  const parseNumSafe = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  type BenchCalcInputKey = 'revenue' | 'spend' | 'conversions' | 'sessions' | 'users' | 'clicks' | 'impressions';
  type BenchCalcConfig = {
    metric: string;
    inputs: Partial<Record<BenchCalcInputKey, string[]>>;
  };

  const normalizeBenchCalcConfig = (raw: any): BenchCalcConfig | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw as BenchCalcConfig;
  };

  const getConnectedPlatformFlags = () => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const revenueSources = ot?.revenueSources || [];
    return {
      ga4: Boolean(ot?.ga4?.connected),
      customIntegration: Boolean(platforms?.customIntegration?.connected),
      linkedin: Boolean(platforms?.linkedin?.connected),
      meta: Boolean(platforms?.meta?.connected),
      shopify: Boolean((revenueSources || []).some((s: any) => s?.type === 'shopify' && s?.connected)),
      hubspot: Boolean((revenueSources || []).some((s: any) => s?.type === 'hubspot' && s?.connected)),
      salesforce: Boolean((revenueSources || []).some((s: any) => s?.type === 'salesforce' && s?.connected)),
    };
  };

  const getRevenueSourceValue = (sourceId: string): number => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const revenueSources = ot?.revenueSources || [];
    if (sourceId === 'ga4') return parseNumSafe(ot?.ga4?.revenue);
    if (sourceId === 'custom_integration') return parseNumSafe(platforms?.customIntegration?.revenue);
    if (sourceId === 'linkedin') return parseNumSafe(platforms?.linkedin?.attributedRevenue);
    const found = (revenueSources || []).find((s: any) => String(s?.type || '') === sourceId);
    if (found) return parseNumSafe(found?.lastTotalRevenue);
    return 0;
  };

  const getMetricSourceValue = (inputKey: BenchCalcInputKey, sourceId: string): number => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const spend = ot?.spend || {};

    if (inputKey === 'revenue') return getRevenueSourceValue(sourceId);
    if (inputKey === 'spend') {
      if (sourceId === 'imported_spend') return parseNumSafe(spend?.persistedSpend);
      if (sourceId === 'linkedin') return parseNumSafe(platforms?.linkedin?.spend);
      if (sourceId === 'meta') return parseNumSafe(platforms?.meta?.spend);
      if (sourceId === 'custom_integration') return parseNumSafe(platforms?.customIntegration?.spend);
      return 0;
    }

    if (sourceId === 'ga4') {
      if (inputKey === 'conversions') return parseNumSafe(ot?.ga4?.conversions);
      if (inputKey === 'sessions') return parseNumSafe(ot?.ga4?.sessions);
      if (inputKey === 'users') return parseNumSafe(ot?.ga4?.users);
      return 0;
    }

    if (sourceId === 'custom_integration') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.customIntegration?.conversions);
      if (inputKey === 'sessions') return parseNumSafe(platforms?.customIntegration?.sessions);
      if (inputKey === 'users') return parseNumSafe(platforms?.customIntegration?.users);
      if (inputKey === 'clicks') return parseNumSafe(platforms?.customIntegration?.clicks);
      if (inputKey === 'impressions') return parseNumSafe(platforms?.customIntegration?.impressions);
      return 0;
    }

    if (sourceId === 'linkedin') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.linkedin?.conversions);
      if (inputKey === 'clicks') return parseNumSafe(platforms?.linkedin?.clicks);
      if (inputKey === 'impressions') return parseNumSafe(platforms?.linkedin?.impressions);
      return 0;
    }

    if (sourceId === 'meta') {
      if (inputKey === 'conversions') return parseNumSafe(platforms?.meta?.conversions);
      if (inputKey === 'clicks') return parseNumSafe(platforms?.meta?.clicks);
      if (inputKey === 'impressions') return parseNumSafe(platforms?.meta?.impressions);
      return 0;
    }

    return 0;
  };

  const sumSelected = (inputKey: BenchCalcInputKey, sourceIds: string[] = []) => {
    return (sourceIds || []).reduce((sum, id) => sum + getMetricSourceValue(inputKey, id), 0);
  };

  const computeCurrentFromBenchConfig = (rawConfig: any): { value: number | null; unit: string } => {
    const cfg = normalizeBenchCalcConfig(rawConfig);
    if (!cfg || !cfg.metric) return { value: null, unit: '' };
    const metric = String(cfg.metric);

    if (metric === 'revenue') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      return { value: revenue, unit: '$' };
    }
    if (metric === 'spend') {
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      return { value: spend, unit: '$' };
    }
    if (metric === 'conversions') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      return { value: conv, unit: 'count' };
    }
    if (metric === 'users') {
      const users = sumSelected('users', cfg.inputs?.users || []);
      return { value: users, unit: 'count' };
    }
    if (metric === 'ctr') {
      const clicks = sumSelected('clicks', cfg.inputs?.clicks || []);
      const impressions = sumSelected('impressions', cfg.inputs?.impressions || []);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return { value: ctr, unit: '%' };
    }
    if (metric === 'conversion-rate-website') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const sessions = sumSelected('sessions', cfg.inputs?.sessions || []);
      const rate = sessions > 0 ? (conv / sessions) * 100 : 0;
      return { value: rate, unit: '%' };
    }
    if (metric === 'conversion-rate-click') {
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const clicks = sumSelected('clicks', cfg.inputs?.clicks || []);
      const rate = clicks > 0 ? (conv / clicks) * 100 : 0;
      return { value: rate, unit: '%' };
    }
    if (metric === 'roas') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const roasPct = spend > 0 ? (revenue / spend) * 100 : 0;
      return { value: roasPct, unit: '%' };
    }
    if (metric === 'roi') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      return { value: roi, unit: '%' };
    }
    if (metric === 'cpa') {
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
      const cpa = conv > 0 ? spend / conv : 0;
      return { value: cpa, unit: '$' };
    }
    return { value: null, unit: '' };
  };

  const getBenchInputOptions = (inputKey: BenchCalcInputKey) => {
    const connected = getConnectedPlatformFlags();
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const spend = ot?.spend || {};

    const base: Array<{ id: string; label: string; enabled: boolean; reason?: string; value?: number }> = [];

    // Helper to include a connected platform in the list (enabled/disabled) so the user
    // always sees all connected sources, even when not applicable for the selected input.
    const pushConnected = (id: string, label: string, enabled: boolean, value?: number, reason?: string) => {
      base.push({ id, label, enabled, value, reason });
    };

    if (inputKey === 'revenue') {
      if (connected.ga4) base.push({ id: 'ga4', label: 'GA4', enabled: true, value: getRevenueSourceValue('ga4') });
      if (connected.customIntegration) base.push({ id: 'custom_integration', label: 'Custom Integration', enabled: true, value: getRevenueSourceValue('custom_integration') });
      if (connected.shopify) base.push({ id: 'shopify', label: 'Shopify', enabled: true, value: getRevenueSourceValue('shopify') });
      if (connected.hubspot) base.push({ id: 'hubspot', label: 'HubSpot', enabled: true, value: getRevenueSourceValue('hubspot') });
      if (connected.salesforce) base.push({ id: 'salesforce', label: 'Salesforce', enabled: true, value: getRevenueSourceValue('salesforce') });
      if (connected.linkedin) {
        const has = platforms?.linkedin?.attributedRevenue !== undefined && platforms?.linkedin?.attributedRevenue !== null;
        const v = getRevenueSourceValue('linkedin');
        base.push({
          id: 'linkedin',
          label: 'LinkedIn',
          enabled: Boolean(has && v > 0),
          reason: 'Revenue not connected for this platform',
          value: v,
        });
      }
      if (connected.meta) {
        base.push({ id: 'meta', label: 'Meta', enabled: false, reason: 'Revenue not connected for this platform' });
      }
      return base;
    }

    if (inputKey === 'spend') {
      const imported = parseNumSafe(spend?.persistedSpend) > 0;
      base.push({
        id: 'imported_spend',
        label: 'Imported Spend',
        enabled: imported,
        reason: imported ? undefined : 'No imported spend connected',
        value: parseNumSafe(spend?.persistedSpend),
      });
      if (connected.ga4) pushConnected('ga4', 'GA4', false, undefined, 'Spend is not a GA4 metric');
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', true, parseNumSafe(platforms?.linkedin?.spend));
      if (connected.meta) pushConnected('meta', 'Meta', true, parseNumSafe(platforms?.meta?.spend));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.spend));
      return base;
    }

    if (inputKey === 'conversions') {
      if (connected.ga4) pushConnected('ga4', 'GA4', true, parseNumSafe(ot?.ga4?.conversions));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.conversions));
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', true, parseNumSafe(platforms?.linkedin?.conversions));
      if (connected.meta) pushConnected('meta', 'Meta', true, parseNumSafe(platforms?.meta?.conversions));
      return base;
    }

    if (inputKey === 'sessions') {
      if (connected.ga4) pushConnected('ga4', 'GA4', true, parseNumSafe(ot?.ga4?.sessions));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.sessions));
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', false, undefined, 'Sessions is a web analytics metric');
      if (connected.meta) pushConnected('meta', 'Meta', false, undefined, 'Sessions is a web analytics metric');
      return base;
    }

    if (inputKey === 'users') {
      if (connected.ga4) pushConnected('ga4', 'GA4', true, parseNumSafe(ot?.ga4?.users));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.users));
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', false, undefined, 'Users is a web analytics metric');
      if (connected.meta) pushConnected('meta', 'Meta', false, undefined, 'Users is a web analytics metric');
      return base;
    }

    if (inputKey === 'clicks') {
      if (connected.ga4) pushConnected('ga4', 'GA4', false, undefined, 'Clicks is an ad-platform metric');
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', true, parseNumSafe(platforms?.linkedin?.clicks));
      if (connected.meta) pushConnected('meta', 'Meta', true, parseNumSafe(platforms?.meta?.clicks));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.clicks));
      return base;
    }

    if (inputKey === 'impressions') {
      if (connected.ga4) pushConnected('ga4', 'GA4', false, undefined, 'Impressions is an ad-platform metric');
      if (connected.linkedin) pushConnected('linkedin', 'LinkedIn', true, parseNumSafe(platforms?.linkedin?.impressions));
      if (connected.meta) pushConnected('meta', 'Meta', true, parseNumSafe(platforms?.meta?.impressions));
      if (connected.customIntegration) pushConnected('custom_integration', 'Custom Integration', true, parseNumSafe(platforms?.customIntegration?.impressions));
      return base;
    }

    return base;
  };

  const toggleBenchSource = (inputKey: BenchCalcInputKey, sourceId: string, checked: boolean) => {
    setBenchmarkCalculationConfig((prevRaw: any) => {
      const prev = normalizeBenchCalcConfig(prevRaw) || { metric: String(benchmarkForm.metric || ''), inputs: {} };
      const nextInputs = { ...(prev.inputs || {}) } as any;
      const cur = Array.isArray(nextInputs[inputKey]) ? [...nextInputs[inputKey]] : [];
      const idx = cur.indexOf(sourceId);
      if (checked && idx === -1) cur.push(sourceId);
      if (!checked && idx !== -1) cur.splice(idx, 1);
      nextInputs[inputKey] = cur;
      return { ...prev, metric: String(benchmarkForm.metric || ''), inputs: nextInputs };
    });
  };

  const isLowerBetterBenchmarkMetric = (metricKey: string) => {
    const m = String(metricKey || '').toLowerCase();
    return m === 'cpa';
  };

  const getUnifiedConversions = (): number => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const platforms = ot?.platforms || {};
    const webConnected = Boolean(web?.connected);
    const webConv = parseNumSafe(web?.conversions);
    if (webConnected) return webConv;
    return (
      parseNumSafe(platforms?.linkedin?.conversions) +
      parseNumSafe(platforms?.meta?.conversions) +
      parseNumSafe(platforms?.customIntegration?.conversions)
    );
  };

  const getAdClicksImpressions = () => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    const clicks =
      parseNumSafe(platforms?.linkedin?.clicks) +
      parseNumSafe(platforms?.meta?.clicks) +
      parseNumSafe(platforms?.customIntegration?.clicks);
    const impressions =
      parseNumSafe(platforms?.linkedin?.impressions) +
      parseNumSafe(platforms?.meta?.impressions) +
      parseNumSafe(platforms?.customIntegration?.impressions);
    return { clicks, impressions };
  };

  const getAdConversions = () => {
    const ot = outcomeTotals || {};
    const platforms = ot?.platforms || {};
    return (
      parseNumSafe(platforms?.linkedin?.conversions) +
      parseNumSafe(platforms?.meta?.conversions) +
      parseNumSafe(platforms?.customIntegration?.conversions)
    );
  };

  type CampaignBenchmarkTemplate = {
    name: string;
    metric: string;
    unit: string;
    description: string;
    category: string;
    industryMetric: string;
    requires?: Array<'spend' | 'revenue' | 'conversions' | 'sessions' | 'clicks' | 'impressions' | 'users'>;
    lowerIsBetter?: boolean;
  };

  const CAMPAIGN_BENCHMARK_TEMPLATES: CampaignBenchmarkTemplate[] = useMemo(
    () => [
      { name: 'Revenue', metric: 'revenue', unit: '$', description: 'Total revenue for the selected period', category: 'Revenue', industryMetric: 'revenue', requires: ['revenue'] },
      { name: 'ROAS', metric: 'roas', unit: '%', description: 'Revenue ÷ Spend × 100', category: 'Performance', industryMetric: 'roas', requires: ['revenue', 'spend'] },
      { name: 'ROI', metric: 'roi', unit: '%', description: '(Revenue − Spend) ÷ Spend × 100', category: 'Performance', industryMetric: 'roi', requires: ['revenue', 'spend'] },
      { name: 'Spend', metric: 'spend', unit: '$', description: 'Total marketing spend for the selected period', category: 'Cost', industryMetric: 'spend', requires: ['spend'] },
      { name: 'Conversions', metric: 'conversions', unit: 'count', description: 'Total conversions for the selected period', category: 'Performance', industryMetric: 'conversions', requires: ['conversions'] },
      { name: 'CPA', metric: 'cpa', unit: '$', description: 'Spend ÷ Conversions', category: 'Cost Efficiency', industryMetric: 'cpa', requires: ['spend', 'conversions'], lowerIsBetter: true },
      { name: 'Users', metric: 'users', unit: 'count', description: 'Total users for the selected period', category: 'Audience', industryMetric: 'users', requires: ['users'] },
      { name: 'CTR', metric: 'ctr', unit: '%', description: 'Clicks ÷ Impressions × 100', category: 'Performance', industryMetric: 'ctr', requires: ['clicks', 'impressions'] },
      { name: 'Conversion Rate (website)', metric: 'conversion-rate-website', unit: '%', description: 'Conversions ÷ Sessions × 100', category: 'Performance', industryMetric: 'conversionRate', requires: ['conversions', 'sessions'] },
      { name: 'Conversion Rate (click-based)', metric: 'conversion-rate-click', unit: '%', description: 'Conversions ÷ Clicks × 100', category: 'Performance', industryMetric: 'cvr', requires: ['conversions', 'clicks'] },
    ],
    []
  );

  const isTemplateMetric = (metric: string) =>
    CAMPAIGN_BENCHMARK_TEMPLATES.some((t) => t.metric === String(metric || ''));

  const getLiveBenchmarkCurrentValue = (metric: string): { value: number; unit: string } => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const spend = ot?.spend || {};
    const rev = ot?.revenue || {};
    const unifiedSpend = parseNumSafe(spend?.unifiedSpend);
    const totalRevenue = parseNumSafe(rev?.totalRevenue ?? web?.revenue);
    const webConversions = parseNumSafe(web?.conversions);
    const sessions = parseNumSafe(web?.sessions);
    const users = parseNumSafe(web?.users);
    const totalConversions = getUnifiedConversions();
    const { clicks, impressions } = getAdClicksImpressions();
    const adConversions = getAdConversions();

    switch (String(metric || '')) {
      case 'revenue':
        return { value: totalRevenue, unit: '$' };
      case 'spend':
        return { value: unifiedSpend, unit: '$' };
      case 'conversions':
        return { value: totalConversions, unit: 'count' };
      case 'users':
        return { value: users, unit: 'count' };
      case 'ctr': {
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        return { value: ctr, unit: '%' };
      }
      case 'conversion-rate-website': {
        const rate = sessions > 0 ? (webConversions / sessions) * 100 : 0;
        return { value: rate, unit: '%' };
      }
      case 'conversion-rate-click': {
        const rate = clicks > 0 ? (adConversions / clicks) * 100 : 0;
        return { value: rate, unit: '%' };
      }
      case 'roas': {
        const roasPct = unifiedSpend > 0 ? (totalRevenue / unifiedSpend) * 100 : 0;
        return { value: roasPct, unit: '%' };
      }
      case 'roi': {
        const roi = unifiedSpend > 0 ? ((totalRevenue - unifiedSpend) / unifiedSpend) * 100 : 0;
        return { value: roi, unit: '%' };
      }
      case 'cpa': {
        const cpa = totalConversions > 0 ? unifiedSpend / totalConversions : 0;
        return { value: cpa, unit: '$' };
      }
      default:
        return { value: 0, unit: '' };
    }
  };

  const getInputAvailability = (template: CampaignBenchmarkTemplate): { available: boolean; reason?: string } => {
    const ot = outcomeTotals || {};
    const web = ot?.webAnalytics || ot?.ga4 || {};
    const spend = ot?.spend || {};
    const rev = ot?.revenue || {};
    const unifiedSpend = parseNumSafe(spend?.unifiedSpend);
    const totalRevenue = parseNumSafe(rev?.totalRevenue ?? web?.revenue);
    const webConnected = Boolean(web?.connected);
    const webSessions = parseNumSafe(web?.sessions);
    const webUsers = parseNumSafe(web?.users);
    const { clicks, impressions } = getAdClicksImpressions();
    const totalConversions = getUnifiedConversions();
    const adConversions = getAdConversions();

    const needs = template.requires || [];
    const has = (k: string) => {
      switch (k) {
        case 'spend':
          return unifiedSpend > 0;
        case 'revenue':
          return totalRevenue > 0;
        case 'conversions':
          return totalConversions > 0;
        case 'sessions':
          return webConnected && webSessions > 0;
        case 'users':
          return webConnected && webUsers > 0;
        case 'clicks':
          return clicks > 0;
        case 'impressions':
          return impressions > 0;
        default:
          return false;
      }
    };

    // Special-case: click-based CR uses ad conversions, not web conversions
    if (template.metric === 'conversion-rate-click') {
      const ok = clicks > 0 && adConversions > 0;
      return ok ? { available: true } : { available: false, reason: 'Clicks + conversions required' };
    }

    // If required inputs are missing, disable with a concise reason.
    for (const k of needs) {
      if (!has(k)) {
        if (k === 'spend') return { available: false, reason: 'Spend required' };
        if (k === 'revenue') return { available: false, reason: 'Revenue required' };
        if (k === 'conversions') return { available: false, reason: 'Conversions required' };
        if (k === 'sessions') return { available: false, reason: 'Web analytics sessions required' };
        if (k === 'users') return { available: false, reason: 'Web analytics users required' };
        if (k === 'clicks' || k === 'impressions') return { available: false, reason: 'Ad impressions + clicks required' };
        return { available: false, reason: 'Required inputs missing' };
      }
    }
    return { available: true };
  };

  const getRequiredInputsForMetric = (metric: string): BenchCalcInputKey[] => {
    const tpl = CAMPAIGN_BENCHMARK_TEMPLATES.find((t) => t.metric === String(metric || ''));
    const req = (tpl?.requires || []) as BenchCalcInputKey[];
    return req;
  };

  const isBenchConfigCompleteForMetric = (metric: string, rawConfig: any): boolean => {
    const cfg = normalizeBenchCalcConfig(rawConfig);
    if (!cfg) return false;
    const req = getRequiredInputsForMetric(metric);
    if (!req.length) return true;
    return req.every((k) => (cfg.inputs?.[k] || []).length > 0);
  };

  const formatBenchmarkSourcesSelected = (rawConfig: any): string => {
    const cfg = normalizeBenchCalcConfig(rawConfig) as any;
    if (!cfg || !cfg.inputs) return '';
    const parts: string[] = [];
    const add = (label: string, ids: string[] | undefined) => {
      const uniq = Array.from(new Set((ids || []).filter(Boolean)));
      if (!uniq.length) return;
      const pretty = uniq
        .map((id) => {
          switch (id) {
            case 'ga4':
              return 'GA4';
            case 'custom_integration':
              return 'Custom Integration';
            case 'imported_spend':
              return 'Imported Spend';
            case 'linkedin':
              return 'LinkedIn';
            case 'meta':
              return 'Meta';
            case 'shopify':
              return 'Shopify';
            case 'hubspot':
              return 'HubSpot';
            case 'salesforce':
              return 'Salesforce';
            default:
              return String(id);
          }
        })
        .join('+');
      parts.push(`${label}(${pretty})`);
    };
    add('Rev', cfg.inputs.revenue);
    add('Spend', cfg.inputs.spend);
    add('Conv', cfg.inputs.conversions);
    add('Sessions', cfg.inputs.sessions);
    add('Users', cfg.inputs.users);
    add('Clicks', cfg.inputs.clicks);
    add('Impr', cfg.inputs.impressions);
    return parts.join(' • ');
  };

  // Keep Current Value in sync with selected sources (no defaults; computed preview becomes the stored currentValue snapshot).
  useEffect(() => {
    const m = String(benchmarkForm.metric || '');
    if (!isTemplateMetric(m)) return;
    const computed = computeCurrentFromBenchConfig(benchmarkCalculationConfig);
    setBenchmarkForm((prev) => ({
      ...prev,
      unit: prev.unit || computed.unit || prev.unit,
      currentValue: computed.value === null ? '' : formatNumber(computed.value),
    }));
  }, [benchmarkCalculationConfig, benchmarkForm.metric]);

  // Fetch industry list
  const { data: industryData } = useQuery<{ industries: Array<{ value: string; label: string }> }>({
    queryKey: ['/api/industry-benchmarks'],
    staleTime: Infinity, // Industry list doesn't change
  });

  // Create Benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/benchmarks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Created",
        description: "Your benchmark has been successfully created.",
      });
      setShowCreateDialog(false);
      setEditingBenchmark(null);
      resetBenchmarkForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Benchmark",
        description: error?.message || "Failed to create benchmark.",
        variant: "destructive",
      });
    },
  });

  // Update Benchmark mutation
  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/campaigns/${campaign.id}/benchmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Updated",
        description: "Your benchmark has been successfully updated.",
      });
      setShowCreateDialog(false);
      setEditingBenchmark(null);
      resetBenchmarkForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Benchmark",
        description: error?.message || "Failed to update benchmark.",
        variant: "destructive",
      });
    },
  });

  // Delete Benchmark mutation
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/campaigns/${campaign.id}/benchmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/benchmarks`] });
      toast({
        title: "Benchmark Deleted",
        description: "Your benchmark has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Benchmark",
        description: error?.message || "Failed to delete benchmark.",
        variant: "destructive",
      });
    },
  });

  // Schedule Benchmark Report mutation
  const scheduleBenchmarkReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/benchmark-reports`, data);
      return res.json();
    },
    onSuccess: () => {
      setShowExportDialog(false);
      setScheduleForm({ 
        frequency: 'monthly', 
        recipients: '', 
        timeOfDay: '09:00',
        dayOfWeek: 'monday',
        dayOfMonth: '1',
      });
      setExportMode('download');
      toast({
        title: "Success",
        description: "Benchmark report scheduled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule benchmark report",
        variant: "destructive",
      });
    },
  });

  const handleExportBenchmarkReport = () => {
    if (exportMode === 'download') {
      exportCampaignBenchmarksToPDF({
        id: campaign.id,
        name: campaign.name,
        benchmarks: benchmarks.map((benchmark: any) => ({
          id: benchmark.id,
          name: benchmark.name,
          metric: benchmark.metric || 'N/A',
          currentValue: benchmark.currentValue?.toString() || '0',
          benchmarkValue: benchmark.benchmarkValue?.toString() || '0',
          unit: benchmark.unit || '',
          category: benchmark.category || '',
          benchmarkType: benchmark.benchmarkType || 'industry',
          source: benchmark.source || '',
          industry: benchmark.industry || '',
        })),
        exportDate: new Date(),
      });
      setShowExportDialog(false);
      toast({
        title: "Success",
        description: "Benchmark report exported successfully",
      });
    } else {
      handleScheduleBenchmarkReport();
    }
  };

  const handleScheduleBenchmarkReport = () => {
    if (!scheduleForm.recipients) {
      toast({
        title: "Validation Error",
        description: "Please provide at least one email recipient",
        variant: "destructive",
      });
      return;
    }

    // Convert day of week string to number (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeekMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    scheduleBenchmarkReportMutation.mutate({
      name: `${campaign.name} - Scheduled Benchmark Report`,
      scheduleEnabled: true,
      scheduleFrequency: scheduleForm.frequency,
      scheduleRecipients: scheduleForm.recipients.split(',').map(e => e.trim()),
      scheduleTime: scheduleForm.timeOfDay,
      scheduleDayOfWeek: scheduleForm.frequency === 'weekly' ? dayOfWeekMap[scheduleForm.dayOfWeek] : null,
      scheduleDayOfMonth: (scheduleForm.frequency === 'monthly' || scheduleForm.frequency === 'quarterly') ? parseInt(scheduleForm.dayOfMonth) : null,
    });
  };

  const resetBenchmarkForm = () => {
    setBenchmarkForm({
      metric: '',
      name: '',
      category: 'performance',
      unit: '',
      benchmarkValue: '',
      currentValue: '',
      benchmarkType: 'industry',
      industry: '',
      description: '',
      alertsEnabled: false,
      alertThreshold: '',
      alertCondition: 'below',
      emailRecipients: ''
    });
    setSelectedBenchmarkTemplate(null);
    setBenchmarkCalculationConfig(null);
  };

  const handleBenchmarkSubmit = () => {
    if (!benchmarkForm.name || !benchmarkForm.benchmarkValue) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (Name, Benchmark Value)",
        variant: "destructive",
      });
      return;
    }

    const metricKey = String(benchmarkForm.metric || '');
    if (isTemplateMetric(metricKey) && !isBenchConfigCompleteForMetric(metricKey, benchmarkCalculationConfig)) {
      toast({
        title: "Select sources",
        description: "Please select the connected data sources used to compute the Current Value.",
        variant: "destructive",
      });
      return;
    }

    const cleanNumber = (raw: any): number => {
      if (raw === null || raw === undefined) return 0;
      const s = String(raw).replace(/,/g, '').trim();
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };

    const benchmarkData = {
      campaignId: campaign.id,
      platformType: null, // Campaign-level benchmark
      ...benchmarkForm,
      calculationConfig: isTemplateMetric(metricKey) ? normalizeBenchCalcConfig(benchmarkCalculationConfig) : null,
      benchmarkValue: cleanNumber(benchmarkForm.benchmarkValue),
      currentValue: benchmarkForm.currentValue ? cleanNumber(benchmarkForm.currentValue) : 0,
      alertThreshold: benchmarkForm.alertsEnabled ? cleanNumber(benchmarkForm.alertThreshold) : null,
      emailRecipients: benchmarkForm.alertsEnabled && benchmarkForm.emailRecipients ? benchmarkForm.emailRecipients.split(',').map(e => e.trim()) : null,
    };

    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: benchmarkData });
    } else {
      createBenchmarkMutation.mutate(benchmarkData);
    }
  };

  const handleEditBenchmark = (benchmark: any) => {
    setEditingBenchmark(benchmark);
    const metric = String(benchmark.metric || '');
    const matchedTemplate = CAMPAIGN_BENCHMARK_TEMPLATES.find((t) => t.metric === metric) || null;
    setSelectedBenchmarkTemplate(matchedTemplate);
    setBenchmarkCalculationConfig(benchmark?.calculationConfig || null);
    setBenchmarkForm({
      metric,
      name: benchmark.name || '',
      category: benchmark.category || 'performance',
      unit: benchmark.unit || '',
      benchmarkValue: String(benchmark.benchmarkValue || ''),
      currentValue: String(benchmark.currentValue || ''),
      benchmarkType: (benchmark.benchmarkType === 'custom' ? 'custom' : 'industry'),
      industry: benchmark.industry || '',
      description: benchmark.description || '',
      alertsEnabled: benchmark.alertsEnabled || false,
      alertThreshold: String(benchmark.alertThreshold || ''),
      alertCondition: benchmark.alertCondition || 'below',
      emailRecipients: benchmark.emailRecipients || ''
    });
    setShowCreateDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'above':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'below':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'meeting':
        return <Target className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'above':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'below':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'meeting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Performance':
        return <BarChart3 className="w-4 h-4" />;
      case 'Conversion':
        return <Target className="w-4 h-4" />;
      case 'Cost':
        return <DollarSign className="w-4 h-4" />;
      case 'Revenue':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Award className="w-4 h-4" />;
    }
  };

  // Calculate benchmark status based on current vs benchmark value.
  // "above" means "better than benchmark" (direction-aware), not literally numerically above.
  const getBenchmarkStatus = (
    metricKey: string,
    currentValue: number,
    benchmarkValue: number
  ): 'above' | 'below' | 'meeting' => {
    const lowerBetter = isLowerBetterBenchmarkMetric(metricKey);
    const diff = Math.abs(currentValue - benchmarkValue);
    const tolerance = benchmarkValue * 0.05; // 5% tolerance band
    if (benchmarkValue === 0) return 'meeting';
    if (diff <= tolerance) return 'meeting';
    if (lowerBetter) return currentValue < benchmarkValue ? 'above' : 'below';
    return currentValue > benchmarkValue ? 'above' : 'below';
  };

  const calculateImprovement = (metricKey: string, currentValue: string | number, benchmarkValue: string | number): number => {
    const current = typeof currentValue === 'string' ? parseFloat(currentValue.replace(/,/g, '')) : currentValue;
    const benchmark = typeof benchmarkValue === 'string' ? parseFloat(benchmarkValue.replace(/,/g, '')) : benchmarkValue;
    if (!Number.isFinite(current) || !Number.isFinite(benchmark) || benchmark === 0) return 0;
    const lowerBetter = isLowerBetterBenchmarkMetric(metricKey);
    // Positive means "better than benchmark"
    return lowerBetter ? ((benchmark - current) / benchmark) * 100 : ((current - benchmark) / benchmark) * 100;
  };

  // Direction-aware progress to benchmark.
  // 100% means meeting benchmark. >100% means outperforming. <100% means underperforming.
  const getBenchmarkProgressPct = (metricKey: string, currentValue: number, benchmarkValue: number): number => {
    if (!Number.isFinite(currentValue) || !Number.isFinite(benchmarkValue) || benchmarkValue <= 0) return 0;
    const lowerBetter = isLowerBetterBenchmarkMetric(metricKey);
    if (lowerBetter) {
      // If lower is better, being below the benchmark is good.
      // progress = benchmark/current (e.g. current 50 vs benchmark 100 => 200%)
      if (currentValue <= 0) return 100;
      return (benchmarkValue / currentValue) * 100;
    }
    return (currentValue / benchmarkValue) * 100;
  };

  const getBenchmarkPerformanceBucket = (progressPct: number): 'on_track' | 'needs_attention' | 'behind' => {
    // Same thresholds as campaign-level KPIs for consistency:
    // On Track ≥ 90%, Needs Attention 70–89.9%, Behind < 70%.
    if (!Number.isFinite(progressPct)) return 'behind';
    if (progressPct >= 90) return 'on_track';
    if (progressPct >= 70) return 'needs_attention';
    return 'behind';
  };

  // Calculate summary stats
  const onTrackCount = benchmarks.filter((b) => {
    const metricKey = String(b.metric || '');
    const current = parseFloat(String((b.currentValue as any) ?? '0').replace(/,/g, '') || '0');
    const benchmark = parseFloat(String((b.benchmarkValue as any) ?? '0').replace(/,/g, '') || '0');
    const progress = getBenchmarkProgressPct(metricKey, current, benchmark);
    return getBenchmarkPerformanceBucket(progress) === 'on_track';
  }).length;

  const needsAttentionCount = benchmarks.filter((b) => {
    const metricKey = String(b.metric || '');
    const current = parseFloat(String((b.currentValue as any) ?? '0').replace(/,/g, '') || '0');
    const benchmark = parseFloat(String((b.benchmarkValue as any) ?? '0').replace(/,/g, '') || '0');
    const progress = getBenchmarkProgressPct(metricKey, current, benchmark);
    return getBenchmarkPerformanceBucket(progress) === 'needs_attention';
  }).length;

  const behindCount = benchmarks.filter((b) => {
    const metricKey = String(b.metric || '');
    const current = parseFloat(String((b.currentValue as any) ?? '0').replace(/,/g, '') || '0');
    const benchmark = parseFloat(String((b.benchmarkValue as any) ?? '0').replace(/,/g, '') || '0');
    const progress = getBenchmarkProgressPct(metricKey, current, benchmark);
    return getBenchmarkPerformanceBucket(progress) === 'behind';
  }).length;

  const avgImprovement =
    benchmarks.length > 0
      ? benchmarks.reduce((sum, b) => sum + calculateImprovement(String(b.metric || ''), b.currentValue || '0', b.benchmarkValue || '0'), 0) /
        benchmarks.length
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading benchmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Benchmarks</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track and compare your campaign performance against industry standards
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => {
              setEditingBenchmark(null);
              resetBenchmarkForm();
              setShowCreateDialog(true);
            }}
            className="flex items-center space-x-2"
            data-testid="button-create-benchmark"
          >
            <Plus className="w-4 h-4" />
            <span>Create Benchmark</span>
          </Button>
        </div>
      </div>

      {benchmarks.length > 0 ? (
        <>
          {/* Benchmark Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-total-benchmarks">
                      {benchmarks.length}
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-above-target">
                      {onTrackCount}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">meeting or exceeding benchmark</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p>
                    <p className="text-2xl font-bold text-yellow-600" data-testid="text-below-target">
                      {needsAttentionCount}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">within 70–90% of benchmark</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Behind</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-avg-improvement">
                      {behindCount}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">below 70% of benchmark</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Improvement</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-avg-improvement-percent">
                      {avgImprovement.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">across all benchmarks</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benchmarks List */}
          <div className="grid gap-6 lg:grid-cols-2">
            {benchmarks.map((benchmark) => (
          <Card key={benchmark.id} data-testid={`benchmark-card-${benchmark.id}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1">
                    {benchmark.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {benchmark.description || 'No description provided'}
                  </p>
                  {(() => {
                    const sourcesSelected = formatBenchmarkSourcesSelected(benchmark.calculationConfig);
                    return (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-medium">Sources selected:</span> {sourcesSelected || '—'}
                      </div>
                    );
                  })()}
                  {(benchmark.metric || campaign) && (
                    <div className="mt-2 flex items-center flex-wrap gap-2">
                      {benchmark.metric && (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          data-testid={`badge-benchmark-metric-${benchmark.id}`}
                        >
                          {benchmark.metric.toUpperCase()}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-normal bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                        Campaign: {campaign.name}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    {benchmark.benchmarkType && <span>Type: {benchmark.benchmarkType}</span>}
                    {benchmark.industry && (
                      <>
                        <span>•</span>
                        <span>{benchmark.industry}</span>
                      </>
                    )}
                    {benchmark.period && String(benchmark.period || "").toLowerCase() !== "monthly" && (
                      <>
                        <span>•</span>
                        <span>{benchmark.period}</span>
                      </>
                    )}
                    {benchmark.category && (
                      <>
                        <span>•</span>
                        <span>{benchmark.category}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditBenchmark(benchmark)}
                    data-testid={`button-edit-${benchmark.id}`}
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        data-testid={`button-delete-${benchmark.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <span className="font-medium">"{benchmark.name}"</span>. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Your Performance
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white" data-testid={`text-current-${benchmark.id}`}>
                    {formatNumber(benchmark.currentValue)}{benchmark.unit || ''}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Benchmark Value
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white" data-testid={`text-benchmark-${benchmark.id}`}>
                    {formatNumber(benchmark.benchmarkValue)}{benchmark.unit || ''}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Source
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {benchmark.source || 'Market Data'}
                  </div>
                </div>
              </div>
              
              {/* Progress Tracker - Benchmark Comparison */}
              {benchmark.currentValue && benchmark.benchmarkValue && (() => {
                // Calculate accurate progress and comparison
                const current = parseFloat(String(benchmark.currentValue).replace(/,/g, ''));
                const benchmarkVal = parseFloat(String(benchmark.benchmarkValue).replace(/,/g, ''));
                const metricKey = String(benchmark.metric || '');
                const progressTowardBenchmark = getBenchmarkProgressPct(metricKey, current, benchmarkVal);
                const bucket = getBenchmarkPerformanceBucket(progressTowardBenchmark);
                
                const percentDiff = calculateImprovement(metricKey, current, benchmarkVal);
                const isOnTrack = bucket === 'on_track';
                const isNeedsAttention = bucket === 'needs_attention';
                const isBehind = bucket === 'behind';
                
                return (
                  <div className="mt-4 space-y-3">
                    {/* Progress to Benchmark */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress to Benchmark</span>
                          {isOnTrack && <TrendingUp className="w-4 h-4 text-green-600" />}
                          {isNeedsAttention && <TrendingDown className="w-4 h-4 text-yellow-600" />}
                          {isBehind && <TrendingDown className="w-4 h-4 text-red-600" />}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {progressTowardBenchmark.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            isOnTrack ? 'bg-green-500' : isNeedsAttention ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(progressTowardBenchmark, 100)}%` }}
                        ></div>
                      </div>
                      {/* Delta text + inline status */}
                      <div className="flex items-center justify-between">
                        <div className={`text-xs px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                          isOnTrack
                            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                            : isNeedsAttention
                            ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
                        }`}>
                          {isOnTrack && <CheckCircle2 className="w-3 h-3" />}
                          {!isOnTrack && <AlertCircle className="w-3 h-3" />}
                          <span>{isOnTrack ? 'On Track' : isNeedsAttention ? 'Needs Attention' : 'Behind'}</span>
                        </div>
                        <p className={`text-xs font-medium ${Math.abs(percentDiff) < 1 ? 'text-green-600' : percentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Math.abs(percentDiff) < 1 ? 'At benchmark' : percentDiff >= 0 ? `${Math.abs(percentDiff).toFixed(1)}% above benchmark` : `${Math.abs(percentDiff).toFixed(1)}% below benchmark`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total Benchmarks', value: '0', icon: <Award className="w-8 h-8 text-blue-500" />, desc: '' },
              { label: 'On Track', value: '0', icon: <CheckCircle2 className="w-8 h-8 text-green-500" />, desc: 'meeting or exceeding benchmark', color: 'text-green-600' },
              { label: 'Needs Attention', value: '0', icon: <AlertCircle className="w-8 h-8 text-yellow-500" />, desc: 'within 70–90% of benchmark', color: 'text-yellow-600' },
              { label: 'Behind', value: '0', icon: <AlertCircle className="w-8 h-8 text-red-500" />, desc: 'below 70% of benchmark', color: 'text-red-600' },
              { label: 'Avg. Improvement', value: '0.0%', icon: <TrendingUp className="w-8 h-8 text-purple-500" />, desc: 'across all benchmarks' },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color || 'text-slate-900 dark:text-white'}`}>{s.value}</p>
                      {s.desc && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{s.desc}</p>}
                    </div>
                    {s.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Benchmark Dialog (template-first, aligned to Campaign KPI tiles) */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setEditingBenchmark(null);
          resetBenchmarkForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBenchmark ? 'Edit Benchmark' : 'Create New Benchmark'}</DialogTitle>
            <DialogDescription>
              {editingBenchmark 
                ? 'Update this benchmark. You can switch templates to benchmark a different metric.'
                : 'Choose a benchmark template, then set the benchmark target (industry or custom).'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Select Benchmark Template */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Select Benchmark Template</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Pick a metric to benchmark, then choose which connected sources to use for the Current Value (no defaults).
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_BENCHMARK_TEMPLATES.map((template) => {
                  const availability = getInputAvailability(template);
                  const disabled = !availability.available;
                  const selected = selectedBenchmarkTemplate?.metric === template.metric;
                  return (
                    <div
                      key={template.metric}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                      }`}
                      onClick={async () => {
                        if (disabled) return;
                        setSelectedBenchmarkTemplate(template);
                        // No defaults: user chooses sources before Current Value is computed.
                        setBenchmarkCalculationConfig({ metric: template.metric, inputs: {} });

                        // Keep name/unit/metric in sync with the selected template.
                        setBenchmarkForm((prev) => ({
                          ...prev,
                          metric: template.metric,
                          category: template.category,
                          name: template.name,
                          unit: template.unit,
                          currentValue: '',
                          // If industry type + industry already chosen, clear stale benchmarkValue and refetch below.
                          benchmarkValue: prev.benchmarkType === 'industry' && prev.industry ? '' : prev.benchmarkValue,
                        }));

                        // If Industry is selected and an industry is already chosen, refetch benchmark value for the new metric.
                        const nextIndustry = benchmarkForm.industry;
                        const nextType = benchmarkForm.benchmarkType;
                        if (nextType === 'industry' && nextIndustry) {
                          try {
                            const resp = await fetch(
                              `/api/industry-benchmarks/${encodeURIComponent(nextIndustry)}/${encodeURIComponent(template.industryMetric)}`
                            );
                            if (!resp.ok) {
                              setBenchmarkForm((prev) => ({ ...prev, benchmarkValue: '' }));
                              return;
                            }
                            const data = await resp.json().catch(() => null);
                            if (data && typeof data.value !== 'undefined') {
                              setBenchmarkForm((prev) => ({
                                ...prev,
                                benchmarkValue: String(data.value),
                                unit: prev.unit || data.unit || prev.unit,
                              }));
                            }
                          } catch {
                            // best-effort
                          }
                        }
                      }}
                      data-testid={`tile-benchmark-${template.metric}`}
                    >
                      <div className="font-medium text-sm text-slate-900 dark:text-white">{template.name}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {disabled ? (availability.reason || 'Not available') : template.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sources used for Current Value (no defaults) */}
            {isTemplateMetric(String(benchmarkForm.metric || '')) && (
              <div className="space-y-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Sources used for Current Value</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Select the sources you want included. Current Value will update once the required inputs are selected.
                  </div>
                </div>

                {getRequiredInputsForMetric(String(benchmarkForm.metric || '')).map((key) => {
                  const options = getBenchInputOptions(key);
                  const cfg = normalizeBenchCalcConfig(benchmarkCalculationConfig) as any;
                  const selectedIds: string[] = cfg?.inputs?.[key] || [];
                  const label =
                    key === 'revenue'
                      ? 'Revenue'
                      : key === 'spend'
                      ? 'Spend'
                      : key === 'conversions'
                      ? 'Conversions'
                      : key === 'sessions'
                      ? 'Sessions'
                      : key === 'users'
                      ? 'Users'
                      : key === 'clicks'
                      ? 'Clicks'
                      : key === 'impressions'
                      ? 'Impressions'
                      : key;

                  return (
                    <div key={key} className="space-y-2">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{label} sources</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {options.map((opt) => {
                          const checked = selectedIds.includes(opt.id);
                          const disabled = !opt.enabled;
                          return (
                            <label
                              key={opt.id}
                              className={`flex items-start gap-3 p-3 rounded-md border ${
                                disabled
                                  ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700'
                                  : 'cursor-pointer border-slate-200 dark:border-slate-700 hover:border-blue-300'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(c) => toggleBenchSource(key, opt.id, Boolean(c))}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium text-slate-900 dark:text-white">{opt.label}</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {typeof opt.value === 'number' ? formatNumber(opt.value) : ''}
                                  </div>
                                </div>
                                {disabled && opt.reason && (
                                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">{opt.reason}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Current Value (preview)</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {(() => {
                      const computed = computeCurrentFromBenchConfig(benchmarkCalculationConfig);
                      if (computed.value === null) return '—';
                      return `${formatNumber(computed.value)}${computed.unit === '$' ? '' : computed.unit ? ` ${computed.unit}` : ''}`;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Benchmark Name + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-name">Benchmark Name *</Label>
                <Input
                  id="benchmark-name"
                  placeholder="e.g., ROAS"
                  value={benchmarkForm.name}
                  onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                  data-testid="input-benchmark-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={benchmarkForm.unit} onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, unit: value })}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="$">$</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this benchmark represents"
                value={benchmarkForm.description}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, description: e.target.value })}
                rows={2}
                data-testid="input-benchmark-description"
              />
            </div>

            {/* Current Value + Benchmark Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-value">Current Value</Label>
                <Input
                  id="current-value"
                  placeholder={
                    isTemplateMetric(String(benchmarkForm.metric || ''))
                      ? (isBenchConfigCompleteForMetric(String(benchmarkForm.metric || ''), benchmarkCalculationConfig)
                          ? 'Computed from selected sources'
                          : 'Select sources to compute')
                      : '0'
                  }
                  value={benchmarkForm.currentValue}
                  readOnly={isTemplateMetric(String(benchmarkForm.metric || ''))}
                  onChange={(e) => {
                    if (isTemplateMetric(String(benchmarkForm.metric || ''))) return;
                    let value = e.target.value.replace(/[^\d.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                    if (value) {
                      const [intPart, decPart] = value.split('.');
                      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                      value = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
                    }
                    setBenchmarkForm({ ...benchmarkForm, currentValue: value });
                  }}
                  data-testid="input-benchmark-current"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark-value">Benchmark Value *</Label>
                <Input
                  id="benchmark-value"
                  placeholder="0"
                  value={benchmarkForm.benchmarkValue}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^\d.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                    if (value) {
                      const [intPart, decPart] = value.split('.');
                      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                      value = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
                    }
                    setBenchmarkForm({ ...benchmarkForm, benchmarkValue: value });
                  }}
                  data-testid="input-benchmark-value"
                />
              </div>
            </div>

            {/* Benchmark Type + Industry */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-type">Benchmark Type *</Label>
                <Select
                  value={benchmarkForm.benchmarkType}
                  onValueChange={(value: any) => {
                    const nextType = value === 'custom' ? 'custom' : 'industry';
                    setBenchmarkForm((prev) => ({
                      ...prev,
                      benchmarkType: nextType,
                      industry: nextType === 'industry' ? prev.industry : '',
                    }));
                  }}
                >
                  <SelectTrigger id="benchmark-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="industry">Industry</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {benchmarkForm.benchmarkType === 'industry' ? (
                <div className="space-y-2">
                  <Label htmlFor="benchmark-industry">Industry</Label>
                  <Select
                    value={benchmarkForm.industry || "__none__"}
                    onValueChange={async (value) => {
                      const nextIndustry = value === "__none__" ? "" : value;
                      setBenchmarkForm((prev) => ({ ...prev, industry: nextIndustry }));

                      const tpl = selectedBenchmarkTemplate || CAMPAIGN_BENCHMARK_TEMPLATES.find((t) => t.metric === String(benchmarkForm.metric || ''));
                      if (!nextIndustry || !tpl) return;
                      try {
                        const resp = await fetch(
                          `/api/industry-benchmarks/${encodeURIComponent(nextIndustry)}/${encodeURIComponent(tpl.industryMetric)}`
                        );
                        if (!resp.ok) return;
                        const data = await resp.json().catch(() => null);
                        if (data && typeof data.value !== 'undefined') {
                          setBenchmarkForm((prev) => ({
                            ...prev,
                            benchmarkValue: String(data.value),
                            unit: prev.unit || data.unit || prev.unit,
                          }));
                        }
                      } catch {
                        // best-effort
                      }
                    }}
                  >
                    <SelectTrigger id="benchmark-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select industry</SelectItem>
                      {industryData?.industries.map((industry) => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecting an industry will auto-fill the Benchmark Value for the chosen metric.
                  </p>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Email Alert Settings */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="alert-enabled"
                  checked={benchmarkForm.alertsEnabled}
                  onCheckedChange={(checked) => setBenchmarkForm({ ...benchmarkForm, alertsEnabled: checked as boolean })}
                  data-testid="checkbox-benchmark-alert"
                />
                <Label htmlFor="alert-enabled" className="text-sm font-medium">
                  Enable Email Alerts
                </Label>
              </div>

              {benchmarkForm.alertsEnabled && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Threshold</Label>
                    <Input
                      id="alert-threshold"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={benchmarkForm.alertThreshold}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, alertThreshold: e.target.value })}
                      data-testid="input-benchmark-alert-threshold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alert-condition">Condition</Label>
                    <Select
                      value={benchmarkForm.alertCondition}
                      onValueChange={(value: any) => setBenchmarkForm({ ...benchmarkForm, alertCondition: value })}
                    >
                      <SelectTrigger id="alert-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alert-emails">Email Recipients</Label>
                    <Input
                      id="alert-emails"
                      placeholder="email1@example.com, email2@example.com"
                      value={benchmarkForm.emailRecipients}
                      onChange={(e) => setBenchmarkForm({ ...benchmarkForm, emailRecipients: e.target.value })}
                      data-testid="input-benchmark-alert-emails"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingBenchmark(null);
              resetBenchmarkForm();
            }} data-testid="button-benchmark-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleBenchmarkSubmit} 
              disabled={
                createBenchmarkMutation.isPending ||
                updateBenchmarkMutation.isPending ||
                (isTemplateMetric(String(benchmarkForm.metric || '')) &&
                  !isBenchConfigCompleteForMetric(String(benchmarkForm.metric || ''), benchmarkCalculationConfig))
              }
              data-testid="button-benchmark-submit"
            >
              {editingBenchmark ? 'Update Benchmark' : 'Create Benchmark'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Benchmarks Report Dialog */}
      <Dialog open={showExportDialog} onOpenChange={(open) => {
        setShowExportDialog(open);
        if (!open) {
          setExportMode('download');
          setScheduleForm({ 
            frequency: 'monthly', 
            recipients: '', 
            timeOfDay: '09:00',
            dayOfWeek: 'monday',
            dayOfMonth: '1',
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Benchmarks Report</DialogTitle>
            <DialogDescription>
              Generate and download your benchmark report or schedule automated email delivery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Export Mode Selection */}
            <div className="space-y-3">
              <Label>Report Action</Label>
              <div className="space-y-2">
                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    exportMode === 'download' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setExportMode('download')}
                  data-testid="option-download-benchmark-report"
                >
                  <Checkbox 
                    checked={exportMode === 'download'}
                    onCheckedChange={() => setExportMode('download')}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Download className="w-4 h-4" />
                      <span className="font-medium">Download Report Now</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Generate and download PDF report immediately
                    </p>
                  </div>
                </div>

                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    exportMode === 'schedule' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setExportMode('schedule')}
                  data-testid="option-schedule-benchmark-report"
                >
                  <Checkbox 
                    checked={exportMode === 'schedule'}
                    onCheckedChange={() => setExportMode('schedule')}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">Schedule Automated Reports</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Set up recurring email delivery
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Options (only shown when schedule mode is selected) */}
            {exportMode === 'schedule' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="benchmark-schedule-frequency">Frequency</Label>
                  <Select 
                    value={scheduleForm.frequency}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, frequency: value })}
                  >
                    <SelectTrigger id="benchmark-schedule-frequency" data-testid="select-benchmark-schedule-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="benchmark-schedule-time">Time of Day</Label>
                    <Input
                      id="benchmark-schedule-time"
                      type="time"
                      value={scheduleForm.timeOfDay}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, timeOfDay: e.target.value })}
                      data-testid="input-benchmark-schedule-time"
                    />
                  </div>

                  {scheduleForm.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-schedule-day-week">Day of Week</Label>
                      <Select 
                        value={scheduleForm.dayOfWeek}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, dayOfWeek: value })}
                      >
                        <SelectTrigger id="benchmark-schedule-day-week" data-testid="select-benchmark-schedule-day-week">
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

                  {(scheduleForm.frequency === 'monthly' || scheduleForm.frequency === 'quarterly') && (
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-schedule-day-month">Day of Month</Label>
                      <Select 
                        value={scheduleForm.dayOfMonth}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, dayOfMonth: value })}
                      >
                        <SelectTrigger id="benchmark-schedule-day-month" data-testid="select-benchmark-schedule-day-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="benchmark-schedule-recipients">Email Recipients</Label>
                  <Input
                    id="benchmark-schedule-recipients"
                    type="text"
                    placeholder="email1@example.com, email2@example.com"
                    value={scheduleForm.recipients}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                    data-testid="input-benchmark-schedule-recipients"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Separate multiple emails with commas
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowExportDialog(false)}
              data-testid="button-benchmark-export-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExportBenchmarkReport}
              disabled={scheduleBenchmarkReportMutation.isPending}
              data-testid="button-benchmark-export-confirm"
            >
              {exportMode === 'download' 
                ? 'Download Report' 
                : scheduleBenchmarkReportMutation.isPending 
                  ? 'Scheduling...' 
                  : 'Schedule Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Campaign Insights Component — data-driven, no AI chat
function CampaignInsights({ campaign }: { campaign: Campaign }) {
  const { data: outcomeTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/outcome-totals`, "30days"],
    enabled: !!campaign.id,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaign.id}/outcome-totals?dateRange=30days`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: kpisList = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/kpis`],
    enabled: !!campaign.id,
  });

  const { data: benchmarksList = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/benchmarks`],
    enabled: !!campaign.id,
  });

  // Compute real metrics from outcome totals
  const metrics = useMemo(() => {
    if (!outcomeTotals) return null;
    const ga4 = outcomeTotals.ga4 || {};
    const platforms = outcomeTotals.platforms || {};
    const totalSpend = Number(outcomeTotals.spend?.unifiedSpend || 0);
    const totalRevenue = Number(ga4.revenue || 0) +
      Object.values(platforms).reduce((sum: number, p: any) => sum + Number(p?.attributedRevenue || 0), 0);
    const totalConversions = Number(ga4.conversions || 0) +
      Object.values(platforms).reduce((sum: number, p: any) => sum + Number(p?.conversions || 0), 0);
    const totalClicks = Object.values(platforms).reduce((sum: number, p: any) => sum + Number(p?.clicks || 0), 0);
    const totalImpressions = Object.values(platforms).reduce((sum: number, p: any) => sum + Number(p?.impressions || 0), 0);
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    return { totalSpend, totalRevenue, totalConversions, totalClicks, totalImpressions, roas, roi, cpa, ctr };
  }, [outcomeTotals]);

  // Categorize KPIs by health
  const kpiHealth = useMemo(() => {
    const onTrack: any[] = [];
    const needsAttention: any[] = [];
    const behind: any[] = [];
    for (const kpi of kpisList) {
      const current = Number(kpi.currentValue || 0);
      const target = Number(kpi.targetValue || 0);
      if (target <= 0) continue;
      const lowerBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(k => (kpi.metric || kpi.name || '').toLowerCase().includes(k));
      const ratio = lowerBetter ? (current > 0 ? target / current : 1) : current / target;
      const pct = ratio * 100;
      if (pct >= 90) onTrack.push({ ...kpi, pct });
      else if (pct >= 70) needsAttention.push({ ...kpi, pct });
      else behind.push({ ...kpi, pct });
    }
    return { onTrack, needsAttention, behind };
  }, [kpisList]);

  // Categorize Benchmarks by health
  const benchHealth = useMemo(() => {
    const onTrack: any[] = [];
    const needsAttention: any[] = [];
    const behind: any[] = [];
    for (const b of benchmarksList) {
      const current = Number(b.currentValue || 0);
      const target = Number(b.benchmarkValue || b.targetValue || 0);
      if (target <= 0) continue;
      const lowerBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(k => (b.metric || b.name || '').toLowerCase().includes(k));
      const ratio = lowerBetter ? (current > 0 ? target / current : 1) : current / target;
      const pct = ratio * 100;
      if (pct >= 90) onTrack.push({ ...b, pct });
      else if (pct >= 70) needsAttention.push({ ...b, pct });
      else behind.push({ ...b, pct });
    }
    return { onTrack, needsAttention, behind };
  }, [benchmarksList]);

  // Generate rule-based recommendations from real data
  const recommendations = useMemo(() => {
    const recs: { severity: 'high' | 'medium' | 'low'; text: string }[] = [];
    if (!metrics) return recs;
    if (metrics.totalSpend === 0) {
      recs.push({ severity: 'high', text: 'No spend detected. Verify platform connections are active and data is importing.' });
    }
    if (metrics.totalSpend > 0 && metrics.totalRevenue === 0) {
      recs.push({ severity: 'medium', text: 'Revenue tracking not configured or no revenue recorded. Connect a revenue source for ROI visibility.' });
    }
    if (metrics.roas > 0 && metrics.roas < 1) {
      recs.push({ severity: 'high', text: `ROAS is ${metrics.roas.toFixed(2)}x — campaign is spending more than it earns. Review targeting and creative.` });
    }
    if (metrics.ctr > 0 && metrics.ctr < 1) {
      recs.push({ severity: 'medium', text: `CTR is ${metrics.ctr.toFixed(2)}% — below 1%. Test new ad creatives or copy to improve click-through.` });
    }
    if (metrics.totalConversions > 0 && metrics.cpa > 0) {
      const cpaBenchmark = benchmarksList.find((b: any) => (b.metric || '').toLowerCase().includes('cpa'));
      if (cpaBenchmark) {
        const benchVal = Number(cpaBenchmark.benchmarkValue || cpaBenchmark.targetValue || 0);
        if (benchVal > 0 && metrics.cpa > benchVal) {
          recs.push({ severity: 'medium', text: `CPA ($${metrics.cpa.toFixed(2)}) exceeds benchmark ($${benchVal.toFixed(2)}). Consider audience refinement or bid optimization.` });
        }
      }
    }
    if (kpiHealth.behind.length > 0) {
      recs.push({ severity: 'high', text: `${kpiHealth.behind.length} KPI${kpiHealth.behind.length > 1 ? 's are' : ' is'} behind target. Review the KPIs tab for details.` });
    }
    if (benchHealth.behind.length > 0) {
      recs.push({ severity: 'medium', text: `${benchHealth.behind.length} benchmark${benchHealth.behind.length > 1 ? 's are' : ' is'} underperforming. Review the Benchmarks tab for details.` });
    }
    if (recs.length === 0 && metrics.totalSpend > 0) {
      recs.push({ severity: 'low', text: 'Campaign metrics look healthy. Continue monitoring for sustained performance.' });
    }
    return recs;
  }, [metrics, kpiHealth, benchHealth, benchmarksList]);

  const fmt = (n: number, prefix = '') => `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Performance Summary</span>
          </CardTitle>
          <CardDescription>Key metrics from all connected platforms (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">Spend</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtCurrency(metrics.totalSpend)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">Revenue</p>
                <p className="text-lg font-bold text-green-600">{fmtCurrency(metrics.totalRevenue)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">ROAS</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : '—'}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">ROI</p>
                <p className={`text-lg font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{metrics.roi !== 0 ? `${metrics.roi.toFixed(1)}%` : '—'}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">Conversions</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(metrics.totalConversions)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 mb-1">CPA</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{metrics.cpa > 0 ? fmtCurrency(metrics.cpa) : '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading performance data...</p>
          )}
        </CardContent>
      </Card>

      {/* KPI Health */}
      {kpisList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>KPI Health</span>
            </CardTitle>
            <CardDescription>{kpisList.length} KPI{kpisList.length !== 1 ? 's' : ''} tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-2xl font-bold text-green-600">{kpiHealth.onTrack.length}</p>
                <p className="text-xs text-green-700 dark:text-green-400">On Track</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <p className="text-2xl font-bold text-amber-600">{kpiHealth.needsAttention.length}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Needs Attention</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600">{kpiHealth.behind.length}</p>
                <p className="text-xs text-red-700 dark:text-red-400">Behind</p>
              </div>
            </div>
            {(kpiHealth.behind.length > 0 || kpiHealth.needsAttention.length > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Needs attention:</p>
                {[...kpiHealth.behind, ...kpiHealth.needsAttention].slice(0, 3).map((kpi: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{kpi.name || kpi.metric}</span>
                    <span className={`font-medium ${kpi.pct < 70 ? 'text-red-600' : 'text-amber-600'}`}>
                      {kpi.pct.toFixed(0)}% of target
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benchmark Health */}
      {benchmarksList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GitCompare className="w-5 h-5" />
              <span>Benchmark Comparison</span>
            </CardTitle>
            <CardDescription>{benchmarksList.length} benchmark{benchmarksList.length !== 1 ? 's' : ''} tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-2xl font-bold text-green-600">{benchHealth.onTrack.length}</p>
                <p className="text-xs text-green-700 dark:text-green-400">Meeting</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <p className="text-2xl font-bold text-amber-600">{benchHealth.needsAttention.length}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Close</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600">{benchHealth.behind.length}</p>
                <p className="text-xs text-red-700 dark:text-red-400">Below</p>
              </div>
            </div>
            {(benchHealth.behind.length > 0 || benchHealth.needsAttention.length > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Underperforming:</p>
                {[...benchHealth.behind, ...benchHealth.needsAttention].slice(0, 3).map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{b.name || b.metric}</span>
                    <span className={`font-medium ${b.pct < 70 ? 'text-red-600' : 'text-amber-600'}`}>
                      {b.pct.toFixed(0)}% of benchmark
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actionable Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>Recommendations</span>
          </CardTitle>
          <CardDescription>Data-driven suggestions based on current campaign metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${
                  rec.severity === 'high' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                  rec.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500' :
                  'bg-green-50 dark:bg-green-900/20 border-green-500'
                }`}>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-xs shrink-0 ${
                      rec.severity === 'high' ? 'text-red-700 border-red-300' :
                      rec.severity === 'medium' ? 'text-amber-700 border-amber-300' :
                      'text-green-700 border-green-300'
                    }`}>{rec.severity}</Badge>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{rec.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data available to generate recommendations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id;
  const { toast: toastHook } = useToast();

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: connectedPlatformsData, isLoading: connectedPlatformsLoading } = useQuery<{ statuses: ConnectedPlatformStatus[] }>({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/connected-platforms`);
      if (!response.ok) {
        devError(`[Campaign Detail] Failed to fetch connected platforms for ${campaignId}`);
        return { statuses: [] };
      }
      const data = await response.json();
      devLog(`[Campaign Detail] Connected platforms for ${campaignId}:`, data);
      return data;
    }
  });

  const connectedPlatformStatuses: ConnectedPlatformStatus[] =
    connectedPlatformsData?.statuses ?? [];

  // Avoid UI "flash" while platform statuses are still loading.
  const connectedPlatformsReady = !!campaignId && !connectedPlatformsLoading;

  const platformStatusMap = useMemo(() => {
    const map = new Map<string, ConnectedPlatformStatus>();
    connectedPlatformStatuses.forEach((status) => {
      devLog(`[Campaign Detail] Mapping platform ${status.id}: connected=${status.connected}`);
      map.set(status.id, status);
    });
    return map;
  }, [connectedPlatformStatuses]);

  // Get campaign KPIs for report inclusion
  const { data: campaignKPIs } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/kpis`],
    enabled: !!campaignId,
  });

  // Check GA4 connection status - force refetch on mount
  const { data: ga4Connection, refetch: refetchGA4Connection } = useQuery({
    queryKey: ["/api/ga4/check-connection", campaignId],
    enabled: !!campaignId,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/ga4/check-connection/${campaignId}`);
        if (!response.ok) {
          console.log(`[Frontend] GA4 check failed for ${campaignId}:`, response.status);
          return { connected: false };
        }
        const data = await response.json();
        console.log(`[Frontend] GA4 connection status for ${campaignId}:`, JSON.stringify(data, null, 2));
        // Ensure connected is explicitly boolean
        return { ...data, connected: data.connected === true };
      } catch (error) {
        console.error(`[Frontend] GA4 check error for ${campaignId}:`, error);
        return { connected: false };
      }
    },
  });

  // Refetch connection status when campaignId changes
  useEffect(() => {
    if (campaignId) {
      refetchGA4Connection();
    }
  }, [campaignId, refetchGA4Connection]);

  // Check Google Sheets connection status
  const { data: sheetsConnection, refetch: refetchSheetsConnection } = useQuery({
    queryKey: ["/api/google-sheets/check-connection", campaignId],
    enabled: !!campaignId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/google-sheets/check-connection/${campaignId}`);
      if (!response.ok) {
        console.log(`[Campaign Detail] Google Sheets check-connection failed for ${campaignId}:`, response.status);
        return { connected: false };
      }
      const data = await response.json();
      console.log(`[Campaign Detail] Google Sheets connection check for ${campaignId}:`, data);
      return data;
    },
  });

  // Fetch all Google Sheets connections for this campaign
  const { data: googleSheetsConnectionsData, refetch: refetchGoogleSheetsConnections } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"],
    enabled: !!campaignId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections`);
      if (!response.ok) {
        console.log(`[Campaign Detail] Failed to fetch Google Sheets connections for ${campaignId}:`, response.status);
        return { success: false, connections: [] };
      }
      const data = await response.json();
      return data;
    },
  });

  const googleSheetsConnections = googleSheetsConnectionsData?.connections || [];
  const MAX_GOOGLE_SHEETS_CONNECTIONS = 10;
  const canAddMoreSheets = googleSheetsConnections.length < MAX_GOOGLE_SHEETS_CONNECTIONS;

  const queryClientHook = useQueryClient();

  // Mutation to set primary connection
  const setPrimaryMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-connections/${connectionId}/set-primary`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to set primary connection");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] });
      queryClientHook.invalidateQueries({ queryKey: ["/api/google-sheets/check-connection", campaignId] });
      queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
    },
  });

  // Mutation to delete connection
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/google-sheets/${campaignId}/connection`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete connection");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-connections"] });
      queryClientHook.invalidateQueries({ queryKey: ["/api/google-sheets/check-connection", campaignId] });
      queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
      queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
      // Invalidate all LinkedIn import sessions to refresh hasRevenueTracking
      queryClientHook.invalidateQueries({ queryKey: ["/api/linkedin/imports"] });
      refetchSheetsConnection();
    },
  });

  // Check LinkedIn connection status
  const { data: linkedInConnection } = useQuery({
    queryKey: ["/api/linkedin/check-connection", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/linkedin/check-connection/${campaignId}`);
      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  // Fetch latest LinkedIn import session for analytics link
  const { data: linkedInSession } = useQuery({
    queryKey: ["/api/linkedin/import-sessions", campaignId],
    enabled: !!campaignId && !!linkedInConnection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/linkedin/import-sessions/${campaignId}`);
      if (!response.ok) return null;
      const sessions = await response.json();
      // Return the latest session (they're sorted by date, newest first)
      return sessions.length > 0 ? sessions[0] : null;
    },
  });

  // Check Custom Integration connection status
  const { data: customIntegration } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/custom-integration/${campaignId}`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Fetch LinkedIn metrics for Performance Summary
  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Fetch KPIs for Performance Summary
  const { data: kpis = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpis`],
    enabled: !!campaignId,
  });

  // Fetch Benchmarks for Performance Summary
  const { data: benchmarks = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/benchmarks`],
    enabled: !!campaignId,
  });

  const { data: ga4Metrics, isLoading: ga4Loading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId && !!ga4Connection?.connected,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch GA4 metrics');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'GA4 metrics request failed');
      }
      
      // Return the real metrics from your Google Analytics
      return {
        impressions: data.metrics.impressions, // Real users from your GA4
        clicks: data.metrics.clicks, // Real sessions from your GA4  
        sessions: data.metrics.sessions,
        pageviews: data.metrics.pageviews,
        bounceRate: data.metrics.bounceRate,
        averageSessionDuration: data.metrics.averageSessionDuration,
        conversions: data.metrics.conversions,
      };
    },
  });

  // Fetch Google Sheets data
  const { data: sheetsData, isLoading: sheetsLoading, error: sheetsError, refetch: refetchSheets } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId && !!sheetsConnection?.connected,
    retry: false, // Don't retry on 401 errors (token expired)
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle token expiration gracefully
        if (response.status === 401 && (errorData.error === 'REFRESH_TOKEN_EXPIRED' || errorData.error === 'ACCESS_TOKEN_EXPIRED' || errorData.requiresReauthorization)) {
          // Invalidate the connection status so UI updates
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
          queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/check-connection", campaignId] });
          
          // Return a special error that we can handle in the UI
          const error = new Error('TOKEN_EXPIRED') as any;
          error.requiresReauthorization = true;
          error.message = errorData.message || 'Google Sheets connection expired. Please reconnect.';
          throw error;
        }
        
        // Handle missing spreadsheet
        if (response.status === 400 && errorData.missingSpreadsheet) {
          // Invalidate the connection status so UI updates
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
          queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/check-connection", campaignId] });
          
          const error = new Error('MISSING_SPREADSHEET') as any;
          error.message = errorData.error || 'No spreadsheet selected. Please select a spreadsheet.';
          throw error;
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to fetch Google Sheets data');
      }
      const data = await response.json();
      
      // Check if response indicates failure (some endpoints return success: false)
      if (data.success === false) {
        throw new Error(data.error || data.message || 'Google Sheets data request failed');
      }
      
      return {
        summary: data.summary,
        spreadsheetName: data.spreadsheetName,
        totalRows: data.totalRows,
        headers: data.headers,
        lastUpdated: data.lastUpdated,
        matchingInfo: data.matchingInfo, // Include matching information
        calculatedConversionValues: data.calculatedConversionValues || [] // Include calculated conversion values per platform
      };
    },
  });

  // Determine connected platforms based on actual connections
  const connectedPlatformIds = campaign?.platform?.split(', ') || [];
  
  // Map platform IDs to display names
  const platformIdToName: Record<string, string> = {
    'google-analytics': 'Google Analytics',
    'google-sheets': 'Google Sheets',
    'linkedin': 'LinkedIn Ads',
    'facebook': 'Facebook Ads',
    'google-ads': 'Google Ads',
    'tiktok': 'TikTok Ads',
    'shopify': 'Shopify',
    'custom-integration': 'Custom Integration'
  };
  
  const connectedPlatformNames = connectedPlatformIds.map(id => platformIdToName[id] || id);
  
  console.log('[Campaign Detail] Connected platform IDs:', connectedPlatformIds);
  console.log('[Campaign Detail] Connected platform names:', connectedPlatformNames);
  
  // Use campaign data for realistic platform distribution
  const campaignImpressions = campaign?.impressions || 0;
  const campaignClicks = campaign?.clicks || 0;
  const campaignSpend = parseFloat(campaign?.spend || "0");
  const estimatedConversions = Math.round(campaignClicks * 0.0347); // 3.47% conversion rate
  
  // Distribute campaign metrics across connected platforms based on typical performance
  const platformDistribution = {
    "Facebook Ads": { impressions: 0.35, clicks: 0.32, spend: 0.38, conversions: 0.28 },
    "Google Ads": { impressions: 0.28, clicks: 0.35, spend: 0.32, conversions: 0.42 },
    "TikTok Ads": { impressions: 0.22, clicks: 0.18, spend: 0.18, conversions: 0.15 },
    "LinkedIn Ads": { impressions: 0.15, clicks: 0.15, spend: 0.12, conversions: 0.15 }
  };
  
  // Debug: Log connection status
  useEffect(() => {
    console.log('[Campaign Detail] GA4 Connection Status:', {
      campaignId,
      ga4Connection,
      connected: ga4Connection?.connected,
      hasData: !!ga4Connection
    });
  }, [campaignId, ga4Connection]);

  const gaPlatformStatus = platformStatusMap.get("google-analytics");

  // Use platformStatusMap as single source of truth for connection status
  const isGA4Connected = gaPlatformStatus?.connected === true;
  
  devLog(`[Campaign Detail] GA4 Status Check:`, {
    campaignId,
    gaPlatformStatus,
    isGA4Connected,
    analyticsPath: gaPlatformStatus?.analyticsPath
  });

  const isLinkedInConnected = platformStatusMap.get("linkedin")?.connected === true;
  const hasLinkedInImportSession = !!linkedInSession?.id;
  const linkedInRequiresImport = isLinkedInConnected && !hasLinkedInImportSession;
  
  // Build platformMetrics array dynamically based on connected platforms
  const allPlatformMetrics: PlatformMetrics[] = [
    {
      platform: "Google Analytics",
      connected: isGA4Connected,
      impressions: ga4Metrics?.impressions || 0,
      clicks: ga4Metrics?.clicks || 0,
      conversions: ga4Metrics?.conversions || 0,
      spend: "0.00", // GA4 doesn't track spend directly
      ctr: ga4Metrics?.impressions && ga4Metrics.impressions > 0 ? `${((ga4Metrics.clicks / ga4Metrics.impressions) * 100).toFixed(2)}%` : "0.00%",
      cpc: "$0.00", // GA4 doesn't track cost per click
      analyticsPath: isGA4Connected ? (gaPlatformStatus?.analyticsPath || `/campaigns/${campaign?.id}/ga4-metrics`) : undefined
    },
    {
      platform: "Google Sheets",
      connected: platformStatusMap.get("google-sheets")?.connectedCampaignLevel === true,
      impressions: sheetsData?.summary?.totalImpressions || 0,
      clicks: sheetsData?.summary?.totalClicks || 0,
      conversions: 0, // Conversions not in summary, would need to be calculated separately
      spend: sheetsData?.summary?.totalSpend?.toString() || "0.00",
      ctr: sheetsData?.summary?.averageCTR ? `${sheetsData.summary.averageCTR.toFixed(2)}%` : "0.00%",
      cpc: sheetsData?.summary?.totalClicks && sheetsData.summary.totalClicks > 0 && sheetsData.summary.totalSpend ? `$${(sheetsData.summary.totalSpend / sheetsData.summary.totalClicks).toFixed(2)}` : "$0.00",
      analyticsPath: platformStatusMap.get("google-sheets")?.analyticsPath || `/campaigns/${campaign?.id}/google-sheets-data`
    },
    {
      platform: "Facebook Ads", 
      connected: platformStatusMap.get("facebook")?.connected === true,
      impressions: platformStatusMap.get("facebook")?.connected ? Math.round(campaignImpressions * platformDistribution["Facebook Ads"].impressions) : 0,
      clicks: platformStatusMap.get("facebook")?.connected ? Math.round(campaignClicks * platformDistribution["Facebook Ads"].clicks) : 0,
      conversions: platformStatusMap.get("facebook")?.connected ? Math.round(estimatedConversions * platformDistribution["Facebook Ads"].conversions) : 0,
      spend: platformStatusMap.get("facebook")?.connected ? (campaignSpend * platformDistribution["Facebook Ads"].spend).toFixed(2) : "0.00",
      ctr: platformStatusMap.get("facebook")?.connected ? "2.64%" : "0.00%",
      cpc: platformStatusMap.get("facebook")?.connected ? "$0.68" : "$0.00",
      analyticsPath: platformStatusMap.get("facebook")?.analyticsPath || `/campaigns/${campaign?.id}/meta-analytics`
    },
    {
      platform: "Google Ads",
      connected: connectedPlatformNames.includes("Google Ads"), 
      impressions: connectedPlatformNames.includes("Google Ads") ? Math.round(campaignImpressions * platformDistribution["Google Ads"].impressions) : 0,
      clicks: connectedPlatformNames.includes("Google Ads") ? Math.round(campaignClicks * platformDistribution["Google Ads"].clicks) : 0,
      conversions: connectedPlatformNames.includes("Google Ads") ? Math.round(estimatedConversions * platformDistribution["Google Ads"].conversions) : 0,
      spend: connectedPlatformNames.includes("Google Ads") ? (campaignSpend * platformDistribution["Google Ads"].spend).toFixed(2) : "0.00",
      ctr: connectedPlatformNames.includes("Google Ads") ? "3.24%" : "0.00%",
      cpc: connectedPlatformNames.includes("Google Ads") ? "$0.42" : "$0.00"
    },
    {
      platform: "TikTok Ads",
      connected: connectedPlatformNames.includes("TikTok Ads"),
      impressions: connectedPlatformNames.includes("TikTok Ads") ? Math.round(campaignImpressions * platformDistribution["TikTok Ads"].impressions) : 0,
      clicks: connectedPlatformNames.includes("TikTok Ads") ? Math.round(campaignClicks * platformDistribution["TikTok Ads"].clicks) : 0,
      conversions: connectedPlatformNames.includes("TikTok Ads") ? Math.round(estimatedConversions * platformDistribution["TikTok Ads"].conversions) : 0,
      spend: connectedPlatformNames.includes("TikTok Ads") ? (campaignSpend * platformDistribution["TikTok Ads"].spend).toFixed(2) : "0.00",
      ctr: connectedPlatformNames.includes("TikTok Ads") ? "2.15%" : "0.00%",
      cpc: connectedPlatformNames.includes("TikTok Ads") ? "$0.59" : "$0.00"
    },
    {
      platform: "LinkedIn Ads",
      connected: isLinkedInConnected,
      requiresImport: linkedInRequiresImport,
      impressions: linkedInRequiresImport ? 0 : (isLinkedInConnected ? Math.round(campaignImpressions * platformDistribution["LinkedIn Ads"].impressions) : 0),
      clicks: linkedInRequiresImport ? 0 : (isLinkedInConnected ? Math.round(campaignClicks * platformDistribution["LinkedIn Ads"].clicks) : 0),
      conversions: linkedInRequiresImport ? 0 : (isLinkedInConnected ? Math.round(estimatedConversions * platformDistribution["LinkedIn Ads"].conversions) : 0),
      spend: linkedInRequiresImport ? "0.00" : (isLinkedInConnected ? (campaignSpend * platformDistribution["LinkedIn Ads"].spend).toFixed(2) : "0.00"),
      ctr: linkedInRequiresImport ? "0.00%" : (isLinkedInConnected ? "2.78%" : "0.00%"),
      cpc: linkedInRequiresImport ? "$0.00" : (isLinkedInConnected ? "$0.48" : "$0.00"),
      analyticsPath: linkedInRequiresImport
        ? null
        : ((connectedPlatformsLoading || !campaign?.id)
          ? null
          : (platformStatusMap.get("linkedin")?.analyticsPath ||
            (linkedInSession?.id
              ? `/campaigns/${campaign?.id}/linkedin-analytics?session=${encodeURIComponent(linkedInSession.id)}`
              : `/campaigns/${campaign?.id}/linkedin-analytics`)))
    },
    {
      platform: "Shopify",
      connected: connectedPlatformNames.includes("Shopify"),
      impressions: 0, // Shopify doesn't track impressions directly
      clicks: 0, // Shopify doesn't track ad clicks directly
      conversions: connectedPlatformNames.includes("Shopify") ? estimatedConversions : 0, // Show total conversions through Shopify
      spend: "0.00", // Shopify doesn't track ad spend
      ctr: "0.00%",
      cpc: "$0.00"
    },
    {
      platform: "Custom Integration",
      connected: platformStatusMap.get("custom-integration")?.connected === true,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: "0.00",
      ctr: "0.00%",
      cpc: "$0.00",
      analyticsPath: platformStatusMap.get("custom-integration")?.analyticsPath || `/campaigns/${campaign?.id}/custom-integration-analytics`
    }
  ];

  // Show ALL platforms, but only connected ones will have the blue badge and analytics button
  // The platform cards will show connection status and allow users to connect from the campaign detail page
  const platformMetrics = allPlatformMetrics;
  
  devLog('[Campaign Detail] Connected platform IDs:', connectedPlatformIds);
  devLog('[Campaign Detail] Connected platform names:', connectedPlatformNames);
  devLog('[Campaign Detail] Showing all platforms, connected count:', platformMetrics.filter(p => p.connected).length);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Google Analytics":
        return <SiGoogle className="w-5 h-5 text-orange-500" />;
      case "Google Sheets":
        return <SiGoogle className="w-5 h-5 text-green-500" />;
      case "Facebook Ads":
        return <SiFacebook className="w-5 h-5 text-blue-600" />;
      case "LinkedIn Ads":
        return <SiLinkedin className="w-5 h-5 text-blue-700" />;
      case "TikTok Ads":
        return <i className="fab fa-tiktok w-5 h-5 text-black" />;
      case "Shopify":
        return <i className="fab fa-shopify w-5 h-5 text-green-600" />;
      case "Custom Integration":
        return (
          <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return <BarChart3 className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>;
      case "completed":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Add state for managing connection dropdowns and report generation
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ platform: string; platformLabel: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportType, setReportType] = useState<"standard" | "custom">("standard");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [reportMetrics, setReportMetrics] = useState<string[]>(["impressions", "clicks", "conversions", "spend"]);
  const [reportDateRange, setReportDateRange] = useState("30d");
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv" | "xlsx">("pdf");
  const [customReportName, setCustomReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [includeKPIs, setIncludeKPIs] = useState(false);
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleDay, setScheduleDay] = useState("monday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [selectedSections, setSelectedSections] = useState<{[key: string]: string[]}>({});
  const [showMappingInterface, setShowMappingInterface] = useState(false);
  const [mappingConnectionId, setMappingConnectionId] = useState<string | null>(null);
  const [mappingSpreadsheetId, setMappingSpreadsheetId] = useState<string | null>(null);

  // --- Platform disconnect handler ---
  const handleDisconnectPlatform = async () => {
    if (!disconnectConfirm || !campaignId) return;
    setDisconnecting(true);
    try {
      let url = '';
      const p = disconnectConfirm.platform;
      if (p === 'LinkedIn Ads') {
        url = `/api/linkedin/disconnect/${campaignId}`;
      } else if (p === 'Facebook Ads') {
        url = `/api/campaigns/${campaignId}/meta/connection`;
      } else if (p === 'Google Analytics') {
        const connId = (ga4Connection as any)?.connectionId || (ga4Connection as any)?.id;
        if (connId) {
          url = `/api/ga4-connections/${connId}`;
        } else {
          throw new Error('GA4 connection ID not found');
        }
      } else {
        throw new Error('Disconnect not supported for this platform');
      }
      const resp = await fetch(url, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to disconnect');
      }
      toastHook({ title: "Disconnected", description: `${disconnectConfirm.platformLabel} has been disconnected from this campaign.` });
      // Broad cache invalidation so all tabs update
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/ga4/check-connection", campaignId] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/all-data-sources`] });
      void queryClient.invalidateQueries({ queryKey: ['/api/linkedin/imports'], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/kpis", campaignId], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["/api/platforms/linkedin/benchmarks", campaignId], exact: false });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals`], exact: false });
    } catch (e: any) {
      toastHook({ title: "Error", description: e?.message || "Failed to disconnect platform", variant: "destructive" });
    } finally {
      setDisconnecting(false);
      setDisconnectConfirm(null);
    }
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Campaign not found</h2>
              <Link href="/campaigns">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaigns
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const connectedPlatforms = platformMetrics.filter(p => p.connected);
  
  // Use campaign data directly for Performance Summary calculations
  const totalImpressions = campaignImpressions;
  const totalClicks = campaignClicks;
  const totalConversions = estimatedConversions;
  const totalSpend = campaignSpend;

  // Standard report templates
  const STANDARD_TEMPLATES = [
    {
      id: "performance_summary",
      name: "Performance Summary",
      description: "Comprehensive overview of campaign performance metrics",
      icon: <BarChart3 className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "ctr", "cpc", "roas"],
      sections: ["Overview", "Campaign Health", "What's Changed", "Insights"]
    },
    {
      id: "roi_analysis",
      name: "Budget & Financial Analysis",
      description: "Comprehensive financial analysis including ROI, ROAS, cost analysis, revenue breakdown, and intelligent budget allocation insights",
      icon: <DollarSign className="w-4 h-4" />,
      metrics: ["spend", "conversions", "revenue", "roas", "cpa", "roi", "budget_allocation", "cost_efficiency"],
      sections: ["Overview", "ROI & ROAS", "Cost Analysis", "Budget Allocation", "Insights"]
    },
    {
      id: "platform_comparison",
      name: "Platform Comparison",
      description: "Side-by-side comparison of all connected platforms",
      icon: <PieChart className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "ctr", "platform_share"],
      sections: ["Overview", "Performance Metrics", "Cost Analysis", "Insights"]
    },
    {
      id: "trend_analysis",
      name: "Trend Analysis",
      description: "Time-series analysis of performance trends",
      icon: <TrendingUp className="w-4 h-4" />,
      metrics: ["impressions", "clicks", "conversions", "spend", "trends", "forecasting"],
      sections: ["Coming Soon"]
    },
    {
      id: "executive_summary",
      name: "Executive Summary",
      description: "High-level summary for stakeholders and leadership",
      icon: <FileText className="w-4 h-4" />,
      metrics: ["key_metrics", "achievements", "challenges", "recommendations"],
      sections: ["Executive Overview", "Strategic Recommendations"]
    }
  ];

  const AVAILABLE_METRICS = [
    { id: "impressions", name: "Impressions", description: "Total ad impressions" },
    { id: "clicks", name: "Clicks", description: "Total clicks on ads" },
    { id: "conversions", name: "Conversions", description: "Total conversions tracked" },
    { id: "spend", name: "Ad Spend", description: "Total advertising spend" },
    { id: "ctr", name: "Click-through Rate", description: "Percentage of clicks per impression" },
    { id: "cpc", name: "Cost Per Click", description: "Average cost per click" },
    { id: "cpa", name: "Cost Per Acquisition", description: "Cost per conversion" },
    { id: "roas", name: "Return on Ad Spend", description: "Revenue generated per dollar spent" },
    { id: "roi", name: "Return on Investment", description: "Overall return on investment" },
    { id: "revenue", name: "Revenue", description: "Total revenue generated" },
    { id: "bounce_rate", name: "Bounce Rate", description: "Percentage of single-page visits" },
    { id: "session_duration", name: "Session Duration", description: "Average session duration" },
    { id: "page_views", name: "Page Views", description: "Total page views" },
    { id: "new_users", name: "New Users", description: "Number of new users" },
    { id: "engagement_rate", name: "Engagement Rate", description: "User engagement percentage" }
  ];

  // Report generation functions
  const generateReport = async () => {
    try {
      // Use real benchmark data from API
      const realBenchmarks = (benchmarks || []).map((b: any) => ({
        name: b.name || b.metric || 'Unnamed',
        currentValue: String(b.currentValue ?? '—'),
        targetValue: String(b.benchmarkValue ?? b.targetValue ?? '—'),
        status: (() => {
          const cur = Number(b.currentValue || 0);
          const tgt = Number(b.benchmarkValue || b.targetValue || 0);
          if (tgt <= 0) return 'No Target';
          const lowerBetter = ['cpc', 'cpm', 'cpa', 'cpl', 'spend'].some(k => (b.metric || b.name || '').toLowerCase().includes(k));
          const ratio = lowerBetter ? (cur > 0 ? tgt / cur : 1) : cur / tgt;
          return ratio >= 0.9 ? 'On Track' : ratio >= 0.7 ? 'Needs Attention' : 'Behind';
        })(),
        category: b.category || 'General',
        industry: b.industry || ''
      }));

      const reportData = {
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        reportType,
        template: reportType === "standard" ? selectedTemplate : "custom",
        customName: customReportName,
        description: reportDescription,
        metrics: reportMetrics,
        dateRange: reportDateRange,
        format: reportFormat,
        platforms: connectedPlatforms.map(p => p.platform),
        includeKPIs,
        kpis: includeKPIs ? campaignKPIs : [],
        includeBenchmarks,
        benchmarks: includeBenchmarks ? realBenchmarks : [],
        enableScheduling,
        schedule: enableScheduling ? {
          frequency: scheduleFrequency,
          day: scheduleDay,
          time: scheduleTime,
          recipients: scheduleRecipients.split(',').map(email => email.trim()).filter(email => email)
        } : null,
        generatedAt: new Date().toISOString(),
        summary: {
          totalImpressions,
          totalClicks,
          totalConversions,
          totalSpend,
          ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00",
          cpa: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00"
        }
      };

      if (enableScheduling) {
        // Save scheduled report to storage
        const savedReport = reportStorage.addReport({
          name: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Scheduled Report" : 
            customReportName,
          type: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Custom" : 
            "Custom",
          status: 'Scheduled',
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          generatedAt: new Date(),
          format: reportFormat.toUpperCase(),
          includeKPIs,
          includeBenchmarks,
          schedule: {
            frequency: scheduleFrequency,
            day: scheduleDay,
            time: scheduleTime,
            recipients: reportData.schedule?.recipients || []
          }
        });
        
        console.log('Scheduled report saved:', savedReport);
        
        // Trigger custom event to refresh Reports page if it's open
        window.dispatchEvent(new CustomEvent('reportAdded'));
        
        alert(`Report scheduled successfully! Reports will be generated ${scheduleFrequency} and sent to ${reportData.schedule?.recipients.length} recipient(s). View all reports in the Reports section.`);
      } else {
        // Save generated report to storage
        const savedReport = reportStorage.addReport({
          name: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Campaign Report" : 
            customReportName,
          type: reportType === "standard" ? 
            STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name || "Custom" : 
            "Custom",
          status: 'Generated',
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          generatedAt: new Date(),
          format: reportFormat.toUpperCase(),
          size: reportFormat === "csv" ? "~15KB" : reportFormat === "xlsx" ? "~25KB" : "~45KB",
          includeKPIs,
          includeBenchmarks
        });
        
        // Download the report immediately
        downloadReport(reportData, reportFormat);
        
        console.log('Generated report saved:', savedReport);
        
        // Trigger custom event to refresh Reports page if it's open
        window.dispatchEvent(new CustomEvent('reportAdded'));
      }
      setShowReportDialog(false);
      
    } catch (error) {
      console.error("Failed to generate report:", error);
    }
  };

  const downloadReport = (data: any, formatType: string) => {
    let content = "";
    let mimeType = "";
    let fileName = `${campaign?.name || 'Campaign'}_Report_${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === "csv") {
      // Generate CSV content
      let csvContent = "";
      
      // Platform data
      const csvHeaders = ["Platform", "Impressions", "Clicks", "Conversions", "Spend", "CTR", "CPC"];
      const csvRows = connectedPlatforms.map(p => [
        p.platform,
        p.impressions,
        p.clicks,
        p.conversions,
        p.spend,
        p.ctr,
        p.cpc
      ]);
      csvContent = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n");
      
      // Add KPI data if included
      if (includeKPIs && campaignKPIs && campaignKPIs.length > 0) {
        csvContent += "\n\nKPI Data\n";
        csvContent += "KPI Name,Current Value,Target Value,Progress %,Status,Priority\n";
        campaignKPIs.forEach((kpi: any) => {
          const progress = kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
          csvContent += `${kpi.name || ''},${kpi.currentValue || ''},${kpi.targetValue || ''},${progress},${kpi.status || 'Active'},${kpi.priority || 'Medium'}\n`;
        });
      }

      // Add benchmark data if included
      if (includeBenchmarks && data.benchmarks && data.benchmarks.length > 0) {
        csvContent += "\n\nBenchmark Data\n";
        csvContent += "Benchmark Name,Current Value,Target Value,Status,Category,Industry\n";
        data.benchmarks.forEach((benchmark: any) => {
          csvContent += `${benchmark.name},${benchmark.currentValue},${benchmark.targetValue},${benchmark.status},${benchmark.category},${benchmark.industry}\n`;
        });
      }
      
      content = csvContent;
      mimeType = "text/csv";
      fileName += ".csv";
    } else if (formatType === "xlsx") {
      // For XLSX, we'll generate JSON for now (in real app, use a proper XLSX library)
      const reportData = {
        ...data,
        kpiData: includeKPIs && campaignKPIs ? campaignKPIs.map((kpi: any) => ({
          name: kpi.name,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
          progress: kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) + '%' : 'N/A',
          status: kpi.status || 'Active',
          priority: kpi.priority || 'Medium'
        })) : [],
        benchmarkData: includeBenchmarks && data.benchmarks ? data.benchmarks.map((benchmark: any) => ({
          name: benchmark.name,
          currentValue: benchmark.currentValue,
          targetValue: benchmark.targetValue,
          status: benchmark.status,
          category: benchmark.category,
          industry: benchmark.industry
        })) : []
      };
      content = "Campaign Report\n\n" + JSON.stringify(reportData, null, 2);
      mimeType = "application/json";
      fileName += ".json";
    } else {
      // PDF - generate as text for now (in real app, use a PDF library)
      content = `Campaign Report: ${campaign?.name}\n\n`;
      content += `Generated: ${format(new Date(), 'PPP')}\n\n`;
      content += `Summary:\n`;
      content += `Total Impressions: ${formatNumber(totalImpressions)}\n`;
      content += `Total Clicks: ${formatNumber(totalClicks)}\n`;
      content += `Total Conversions: ${formatNumber(totalConversions)}\n`;
      content += `Total Spend: ${formatCurrency(totalSpend.toString())}\n\n`;
      content += `Platform Breakdown:\n`;
      connectedPlatforms.forEach(p => {
        content += `${p.platform}: ${formatNumber(p.impressions)} impressions, ${formatNumber(p.clicks)} clicks, ${formatCurrency(p.spend)} spend\n`;
      });

      // Add KPI data if included
      if (includeKPIs && campaignKPIs && campaignKPIs.length > 0) {
        content += `\n\nCampaign KPIs:\n`;
        campaignKPIs.forEach((kpi: any) => {
          const progress = kpi.currentValue && kpi.targetValue ? 
            ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
          content += `${kpi.name}: ${kpi.currentValue || 'N/A'} / ${kpi.targetValue} (${progress}% complete)\n`;
          content += `  Status: ${kpi.status || 'Active'} | Priority: ${kpi.priority || 'Medium'}\n`;
          if (kpi.description) content += `  Description: ${kpi.description}\n`;
          content += `\n`;
        });
      }

      // Add benchmark data if included
      if (includeBenchmarks && data.benchmarks && data.benchmarks.length > 0) {
        content += `\n\nCampaign Benchmarks:\n`;
        data.benchmarks.forEach((benchmark: any) => {
          content += `${benchmark.name}: ${benchmark.currentValue} vs ${benchmark.targetValue} target\n`;
          content += `  Status: ${benchmark.status} | Category: ${benchmark.category} | Industry: ${benchmark.industry}\n`;
          content += `\n`;
        });
      }

      mimeType = "text/plain";
      fileName += ".txt";
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetReportForm = () => {
    setReportType("standard");
    setSelectedTemplate("");
    setCustomReportName("");
    setReportDescription("");
    setReportMetrics(["impressions", "clicks", "conversions", "spend"]);
    setReportDateRange("30d");
    setReportFormat("pdf");
    setIncludeKPIs(false);
    setIncludeBenchmarks(false);
    setEnableScheduling(false);
    setScheduleFrequency("weekly");
    setScheduleDay("monday");
    setScheduleTime("09:00");
    setScheduleRecipients("");
  };

  const handleMetricToggle = (metricId: string) => {
    setReportMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const handleSectionTabToggle = (sectionId: string, tabName: string) => {
    setSelectedSections(prev => {
      const currentTabs = prev[sectionId] || [];
      const newTabs = currentTabs.includes(tabName)
        ? currentTabs.filter(tab => tab !== tabName)
        : [...currentTabs, tabName];
      return { ...prev, [sectionId]: newTabs };
    });
  };

  // Performance Summary - Executive Snapshot
  const renderPerformanceSummary = () => {
    // Helper to safely parse numbers
    const parseNum = (val: any): number => {
      const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
      return isNaN(num) ? 0 : num;
    };

    const liMetrics = linkedinMetrics || {};
    const ciMetrics = customIntegration?.metrics || {};

    // Aggregate metrics from all sources
    const totalImpressions = parseNum(liMetrics.impressions) + parseNum(ciMetrics.pageviews);
    const totalClicks = parseNum(liMetrics.clicks);
    const totalConversions = parseNum(liMetrics.conversions);
    const totalSpend = parseNum(liMetrics.spend);
    const totalEngagements = parseNum(liMetrics.engagements) + parseNum(ciMetrics.sessions);

    // Calculate performance metrics
    const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
    const costPerConversion = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

    // Calculate campaign health status
    const getHealthStatus = () => {
      let score = 0;
      const totalKPIs = kpis.length;
      
      if (totalKPIs > 0) {
        const aboveTarget = kpis.filter(k => {
          const current = parseFloat(k.currentValue) || 0;
          const target = parseFloat(k.targetValue) || 1;
          return (current / target) >= 1;
        }).length;
        score = (aboveTarget / totalKPIs) * 100;
      }

      if (score >= 80) return { status: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-950', icon: CheckCircle2 };
      if (score >= 60) return { status: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-950', icon: TrendingUp };
      if (score >= 40) return { status: 'Needs Attention', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-950', icon: Clock };
      return { status: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-950', icon: AlertCircle };
    };

    const healthStatus = getHealthStatus();
    const HealthIcon = healthStatus.icon;

    // localStorage-based "What's Changed" comparison
    const getChanges = () => {
      const storageKey = `campaign_${campaign.id}_last_snapshot`;
      const lastSnapshot = localStorage.getItem(storageKey);
      
      const currentSnapshot = {
        conversions: totalConversions,
        ctr: parseFloat(overallCTR),
        timestamp: Date.now(),
      };

      // Store current snapshot
      localStorage.setItem(storageKey, JSON.stringify(currentSnapshot));

      if (!lastSnapshot) {
        return {
          conversionsChange: 0,
          ctrChange: 0,
          timeSinceCheck: 'first visit',
        };
      }

      const previous = JSON.parse(lastSnapshot);
      const hoursSinceCheck = Math.floor((currentSnapshot.timestamp - previous.timestamp) / (1000 * 60 * 60));
      
      return {
        conversionsChange: currentSnapshot.conversions - previous.conversions,
        ctrChange: currentSnapshot.ctr - previous.ctr,
        timeSinceCheck: hoursSinceCheck < 1 ? 'less than an hour' : `${hoursSinceCheck} hour${hoursSinceCheck > 1 ? 's' : ''} ago`,
      };
    };

    const changes = getChanges();

    // Generate priority action
    const getPriorityAction = () => {
      // Check if any KPIs are critically below target
      const criticalKPIs = kpis.filter(k => {
        const current = parseFloat(k.currentValue) || 0;
        const target = parseFloat(k.targetValue) || 1;
        return (current / target) < 0.7; // Less than 70%
      });

      if (criticalKPIs.length > 0) {
        const kpi = criticalKPIs[0];
        const metricName = kpi.metric || kpi.name;
        const percentage = ((parseFloat(kpi.currentValue) / parseFloat(kpi.targetValue)) * 100).toFixed(0);
        return {
          message: `Review ${metricName} - currently at ${percentage}% of target (KPI: ${kpi.name})`,
          type: 'warning',
        };
      }

      // Check benchmarks
      const belowBenchmarks = benchmarks.filter(b => {
        const current = parseFloat(b.currentValue) || 0;
        const benchmark = parseFloat(b.benchmarkValue) || 1;
        return current < benchmark;
      });

      if (belowBenchmarks.length > 0) {
        const benchmark = belowBenchmarks[0];
        const metricName = benchmark.metric || benchmark.name;
        const improvement = ((parseFloat(benchmark.benchmarkValue) - parseFloat(benchmark.currentValue)) / parseFloat(benchmark.benchmarkValue) * 100).toFixed(0);
        return {
          message: `${metricName} is ${improvement}% below benchmark target (Benchmark: ${benchmark.name})`,
          type: 'attention',
        };
      }

      // Everything is on track
      return {
        message: 'On track to exceed goals - maintain current strategy',
        type: 'success',
      };
    };

    const priorityAction = getPriorityAction();

    return (
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span>Performance Summary</span>
            <Badge variant="outline" className="ml-auto">Executive Snapshot</Badge>
          </CardTitle>
          <CardDescription>
            Quick health check and key insights at a glance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Campaign Health Status */}
          <div className={`p-4 rounded-lg ${healthStatus.bgColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <HealthIcon className={`w-8 h-8 ${healthStatus.color}`} />
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Campaign Health</div>
                  <div className={`text-2xl font-bold ${healthStatus.color}`}>{healthStatus.status}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400">KPIs on Track</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {kpis.filter(k => (parseFloat(k.currentValue) / parseFloat(k.targetValue)) >= 1).length} / {kpis.length}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Snapshot & What's Changed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Performance Snapshot */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Performance Snapshot</span>
              </h4>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Impressions:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{totalImpressions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Engagements:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{totalEngagements.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Conversions:</span>
                  <span className="font-semibold text-green-600">{totalConversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-slate-600 dark:text-slate-400">Total Spend:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">${totalSpend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Cost/Conv:</span>
                  <span className="font-semibold text-blue-600">${costPerConversion}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">All sources combined (LinkedIn + Custom Integration)</p>
            </div>

            {/* What's Changed */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>What's Changed</span>
              </h4>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Since last check ({changes.timeSinceCheck})</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Conversions:</span>
                      <span className={`text-sm font-semibold ${changes.conversionsChange > 0 ? 'text-green-600' : changes.conversionsChange < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {changes.conversionsChange > 0 ? '+' : ''}{changes.conversionsChange}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">CTR Change:</span>
                      <span className={`text-sm font-semibold ${changes.ctrChange > 0 ? 'text-green-600' : changes.ctrChange < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {changes.ctrChange > 0 ? '+' : ''}{changes.ctrChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Alerts</div>
                  <div className="text-sm">
                    <span className="text-red-600 font-semibold">
                      {kpis.filter(k => (parseFloat(k.currentValue) / parseFloat(k.targetValue)) < 1).length}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400"> KPIs below target</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-green-600 font-semibold">
                      {benchmarks.filter(b => parseFloat(b.currentValue) >= parseFloat(b.benchmarkValue)).length}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400"> benchmarks exceeded</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Priority Action & Data Sources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Top Priority Action */}
            <div className={`p-4 rounded-lg border-2 ${
              priorityAction.type === 'success' ? 'border-green-300 bg-green-50 dark:bg-green-950' :
              priorityAction.type === 'warning' ? 'border-red-300 bg-red-50 dark:bg-red-950' :
              'border-yellow-300 bg-yellow-50 dark:bg-yellow-950'
            }`}>
              <div className="flex items-start space-x-3">
                {priorityAction.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />}
                {priorityAction.type === 'warning' && <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                {priorityAction.type === 'attention' && <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                    Top Priority Action
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {priorityAction.message}
                  </div>
                </div>
              </div>
            </div>

            {/* Data Sources Status */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-3">
                Data Sources
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-slate-900 dark:text-white">LinkedIn Ads</span>
                  </span>
                  <span className="text-xs text-slate-500">Connected</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-slate-900 dark:text-white">Custom Integration</span>
                  </span>
                  <span className="text-xs text-slate-500">Connected</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    <span className="text-slate-500">Google Analytics</span>
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">Connect</Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    <span className="text-slate-500">Shopify</span>
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">Connect</Button>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href="/campaigns">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaigns
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
                  <div className="flex items-center space-x-3 mt-2">
                    {getStatusBadge(campaign.status)}
                    {campaign.label && (
                      <Badge variant="outline">{campaign.label}</Badge>
                    )}
                    {campaign.budget && (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Budget: {formatCurrency(campaign.budget)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetReportForm}>
                      <Download className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">Generate Campaign Report</DialogTitle>
                      <DialogDescription>
                        Create professional reports with standard templates or build custom reports tailored to your needs
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* Report Type Selection */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Report Type</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Card 
                            className={`cursor-pointer transition-all ${reportType === "standard" ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                            onClick={() => setReportType("standard")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-primary" />
                                <div>
                                  <h3 className="font-semibold">Standard Templates</h3>
                                  <p className="text-sm text-muted-foreground">Pre-built professional report templates</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          <Card 
                            className={`cursor-pointer transition-all ${reportType === "custom" ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                            onClick={() => setReportType("custom")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <Settings className="w-5 h-5 text-primary" />
                                <div>
                                  <h3 className="font-semibold">Custom Report</h3>
                                  <p className="text-sm text-muted-foreground">Build your own customized report</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Standard Template Selection */}
                      {reportType === "standard" && (
                        <div className="space-y-4">
                          <Label className="text-base font-medium">Choose Template</Label>
                          <div className="grid gap-3">
                            {STANDARD_TEMPLATES.map((template) => (
                              <Card 
                                key={template.id}
                                className={`cursor-pointer transition-all ${selectedTemplate === template.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                                onClick={() => setSelectedTemplate(template.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start space-x-3">
                                    <div className="mt-1">{template.icon}</div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">{template.name}</h3>
                                        {selectedTemplate === template.id && (
                                          <CheckCircle2 className="w-5 h-5 text-primary" />
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {template.sections.map((section) => (
                                          <Badge key={section} variant="secondary" className="text-xs">
                                            {section.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Report Builder */}
                      {reportType === "custom" && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="reportName">Report Name *</Label>
                              <Input
                                id="reportName"
                                placeholder="My Custom Report"
                                value={customReportName}
                                onChange={(e) => setCustomReportName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="reportDesc">Description</Label>
                              <Input
                                id="reportDesc"
                                placeholder="Brief description of the report"
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Select Sections</Label>
                            <Accordion type="multiple" className="w-full">
                              {STANDARD_TEMPLATES.map((template) => (
                                <AccordionItem key={template.id} value={template.id}>
                                  <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center space-x-3">
                                      {template.icon}
                                      <span className="font-medium">{template.name}</span>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-2 pt-2">
                                      {template.sections.map((section) => (
                                        <div key={section} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                          <Checkbox
                                            id={`${template.id}-${section}`}
                                            checked={(selectedSections[template.id] || []).includes(section)}
                                            onCheckedChange={() => handleSectionTabToggle(template.id, section)}
                                          />
                                          <Label 
                                            htmlFor={`${template.id}-${section}`} 
                                            className="text-sm cursor-pointer flex-1"
                                          >
                                            {section}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </div>
                        </div>
                      )}

                      {/* Scheduling Options */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center space-x-2 mb-3">
                          <Checkbox 
                            id="enable-scheduling" 
                            checked={enableScheduling}
                            onCheckedChange={(checked) => setEnableScheduling(checked as boolean)}
                          />
                          <Label htmlFor="enable-scheduling" className="text-base font-medium">
                            Schedule Automatic Reports
                          </Label>
                        </div>
                        
                        {enableScheduling && (
                          <div className="ml-6 space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
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
                                      <SelectItem value="saturday">Saturday</SelectItem>
                                      <SelectItem value="sunday">Sunday</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              {scheduleFrequency === "monthly" && (
                                <div className="space-y-2">
                                  <Label>Day of Month</Label>
                                  <Select value={scheduleDay} onValueChange={setScheduleDay}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">1st</SelectItem>
                                      <SelectItem value="15">15th</SelectItem>
                                      <SelectItem value="last">Last day</SelectItem>
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
                                value={scheduleRecipients}
                                onChange={(e) => setScheduleRecipients(e.target.value)}
                              />
                              <div className="text-xs text-muted-foreground">
                                Reports will be automatically generated and sent to these email addresses
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Preview Section */}
                      {((reportType === "standard" && selectedTemplate) || (reportType === "custom" && customReportName)) && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center space-x-2 mb-3">
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Report Preview</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Name:</span> {reportType === "standard" ? STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name : customReportName}</div>
                            <div><span className="font-medium">Type:</span> {reportType === "standard" ? "Standard Template" : "Custom Report"}</div>
                            <div><span className="font-medium">Metrics:</span> {reportType === "standard" ? STANDARD_TEMPLATES.find(t => t.id === selectedTemplate)?.metrics.length : reportMetrics.length} included</div>
                            <div><span className="font-medium">Platforms:</span> {connectedPlatforms.map(p => p.platform).join(", ") || "None"}</div>
                            <div><span className="font-medium">KPIs:</span> {includeKPIs ? `${campaignKPIs?.length || 0} KPIs included` : "Not included"}</div>
                            <div><span className="font-medium">Benchmarks:</span> {includeBenchmarks ? "Industry benchmarks included" : "Not included"}</div>
                            <div><span className="font-medium">Date Range:</span> {reportDateRange}</div>
                            <div><span className="font-medium">Format:</span> {reportFormat.toUpperCase()}</div>
                            {enableScheduling && (
                              <div className="pt-2 border-t text-primary">
                                <div><span className="font-medium">Schedule:</span> {scheduleFrequency.charAt(0).toUpperCase() + scheduleFrequency.slice(1)} at {scheduleTime}</div>
                                {scheduleRecipients && (
                                  <div><span className="font-medium">Recipients:</span> {scheduleRecipients.split(',').length} email(s)</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                          Cancel
                        </Button>
                        <div className="flex items-center space-x-3">
                          <Button variant="outline" onClick={resetReportForm}>
                            Reset
                          </Button>
                          <Button 
                            onClick={generateReport}
                            disabled={
                              (reportType === "standard" && !selectedTemplate) || 
                              (reportType === "custom" && !customReportName) ||
                              connectedPlatforms.length === 0 ||
                              (enableScheduling && !scheduleRecipients.trim())
                            }
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {enableScheduling ? "Schedule Report" : "Generate & Download Report"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue={(() => { try { const h = window.location.hash.replace('#', ''); return ['overview','kpis','benchmarks','reports','insights','data-sources','webhooks'].includes(h) ? h : 'overview'; } catch { return 'overview'; } })()} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">

              {/* Campaign DeepDive */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Campaign DeepDive</span>
                  </CardTitle>
                  <CardDescription>
                    Unlock in-depth marketing analyses for key insights and tailored recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href={`/campaigns/${campaign.id}/performance`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <BarChart3 className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Performance Summary</div>
                          <div className="text-xs text-muted-foreground">Comprehensive overview & insights</div>
                        </div>
                      </Button>
                    </Link>
                    
                    <Link href={`/campaigns/${campaign.id}/financial-analysis`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <DollarSign className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Budget & Financial Analysis</div>
                          <div className="text-xs text-muted-foreground">ROI, ROAS, budget allocation & costs</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/platform-comparison`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <GitCompare className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Platform Comparison</div>
                          <div className="text-xs text-muted-foreground">Compare platform performance & insights</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/trend-analysis`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <TrendingUp className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Trend Analysis</div>
                          <div className="text-xs text-muted-foreground">Industry trend comparison & insights</div>
                        </div>
                      </Button>
                    </Link>

                    <Link href={`/campaigns/${campaign.id}/executive-summary`}>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-start space-x-3 h-auto p-4 w-full"
                      >
                        <Briefcase className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Executive Summary</div>
                          <div className="text-xs text-muted-foreground">Strategic overview for leadership</div>
                        </div>
                      </Button>
                    </Link>
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-start space-x-3 h-auto p-4"
                      onClick={() => {
                        setReportType("custom");
                        setShowReportDialog(true);
                      }}
                    >
                      <Settings className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Custom Report</div>
                        <div className="text-xs text-muted-foreground">Build your own</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Connected Platforms */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Connected Platforms</h2>
                  <p className="text-slate-600 dark:text-slate-400">Platform performance and connection status</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 items-start">
              {platformMetrics.map((platform, index) => (
                <Card 
                  key={platform.platform} 
                  className={`${platform.connected ? "border-green-200 dark:border-green-800" : "border-slate-200 dark:border-slate-700"} ${
                    // Position Facebook Ads with minimal single-line gap under Google Analytics
                    platform.platform === "Facebook Ads" ? "md:-mt-3" : ""
                  }`}
                >
                  {/* Platform Header - Always Visible */}
                  <div 
                    className={`flex items-center justify-between p-3 ${(!platform.connected || platform.requiresImport) ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors' : ''}`}
                    onClick={() => {
                      if (!platform.connected || platform.requiresImport) {
                        setExpandedPlatform(expandedPlatform === platform.platform ? null : platform.platform);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {getPlatformIcon(platform.platform)}
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{platform.platform}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {platform.requiresImport ? "Connected — import required" : (platform.connected ? "Connected & syncing data" : "Not connected")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={(platform.connected || platform.requiresImport) ? "default" : "secondary"}
                        className={platform.requiresImport ? "bg-amber-600 text-white hover:bg-amber-700" : (platform.connected ? "bg-blue-600 text-white hover:bg-blue-700" : "")}
                      >
                        {platform.requiresImport ? "Import Required" : (platform.connected ? "Connected" : "Not Connected")}
                      </Badge>
                      {(!platform.connected || platform.requiresImport) && (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedPlatform === platform.platform ? 'rotate-180' : ''}`} />
                      )}
                      {platform.connected && !platform.requiresImport && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Disconnect ${platform.platform}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDisconnectConfirm({ platform: platform.platform, platformLabel: platform.platform });
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Connected Platform Metrics - Only show when platform is connected and statuses are ready (prevents load flash) */}
                  {connectedPlatformsReady && platform.connected && (
                    <div className="px-3 pb-3">
                      <div className="space-y-4">
                        {/* LinkedIn Import Required Warning */}
                        {platform.platform === "LinkedIn Ads" && platform.requiresImport && (
                          <div className="pt-2 border-t">
                            <div className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-800 dark:text-amber-200">Import required</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                  Finish selecting the LinkedIn campaigns and metrics to import so analytics can load data.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                  onClick={() => setExpandedPlatform("LinkedIn Ads")}
                                  data-testid="button-import-linkedin-from-campaign-detail"
                                >
                                  Import LinkedIn data
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Google Sheets Connection Expired Warning */}
                        {platform.platform === "Google Sheets" && sheetsError && (sheetsError as any).requiresReauthorization && (
                          <div className="pt-2 border-t">
                            <div className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-800 dark:text-amber-200">Connection Expired</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                  Your Google Sheets connection has expired. Please reconnect to continue syncing data.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                  onClick={() => {
                                    setExpandedPlatform("Google Sheets");
                                  }}
                                >
                                  Reconnect Google Sheets
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* View Detailed Analytics Button - avoid initial load flash */}
                        {!connectedPlatformsLoading && platform.platform === "Google Sheets" && platform.connected && (
                          <div className="pt-2 border-t">
                            <Link href={platform.analyticsPath || `/campaigns/${campaignId}/google-sheets-data`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                data-testid="button-view-google-sheets-analytics"
                              >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                                </div>
                              )}
                              
                        {/* View Detailed Analytics for other platforms */}
                        {!connectedPlatformsLoading && platform.analyticsPath && platform.platform !== "Google Sheets" && (
                          <div className="pt-2">
                            <Link href={platform.analyticsPath}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                data-testid={`button-view-${platform.platform.toLowerCase().replace(/\s+/g, '-')}-analytics`}
                              >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Detailed Analytics
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Connection Setup Dropdown - Show when expanded and (not connected OR adding additional sheet) */}
                  {expandedPlatform === platform.platform && (!platform.connected || platform.requiresImport || (platform.platform === "Google Sheets" && canAddMoreSheets)) && (
                    <div className="border-t bg-slate-50 dark:bg-slate-800/50 p-3">
                      {platform.platform === "Google Analytics" ? (
                        <GA4ConnectionFlow 
                          campaignId={campaign.id} 
                          onConnectionSuccess={() => {
                            setExpandedPlatform(null);
                            window.location.reload();
                          }}
                        />
                      ) : platform.platform === "Google Sheets" ? (
                        <>
                          {!canAddMoreSheets && (
                            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    Connection Limit Reached
                                  </p>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    You have reached the maximum limit of {MAX_GOOGLE_SHEETS_CONNECTIONS} Google Sheets connections per campaign. Please remove an existing connection to add a new one.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <SimpleGoogleSheetsAuth 
                            campaignId={campaign.id} 
                            onSuccess={() => {
                              setExpandedPlatform(null);
                              refetchGoogleSheetsConnections();
                              queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });


                              toastHook({
                                title: "Google Sheet Connected",
                                description: "The Google Sheet has been connected successfully.",
                              });
                            }}
                            onError={(error) => {
                              console.error("Google Sheets connection error:", error);
                              toastHook({
                                title: "Connection Failed",
                                description: error || "Failed to connect Google Sheet",
                                variant: "destructive"
                              });
                            }}
                          />
                        </>
                      ) : platform.platform === "LinkedIn Ads" ? (
                        <LinkedInConnectionFlow 
                          campaignId={campaign.id} 
                          onConnectionSuccess={() => {
                            setExpandedPlatform(null);
                            // Invalidate queries to refresh connection status
                            queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });
                            queryClientHook.invalidateQueries({ queryKey: ["/api/linkedin/check-connection", campaignId] });
                            // Small delay to ensure queries are invalidated before reload
                            setTimeout(() => {
                            window.location.reload();
                            }, 100);
                          }}
                        />
                      ) : platform.platform === "Facebook Ads" ? (
                        <SimpleMetaAuth
                          campaignId={campaign.id}
                          onSuccess={() => {
                            setExpandedPlatform(null);
                            window.location.reload();
                          }}
                          onError={(error) => {
                            console.error("Meta connection error:", error);
                          }}
                        />
                      ) : platform.platform === "Custom Integration" ? (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Import metrics from PDF reports via manual upload or email forwarding.
                          </p>
                          <div className="space-y-3">
                            <button
                              onClick={async () => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf';
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  
                                  try {
                                    const formData = new FormData();
                                    formData.append('pdf', file);
                                    
                                    const response = await fetch(`/api/custom-integration/${campaign.id}/upload-pdf`, {
                                      method: 'POST',
                                      body: formData
                                    });
                                    
                                    if (response.ok) {
                                      setExpandedPlatform(null);
                                      window.location.reload();
                                    }
                                  } catch (error) {
                                    console.error('PDF upload error:', error);
                                  }
                                };
                                input.click();
                              }}
                              className="w-full bg-white dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors text-left"
                            >
                              <div className="font-medium text-slate-900 dark:text-white mb-1">
                                Manual Upload
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Upload a PDF report to extract metrics
                              </div>
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/custom-integration/${campaign.id}/connect`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ allowedEmailAddresses: [] })
                                  });
                                  
                                  if (response.ok) {
                                    setExpandedPlatform(null);
                                    window.location.reload();
                                  }
                                } catch (error) {
                                  console.error('Email forwarding setup error:', error);
                                }
                              }}
                              className="w-full bg-white dark:bg-slate-800 rounded-lg p-3 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors text-left"
                            >
                              <div className="font-medium text-slate-900 dark:text-white mb-1">
                                Email Forwarding
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Get a unique email address for automatic imports
                              </div>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="text-slate-600 dark:text-slate-400 mb-3">
                            {platform.platform} integration coming soon
                          </div>
                          <Button variant="outline" size="sm" disabled>
                            Connect Platform
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
                ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kpis" className="space-y-6">
              <CampaignKPIs campaign={campaign} />
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6">
              <CampaignBenchmarks campaign={campaign} />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <ScheduledReportsSection campaignId={campaign.id} />
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <CampaignInsights campaign={campaign} />
            </TabsContent>

            <TabsContent value="data-sources" className="space-y-6">
              {campaign && (
                <DataSourcesTab
                  campaignId={campaign.id}
                  campaign={campaign}
                  connectedPlatformStatuses={connectedPlatformStatuses}
                  onDisconnectPlatform={(key, label) => {
                    // Map DataSourcesTab platform keys to the platform names used by disconnect handler
                    const platformNameMap: Record<string, string> = {
                      linkedin: 'LinkedIn Ads',
                      meta: 'Facebook Ads',
                      ga4: 'Google Analytics',
                    };
                    setDisconnectConfirm({ platform: platformNameMap[key] || key, platformLabel: label });
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              {campaign && (
                <WebhookTester campaignId={campaign.id} campaignName={campaign.name} />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Column Mapping Interface Dialog */}
      <Dialog open={showMappingInterface} onOpenChange={setShowMappingInterface}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Map Columns</DialogTitle>
            <DialogDescription>
              Follow the guided steps to map your campaign identifier, revenue column, and optional platform filter.
            </DialogDescription>
          </DialogHeader>
          {showMappingInterface && campaign && (() => {
            const platform = campaign.platform || 'linkedin';
            const spreadsheetId = mappingSpreadsheetId || undefined;
            const connectionId = mappingConnectionId || undefined;

            if (platform === 'linkedin' && spreadsheetId && connectionId) {
              return (
                <GuidedColumnMapping
                  campaignId={campaign.id}
                  connectionId={connectionId}
                  spreadsheetId={spreadsheetId}
                  platform={platform}
                  onMappingComplete={() => {
                    setShowMappingInterface(false);
                    setMappingConnectionId(null);
                    setMappingSpreadsheetId(null);
                    refetchGoogleSheetsConnections();
                    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
                  }}
                  onCancel={() => {
                    setShowMappingInterface(false);
                    setMappingConnectionId(null);
                    setMappingSpreadsheetId(null);
                  }}
                />
              );
            }

            return (
              <ColumnMappingInterface
                campaignId={campaign.id}
                connectionId={connectionId}
                spreadsheetId={spreadsheetId}
                platform={platform}
                onMappingComplete={() => {
                  setShowMappingInterface(false);
                  setMappingConnectionId(null);
                  setMappingSpreadsheetId(null);
                  refetchGoogleSheetsConnections();
                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "google-sheets-data"] });
                  // If user wants to connect another sheet, expand Google Sheets section
                  // This will be handled by the completion dialog in ColumnMappingInterface
                }}
                onCancel={() => {
                  setShowMappingInterface(false);
                  setMappingConnectionId(null);
                  setMappingSpreadsheetId(null);
                }}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Platform Disconnect Confirmation */}
      <AlertDialog open={!!disconnectConfirm} onOpenChange={(open) => !open && setDisconnectConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnectConfirm?.platformLabel}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">This will remove the {disconnectConfirm?.platformLabel} connection from this campaign. The following will be affected:</span>
              <span className="block text-sm">
                • Platform metrics will no longer be available<br />
                • Analytics tab for this platform will be inaccessible<br />
                • Revenue sources linked to this platform will need to be re-assigned<br />
                • KPIs and Benchmarks using this platform's data may show as blocked
              </span>
              <span className="block font-medium text-red-600 dark:text-red-400">This action cannot be easily undone — you will need to re-authenticate to reconnect.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectPlatform}
              className="bg-red-600 hover:bg-red-700"
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

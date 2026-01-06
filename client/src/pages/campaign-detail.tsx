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
import { ABTestManager } from "@/components/ABTestManager";
import { WebhookTester } from "@/components/WebhookTester";
import { AttributionDashboard } from "@/components/AttributionDashboard";

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
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  ctr: string;
  cpc: string;
  analyticsPath?: string | null;
}

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
  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpi-reports`],
    enabled: !!campaignId,
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest('DELETE', `/api/campaigns/${campaignId}/kpi-reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpi-reports`] });
      toast({
        title: "Report Deleted",
        description: "Scheduled report has been removed.",
      });
    },
  });

  const formatScheduleDetails = (report: any) => {
    const parts = [];
    
    // Frequency
    if (report.scheduleFrequency) {
      parts.push(report.scheduleFrequency.charAt(0).toUpperCase() + report.scheduleFrequency.slice(1));
    }
    
    // Day of week for weekly
    if (report.scheduleFrequency === 'weekly' && report.scheduleDayOfWeek !== null) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      parts.push(`on ${days[report.scheduleDayOfWeek]}`);
    }
    
    // Day of month for monthly/quarterly
    if ((report.scheduleFrequency === 'monthly' || report.scheduleFrequency === 'quarterly') && report.scheduleDayOfMonth) {
      parts.push(`on day ${report.scheduleDayOfMonth}`);
    }
    
    // Time
    if (report.scheduleTime) {
      parts.push(`at ${report.scheduleTime}`);
    }
    
    return parts.join(' ');
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

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Scheduled Reports Created
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Schedule automated reports to have them delivered to your inbox on a regular basis.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Scheduled reports will appear here once created.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Scheduled Reports
      </h3>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteReportMutation.mutate(report.id)}
                data-testid={`button-delete-report-${report.id}`}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
    if (metric === 'conversion-rate') {
      const def = cfg.definition;
      if (def === 'website') {
        const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
        const sessions = sumSelected('sessions', cfg.inputs?.sessions || []);
        const rate = sessions > 0 ? (conv / sessions) * 100 : 0;
        return { value: rate, unit: '%' };
      }
      if (def === 'click') {
        const conv = sumSelected('conversions', cfg.inputs?.conversions || []);
        const clicks = sumSelected('clicks', cfg.inputs?.clicks || []);
        const rate = clicks > 0 ? (conv / clicks) * 100 : 0;
        return { value: rate, unit: '%' };
      }
      return { value: null, unit: '%' };
    }

    // Derived efficiency metrics (blended)
    if (metric === 'roas') {
      const revenue = sumSelected('revenue', cfg.inputs?.revenue || []);
      const spend = sumSelected('spend', cfg.inputs?.spend || []);
      const roas = spend > 0 ? revenue / spend : 0;
      return { value: roas, unit: 'x' };
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
    if (m === 'conversion-rate') return ['conversions']; // definition picks denominator inputs
    if (m === 'roi' || m === 'roas') return ['revenue', 'spend'];
    if (m === 'cpa') return ['spend', 'conversions'];
    if (m === 'cpl') return ['spend', 'leads'];
    return [];
  };

  const getMetricDisplayUnit = (metric: string): string => {
    const m = String(metric || '');
    if (m === 'revenue' || m === 'spend' || m === 'cpa' || m === 'cpl') return '$';
    if (m === 'roi' || m === 'ctr' || m === 'conversion-rate') return '%';
    if (m === 'roas') return 'x';
    return '';
  };

  const isTileMetric = (metric: string): boolean => {
    return [
      'revenue',
      'roas',
      'roi',
      'spend',
      'conversions',
      'conversion-rate',
      'cpa',
      'leads',
      'cpl',
      'users',
      'sessions',
      'ctr',
    ].includes(String(metric || ''));
  };

  const getTileDisabledReason = (metric: string): string | null => {
    const m = String(metric || '');
    const required = getRequiredInputsForMetric(m);
    if (!required.length) return null;

    // Conversion rate requires conversions + (sessions OR clicks) depending on definition selected later.
    if (m === 'conversion-rate') {
      const hasConv = getInputOptions('conversions').some(o => o.enabled);
      const hasSessions = getInputOptions('sessions').some(o => o.enabled);
      const hasClicks = getInputOptions('clicks').some(o => o.enabled);
      return hasConv && (hasSessions || hasClicks) ? null : 'Required inputs not connected';
    }

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
    if (metric === 'conversion-rate') {
      const type = cfg.definition === 'website' ? 'Website' : cfg.definition === 'click' ? 'Click' : '';
      if (type) parts.push(`${type} CR`);
      push('Conv', cfg.inputs.conversions);
      if (cfg.definition === 'website') push('Sessions', cfg.inputs.sessions);
      if (cfg.definition === 'click') push('Clicks', cfg.inputs.clicks);
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
    if (u === '$') return `$${formatNumber(value)}`;
    if (u === '%') return `${formatNumber(value)}%`;
    if (u === 'x') return `${formatNumber(value)}x`;
    return formatNumber(value);
  };

  const isConfigCompleteForMetric = (metric: string, rawConfig: any): boolean => {
    if (!isTileMetric(metric)) return true;
    const cfg = normalizeCalcConfig(rawConfig);
    if (!cfg) return false;
    const m = String(metric || '');
    if (m === 'conversion-rate') {
      if (!cfg.definition) return false;
      const convOk = (cfg.inputs?.conversions || []).length > 0;
      const denomOk = cfg.definition === 'website' ? (cfg.inputs?.sessions || []).length > 0 : (cfg.inputs?.clicks || []).length > 0;
      return convOk && denomOk;
    }
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
    return m === 'cpa';
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
      if (metric === 'conversion-rate') {
        if (!cfg.definition) {
          toast({
            title: "Select Conversion Rate Type",
            description: "Choose Website (Conversions ÷ Sessions) or Click (Conversions ÷ Clicks).",
            variant: "destructive",
          });
          return;
        }
        const convOk = (cfg.inputs?.conversions || []).length > 0;
        const denomOk = cfg.definition === 'website' ? (cfg.inputs?.sessions || []).length > 0 : (cfg.inputs?.clicks || []).length > 0;
        if (!convOk || !denomOk) {
          toast({
            title: "Select Sources",
            description: "Select the required sources to compute Conversion Rate.",
            variant: "destructive",
          });
          return;
        }
      } else {
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
          <Button variant="outline" onClick={() => setShowExportDialog(true)} data-testid="button-export-kpis-report">
            <FileText className="w-4 h-4 mr-2" />
            Export KPIs Report
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-kpi">
            <Plus className="w-4 h-4 mr-2" />
            Create KPI
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {kpis.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No KPIs have been created yet.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create KPI
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Summary Panel */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    <p className="text-sm text-slate-600 dark:text-slate-400">Above Target</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-kpis-above-target">
                      {kpis.filter(k => {
                        const current = getKpiCurrentNumber(k);
                        const target = parseNumSafe(k?.targetValue) || 0;
                        const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                        if (target <= 0) return false;
                        return lowerBetter ? current <= target : current >= target;
                      }).length}
                    </p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Below Target</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-kpis-below-target">
                      {kpis.filter(k => {
                        const current = getKpiCurrentNumber(k);
                        const target = parseNumSafe(k?.targetValue) || 0;
                        const lowerBetter = isLowerBetterMetric(String(k?.metric || ''));
                        if (target <= 0) return false;
                        return lowerBetter ? current > target : current < target;
                      }).length}
                    </p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-500" />
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
              const lowerBetter = isLowerBetterMetric(String(kpi?.metric || ''));
              const ratio = target > 0 ? (lowerBetter ? (current > 0 ? target / current : 0) : (current / target)) : 0;
              const progressPercent = Math.round(Math.max(0, Math.min(ratio * 100, 100)));
              const liveDisplay = formatValueWithUnit(current, String(kpi?.unit || ''));
              const sourcesSelected = formatSourcesSelected(kpi?.calculationConfig);
              
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
                    {kpi.metric && (
                      <div className="mt-2">
                        <Badge 
                          variant="outline" 
                          className="text-xs font-normal bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          data-testid={`badge-metric-${kpi.id}`}
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Metric: {kpi.metric}
                        </Badge>
                        {sourcesSelected && (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400" data-testid={`text-kpi-sources-${kpi.id}`}>
                            <span className="font-medium">Sources selected:</span> {sourcesSelected}
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
                    {kpi.targetValue}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      progressPercent >= 100 ? 'bg-green-600' : 
                      progressPercent >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Trend and Metadata */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span>{kpi.timeframe}</span>
                </div>
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
                  { name: "Conversion Rate", metric: "conversion-rate", category: "Performance", description: "Choose Website or Click-based rate" },
                  { name: "Users", metric: "users", category: "Engagement", description: "Total users (selected sources)" },
                  { name: "Sessions", metric: "sessions", category: "Engagement", description: "Total sessions (selected sources)" },
                  { name: "Spend", metric: "spend", category: "Cost Efficiency", description: "Total spend (selected sources)" },
                  { name: "Leads", metric: "leads", category: "Performance", description: "Total leads (selected sources)" },
                  { name: "CPL", metric: "cpl", category: "Cost Efficiency", description: "Spend ÷ Leads" },
                  { name: "CTR", metric: "ctr", category: "Performance", description: "Clicks ÷ Impressions × 100" },
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
                          name: prev.name || template.name,
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

                {/* Conversion Rate type selection */}
                {String(kpiForm.metric) === 'conversion-rate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Conversion Rate Type *</Label>
                      <Select
                        value={String((normalizeCalcConfig(kpiCalculationConfig) as any)?.definition || '')}
                        onValueChange={(value) => {
                          setKpiCalculationConfig((prev: any) => ({
                            ...(normalizeCalcConfig(prev) || { metric: 'conversion-rate', inputs: {} }),
                            definition: value as any,
                            // Reset denominator selections when switching types
                            inputs: {
                              ...(normalizeCalcConfig(prev) || { inputs: {} }).inputs,
                              sessions: [],
                              clicks: [],
                            },
                          }));
                        }}
                      >
                        <SelectTrigger data-testid="select-campaign-kpi-conversion-rate-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Website (Conversions ÷ Sessions)</SelectItem>
                          <SelectItem value="click">Click (Conversions ÷ Clicks)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Current Value (preview)</Label>
                      <Input
                        value={(() => {
                          const computed = computeCurrentFromConfig(kpiCalculationConfig);
                          if (computed.value === null) return '';
                          return formatNumber(computed.value);
                        })()}
                        readOnly
                        placeholder="—"
                        data-testid="input-campaign-kpi-current-preview"
                      />
                    </div>
                  </div>
                )}

                {/* Required inputs */}
                {(() => {
                  const cfg = normalizeCalcConfig(kpiCalculationConfig);
                  const metric = String(kpiForm.metric || '');
                  const required = getRequiredInputsForMetric(metric);
                  const def = metric === 'conversion-rate' ? (cfg as any)?.definition : null;
                  const requiredWithDenom =
                    metric === 'conversion-rate'
                      ? (def === 'website' ? ['conversions', 'sessions'] : def === 'click' ? ['conversions', 'clicks'] : ['conversions'])
                      : required;

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
                      {/* Preview for non-conversion-rate metrics */}
                      {metric !== 'conversion-rate' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-600 dark:text-slate-400">Current Value (preview)</div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">{preview}</div>
                          </div>
                          <div className="text-xs text-slate-500 self-end">
                            Required inputs must be selected before you can create this KPI.
                          </div>
                        </div>
                      )}

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
                    setKpiForm({ ...kpiForm, metric: value, currentValue: '', unit });
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
                      <SelectItem value="conversion-rate">Conversion Rate</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="sessions">Sessions</SelectItem>
                      <SelectItem value="spend">Spend</SelectItem>
                      <SelectItem value="leads">Leads</SelectItem>
                      <SelectItem value="cpl">CPL</SelectItem>
                      <SelectItem value="ctr">CTR</SelectItem>
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
                  setKpiForm({ ...kpiForm, metric: value, currentValue: '', unit });
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
                    <SelectItem value="conversion-rate">Conversion Rate</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="sessions">Sessions</SelectItem>
                    <SelectItem value="spend">Spend</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="cpl">CPL</SelectItem>
                    <SelectItem value="ctr">CTR</SelectItem>
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

                {String(kpiForm.metric) === 'conversion-rate' && (
                  <div className="space-y-2">
                    <Label>Conversion Rate Type *</Label>
                    <Select
                      value={String((normalizeCalcConfig(kpiCalculationConfig) as any)?.definition || '')}
                      onValueChange={(value) => {
                        setKpiCalculationConfig((prev: any) => ({
                          ...(normalizeCalcConfig(prev) || { metric: 'conversion-rate', inputs: {} }),
                          definition: value as any,
                          inputs: {
                            ...(normalizeCalcConfig(prev) || { inputs: {} }).inputs,
                            sessions: [],
                            clicks: [],
                          },
                        }));
                      }}
                    >
                      <SelectTrigger data-testid="select-edit-campaign-kpi-conversion-rate-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">Website (Conversions ÷ Sessions)</SelectItem>
                        <SelectItem value="click">Click (Conversions ÷ Clicks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(() => {
                  const cfg = normalizeCalcConfig(kpiCalculationConfig);
                  const metric = String(kpiForm.metric || '');
                  const required = getRequiredInputsForMetric(metric);
                  const def = metric === 'conversion-rate' ? (cfg as any)?.definition : null;
                  const requiredWithDenom =
                    metric === 'conversion-rate'
                      ? (def === 'website' ? ['conversions', 'sessions'] : def === 'click' ? ['conversions', 'clicks'] : ['conversions'])
                      : required;

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

  // Fetch aggregated metrics from all connected platforms
  const { data: customIntegration } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: [`/api/linkedin/metrics/${campaign.id}`],
    enabled: !!campaign.id,
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'download' | 'schedule'>('download');
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
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
    industry: '',
    description: '',
    alertsEnabled: false,
    alertThreshold: '',
    alertCondition: 'below' as 'below' | 'above' | 'equals',
    emailRecipients: ''
  });

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
      industry: '',
      description: '',
      alertsEnabled: false,
      alertThreshold: '',
      alertCondition: 'below',
      emailRecipients: ''
    });
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

    const benchmarkData = {
      campaignId: campaign.id,
      platformType: null, // Campaign-level benchmark
      ...benchmarkForm,
      benchmarkValue: parseFloat(benchmarkForm.benchmarkValue),
      currentValue: benchmarkForm.currentValue ? parseFloat(benchmarkForm.currentValue) : 0,
      alertThreshold: benchmarkForm.alertsEnabled ? parseFloat(benchmarkForm.alertThreshold) : null,
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
    setBenchmarkForm({
      metric: benchmark.metric || '',
      name: benchmark.name || '',
      category: benchmark.category || 'performance',
      unit: benchmark.unit || '',
      benchmarkValue: String(benchmark.benchmarkValue || ''),
      currentValue: String(benchmark.currentValue || ''),
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

  // Calculate benchmark status based on current vs benchmark value
  const getBenchmarkStatus = (currentValue: number, benchmarkValue: number): 'above' | 'below' | 'meeting' => {
    const diff = Math.abs(currentValue - benchmarkValue);
    const tolerance = benchmarkValue * 0.05; // 5% tolerance
    
    if (diff <= tolerance) return 'meeting';
    return currentValue > benchmarkValue ? 'above' : 'below';
  };

  const calculateImprovement = (currentValue: string | number, benchmarkValue: string | number): number => {
    // Parse values as floats (decimal fields come from DB as strings)
    const current = typeof currentValue === 'string' ? parseFloat(currentValue.replace(/,/g, '')) : currentValue;
    const benchmark = typeof benchmarkValue === 'string' ? parseFloat(benchmarkValue.replace(/,/g, '')) : benchmarkValue;
    
    if (isNaN(current) || isNaN(benchmark) || benchmark === 0) return 0;
    return ((current - benchmark) / benchmark) * 100;
  };

  // Calculate summary stats
  const aboveTargetCount = benchmarks.filter(b => {
    const current = parseFloat((b.currentValue as string)?.replace(/,/g, '') || '0');
    const benchmark = parseFloat((b.benchmarkValue as string)?.replace(/,/g, '') || '0');
    const status = getBenchmarkStatus(current, benchmark);
    return status === 'above';
  }).length;

  const belowTargetCount = benchmarks.filter(b => {
    const current = parseFloat((b.currentValue as string)?.replace(/,/g, '') || '0');
    const benchmark = parseFloat((b.benchmarkValue as string)?.replace(/,/g, '') || '0');
    const status = getBenchmarkStatus(current, benchmark);
    return status === 'below';
  }).length;

  const avgImprovement = benchmarks.length > 0
    ? benchmarks.reduce((sum, b) => sum + calculateImprovement(b.currentValue || '0', b.benchmarkValue || '0'), 0) / benchmarks.length
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
            variant="outline" 
            onClick={() => setShowExportDialog(true)} 
            data-testid="button-export-benchmarks-report"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export Benchmarks Report
          </Button>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    <p className="text-sm text-slate-600 dark:text-slate-400">Above Target</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-above-target">
                      {aboveTargetCount}
                    </p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Below Target</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-below-target">
                      {belowTargetCount}
                    </p>
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
                    <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-avg-improvement">
                      {avgImprovement.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benchmarks List */}
          <div className="space-y-4">
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
                  {benchmark.metric && (
                    <div className="mt-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs font-normal bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        data-testid={`badge-benchmark-metric-${benchmark.id}`}
                      >
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Metric: {benchmark.metric}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    {benchmark.benchmarkType && <span>Type: {benchmark.benchmarkType}</span>}
                    {benchmark.industry && (
                      <>
                        <span>â€¢</span>
                        <span>{benchmark.industry}</span>
                      </>
                    )}
                    {benchmark.period && (
                      <>
                        <span>â€¢</span>
                        <span>{benchmark.period}</span>
                      </>
                    )}
                    {benchmark.category && (
                      <>
                        <span>â€¢</span>
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the benchmark "${benchmark.name}"?`)) {
                        deleteBenchmarkMutation.mutate(benchmark.id);
                      }
                    }}
                    data-testid={`button-delete-${benchmark.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                const current = parseFloat(benchmark.currentValue);
                const benchmarkVal = parseFloat(benchmark.benchmarkValue);
                
                // Progress: percentage of benchmark achieved (show actual value, not capped)
                const progressTowardBenchmark = (current / benchmarkVal) * 100;
                
                // Performance comparison
                const diff = current - benchmarkVal;
                const percentDiff = benchmarkVal > 0 ? ((diff / benchmarkVal) * 100) : 0;
                
                // Status determination: Above benchmark = green, Below = red
                const isAboveBenchmark = current >= benchmarkVal; // 100% or more
                const isBelowBenchmark = current < benchmarkVal; // Below 100%
                
                return (
                  <div className="mt-4 space-y-3">
                    {/* Progress to Benchmark */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400">Progress to Benchmark</span>
                          {isAboveBenchmark && <TrendingUp className="w-4 h-4 text-green-600" />}
                          {isBelowBenchmark && <TrendingDown className="w-4 h-4 text-red-600" />}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {progressTowardBenchmark.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full transition-all ${
                            isAboveBenchmark ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(progressTowardBenchmark, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Benchmark Status and Comparison */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                        isAboveBenchmark
                          ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
                      }`}>
                        {isAboveBenchmark && <CheckCircle2 className="w-3 h-3" />}
                        {isBelowBenchmark && <AlertCircle className="w-3 h-3" />}
                        <span>
                          {isAboveBenchmark ? 'Meeting Target' : 'Below Target'}
                        </span>
                      </div>
                      
                      <Badge 
                        variant={isAboveBenchmark ? "default" : "secondary"}
                        className={isAboveBenchmark ? "bg-green-600 text-white" : "bg-red-600 text-white"}
                        data-testid={`badge-status-${benchmark.id}`}
                      >
                        {current >= benchmarkVal ? (
                          <>
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {percentDiff.toFixed(2)}% Above Benchmark
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {Math.abs(percentDiff).toFixed(2)}% Below Benchmark
                          </>
                        )}
                      </Badge>
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
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Benchmarks Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Create your first benchmark to start tracking performance against industry standards
          </p>
          <Button 
            onClick={() => {
              setEditingBenchmark(null);
              resetBenchmarkForm();
              setShowCreateDialog(true);
            }}
            data-testid="button-create-first-benchmark"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Benchmark
          </Button>
        </div>
      )}

      {/* Create/Edit Benchmark Dialog */}
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
                ? 'Update the benchmark details below. Select a metric to auto-populate the current value.'
                : 'Define a new benchmark for your campaign. You can select metrics from connected platforms or enter custom values.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benchmark-name">Benchmark Name *</Label>
              <Input
                id="benchmark-name"
                placeholder="e.g., Email Open Rate Benchmark"
                value={benchmarkForm.name}
                onChange={(e) => setBenchmarkForm({ ...benchmarkForm, name: e.target.value })}
                data-testid="input-benchmark-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benchmark-metric">Aggregated Metric</Label>
                <Select
                  value={benchmarkForm.metric || ''}
                  onValueChange={(value) => {
                    // Auto-populate current value with aggregated data across ALL platforms
                    let currentValue = '';
                    let unit = '';
                    
                    // Aggregate data from LinkedIn and Custom Integration
                    const liMetrics = linkedinMetrics || {};
                    const ciMetrics = customIntegration?.metrics || {};
                    
                    // Helper to safely parse numbers
                    const parseNum = (val: any): number => {
                      const num = typeof val === 'string' ? parseFloat(val) : val;
                      return isNaN(num) ? 0 : num;
                    };
                    
                    switch(value) {
                      // Core Aggregated Metrics (sum across ALL platforms)
                      case 'total-impressions':
                        const liImpressions = parseNum(liMetrics.impressions);
                        const ciPageviews = parseNum(ciMetrics.pageviews);
                        currentValue = formatNumber(liImpressions + ciPageviews);
                        break;
                      case 'total-clicks':
                        const liClicks = parseNum(liMetrics.clicks);
                        currentValue = formatNumber(liClicks);
                        break;
                      case 'total-conversions':
                        const liConversions = parseNum(liMetrics.conversions);
                        currentValue = formatNumber(liConversions);
                        break;
                      case 'total-leads':
                        const liLeads = parseNum(liMetrics.leads);
                        currentValue = formatNumber(liLeads);
                        break;
                      case 'total-spend':
                        const liSpend = parseNum(liMetrics.spend);
                        currentValue = formatNumber(liSpend);
                        unit = '$';
                        break;
                      case 'total-engagements':
                        const liEngagements = parseNum(liMetrics.engagements);
                        const ciSessions = parseNum(ciMetrics.sessions);
                        currentValue = formatNumber(liEngagements + ciSessions);
                        break;
                      
                      // Calculated Blended Metrics (using aggregated totals)
                      case 'overall-ctr':
                        const totalClicks = parseNum(liMetrics.clicks);
                        const totalImpressions = parseNum(liMetrics.impressions) + parseNum(ciMetrics.pageviews);
                        currentValue = formatNumber(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0);
                        unit = '%';
                        break;
                      case 'blended-cpc':
                        const totalSpend = parseNum(liMetrics.spend);
                        const clicks = parseNum(liMetrics.clicks);
                        currentValue = formatNumber(clicks > 0 ? totalSpend / clicks : 0);
                        unit = '$';
                        break;
                      case 'blended-cpm':
                        const spendForCpm = parseNum(liMetrics.spend);
                        const impressionsForCpm = parseNum(liMetrics.impressions) + parseNum(ciMetrics.pageviews);
                        currentValue = formatNumber(impressionsForCpm > 0 ? (spendForCpm / impressionsForCpm) * 1000 : 0);
                        unit = '$';
                        break;
                      case 'campaign-cvr':
                        const conversions = parseNum(liMetrics.conversions);
                        const clicksForCvr = parseNum(liMetrics.clicks);
                        currentValue = formatNumber(clicksForCvr > 0 ? (conversions / clicksForCvr) * 100 : 0);
                        unit = '%';
                        break;
                      case 'campaign-cpa':
                        const spendForCpa = parseNum(liMetrics.spend);
                        const conversionsForCpa = parseNum(liMetrics.conversions);
                        currentValue = formatNumber(conversionsForCpa > 0 ? spendForCpa / conversionsForCpa : 0);
                        unit = '$';
                        break;
                      case 'campaign-cpl':
                        const spendForCpl = parseNum(liMetrics.spend);
                        const leadsForCpl = parseNum(liMetrics.leads);
                        currentValue = formatNumber(leadsForCpl > 0 ? spendForCpl / leadsForCpl : 0);
                        unit = '$';
                        break;
                      
                      // Audience & Engagement (from Custom Integration)
                      case 'total-users':
                        currentValue = formatNumber(parseNum(ciMetrics.users));
                        break;
                      case 'total-sessions':
                        currentValue = formatNumber(parseNum(ciMetrics.sessions));
                        break;
                    }
                    
                    setBenchmarkForm({ ...benchmarkForm, metric: value, currentValue, unit: unit || benchmarkForm.unit });
                  }}
                >
                  <SelectTrigger id="benchmark-metric" data-testid="select-benchmark-metric">
                    <SelectValue placeholder="Select metric or leave empty for custom" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {/* Aggregated Campaign Metrics - Always visible */}
                    <SelectGroup>
                      <SelectLabel>ðŸ“Š Core Campaign Metrics</SelectLabel>
                      <SelectItem value="total-impressions">Total Impressions</SelectItem>
                      <SelectItem value="total-clicks">Total Clicks</SelectItem>
                      <SelectItem value="total-conversions">Total Conversions</SelectItem>
                      <SelectItem value="total-leads">Total Leads</SelectItem>
                      <SelectItem value="total-spend">Total Spend</SelectItem>
                      <SelectItem value="total-engagements">Total Engagements</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>ðŸ“ˆ Blended Performance Metrics</SelectLabel>
                      <SelectItem value="overall-ctr">Overall CTR</SelectItem>
                      <SelectItem value="blended-cpc">Blended CPC</SelectItem>
                      <SelectItem value="blended-cpm">Blended CPM</SelectItem>
                      <SelectItem value="campaign-cvr">Campaign CVR</SelectItem>
                      <SelectItem value="campaign-cpa">Campaign CPA</SelectItem>
                      <SelectItem value="campaign-cpl">Campaign CPL</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>ðŸ‘¥ Audience Metrics</SelectLabel>
                      <SelectItem value="total-users">Total Users</SelectItem>
                      <SelectItem value="total-sessions">Total Sessions</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="benchmark-industry">Industry (Optional)</Label>
                <Select
                  value={benchmarkForm.industry || "__none__"}
                  onValueChange={async (value) => {
                    const nextIndustry = value === "__none__" ? "" : value;
                    // Update industry
                    setBenchmarkForm({ ...benchmarkForm, industry: nextIndustry });
                    
                    // If industry selected and metric selected, auto-fill benchmark value
                    if (nextIndustry && nextIndustry !== 'other' && benchmarkForm.metric) {
                      try {
                        const response = await fetch(`/api/industry-benchmarks/${nextIndustry}/${benchmarkForm.metric}`);
                        if (response.ok) {
                          const data = await response.json();
                          setBenchmarkForm(prev => ({
                            ...prev,
                            benchmarkValue: String(data.value),
                            unit: data.unit
                          }));
                        }
                      } catch (error) {
                        console.error('Failed to fetch benchmark value:', error);
                      }
                    }
                  }}
                >
                  <SelectTrigger id="benchmark-industry">
                    <SelectValue placeholder="Select industry for auto-fill or leave blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (Enter custom value)</SelectItem>
                    {industryData?.industries.map((industry) => (
                      <SelectItem key={industry.value} value={industry.value}>
                        {industry.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (Custom value)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ðŸ’¡ Select an industry to auto-fill benchmark value, or leave blank to enter custom value
                </p>
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-value">Current Value</Label>
                <Input
                  id="current-value"
                  placeholder="0"
                  value={benchmarkForm.currentValue}
                  onChange={(e) => {
                    // Only allow numbers and decimals, then format with commas
                    let value = e.target.value.replace(/[^\d.]/g, '');
                    
                    // Prevent multiple decimal points
                    const parts = value.split('.');
                    if (parts.length > 2) {
                      value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    
                    // Format with commas
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
                    // Only allow numbers and decimals - no letters
                    let value = e.target.value.replace(/[^\d.]/g, '');
                    
                    // Prevent multiple decimal points
                    const parts = value.split('.');
                    if (parts.length > 2) {
                      value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    
                    // Format with commas
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

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={benchmarkForm.unit}
                  onValueChange={(value) => setBenchmarkForm({ ...benchmarkForm, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="$">$</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="ratio">Ratio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              disabled={createBenchmarkMutation.isPending || updateBenchmarkMutation.isPending}
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

// Campaign Chat Messages Interface
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// Campaign Insights Chat Component
function CampaignInsightsChat({ campaign }: { campaign: Campaign }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hi! I'm your AI marketing assistant. I can help you analyze your "${campaign.name}" campaign performance, provide insights, and answer questions about your marketing strategy. What would you like to know?`,
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sample predefined questions for marketing professionals
  const sampleQuestions = [
    "What are the key performance trends for this campaign?",
    "How does this campaign compare to industry benchmarks?",
    "What optimization opportunities do you recommend?",
    "Which platforms are delivering the best ROI?",
    "What audience segments are performing best?",
    "How can I improve conversion rates?"
  ];

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // Simulate AI response with marketing insights
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(currentMessage, campaign),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (question: string, campaign: Campaign): string => {
    // Simple response generation based on keywords in the question
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('performance') || lowerQuestion.includes('trend')) {
      return `Based on your ${campaign.name} campaign data, I can see strong performance with ${campaign.impressions.toLocaleString()} impressions and ${campaign.clicks.toLocaleString()} clicks. Your CTR is performing well, and spend efficiency shows room for optimization. Would you like me to dive deeper into any specific metrics?`;
    }
    
    if (lowerQuestion.includes('roi') || lowerQuestion.includes('roas') || lowerQuestion.includes('return')) {
      return `Your ${campaign.name} campaign shows promising returns. With current spend levels, I recommend focusing on high-performing audience segments to maximize ROI. Consider reallocating budget from underperforming platforms to top performers. Would you like specific budget reallocation recommendations?`;
    }
    
    if (lowerQuestion.includes('platform') || lowerQuestion.includes('channel')) {
      return `Looking at your multi-platform approach, different channels are showing varied performance. Google Analytics and Google Sheets integrations are providing strong data insights. I recommend analyzing cross-platform attribution to optimize your media mix. What platforms are you most curious about?`;
    }
    
    if (lowerQuestion.includes('audience') || lowerQuestion.includes('target')) {
      return `Audience performance varies across segments. High-engagement audiences are showing 23% better conversion rates. I suggest creating lookalike audiences based on your top performers and testing refined targeting parameters. Which audience segments are you most interested in analyzing?`;
    }
    
    if (lowerQuestion.includes('optimization') || lowerQuestion.includes('improve')) {
      return `Several optimization opportunities exist for ${campaign.name}. Key areas include: 1) Bid strategy refinement, 2) Ad creative testing, 3) Landing page optimization, 4) Audience targeting expansion. Which area would you like to focus on first?`;
    }
    
    // Default response
    return `That's an excellent question about ${campaign.name}! Based on the current campaign data, I can provide detailed insights and recommendations. Could you be more specific about what aspect of the campaign you'd like me to analyze? I can help with performance metrics, optimization strategies, audience analysis, or budget allocation.`;
  };

  const handleQuestionClick = (question: string) => {
    setCurrentMessage(question);
  };

  return (
    <div className="space-y-6">
      {/* Chat Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5" />
            <span>Campaign Intelligence Chat</span>
          </CardTitle>
          <CardDescription>
            Ask questions about your campaign performance, get insights, and receive personalized recommendations
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sample Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Start Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {sampleQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto p-3 text-xs"
                onClick={() => handleQuestionClick(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card>
        <CardContent className="p-0">
          {/* Messages */}
          <ScrollArea className="h-96 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`p-2 rounded-full ${message.sender === 'user' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {message.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-3 rounded-lg ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[80%]">
                    <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Ask about your campaign performance, optimization strategies, or any marketing questions..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!currentMessage.trim() || isLoading}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>AI Marketing Tips</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
              <p className="font-medium text-blue-800 dark:text-blue-200">Performance Insight</p>
              <p className="text-blue-700 dark:text-blue-300">Your campaign shows strong engagement patterns. Consider A/B testing your top-performing creatives.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
              <p className="font-medium text-green-800 dark:text-green-200">Optimization Opportunity</p>
              <p className="text-green-700 dark:text-green-300">Peak performance hours are 2-4 PM. Consider dayparting strategies to maximize efficiency.</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500">
              <p className="font-medium text-orange-800 dark:text-orange-200">Budget Recommendation</p>
              <p className="text-orange-700 dark:text-orange-300">High-performing segments have room for 20% budget increase without diminishing returns.</p>
            </div>
          </div>
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

  const { data: connectedPlatformsData } = useQuery<{ statuses: ConnectedPlatformStatus[] }>({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/connected-platforms`);
      if (!response.ok) {
        console.error(`[Campaign Detail] Failed to fetch connected platforms for ${campaignId}`);
        return { statuses: [] };
      }
      const data = await response.json();
      console.log(`[Campaign Detail] Connected platforms for ${campaignId}:`, JSON.stringify(data, null, 2));
      return data;
    }
  });

  const connectedPlatformStatuses: ConnectedPlatformStatus[] =
    connectedPlatformsData?.statuses ?? [];

  const platformStatusMap = useMemo(() => {
    const map = new Map<string, ConnectedPlatformStatus>();
    connectedPlatformStatuses.forEach((status) => {
      console.log(`[Campaign Detail] Mapping platform ${status.id}: connected=${status.connected}`);
      map.set(status.id, status);
    });
    return map;
  }, [connectedPlatformStatuses]);

  // Get campaign KPIs for report inclusion
  const { data: campaignKPIs } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "kpis"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpis`);
      if (!response.ok) return [];
      return response.json();
    },
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
    queryKey: [`/api/linkedin/metrics/${campaignId}`],
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
  
  console.log(`[Campaign Detail] GA4 Status Check:`, {
    campaignId,
    gaPlatformStatus,
    isGA4Connected,
    analyticsPath: gaPlatformStatus?.analyticsPath
  });
  
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
      connected: platformStatusMap.get("linkedin")?.connected === true,
      impressions: platformStatusMap.get("linkedin")?.connected ? Math.round(campaignImpressions * platformDistribution["LinkedIn Ads"].impressions) : 0,
      clicks: platformStatusMap.get("linkedin")?.connected ? Math.round(campaignClicks * platformDistribution["LinkedIn Ads"].clicks) : 0,
      conversions: platformStatusMap.get("linkedin")?.connected ? Math.round(estimatedConversions * platformDistribution["LinkedIn Ads"].conversions) : 0,
      spend: platformStatusMap.get("linkedin")?.connected ? (campaignSpend * platformDistribution["LinkedIn Ads"].spend).toFixed(2) : "0.00",
      ctr: platformStatusMap.get("linkedin")?.connected ? "2.78%" : "0.00%",
      cpc: platformStatusMap.get("linkedin")?.connected ? "$0.48" : "$0.00",
      analyticsPath: platformStatusMap.get("linkedin")?.analyticsPath || `/campaigns/${campaign?.id}/linkedin-analytics`
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
  
  console.log('[Campaign Detail] Connected platform IDs:', connectedPlatformIds);
  console.log('[Campaign Detail] Connected platform names:', connectedPlatformNames);
  console.log('[Campaign Detail] Showing all platforms, connected count:', platformMetrics.filter(p => p.connected).length);

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
      // Mock benchmark data (would be fetched from API in production)
      const mockBenchmarks = [
        {
          name: 'Industry CTR Benchmark',
          currentValue: '2.84%',
          targetValue: '2.35%',
          status: 'Above Target',
          category: 'Performance',
          industry: 'Marketing & Advertising'
        },
        {
          name: 'Conversion Rate Standard',
          currentValue: '4.68%',
          targetValue: '3.20%',
          status: 'Above Target',
          category: 'Conversion',
          industry: 'E-commerce'
        },
        {
          name: 'Cost Per Acquisition',
          currentValue: '$18.50',
          targetValue: '$25.00',
          status: 'Above Target',
          category: 'Cost',
          industry: 'SaaS'
        },
        {
          name: 'Return on Ad Spend',
          currentValue: '5.8x',
          targetValue: '4.0x',
          status: 'Above Target',
          category: 'Revenue',
          industry: 'Multi-platform'
        }
      ];

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
        benchmarks: includeBenchmarks ? mockBenchmarks : [],
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
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="attribution">Attribution</TabsTrigger>
              <TabsTrigger value="ab-testing">A/B Tests</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
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
                    className={`flex items-center justify-between p-3 ${!platform.connected ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors' : ''}`}
                    onClick={() => {
                      if (!platform.connected) {
                        setExpandedPlatform(expandedPlatform === platform.platform ? null : platform.platform);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {getPlatformIcon(platform.platform)}
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{platform.platform}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {platform.connected ? "Connected & syncing data" : "Not connected"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={platform.connected ? "default" : "secondary"}
                        className={platform.connected ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                      >
                        {platform.connected ? "Connected" : "Not Connected"}
                      </Badge>
                      {!platform.connected && (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedPlatform === platform.platform ? 'rotate-180' : ''}`} />
                      )}
                      {platform.connected && (
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Connected Platform Metrics - Only show when platform is connected */}
                  {platform.connected && (
                    <div className="px-3 pb-3">
                      <div className="space-y-4">
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
                        {/* View Detailed Analytics Button - Show for Google Sheets when any active connection exists */}
                        {platform.platform === "Google Sheets" && platform.connected && (
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
                        {platform.analyticsPath && platform.platform !== "Google Sheets" && (
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
                  {expandedPlatform === platform.platform && (!platform.connected || (platform.platform === "Google Sheets" && canAddMoreSheets)) && (
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

            <TabsContent value="ab-testing" className="space-y-6">
              <ABTestManager campaignId={campaign.id} />
            </TabsContent>

            <TabsContent value="attribution" className="space-y-6">
              <AttributionDashboard />
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6">
              <CampaignBenchmarks campaign={campaign} />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <ScheduledReportsSection campaignId={campaign.id} />
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <CampaignInsightsChat campaign={campaign} />
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
    </div>
  );
}
